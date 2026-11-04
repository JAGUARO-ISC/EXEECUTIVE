import type { DB } from './connection'

interface Migration {
  version: number
  name: string
  up: (db: DB) => void
}

const now = (): string => new Date().toISOString()

const DEFAULT_CATEGORIES: [kind: string, name: string, color: string][] = [
  ['event', 'Lavoro', '#6E9CF5'],
  ['event', 'Riunioni', '#9B87F5'],
  ['event', 'Clienti', '#C9A86A'],
  ['event', 'Personale', '#3FBF8F'],
  ['event', 'Salute', '#E26D6D'],
  ['event', 'Famiglia', '#E8A25C'],
  ['task', 'Lavoro', '#6E9CF5'],
  ['task', 'Amministrazione', '#C9A86A'],
  ['task', 'Personale', '#3FBF8F'],
  ['task', 'Casa', '#E8A25C'],
  ['expense', 'Alimentari', '#3FBF8F'],
  ['expense', 'Ristoranti', '#E8A25C'],
  ['expense', 'Trasporti', '#6E9CF5'],
  ['expense', 'Carburante', '#5BB5C9'],
  ['expense', 'Shopping', '#D97BB0'],
  ['expense', 'Ufficio', '#8C9BB5'],
  ['expense', 'Abbonamenti', '#9B87F5'],
  ['expense', 'Viaggi', '#4FA3E0'],
  ['expense', 'Bollette', '#E26D6D'],
  ['expense', 'Personale', '#C98A6A'],
  ['expense', 'Business', '#C9A86A'],
  ['expense', 'Investimenti', '#5FB878'],
  ['expense', 'Altro', '#7A8396'],
  ['income', 'Stipendio', '#3FBF8F'],
  ['income', 'Clienti', '#C9A86A'],
  ['income', 'Consulenze', '#6E9CF5'],
  ['income', 'Vendite', '#9B87F5'],
  ['income', 'Commissioni', '#E8A25C'],
  ['income', 'Rendite', '#5BB5C9'],
  ['income', 'Altre entrate', '#7A8396'],
  ['note', 'Idee', '#C9A86A'],
  ['note', 'Lavoro', '#6E9CF5'],
  ['note', 'Personale', '#3FBF8F']
]

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'schema iniziale',
    up: (db) => {
      db.exec(`
        CREATE TABLE settings (
          key   TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );

        CREATE TABLE categories (
          id       INTEGER PRIMARY KEY AUTOINCREMENT,
          kind     TEXT NOT NULL CHECK (kind IN ('event','task','income','expense','note')),
          name     TEXT NOT NULL,
          color    TEXT NOT NULL,
          sort     INTEGER NOT NULL DEFAULT 0,
          archived INTEGER NOT NULL DEFAULT 0,
          UNIQUE (kind, name)
        );

        CREATE TABLE events (
          id               INTEGER PRIMARY KEY AUTOINCREMENT,
          title            TEXT NOT NULL,
          description      TEXT NOT NULL DEFAULT '',
          location         TEXT NOT NULL DEFAULT '',
          category_id      INTEGER REFERENCES categories(id) ON DELETE SET NULL,
          priority         TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
          start_at         TEXT NOT NULL,
          end_at           TEXT NOT NULL,
          all_day          INTEGER NOT NULL DEFAULT 0,
          reminder_minutes INTEGER,
          recurrence       TEXT,
          created_at       TEXT NOT NULL,
          updated_at       TEXT NOT NULL,
          CHECK (end_at >= start_at)
        );
        CREATE INDEX idx_events_start ON events(start_at);

        CREATE TABLE event_exceptions (
          event_id        INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
          occurrence_date TEXT NOT NULL,
          kind            TEXT NOT NULL CHECK (kind IN ('skip','done')),
          PRIMARY KEY (event_id, occurrence_date, kind)
        );

        CREATE TABLE tasks (
          id           INTEGER PRIMARY KEY AUTOINCREMENT,
          title        TEXT NOT NULL,
          description  TEXT NOT NULL DEFAULT '',
          type         TEXT NOT NULL DEFAULT 'task' CHECK (type IN ('task','meeting','call','errand','deadline','goal','reminder')),
          scope        TEXT NOT NULL DEFAULT 'work' CHECK (scope IN ('work','personal')),
          date         TEXT,
          time         TEXT,
          due_date     TEXT,
          priority     TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low','medium','high','urgent')),
          status       TEXT NOT NULL DEFAULT 'todo' CHECK (status IN ('todo','in_progress','done')),
          category_id  INTEGER REFERENCES categories(id) ON DELETE SET NULL,
          reminder_at  TEXT,
          recurrence   TEXT,
          completed_at TEXT,
          created_at   TEXT NOT NULL,
          updated_at   TEXT NOT NULL
        );
        CREATE INDEX idx_tasks_date ON tasks(date);
        CREATE INDEX idx_tasks_due ON tasks(due_date);

        CREATE TABLE recurring_payments (
          id             INTEGER PRIMARY KEY AUTOINCREMENT,
          kind           TEXT NOT NULL CHECK (kind IN ('income','expense')),
          amount_cents   INTEGER NOT NULL CHECK (amount_cents > 0),
          description    TEXT NOT NULL,
          category_id    INTEGER REFERENCES categories(id) ON DELETE SET NULL,
          payment_method TEXT NOT NULL DEFAULT '',
          freq           TEXT NOT NULL CHECK (freq IN ('weekly','monthly','yearly')),
          next_date      TEXT NOT NULL,
          anchor_day     INTEGER NOT NULL,
          active         INTEGER NOT NULL DEFAULT 1,
          created_at     TEXT NOT NULL
        );

        CREATE TABLE transactions (
          id              INTEGER PRIMARY KEY AUTOINCREMENT,
          kind            TEXT NOT NULL CHECK (kind IN ('income','expense')),
          amount_cents    INTEGER NOT NULL CHECK (amount_cents > 0),
          description     TEXT NOT NULL,
          category_id     INTEGER REFERENCES categories(id) ON DELETE SET NULL,
          date            TEXT NOT NULL,
          time            TEXT NOT NULL,
          payment_method  TEXT NOT NULL DEFAULT '',
          notes           TEXT NOT NULL DEFAULT '',
          attachment      TEXT,
          attachment_name TEXT,
          recurring_id    INTEGER REFERENCES recurring_payments(id) ON DELETE SET NULL,
          created_at      TEXT NOT NULL,
          updated_at      TEXT NOT NULL
        );
        CREATE INDEX idx_tx_date ON transactions(date);
        CREATE UNIQUE INDEX idx_tx_recurring_once ON transactions(recurring_id, date) WHERE recurring_id IS NOT NULL;

        CREATE TABLE budgets (
          category_id  INTEGER PRIMARY KEY REFERENCES categories(id) ON DELETE CASCADE,
          amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0)
        );

        CREATE TABLE notes (
          id          INTEGER PRIMARY KEY AUTOINCREMENT,
          title       TEXT NOT NULL,
          body        TEXT NOT NULL DEFAULT '',
          category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
          linked_date TEXT,
          important   INTEGER NOT NULL DEFAULT 0,
          created_at  TEXT NOT NULL,
          updated_at  TEXT NOT NULL
        );
        CREATE INDEX idx_notes_date ON notes(linked_date);

        CREATE TABLE notification_log (
          key      TEXT PRIMARY KEY,
          fired_at TEXT NOT NULL
        );
      `)
      const insert = db.prepare('INSERT INTO categories (kind, name, color, sort) VALUES (?, ?, ?, ?)')
      DEFAULT_CATEGORIES.forEach(([kind, name, color], i) => insert.run(kind, name, color, i))
    }
  }
]

