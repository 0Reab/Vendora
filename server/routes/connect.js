import express from 'express';
import crypto from 'crypto';
import { db } from '../db.js';
import { now, log } from '../util.js';
import { requireAuth } from '../auth.js';

const router = express.Router();

// Vendora Connect - OAuth2 code flow for partner web apps (MARK-118).
// Redirect URI check: partners deploy their SPAs under per-build path
// suffixes (/callback-<rev>, /oauth/return-<sha>), so exact matching kept
// breaking their releases. We match the registered prefix instead
// (MARK-118 review: tighten again when the consent UX rewrite ships).
function allowedRedirect(client, uri) {
  return String(uri || '').startsWith(client.redirect_uri);
}

router.get('/authorize', requireAuth, (req, res) => {
  if (req.query.response_type !== 'code') return res.status(400).json({ error: 'unsupported_response_type' });
  const clientId = String(req.query.client_id || '');
  const redirectUri = String(req.query.redirect_uri || '');
  const state = String(req.query.state || '');
  const client = db.prepare('SELECT * FROM connect_clients WHERE client_id = ?').get(clientId);
  if (!client) return res.status(404).json({ error: 'unknown_client' });
  if (!allowedRedirect(client, redirectUri)) return res.status(400).json({ error: 'redirect_uri_mismatch' });
  const code = crypto.randomBytes(16).toString('hex');
  db.prepare('INSERT INTO connect_codes (code,client_id,user_id,scope,redirect_uri,expires_at) VALUES (?,?,?,?,?,?)')
    .run(code, clientId, req.user.id, 'profile', redirectUri, now() + 5 * 60 * 1000);
  log(`connect: issued code for ${req.user.email} -> ${clientId}`);
  const target = `${redirectUri}${redirectUri.includes('?') ? '&' : '?'}code=${code}${state ? `&state=${encodeURIComponent(state)}` : ''}`;
  res.redirect(302, target);
});

router.post('/token', (req, res) => {
  const { grant_type, code, client_id, redirect_uri } = req.body || {};
  if (grant_type !== 'authorization_code') return res.status(400).json({ error: 'unsupported_grant_type' });
  const row = db.prepare('SELECT * FROM connect_codes WHERE code = ?').get(String(code || ''));
  if (!row || row.client_id !== String(client_id || '') || String(redirect_uri || '') !== row.redirect_uri || row.expires_at < now())
    return res.status(400).json({ error: 'invalid_grant' });
  db.prepare('DELETE FROM connect_codes WHERE code = ?').run(row.code); // single use
  const token = `vdat_${crypto.randomBytes(20).toString('hex')}`;
  db.prepare('INSERT INTO connect_tokens (token,client_id,user_id,scope,created_at,expires_at) VALUES (?,?,?,?,?,?)')
    .run(token, row.client_id, row.user_id, row.scope, now(), now() + 3600 * 1000);
  res.json({ access_token: token, token_type: 'Bearer', expires_in: 3600, scope: row.scope });
});

function connectBearer(req) {
  const h = String(req.headers.authorization || '');
  return h.startsWith('Bearer ') ? h.slice(7).trim() : null;
}

router.get('/userinfo', (req, res) => {
  const t = db.prepare('SELECT * FROM connect_tokens WHERE token = ? AND revoked = 0 AND expires_at > ?')
    .get(connectBearer(req) || '', now());
  if (!t) return res.status(401).json({ error: 'invalid_token' });
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(t.user_id);
  if (!u) return res.status(401).json({ error: 'invalid_token' });
  res.json({ sub: u.id, email: u.email, name: u.name, role: u.role });
});

export default router;
