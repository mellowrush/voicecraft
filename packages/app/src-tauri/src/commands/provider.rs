// Proxies the actual HTTP call to the (v1: hardcoded, OpenAI-compatible)
// provider — the API key is read from Keychain and attached here, in Rust,
// so it never enters the webview/JS context (see issue #14's decision).

use serde::Serialize;

use super::secrets::get_api_key_internal;

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
// so it's directly unit-testable without a mock server.
pub fn parse_provider_response(
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

    json["choices"][0]["message"]["content"]
        .as_str()
        .map(str::to_string)
        .ok_or_else(|| provider_error("Missing choices[0].message.content in provider response"))
}

#[tauri::command]
pub async fn call_provider(prompt: String) -> Result<String, ProviderCallError> {
    // Native Keychain access can block on a first-time OS permission prompt —
    // run it off the async executor thread so it doesn't stall other commands.
    let api_key = tauri::async_runtime::spawn_blocking(get_api_key_internal)
        .await
        .map_err(|e| provider_error(e.to_string()))?
        .map_err(provider_error)?
        .ok_or_else(|| provider_error("No API key configured — add one in Settings."))?;

    let client = reqwest::Client::new();
    let response = client
        .post("https://api.openai.com/v1/chat/completions")
        .bearer_auth(api_key)
        .json(&serde_json::json!({
            "model": "gpt-4o-mini",
            "messages": [{ "role": "user", "content": prompt }],
        }))
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

    parse_provider_response(status, retry_after.as_deref(), &body)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn success_body(content: &str) -> String {
        serde_json::json!({ "choices": [{ "message": { "content": content } }] }).to_string()
    }

    #[test]
    fn parses_a_successful_response() {
        let body = success_body("rewritten text");
        assert_eq!(parse_provider_response(200, None, &body), Ok("rewritten text".to_string()));
    }

    #[test]
    fn maps_429_to_rate_limited_with_retry_after() {
        let err = parse_provider_response(429, Some("30"), "").unwrap_err();
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
        let err = parse_provider_response(429, None, "").unwrap_err();
        assert_eq!(
            err,
            ProviderCallError::RateLimited { message: "Rate limited by provider".to_string(), retry_after_ms: None }
        );
    }

    #[test]
    fn maps_other_4xx_5xx_to_provider_error() {
        let err = parse_provider_response(401, None, "invalid api key").unwrap_err();
        assert!(matches!(err, ProviderCallError::ProviderError { message } if message.contains("401")));
    }

    #[test]
    fn maps_malformed_json_to_provider_error() {
        let err = parse_provider_response(200, None, "not json").unwrap_err();
        assert!(matches!(err, ProviderCallError::ProviderError { .. }));
    }

    #[test]
    fn maps_missing_content_field_to_provider_error() {
        let body = serde_json::json!({ "choices": [] }).to_string();
        let err = parse_provider_response(200, None, &body).unwrap_err();
        assert!(matches!(err, ProviderCallError::ProviderError { .. }));
    }
}
