import sqlite3 from 'sqlite3'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export class Database {
  constructor(dbPath) {
    this.dbPath = dbPath
    this.db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Database connection error:', err)
      } else {
        this.initialize()
      }
    })
  }

  initialize() {
    this.db.serialize(() => {
      this.db.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          email TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `)

      this.db.run(`
        CREATE TABLE IF NOT EXISTS events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          start_time TIMESTAMP NOT NULL,
          end_time TIMESTAMP,
          location TEXT,
          category TEXT,
          color INTEGER DEFAULT 0,
          is_recurring BOOLEAN DEFAULT FALSE,
          recurrence_rule TEXT,
          is_all_day BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `)

      this.db.run(`
        CREATE TABLE IF NOT EXISTS tasks (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          due_date TIMESTAMP,
          priority INTEGER DEFAULT 1,
          status TEXT DEFAULT 'pending',
          category TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `)

      this.db.run(`
        CREATE TABLE IF NOT EXISTS transactions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          amount REAL NOT NULL,
          type TEXT NOT NULL,
          description TEXT,
          category TEXT,
          date TIMESTAMP NOT NULL,
          payment_method TEXT,
          notes TEXT,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `)
    })
  }

  getDb() {
    return this.db
  }
}