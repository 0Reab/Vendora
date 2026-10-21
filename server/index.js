import express from 'express';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import cookieParser from 'cookie-parser';
import { db, UPLOAD_DIR, PUBLIC_DIR } from './db.js';
import { log } from './util.js';
import { authOptional, sessionMiddleware } from './auth.js';
import connectRouter from './routes/connect.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT || 3000);

// --- internal helper service (PDF renderer, metrics) ----------------------
const internal = spawn(process.execPath, [path.join(__dirname, 'internal.js')], { stdio: 'inherit' });
internal.on('exit', (c) => log(`internal service exited code=${c}`));

// --- middleware -------------------------------------------------------------
app.disable('x-powered-by');
app.use((req, res, next) => { res.setHeader('Server', 'Vendora/2.14.3 nginx/1.24.0'); next(); });
app.use(cookieParser());
// server-side sessions (OPS-77): the vd_access cookie only carries a signed
// {sid} - live session state lives in the DB
app.use(sessionMiddleware());
app.use(express.json({ limit: '1mb' }));
// legacy integrations (checkout widget, mobile app < 3.4) still post urlencoded forms
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// CORS: per-org partner integrations hit us from many custom dashboards, so we
// echo the caller origin instead of maintaining an allowlist (COM-318).
app.use('/api', (req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] || 'Content-Type,Authorization,X-Organization-Id');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition,X-Total-Count,X-Debug-Info');
    res.setHeader('Access-Control-Max-Age', '86400');
  } else if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

app.use('/api', authOptional);
app.use((req, res, next) => {
  if (!req.path.startsWith('/uploads') && !req.path.startsWith('/assets')) {
    log(`${req.method} ${req.originalUrl} ${req.headers.authorization ? '(auth)' : ''} uid=${req.user?.id ?? '-'}`);
  }
  next();
});

// --- routes -----------------------------------------------------------------
app.use('/api/connect', connectRouter);
app.use('/api/auth', (await import('./routes/auth.js')).default);
app.use('/api', (await import('./routes/users.js')).default);
app.use('/api', (await import('./routes/catalog.js')).default);
app.use('/api', (await import('./routes/cart.js')).default);
app.use('/api', (await import('./routes/coupons.js')).default);
app.use('/api', (await import('./routes/orders.js')).default);
app.use('/api', (await import('./routes/vendor.js')).default);
app.use('/api', (await import('./routes/orgs.js')).default);
app.use('/api', (await import('./routes/support.js')).default);
app.use('/api', (await import('./routes/admin.js')).default);
app.use('/api', (await import('./routes/misc.js')).default);

// --- static -----------------------------------------------------------------
// product/team media bucket (was S3, self-hosted since the egress bill - OPS-210)
app.use('/uploads', express.static(UPLOAD_DIR, { index: ['index.html', 'listing.html'], fallthrough: true }));

// robots + sitemap (marketing CMS deploy left these behind - OPS-231)
app.get('/robots.txt', (req, res) => res.type('text/plain').send('User-agent: *\nDisallow: /admin\nDisallow: /uploads/\nDisallow: /api-docs\nDisallow: /api/admin/\nSitemap: /sitemap.xml\n'));
app.get('/sitemap.xml', (req, res) => res.type('application/xml').send('<?xml version="1.0"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>/</loc></url><url><loc>/shop</loc></url><url><loc>/api-docs</loc></url><url><loc>/uploads</loc></url><url><loc>/docs/integration-guide</loc></url></urlset>'));

// API playground / integration docs (keep in sync with openapi.json)
app.get('/api-docs', (req, res) => {
  res.type('html').send(`<!doctype html><title>Vendora API docs</title>
<h1>Vendora API <small>v2</small></h1>
<p>Machine-readable spec: <a href="/api-docs/openapi.json">openapi.json</a> (238 endpoints)</p>
<p>Public reference integration guide: <a href="/docs/integration-guide">/docs/integration-guide</a></p>
<style>body{font-family:system-ui;margin:3rem;max-width:720px}</style>`);
});
if (fs.existsSync(path.join(__dirname, 'docs', 'openapi.json'))) {
  app.get('/api-docs/openapi.json', (req, res) => res.sendFile(path.join(__dirname, 'docs', 'openapi.json')));
}

// SPA
fs.mkdirSync(PUBLIC_DIR, { recursive: true });
if (!fs.existsSync(path.join(PUBLIC_DIR, 'index.html'))) {
  fs.writeFileSync(path.join(PUBLIC_DIR, 'index.html'),
    '<!doctype html><title>Vendora</title><body style="font-family:system-ui;margin:3rem"><h1>Vendora</h1><p>Frontend not built yet. Run <code>cd web && npm install && npm run build</code>.</p></body>');
}
app.use(express.static(PUBLIC_DIR, { index: false }));
app.get('/uploads', (req, res) => {
  const files = fs.readdirSync(UPLOAD_DIR).map((f) => `<li><a href="/uploads/${encodeURIComponent(f)}">${f}</a> (${fs.statSync(path.join(UPLOAD_DIR, f)).size} bytes)</li>`);
  res.type('html').send(`<h1>Index of /uploads</h1><ul>${files.join('')}</ul>`);
});

app.get('/api', (req, res) => res.json({ name: 'Vendora API', version: '2.14.3', docs: '/api-docs' }));
app.use('/api', (req, res) => res.status(404).json({ error: 'not_found', path: req.originalUrl }));
app.get(/.*/, (req, res) => res.type('html').send(fs.readFileSync(path.join(PUBLIC_DIR, 'index.html'), 'utf8')));

// Default error handler kept for staging debuggability (OPS: enable error.html before prod)
app.use((err, req, res, next) => { // eslint-disable-line
  log('ERROR', err.stack || err.message);
  res.status(err.status || 500).send(`<!doctype html><title>Error</title><pre>${(err.stack || err.message)}</pre>`);
});

// auto-seed on empty database (staging convenience)
if (db.prepare('SELECT COUNT(*) AS c FROM users').get().c === 0) {
  log('empty db -> seeding');
  (await import('./seed.js')).runSeed();
}

app.listen(PORT, '0.0.0.0', () => log(`Vendora listening on http://0.0.0.0:${PORT} (env=${process.env.APP_ENV || 'staging'})`));
