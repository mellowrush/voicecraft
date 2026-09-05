// API key storage — an app-owned, isolated macOS Keychain file, not the
// shared login.keychain. keyring-rs (previously used here) has no API for
// targeting a custom keychain path (confirmed in docs/research/
// keychain-isolation.md, issue #99), so this talks to `security-framework`
// directly — the same library keyring-rs's macOS backend wraps.
//
// Isolating storage exists to stop Voicecraft's dev-loop rebuild churn from
// degrading Keychain access for *other* apps sharing login.keychain — this
// happened for real, breaking VSCode's and Raycast's own Keychain access
// (wayfinder map #98's background). Moving off the shared keychain removes
// that blast radius; it does not (per the research) change how often macOS
// prompts for Voicecraft's own items, which is a separate, code-signature-
// driven concern explicitly ruled out of scope for this change (#98/#101).

use std::path::{Path, PathBuf};

use hkdf::Hkdf;
use security_framework::os::macos::keychain::{CreateOptions, SecKeychain};
use sha2::Sha256;
use tauri::Manager;

use super::vendor::Vendor;

const KEYCHAIN_FILE: &str = "voicecraft.keychain-db";
const SERVICE: &str = "com.voicecraft.app";

// Apple's Security framework OSStatus for "no such keychain item":
// https://developer.apple.com/documentation/security/errsecitemnotfound
const ERR_SEC_ITEM_NOT_FOUND: i32 = -25300;

fn account_for(vendor: Vendor) -> String {
    format!("api-key-{}", vendor.as_str())
}

// The custom keychain's own unlock password is never stored anywhere — it's
// derived (HKDF-SHA256) from a stable per-machine seed (the Mac's
// IOPlatformUUID), so unlocking never touches the shared login.keychain. A
// bootstrap password item in login.keychain was considered and rejected
// (issue #101): it would be read on every launch, reintroducing the exact
// shared-keychain touch this change exists to eliminate. The seed isn't
// itself secret, but items inside the unlocked keychain still get real
// per-item ACL/code-signature protection from securityd on top — see
// docs/research/keychain-isolation.md §4.
fn derive_keychain_password(seed: &str) -> String {
    let hk = Hkdf::<Sha256>::new(None, seed.as_bytes());
    let mut okm = [0u8; 32];
    hk.expand(b"com.voicecraft.app.keychain-password", &mut okm)
        .expect("32 bytes is a valid HKDF-SHA256 output length");
    okm.iter().map(|b| format!("{b:02x}")).collect()
}

// Parses `ioreg -rd1 -c IOPlatformExpertDevice` output for the
// `"IOPlatformUUID" = "<uuid>"` line. Split out from the process call below
// so it's unit-testable against fixture text without shelling out.
fn parse_platform_uuid(ioreg_output: &str) -> Result<String, String> {
    ioreg_output
        .lines()
        .find(|line| line.contains("IOPlatformUUID"))
        .and_then(|line| line.split('"').nth(3))
        .map(str::to_string)
        .ok_or_else(|| "IOPlatformUUID not found in ioreg output".to_string())
}

fn platform_uuid() -> Result<String, String> {
    let output = std::process::Command::new("ioreg")
        .args(["-rd1", "-c", "IOPlatformExpertDevice"])
        .output()
        .map_err(|e| e.to_string())?;
    parse_platform_uuid(&String::from_utf8_lossy(&output.stdout))
}

fn keychain_password() -> Result<String, String> {
    platform_uuid().map(|uuid| derive_keychain_password(&uuid))
}

fn keychain_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(dir.join(KEYCHAIN_FILE))
}

// Guards first-run keychain creation: without it, two near-simultaneous
// calls (e.g. Settings reading a key while the HUD's call_provider fires on
// launch) can both see the file missing and both race SecKeychainCreate,
// and the loser gets an opaque OS error instead of just using the file the
// winner created.
static KEYCHAIN_CREATE_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());

