mod commands;

use commands::persistence::{read_profiles_file, write_profiles_file};
use commands::provider::call_provider;
use commands::secrets::{get_api_key, set_api_key};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            get_api_key,
            set_api_key,
            read_profiles_file,
            write_profiles_file,
            call_provider,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
