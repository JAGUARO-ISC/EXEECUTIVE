//! Tasks, transactions, notes and goals. They live in the same SQLite file as appointments.

use crate::db::Db;
use rusqlite::{params, Row};
use serde::{Deserialize, Serialize};
use tauri::State;

type Res<T> = Result<T, String>;

fn e<E: std::fmt::Display>(err: E) -> String {
    err.to_string()
}

fn valid_date(s: &str) -> bool {
    chrono::NaiveDate::parse_from_str(s, "%Y-%m-%d").is_ok()
}

fn d_todo() -> String {
    "todo".into()
}
fn d_one() -> i32 {
    1
}

// ---------------------------------------------------------------- tasks

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Task {
    #[serde(default)]
    pub id: Option<i64>,
    pub title: String,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub due_date: Option<String>,
    #[serde(default)]
    pub due_time: Option<String>,
    #[serde(default = "d_one")]
    pub priority: i32,
    #[serde(default = "d_todo")]
    pub status: String,
    #[serde(default)]
    pub category: Option<String>,
    #[serde(default)]
    pub reminder_minutes: i32,
    #[serde(default)]
    pub completed_at: Option<String>,
    #[serde(default)]
    pub created_at: Option<String>,
}

const TASK_COLS: &str =
    "id, title, description, due_date, due_time, priority, status, category, reminder_minutes, completed_at, created_at";

fn task_row(r: &Row) -> rusqlite::Result<Task> {
    Ok(Task {
        id: r.get(0)?,
        title: r.get(1)?,
        description: r.get(2)?,
        due_date: r.get(3)?,
        due_time: r.get(4)?,
        priority: r.get(5)?,
        status: r.get(6)?,
        category: r.get(7)?,
        reminder_minutes: r.get(8)?,
        completed_at: r.get(9)?,
        created_at: r.get(10)?,
    })
}

fn check_task(t: &Task) -> Res<()> {
    if t.title.trim().is_empty() {
        return Err("Il titolo è obbligatorio".into());
    }
    if !(0..=3).contains(&t.priority) {
        return Err("Priorità non valida".into());
    }
    if !["todo", "doing", "done"].contains(&t.status.as_str()) {
        return Err("Stato non valido".into());
    }
    if let Some(d) = &t.due_date {
        if !valid_date(d) {
            return Err("Scadenza non valida".into());
        }
    }
    Ok(())
}

#[tauri::command]
pub fn get_tasks(db: State<Db>) -> Res<Vec<Task>> {
    let c = db.0.lock().map_err(e)?;
    let mut s = c
        .prepare(&format!(
            "SELECT {TASK_COLS} FROM tasks ORDER BY (due_date IS NULL), due_date, due_time, priority DESC, id"
        ))
        .map_err(e)?;
    let rows = s.query_map([], task_row).map_err(e)?.collect::<Result<Vec<_>, _>>();
    rows.map_err(e)
}

#[tauri::command]
pub fn create_task(db: State<Db>, task: Task) -> Res<i64> {
    check_task(&task)?;
    let c = db.0.lock().map_err(e)?;
    c.execute(
        "INSERT INTO tasks (title, description, due_date, due_time, priority, status, category, reminder_minutes, completed_at) \
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8, CASE WHEN ?6='done' THEN CURRENT_TIMESTAMP END)",
        params![
            task.title.trim(),
            task.description,
            task.due_date,
            task.due_time,
            task.priority,
            task.status,
            task.category,
            task.reminder_minutes
        ],
    )
    .map_err(e)?;
    Ok(c.last_insert_rowid())
}

#[tauri::command]
pub fn update_task(db: State<Db>, id: i64, task: Task) -> Res<()> {
    check_task(&task)?;
    let c = db.0.lock().map_err(e)?;
    let n = c
        .execute(
            "UPDATE tasks SET title=?1, description=?2, due_date=?3, due_time=?4, priority=?5, status=?6, category=?7, \
             reminder_minutes=?8, notified=0, \
             completed_at = CASE WHEN ?6='done' THEN COALESCE(completed_at, CURRENT_TIMESTAMP) ELSE NULL END \
             WHERE id=?9",
            params![
                task.title.trim(),
                task.description,
                task.due_date,
                task.due_time,
                task.priority,
                task.status,
                task.category,
                task.reminder_minutes,
                id
            ],
        )
        .map_err(e)?;
    if n == 0 {
        return Err(format!("Attività {id} non trovata"));
    }
    Ok(())
}

