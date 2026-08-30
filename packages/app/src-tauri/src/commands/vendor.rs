// The two AI vendors Voicecraft's Settings UI supports (#42), shared by
// `secrets` (per-vendor Keychain account) and `provider` (request/response
// shape) so both stay in lock-step through one parse point instead of
// independent string comparisons that could drift out of sync.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Vendor {
    OpenAi,
    Anthropic,
}

impl Vendor {
    pub fn parse(raw: &str) -> Result<Self, String> {
        match raw {
            "openai" => Ok(Vendor::OpenAi),
            "anthropic" => Ok(Vendor::Anthropic),
            other => Err(format!("Unsupported vendor: {other}")),
        }
    }

    pub fn as_str(&self) -> &'static str {
        match self {
            Vendor::OpenAi => "openai",
            Vendor::Anthropic => "anthropic",
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_known_vendors() {
        assert_eq!(Vendor::parse("openai"), Ok(Vendor::OpenAi));
        assert_eq!(Vendor::parse("anthropic"), Ok(Vendor::Anthropic));
    }

    #[test]
    fn rejects_an_unknown_vendor() {
        assert_eq!(Vendor::parse("cohere"), Err("Unsupported vendor: cohere".to_string()));
    }
}
