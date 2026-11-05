use crate::db::Db;
use bcrypt::{hash, verify, DEFAULT_COST};
use serde::{Deserialize, Serialize};
use tauri::State;

/// Remove cloud-session metadata and retryable sync state without deleting user data.
#[tauri::command]
pub fn clear_session_state(db: State<Db>) -> Result<(), String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute("DELETE FROM settings WHERE key IN ('supabase_session', 'device_id', 'device_status', 'sync_cursor')", [])
        .map_err(|e| e.to_string())?;
    for table in ["sync_outbox", "sync_tombstones"] {
        let exists: bool = conn
            .query_row(
                "SELECT EXISTS(SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?1)",
                [table],
                |row| row.get(0),
            )
            .map_err(|e| e.to_string())?;
        if exists {
            conn.execute(&format!("DELETE FROM {table}"), [])
                .map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AuthUser {
    pub id: i64,
    pub email: String,
    pub display_name: String,
}

#[tauri::command]
pub fn register(
    db: State<Db>,
    email: String,
    password: String,
    display_name: String,
) -> Result<AuthUser, String> {
    let hash = hash(&password, DEFAULT_COST).map_err(|e| e.to_string())?;
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.execute(
        "INSERT INTO users (email, password_hash, display_name) VALUES (?1, ?2, ?3)",
        rusqlite::params![email.trim().to_lowercase(), hash, display_name.trim()],
    )
    .map_err(|e| {
        if e.to_string().contains("UNIQUE") {
            "Email già registrata".to_string()
        } else {
            e.to_string()
        }
    })?;
    let id = conn.last_insert_rowid();
    Ok(AuthUser {
        id,
        email: email.trim().to_lowercase(),
        display_name: display_name.trim().to_string(),
    })
}

#[tauri::command]
pub fn login(db: State<Db>, email: String, password: String) -> Result<AuthUser, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    let result: Result<(i64, String, String), _> = conn.query_row(
        "SELECT id, password_hash, display_name FROM users WHERE email = ?1 COLLATE NOCASE",
        rusqlite::params![email.trim().to_lowercase()],
        |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
    );
    match result {
        Ok((id, pw_hash, display_name)) => {
            if verify(&password, &pw_hash).unwrap_or(false) {
                Ok(AuthUser {
                    id,
                    email: email.trim().to_lowercase(),
                    display_name,
                })
            } else {
                Err("Credenziali non valide".to_string())
            }
        }
        // Don't reveal whether the email exists
        Err(_) => Err("Credenziali non valide".to_string()),
    }
}

#[tauri::command]
pub fn get_current_user(db: State<Db>, user_id: i64) -> Result<AuthUser, String> {
    let conn = db.0.lock().map_err(|e| e.to_string())?;
    conn.query_row(
        "SELECT id, email, display_name FROM users WHERE id = ?1",
        rusqlite::params![user_id],
        |r| {
            Ok(AuthUser {
                id: r.get(0)?,
                email: r.get(1)?,
                display_name: r.get(2)?,
            })
        },
    )
    .map_err(|e| e.to_string())
}
