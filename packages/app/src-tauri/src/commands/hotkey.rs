// Global-hotkey capture: reading/replacing the OS-wide text selection and
// checking/opening the Accessibility permission. These are all real OS side
// effects with no pure boundary worth mocking beyond `decide_hotkey_action`
// below — the HUD's stubbed Provider (same pattern as issue #20) is what
// keeps the actually-interesting rewrite logic testable in TypeScript.

use std::time::Duration;

use arboard::Clipboard;
use enigo::{Direction, Enigo, Key, Keyboard, Settings};
use tauri::Manager;

#[cfg(target_os = "macos")]
mod ax {
    #[link(name = "ApplicationServices", kind = "framework")]
    extern "C" {
        pub fn AXIsProcessTrusted() -> u8;
    }
}

#[cfg(target_os = "macos")]
pub fn is_accessibility_trusted() -> bool {
    unsafe { ax::AXIsProcessTrusted() != 0 }
}

#[cfg(not(target_os = "macos"))]
pub fn is_accessibility_trusted() -> bool {
    false
}

#[tauri::command]
pub fn check_accessibility_trusted() -> bool {
    is_accessibility_trusted()
}

#[tauri::command]
pub fn open_accessibility_prefs() -> Result<(), String> {
    std::process::Command::new("open")
        .arg("x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility")
        .spawn()
        .map_err(|e| e.to_string())?;
    Ok(())
}

// What the hotkey trigger should do next — pulled out as a pure function of
// (permission, captured selection) so the onboarding-vs-HUD and
// no-selection-is-a-no-op branching (issue #21's testing decisions) can be
// unit tested without touching the OS.
#[derive(Debug, PartialEq)]
pub enum HotkeyAction {
    ShowOnboarding,
    ShowHud { text: String },
    Noop,
}

pub fn decide_hotkey_action(trusted: bool, selection: Option<String>) -> HotkeyAction {
    if !trusted {
        return HotkeyAction::ShowOnboarding;
    }
    match selection.filter(|s| !s.trim().is_empty()) {
        Some(text) => HotkeyAction::ShowHud { text },
        None => HotkeyAction::Noop,
    }
}

fn send_keystroke(key: char) -> Result<(), String> {
    let mut enigo = Enigo::new(&Settings::default()).map_err(|e| e.to_string())?;
    enigo.key(Key::Meta, Direction::Press).map_err(|e| e.to_string())?;
    enigo.key(Key::Unicode(key), Direction::Click).map_err(|e| e.to_string())?;
    enigo.key(Key::Meta, Direction::Release).map_err(|e| e.to_string())?;
    Ok(())
}

fn restore_clipboard(clipboard: &mut Clipboard, previous: Option<String>) {
    match previous {
        Some(text) => {
            let _ = clipboard.set_text(text);
        }
        None => {
            let _ = clipboard.clear();
        }
    }
}

// Simulates Cmd+C rather than reading the focused AXUIElement's value
// directly — the Accessibility API exposes a focused element's full text,
// not the live selection range, inside most third-party (non-Cocoa-text-view)
// apps. The clipboard round-trip is what most macOS "quick action" utilities
// use for the same reason, and posting the CGEvent it relies on requires the
// same Accessibility trust we already gate the whole flow on.
pub fn capture_selected_text() -> Result<Option<String>, String> {
    let mut clipboard = Clipboard::new().map_err(|e| e.to_string())?;
    let previous = clipboard.get_text().ok();
    let _ = clipboard.clear();

    send_keystroke('c')?;
    std::thread::sleep(Duration::from_millis(150));

    let copied = clipboard.get_text().ok().filter(|s| !s.is_empty());
    restore_clipboard(&mut clipboard, previous);

    Ok(copied)
}

// Puts `text` on the clipboard, simulates Cmd+V to paste it over the still-
// selected original text, then restores whatever was on the clipboard
// beforehand.
pub fn replace_selected_text(text: &str) -> Result<(), String> {
    let mut clipboard = Clipboard::new().map_err(|e| e.to_string())?;
    let previous = clipboard.get_text().ok();

    clipboard.set_text(text.to_string()).map_err(|e| e.to_string())?;
    send_keystroke('v')?;
    std::thread::sleep(Duration::from_millis(150));

    restore_clipboard(&mut clipboard, previous);
    Ok(())
}

#[tauri::command]
pub fn hud_accept(app: tauri::AppHandle, text: String) -> Result<(), String> {
    replace_selected_text(&text)?;
    hide_hud(&app);
    Ok(())
}

#[tauri::command]
pub fn hud_reject(app: tauri::AppHandle) {
    hide_hud(&app);
}

pub fn hide_hud(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("hud") {
        let _ = window.hide();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn shows_onboarding_when_not_trusted_regardless_of_selection() {
        assert_eq!(decide_hotkey_action(false, Some("hello".into())), HotkeyAction::ShowOnboarding);
        assert_eq!(decide_hotkey_action(false, None), HotkeyAction::ShowOnboarding);
    }

    #[test]
    fn shows_the_hud_when_trusted_with_a_non_empty_selection() {
        assert_eq!(
            decide_hotkey_action(true, Some("hello world".into())),
            HotkeyAction::ShowHud { text: "hello world".into() }
        );
    }

    #[test]
    fn is_a_noop_when_trusted_with_no_selection() {
        assert_eq!(decide_hotkey_action(true, None), HotkeyAction::Noop);
    }

    #[test]
    fn is_a_noop_when_trusted_with_a_whitespace_only_selection() {
        assert_eq!(decide_hotkey_action(true, Some("   \n\t".into())), HotkeyAction::Noop);
    }
}
