// Proxies the actual HTTP call to the user-selected provider (#42: OpenAI or
// Anthropic) — the API key is read from Keychain and attached here, in Rust,
// so it never enters the webview/JS context (see issue #14's decision).

use serde::Serialize;

use super::secrets::get_api_key_internal;
use super::vendor::Vendor;

const OPENAI_MODEL: &str = "gpt-4o-mini";
// Cheap tier, matching gpt-4o-mini — see issue #42's decision.
const ANTHROPIC_MODEL: &str = "claude-3-5-haiku-latest";
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

fn provider_error(message: impl Into<String>) -> ProviderCallError {
    ProviderCallError::ProviderError { message: message.into() }
}

// Pure — takes an already-fetched status/header/body triple, no network I/O,
// so it's directly unit-testable without a mock server. Status-code handling
// is shared across vendors; only the success-path shape differs.
pub fn parse_provider_response(
    vendor: Vendor,
    status: u16,
    retry_after_header: Option<&str>,
    body: &str,
) -> Result<String, ProviderCallError> {
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

    match vendor {
        Vendor::Anthropic => json["content"][0]["text"]
            .as_str()
            .map(str::to_string)
            .ok_or_else(|| provider_error("Missing content[0].text in provider response")),
        Vendor::OpenAi => json["choices"][0]["message"]["content"]
            .as_str()
            .map(str::to_string)
            .ok_or_else(|| provider_error("Missing choices[0].message.content in provider response")),
    }
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
pub async fn call_provider(prompt: String, vendor: String) -> Result<String, ProviderCallError> {
    let vendor = Vendor::parse(&vendor).map_err(provider_error)?;

    // Native Keychain access can block on a first-time OS permission prompt —
    // run it off the async executor thread so it doesn't stall other commands.
    let api_key = tauri::async_runtime::spawn_blocking(move || get_api_key_internal(vendor))
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
        assert_eq!(parse_provider_response(Vendor::OpenAi, 200, None, &body), Ok("rewritten text".to_string()));
    }

    #[test]
    fn parses_a_successful_anthropic_response() {
        let body = anthropic_success_body("rewritten text");
        assert_eq!(parse_provider_response(Vendor::Anthropic, 200, None, &body), Ok("rewritten text".to_string()));
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
