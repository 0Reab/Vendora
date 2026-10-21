import { db, UPLOAD_DIR } from './db.js';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { sha256 } from './auth.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let _s = 20241003;
const rnd = () => { _s = (_s * 1103515245 + 12345) & 0x7fffffff; return _s / 0x7fffffff; };
const rint = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const ago = (days) => Date.now() - days * 86400000;

export function runSeed() {
  if (db.prepare('SELECT COUNT(*) c FROM users').get().c > 0) return;
  console.log('[seed] creating vendora dataset...');

  // ---------- users ----------
  const mk = (email, name, pw, role, extra = {}) => db.prepare(
    `INSERT INTO users (email,name,password,role,is_vendor,wallet_cents,phone,bio,job_title,company,email_verified,created_at,bio_prefs)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`
  ).run(email, name, bcrypt.hashSync(pw, 6), role, extra.is_vendor || 0, extra.wallet || 0, extra.phone || null,
    extra.bio || null, extra.job || null, extra.company || null, 1, ago(extra.days ?? 400), '{}');

  mk('admin@vendora.io', 'Priya Raman', 'Admin!2024Lab', 'admin', { job: 'Platform Admin', company: 'Vendora', days: 700 });
  mk('ops@vendora.io', 'Marcus Webb', 'Ops!2024Lab', 'admin', { job: 'SRE', company: 'Vendora', days: 650 });
  mk('support@vendora.io', 'Dana Fox', 'Support!2024Lab', 'admin', { job: 'Support Lead', company: 'Vendora', days: 500 });
  mk('ada@acme.dev', 'Ada Whitfield', 'Buyer!2024', 'user', { job: 'Head of Procurement', company: 'Acme Studios', wallet: 24500, days: 430 });
  mk('sam@acme.dev', 'Sam Ortiz', 'Member!2024', 'user', { job: 'Ops Manager', company: 'Acme Studios', days: 420 });
  mk('bruce@acme.dev', 'Bruce Lang', 'Member!2024', 'user', { job: 'Studio Technician', company: 'Acme Studios', days: 300 });
  mk('jonas@globex.dev', 'Jonas Meyer', 'Vendor!2024', 'user', { job: 'Owner', company: 'Globex Supply', days: 500 });
  mk('rita@globex.dev', 'Rita Alves', 'Member!2024', 'user', { job: 'Account Exec', company: 'Globex Supply', days: 260 });
  mk('kenji@northloop.co', 'Kenji Sato', 'Member!2024', 'user', { job: 'Freelance DP', company: 'Northloop', days: 180 });
  mk('lena@northloop.co', 'Lena Prosser', 'Member!2024', 'user', { job: 'Producer', company: 'Northloop', days: 175 });
  mk('victim2@fastmail.test', 'Casey Nolan', 'Victim!2024', 'user', { days: 90, phone: '555-0142' });
  mk('mia@example.com', 'Mia Tran', 'Member!2024', 'user', { days: 120 });
  mk('theo@example.com', 'Theo Brandt', 'Member!2024', 'user', { days: 140, wallet: 1200 });
  mk('sofia@example.com', 'Sofia Marin', 'Member!2024', 'user', { days: 200 });
  mk('devon@example.com', 'Devon Cole', 'Member!2024', 'user', { days: 60 });
  mk('hanna@example.com', 'Hanna Wise', 'Member!2024', 'user', { days: 30 });

  // ---------- vendors ----------
  const vendorDefs = [
    ['Globex Supply', 'globex-supply', 'Studio lighting, grip and power distribution since 1998.', 'DE89 3704 0044 0532 0130 00', 4.6, 7],
    ['Acme Rentals', 'acme-rentals', 'Camera bodies, lenses and support rigs. Next-day metro delivery.', 'US12 3349 0021 0987 6543', 4.8, 4],
    ['Northloop Audio', 'northloop-audio', 'Wireless mic systems, mixers and field kits.', 'GB29 NWBK 6016 1331 9268 19', 4.4, 9],
    ['Blue Harbor Media', 'blue-harbor-media', 'Backdrops, stands, cases and consumables.', 'FR76 3000 6000 0112 3456 7890 189', 4.2, 12],
    ['Cedarline Optics', 'cedarline-optics', 'Prime and anamorphic lens specialist.', 'DE89 3704 0044 0532 0139 99', 4.9, 7],
    ['Vantage Grids', 'vantage-grids', 'Ceiling grids, truss and safety.', 'US12 3349 0021 0987 6540', 4.1, 14],
    ['Halcyon Power', 'halcyon-power', 'Batteries, distro and cabling.', 'GB29 NWBK 6016 1331 9268 77', 4.5, 10],
    ['Pinecrest Frames', 'pinecrest-frames', 'Support, sliders and jibs.', 'FR76 3000 6000 0112 3456 7890 222', 4.3, 11],
    ['Solstice Grip', 'solstice-grip', 'Grip consumables and flags.', 'US12 3349 0021 0987 6541', 4.0, 15],
    ['Ridgeway Cases', 'ridgeway-cases', 'ATA cases and travel kit.', 'DE89 3704 0044 0532 0130 11', 4.7, 8],
    ['Fairmont Print', 'fairmont-print', 'Marks, labels and set dressing.', 'GB29 NWBK 6016 1331 9268 33', 3.9, 16],
    ['Talon Studio Gear', 'talon-studio-gear', 'Everything else, sourced on request.', 'US12 3349 0021 0987 6542', 4.4, 13],
    ['Wexler Drone Unit', 'wexler-drone-unit', 'Licensed aerial cinematography kits.', 'FR76 3000 6000 0112 3456 7890 444', 4.6, 17],
    ['Copperfield Stages', 'copperfield-stages', 'Soundstage bookings and flats.', 'US12 3349 0021 0987 6544', 4.5, 2],
    ['Juniper Safety Co', 'juniper-safety-co', 'Harnesses, spotters and safety audits.', 'DE89 3704 0044 0532 0130 22', 4.8, 5],
  ];
  const ownerForVendor = [7, 4, 8, 12, 13, 14, 15, 16, 5, 6, 11, 10, 13, 14, 15];
  for (let i = 0; i < vendorDefs.length; i++) {
    const [name, handle, bio, bank, rating, vdays] = vendorDefs[i];
    const info = db.prepare('INSERT INTO vendors (owner_id,name,handle,bio,payout_bank,rating,created_at) VALUES (?,?,?,?,?,?,?)')
      .run(ownerForVendor[i], name, handle, bio, bank, rating, ago(vdays * 30));
    if (!db.prepare('SELECT 1 FROM users WHERE id = ?').get(ownerForVendor[i]).vendor_id) {
      db.prepare('UPDATE users SET is_vendor = 1, vendor_id = ? WHERE id = ?').run(info.lastInsertRowid, ownerForVendor[i]);
    }
  }

  // ---------- categories ----------
  const cats = ['Lighting', 'Cameras', 'Grip & Support', 'Audio', 'Power & Cabling', 'Optics', 'Cases & Travel', 'Safety'];
  const subs = {
    'Lighting': ['LED Panels', 'Tungsten', 'Practicals', 'Modifiers'],
    'Cameras': ['Bodies', 'Rigs & Mattebox', 'Monitors'],
    'Grip & Support': ['Stands', 'Sliders & Jibs', 'Flags & Nets'],
    'Audio': ['Wireless Kits', 'Mixers', 'Microphones'],
    'Power & Cabling': ['Batteries', 'Distro', 'Cable Sets'],
    'Optics': ['Prime Lenses', 'Zoom Lenses', 'Anamorphic'],
    'Cases & Travel': ['ATA Cases', 'Soft Rolls'],
    'Safety': ['Harnesses', 'Spotters'],
  };
  for (const c of cats) db.prepare('INSERT INTO categories (name) VALUES (?)').run(c);
  const catId = (n) => db.prepare('SELECT id FROM categories WHERE name = ?').get(n).id;
  for (const [p, list] of Object.entries(subs)) for (const s of list) db.prepare('INSERT INTO categories (name,parent_id) VALUES (?,?)').run(s, catId(p));

  // ---------- products ----------
  const adj = ['Pro', 'Studio', 'Compact', 'Ultra', 'Mini', 'Max', '2.0', 'XS', 'Air', 'Classic', 'Field', 'Elite', 'Xtreme', 'Nano', 'Signature'];
  const nouns = {
    'Lighting': ['Panel Kit', 'Fresnel 650W', 'Spot Tube', 'Softbox Set', 'Ring Light', 'Practical Bulb Kit', 'Sky Panel', 'Bar Light'],
    'Cameras': ['Body Kit', 'Cage Rig', 'Mattebox', 'Field Monitor 7"', 'Follow Focus', 'Viewfinder', 'Card Reader'],
    'Grip & Support': ['C-Stand Kit', 'Slider 1m', 'Jib Arm', 'Flag Set', 'Sandbag Pair', 'Baby Pin Set', 'Boom Pole'],
    'Audio': ['Wireless Lav Kit', 'Shotgun Mic', 'Mixer 8ch', 'Boom Kit', 'Recorder', 'Windjammer Set'],
    'Power & Cabling': ['Battery Plate Kit', 'Distro Box', 'Cable Set 25m', 'V-Mount Pair', 'Extension Reel'],
    'Optics': ['Prime 35mm', 'Prime 50mm', 'Zoom 24-70', 'Anamorphic 40mm', 'Macro Set', 'T2.9 Prime Set'],
    'Cases & Travel': ['ATA Case L', 'ATA Case M', 'Soft Roll 48in', 'Lens Pouch Set', 'Hard Top Case'],
    'Safety': ['Harness Kit', 'Spotter Pack', 'Fall Arrest Set', 'Fire Blanket'],
  };
  const imgSeed = { 'Lighting': 101, 'Cameras': 180, 'Grip & Support': 225, 'Audio': 26, 'Power & Cabling': 0, 'Optics': 160, 'Cases & Travel': 301, 'Safety': 342 };
  let pcount = 0;
  for (const cat of cats) {
    for (let i = 0; i < 20; i++) {
      const vendorId = rint(1, vendorDefs.length);
      const name = `${pick(nouns[cat])} ${pick(adj)}`;
      const base = cat === 'Cameras' ? rint(90000, 420000) : cat === 'Optics' ? rint(60000, 900000) : rint(2500, 85000);
      const stock = rint(0, 40);
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 50) + '-' + (pcount + 1);
      db.prepare(
        `INSERT INTO products (vendor_id,name,slug,description,price_cents,compare_at_cents,stock,category,sku,image,tags,popularity_score,created_at,updated_at)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
      ).run(vendorId, name, slug,
        `${name} from our ${cat.toLowerCase()} range. Rugged build, quick-release interface, works with all common rigging. Daily-rental friendly. SKU verified.`,
        base, rnd() < 0.4 ? Math.round(base * (1 + 0.1 + rnd() * 0.3)) : null, stock, cat,
        `SKU-${1000 + pcount}`, `https://picsum.photos/seed/vdr${imgSeed[cat] + i}/640/480`,
        `${cat.toLowerCase()},${pick(['rental', 'bestseller', 'new', 'clearance', 'pro'])}`, rnd() * 500,
        ago(rint(5, 500)), ago(rint(1, 120)));
      pcount++;
    }
  }
  seedRest(pcount);
  console.log(`[seed] users=${db.prepare('SELECT COUNT(*) c FROM users').get().c} vendors=${db.prepare('SELECT COUNT(*) c FROM vendors').get().c} products=${pcount} orders=${db.prepare('SELECT COUNT(*) c FROM orders').get().c}`);
}