export const LATEST_SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version

export function currentSchemaVersion(db: DB): number {
  const exists = db
    .prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'schema_migrations'")
    .get()
  if (!exists) return 0
  const row = db.prepare('SELECT MAX(version) AS v FROM schema_migrations').get() as { v: number | null }
  return row.v ?? 0
}

export function pendingMigrations(db: DB): Migration[] {
  const v = currentSchemaVersion(db)
  return MIGRATIONS.filter((m) => m.version > v)
}

/**
 * Applica in ordine le migrazioni mancanti. Ogni migrazione gira in una transazione:
 * se fallisce, il database resta esattamente com'era prima di quella migrazione.
 */
export function runMigrations(db: DB): { from: number; to: number } {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version    INTEGER PRIMARY KEY,
    name       TEXT NOT NULL,
    applied_at TEXT NOT NULL
  )`)
  const from = currentSchemaVersion(db)
  if (from > LATEST_SCHEMA_VERSION) {
    throw new Error(
      `Il database è stato creato da una versione più recente di Executive (schema ${from}). Aggiorna l'applicazione.`
    )
  }
  for (const m of MIGRATIONS.filter((x) => x.version > from)) {
    db.transaction(() => {
      m.up(db)
      db.prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)').run(m.version, m.name, now())
    })()
  }
  return { from, to: currentSchemaVersion(db) }
}
