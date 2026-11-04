use rusqlite::{params, Connection, Row};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

pub struct Db(pub Mutex<Connection>);

const SCHEMA: &str = r#"
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    start_datetime TEXT NOT NULL,
    end_datetime TEXT NOT NULL,
    location TEXT,
    category TEXT,
    color TEXT DEFAULT '#3B82F6',
    priority INTEGER DEFAULT 0,
    reminder_minutes INTEGER DEFAULT 0,
    is_recurring INTEGER DEFAULT 0,
    recurrence_pattern TEXT,
    recurrence_end TEXT,
    notified INTEGER DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    due_date TEXT,
    due_time TEXT,
    priority INTEGER NOT NULL DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'todo' CHECK(status IN ('todo','doing','done')),
    category TEXT,
    reminder_minutes INTEGER NOT NULL DEFAULT 0,
    notified INTEGER NOT NULL DEFAULT 0,
    completed_at TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    kind TEXT NOT NULL CHECK(kind IN ('income','expense')),
    amount_cents INTEGER NOT NULL CHECK(amount_cents > 0),
    currency TEXT NOT NULL DEFAULT 'EUR',
    counterparty TEXT,
    description TEXT,
    category TEXT NOT NULL,
    payment_method TEXT,
    date TEXT NOT NULL,
    notes TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    content TEXT,
    category TEXT,
    linked_date TEXT,
    important INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS goals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    target_cents INTEGER NOT NULL CHECK(target_cents > 0),
    current_cents INTEGER NOT NULL DEFAULT 0,
    currency TEXT NOT NULL DEFAULT 'EUR',
    deadline TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL DEFAULT '',
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_tx_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_appointments_start ON appointments(start_datetime);
CREATE INDEX IF NOT EXISTS idx_appointments_end ON appointments(end_datetime);
"#;

pub fn open(path: &std::path::Path) -> Result<Db, rusqlite::Error> {
    let conn = Connection::open(path)?;
    conn.execute_batch(SCHEMA)?;
    migrate(&conn)?;
    Ok(Db(Mutex::new(conn)))
}

/// Adds columns that older database files do not have yet. Safe to run on every start.
fn migrate(conn: &Connection) -> Result<(), rusqlite::Error> {
    add_column(conn, "transactions", "currency", "TEXT NOT NULL DEFAULT 'EUR'")?;
    add_column(conn, "transactions", "counterparty", "TEXT")?;
    add_column(conn, "goals", "currency", "TEXT NOT NULL DEFAULT 'EUR'")?;
    Ok(())
}

fn add_column(conn: &Connection, table: &str, column: &str, decl: &str) -> Result<(), rusqlite::Error> {
    let mut stmt = conn.prepare(&format!("PRAGMA table_info({table})"))?;
    let exists = stmt
        .query_map([], |r| r.get::<_, String>(1))?
        .filter_map(Result::ok)
        .any(|c| c == column);
    drop(stmt);
    if !exists {
        conn.execute(&format!("ALTER TABLE {table} ADD COLUMN {column} {decl}"), [])?;
    }
    Ok(())
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Appointment {
    #[serde(default)]
    pub id: Option<i64>,
    pub title: String,
    #[serde(default)]
    pub description: Option<String>,
    pub start_datetime: String,
    pub end_datetime: String,
    #[serde(default)]
    pub location: Option<String>,
    #[serde(default)]
    pub category: Option<String>,
    #[serde(default)]
    pub color: Option<String>,
    #[serde(default)]
    pub priority: i32,
    #[serde(default)]
    pub reminder_minutes: i32,
    #[serde(default)]
    pub is_recurring: bool,
    #[serde(default)]
    pub recurrence_pattern: Option<String>,
    #[serde(default)]
    pub recurrence_end: Option<String>,
    #[serde(default)]
    pub created_at: Option<String>,
    #[serde(default)]
    pub updated_at: Option<String>,
}

pub const COLUMNS: &str = "id, title, description, start_datetime, end_datetime, location, category, color, priority, reminder_minutes, is_recurring, recurrence_pattern, recurrence_end, created_at, updated_at";

pub fn row_to_appointment(row: &Row) -> rusqlite::Result<Appointment> {
    Ok(Appointment {
        id: row.get(0)?,
        title: row.get(1)?,
        description: row.get(2)?,
        start_datetime: row.get(3)?,
        end_datetime: row.get(4)?,
        location: row.get(5)?,
        category: row.get(6)?,
        color: row.get(7)?,
        priority: row.get::<_, Option<i32>>(8)?.unwrap_or(0),
        reminder_minutes: row.get::<_, Option<i32>>(9)?.unwrap_or(0),
        is_recurring: row.get::<_, Option<i64>>(10)?.unwrap_or(0) != 0,
        recurrence_pattern: row.get(11)?,
        recurrence_end: row.get(12)?,
        created_at: row.get(13)?,
        updated_at: row.get(14)?,
    })
}

/// Returns appointments overlapping [range_start, range_end) plus recurring
/// series that may produce occurrences in that range. Both bounds are ISO-8601
/// UTC strings; lexicographic comparison matches chronological order.
#[tauri::command]
pub fn get_appointments(
    db: tauri::State<Db>,
    range_start: Option<String>,
    range_end: Option<String>,
) -> Result<Vec<Appointment>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let sql;
    let mut stmt;
    let rows = match (range_start, range_end) {
        (Some(s), Some(e)) => {
            sql = format!(
                "SELECT {COLUMNS} FROM appointments WHERE \
                 (start_datetime < ?2 AND end_datetime > ?1) \
                 OR (is_recurring = 1 AND start_datetime < ?2 AND (recurrence_end IS NULL OR recurrence_end >= ?1)) \
                 ORDER BY start_datetime ASC"
            );
            stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
            stmt.query_map(params![s, e], row_to_appointment)
                .map_err(|e| e.to_string())?
                .collect::<Result<Vec<_>, _>>()
        }
        _ => {
            sql = format!("SELECT {COLUMNS} FROM appointments ORDER BY start_datetime ASC");
            stmt = conn.prepare(&sql).map_err(|e| e.to_string())?;
            stmt.query_map([], row_to_appointment)
                .map_err(|e| e.to_string())?
                .collect::<Result<Vec<_>, _>>()
        }
    };
    rows.map_err(|e| e.to_string())
}

