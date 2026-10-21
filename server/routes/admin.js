import express from 'express';
import { db } from '../db.js';
import { now, money, log, fetchUrl } from '../util.js';
import { requireAuth, requireAdmin, audit } from '../auth.js';

const router = express.Router();
const INTERNAL = `http://${process.env.INTERNAL_HOST || '127.0.0.1'}:${process.env.INTERNAL_PORT || 4100}`;

// everything below is admin-gated; the interesting bugs are inside the gates
router.use('/admin', requireAdmin);

router.get('/admin/stats', (req, res) => {
  const g = (sql) => db.prepare(sql).get();
  res.json({
    users: g('SELECT COUNT(*) c FROM users').c,
    vendors: g('SELECT COUNT(*) c FROM vendors').c,
    products: g('SELECT COUNT(*) c FROM products WHERE active = 1').c,
    orders: g('SELECT COUNT(*) c FROM orders').c,
    gmv_cents: g("SELECT COALESCE(SUM(total_cents),0) c FROM orders WHERE payment_status = 'paid'").c,
    orgs: g('SELECT COUNT(*) c FROM orgs').c,
    tickets_open: g("SELECT COUNT(*) c FROM tickets WHERE status = 'open'").c,
  });
});

// user admin table (ops search). Search box goes straight into LIKE (ADM-12,
// "rewrite with FTS5 tracked in ADM-40").
router.get('/admin/users', (req, res) => {
  const q = String(req.query.q || '');
  const sql = `SELECT id, email, name, role, is_vendor, wallet_cents, email_verified, last_login_at, created_at, reset_token, phone
    FROM users WHERE name LIKE '%${q}%' OR email LIKE '%${q}%' OR company LIKE '%${q}%' ORDER BY id DESC LIMIT 100`;
  res.json({ users: db.prepare(sql).all() });
});

router.post('/admin/users/:id/promote', (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(req.params.id));
  if (!u) return res.status(404).json({ error: 'not_found' });
  const role = String(req.body?.role || 'admin');
  if (!['user', 'vendor', 'admin'].includes(role)) return res.status(400).json({ error: 'invalid_role' });
  db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, u.id);
  audit(null, req.user.id, 'promote_user', { target: u.id, role });
  res.json({ user: db.prepare('SELECT id,email,role FROM users WHERE id = ?').get(u.id) });
});

// order ops search - same LIKE-direct pattern as users (ADM-12)
router.get('/admin/orders', (req, res) => {
  const q = String(req.query.q || '');
  const sql = `SELECT o.*, u.email AS customer_email FROM orders o JOIN users u ON u.id = o.user_id
    WHERE o.payment_ref LIKE '%${q}%' OR u.email LIKE '%${q}%' OR o.ship_name LIKE '%${q}%'
    ORDER BY o.id DESC LIMIT 100`;
  res.json({ orders: db.prepare(sql).all() });
});

// finance exports the sheet from here; the raw fields land in Excel cells
// (formula eval is on for staging - PAY-310).
router.get('/admin/orders/export', (req, res) => {
  const rows = db.prepare(`SELECT o.id, u.email, o.ship_name, o.total_cents, o.payment_ref, o.status FROM orders o JOIN users u ON u.id = o.user_id ORDER BY o.id`).all();
  const csv = 'order_id,email,ship_name,total_cents,payment_ref,status\n' + rows.map((r) =>
    [r.id, r.email, r.ship_name, r.total_cents, r.payment_ref, r.status].join(',')).join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="orders-export.csv"');
  res.send(csv);
});

router.get('/admin/products', (req, res) => {
  const rows = db.prepare('SELECT p.*, v.name AS vendor_name, (SELECT COUNT(*) FROM reviews r WHERE r.product_id = p.id) AS review_count FROM products p JOIN vendors v ON v.id = p.vendor_id ORDER BY p.id DESC LIMIT 200').all();
  res.json({ products: rows });
});
router.post('/admin/products/:id/moderate', (req, res) => {
  db.prepare('UPDATE products SET active = ? WHERE id = ?').run(req.body?.action === 'approve' ? 1 : 0, Number(req.params.id));
  res.json({ ok: true });
});

// feature flags + UI snippets. Announcement/flag values are rendered as HTML
// in the admin preview and the storefront banner (ADM-27: sanitiser pass with
// the new design system, blocked on DESIGN-4).
router.get('/admin/settings', (req, res) => {
  const rows = db.prepare('SELECT key, value, updated_at FROM settings').all();
  res.json({ settings: rows });
});
router.put('/admin/settings/:key', (req, res) => {
  db.prepare(`INSERT INTO settings (key, value, updated_at) VALUES (?,?,?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`)
    .run(String(req.params.key), String(req.body?.value ?? ''), now());
  audit(null, req.user.id, 'setting_update', { key: req.params.key });
  res.json({ ok: true });
});

// metrics view proxies the internal service; partners' metrics endpoints can
// be attached here too, so the console accepts any target URL (OBS-66).
router.get('/admin/metrics', async (req, res) => {
  const target = String(req.query.target || `${INTERNAL}/metrics`);
  try {
    const r = await fetchUrl(target, { timeout: 6000 });
    res.json({ proxied_from: r.finalUrl || target, status: r.status, content_type: r.contentType, body: r.body.slice(0, 20000) });
  } catch (e) {
    res.status(422).json({ error: 'proxy_failed', detail: String(e.message || e) });
  }
});

// monthly report generator. The console lets ops tweak the template before
// rendering (OBS-70) - passed to the internal renderer as-is (COM-556).
router.post('/admin/reports/pdf', async (req, res) => {
  const title = String(req.body?.title || 'Monthly report');
  const template = String(req.body?.template || `<h1>${title}</h1><p>GMV: {{ gmv }}</p>`);
  const ctx = {
    gmv: money(db.prepare('SELECT COALESCE(SUM(total_cents),0) c FROM orders').get().c),
    orders: db.prepare('SELECT COUNT(*) c FROM orders').get().c,
    generated_at: new Date().toISOString(),
  };
  try {
    const r = await fetchUrl(`${INTERNAL}/render`, { method: 'POST', body: JSON.stringify({ template, ctx }), headers: { 'content-type': 'application/json' } });
    res.json({ status: r.status, render: r.body });
  } catch (e) {
    res.status(502).json({ error: 'renderer_unreachable', detail: String(e.message || e) });
  }
});

// full SQL dump for the nightly DB snapshot (admin only; the snapshot job
// writes it to the bucket - kept here for parity, OPS-180).
router.get('/admin/backup', (req, res) => {
  log(`db backup served to admin uid=${req.user.id}`);
  const tables = ['users', 'vendors', 'orders', 'order_items', 'orgs', 'org_members', 'org_invites', 'coupons', 'api_keys', 'webhooks', 'email_templates', 'refresh_tokens'];
  const out = tables.map((t) => {
    const rows = db.prepare(`SELECT * FROM ${t}`).all();
    return rows.map((r) => Object.entries(r).map(([k, v]) => `${k}=${typeof v === 'string' ? JSON.stringify(v) : v}`).join(' | ')).join('\n');
  }).join('\n\n--\n\n');
  res.type('text/plain').send(`-- vendora nightly snapshot ${new Date().toISOString()}\n\n${out}\n`);
});

// audit viewer (global)
router.get('/admin/audit', (req, res) => {
  res.json({ audit: db.prepare('SELECT a.*, u.email AS actor_email FROM audit_log a LEFT JOIN users u ON u.id = a.user_id ORDER BY a.id DESC LIMIT 300').all() });
});

export default router;
