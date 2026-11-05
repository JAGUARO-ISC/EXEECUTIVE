mod auth;
mod data;
mod db;
mod notify;
mod tray;

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{Manager, RunEvent, WindowEvent};

pub struct AppState {
    quit_requested: AtomicBool,
    scheduler_stop: Arc<AtomicBool>,
}

impl AppState {
    pub fn request_quit(&self) {
        self.quit_requested.store(true, Ordering::Release);
    }

    fn take_quit_request(&self) -> bool {
        self.quit_requested.swap(false, Ordering::AcqRel)
    }

    fn stop_scheduler(&self) {
        self.scheduler_stop.store(true, Ordering::Release);
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let scheduler_stop = Arc::new(AtomicBool::new(false));

    tauri::Builder::default()
        .manage(AppState {
            quit_requested: AtomicBool::new(false),
            scheduler_stop: Arc::clone(&scheduler_stop),
        })
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(move |app| {
            let dir = app.path().app_data_dir()?;
            std::fs::create_dir_all(&dir)?;
            let database = db::open(&dir.join("executive.db"))?;
            app.manage(database);

            tray::build(app.handle())?;
            notify::spawn_reminder_loop(app.handle().clone(), Arc::clone(&scheduler_stop));

            if let Some(window) = app.get_webview_window("main") {
                if std::env::args().any(|arg| arg == "--hidden") {
                    let _ = window.hide();
                } else {
                    let _ = window.show();
                }
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            db::get_appointments,
            db::create_appointment,
            db::update_appointment,
            db::delete_appointment,
            db::get_settings,
            db::set_setting,
            db::get_device_identity,
            db::get_device_name,
            db::set_device_name,
            db::reset_device_identity,
            db::sync_enqueue_change,
            db::sync_get_outbox,
            db::sync_mark_uploaded,
            db::sync_get_cursor,
            db::sync_set_cursor,
            db::sync_apply_remote,
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
            auth::clear_session_state,
        ])
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                let state = window.app_handle().state::<AppState>();
                if !state.take_quit_request() {
                    api.prevent_close();
                    let _ = window.hide();
                }
            }
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            if let RunEvent::Exit = event {
                app.state::<AppState>().stop_scheduler();
            }
        });
}
