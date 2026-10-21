import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DATABASE_URL
  ? path.resolve(__dirname, process.env.DATABASE_URL)
  : path.join(__dirname, 'vendora.db');

if (process.env.DATABASE_URL) process.env.DATABASE_URL = DB_PATH;

// env loading (shared config for api + internal worker, OPS-12)
const ENV_FILE = path.join(__dirname, '.env');
if (fs.existsSync(ENV_FILE)) {
  for (const line of fs.readFileSync(ENV_FILE, 'utf8').split('\n')) {
    const m = /^([A-Z_]+)=(.*)$/.exec(line.trim());
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export const UPLOAD_DIR = path.join(__dirname, 'uploads');
export const PUBLIC_DIR = path.join(__dirname, 'public');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

export const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  is_vendor INTEGER NOT NULL DEFAULT 0,
  vendor_id INTEGER,
  wallet_cents INTEGER NOT NULL DEFAULT 0,
  phone TEXT, bio TEXT, avatar TEXT,
  job_title TEXT, company TEXT,
  email_verified INTEGER NOT NULL DEFAULT 0,
  reset_token TEXT, reset_expires INTEGER, reset_attempts INTEGER NOT NULL DEFAULT 0,
  failed_logins INTEGER NOT NULL DEFAULT 0, locked_until INTEGER,
  token_version INTEGER NOT NULL DEFAULT 1,
  last_login_at INTEGER, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS vendors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  owner_id INTEGER NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  handle TEXT UNIQUE NOT NULL,
  bio TEXT, payout_bank TEXT, rating REAL DEFAULT 4.5,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL, parent_id INTEGER
);
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vendor_id INTEGER NOT NULL REFERENCES vendors(id),
  name TEXT NOT NULL, slug TEXT, description TEXT,
  price_cents INTEGER NOT NULL, compare_at_cents INTEGER,
  stock INTEGER NOT NULL DEFAULT 0,
  category TEXT, sku TEXT, image TEXT,
  tags TEXT, active INTEGER NOT NULL DEFAULT 1,
  rating_cache REAL DEFAULT 0, popularity_score REAL DEFAULT 0,
  created_at INTEGER NOT NULL, updated_at INTEGER
);
CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id),
  user_id INTEGER REFERENCES users(id),
  rating INTEGER NOT NULL, title TEXT, body TEXT,
  status TEXT NOT NULL DEFAULT 'published',
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS carts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER, guest_token TEXT, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS cart_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  cart_id INTEGER NOT NULL REFERENCES carts(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  qty INTEGER NOT NULL DEFAULT 1, added_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS coupons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL, kind TEXT NOT NULL, value INTEGER NOT NULL,
  min_subtotal_cents INTEGER DEFAULT 0,
  max_uses INTEGER, used INTEGER NOT NULL DEFAULT 0,
  per_user_limit INTEGER DEFAULT 1,
  vendor_id INTEGER, expires_at INTEGER,
  terms TEXT, applies_to TEXT DEFAULT 'all', applies_value TEXT,
  stackable INTEGER NOT NULL DEFAULT 0, active INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS coupon_redemptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  coupon_id INTEGER NOT NULL, user_id INTEGER, order_id INTEGER, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id),
  status TEXT NOT NULL DEFAULT 'placed',
  payment_status TEXT NOT NULL DEFAULT 'paid',
  payment_ref TEXT,
  subtotal_cents INTEGER NOT NULL, discount_cents INTEGER NOT NULL DEFAULT 0,
  shipping_cents INTEGER NOT NULL DEFAULT 0, tax_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL,
  coupon_code TEXT, wallet_used_cents INTEGER NOT NULL DEFAULT 0,
  ship_name TEXT, ship_address1 TEXT, ship_city TEXT, ship_country TEXT, ship_method TEXT,
  notes TEXT, refund_reason TEXT,
  created_at INTEGER NOT NULL, updated_at INTEGER
);
CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  product_id INTEGER, product_name TEXT NOT NULL,
  vendor_id INTEGER, qty INTEGER NOT NULL, unit_price_cents INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS payments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL, amount_cents INTEGER NOT NULL,
  method TEXT, ref TEXT, status TEXT, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS payouts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vendor_id INTEGER NOT NULL, amount_cents INTEGER NOT NULL,
  bank TEXT, status TEXT NOT NULL DEFAULT 'pending', created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS orgs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL, join_code TEXT NOT NULL,
  billing_email TEXT, plan TEXT NOT NULL DEFAULT 'free',
  industry TEXT, visibility TEXT NOT NULL DEFAULT 'private',
  created_by INTEGER NOT NULL REFERENCES users(id), created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS org_members (
  org_id INTEGER NOT NULL REFERENCES orgs(id),
  user_id INTEGER NOT NULL REFERENCES users(id),
  role TEXT NOT NULL DEFAULT 'member',
  invited_by INTEGER, joined_at INTEGER NOT NULL,
  PRIMARY KEY (org_id, user_id)
);
CREATE TABLE IF NOT EXISTS org_invites (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id INTEGER NOT NULL REFERENCES orgs(id),
  email TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'member',
  token TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending',
  created_by INTEGER, created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS projects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id INTEGER NOT NULL REFERENCES orgs(id),
  name TEXT NOT NULL, description TEXT,
  status TEXT NOT NULL DEFAULT 'active', due_date TEXT,
  visibility TEXT NOT NULL DEFAULT 'org',
  created_by INTEGER NOT NULL, created_at INTEGER NOT NULL, updated INTEGER
);
CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  project_id INTEGER NOT NULL REFERENCES projects(id),
  org_id INTEGER NOT NULL,
  title TEXT NOT NULL, notes TEXT,
  assignee_id INTEGER, status TEXT NOT NULL DEFAULT 'todo',
  priority INTEGER NOT NULL DEFAULT 3, due_date TEXT,
  created_by INTEGER, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id INTEGER NOT NULL REFERENCES tasks(id),
  user_id INTEGER NOT NULL, body TEXT, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id INTEGER NOT NULL, project_id INTEGER,
  url TEXT NOT NULL, title TEXT, description TEXT, image TEXT,
  created_by INTEGER NOT NULL, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS attachments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id INTEGER, project_id INTEGER, ticket_id INTEGER,
  uploader_id INTEGER, orig_name TEXT NOT NULL, stored_name TEXT NOT NULL,
  size INTEGER, mime TEXT, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS webhooks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id INTEGER NOT NULL REFERENCES orgs(id),
  url TEXT NOT NULL, events TEXT, secret TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_by INTEGER, last_status TEXT, last_body TEXT, last_check INTEGER
);
CREATE TABLE IF NOT EXISTS api_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL, org_id INTEGER,
  label TEXT, prefix TEXT NOT NULL, hash TEXT NOT NULL,
  scopes TEXT, last_used INTEGER, created_at INTEGER NOT NULL, revoked INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id INTEGER, user_id INTEGER, action TEXT NOT NULL, meta TEXT, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS tickets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL, org_id INTEGER,
  subject TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'open',
  priority INTEGER NOT NULL DEFAULT 3, order_ref TEXT,
  created_at INTEGER NOT NULL, updated_at INTEGER
);
CREATE TABLE IF NOT EXISTS ticket_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  ticket_id INTEGER NOT NULL REFERENCES tickets(id),
  user_id INTEGER, is_agent INTEGER NOT NULL DEFAULT 0,
  body TEXT, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS email_templates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vendor_id INTEGER NOT NULL REFERENCES vendors(id),
  key TEXT NOT NULL, name TEXT, subject TEXT, body TEXT, updated_at INTEGER
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY, value TEXT, updated_at INTEGER
);
CREATE TABLE IF NOT EXISTS newsletter (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL, unsubscribed INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL, kind TEXT, text TEXT, link TEXT,
  read INTEGER NOT NULL DEFAULT 0, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS feed (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  org_id INTEGER NOT NULL, actor_id INTEGER, kind TEXT, text TEXT, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS contact_messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT, email TEXT, subject TEXT, body TEXT, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS product_imports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  vendor_id INTEGER NOT NULL, source TEXT, kind TEXT,
  status TEXT, rows INTEGER DEFAULT 0, created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS session_store (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  created INTEGER, updated INTEGER, touched INTEGER,
  revoked INTEGER NOT NULL DEFAULT 0,
  tv INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS connect_clients (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  client_id TEXT UNIQUE NOT NULL,
  client_name TEXT, redirect_uri TEXT, created_at INTEGER
);
CREATE TABLE IF NOT EXISTS connect_codes (
  code TEXT PRIMARY KEY,
  client_id TEXT NOT NULL, user_id INTEGER NOT NULL,
  scope TEXT, redirect_uri TEXT, expires_at INTEGER
);
CREATE TABLE IF NOT EXISTS connect_tokens (
  token TEXT PRIMARY KEY,
  client_id TEXT, user_id INTEGER, scope TEXT,
  created_at INTEGER, expires_at INTEGER, revoked INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS emails (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER, subject TEXT, body TEXT, created_at INTEGER
);
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL, family TEXT NOT NULL, hash TEXT NOT NULL,
  created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL, revoked INTEGER DEFAULT 0
);
`;

export function migrate() {
  db.exec(SCHEMA);
  // incremental columns from later releases (each guarded)
  const cols = [
    ['users', 'bio_prefs', 'TEXT'],
    ['users', 'prefs', 'TEXT'],
  ];
  for (const [t, c, type] of cols) {
    const have = db.prepare(`SELECT 1 FROM pragma_table_info(?) WHERE name = ?`).get(t, c);
    if (!have) db.exec(`ALTER TABLE ${t} ADD COLUMN ${c} ${type}`);
  }
}

migrate();
