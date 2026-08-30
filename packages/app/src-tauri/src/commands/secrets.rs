// API key storage — the `keyring` crate backed by the native macOS Keychain.
// Not Stronghold: it doesn't touch the OS keychain and is being removed in
// Tauri v3 (see map #13, issue #14).

use super::vendor::Vendor;

const SERVICE: &str = "com.voicecraft.app";
// Pre-#42 single-provider installs stored their (necessarily OpenAI, the
// only provider that existed then) key under this account. Kept around as a
// read-only fallback so upgrading doesn't silently lose an already-working
// key.
const LEGACY_SINGLE_VENDOR_ACCOUNT: &str = "provider-api-key";

fn account_for(vendor: Vendor) -> String {
    format!("api-key-{}", vendor.as_str())
}

fn read_account(service: &str, account: &str) -> Result<Option<String>, String> {
    let entry = keyring::Entry::new(service, account).map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(password) => Ok(Some(password)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

// `service` is a parameter (not the `SERVICE` const directly) so tests can
// point this at a dedicated test service instead of the real app's Keychain
// service — the legacy-account fallback in particular would otherwise read
// whatever real single-key install the machine running the tests has.
fn get_api_key_for_service(service: &str, vendor: Vendor) -> Result<Option<String>, String> {
    if let Some(key) = read_account(service, &account_for(vendor))? {
        return Ok(Some(key));
    }
    if vendor == Vendor::OpenAi {
        return read_account(service, LEGACY_SINGLE_VENDOR_ACCOUNT);
    }
    Ok(None)
}

fn set_api_key_for_service(service: &str, vendor: Vendor, key: &str) -> Result<(), String> {
    let entry = keyring::Entry::new(service, &account_for(vendor)).map_err(|e| e.to_string())?;
    entry.set_password(key).map_err(|e| e.to_string())
}

pub fn get_api_key_internal(vendor: Vendor) -> Result<Option<String>, String> {
    get_api_key_for_service(SERVICE, vendor)
}

pub fn set_api_key_internal(vendor: Vendor, key: &str) -> Result<(), String> {
    set_api_key_for_service(SERVICE, vendor, key)
}

#[tauri::command]
pub fn get_api_key(vendor: String) -> Result<Option<String>, String> {
    get_api_key_internal(Vendor::parse(&vendor)?)
}

#[tauri::command]
pub fn set_api_key(vendor: String, key: String) -> Result<(), String> {
    set_api_key_internal(Vendor::parse(&vendor)?, &key)
}

#[cfg(test)]
mod tests {
    use super::*;

    // Round-trips against the real macOS Keychain under a dedicated test
    // service/account, cleaned up afterwards. Same-process reads of an
    // entry this process just wrote don't trigger a Keychain access prompt.
    #[test]
    fn round_trips_through_the_keychain() {
        let entry = keyring::Entry::new("com.voicecraft.app.test", "round-trip").unwrap();
        entry.set_password("secret-value").unwrap();

        assert_eq!(entry.get_password().unwrap(), "secret-value");

        entry.delete_credential().unwrap();
        assert!(matches!(entry.get_password(), Err(keyring::Error::NoEntry)));
    }

    #[test]
    fn each_vendor_round_trips_under_its_own_account() {
        let service = "com.voicecraft.app.test.per-vendor";
        set_api_key_for_service(service, Vendor::OpenAi, "openai-secret").unwrap();
        set_api_key_for_service(service, Vendor::Anthropic, "anthropic-secret").unwrap();

        assert_eq!(get_api_key_for_service(service, Vendor::OpenAi).unwrap(), Some("openai-secret".to_string()));
        assert_eq!(
            get_api_key_for_service(service, Vendor::Anthropic).unwrap(),
            Some("anthropic-secret".to_string())
        );

        keyring::Entry::new(service, &account_for(Vendor::OpenAi)).unwrap().delete_credential().unwrap();
        keyring::Entry::new(service, &account_for(Vendor::Anthropic)).unwrap().delete_credential().unwrap();
    }

    #[test]
    fn falls_back_to_the_legacy_single_vendor_account_for_openai_only() {
        let service = "com.voicecraft.app.test.legacy-fallback";
        let legacy = keyring::Entry::new(service, LEGACY_SINGLE_VENDOR_ACCOUNT).unwrap();
        legacy.set_password("pre-#42-key").unwrap();

        assert_eq!(get_api_key_for_service(service, Vendor::OpenAi).unwrap(), Some("pre-#42-key".to_string()));
        assert_eq!(get_api_key_for_service(service, Vendor::Anthropic).unwrap(), None);

        legacy.delete_credential().unwrap();
    }

    #[test]
    fn a_new_per_vendor_key_takes_precedence_over_the_legacy_account() {
        let service = "com.voicecraft.app.test.legacy-precedence";
        let legacy = keyring::Entry::new(service, LEGACY_SINGLE_VENDOR_ACCOUNT).unwrap();
        legacy.set_password("old-key").unwrap();
        set_api_key_for_service(service, Vendor::OpenAi, "new-key").unwrap();

        assert_eq!(get_api_key_for_service(service, Vendor::OpenAi).unwrap(), Some("new-key".to_string()));

        legacy.delete_credential().unwrap();
        keyring::Entry::new(service, &account_for(Vendor::OpenAi)).unwrap().delete_credential().unwrap();
    }

    #[test]
    fn get_api_key_rejects_an_unsupported_vendor() {
        assert_eq!(get_api_key("cohere".to_string()), Err("Unsupported vendor: cohere".to_string()));
    }
}
