use crate::db::Db;
use chrono::{DateTime, Duration, Utc};
use rusqlite::params;
use std::time::Duration as StdDuration;
use tauri::{AppHandle, Manager, Runtime};
use tauri_plugin_notification::NotificationExt;

#[tauri::command]
pub fn show_notification<R: Runtime>(
    app: AppHandle<R>,
    title: String,
    body: String,
) -> Result<(), String> {
    app.notification()
        .builder()
        .title(title)
        .body(body)
        .show()
        .map_err(|e| e.to_string())
}

/// Polls every 30s and fires a notification once per appointment when
/// `now >= start - reminder_minutes` and the appointment has not ended.
pub fn spawn_reminder_loop<R: Runtime>(app: AppHandle<R>) {
    std::thread::spawn(move || loop {
        std::thread::sleep(StdDuration::from_secs(30));
        if let Err(e) = check_reminders(&app) {
            log::error!("reminder check failed: {e}");
        }
        if let Err(e) = check_task_reminders(&app) {
            log::error!("task reminder check failed: {e}");
        }
    });
}

/// Tasks use local date/time. Notify once when `now >= due - reminder_minutes`.
fn check_task_reminders<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    use chrono::{Local, NaiveDate, NaiveTime, TimeZone};
    let db = app.state::<Db>();
    let now = Local::now();
    let mut due: Vec<(i64, String)> = Vec::new();
    {
        let conn = db.0.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare(
                "SELECT id, title, due_date, due_time, reminder_minutes FROM tasks \
                 WHERE reminder_minutes > 0 AND notified = 0 AND status != 'done' AND due_date IS NOT NULL",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |r| {
                Ok((
                    r.get::<_, i64>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, String>(2)?,
                    r.get::<_, Option<String>>(3)?,
                    r.get::<_, i64>(4)?,
                ))
            })
            .map_err(|e| e.to_string())?;
        for row in rows {
            let (id, title, date, time, minutes) = row.map_err(|e| e.to_string())?;
            let Ok(d) = NaiveDate::parse_from_str(&date, "%Y-%m-%d") else { continue };
            let t = time
                .and_then(|t| NaiveTime::parse_from_str(&t, "%H:%M").ok())
                .unwrap_or_else(|| NaiveTime::from_hms_opt(9, 0, 0).unwrap());
            let Some(at) = Local.from_local_datetime(&d.and_time(t)).single() else { continue };
            if now >= at - Duration::minutes(minutes) {
                due.push((id, title));
            }
        }
    }
    let heading = {
        let conn = db.0.lock().map_err(|e| e.to_string())?;
        conn.query_row("SELECT value FROM settings WHERE key = 'notif_task_title'", [], |r| r.get::<_, String>(0))
            .unwrap_or_else(|_| "Attività in scadenza".to_string())
    };
    for (id, title) in due {
        app.notification()
            .builder()
            .title(heading.clone())
            .body(title)
            .show()
            .map_err(|e| e.to_string())?;
        let conn = db.0.lock().map_err(|e| e.to_string())?;
        conn.execute("UPDATE tasks SET notified = 1 WHERE id = ?1", params![id])
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

fn check_reminders<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    let db = app.state::<Db>();
    let now = Utc::now();
    let mut due: Vec<(i64, String, String)> = Vec::new();
    {
        let conn = db.0.lock().map_err(|e| e.to_string())?;
        let mut stmt = conn
            .prepare(
                "SELECT id, title, start_datetime, end_datetime, reminder_minutes, location FROM appointments \
                 WHERE reminder_minutes > 0 AND notified = 0 AND is_recurring = 0",
            )
            .map_err(|e| e.to_string())?;
        let rows = stmt
            .query_map([], |r| {
                Ok((
                    r.get::<_, i64>(0)?,
                    r.get::<_, String>(1)?,
                    r.get::<_, String>(2)?,
                    r.get::<_, String>(3)?,
                    r.get::<_, i64>(4)?,
                    r.get::<_, Option<String>>(5)?,
                ))
            })
            .map_err(|e| e.to_string())?;
        for row in rows {
            let (id, title, start, end, minutes, location) = row.map_err(|e| e.to_string())?;
            let (Ok(start_dt), Ok(end_dt)) = (
                DateTime::parse_from_rfc3339(&start),
                DateTime::parse_from_rfc3339(&end),
            ) else {
                continue;
            };
            let trigger = start_dt.with_timezone(&Utc) - Duration::minutes(minutes);
            if now >= trigger && now < end_dt.with_timezone(&Utc) {
                let local = start_dt.with_timezone(&chrono::Local).format("%H:%M");
                let body = match location {
                    Some(l) if !l.is_empty() => format!("{local} - {l}"),
                    _ => format!("{local}"),
                };
                due.push((id, title, body));
            }
        }
    }
    for (id, title, body) in due {
        app.notification()
            .builder()
            .title(title)
            .body(body)
            .show()
            .map_err(|e| e.to_string())?;
        let conn = db.0.lock().map_err(|e| e.to_string())?;
        conn.execute("UPDATE appointments SET notified = 1 WHERE id = ?1", params![id])
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}
