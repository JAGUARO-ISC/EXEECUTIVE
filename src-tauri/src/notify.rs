use crate::db::Db;
use chrono::{DateTime, Duration, Local, Months, NaiveDate, NaiveTime, TimeZone, Utc};
use rusqlite::{params, Connection};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration as StdDuration;
use tauri::{AppHandle, Emitter, Manager, Runtime};
use tauri_plugin_notification::NotificationExt;

#[tauri::command]
pub fn show_notification<R: Runtime>(app: AppHandle<R>, title: String, body: String) -> Result<(), String> {
    app.notification().builder().title(title).body(body).show().map_err(|e| e.to_string())
}

pub fn spawn_reminder_loop<R: Runtime>(app: AppHandle<R>, stop: Arc<AtomicBool>) {
    std::thread::spawn(move || {
        while !stop.load(Ordering::Acquire) {
            std::thread::sleep(StdDuration::from_secs(30));
            if stop.load(Ordering::Acquire) { break; }
            if let Err(e) = check_reminders(&app) { log::error!("reminder check failed: {e}"); }
            if let Err(e) = check_task_reminders(&app) { log::error!("task reminder check failed: {e}"); }
        }
    });
}

fn enabled(conn: &Connection, key: &str) -> bool {
    conn.query_row("SELECT value FROM settings WHERE key=?1", params![key], |r| r.get::<_, String>(0))
        .map(|v| v == "1" || v.eq_ignore_ascii_case("true"))
        .unwrap_or(true)
}

pub(crate) fn notification_key(entity: &str, id: i64, trigger: &str, kind: &str) -> String {
    format!("{entity}:{id}:{trigger}:{kind}")
}

fn claim(conn: &Connection, key: &str, entity: &str, id: i64, trigger: &str, kind: &str) -> Result<bool, String> {
    conn.execute("INSERT OR IGNORE INTO notification_log (notification_key,entity_type,entity_id,trigger_at,reminder_type) VALUES (?1,?2,?3,?4,?5)", params![key, entity, id, trigger, kind])
        .map(|n| n == 1).map_err(|e| e.to_string())
}

fn deliver<R: Runtime>(app: &AppHandle<R>, key: &str, entity: &str, id: i64, trigger: &str, kind: &str, title: String, body: String, route: &str) -> Result<(), String> {
    let db = app.state::<Db>();
    let claimed = {
        let conn = db.0.lock().map_err(|e| e.to_string())?;
        claim(&conn, key, entity, id, trigger, kind)?
    };
    if !claimed { return Ok(()); }
    let result = app.notification().builder().id(notification_id(key)).title(title).body(body).extra("notification_key", key).extra("route", route).show().map_err(|e| e.to_string());
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    match result {
        Ok(()) => { conn.execute("UPDATE notification_log SET delivered_at=CURRENT_TIMESTAMP WHERE notification_key=?1", params![key]).map(|_| ()).map_err(|e| e.to_string()) }
        Err(error) => { let _ = conn.execute("DELETE FROM notification_log WHERE notification_key=?1 AND delivered_at IS NULL", params![key]); Err(error) }
    }
}

fn notification_id(key: &str) -> i32 {
    let mut h = 2_166_136_261u32;
    for b in key.bytes() { h = h.wrapping_mul(16_777_619) ^ u32::from(b); }
    (h & 0x7fff_ffff) as i32
}

pub(crate) fn appointment_occurrences(start: DateTime<Utc>, pattern: Option<&str>, end: Option<DateTime<Utc>>, until: DateTime<Utc>) -> Vec<DateTime<Utc>> {
    let Some(pattern) = pattern.filter(|v| !v.is_empty() && *v != "none") else { return (start <= until).then_some(vec![start]).unwrap_or_default(); };
    let limit = end.map_or(until, |v| v.min(until));
    let mut current = start;
    let mut result = Vec::new();
    for _ in 0..20_000 {
        if current > limit { break; }
        result.push(current);
        let next = match pattern { "daily" => current.checked_add_signed(Duration::days(1)), "weekly" => current.checked_add_signed(Duration::weeks(1)), "monthly" => current.checked_add_months(Months::new(1)), "yearly" => current.checked_add_months(Months::new(12)), _ => None };
        let Some(next) = next else { break; };
        current = next;
    }
    result
}