fn validate(a: &Appointment) -> Result<(), String> {
    if a.title.trim().is_empty() {
        return Err("title is required".into());
    }
    if a.end_datetime <= a.start_datetime {
        return Err("end must be after start".into());
    }
    Ok(())
}

#[tauri::command]
pub fn create_appointment(db: tauri::State<Db>, appointment: Appointment) -> Result<i64, String> {
    validate(&appointment)?;
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO appointments (title, description, start_datetime, end_datetime, location, category, color, priority, reminder_minutes, is_recurring, recurrence_pattern, recurrence_end) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)",
        params![
            appointment.title,
            appointment.description,
            appointment.start_datetime,
            appointment.end_datetime,
            appointment.location,
            appointment.category,
            appointment.color,
            appointment.priority,
            appointment.reminder_minutes,
            appointment.is_recurring as i64,
            appointment.recurrence_pattern,
            appointment.recurrence_end,
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(conn.last_insert_rowid())
}

#[tauri::command]
pub fn update_appointment(
    db: tauri::State<Db>,
    id: i64,
    appointment: Appointment,
) -> Result<(), String> {
    validate(&appointment)?;
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let n = conn
        .execute(
            "UPDATE appointments SET title = ?1, description = ?2, start_datetime = ?3, end_datetime = ?4, location = ?5, category = ?6, color = ?7, priority = ?8, reminder_minutes = ?9, is_recurring = ?10, recurrence_pattern = ?11, recurrence_end = ?12, notified = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?13",
            params![
                appointment.title,
                appointment.description,
                appointment.start_datetime,
                appointment.end_datetime,
                appointment.location,
                appointment.category,
                appointment.color,
                appointment.priority,
                appointment.reminder_minutes,
                appointment.is_recurring as i64,
                appointment.recurrence_pattern,
                appointment.recurrence_end,
                id,
            ],
        )
        .map_err(|e| e.to_string())?;
    if n == 0 {
        return Err(format!("appointment {id} not found"));
    }
    Ok(())
}

#[tauri::command]
pub fn delete_appointment(db: tauri::State<Db>, id: i64) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM appointments WHERE id = ?1", params![id])
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub fn get_settings(db: tauri::State<Db>) -> Result<Vec<(String, String)>, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let mut stmt = conn
        .prepare("SELECT key, value FROM settings")
        .map_err(|e| e.to_string())?;
    let rows = stmt
        .query_map([], |r| Ok((r.get(0)?, r.get(1)?)))
        .map_err(|e| e.to_string())?
        .collect::<Result<Vec<_>, _>>();
    rows.map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_setting(db: tauri::State<Db>, key: String, value: String) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO settings (key, value, updated_at) VALUES (?1, ?2, CURRENT_TIMESTAMP) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP",
        params![key, value],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

#[cfg(test)]
pub fn migrate_for_test(conn: &Connection) {
    migrate(conn).unwrap();
}
