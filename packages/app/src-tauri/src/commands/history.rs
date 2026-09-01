// Raw file I/O only — no history-record schema knowledge here, mirroring
// persistence.rs's convention. Append-only JSONL (ADR-0008), not a
// whole-file-rewrite JSON array like voice-profiles.json: a generation
// happens on every use of the app's primary action, so the frequent case
// (append one line) stays cheap; only delete/clear-all pay for a rewrite.

use std::io::Write;
use std::path::Path;
use tauri::Manager;

const HISTORY_FILE: &str = "history.jsonl";

fn history_path(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    Ok(dir.join(HISTORY_FILE))
}

pub fn read_history_from(path: &Path) -> Result<String, String> {
    match std::fs::read_to_string(path) {
        Ok(contents) => Ok(contents),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(String::new()),
        Err(e) => Err(e.to_string()),
    }
}

pub fn append_history_to(path: &Path, entry_json: &str) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let mut file = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)
        .map_err(|e| e.to_string())?;
    writeln!(file, "{entry_json}").map_err(|e| e.to_string())
}

// Only reads the flat top-level `id` field, the same light touch persistence.rs
// takes reading `lastUsedProfileId` off voice-profiles.json — no full record
// schema is decoded on the Rust side.
fn line_id(line: &str) -> Option<String> {
    let json: serde_json::Value = serde_json::from_str(line).ok()?;
    json.get("id")?.as_str().map(str::to_string)
}

pub fn delete_history_entry_at(path: &Path, id: &str) -> Result<(), String> {
    let contents = read_history_from(path)?;
    let filtered: String = contents
        .lines()
        .filter(|line| line_id(line).as_deref() != Some(id))
        .map(|line| format!("{line}\n"))
        .collect();
    std::fs::write(path, filtered).map_err(|e| e.to_string())
}

pub fn clear_history_at(path: &Path) -> Result<(), String> {
    std::fs::write(path, "").map_err(|e| e.to_string())
}

#[tauri::command]
pub fn read_history_file(app: tauri::AppHandle) -> Result<String, String> {
    read_history_from(&history_path(&app)?)
}

#[tauri::command]
pub fn append_history_entry(app: tauri::AppHandle, entry_json: String) -> Result<(), String> {
    append_history_to(&history_path(&app)?, &entry_json)
}

#[tauri::command]
pub fn delete_history_entry(app: tauri::AppHandle, id: String) -> Result<(), String> {
    delete_history_entry_at(&history_path(&app)?, &id)
}

#[tauri::command]
pub fn clear_history(app: tauri::AppHandle) -> Result<(), String> {
    clear_history_at(&history_path(&app)?)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn reads_an_empty_string_when_the_file_does_not_exist() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("history.jsonl");

        assert_eq!(read_history_from(&path).unwrap(), "");
    }

    #[test]
    fn appends_a_line_without_disturbing_earlier_lines() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("nested").join("history.jsonl");

        append_history_to(&path, r#"{"id":"1","text":"first"}"#).unwrap();
        append_history_to(&path, r#"{"id":"2","text":"second"}"#).unwrap();

        assert_eq!(
            read_history_from(&path).unwrap(),
            "{\"id\":\"1\",\"text\":\"first\"}\n{\"id\":\"2\",\"text\":\"second\"}\n"
        );
    }

    #[test]
    fn deletes_only_the_matching_entry_by_id() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("history.jsonl");
        append_history_to(&path, r#"{"id":"1","text":"first"}"#).unwrap();
        append_history_to(&path, r#"{"id":"2","text":"second"}"#).unwrap();
        append_history_to(&path, r#"{"id":"3","text":"third"}"#).unwrap();

        delete_history_entry_at(&path, "2").unwrap();

        assert_eq!(
            read_history_from(&path).unwrap(),
            "{\"id\":\"1\",\"text\":\"first\"}\n{\"id\":\"3\",\"text\":\"third\"}\n"
        );
    }

    #[test]
    fn deleting_a_nonexistent_id_is_a_no_op() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("history.jsonl");
        append_history_to(&path, r#"{"id":"1","text":"first"}"#).unwrap();

        delete_history_entry_at(&path, "missing").unwrap();

        assert_eq!(read_history_from(&path).unwrap(), "{\"id\":\"1\",\"text\":\"first\"}\n");
    }

    #[test]
    fn clear_history_empties_the_file() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("history.jsonl");
        append_history_to(&path, r#"{"id":"1","text":"first"}"#).unwrap();

        clear_history_at(&path).unwrap();

        assert_eq!(read_history_from(&path).unwrap(), "");
    }

    #[test]
    fn clearing_a_file_that_does_not_exist_creates_it_empty() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("history.jsonl");

        clear_history_at(&path).unwrap();

        assert_eq!(read_history_from(&path).unwrap(), "");
    }
}
