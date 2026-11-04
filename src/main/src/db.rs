use anyhow::Result;
use chrono::{NaiveDate, NaiveDateTime, NaiveTime};
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use std::path::Path;

// Database path
static mut DB_CONN: Option<Connection> = None;

pub fn init_database(db_path: &str) -> Result<()> {
    let conn = Connection::open(db_path)?;
    conn.execute_batch(&create_tables_sql())?;
    unsafe {
        DB_CONN = Some(conn);
    }
    Ok(())
}

fn get_connection() -> Result<&'static Connection> {
    unsafe {
        DB_CONN.as_ref().ok_or(anyhow::anyhow!("Database not initialized"))
    }
}

fn create_tables_sql() -> String {
    r#"
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

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
        is_recurring BOOLEAN DEFAULT FALSE,
        recurrence_pattern TEXT,
        recurrence_end TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        due_date TEXT,
        due_time TEXT,
        priority INTEGER DEFAULT 0,
        category TEXT,
        status TEXT DEFAULT 'pending',
        reminder_minutes INTEGER DEFAULT 0,
        is_recurring BOOLEAN DEFAULT FALSE,
        recurrence_pattern TEXT,
        recurrence_end TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS transactions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        amount REAL NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
        description TEXT,
        category TEXT NOT NULL,
        date TEXT NOT NULL,
        time TEXT,
        payment_method TEXT,
        notes TEXT,
        receipt_path TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        content TEXT,
        category TEXT,
        tags TEXT,
        linked_date TEXT,
        is_important BOOLEAN DEFAULT FALSE,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS budgets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT NOT NULL,
        amount REAL NOT NULL,
        period TEXT NOT NULL CHECK(period IN ('daily', 'weekly', 'monthly', 'yearly')),
        start_date TEXT NOT NULL,
        end_date TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS goals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        target_amount REAL NOT NULL,
        current_amount REAL DEFAULT 0,
        deadline TEXT NOT NULL,
        status TEXT DEFAULT 'active',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS settings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT NOT NULL UNIQUE,
        value TEXT NOT NULL,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS backups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT NOT NULL,
        path TEXT NOT NULL,
        size INTEGER NOT NULL,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_appointments_start ON appointments(start_datetime);
    CREATE INDEX IF NOT EXISTS idx_appointments_end ON appointments(end_datetime);
    CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_date);
    CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
    CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
    CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
    CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);
    CREATE INDEX IF NOT EXISTS idx_notes_linked_date ON notes(linked_date);
    CREATE INDEX IF NOT EXISTS idx_settings_key ON settings(key);
    "#.to_string()
}

// Appointment types
#[derive(Debug, Serialize, Deserialize)]
pub struct Appointment {
    pub id: Option<i64>,
    pub title: String,
    pub description: Option<String>,
    pub start_datetime: String,
    pub end_datetime: String,
    pub location: Option<String>,
    pub category: Option<String>,
    pub color: Option<String>,
    pub priority: i32,
    pub reminder_minutes: i32,
    pub is_recurring: bool,
    pub recurrence_pattern: Option<String>,
    pub recurrence_end: Option<String>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

#[tauri::command]
pub fn get_appointments(
    start_date: Option<String>,
    end_date: Option<String>,
) -> Result<Vec<Appointment>, String> {
    let conn = get_connection().map_err(|e| e.to_string())?;

    let mut query = "SELECT * FROM appointments WHERE 1=1".to_string();
    let mut params: Vec<&dyn rusqlite::ToSql> = vec![];

    if let Some(start) = start_date {
        query.push_str(" AND start_datetime >= ?");
        params.push(&start);
    }
    if let Some(end) = end_date {
        query.push_str(" AND end_datetime <= ?");
        params.push(&end);
    }
    query.push_str(" ORDER BY start_datetime ASC");

    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;
    let rows = stmt.query_map(params.as_slice(), |row| {
        Ok(Appointment {
            id: row.get(0).ok(),
            title: row.get(1).unwrap_or_default(),
            description: row.get(2).ok(),
            start_datetime: row.get(3).unwrap_or_default(),
            end_datetime: row.get(4).unwrap_or_default(),
            location: row.get(5).ok(),
            category: row.get(6).ok(),
            color: row.get(7).ok(),
            priority: row.get(8).unwrap_or(0),
            reminder_minutes: row.get(9).unwrap_or(0),
            is_recurring: row.get(10).unwrap_or(false),
            recurrence_pattern: row.get(11).ok(),
            recurrence_end: row.get(12).ok(),
            created_at: row.get(13).ok(),
            updated_at: row.get(14).ok(),
        })
    }).map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_appointment(appointment: Appointment) -> Result<i64, String> {
    let conn = get_connection().map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO appointments (title, description, start_datetime, end_datetime, location, category, color, priority, reminder_minutes, is_recurring, recurrence_pattern, recurrence_end) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
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
            appointment.is_recurring,
            appointment.recurrence_pattern,
            appointment.recurrence_end,
        ],
    ).map_err(|e| e.to_string())?;

