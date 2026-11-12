#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
mod browsers;
mod files;
fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(files::Grants::default())
        .invoke_handler(tauri::generate_handler![
            files::find_arc_files,
            files::pick_sidebar,
            files::read_arc_file,
            files::save_export,
            files::save_archive,
            browsers::detect_browsers,
            browsers::extension_installed,
            browsers::open_in_browser
        ])
        .run(tauri::generate_context!())
        .expect("desktop runtime unavailable")
}
