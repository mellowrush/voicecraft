// API key storage — the `keyring` crate backed by the native macOS Keychain.
// Not Stronghold: it doesn't touch the OS keychain and is being removed in
// Tauri v3 (see map #13, issue #14).

const SERVICE: &str = "com.voicecraft.app";
const ACCOUNT: &str = "provider-api-key";

pub fn get_api_key_internal() -> Result<Option<String>, String> {
    let entry = keyring::Entry::new(SERVICE, ACCOUNT).map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(password) => Ok(Some(password)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

pub fn set_api_key_internal(key: &str) -> Result<(), String> {
    let entry = keyring::Entry::new(SERVICE, ACCOUNT).map_err(|e| e.to_string())?;
    entry.set_password(key).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_api_key() -> Result<Option<String>, String> {
    get_api_key_internal()
}

#[tauri::command]
pub fn set_api_key(key: String) -> Result<(), String> {
    set_api_key_internal(&key)
}

#[cfg(test)]
mod tests {
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
}