    Ok(conn.last_insert_rowid())
}

#[tauri::command]
pub fn update_appointment(id: i64, appointment: Appointment) -> Result<(), String> {
    let conn = get_connection().map_err(|e| e.to_string())?;

    conn.execute(
        "UPDATE appointments SET title = ?, description = ?, start_datetime = ?, end_datetime = ?, location = ?, category = ?, color = ?, priority = ?, reminder_minutes = ?, is_recurring = ?, recurrence_pattern = ?, recurrence_end = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
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
            appointment.is_recurring,
            appointment.recurrence_pattern,
            appointment.recurrence_end,
            id,
        ],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn delete_appointment(id: i64) -> Result<(), String> {
    let conn = get_connection().map_err(|e| e.to_string())?;

    conn.execute("DELETE FROM appointments WHERE id = ?", params![id])
        .map_err(|e| e.to_string())?;

    Ok(())
}

// Task types
#[derive(Debug, Serialize, Deserialize)]
pub struct Task {
    pub id: Option<i64>,
    pub title: String,
    pub description: Option<String>,
    pub due_date: Option<String>,
    pub due_time: Option<String>,
    pub priority: i32,
    pub category: Option<String>,
    pub status: String,
    pub reminder_minutes: i32,
    pub is_recurring: bool,
    pub recurrence_pattern: Option<String>,
    pub recurrence_end: Option<String>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

#[tauri::command]
pub fn get_tasks(
    status: Option<String>,
    priority: Option<i32>,
    category: Option<String>,
    due_date: Option<String>,
) -> Result<Vec<Task>, String> {
    let conn = get_connection().map_err(|e| e.to_string())?;

    let mut query = "SELECT * FROM tasks WHERE 1=1".to_string();
    let mut params: Vec<&dyn rusqlite::ToSql> = vec![];

    if let Some(s) = status {
        query.push_str(" AND status = ?");
        params.push(&s);
    }
    if let Some(p) = priority {
        query.push_str(" AND priority = ?");
        params.push(&p);
    }
    if let Some(c) = category {
        query.push_str(" AND category = ?");
        params.push(&c);
    }
    if let Some(d) = due_date {
        query.push_str(" AND due_date = ?");
        params.push(&d);
    }
    query.push_str(" ORDER BY due_date ASC, priority DESC");

    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;
    let rows = stmt.query_map(params.as_slice(), |row| {
        Ok(Task {
            id: row.get(0).ok(),
            title: row.get(1).unwrap_or_default(),
            description: row.get(2).ok(),
            due_date: row.get(3).ok(),
            due_time: row.get(4).ok(),
            priority: row.get(5).unwrap_or(0),
            category: row.get(6).ok(),
            status: row.get(7).unwrap_or_else(|_| "pending".to_string()),
            reminder_minutes: row.get(8).unwrap_or(0),
            is_recurring: row.get(9).unwrap_or(false),
            recurrence_pattern: row.get(10).ok(),
            recurrence_end: row.get(11).ok(),
            created_at: row.get(12).ok(),
            updated_at: row.get(13).ok(),
        })
    }).map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_task(task: Task) -> Result<i64, String> {
    let conn = get_connection().map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO tasks (title, description, due_date, due_time, priority, category, status, reminder_minutes, is_recurring, recurrence_pattern, recurrence_end) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params![
            task.title,
            task.description,
            task.due_date,
            task.due_time,
            task.priority,
            task.category,
            task.status,
            task.reminder_minutes,
            task.is_recurring,
            task.recurrence_pattern,
            task.recurrence_end,
        ],
    ).map_err(|e| e.to_string())?;

    Ok(conn.last_insert_rowid())
}

#[tauri::command]
pub fn update_task(id: i64, task: Task) -> Result<(), String> {
    let conn = get_connection().map_err(|e| e.to_string())?;

    conn.execute(
        "UPDATE tasks SET title = ?, description = ?, due_date = ?, due_time = ?, priority = ?, category = ?, status = ?, reminder_minutes = ?, is_recurring = ?, recurrence_pattern = ?, recurrence_end = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        params![
            task.title,
            task.description,
            task.due_date,
            task.due_time,
            task.priority,
            task.category,
            task.status,
            task.reminder_minutes,
            task.is_recurring,
            task.recurrence_pattern,
            task.recurrence_end,
            id,
        ],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn delete_task(id: i64) -> Result<(), String> {
    let conn = get_connection().map_err(|e| e.to_string())?;

    conn.execute("DELETE FROM tasks WHERE id = ?", params![id])
        .map_err(|e| e.to_string())?;

    Ok(())
}

// Transaction types
#[derive(Debug, Serialize, Deserialize)]
pub struct Transaction {
    pub id: Option<i64>,
    pub amount: f64,
    pub r#type: String,
    pub description: Option<String>,
    pub category: String,
    pub date: String,
    pub time: Option<String>,
    pub payment_method: Option<String>,
    pub notes: Option<String>,
    pub receipt_path: Option<String>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

#[tauri::command]
pub fn get_transactions(
    r#type: Option<String>,
    category: Option<String>,
    start_date: Option<String>,
    end_date: Option<String>,
) -> Result<Vec<Transaction>, String> {
    let conn = get_connection().map_err(|e| e.to_string())?;

    let mut query = "SELECT * FROM transactions WHERE 1=1".to_string();
    let mut params: Vec<&dyn rusqlite::ToSql> = vec![];

    if let Some(t) = r#type {
        query.push_str(" AND type = ?");
        params.push(&t);
    }
    if let Some(c) = category {
        query.push_str(" AND category = ?");
        params.push(&c);
    }
    if let Some(start) = start_date {
        query.push_str(" AND date >= ?");
        params.push(&start);
    }
    if let Some(end) = end_date {
        query.push_str(" AND date <= ?");
        params.push(&end);
    }
    query.push_str(" ORDER BY date DESC, time DESC");

    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;
    let rows = stmt.query_map(params.as_slice(), |row| {
        Ok(Transaction {
            id: row.get(0).ok(),
            amount: row.get(1).unwrap_or(0.0),
            r#type: row.get(2).unwrap_or_default(),
            description: row.get(3).ok(),
            category: row.get(4).unwrap_or_default(),
            date: row.get(5).unwrap_or_default(),
            time: row.get(6).ok(),
            payment_method: row.get(7).ok(),
            notes: row.get(8).ok(),
            receipt_path: row.get(9).ok(),
            created_at: row.get(10).ok(),
            updated_at: row.get(11).ok(),
        })
    }).map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_transaction(transaction: Transaction) -> Result<i64, String> {
    let conn = get_connection().map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO transactions (amount, type, description, category, date, time, payment_method, notes, receipt_path) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
        params![
            transaction.amount,
            transaction.r#type,
            transaction.description,
            transaction.category,
            transaction.date,
            transaction.time,
            transaction.payment_method,
            transaction.notes,
            transaction.receipt_path,
        ],
    ).map_err(|e| e.to_string())?;

    Ok(conn.last_insert_rowid())
}

#[tauri::command]
pub fn update_transaction(id: i64, transaction: Transaction) -> Result<(), String> {
    let conn = get_connection().map_err(|e| e.to_string())?;

    conn.execute(
        "UPDATE transactions SET amount = ?, type = ?, description = ?, category = ?, date = ?, time = ?, payment_method = ?, notes = ?, receipt_path = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        params![
            transaction.amount,
            transaction.r#type,
            transaction.description,
            transaction.category,
            transaction.date,
            transaction.time,
            transaction.payment_method,
            transaction.notes,
            transaction.receipt_path,
            id,
        ],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn delete_transaction(id: i64) -> Result<(), String> {
    let conn = get_connection().map_err(|e| e.to_string())?;

    conn.execute("DELETE FROM transactions WHERE id = ?", params![id])
        .map_err(|e| e.to_string())?;

    Ok(())
}

// Note types
#[derive(Debug, Serialize, Deserialize)]
pub struct Note {
    pub id: Option<i64>,
    pub title: String,
    pub content: Option<String>,
    pub category: Option<String>,
    pub tags: Option<String>,
    pub linked_date: Option<String>,
    pub is_important: bool,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

#[tauri::command]
pub fn get_notes(
    category: Option<String>,
    linked_date: Option<String>,
    is_important: Option<bool>,
) -> Result<Vec<Note>, String> {
    let conn = get_connection().map_err(|e| e.to_string())?;

    let mut query = "SELECT * FROM notes WHERE 1=1".to_string();
    let mut params: Vec<&dyn rusqlite::ToSql> = vec![];

    if let Some(c) = category {
        query.push_str(" AND category = ?");
        params.push(&c);
    }
    if let Some(d) = linked_date {
        query.push_str(" AND linked_date = ?");
        params.push(&d);
    }
    if let Some(imp) = is_important {
        query.push_str(" AND is_important = ?");
        params.push(&imp);
    }
    query.push_str(" ORDER BY created_at DESC");

    let mut stmt = conn.prepare(&query).map_err(|e| e.to_string())?;
    let rows = stmt.query_map(params.as_slice(), |row| {
        Ok(Note {
            id: row.get(0).ok(),
            title: row.get(1).unwrap_or_default(),
            content: row.get(2).ok(),
            category: row.get(3).ok(),
            tags: row.get(4).ok(),
            linked_date: row.get(5).ok(),
            is_important: row.get(6).unwrap_or(false),
            created_at: row.get(7).ok(),
            updated_at: row.get(8).ok(),
        })
    }).map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn create_note(note: Note) -> Result<i64, String> {
    let conn = get_connection().map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT INTO notes (title, content, category, tags, linked_date, is_important) VALUES (?, ?, ?, ?, ?, ?)",
        params![
            note.title,
            note.content,
            note.category,
            note.tags,
            note.linked_date,
            note.is_important,
        ],
    ).map_err(|e| e.to_string())?;

    Ok(conn.last_insert_rowid())
}

#[tauri::command]
pub fn update_note(id: i64, note: Note) -> Result<(), String> {
    let conn = get_connection().map_err(|e| e.to_string())?;

    conn.execute(
        "UPDATE notes SET title = ?, content = ?, category = ?, tags = ?, linked_date = ?, is_important = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        params![
            note.title,
            note.content,
            note.category,
            note.tags,
            note.linked_date,
            note.is_important,
            id,
        ],
    ).map_err(|e| e.to_string())?;

    Ok(())
}

#[tauri::command]
pub fn delete_note(id: i64) -> Result<(), String> {
    let conn = get_connection().map_err(|e| e.to_string())?;

    conn.execute("DELETE FROM notes WHERE id = ?", params![id])
        .map_err(|e| e.to_string())?;

    Ok(())
}

// Settings types
#[tauri::command]
pub fn get_settings() -> Result<Vec<(String, String)>, String> {
    let conn = get_connection().map_err(|e| e.to_string())?;

    let mut stmt = conn.prepare("SELECT key, value FROM settings")
        .map_err(|e| e.to_string())?;

    let rows = stmt.query_map([], |row| {
        Ok((row.get(0).unwrap_or_default(), row.get(1).unwrap_or_default()))
    }).map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_setting(key: String, value: String) -> Result<(), String> {
    let conn = get_connection().map_err(|e| e.to_string())?;

    conn.execute(
        "INSERT OR REPLACE INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)",
        params![key, value],
    ).map_err(|e| e.to_string())?;

    Ok(())
}
