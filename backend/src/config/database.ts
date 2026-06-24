import initSqlJs, { type Database as SqlJsDatabase } from 'sql.js';
import fs from 'fs';
import path from 'path';

const dbPath = process.env.DB_PATH || path.join(__dirname, '../../db/airis.db');

let db: SqlJsDatabase;
let saveInterval: ReturnType<typeof setInterval> | null = null;

function saveToDisk(): void {
  if (!db) return;
  try {
    const dir = path.dirname(dbPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const data = db.export();
    fs.writeFileSync(dbPath, Buffer.from(data));
  } catch (err) {
    console.error('[Database] Save error:', err);
  }
}

async function initDatabase(): Promise<SqlJsDatabase> {
  const SQL = await initSqlJs();

  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
    console.log(`[Database] Loaded from ${dbPath}`);
  } else {
    db = new SQL.Database();
    console.log(`[Database] Created new database at ${dbPath}`);
  }

  db.run('PRAGMA journal_mode = WAL');
  db.run('PRAGMA foreign_keys = true');

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      uid TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      display_name TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      last_login TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS chat_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_uid TEXT NOT NULL,
      session_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('system', 'user', 'assistant')),
      content TEXT NOT NULL,
      model_used TEXT DEFAULT '',
      timestamp TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_uid) REFERENCES users(uid) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS context_memory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_uid TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'general',
      timestamp TEXT DEFAULT (datetime('now')),
      UNIQUE(user_uid, key)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS automation_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_uid TEXT NOT NULL,
      name TEXT NOT NULL,
      command TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'running', 'completed', 'failed')),
      output TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT,
      FOREIGN KEY (user_uid) REFERENCES users(uid) ON DELETE CASCADE
    )
  `);

  db.run('CREATE INDEX IF NOT EXISTS idx_chat_history_user ON chat_history(user_uid, session_id)');
  db.run('CREATE INDEX IF NOT EXISTS idx_chat_history_timestamp ON chat_history(timestamp)');
  db.run('CREATE INDEX IF NOT EXISTS idx_context_memory_user ON context_memory(user_uid)');
  db.run('CREATE INDEX IF NOT EXISTS idx_automation_tasks_user ON automation_tasks(user_uid, status)');

  saveToDisk();

  saveInterval = setInterval(saveToDisk, 5000);

  console.log(`[Database] Schema initialized at ${dbPath}`);
  return db;
}

function queryAll(sql: string, params: any[] = []): any[] {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows: any[] = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function queryOne(sql: string, params: any[] = []): any | undefined {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }
  stmt.free();
  return undefined;
}

function run(sql: string, params: any[] = []): { changes: number; lastInsertRowid: number } {
  db.run(sql, params);
  const changes = db.getRowsModified();
  const lastRow = queryOne('SELECT last_insert_rowid() as id');
  return { changes, lastInsertRowid: lastRow?.id || 0 };
}

function exec(sql: string): void {
  db.run(sql);
}

function closeDatabase(): void {
  if (saveInterval) {
    clearInterval(saveInterval);
    saveInterval = null;
  }
  saveToDisk();
  if (db) {
    db.close();
    console.log('[Database] Closed');
  }
}

export { initDatabase, closeDatabase, queryAll, queryOne, run, exec, saveToDisk };
