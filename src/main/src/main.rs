#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tauri::{
    api::path::app_data_dir,
    Manager, Runtime, SystemTray, SystemTrayEvent, SystemTrayMenu, SystemTrayMenuItem,
};

mod db;
mod tray;
mod notify;

#[derive(Debug, Serialize, Deserialize)]
struct AppConfig {
    auto_start: bool,
    close_behavior: String,
}

fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Initialize logging
    #[cfg(debug_assertions)]
    {
        std::env::set_var("RUST_LOG", "debug");
    }

    // Get app data directory
    let app_data_dir = app_data_dir(&tauri::Config::default())?;
    let db_path = app_data_dir.join("data").join("executive.db");
    let backups_dir = app_data_dir.join("backups");

    // Create directories if they don't exist
    std::fs::create_dir_all(&db_path.parent().unwrap())?;
    std::fs::create_dir_all(&backups_dir)?;

    // Initialize database
    db::init_database(db_path.to_str().unwrap())?;

    // Build Tauri app
    tauri::Builder::default()
        .setup(|app| {
            // Initialize system tray
            let tray_menu = SystemTrayMenu::new()
                .add_item(SystemTrayMenuItem::new("Open", "Open").visible(true))
                .add_item(SystemTrayMenuItem::new("New Task", "New Task").visible(true))
                .add_item(SystemTrayMenuItem::new("New Transaction", "New Transaction").visible(true))
                .add_item(SystemTrayMenuItem::new("Calendar", "Calendar").visible(true))
                .add_native_item(SystemTrayMenuItem::Separator)
                .add_item(SystemTrayMenuItem::new("Settings", "Settings").visible(true))
                .add_native_item(SystemTrayMenuItem::Separator)
                .add_item(SystemTrayMenuItem::new("Exit", "Exit").visible(true));

            let system_tray = SystemTray::new().with_menu(tray_menu);
            app.set_system_tray(Some(system_tray))?;

            // Handle system tray events
            tauri::async_runtime::spawn(async move {
                loop {
                    std::thread::sleep(std::time::Duration::from_secs(1));
                }
            });

            Ok(())
        })
        .system_tray(tray::build_tray())
        .on_system_tray_event(tray::handle_tray_event)
        .invoke_handler(tauri::generate_handler![
            db::get_appointments,
            db::create_appointment,
            db::update_appointment,
            db::delete_appointment,
            db::get_tasks,
            db::create_task,
            db::update_task,
            db::delete_task,
            db::get_transactions,
            db::create_transaction,
            db::update_transaction,
            db::delete_transaction,
            db::get_notes,
            db::create_note,
            db::update_note,
            db::delete_note,
            db::get_settings,
            db::set_setting,
            notify::show_notification,
            tray::show_window,
            tray::hide_window,
            tray::toggle_window,
        ])
        .build(tauri::generate_context!())
        ?.run(tauri::generate_context!())
        .expect("error while running tauri application");

    Ok(())
}
