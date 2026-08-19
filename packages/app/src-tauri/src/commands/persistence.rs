// Raw file I/O only — no VoiceProfile schema knowledge here. The frontend
// validates contents with @voicecraft/core's voiceProfileSchema; this side
// just moves bytes to/from disk (see issue #16's decision).

use std::path::Path;
use tauri::Manager;

const PROFILES_FILE: &str = "voice-profiles.json";

pub fn read_profiles_from(path: &Path) -> Result<String, String> {
    match std::fs::read_to_string(path) {
        Ok(contents) => Ok(contents),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(String::new()),
        Err(e) => Err(e.to_string()),
    }
}

pub fn write_profiles_to(path: &Path, contents: &str) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(path, contents).map_err(|e| e.to_string())
}

fn profiles_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(dir.join(PROFILES_FILE))
}

#[tauri::command]
pub fn read_profiles_file(app: tauri::AppHandle) -> Result<String, String> {
    read_profiles_from(&profiles_path(&app)?)
}

#[tauri::command]
pub fn write_profiles_file(app: tauri::AppHandle, contents: String) -> Result<(), String> {
    write_profiles_to(&profiles_path(&app)?, &contents)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_an_empty_string_when_the_file_does_not_exist() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("voice-profiles.json");

        assert_eq!(read_profiles_from(&path).unwrap(), "");
    }

    #[test]
    fn round_trips_written_contents() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("nested").join("voice-profiles.json");

        write_profiles_to(&path, "[]").unwrap();

        assert_eq!(read_profiles_from(&path).unwrap(), "[]");
    }

    #[test]
    fn overwrites_existing_contents() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("voice-profiles.json");

        write_profiles_to(&path, "[1]").unwrap();
        write_profiles_to(&path, "[1,2]").unwrap();

        assert_eq!(read_profiles_from(&path).unwrap(), "[1,2]");
    }
}
