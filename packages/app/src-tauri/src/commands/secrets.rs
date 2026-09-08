// API key storage — a plain JSON file in the app's own data directory,
// chmod 600. This app is single-user/local-only, so OS keychain integration
// (previously used here, see git history) was pure complexity for no real
// threat model: anyone with access to this machine already has access to
// this file's plaintext-equivalent keychain-derived contents anyway.

use std::collections::HashMap;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use tauri::Manager;

use super::vendor::Vendor;

const KEYS_FILE: &str = "api-keys.json";

#[derive(Debug, Default, Serialize, Deserialize)]
struct StoredKeys(HashMap<String, String>);

fn keys_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(dir.join(KEYS_FILE))
}

fn read_keys(path: &Path) -> Result<StoredKeys, String> {
    if !path.exists() {
        return Ok(StoredKeys::default());
    }
    let contents = std::fs::read_to_string(path).map_err(|e| e.to_string())?;
    serde_json::from_str(&contents).map_err(|e| e.to_string())
}

fn write_keys(path: &Path, keys: &StoredKeys) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let contents = serde_json::to_string_pretty(keys).map_err(|e| e.to_string())?;
    std::fs::write(path, contents).map_err(|e| e.to_string())?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(path, std::fs::Permissions::from_mode(0o600)).map_err(|e| e.to_string())?;
    }

    Ok(())
}

fn get_api_key_from(path: &Path, vendor: Vendor) -> Result<Option<String>, String> {
    Ok(read_keys(path)?.0.get(vendor.as_str()).cloned())
}

fn set_api_key_at(path: &Path, vendor: Vendor, key: &str) -> Result<(), String> {
    let mut keys = read_keys(path)?;
    keys.0.insert(vendor.as_str().to_string(), key.to_string());
    write_keys(path, &keys)
}

pub fn get_api_key_internal(app: &tauri::AppHandle, vendor: Vendor) -> Result<Option<String>, String> {
    get_api_key_from(&keys_path(app)?, vendor)
}

pub fn set_api_key_internal(app: &tauri::AppHandle, vendor: Vendor, key: &str) -> Result<(), String> {
    set_api_key_at(&keys_path(app)?, vendor, key)
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

    fn temp_keys_path() -> (tempfile::TempDir, PathBuf) {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join(KEYS_FILE);
        (dir, path)
    }

    #[test]
    fn round_trips_a_key_through_the_file() {
        let (_dir, path) = temp_keys_path();

        set_api_key_at(&path, Vendor::OpenAi, "sk-test-123").unwrap();
        assert_eq!(get_api_key_from(&path, Vendor::OpenAi).unwrap(), Some("sk-test-123".to_string()));
    }

    #[test]
    fn each_vendor_round_trips_under_its_own_entry() {
        let (_dir, path) = temp_keys_path();

        set_api_key_at(&path, Vendor::OpenAi, "openai-secret").unwrap();
        set_api_key_at(&path, Vendor::Anthropic, "anthropic-secret").unwrap();

        assert_eq!(get_api_key_from(&path, Vendor::OpenAi).unwrap(), Some("openai-secret".to_string()));
        assert_eq!(get_api_key_from(&path, Vendor::Anthropic).unwrap(), Some("anthropic-secret".to_string()));
    }

    #[test]
    fn returns_none_for_a_vendor_with_no_stored_key() {
        let (_dir, path) = temp_keys_path();

        set_api_key_at(&path, Vendor::OpenAi, "openai-secret").unwrap();

        assert_eq!(get_api_key_from(&path, Vendor::Anthropic).unwrap(), None);
    }

    #[test]
    fn setting_a_key_again_overwrites_the_previous_value() {
        let (_dir, path) = temp_keys_path();

        set_api_key_at(&path, Vendor::OpenAi, "old-key").unwrap();
        set_api_key_at(&path, Vendor::OpenAi, "new-key").unwrap();

        assert_eq!(get_api_key_from(&path, Vendor::OpenAi).unwrap(), Some("new-key".to_string()));
    }

    #[test]
    fn reopening_the_same_file_sees_previously_stored_keys() {
        let (_dir, path) = temp_keys_path();

        set_api_key_at(&path, Vendor::OpenAi, "persisted-key").unwrap();

        assert_eq!(get_api_key_from(&path, Vendor::OpenAi).unwrap(), Some("persisted-key".to_string()));
    }

    #[test]
    fn returns_none_when_the_file_does_not_exist_yet() {
        let (_dir, path) = temp_keys_path();
        assert_eq!(get_api_key_from(&path, Vendor::OpenAi).unwrap(), None);
    }

    #[cfg(unix)]
    #[test]
    fn writes_the_file_with_owner_only_permissions() {
        use std::os::unix::fs::PermissionsExt;

        let (_dir, path) = temp_keys_path();
        set_api_key_at(&path, Vendor::OpenAi, "sk-test-123").unwrap();

        let mode = std::fs::metadata(&path).unwrap().permissions().mode() & 0o777;
        assert_eq!(mode, 0o600);
    }
}