#[tauri::command]
pub fn delete_task(db: State<Db>, id: i64) -> Res<()> {
    let c = db.0.lock().map_err(e)?;
    c.execute("DELETE FROM tasks WHERE id=?1", params![id]).map_err(e)?;
    Ok(())
}

// --------------------------------------------------------- transactions

fn d_eur() -> String {
    "EUR".into()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Transaction {
    #[serde(default)]
    pub id: Option<i64>,
    pub kind: String,
    /// Amount in the minor unit of `currency` (cents, or whole yen).
    pub amount_cents: i64,
    #[serde(default = "d_eur")]
    pub currency: String,
    #[serde(default)]
    pub description: Option<String>,
    pub category: String,
    /// Who paid you or who you paid.
    #[serde(default)]
    pub counterparty: Option<String>,
    #[serde(default)]
    pub payment_method: Option<String>,
    pub date: String,
    #[serde(default)]
    pub notes: Option<String>,
    #[serde(default)]
    pub created_at: Option<String>,
}

const TX_COLS: &str =
    "id, kind, amount_cents, currency, description, category, counterparty, payment_method, date, notes, created_at";

fn tx_row(r: &Row) -> rusqlite::Result<Transaction> {
    Ok(Transaction {
        id: r.get(0)?,
        kind: r.get(1)?,
        amount_cents: r.get(2)?,
        currency: r.get(3)?,
        description: r.get(4)?,
        category: r.get(5)?,
        counterparty: r.get(6)?,
        payment_method: r.get(7)?,
        date: r.get(8)?,
        notes: r.get(9)?,
        created_at: r.get(10)?,
    })
}

fn valid_currency(c: &str) -> bool {
    c.len() == 3 && c.chars().all(|ch| ch.is_ascii_uppercase())
}

fn check_tx(t: &Transaction) -> Res<()> {
    if !["income", "expense"].contains(&t.kind.as_str()) {
        return Err("Tipo di movimento non valido".into());
    }
    if t.amount_cents <= 0 {
        return Err("L'importo deve essere maggiore di zero".into());
    }
    if !valid_currency(&t.currency) {
        return Err("Valuta non valida".into());
    }
    if t.category.trim().is_empty() {
        return Err("La categoria è obbligatoria".into());
    }
    if !valid_date(&t.date) {
        return Err("Data non valida".into());
    }
    Ok(())
}

#[tauri::command]
pub fn get_transactions(db: State<Db>) -> Res<Vec<Transaction>> {
    let c = db.0.lock().map_err(e)?;
    let mut s = c
        .prepare(&format!("SELECT {TX_COLS} FROM transactions ORDER BY date DESC, id DESC"))
        .map_err(e)?;
    let rows = s.query_map([], tx_row).map_err(e)?.collect::<Result<Vec<_>, _>>();
    rows.map_err(e)
}

#[tauri::command]
pub fn create_transaction(db: State<Db>, transaction: Transaction) -> Res<i64> {
    check_tx(&transaction)?;
    let c = db.0.lock().map_err(e)?;
    c.execute(
        "INSERT INTO transactions (kind, amount_cents, currency, description, category, counterparty, payment_method, date, notes) \
         VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9)",
        params![
            transaction.kind,
            transaction.amount_cents,
            transaction.currency,
            transaction.description,
            transaction.category.trim(),
            transaction.counterparty,
            transaction.payment_method,
            transaction.date,
            transaction.notes
        ],
    )
    .map_err(e)?;
    Ok(c.last_insert_rowid())
}

#[tauri::command]
pub fn update_transaction(db: State<Db>, id: i64, transaction: Transaction) -> Res<()> {
    check_tx(&transaction)?;
    let c = db.0.lock().map_err(e)?;
    let n = c
        .execute(
            "UPDATE transactions SET kind=?1, amount_cents=?2, currency=?3, description=?4, category=?5, counterparty=?6, \
             payment_method=?7, date=?8, notes=?9 WHERE id=?10",
            params![
                transaction.kind,
                transaction.amount_cents,
                transaction.currency,
                transaction.description,
                transaction.category.trim(),
                transaction.counterparty,
                transaction.payment_method,
                transaction.date,
                transaction.notes,
                id
            ],
        )
        .map_err(e)?;
    if n == 0 {
        return Err(format!("Movimento {id} non trovato"));
    }
    Ok(())
}

#[tauri::command]
pub fn delete_transaction(db: State<Db>, id: i64) -> Res<()> {
    let c = db.0.lock().map_err(e)?;
    c.execute("DELETE FROM transactions WHERE id=?1", params![id]).map_err(e)?;
    Ok(())
}

// ---------------------------------------------------------------- notes

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Note {
    #[serde(default)]
    pub id: Option<i64>,
    pub title: String,
    #[serde(default)]
    pub content: Option<String>,
    #[serde(default)]
    pub category: Option<String>,
    #[serde(default)]
    pub linked_date: Option<String>,
    #[serde(default)]
    pub important: bool,
    #[serde(default)]
    pub created_at: Option<String>,
    #[serde(default)]
    pub updated_at: Option<String>,
}

const NOTE_COLS: &str = "id, title, content, category, linked_date, important, created_at, updated_at";

fn note_row(r: &Row) -> rusqlite::Result<Note> {
    Ok(Note {
        id: r.get(0)?,
        title: r.get(1)?,
        content: r.get(2)?,
        category: r.get(3)?,
        linked_date: r.get(4)?,
        important: r.get::<_, i64>(5)? != 0,
        created_at: r.get(6)?,
        updated_at: r.get(7)?,
    })
}

fn check_note(n: &Note) -> Res<()> {
    if n.title.trim().is_empty() {
        return Err("Il titolo è obbligatorio".into());
    }
    if let Some(d) = &n.linked_date {
        if !valid_date(d) {
            return Err("Data non valida".into());
        }
    }
    Ok(())
}

#[tauri::command]
pub fn get_notes(db: State<Db>) -> Res<Vec<Note>> {
    let c = db.0.lock().map_err(e)?;
    let mut s = c
        .prepare(&format!("SELECT {NOTE_COLS} FROM notes ORDER BY important DESC, updated_at DESC, id DESC"))
        .map_err(e)?;
    let rows = s.query_map([], note_row).map_err(e)?.collect::<Result<Vec<_>, _>>();
    rows.map_err(e)
}

#[tauri::command]
pub fn create_note(db: State<Db>, note: Note) -> Res<i64> {
    check_note(&note)?;
    let c = db.0.lock().map_err(e)?;
    c.execute(
        "INSERT INTO notes (title, content, category, linked_date, important) VALUES (?1,?2,?3,?4,?5)",
        params![note.title.trim(), note.content, note.category, note.linked_date, note.important as i64],
    )
    .map_err(e)?;
    Ok(c.last_insert_rowid())
}

#[tauri::command]
pub fn update_note(db: State<Db>, id: i64, note: Note) -> Res<()> {
    check_note(&note)?;
    let c = db.0.lock().map_err(e)?;
    let n = c
        .execute(
            "UPDATE notes SET title=?1, content=?2, category=?3, linked_date=?4, important=?5, updated_at=CURRENT_TIMESTAMP WHERE id=?6",
            params![note.title.trim(), note.content, note.category, note.linked_date, note.important as i64, id],
        )
        .map_err(e)?;
    if n == 0 {
        return Err(format!("Nota {id} non trovata"));
    }
    Ok(())
}

#[tauri::command]
pub fn delete_note(db: State<Db>, id: i64) -> Res<()> {
    let c = db.0.lock().map_err(e)?;
    c.execute("DELETE FROM notes WHERE id=?1", params![id]).map_err(e)?;
    Ok(())
}

// ---------------------------------------------------------------- goals

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Goal {
    #[serde(default)]
    pub id: Option<i64>,
    pub title: String,
    pub target_cents: i64,
    #[serde(default)]
    pub current_cents: i64,
    #[serde(default = "d_eur")]
    pub currency: String,
    #[serde(default)]
    pub deadline: Option<String>,
    #[serde(default)]
    pub created_at: Option<String>,
}

fn goal_row(r: &Row) -> rusqlite::Result<Goal> {
    Ok(Goal {
        id: r.get(0)?,
        title: r.get(1)?,
        target_cents: r.get(2)?,
        current_cents: r.get(3)?,
        currency: r.get(4)?,
        deadline: r.get(5)?,
        created_at: r.get(6)?,
    })
}

fn check_goal(g: &Goal) -> Res<()> {
    if g.title.trim().is_empty() {
        return Err("Il titolo è obbligatorio".into());
    }
    if g.target_cents <= 0 {
        return Err("L'obiettivo deve essere maggiore di zero".into());
    }
    if g.current_cents < 0 {
        return Err("L'importo raggiunto non può essere negativo".into());
    }
    if !valid_currency(&g.currency) {
        return Err("Valuta non valida".into());
    }
    if let Some(d) = &g.deadline {
        if !valid_date(d) {
            return Err("Scadenza non valida".into());
        }
    }
    Ok(())
}

#[tauri::command]
pub fn get_goals(db: State<Db>) -> Res<Vec<Goal>> {
    let c = db.0.lock().map_err(e)?;
    let mut s = c
        .prepare("SELECT id, title, target_cents, current_cents, currency, deadline, created_at FROM goals ORDER BY (deadline IS NULL), deadline, id")
        .map_err(e)?;
    let rows = s.query_map([], goal_row).map_err(e)?.collect::<Result<Vec<_>, _>>();
    rows.map_err(e)
}

#[tauri::command]
pub fn create_goal(db: State<Db>, goal: Goal) -> Res<i64> {
    check_goal(&goal)?;
    let c = db.0.lock().map_err(e)?;
    c.execute(
        "INSERT INTO goals (title, target_cents, current_cents, currency, deadline) VALUES (?1,?2,?3,?4,?5)",
        params![goal.title.trim(), goal.target_cents, goal.current_cents, goal.currency, goal.deadline],
    )
    .map_err(e)?;
    Ok(c.last_insert_rowid())
}

#[tauri::command]
pub fn update_goal(db: State<Db>, id: i64, goal: Goal) -> Res<()> {
    check_goal(&goal)?;
    let c = db.0.lock().map_err(e)?;
    let n = c
        .execute(
            "UPDATE goals SET title=?1, target_cents=?2, current_cents=?3, currency=?4, deadline=?5 WHERE id=?6",
            params![goal.title.trim(), goal.target_cents, goal.current_cents, goal.currency, goal.deadline, id],
        )
        .map_err(e)?;
    if n == 0 {
        return Err(format!("Obiettivo {id} non trovato"));
    }
    Ok(())
}

#[tauri::command]
pub fn delete_goal(db: State<Db>, id: i64) -> Res<()> {
    let c = db.0.lock().map_err(e)?;
    c.execute("DELETE FROM goals WHERE id=?1", params![id]).map_err(e)?;
    Ok(())
}

// ------------------------------------------------------------- settings

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DbInfo {
    pub path: String,
    pub appointments: i64,
    pub tasks: i64,
    pub transactions: i64,
    pub notes: i64,
    pub goals: i64,
}

#[tauri::command]
pub fn db_info(db: State<Db>, app: tauri::AppHandle) -> Res<DbInfo> {
    use tauri::Manager;
    let c = db.0.lock().map_err(e)?;
    let count = |t: &str| -> Res<i64> { c.query_row(&format!("SELECT COUNT(*) FROM {t}"), [], |r| r.get(0)).map_err(e) };
    let path = app.path().app_data_dir().map_err(e)?.join("executive.db");
    Ok(DbInfo {
        path: path.display().to_string(),
        appointments: count("appointments")?,
        tasks: count("tasks")?,
        transactions: count("transactions")?,
        notes: count("notes")?,
        goals: count("goals")?,
    })
}

/// Writes a consistent copy of the database to `<app data>/backups/` and returns its path.
#[tauri::command]
pub fn backup_database(db: State<Db>, app: tauri::AppHandle) -> Res<String> {
    use tauri::Manager;
    let dir = app.path().app_data_dir().map_err(e)?.join("backups");
    std::fs::create_dir_all(&dir).map_err(e)?;
    let file = dir.join(format!("executive-{}.db", chrono::Local::now().format("%Y%m%d-%H%M%S")));
    let c = db.0.lock().map_err(e)?;
    c.execute("VACUUM INTO ?1", params![file.display().to_string()]).map_err(e)?;
    Ok(file.display().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tx(kind: &str, cents: i64, date: &str) -> Transaction {
        Transaction { id: None, kind: kind.into(), amount_cents: cents, currency: "EUR".into(), description: None, category: "Altro".into(), counterparty: None, payment_method: None, date: date.into(), notes: None, created_at: None }
    }

    #[test]
    fn transaction_validation() {
        assert!(check_tx(&tx("expense", 1250, "2026-11-04")).is_ok());
        assert!(check_tx(&tx("expense", 0, "2026-11-04")).is_err());
        assert!(check_tx(&tx("expense", -5, "2026-11-04")).is_err());
        assert!(check_tx(&tx("refund", 100, "2026-11-04")).is_err());
        assert!(check_tx(&tx("income", 100, "2026-02-30")).is_err());
        assert!(check_tx(&tx("income", 100, "04/11/2026")).is_err());
        let mut t = tx("expense", 500, "2026-11-04");
        t.currency = "usd".into();
        assert!(check_tx(&t).is_err());
        t.currency = "USD".into();
        assert!(check_tx(&t).is_ok());
        t.currency = "EURO".into();
        assert!(check_tx(&t).is_err());
    }

    #[test]
    fn old_database_gains_currency_columns() {
        let conn = rusqlite::Connection::open_in_memory().unwrap();
        conn.execute_batch(
            "CREATE TABLE transactions (id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT NOT NULL, amount_cents INTEGER NOT NULL, description TEXT, category TEXT NOT NULL, payment_method TEXT, date TEXT NOT NULL, notes TEXT, created_at TEXT);
             CREATE TABLE goals (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, target_cents INTEGER NOT NULL, current_cents INTEGER NOT NULL DEFAULT 0, deadline TEXT, created_at TEXT);
             INSERT INTO transactions (kind, amount_cents, category, date) VALUES ('expense', 1250, 'Alimentari', '2026-11-04');",
        )
        .unwrap();
        crate::db::migrate_for_test(&conn);
        crate::db::migrate_for_test(&conn); // idempotent
        let cur: String = conn.query_row("SELECT currency FROM transactions", [], |r| r.get(0)).unwrap();
        assert_eq!(cur, "EUR");
        conn.execute("UPDATE transactions SET counterparty = 'Esselunga'", []).unwrap();
    }

    #[test]
    fn multi_currency_rows_roundtrip() {
        let db = crate::db::open(std::path::Path::new(":memory:")).unwrap();
        let c = db.0.lock().unwrap();
        c.execute("INSERT INTO transactions (kind, amount_cents, currency, category, counterparty, date) VALUES ('income', 5000, 'USD', 'Clienti', 'Acme Inc', '2026-11-04')", []).unwrap();
        let rows = c.prepare(&format!("SELECT {TX_COLS} FROM transactions")).unwrap().query_map([], tx_row).unwrap().collect::<Result<Vec<_>, _>>().unwrap();
        assert_eq!(rows[0].currency, "USD");
        assert_eq!(rows[0].counterparty.as_deref(), Some("Acme Inc"));
    }

    #[test]
    fn schema_enforces_constraints_and_totals_roundtrip() {
        let db = crate::db::open(std::path::Path::new(":memory:")).unwrap();
        let c = db.0.lock().unwrap();
        c.execute("INSERT INTO transactions (kind, amount_cents, category, date) VALUES ('income', 500000, 'Stipendio', '2026-11-01')", []).unwrap();
        c.execute("INSERT INTO transactions (kind, amount_cents, category, date) VALUES ('expense', 1999, 'Alimentari', '2026-11-04')", []).unwrap();
        assert!(c.execute("INSERT INTO transactions (kind, amount_cents, category, date) VALUES ('expense', 0, 'x', '2026-11-04')", []).is_err());
        assert!(c.execute("INSERT INTO transactions (kind, amount_cents, category, date) VALUES ('bogus', 5, 'x', '2026-11-04')", []).is_err());
        let net: i64 = c.query_row("SELECT SUM(CASE kind WHEN 'income' THEN amount_cents ELSE -amount_cents END) FROM transactions", [], |r| r.get(0)).unwrap();
        assert_eq!(net, 498001);

        c.execute("INSERT INTO tasks (title, status, completed_at) VALUES ('a', 'done', CURRENT_TIMESTAMP)", []).unwrap();
        assert!(c.execute("INSERT INTO tasks (title, status) VALUES ('b', 'weird')", []).is_err());
        let t = c.prepare(&format!("SELECT {TASK_COLS} FROM tasks")).unwrap().query_map([], task_row).unwrap().collect::<Result<Vec<_>, _>>().unwrap();
        assert_eq!(t.len(), 1);
        assert_eq!(t[0].status, "done");
    }

    #[test]
    fn task_validation() {
        let mut t = Task { id: None, title: "x".into(), description: None, due_date: Some("2026-11-04".into()), due_time: None, priority: 1, status: "todo".into(), category: None, reminder_minutes: 0, completed_at: None, created_at: None };
        assert!(check_task(&t).is_ok());
        t.title = "  ".into();
        assert!(check_task(&t).is_err());
        t.title = "x".into();
        t.priority = 9;
        assert!(check_task(&t).is_err());
        t.priority = 1;
        t.due_date = Some("nope".into());
        assert!(check_task(&t).is_err());
    }
}