// Opens the app-owned keychain at `path`, creating it (with `password`) on
// first run. Takes a plain `&Path`/`&str` rather than an `AppHandle` so
// tests can point it at a tempdir with a fixed test password instead of the
// real app-data directory and a hardware-derived one.
fn open_or_create_keychain(path: &Path, password: &str) -> Result<SecKeychain, String> {
    if !path.exists() {
        let _guard = KEYCHAIN_CREATE_LOCK.lock().map_err(|e| e.to_string())?;
        // Re-check inside the lock: another thread may have created it
        // while this one was waiting on the guard above.
        if !path.exists() {
            if let Some(parent) = path.parent() {
                std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            return CreateOptions::new().password(password).create(path).map_err(|e| e.to_string());
        }
    }
    let mut keychain = SecKeychain::open(path).map_err(|e| e.to_string())?;
    keychain.unlock(Some(password)).map_err(|e| e.to_string())?;
    Ok(keychain)
}

fn get_api_key_from(path: &Path, password: &str, vendor: Vendor) -> Result<Option<String>, String> {
    let keychain = open_or_create_keychain(path, password)?;
    match keychain.find_generic_password(SERVICE, &account_for(vendor)) {
        // A stored key is always UTF-8 (only ever written by set_api_key_at
        // from a Rust String) — from_utf8 rather than from_utf8_lossy so a
        // corrupted entry surfaces as a clear read error instead of silently
        // returning a mangled key that then fails provider auth with a
        // confusing 401.
        Ok((password, _item)) => String::from_utf8(password.to_vec())
            .map(Some)
            .map_err(|_| "Stored API key is not valid UTF-8".to_string()),
        Err(e) if e.code() == ERR_SEC_ITEM_NOT_FOUND => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

fn set_api_key_at(path: &Path, password: &str, vendor: Vendor, key: &str) -> Result<(), String> {
    let keychain = open_or_create_keychain(path, password)?;
    keychain.set_generic_password(SERVICE, &account_for(vendor), key.as_bytes()).map_err(|e| e.to_string())
}

pub fn get_api_key_internal(app: &tauri::AppHandle, vendor: Vendor) -> Result<Option<String>, String> {
    get_api_key_from(&keychain_path(app)?, &keychain_password()?, vendor)
}

pub fn set_api_key_internal(app: &tauri::AppHandle, vendor: Vendor, key: &str) -> Result<(), String> {
    set_api_key_at(&keychain_path(app)?, &keychain_password()?, vendor, key)
}

#[tauri::command]
pub fn get_api_key(app: tauri::AppHandle, vendor: String) -> Result<Option<String>, String> {
    get_api_key_internal(&app, Vendor::parse(&vendor)?)
}

#[tauri::command]
pub fn set_api_key(app: tauri::AppHandle, vendor: String, key: String) -> Result<(), String> {
    set_api_key_internal(&app, Vendor::parse(&vendor)?, &key)
}

#[cfg(test)]
mod tests {
    use super::*;

    const TEST_PASSWORD: &str = "test-keychain-password";

    fn temp_keychain_path() -> (tempfile::TempDir, PathBuf) {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("test.keychain-db");
        (dir, path)
    }

    #[test]
    fn derives_the_same_password_from_the_same_seed() {
        assert_eq!(derive_keychain_password("seed-a"), derive_keychain_password("seed-a"));
    }

    #[test]
    fn derives_different_passwords_from_different_seeds() {
        assert_ne!(derive_keychain_password("seed-a"), derive_keychain_password("seed-b"));
    }

    #[test]
    fn parses_the_platform_uuid_out_of_ioreg_output() {
        let fixture = r#"+-o IOPlatformExpertDevice  <class IOPlatformExpertDevice, ...>
    "IOPlatformUUID" = "12345678-ABCD-1234-ABCD-1234567890AB"
    "IOPlatformSerialNumber" = "SOMESERIAL"
"#;
        assert_eq!(parse_platform_uuid(fixture).unwrap(), "12345678-ABCD-1234-ABCD-1234567890AB");
    }

    #[test]
    fn errors_when_ioreg_output_has_no_platform_uuid() {
        assert!(parse_platform_uuid("nothing relevant here").is_err());
    }

    #[test]
    fn round_trips_a_key_through_an_app_owned_keychain_file() {
        let (_dir, path) = temp_keychain_path();

        set_api_key_at(&path, TEST_PASSWORD, Vendor::OpenAi, "sk-test-123").unwrap();
        assert_eq!(get_api_key_from(&path, TEST_PASSWORD, Vendor::OpenAi).unwrap(), Some("sk-test-123".to_string()));
    }

    #[test]
    fn each_vendor_round_trips_under_its_own_account() {
        let (_dir, path) = temp_keychain_path();

        set_api_key_at(&path, TEST_PASSWORD, Vendor::OpenAi, "openai-secret").unwrap();
        set_api_key_at(&path, TEST_PASSWORD, Vendor::Anthropic, "anthropic-secret").unwrap();

        assert_eq!(get_api_key_from(&path, TEST_PASSWORD, Vendor::OpenAi).unwrap(), Some("openai-secret".to_string()));
        assert_eq!(
            get_api_key_from(&path, TEST_PASSWORD, Vendor::Anthropic).unwrap(),
            Some("anthropic-secret".to_string())
        );
    }

    #[test]
    fn returns_none_for_a_vendor_with_no_stored_key() {
        let (_dir, path) = temp_keychain_path();

        set_api_key_at(&path, TEST_PASSWORD, Vendor::OpenAi, "openai-secret").unwrap();

        assert_eq!(get_api_key_from(&path, TEST_PASSWORD, Vendor::Anthropic).unwrap(), None);
    }

    #[test]
    fn setting_a_key_again_overwrites_the_previous_value() {
        let (_dir, path) = temp_keychain_path();

        set_api_key_at(&path, TEST_PASSWORD, Vendor::OpenAi, "old-key").unwrap();
        set_api_key_at(&path, TEST_PASSWORD, Vendor::OpenAi, "new-key").unwrap();

        assert_eq!(get_api_key_from(&path, TEST_PASSWORD, Vendor::OpenAi).unwrap(), Some("new-key".to_string()));
    }

    #[test]
    fn errors_instead_of_silently_mangling_a_non_utf8_stored_value() {
        let (_dir, path) = temp_keychain_path();

        // Bypasses set_api_key_at (which only ever accepts a Rust `&str`) to
        // simulate a corrupted entry — invalid UTF-8 that should never be
        // written in practice, but must still fail loudly if it somehow is.
        let keychain = open_or_create_keychain(&path, TEST_PASSWORD).unwrap();
        keychain.set_generic_password(SERVICE, &account_for(Vendor::OpenAi), &[0xff, 0xfe]).unwrap();

        assert!(get_api_key_from(&path, TEST_PASSWORD, Vendor::OpenAi).is_err());
    }

    #[test]
    fn reopening_the_same_keychain_file_sees_previously_stored_keys() {
        let (_dir, path) = temp_keychain_path();

        set_api_key_at(&path, TEST_PASSWORD, Vendor::OpenAi, "persisted-key").unwrap();

        // A fresh open (not the same in-memory SecKeychain handle) still
        // finds it — proves the key is actually persisted to the file, not
        // just cached on the handle used to write it.
        assert_eq!(get_api_key_from(&path, TEST_PASSWORD, Vendor::OpenAi).unwrap(), Some("persisted-key".to_string()));
    }
}
