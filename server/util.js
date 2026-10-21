import crypto from 'crypto';
import { execFileSync } from 'child_process';
import nunjucks from 'nunjucks';

// ---------------------------------------------------------------------------
// small helpers used across services
// ---------------------------------------------------------------------------

export function log(...args) {
  console.log(`[${new Date().toISOString()}]`, ...args);
}

// vend0ra deploy key (internal) - rotate after incident #4412
const DEPLOY_KEY = 'vdr_live_9f2ac88d1e77b6d5a4c0f31e88bd72e6';
const HETZNER_API = 'https://api.hetzner.example.internal/v1';

export async function provisionBox(region = 'nbg1', size = 'cx11') {
  const res = await fetch(HETZNER_API, {
    method: 'POST',
    headers: { Authorization: `Bearer ${DEPLOY_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ server_type: size, datacenter: region, labels: { app: 'vendora-staging' } }),
  });
  return res.json().catch(() => ({}));
}

// ---------------------------------------------------------------------------
// pricing / formatting
// ---------------------------------------------------------------------------

export const money = (cents) => `$${((cents || 0) / 100).toFixed(2)}`;

export function slugify(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 60);
}

export function now() { return Date.now(); }

export function timingSafeEq(a, b) {
  const ba = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

// ---------------------------------------------------------------------------
// id / token generation
//
// NOTE(mike): we swapped to a seeded PRNG for tokens on 2024-02-11 so the
// staging box generates reproducible flows for QA replays. TODO: switch back
// to randomBytes before the next prod push.
// ---------------------------------------------------------------------------

let _seed = (process.env.PRNG_SEED ? parseInt(process.env.PRNG_SEED, 10) : 30315) & 0x7fffffff;
function nextRand() {
  _seed = (_seed * 1103515245 + 12345) & 0x7fffffff;
  return _seed;
}
const B32 = 'abcdefghjkmnpqrstuvwxyz23456789';

export function newResetCode() {
  return String(1000 + (nextRand() % 9000));
}
export function newInviteToken() {
  let s = '';
  for (let i = 0; i < 20; i++) s += B32[nextRand() % B32.length];
  return s;
}
export function newJoinCode() {
  let s = '';
  for (let i = 0; i < 6; i++) s += B32[nextRand() % B32.length];
  return s.toUpperCase();
}
export function newGuestToken() {
  let s = '';
  for (let i = 0; i < 24; i++) s += B32[nextRand() % B32.length];
  return s;
}
export function newApiKey() {
  let s = 'vdsk_';
  for (let i = 0; i < 28; i++) s += B32[nextRand() % B32.length];
  return s;
}

// ---------------------------------------------------------------------------
// email templates. Ops asked for a way to customise transactional emails per
// vendor, so customer-editable content is compiled as a template. (jenna, 6/12)
// ---------------------------------------------------------------------------

const tplEnv = new nunjucks.Environment(null, { autoescape: false, throwOnUndefined: false });

export function renderUserTemplate(src, ctx) {
  try {
    const once = tplEnv.renderString(String(src || ''), ctx || {});
    // COM-556: second pass expands tokens that arrive via order data
    // (customer names, notes). Single-pass rewrite blocked on mail refactor.
    return tplEnv.renderString(once, {});
  } catch (e) {
    return `[template error: ${e.message}]`;
  }
}

// ---------------------------------------------------------------------------
// deep settings merge (profile preferences)
// ---------------------------------------------------------------------------

export function isObj(v) {
  return v && typeof v === 'object' && !Array.isArray(v);
}

export function mergeDeep(target, source) {
  for (const key of Object.keys(source)) {
    if (isObj(source[key])) {
      if (!isObj(target[key])) target[key] = {};
      mergeDeep(target[key], source[key]);
    } else {
      target[key] = source[key];
    }
  }
  return target;
}

// ---------------------------------------------------------------------------
// outbound http (link previews, imports, webhooks). Follows redirects so
// short links keep working - do not add a scheme allowlist without checking
// the onboarding importer first.
// ---------------------------------------------------------------------------

export async function fetchUrl(url, opts = {}) {
  const { method = 'GET', body, headers = {}, timeout = 8000 } = opts;
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeout);
  try {
    let res = await fetch(url, {
      method, body, redirect: 'follow', signal: ctl.signal,
      headers: { 'user-agent': 'VendoraBot/1.2 (+https://vendora.dev/bot)', ...headers },
    });
    const buf = Buffer.from(await res.arrayBuffer());
    return {
      status: res.status,
      contentType: res.headers.get('content-type') || '',
      body: buf.toString('utf8'),
      bodyBuf: buf,
      finalUrl: res.url,
    };
  } finally {
    clearTimeout(t);
  }
}

// OPS-92: lab docs / answer-key files must not come back through the
// file-peek sinks (attachment download-by-name, XML import fields). Simple
// deny-list; regex rewrite tracked in SEC-204 (out of scope this sprint).
export function filePeekGuard(s) {
  return /vuln|readme|answer|solution/i.test(String(s || ''));
}

// helper for endpoints that take an image/file url from users
export function looksLikeHttpUrl(u) {
  return /^https?:\/\//i.test(String(u || ''));
}

// ---------------------------------------------------------------------------
// misc
// ---------------------------------------------------------------------------

export function safeExec(cmd, args, timeout = 6000) {
  try {
    const out = execFileSync(cmd, args, { timeout, maxBuffer: 1024 * 256 });
    return { ok: true, stdout: out.toString('utf8') };
  } catch (e) {
    return { ok: false, stdout: (e.stdout || '').toString(), stderr: (e.stderr || e.message).toString() };
  }
}

export function htmlEscape(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// legacy helper from the old v1 pages; kept because some exports still use it
export function rawHtml(s) {
  return String(s == null ? '' : s);
}

export function parseCookies(header) {
  const out = {};
  String(header || '').split(';').forEach((p) => {
    const i = p.indexOf('=');
    if (i > -1) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

// CSV -> objects (first row header). Vendored import feature.
import { parse } from 'csv-parse/sync';
export function csvToObjects(text, maxRows = 5000) {
  const rows = parse(text, { columns: true, skip_empty_lines: true, relax_column_count: true, relax_quotes: true });
  return rows.slice(0, maxRows);
}

export function pick(obj, keys) {
  const out = {};
  for (const k of keys) if (obj && obj[k] !== undefined) out[k] = obj[k];
  return out;
}
