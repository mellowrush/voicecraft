mod commands;

use serde::Serialize;
use tauri::menu::{CheckMenuItem, CheckMenuItemBuilder, Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Emitter, Manager, WebviewUrl, WebviewWindowBuilder};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

use commands::hotkey::{
    capture_selected_text, check_accessibility_trusted, decide_hotkey_action, hud_accept, hud_reject,
    is_accessibility_trusted, open_accessibility_prefs, HotkeyAction,
};
use commands::persistence::{last_used_profile_id, read_profiles_file, write_profiles_file};
use commands::provider::call_provider;
use commands::secrets::{get_api_key, set_api_key};

const HOTKEY: &str = "alt+space";
const MAIN_WINDOW: &str = "main";
const HUD_WINDOW: &str = "hud";
const ONBOARDING_WINDOW: &str = "onboarding";

// Managed state so the tray's items (checkbox + last-used label) can be
// updated from elsewhere in the app, which only has access to the
// AppHandle, not the builder that originally created them.
struct TrayMenuItems {
    hotkey_item: CheckMenuItem<tauri::Wry>,
    last_used_item: MenuItem<tauri::Wry>,
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct HotkeySelectionPayload {
    text: String,
    profile_id: Option<String>,
}

#[derive(Clone, Copy)]
enum WindowPosition {
    Fixed(f64, f64),
    CenterOverMain,
}

// HUD is triggered from anywhere via the global hotkey and must float over
// whatever app the user is currently in, so it needs a real OS-wide
// always-on-top level. Onboarding is an in-app prompt — it should only ever
// stack above Voicecraft's own main window, not every other app on screen.
// That's just "don't set always-on-top" — a normal window already only
// stays in front of its own app's other windows and drops behind whatever
// app the user switches to. (`.parent()` was tried here and reverted: an
// AppKit child-window relationship is unverifiable in this environment and
// carries known key-window/focus quirks not worth the risk for this.)
#[derive(Clone, Copy)]
enum WindowStacking {
    AlwaysOnTopSystemWide,
    Normal,
}

fn create_hidden_window(
    app: &AppHandle,
    label: &str,
    width: f64,
    height: f64,
    position: WindowPosition,
    stacking: WindowStacking,
) -> tauri::Result<()> {
    let mut builder = WebviewWindowBuilder::new(app, label, WebviewUrl::App(format!("index.html?window={label}").into()))
        .title("Voicecraft")
        .inner_size(width, height)
        .visible(false)
        .decorations(false)
        .transparent(true)
        // Chrome is entirely custom-drawn (CSS box-shadow on the card) — the
        // native OS window shadow would otherwise also render around the
        // transparent window's rectangular bounds, doubling up.
        .shadow(false)
        .skip_taskbar(true)
        .resizable(false);

    if let WindowPosition::Fixed(x, y) = position {
        builder = builder.position(x, y);
    }

    if let WindowStacking::AlwaysOnTopSystemWide = stacking {
        builder = builder.always_on_top(true);
    }

    let window = builder.build()?;

    if let WindowPosition::CenterOverMain = position {
        center_over_main(app, &window);
    }

    Ok(())
}

// Onboarding should appear over the main window (like a modal), not pinned to
// a fixed screen offset. Falls back to centering on the current monitor if
// the main window isn't around yet or hasn't been shown/focused.
fn center_over_main(app: &AppHandle, window: &tauri::WebviewWindow) {
    let target = app
        .get_webview_window(MAIN_WINDOW)
        .filter(|main| main.is_visible().unwrap_or(false) || main.is_focused().unwrap_or(false))
        .and_then(|main| {
            let main_pos = main.outer_position().ok()?;
            let main_size = main.outer_size().ok()?;
            let win_size = window.outer_size().ok()?;
            Some(tauri::PhysicalPosition::new(
                main_pos.x + (main_size.width as i32 - win_size.width as i32) / 2,
                main_pos.y + (main_size.height as i32 - win_size.height as i32) / 2,
            ))
        });

    match target {
        Some(pos) => {
            let _ = window.set_position(pos);
        }
        None => {
            let _ = window.center();
        }
    }
}

fn show_and_focus(app: &AppHandle, label: &str) {
    if let Some(window) = app.get_webview_window(label) {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

// Runs off the main thread — capturing the selection blocks on a simulated
// keystroke + a short settle delay, which would otherwise freeze the tray/
// menu and any open windows for the duration.
fn handle_hotkey_triggered(app: AppHandle) {
    let trusted = is_accessibility_trusted();
    if !trusted {
        show_and_focus(&app, ONBOARDING_WINDOW);
        return;
    }

    std::thread::spawn(move || {
        let selection = capture_selected_text().unwrap_or(None);
        match decide_hotkey_action(trusted, selection) {
            HotkeyAction::ShowOnboarding => show_and_focus(&app, ONBOARDING_WINDOW),
            HotkeyAction::Noop => {}
            HotkeyAction::ShowHud { text } => {
                let profile_id = last_used_profile_id(&app);
                show_and_focus(&app, HUD_WINDOW);
                let _ = app.emit_to(HUD_WINDOW, "hotkey://selection", HotkeySelectionPayload { text, profile_id });
            }
        }
    });
}

fn toggle_hotkey(app: &AppHandle) {
    let global_shortcut = app.global_shortcut();
    let now_enabled = if global_shortcut.is_registered(HOTKEY) {
        let _ = global_shortcut.unregister(HOTKEY);
        false
    } else {
        let app_for_handler = app.clone();
        let _ = global_shortcut.on_shortcut(HOTKEY, move |_app, _shortcut, event| {
            if event.state == ShortcutState::Pressed {
                handle_hotkey_triggered(app_for_handler.clone());
            }
        });
        true
    };

    if let Some(items) = app.try_state::<TrayMenuItems>() {
        let _ = items.hotkey_item.set_checked(now_enabled);
    }
}

#[tauri::command]
fn update_last_used_profile_tray(app: tauri::AppHandle, profile_name: String) {
    if let Some(items) = app.try_state::<TrayMenuItems>() {
        let _ = items.last_used_item.set_text(format!("Last used: {profile_name}"));
    }
}

fn build_tray(app: &AppHandle) -> tauri::Result<()> {
    let last_used_item = MenuItem::with_id(app, "last-used", "Last used: —", false, None::<&str>)?;
    let open_item = MenuItem::with_id(app, "open", "Open Voicecraft", true, None::<&str>)?;
    let hotkey_item =
        CheckMenuItemBuilder::with_id("toggle-hotkey", "Hotkey (\u{2325} Space)").checked(true).build(app)?;
    let quit_item = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&last_used_item, &open_item, &hotkey_item, &quit_item])?;

    app.manage(TrayMenuItems { hotkey_item, last_used_item });

    TrayIconBuilder::new()
        .menu(&menu)
        .tooltip("Voicecraft")
        .icon(app.default_window_icon().unwrap().clone())
        .on_menu_event(|app, event| match event.id().as_ref() {
            "open" => show_and_focus(app, MAIN_WINDOW),
            "toggle-hotkey" => toggle_hotkey(app),
            "quit" => app.exit(0),
            _ => {}
        })
        .build(app)?;
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_shortcut(HOTKEY)
                .expect("hardcoded shortcut string is valid")
                .with_handler(|app, _shortcut, event| {
                    if event.state == ShortcutState::Pressed {
                        handle_hotkey_triggered(app.clone());
                    }
                })
                .build(),
        )
        .setup(|app| {
            create_hidden_window(
                app.handle(),
                HUD_WINDOW,
                320.0,
                200.0,
                WindowPosition::Fixed(80.0, 80.0),
                WindowStacking::AlwaysOnTopSystemWide,
            )?;
            create_hidden_window(
                app.handle(),
                ONBOARDING_WINDOW,
                360.0,
                468.0,
                WindowPosition::CenterOverMain,
                WindowStacking::Normal,
            )?;
            build_tray(app.handle())?;

            if !is_accessibility_trusted() {
                show_and_focus(app.handle(), ONBOARDING_WINDOW);
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_api_key,
            set_api_key,
            read_profiles_file,
            write_profiles_file,
            call_provider,
            check_accessibility_trusted,
            open_accessibility_prefs,
            hud_accept,
            hud_reject,
            update_last_used_profile_tray,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
