// Proxies the actual HTTP call to the user-selected provider (#42: OpenAI or
// Anthropic) — the API key is read from disk and attached here, in Rust,
// so it never enters the webview/JS context (see issue #14's decision).

use serde::Serialize;

use super::secrets::get_api_key_internal;
use super::vendor::Vendor;

const OPENAI_MODEL: &str = "gpt-4o-mini";
// Cheap tier, matching gpt-4o-mini — see issue #42's decision.
const ANTHROPIC_MODEL: &str = "claude-haiku-4-5-20251001";
const ANTHROPIC_MAX_TOKENS: u32 = 4096;
const ANTHROPIC_VERSION: &str = "2023-06-01";

#[derive(Debug, Serialize, PartialEq)]
#[serde(tag = "kind")]
pub enum ProviderCallError {
    #[serde(rename = "rate_limited")]
    RateLimited {
        message: String,
        #[serde(rename = "retryAfterMs", skip_serializing_if = "Option::is_none")]
        retry_after_ms: Option<u64>,
    },
    #[serde(rename = "provider_error")]
    ProviderError { message: String },
}

// Vendor usage block, normalized to one shape regardless of which vendor
// answered (ADR-0009 / #94) — captured here, outside core's Engine/Provider
// contract, so ADR-0002's flat prompt-in/text-out shape stays untouched.
#[derive(Debug, Serialize, PartialEq, Default)]
pub struct ProviderUsage {
    #[serde(rename = "inputTokens")]
    pub input_tokens: u32,
    #[serde(rename = "outputTokens")]
    pub output_tokens: u32,
    #[serde(rename = "cacheReadTokens", skip_serializing_if = "Option::is_none")]
    pub cache_read_tokens: Option<u32>,
}

#[derive(Debug, Serialize, PartialEq)]
pub struct ProviderResponse {
    pub text: String,
    pub usage: ProviderUsage,
}

fn provider_error(message: impl Into<String>) -> ProviderCallError {
    ProviderCallError::ProviderError { message: message.into() }
}

fn u32_field(json: &serde_json::Value, key: &str) -> u32 {
    json[key].as_u64().unwrap_or(0) as u32
}

// Neither vendor's own usage block requires network I/O to read — pure,
// like parse_provider_response, and only called once a 200 is confirmed.
fn parse_usage(vendor: Vendor, json: &serde_json::Value) -> ProviderUsage {
    let usage = &json["usage"];
    match vendor {
        // OpenAI: usage.prompt_tokens / usage.completion_tokens; cached
        // tokens (if any) nest under prompt_tokens_details.cached_tokens.
        Vendor::OpenAi => ProviderUsage {
            input_tokens: u32_field(usage, "prompt_tokens"),
            output_tokens: u32_field(usage, "completion_tokens"),
            cache_read_tokens: usage["prompt_tokens_details"]["cached_tokens"].as_u64().map(|n| n as u32),
        },
        // Anthropic: usage.input_tokens / usage.output_tokens, with cache
        // reads (if any) in their own top-level field, not nested.
        Vendor::Anthropic => ProviderUsage {
            input_tokens: u32_field(usage, "input_tokens"),
            output_tokens: u32_field(usage, "output_tokens"),
            cache_read_tokens: usage["cache_read_input_tokens"].as_u64().map(|n| n as u32),
        },
    }
}

// Pure — takes an already-fetched status/header/body triple, no network I/O,
// so it's directly unit-testable without a mock server. Status-code handling
// is shared across vendors; only the success-path shape differs.
pub fn parse_provider_response(
    vendor: Vendor,
    status: u16,
    retry_after_header: Option<&str>,
    body: &str,
) -> Result<ProviderResponse, ProviderCallError> {
    if status == 429 {
        let retry_after_ms = retry_after_header.and_then(|v| v.parse::<u64>().ok()).map(|secs| secs * 1000);
        return Err(ProviderCallError::RateLimited {
            message: "Rate limited by provider".to_string(),
            retry_after_ms,
        });
    }
    if status >= 400 {
        return Err(provider_error(format!("Provider returned {status}: {body}")));
    }

    let json: serde_json::Value =
        serde_json::from_str(body).map_err(|e| provider_error(format!("Invalid response JSON: {e}")))?;

    let text = match vendor {
        Vendor::Anthropic => json["content"][0]["text"]
            .as_str()
            .map(str::to_string)
            .ok_or_else(|| provider_error("Missing content[0].text in provider response")),
        Vendor::OpenAi => json["choices"][0]["message"]["content"]
            .as_str()
            .map(str::to_string)
            .ok_or_else(|| provider_error("Missing choices[0].message.content in provider response")),
    }?;

    Ok(ProviderResponse { text, usage: parse_usage(vendor, &json) })
}

