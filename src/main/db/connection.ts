import Database from 'better-sqlite3'

export type DB = Database.Database

/**
 * Apre il database con impostazioni orientate alla durabilità:
 * WAL + synchronous=FULL: ogni transazione confermata sopravvive a crash e spegnimenti improvvisi.
 */
export function openDatabase(file: string, opts: { readonly?: boolean } = {}): DB {
  const db = new Database(file, { readonly: opts.readonly ?? false, fileMustExist: opts.readonly ?? false })
  if (!opts.readonly) {
    db.pragma('journal_mode = WAL')
    db.pragma('synchronous = FULL')
  }
  db.pragma('foreign_keys = ON')
  db.pragma('busy_timeout = 5000')
  return db
}
