# User model
import sqlite3
from typing import Optional, Dict, Any


class User:
    def __init__(self, user_id: int, username: str, email: str, password_hash: str):
        self.id = user_id
        self.username = username
        self.email = email
        self.password_hash = password_hash

    @classmethod
    def create(cls, db_path: str, username: str, email: str, password_hash: str) -> 'User':
        """Create a new user in the database."""
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            cursor.execute(
                """INSERT INTO users (username, email, password_hash)
                VALUES (?, ?, ?)""",
                (username, email, password_hash)
            )
            user_id = cursor.lastrowid
            return cls(user_id, username, email, password_hash)

    @classmethod
    def get_by_id(cls, db_path: str, user_id: int) -> Optional['User']:
        """Retrieve a user by ID."""
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM users WHERE id = ?", (user_id,))
            row = cursor.fetchone()
            if row:
                return cls(row[0], row[1], row[2], row[3])
            return None

    @classmethod
    def get_by_username(cls, db_path: str, username: str) -> Optional['User']:
        """Retrieve a user by username."""
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM users WHERE username = ?", (username,))
            row = cursor.fetchone()
            if row:
                return cls(row[0], row[1], row[2], row[3])
            return None

    def update(self, db_path: str, username: Optional[str] = None, email: Optional[str] = None, password_hash: Optional[str] = None) -> bool:
        """Update user information."""
        with sqlite3.connect(db_path) as conn:
            cursor = conn.cursor()
            updates = []
            params = []
            if username:
                updates.append("username = ?")
                params.append(username)
            if email:
                updates.append("email = ?")
                params.append(email)
            if password_hash:
                updates.append("password_hash = ?")
                params.append(password_hash)
            if not updates:
                return False
            params.append(self.id)
            update_query = f"UPDATE users SET {', '.join(updates)}, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
            cursor.execute(update_query, params)
            return cursor.rowcount > 0