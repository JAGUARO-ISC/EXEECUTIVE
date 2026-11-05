use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, Runtime,
};

fn show_main<R: Runtime>(app: &AppHandle<R>) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
    }
}

const DEFAULTS: [(&str, &str); 10] = [
    ("open", "Apri"),
    ("new_appointment", "Nuovo appuntamento"),
    ("new_task", "Nuova attività"),
    ("new_income", "Nuova entrata"),
    ("new_expense", "Nuova uscita"),
    ("new_note", "Nuova nota"),
    ("calendar", "Calendario"),
    ("settings", "Impostazioni"),
    ("quit", "Esci"),
    ("tooltip", "EXEECUTIVE"),
];

fn label(labels: &std::collections::HashMap<String, String>, id: &str) -> String {
    labels
        .get(id)
        .cloned()
        .or_else(|| DEFAULTS.iter().find(|(k, _)| *k == id).map(|(_, v)| v.to_string()))
        .unwrap_or_else(|| id.to_string())
}

fn make_menu<R: Runtime>(app: &AppHandle<R>, l: &std::collections::HashMap<String, String>) -> tauri::Result<Menu<R>> {
    let item = |id: &str| MenuItem::with_id(app, id, label(l, id), true, None::<&str>);
    let sep = PredefinedMenuItem::separator(app)?;
    Menu::with_items(
        app,
        &[
            &item("open")?,
            &item("new_appointment")?,
            &item("new_task")?,
            &item("new_income")?,
            &item("new_expense")?,
            &item("new_note")?,
            &item("calendar")?,
            &item("settings")?,
            &sep,
            &item("quit")?,
        ],
    )
}

/// Called by the frontend whenever the app language changes.
#[tauri::command]
pub fn set_tray_labels<R: Runtime>(app: AppHandle<R>, labels: std::collections::HashMap<String, String>) -> Result<(), String> {
    let Some(tray) = app.tray_by_id("main-tray") else { return Ok(()) };
    let menu = make_menu(&app, &labels).map_err(|e| e.to_string())?;
    tray.set_menu(Some(menu)).map_err(|e| e.to_string())?;
    tray.set_tooltip(Some(label(&labels, "tooltip"))).map_err(|e| e.to_string())
}

pub fn build<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    let menu = make_menu(app, &std::collections::HashMap::new())?;

    let mut builder = TrayIconBuilder::with_id("main-tray")
        .tooltip("EXECUTIVE")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id.as_ref() {
            "open" => show_main(app),
            "new_appointment" => {
                show_main(app);
                let _ = app.emit("new_appointment", ());
            }
            "new_task" | "new_income" | "new_expense" | "new_note" => {
                show_main(app);
                let _ = app.emit("quick_add", event.id.as_ref().trim_start_matches("new_"));
            }
            "calendar" => {
                show_main(app);
                let _ = app.emit("navigate", "/calendar");
            }
            "settings" => {
                show_main(app);
                let _ = app.emit("navigate", "/settings");
            }
            "quit" => {
                app.state::<crate::AppState>().request_quit();
                app.exit(0);
            }
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::Click {
                button: MouseButton::Left,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                let app = tray.app_handle();
                if let Some(w) = app.get_webview_window("main") {
                    if w.is_visible().unwrap_or(false) && w.is_focused().unwrap_or(false) {
                        let _ = w.hide();
                    } else {
                        show_main(app);
                    }
                }
            }
        });

    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }
    builder.build(app)?;
    Ok(())
}
