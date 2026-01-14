import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { mkdirSync, existsSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = process.env.DATABASE_PATH || join(__dirname, '../data/database.db');
const DB_DIR = dirname(DB_PATH);

// Criar diretório se não existir
if (!existsSync(DB_DIR)) {
  mkdirSync(DB_DIR, { recursive: true });
}

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');

export function initDatabase() {
  console.log('🗄️  Inicializando banco de dados...');

  // Tabela de usuários (seus clientes)
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE,
      name TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Tabela de contas Instagram conectadas
  db.exec(`
    CREATE TABLE IF NOT EXISTS instagram_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      instagram_account_id TEXT UNIQUE NOT NULL,
      username TEXT,
      access_token TEXT NOT NULL,
      token_expires_at DATETIME,
      page_id TEXT,
      page_name TEXT,
      permissions TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // Índice para buscar contas por instagram_account_id (usado nos webhooks)
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_instagram_account_id 
    ON instagram_accounts(instagram_account_id)
  `);

  // Tabela de mensagens recebidas
  db.exec(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      sender_id TEXT NOT NULL,
      recipient_id TEXT NOT NULL,
      message_id TEXT UNIQUE NOT NULL,
      text TEXT,
      timestamp BIGINT,
      replied BOOLEAN DEFAULT 0,
      reply_text TEXT,
      reply_timestamp DATETIME,
      raw_data TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (account_id) REFERENCES instagram_accounts(id) ON DELETE CASCADE
    )
  `);

  // Tabela de comentários recebidos
  db.exec(`
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id INTEGER NOT NULL,
      comment_id TEXT UNIQUE NOT NULL,
      post_id TEXT,
      from_user_id TEXT,
      from_username TEXT,
      text TEXT,
      timestamp BIGINT,
      replied BOOLEAN DEFAULT 0,
      reply_text TEXT,
      reply_timestamp DATETIME,
      raw_data TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (account_id) REFERENCES instagram_accounts(id) ON DELETE CASCADE
    )
  `);

  console.log('✅ Banco de dados inicializado');
}

export default db;
