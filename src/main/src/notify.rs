use tauri::Runtime;
use tauri_plugin_notification::NotificationExt;

#[tauri::command]
pub fn show_notification<R: Runtime>(
    app: tauri::AppHandle<R>,
    title: String,
    body: String,
) -> Result<(), String> {
    app.notification()
        .builder()
        .title(title)
        .body(body)
        .icon("executive")
        .show()
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn schedule_appointment_reminder<R: Runtime>(
    app: tauri::AppHandle<R>,
    title: String,
    body: String,
    delay_minutes: u64,
) -> Result<(), String> {
    use std::time::Duration;

    tauri::async_runtime::spawn(async move {
        tauri::async_runtime::sleep(Duration::from_secs(delay_minutes * 60)).await;
        let _ = app.notification()
            .builder()
            .title(title)
            .body(body)
            .icon("executive")
            .show();
    });

    Ok(())
}
