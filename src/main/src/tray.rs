use tauri::{
    api::path::app_data_dir,
    Manager, Runtime, SystemTray, SystemTrayEvent, SystemTrayMenu, SystemTrayMenuItem,
    Window,
};

pub fn build_tray() -> SystemTray {
    let menu = SystemTrayMenu::new()
        .add_item(SystemTrayMenuItem::new("Open", "open").visible(true))
        .add_item(SystemTrayMenuItem::new("New Task", "new_task").visible(true))
        .add_item(SystemTrayMenuItem::new("New Transaction", "new_transaction").visible(true))
        .add_item(SystemTrayMenuItem::new("Calendar", "calendar").visible(true))
        .add_native_item(SystemTrayMenuItem::Separator)
        .add_item(SystemTrayMenuItem::new("Settings", "settings").visible(true))
        .add_native_item(SystemTrayMenuItem::Separator)
        .add_item(SystemTrayMenuItem::new("Exit", "exit").visible(true));

    SystemTray::new().with_menu(menu)
}

pub fn handle_tray_event<R: Runtime>(app: &tauri::AppHandle<R>, event: SystemTrayEvent) {
    match event {
        SystemTrayEvent::LeftClick {
            position: _,
            size: _,
            ..
        } => {
            let window = app.get_window("main").unwrap();
            if window.is_visible().unwrap_or(false) {
                let _ = window.hide();
            } else {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }
        SystemTrayEvent::RightClick {
            position: _,
            size: _,
            ..
        } => {
            // Show context menu on right click
        }
        SystemTrayEvent::DoubleClick {
            position: _,
            size: _,
            ..
        } => {
            let window = app.get_window("main").unwrap();
            if window.is_visible().unwrap_or(false) {
                let _ = window.hide();
            } else {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }
        SystemTrayEvent::MenuItemClick { id, .. } => {
            match id.as_str() {
                "open" => {
                    let window = app.get_window("main").unwrap();
                    let _ = window.show();
                    let _ = window.set_focus();
                }
                "new_task" => {
                    let window = app.get_window("main").unwrap();
                    let _ = window.show();
                    let _ = window.set_focus();
                    // Emit event to frontend to open task modal
                    let _ = window.emit("new_task", {});
                }
                "new_transaction" => {
                    let window = app.get_window("main").unwrap();
                    let _ = window.show();
                    let _ = window.set_focus();
                    let _ = window.emit("new_transaction", {});
                }
                "calendar" => {
                    let window = app.get_window("main").unwrap();
                    let _ = window.show();
                    let _ = window.set_focus();
                    let _ = window.emit("navigate", {"route": "/calendar"});
                }
                "settings" => {
                    let window = app.get_window("main").unwrap();
                    let _ = window.show();
                    let _ = window.set_focus();
                    let _ = window.emit("navigate", {"route": "/settings"});
                }
                "exit" => {
                    std::process::exit(0);
                }
                _ => {}
            }
        }
        _ => {}
    }
}

#[tauri::command]
pub fn show_window<R: Runtime>(window: Window<R>) {
    let _ = window.show();
    let _ = window.set_focus();
}

#[tauri::command]
pub fn hide_window<R: Runtime>(window: Window<R>) {
    let _ = window.hide();
}

#[tauri::command]
pub fn toggle_window<R: Runtime>(window: Window<R>) {
    if window.is_visible().unwrap_or(false) {
        let _ = window.hide();
    } else {
        let _ = window.show();
        let _ = window.set_focus();
    }
}