fn check_task_reminders<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    let db = app.state::<Db>();
    let now = Local::now();
    let mut due = Vec::new();
    let heading;
    {
        let conn = db.0.lock().map_err(|e| e.to_string())?;
        if !enabled(&conn, "notifications_enabled") || !enabled(&conn, "notifications_tasks") { return Ok(()); }
        heading = conn.query_row("SELECT value FROM settings WHERE key='notif_task_title'", [], |r| r.get::<_, String>(0)).unwrap_or_else(|_| "Attività in scadenza".into());
        let mut stmt = conn.prepare("SELECT id,title,due_date,due_time,reminder_minutes FROM tasks WHERE reminder_minutes>0 AND status!='done' AND due_date IS NOT NULL").map_err(|e| e.to_string())?;
        let rows = stmt.query_map([], |r| Ok((r.get::<_,i64>(0)?,r.get::<_,String>(1)?,r.get::<_,String>(2)?,r.get::<_,Option<String>>(3)?,r.get::<_,i64>(4)?))).map_err(|e| e.to_string())?;
        for row in rows {
            let (id,title,date,time,minutes) = row.map_err(|e| e.to_string())?;
            let Ok(date) = NaiveDate::parse_from_str(&date, "%Y-%m-%d") else { continue; };
            let time = time.and_then(|v| NaiveTime::parse_from_str(&v, "%H:%M").ok()).unwrap_or_else(|| NaiveTime::from_hms_opt(9,0,0).unwrap());
            let Some(at) = Local.from_local_datetime(&date.and_time(time)).single() else { continue; };
            let trigger = at - Duration::minutes(minutes);
            if now >= trigger { due.push((id,title,trigger.with_timezone(&Utc))); }
        }
    }
    for (id,title,trigger) in due {
        let trigger = trigger.to_rfc3339();
        let key = notification_key("task", id, &trigger, "due");
        deliver(app, &key, "task", id, &trigger, "due", heading.clone(), title, "/tasks")?;
    }
    Ok(())
}

fn check_reminders<R: Runtime>(app: &AppHandle<R>) -> Result<(), String> {
    let db = app.state::<Db>();
    let now = Utc::now();
    let mut due = Vec::new();
    {
        let conn = db.0.lock().map_err(|e| e.to_string())?;
        if !enabled(&conn, "notifications_enabled") || !enabled(&conn, "notifications_appointments") { return Ok(()); }
        let mut stmt = conn.prepare("SELECT id,title,start_datetime,end_datetime,reminder_minutes,location,is_recurring,recurrence_pattern,recurrence_end FROM appointments WHERE reminder_minutes>0").map_err(|e| e.to_string())?;
        let rows = stmt.query_map([], |r| Ok((r.get::<_,i64>(0)?,r.get::<_,String>(1)?,r.get::<_,String>(2)?,r.get::<_,String>(3)?,r.get::<_,i64>(4)?,r.get::<_,Option<String>>(5)?,r.get::<_,i64>(6)?,r.get::<_,Option<String>>(7)?,r.get::<_,Option<String>>(8)?))).map_err(|e| e.to_string())?;
        for row in rows {
            let (id,title,start,end,minutes,location,recurring,pattern,recurrence_end) = row.map_err(|e| e.to_string())?;
            let (Ok(start),Ok(end)) = (DateTime::parse_from_rfc3339(&start),DateTime::parse_from_rfc3339(&end)) else { continue; };
            let start = start.with_timezone(&Utc); let duration = end.with_timezone(&Utc)-start;
            let recurrence_end = recurrence_end.and_then(|v| DateTime::parse_from_rfc3339(&v).ok()).map(|v| v.with_timezone(&Utc));
            let occurrences = if recurring != 0 { appointment_occurrences(start, pattern.as_deref(), recurrence_end, now) } else { vec![start] };
            for occurrence in occurrences {
                let trigger = occurrence-Duration::minutes(minutes);
                if now >= trigger && now < occurrence+duration {
                    let local = occurrence.with_timezone(&Local).format("%H:%M");
                    let body = match &location { Some(v) if !v.is_empty() => format!("{local} - {v}"), _ => local.to_string() };
                    due.push((id,title.clone(),body,trigger));
                }
            }
        }
    }
    for (id,title,body,trigger) in due {
        let trigger = trigger.to_rfc3339();
        let key = notification_key("appointment", id, &trigger, "start");
        deliver(app, &key, "appointment", id, &trigger, "start", title, body, "/calendar")?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::{appointment_occurrences, notification_key};
    use chrono::{DateTime, Duration, Utc};
    #[test]
    fn notification_key_is_stable_for_same_occurrence_and_type() {
        assert_eq!(notification_key("appointment",7,"2026-11-05T09:00:00Z","start"), notification_key("appointment",7,"2026-11-05T09:00:00Z","start"));
        assert_ne!(notification_key("appointment",7,"2026-11-05T09:00:00Z","start"), notification_key("appointment",7,"2026-11-06T09:00:00Z","start"));
    }
    #[test]
    fn recurring_appointment_produces_occurrence_after_original_start() {
        let start = DateTime::parse_from_rfc3339("2026-11-05T09:00:00+00:00").unwrap().with_timezone(&Utc);
        let occurrences = appointment_occurrences(start,Some("daily"),None,start+Duration::days(2));
        assert_eq!(occurrences.len(),3); assert_eq!(occurrences[1],start+Duration::days(1));
    }
}
