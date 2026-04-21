import initSqlJs from 'sql.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readFileSync, writeFileSync, existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbPath = join(__dirname, '../../data.db');
const wasmPath = join(__dirname, '../../node_modules/sql.js/dist/sql-wasm.wasm');

let db;

export const initDb = async () => {
  const SQL = await initSqlJs({
    locateFile: () => wasmPath
  });
  
  if (existsSync(dbPath)) {
    const file = readFileSync(dbPath);
    db = new SQL.Database(file);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      phone TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS rooms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      status TEXT DEFAULT 'sent',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (room_id) REFERENCES rooms(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  const rooms = db.exec("SELECT id FROM rooms WHERE id = 1");
  if (rooms.length === 0) {
    db.run("INSERT INTO rooms (id, name) VALUES (1, 'Genel')");
  }

  saveDb();
  return db;
};

export const saveDb = () => {
  const data = db.export();
  const buffer = Buffer.from(data);
  writeFileSync(dbPath, buffer);
};

export const getDb = () => db;

export default { initDb, getDb, saveDb };