mod data;
mod db;
mod notify;
mod tray;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .setup(|app| {
            let dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&dir)?;
            let database = db::open(&dir.join("executive.db"))?;
            app.manage(database);

            tray::build(app.handle())?;
            notify::spawn_reminder_loop(app.handle().clone());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            db::get_appointments,
            db::create_appointment,
            db::update_appointment,
            db::delete_appointment,
            db::get_settings,
            db::set_setting,
            data::get_tasks,
            data::create_task,
            data::update_task,
            data::delete_task,
            data::get_transactions,
            data::create_transaction,
            data::update_transaction,
            data::delete_transaction,
            data::get_notes,
            data::create_note,
            data::update_note,
            data::delete_note,
            data::get_goals,
            data::create_goal,
            data::update_goal,
            data::delete_goal,
            data::db_info,
            data::backup_database,
            notify::show_notification,
            tray::set_tray_labels,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