fn build_request(client: &reqwest::Client, vendor: Vendor, api_key: &str, prompt: &str) -> reqwest::RequestBuilder {
    match vendor {
        Vendor::Anthropic => client
            .post("https://api.anthropic.com/v1/messages")
            .header("x-api-key", api_key)
            .header("anthropic-version", ANTHROPIC_VERSION)
            .json(&serde_json::json!({
                "model": ANTHROPIC_MODEL,
                "max_tokens": ANTHROPIC_MAX_TOKENS,
                "messages": [{ "role": "user", "content": prompt }],
            })),
        Vendor::OpenAi => client
            .post("https://api.openai.com/v1/chat/completions")
            .bearer_auth(api_key)
            .json(&serde_json::json!({
                "model": OPENAI_MODEL,
                "messages": [{ "role": "user", "content": prompt }],
            })),
    }
}

#[tauri::command]
pub async fn call_provider(
    app: tauri::AppHandle,
    prompt: String,
    vendor: String,
) -> Result<ProviderResponse, ProviderCallError> {
    let vendor = Vendor::parse(&vendor).map_err(provider_error)?;

    // File I/O off the async executor thread so it doesn't stall other commands.
    let api_key = tauri::async_runtime::spawn_blocking(move || get_api_key_internal(&app, vendor))
        .await
        .map_err(|e| provider_error(e.to_string()))?
        .map_err(provider_error)?
        .ok_or_else(|| provider_error("No API key configured — add one in Settings."))?;

    let client = reqwest::Client::new();
    let response = build_request(&client, vendor, &api_key, &prompt)
        .send()
        .await
        .map_err(|e| provider_error(e.to_string()))?;

    let status = response.status().as_u16();
    let retry_after = response
        .headers()
        .get("retry-after")
        .and_then(|v| v.to_str().ok())
        .map(str::to_string);
    let body = response.text().await.map_err(|e| provider_error(e.to_string()))?;

    parse_provider_response(vendor, status, retry_after.as_deref(), &body)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn openai_success_body(content: &str) -> String {
        serde_json::json!({ "choices": [{ "message": { "content": content } }] }).to_string()
    }

    fn anthropic_success_body(text: &str) -> String {
        serde_json::json!({ "content": [{ "type": "text", "text": text }] }).to_string()
    }

    #[test]
    fn parses_a_successful_openai_response() {
        let body = openai_success_body("rewritten text");
        let result = parse_provider_response(Vendor::OpenAi, 200, None, &body).unwrap();
        assert_eq!(result.text, "rewritten text");
        assert_eq!(result.usage, ProviderUsage::default());
    }

    #[test]
    fn parses_a_successful_anthropic_response() {
        let body = anthropic_success_body("rewritten text");
        let result = parse_provider_response(Vendor::Anthropic, 200, None, &body).unwrap();
        assert_eq!(result.text, "rewritten text");
        assert_eq!(result.usage, ProviderUsage::default());
    }

    #[test]
    fn parses_openai_usage_including_cached_tokens() {
        let body = serde_json::json!({
            "choices": [{ "message": { "content": "hi" } }],
            "usage": {
                "prompt_tokens": 420,
                "completion_tokens": 180,
                "prompt_tokens_details": { "cached_tokens": 100 },
            },
        })
        .to_string();
        let result = parse_provider_response(Vendor::OpenAi, 200, None, &body).unwrap();
        assert_eq!(
            result.usage,
            ProviderUsage { input_tokens: 420, output_tokens: 180, cache_read_tokens: Some(100) }
        );
    }

    #[test]
    fn parses_openai_usage_without_cached_tokens() {
        let body = serde_json::json!({
            "choices": [{ "message": { "content": "hi" } }],
            "usage": { "prompt_tokens": 50, "completion_tokens": 20 },
        })
        .to_string();
        let result = parse_provider_response(Vendor::OpenAi, 200, None, &body).unwrap();
        assert_eq!(result.usage, ProviderUsage { input_tokens: 50, output_tokens: 20, cache_read_tokens: None });
    }

    #[test]
    fn parses_anthropic_usage_including_cache_read_tokens() {
        let body = serde_json::json!({
            "content": [{ "type": "text", "text": "hi" }],
            "usage": { "input_tokens": 500, "output_tokens": 210, "cache_read_input_tokens": 300 },
        })
        .to_string();
        let result = parse_provider_response(Vendor::Anthropic, 200, None, &body).unwrap();
        assert_eq!(
            result.usage,
            ProviderUsage { input_tokens: 500, output_tokens: 210, cache_read_tokens: Some(300) }
        );
    }

    #[test]
    fn parses_anthropic_usage_without_cache_read_tokens() {
        let body = serde_json::json!({
            "content": [{ "type": "text", "text": "hi" }],
            "usage": { "input_tokens": 30, "output_tokens": 15 },
        })
        .to_string();
        let result = parse_provider_response(Vendor::Anthropic, 200, None, &body).unwrap();
        assert_eq!(result.usage, ProviderUsage { input_tokens: 30, output_tokens: 15, cache_read_tokens: None });
    }

    #[test]
    fn maps_429_to_rate_limited_with_retry_after() {
        let err = parse_provider_response(Vendor::OpenAi, 429, Some("30"), "").unwrap_err();
        assert_eq!(
            err,
            ProviderCallError::RateLimited {
                message: "Rate limited by provider".to_string(),
                retry_after_ms: Some(30_000),
            }
        );
    }

    #[test]
    fn maps_429_without_retry_after_header() {
        let err = parse_provider_response(Vendor::OpenAi, 429, None, "").unwrap_err();
        assert_eq!(
            err,
            ProviderCallError::RateLimited { message: "Rate limited by provider".to_string(), retry_after_ms: None }
        );
    }

    #[test]
    fn maps_other_4xx_5xx_to_provider_error() {
        let err = parse_provider_response(Vendor::OpenAi, 401, None, "invalid api key").unwrap_err();
        assert!(matches!(err, ProviderCallError::ProviderError { message } if message.contains("401")));
    }

    #[test]
    fn maps_malformed_json_to_provider_error() {
        let err = parse_provider_response(Vendor::OpenAi, 200, None, "not json").unwrap_err();
        assert!(matches!(err, ProviderCallError::ProviderError { .. }));
    }

    #[test]
    fn maps_missing_content_field_to_provider_error() {
        let body = serde_json::json!({ "choices": [] }).to_string();
        let err = parse_provider_response(Vendor::OpenAi, 200, None, &body).unwrap_err();
        assert!(matches!(err, ProviderCallError::ProviderError { .. }));
    }

    #[test]
    fn maps_missing_anthropic_content_field_to_provider_error() {
        let body = serde_json::json!({ "content": [] }).to_string();
        let err = parse_provider_response(Vendor::Anthropic, 200, None, &body).unwrap_err();
        assert!(matches!(err, ProviderCallError::ProviderError { .. }));
    }

    #[test]
    fn builds_an_openai_bearer_request() {
        let client = reqwest::Client::new();
        let req = build_request(&client, Vendor::OpenAi, "sk-test", "hello").build().unwrap();
        assert_eq!(req.url().as_str(), "https://api.openai.com/v1/chat/completions");
        assert_eq!(req.headers().get("authorization").unwrap(), "Bearer sk-test");
    }

    #[test]
    fn builds_an_anthropic_header_request() {
        let client = reqwest::Client::new();
        let req = build_request(&client, Vendor::Anthropic, "sk-ant-test", "hello").build().unwrap();
        assert_eq!(req.url().as_str(), "https://api.anthropic.com/v1/messages");
        assert_eq!(req.headers().get("x-api-key").unwrap(), "sk-ant-test");
        assert_eq!(req.headers().get("anthropic-version").unwrap(), ANTHROPIC_VERSION);
    }
}
