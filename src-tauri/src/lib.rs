mod actions;
mod deepseek;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            actions::list_imported_actions,
            actions::import_action_folder,
            actions::delete_imported_action,
            deepseek::deepseek_has_key,
            deepseek::deepseek_save_key,
            deepseek::deepseek_remove_key,
            deepseek::deepseek_balance,
            deepseek::deepseek_chat,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Elise-pet");
}