function seedRest(pcount) {

  // ---------- coupons ----------
  const cpns = [
    ['WELCOME10', 'percent', 10, 5000, 500, 1, null, '10% off first order', 'all', null, 0],
    ['TEAMTREAT', 'percent', 15, 20000, 50, 1, null, '15% for teams over $200', 'all', null, 0],
    ['GLOBEX25', 'fixed', 2500, 15000, null, 1, 7, 'Globex Supply only', 'vendor', '7', 1],
    ['FREESHIP', 'free_ship', 0, 10000, null, 1, null, 'free standard shipping', 'all', null, 1],
    ['B2B50', 'fixed', 5000, 50000, null, 10, null, '$50 off large orders', 'all', null, 1],
    ['LENTOPTICS', 'percent', 20, 30000, null, 1, 5, 'Cedarline Optics spring promo', 'vendor', '5', 0],
    ['FLASH7', 'percent', 7, 0, null, 3, null, 'weekend flash', 'all', null, 1],
    ['ACME5', 'fixed', 500, 0, null, 4, 4, 'Acme Studios partner code', 'vendor', '4', 1],
    ['CLEAR15', 'percent', 15, 0, null, 2, null, 'clearance items', 'category', 'Cases & Travel', 0],
    ['STAFFBAG', 'fixed', 1000, 2000, null, 1, null, 'community perk', 'all', null, 0],
  ];
  for (const [code, kind, value, min, maxUses, perUser, vid, terms, appliesTo, appliesVal, stack] of cpns) {
    db.prepare(`INSERT INTO coupons (code,kind,value,min_subtotal_cents,max_uses,per_user_limit,vendor_id,terms,applies_to,applies_value,stackable,used,expires_at,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
      .run(code, kind, value, min, maxUses, perUser, vid, terms, appliesTo, appliesVal, stack, rint(0, 30),
        rnd() < 0.3 ? ago(-rint(5, 40)) : null, ago(rint(30, 300)));
  }

  // ---------- orders ----------
  const buyers = [4, 5, 6, 9, 10, 11, 12, 13, 14, 15, 16];
  const methods = ['normal', 'express', 'pickup'];
  const statuses = [['delivered', 'paid', 60], ['shipped', 'paid', 25], ['placed', 'paid', 10], ['cancelled', 'refunded', 4], ['refunded', 'paid', 1]];
  let oid = 0;
  for (let i = 0; i < 90; i++) {
    const u = pick(buyers);
    const days = rint(1, 360);
    const st = (() => { const r = rnd() * 100; let acc = 0; for (const [s, p, w] of statuses) { acc += w; if (r < acc) return { s, p }; } return { s: 'delivered', p: 'paid' }; })();
    const nItems = rint(1, 4);
    let subtotal = 0;
    const items = [];
    for (let k = 0; k < nItems; k++) {
      const p = db.prepare('SELECT * FROM products WHERE id = ?').get(rint(1, pcount));
      const qty = rnd() < 0.85 ? rint(1, 3) : rint(4, 20);
      subtotal += p.price_cents * qty;
      items.push({ p, qty });
    }
    const discount = rnd() < 0.25 ? Math.round(subtotal * pick([0.1, 0.15, 0.07]) / 1) : 0;
    const shipping = pick([0, 500, 500, 1500]);
    const tax = Math.round((subtotal - discount) * 0.0825);
    const total = Math.max(0, subtotal - discount) + shipping + tax;
    const couponUsed = discount > 0 ? pick(['WELCOME10', 'TEAMTREAT', 'FLASH7']) : null;
    const ref = 'pay_' + Math.floor(rnd() * 1e16).toString(16).padStart(16, '0');
    const info = db.prepare(
      `INSERT INTO orders (user_id,status,payment_status,payment_ref,subtotal_cents,discount_cents,shipping_cents,tax_cents,total_cents,coupon_code,
        ship_name,ship_address1,ship_city,ship_country,ship_method,created_at,updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).run(u, st.s, st.p, ref, subtotal, discount, shipping, tax, total, couponUsed,
      db.prepare('SELECT name FROM users WHERE id = ?').get(u).name,
      `${rint(10, 9990)} ${pick(['Sunset', 'Sunset', 'Maple', 'Harbor', 'Kingsway', 'Old Mill', 'River'])} ${pick(['Blvd', 'St', 'Ave', 'Rd'])}`,
      pick(['Los Angeles', 'Brooklyn', 'Vancouver', 'Austin', 'Chicago', 'Portland']), 'US', pick(methods),
      ago(days), ago(Math.max(0, days - rint(0, 3))));
    oid = info.lastInsertRowid;
    for (const it of items) {
      db.prepare('INSERT INTO order_items (order_id, product_id, product_name, vendor_id, qty, unit_price_cents) VALUES (?,?,?,?,?,?)')
        .run(oid, it.p.id, it.p.name, it.p.vendor_id, it.qty, it.p.price_cents);
    }
    db.prepare('INSERT INTO payments (order_id, amount_cents, method, ref, status, created_at) VALUES (?,?,?,?,?,?)')
      .run(oid, total, pick(['card', 'card', 'wallet', 'po']), ref, 'captured', ago(days));
    if (couponUsed) db.prepare('INSERT INTO coupon_redemptions (coupon_id, user_id, order_id, created_at) SELECT id,?,?,? FROM coupons WHERE code = ?').run(u, oid, ago(days), couponUsed);
  }

  // ---------- reviews ----------
  const words = ['great', 'solid', 'fast shipping', 'balanced', 'a bit loud', 'loved it', 'flimsy latch', 'pro-grade', 'value for money', 'arrived dinged'];
  const names = ['ada', 'sam', 'kenji', 'lena', 'theo', 'sofia', 'devon', 'hanna', 'mia', 'bruce'];
  let rc = 0;
  for (let i = 0; i < 320; i++) {
    const pid = rint(1, pcount);
    db.prepare('INSERT INTO reviews (product_id,user_id,rating,title,body,status,created_at) VALUES (?,?,?,?,?,?,?)')
      .run(pid, rint(4, 16), rint(2, 5),
        `${pick(words)} ${pick(['kit', 'unit', 'setup', 'pair', 'lens'])}`,
        `${pick(words).toUpperCase()}. ${pick(['Used it on two shoots last month.', 'Rental house will keep this.', 'Held up fine under rain.', 'Latch feels cheap but works.', 'Support answer came in a day.', 'Color matched our existing kit.', 'Would rent again.'])}`,
        rnd() < 0.92 ? 'published' : 'hidden', ago(rint(1, 300)));
    rc++;
  }
  for (let pid = 1; pid <= pcount; pid++) {
    db.prepare('UPDATE products SET rating_cache = (SELECT AVG(rating) FROM reviews WHERE product_id = ?) WHERE id = ?').run(pid, pid);
  }

  // ---------- orgs ----------
  const orgDefs = [
    ['Acme Studios', 'ada@acme.dev', 'enterprise', 'film production', 'private', 4, 400, 'ACME77'],
    ['Globex Supply Team', 'jonas@globex.dev', 'business', 'distribution', 'private', 7, 380, 'GLBX11'],
    ['Northloop Films', 'lena@northloop.co', 'business', 'film production', 'public', 10, 170, 'NTH205'],
    ['RentalUser Org', 'sofia@example.com', 'free', 'freelance', 'public', 14, 95, 'RENT42'],
    ['Vendora Staff', 'ops@vendora.io', 'enterprise', 'platform', 'private', 2, 650, 'STAFF1'],
  ];
  const orgIdByName = {};
  for (const [name, email, plan, industry, vis, owner, days, code] of orgDefs) {
    const info = db.prepare('INSERT INTO orgs (name,join_code,billing_email,plan,industry,visibility,created_by,created_at) VALUES (?,?,?,?,?,?,?,?)')
      .run(name, code, email, plan, industry, vis, owner, ago(days));
    orgIdByName[name] = info.lastInsertRowid;
    db.prepare('INSERT INTO org_members (org_id,user_id,role,joined_at) VALUES (?,?,?,?)').run(info.lastInsertRowid, owner, 'owner', ago(days));
  }
  const O = (n) => orgIdByName[n];
  const uid = (email) => db.prepare('SELECT id FROM users WHERE email = ?').get(email).id;
  const addMember = (org, email, role) =>
    db.prepare('INSERT OR IGNORE INTO org_members (org_id,user_id,role,joined_at) VALUES (?,?,?,?)').run(O(org), uid(email), role, ago(rint(10, 300)));
  addMember('Acme Studios', 'sam@acme.dev', 'admin');
  addMember('Acme Studios', 'bruce@acme.dev', 'member');
  addMember('Acme Studios', 'kenji@northloop.co', 'member');
  addMember('Globex Supply Team', 'rita@globex.dev', 'admin');
  addMember('Globex Supply Team', 'ada@acme.dev', 'member');
  addMember('Northloop Films', 'kenji@northloop.co', 'admin');
  addMember('Northloop Films', 'sofia@example.com', 'member');
  addMember('RentalUser Org', 'theo@example.com', 'member');
  addMember('RentalUser Org', 'hanna@example.com', 'member');
  addMember('RentalUser Org', 'devon@example.com', 'member');
  addMember('RentalUser Org', 'mia@example.com', 'member');
  addMember('Vendora Staff', 'admin@vendora.io', 'admin');
  addMember('Vendora Staff', 'support@vendora.io', 'admin');

  db.prepare('INSERT INTO org_invites (org_id,email,role,token,status,created_by,created_at,expires_at) VALUES (?,?,?,?,?,?,?,?)')
    .run(O('Acme Studios'), 'newhire@acme.dev', 'member', 'invivx6d9tq3wk5m2c8fhp', 'pending', uid('ada@acme.dev'), ago(20), Date.now() + 4 * 86400000);
  db.prepare('INSERT INTO org_invites (org_id,email,role,token,status,created_by,created_at,expires_at) VALUES (?,?,?,?,?,?,?,?)')
    .run(O('Globex Supply Team'), 'buyer@acme.dev', 'admin', 'invw2c7nk9qt8zx4vh6mj', 'pending', uid('jonas@globex.dev'), ago(12), Date.now() + 6 * 86400000);

  // ---------- projects / tasks / comments ----------
  const projDefs = [
    ['Acme Studios', 'Spring Shoot Package', 'Kit list + insurance paperwork for the spring series', '2026-11-20', 'org'],
    ['Acme Studios', 'Gear Refresh Q4', 'Swap aging lighting for LED', '2026-12-10', 'org'],
    ['Acme Studios', 'Vendor Negotiations', 'Renewals with Globex and Halcyon', null, 'org'],
    ['Globex Supply Team', 'Wholesale Portal Rollout', 'B2B pricing page launch', '2026-11-01', 'org'],
    ['Northloop Films', 'Northloop Doc Shoot', 'Field kit for the harbor documentary', '2026-10-30', 'public'],
    ['RentalUser Org', 'Client Workshop', 'One-day gear workshop for clients', null, 'public'],
    ['Vendora Staff', 'Q4 Platform Audit', 'Internal security review of staging', '2026-11-15', 'org'],
  ];
  for (const [org, name, desc, due, vis] of projDefs) {
    const ownerRow = db.prepare('SELECT user_id FROM org_members WHERE org_id = ? AND role = ?').get(O(org), 'owner');
    db.prepare('INSERT INTO projects (org_id,name,description,status,due_date,visibility,created_by,created_at,updated) VALUES (?,?,?,?,?,?,?,?,?)')
      .run(O(org), name, desc, 'active', due, vis, ownerRow.user_id, ago(rint(20, 120)), Date.now() - rint(1, 10) * 86400000);
  }
  const taskTitles = ['confirm insurance certificates', 'book stage for tuesday', 'get quote from halcyon', 'replace missing latch on case 12', 'update kit list doc', 'schedule maintenance window', 'wireframe pricing page', 'collect serial numbers', 'order consumables', 'draft renewal email', 'check harness recall notice', 'plan load-in logistics', 'verify safety certs', 'label all cases', 'backup footage cards', 'return overdue lenses', 'test wireless in harbor zone', 'budget sign-off', 'insurance rider for drones', 'final walkthrough'];
  for (let i = 0; i < 34; i++) {
    const proj = db.prepare('SELECT * FROM projects WHERE id = ?').get(rint(1, projDefs.length));
    const memberRow = db.prepare('SELECT user_id FROM org_members WHERE org_id = ?').get(proj.org_id);
    const assignee = memberRow ? memberRow.user_id : null;
    const info = db.prepare('INSERT INTO tasks (project_id,org_id,title,notes,assignee_id,status,priority,due_date,created_by,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .run(proj.id, proj.org_id, taskTitles[i % taskTitles.length],
        rnd() < 0.5 ? pick(['blocked on vendor reply', 'needs a second signature', 'recurring task', 'linked to PO-2291', '']) : '',
        assignee, pick(['todo', 'doing', 'done', 'todo', 'doing']), rint(1, 5),
        rnd() < 0.6 ? `2026-1${rint(0, 1)}-${String(rint(1, 28)).padStart(2, '0')}` : '',
        assignee, Date.now() - rint(2, 90) * 86400000);
    if (rnd() < 0.5 && assignee) {
      db.prepare('INSERT INTO comments (task_id,user_id,body,created_at) VALUES (?,?,?,?)')
        .run(info.lastInsertRowid, assignee,
          pick(['pushed to friday', 'waiting on vendor, will chase', 'done, see the doc', 'cc team lead', 'can someone verify serial numbers?']),
          Date.now() - rint(1, 40) * 86400000);
    }
  }

  // ---------- links, feed, webhooks ----------
  db.prepare('INSERT INTO links (org_id,project_id,url,title,description,image,created_by,created_at) VALUES (?,?,?,?,?,?,?,?)')
    .run(O('Acme Studios'), null, 'https://vendora.dev/docs/integration-guide', 'Vendora integration guide', 'API quickstart and sandbox notes', null, uid('ada@acme.dev'), Date.now() - 9 * 86400000);
  db.prepare('INSERT INTO feed (org_id,actor_id,kind,text,created_at) VALUES (?,?,?,?,?)')
    .run(O('Acme Studios'), uid('sam@acme.dev'), 'upload', 'Sam uploaded <a href="/api/attachments/download?name=spring-kit-list.csv">spring-kit-list.csv</a>', Date.now() - 6 * 86400000);
  db.prepare('INSERT INTO webhooks (org_id,url,events,secret,active,created_by,last_status) VALUES (?,?,?,?,?,?,?)')
    .run(O('Acme Studios'), 'https://acme.internal.example/orders-hook', 'order.created,order.refunded', 'whsec_9d7c1f2a8b3e', 1, uid('ada@acme.dev'), 'ok');
  db.prepare('INSERT INTO webhooks (org_id,url,events,secret,active,created_by,last_status) VALUES (?,?,?,?,?,?,?)')
    .run(O('Globex Supply Team'), 'https://hooks.globex.example/vendora', 'order.created', 'whsec_55a1c0de99', 1, uid('jonas@globex.dev'), 'ok');

  // ---------- attachments on disk ----------
  const attDir = path.join(UPLOAD_DIR, 'attachments');
  fs.mkdirSync(attDir, { recursive: true });
  fs.writeFileSync(path.join(attDir, 'spring-kit-list.csv'), 'item,vendor,qty\nC-Stand Kit,Globex,8\nLED Panel,Acme,12\n');
  fs.writeFileSync(path.join(attDir, 'insurance-cert-2026.pdf'), '%PDF-1.4 (sample certificate, staging only)\n%%EOF\n');
  db.prepare('INSERT INTO attachments (org_id,project_id,uploader_id,orig_name,stored_name,size,mime,created_at) VALUES (?,?,?,?,?,?,?,?)')
    .run(O('Acme Studios'), null, uid('sam@acme.dev'), 'spring-kit-list.csv', 'spring-kit-list.csv', 62, 'text/csv', Date.now() - 6 * 86400000);
  db.prepare('INSERT INTO attachments (org_id,project_id,uploader_id,orig_name,stored_name,size,mime,created_at) VALUES (?,?,?,?,?,?,?,?)')
    .run(O('Acme Studios'), null, uid('ada@acme.dev'), 'insurance-cert-2026.pdf', 'insurance-cert-2026.pdf', 55, 'application/pdf', Date.now() - 20 * 86400000);

  // ---------- tickets ----------
  const tdefs = [
    [11, null, 'Login loop after password change', 3, 'open'],
    [13, null, 'Refund not credited for order of last week', 2, 'open'],
    [5, null, 'Add bruce@acme.dev to billing? No, wrong org', 3, 'closed'],
    [12, null, 'Case arrived with cracked latch (VDR order)', 1, 'pending'],
  ];
  for (const [u, org, subj, pr, st] of tdefs) {
    const info = db.prepare('INSERT INTO tickets (user_id,org_id,subject,status,priority,order_ref,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?)')
      .run(u, org, subj, st, pr, '', ago(rint(3, 30)), ago(rint(1, 3)));
    db.prepare('INSERT INTO ticket_messages (ticket_id,user_id,is_agent,body,created_at) VALUES (?,?,?,?,?)')
      .run(info.lastInsertRowid, u, 0, pick([
        'It keeps happening on Safari and Chrome. Screenshot attached (not really).',
        'Order number is in my history, money still not back.',
        'Please just add him, thanks.',
        'Opening it the same day it shipped. Replacement?',
      ]), ago(rint(3, 29)));
    if (st !== 'open') db.prepare('INSERT INTO ticket_messages (ticket_id,user_id,is_agent,body,created_at) VALUES (?,?,?,?,?)')
      .run(info.lastInsertRowid, 3, 1, 'Thanks - a specialist is on it, we will follow up by email.', ago(rint(1, 2)));
  }

  // ---------- email templates ----------
  for (let v = 1; v <= 4; v++) {
    db.prepare('INSERT INTO email_templates (vendor_id,key,name,subject,body,updated_at) VALUES (?,?,?,?,?,?)')
      .run(v, 'receipt', 'receipt', '{{ vendor }} receipt for order #{{ order_id }}',
        'Hi {{ customer }}, thanks for your order. Total {{ total }}. Items: {{ items }}. Questions? {{ email }}', ago(40));
  }
  db.prepare('INSERT INTO email_templates (vendor_id,key,name,subject,body,updated_at) VALUES (?,?,?,?,?,?)')
    .run(1, 'shipping', 'shipping', 'Your Globex order #{{ order_id }} shipped', 'Track it: {{ vendor }} order {{ order_id }} for {{ customer }}.', ago(20));

  // ---------- settings / newsletter / notifications ----------
  db.prepare('INSERT INTO settings (key,value,updated_at) VALUES (?,?,?)').run('announcement_bar', 'Spring catalog refresh live \u2014 <b>use code WELCOME10</b> at checkout', ago(2));
  db.prepare('INSERT INTO settings (key,value,updated_at) VALUES (?,?,?)').run('footer_text', 'Vendora Inc. \u2014 staging environment', ago(90));
  db.prepare('INSERT INTO settings (key,value,updated_at) VALUES (?,?,?)').run('maintenance_banner', '', ago(300));
  for (const e of ['ada@acme.dev', 'sam@acme.dev', 'victim2@fastmail.test', 'news@acme.dev', 'mia@example.com'])
    db.prepare('INSERT OR IGNORE INTO newsletter (email, created_at) VALUES (?,?)').run(e, ago(rint(10, 200)));
  for (const [u, text, link] of [
    [4, 'Your order #1042 shipped', '/orders'],
    [5, 'Sam Ortiz joined Acme Studios via join code', '/orgs/1/members'],
    [11, 'Support ticket open', '/support'],
    [7, 'New payout pending', '/vendor/payouts'],
  ]) db.prepare('INSERT INTO notifications (user_id,kind,text,link,created_at) VALUES (?,?,?,?,?)').run(u, 'system', text, link, ago(rint(1, 20)));

  // ---------- api keys ----------
  const demoKey = 'vdsk_t3st_labsandbox_key_not_for_prod_7f3c';
  db.prepare('INSERT INTO api_keys (user_id,label,prefix,hash,scopes,created_at) VALUES (?,?,?,?,?,?)')
    .run(7, 'docs-sandbox', demoKey.slice(0, 9), sha256(demoKey), 'read,write', ago(100));

  // ---------- audit ----------
  const acts = ['org_update', 'invite', 'member_removed', 'product_import', 'billing_update', 'webhook_create', 'member_role_change', 'org_join_by_code'];
  for (let i = 0; i < 40; i++) {
    db.prepare('INSERT INTO audit_log (org_id,user_id,action,meta,created_at) VALUES (?,?,?,?,?)')
      .run(rint(1, 5), rint(4, 16), pick(acts), JSON.stringify({ note: pick(['from console', 'via api', 'bulk tool']) }), ago(rint(1, 200)));
  }

  const payments = db.prepare('SELECT COUNT(*) c FROM payments').get().c;
  const coupons = db.prepare('SELECT COUNT(*) c FROM coupons').get().c;
  console.log(`[seed] users=${db.prepare('SELECT COUNT(*) c FROM users').get().c} vendors=${db.prepare('SELECT COUNT(*) c FROM vendors').get().c} products=${db.prepare('SELECT COUNT(*) c FROM products').get().c} orders=${db.prepare('SELECT COUNT(*) c FROM orders').get().c} reviews=${db.prepare('SELECT COUNT(*) c FROM reviews').get().c} payments=${payments} coupons=${coupons}`);
  db.prepare('INSERT INTO connect_clients (client_id,client_name,redirect_uri,created_at) VALUES (?,?,?,?)')
    .run('acme-web', 'Acme Studios web app', 'https://app.acme.dev', Date.now());

  console.log('[seed] demo accounts: admin@vendora.io/Admin!2024Lab  ada@acme.dev/Buyer!2024  jonas@globex.dev/Vendor!2024  victim2@fastmail.test/Victim!2024');
}

// --- CLI: `npm run seed` ----------------------------------------------------
runSeed();
