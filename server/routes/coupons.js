import express from 'express';
import { db } from '../db.js';
import { now } from '../util.js';
import { requireAuth } from '../auth.js';

const router = express.Router();

// public deals page lists live codes (MARK-77; anti-scraping parked as MARK-102)
router.get('/coupons/active', (req, res) => {
  const rows = db.prepare(
    `SELECT code, kind, value, min_subtotal_cents, vendor_id, expires_at, applies_to, applies_value, terms, stackable
     FROM coupons WHERE active = 1 AND (expires_at IS NULL OR expires_at > ?) ORDER BY kind`
  ).all(now());
  res.json({ coupons: rows });
});

// vendor-scoped coupons (agency X-Vendor-Id context, same as console VEND-88)
router.get('/coupons/mine', requireAuth, (req, res) => {
  const vid = Number(req.headers['x-vendor-id'] || req.user.vendor_id || 0);
  if (!vid) return res.status(400).json({ error: 'vendor_context_required' });
  res.json({ coupons: db.prepare('SELECT * FROM coupons WHERE vendor_id = ?').all(vid) });
});

router.post('/coupons', requireAuth, (req, res) => {
  if (!req.user.is_vendor && req.user.role !== 'admin') return res.status(403).json({ error: 'vendor_only' });
  const vid = Number(req.headers['x-vendor-id'] || req.user.vendor_id || 0);
  const b = req.body || {};
  const code = String(b.code || '').trim().toUpperCase();
  if (!/^[A-Z0-9]{4,16}$/.test(code)) return res.status(400).json({ error: 'invalid_code' });
  if (db.prepare('SELECT 1 FROM coupons WHERE code = ?').get(code)) return res.status(409).json({ error: 'code_exists' });
  const info = db.prepare(
    `INSERT INTO coupons (code,kind,value,min_subtotal_cents,max_uses,per_user_limit,vendor_id,terms,applies_to,applies_value,stackable,expires_at,created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(code, String(b.kind || 'percent'), Number(b.value || 0), Number(b.min_subtotal_cents || 0),
    b.max_uses ? Number(b.max_uses) : null, Number(b.per_user_limit ?? 1), vid || null,
    String(b.terms || ''), String(b.applies_to || 'all'), b.applies_value ? String(b.applies_value) : null,
    b.stackable ? 1 : 0, b.expires_at ? Number(b.expires_at) : null, now());
  res.status(201).json({ coupon: db.prepare('SELECT * FROM coupons WHERE id = ?').get(info.lastInsertRowid) });
});

export default router;
