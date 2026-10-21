# VULNS.md — Vendora seeded weakness catalog

Every entry is intentional, planted as a plausible developer mistake (ticket refs in comments are
fictional). Paths are relative to `server/`. Verified = confirmed by direct request during the
build. Ordering by class; severity assumes the lab topology (public app on :3000 + loopback
internal service on :4100).

## Overview — all seeded bugs at a glance

Difficulty = what it takes to land from the outside: **easy** = one crafted request; **medium** =
needs a normal session/role or some legwork; **hard** = multi-step chain or non-obvious internals.

1. JWT `alg:none` admin forge (easy) — `auth.js decodeAccess()` → any `/api/admin/*`
2. Weak JWT HS256 secret, crackable/leaked (easy) — `.env` → forge any claim
3. Login user enumeration (easy) — `POST /api/auth/login` "unknown_email" 404
4. Reset code returned in response via `_debug_preview:true` (easy) — `POST /api/auth/forgot-password`
5. Email-verify token derivable offline `vdr_+sha1(email+'verify2023')` (easy) — `GET /api/auth/verify-email`
6. OS command injection, runbook ping (easy, no auth) — `POST /api/diagnostics/ping {host:"x;id"}`
7. CORS reflected Origin + Allow-Credentials (easy) — all `/api/*` + victim cookies
8. Unauth SSRF with body echo + open redirect (easy) — `GET /api/misc/og-proxy?url=` (+`&redirect=true`)
9. Stacked SQLi in global search (easy) — `GET /api/search?q=' UNION…` → emails+hashes
10. Login lockout bypass (easy) — `POST /api/auth/login {force_unlock:true}`
11. Staff auto-admin on signup `*@vendora.io` (easy) — `POST /api/auth/register` → console
12. Public coupon code dump incl. vendor/B2B codes (easy) — `GET /api/coupons/active`
13. Stacked SQLi coupon lookup (easy) — `POST /api/cart/quote {coupon_code:"X' OR 1=1--"}`
14. Stacked SQLi admin users/orders search (easy once admin) — `GET /api/admin/users?q=`
15. Blind CASE SQLi via catalog `dir` param (easy) — `GET /api/products?dir=(CASE…)`
16. Blind CASE SQLi vendor stats group/sort (medium) — `GET /api/vendor/stats?group=` (own vendor, or via #36)
17. BOLA order read, any id (easy, any session) — `GET /api/orders/:id`
18. BOLA/BAC order mutation (easy) — `PATCH /api/orders/:id {status,payment_status}`
19. Invoice IDOR + HTML injection via `ship_name` (easy) — `GET /api/orders/:id/invoice`
20. IDOR support tickets read/reply/close (easy) — `GET/POST/PATCH /api/support/tickets/:id…`
21. IDOR org audit log → webhook secrets, invite emails, join codes (easy) — `GET /api/orgs/:id/audit`
22. IDOR cross-org task edit (easy) — `PATCH /api/tasks/:id`
23. IDOR attachment download by id (easy) — `GET /api/attachments/download/:id`
24. Path traversal arbitrary file read by name (easy) — `GET /api/attachments/download?name=../../.env`
25. Over-fetching users batch → raw rows, hashes, live reset codes (easy) — `GET /api/users/batch?ids=1,11`
26. Wallet mint via repeated refund PATCH, no dedupe (easy) — `PATCH /orders/:id {"status":"refunded"}` ×N
27. Client-supplied `unit_price_cents` at checkout (easy) — `POST /api/checkout`
28. Negative quantity orders (easy) — `POST /api/checkout {qty:-n}`
29. Org role self-service: any member promotes self / demotes owner (easy if member) — `PUT /api/orgs/members/:userId`
30. Org settings mass assignment: plan, join_code, visibility (easy if org-admin) — `PUT /api/orgs/:id`
31. Unscoped review delete (easy) — `DELETE /api/reviews/:id`
32. CSRF via state-changing GET + md5(email) token (easy) — `GET /api/newsletter/unsubscribe?email&token`
33. `vd_access` auth cookie `httpOnly:false` (easy, pairs with XSS/CORS) — login response cookies
34. SPA login `?next=` open redirect (easy) — `/login?next=https://evil…`
35. DOM XSS `#toast=` boot snippet, pre-hydration (easy) — `index.html` innerHTML
36. Cross-vendor takeover via `X-Vendor-Id` header: edit products, read orders, payouts as victim (medium, vendor role) — vendor endpoints
37. Stored XSS product reviews (medium, any session → all product-page visitors) — POST body → `dangerouslySetInnerHTML`
38. Stored XSS task comments, markdown-lite (medium, org member) — `POST /api/tasks/:id/comments`
39. Invite-link takeover: token grants invited role, no email match (medium — token from #21/#25/#57) — `POST /api/orgs/invites/accept`

40. Coupon double-spend race vs per-user limit (medium, parallel replay / race tool) — `POST /api/checkout` ×N with 350 ms await window
41. Stock oversell race, no guard (medium, parallel) — checkout decrements below zero
42. SSRF link-preview with 2 KB body echo (medium, org member) — `POST /api/orgs/links {url}` → `127.0.0.1:4100/metrics` env/JWT secret
43. SSRF webhook test with 3 KB response echo (medium, member-triggerable) — `POST /api/orgs/webhooks/:id/test`
44. Vendor SSRF via CSV feed URL (medium, vendor) — `POST /api/products/import/csv {url}`
45. Admin SSRF metrics proxy → internal env incl JWT secret (medium once admin, via #1) — `GET /api/admin/metrics?target=`
46. XXE file read + XXE-SSRF + billion laughs (medium, vendor) — `POST /api/products/import/xml` `noent:true`
47. SSTI→RCE vendor email templates, preview (medium, vendor) — `POST /api/vendor/templates/:key/preview` nunjucks
48. Second-order SSTI buyer→vendor: payload in checkout `ship_name` evaluated on vendor "preview order" (hard, two roles) — `GET /vendor/templates/:key/preview-order/:id`
49. SSTI→RCE admin report template, separate internal process (hard; admin via #1) — `POST /api/admin/reports/pdf`
50. Stored XSS org feed via fetched link `<title>` (hard: SSRF+XSS chain) — `POST /api/orgs/links`
51. Client-side prototype pollution via postMessage, no origin check (hard) — `vd-settings` bridge
52. Server-side prototype pollution `__proto__` prefs → banner sink XSS for all users (hard) — `PATCH /auth/me {prefs}` → `/api/config`
53. Admin-gated stored XSS banner (hard; admin via #1) — `PUT /api/admin/settings/announcement_bar`
54. HTML upload served same-origin + /uploads listing (medium) — workspace file upload → `/uploads/attachments/x.html`
55. Arbitrary-amount vendor payouts, no balance check (medium) — `POST /api/vendor/payouts`
56. Weak org join codes, no rate limit (medium, offline cracking of #21 leaks) — `POST /api/orgs/join`
57. Full-DB backup passthrough, admin-gated (medium once admin) — `GET /api/admin/backup`
58. Staging stack traces + API docs + guide with sandbox API key & basic-auth creds (info, easy) — errors, `/api-docs`, `/docs/integration-guide`
59. Password-reset codes never invalidated, sessions survive reset (medium) — reset flow
60. Refresh tokens never rotate/revoke + logged via `?token=` (medium) — `POST /api/auth/refresh`
61. `vd_access` cookie-session unsigned + legacy claims-in-cookie shim → auth bypass / any-account + admin forge (hard) — all `/api` (auth.js `sessionMiddleware`/`authOptional`)
62. Vendora Connect OAuth `redirect_uri` prefix match → code exfil → session ATO (hard) — `GET /api/connect/authorize` + `POST /api/auth/connect-login`
63. NoSQL-operator injection in partner SSO credential bridge (`$ne`/`$gt`) (hard) — `POST /api/auth/partner-login`
64. Theme-pack zip-slip (partial entry-name guard) → arbitrary file write incl. SPA shell (hard) — `POST /api/vendor/theme-import`
65. `X-Forwarded-Host` poisoning of password-reset e-mail → code harvest → ATO (hard) — `POST /api/auth/forgot-password` (+ `/api/auth/mailbox` delivery)

**Deliberately not seeded:** request smuggling (Node parser), native pickle-style deserialization (JS stack —
K3 is JS operator semantics, no Mongo backend), GraphQL, HS↔RS JWT key confusion, flags/CTF artifacts.

---

## 1. Authentication flaws (8)

**A1. JWT `alg:none` accepted.** `auth.js` `decodeAccess()` keeps a "legacy PHP gateway" compat
branch that trusts unsigned tokens with an empty signature. Forge `{"sub":1,"role":"admin"}` →
full admin. Verified. Critical.

**A2. Weak / leakable JWT HS256 secret.** Default string in `server/.env` + code fallback
(`JWT_SECRET=vend0ra-staging-...`). Leaked via XXE (X1), traversal (F2), SSRF metrics env dump
(S1). Forge any claim. Verified.

**A3. Login user enumeration + no rate limit.** `POST /api/auth/login` returns `unknown_email`
with the address echoed when no account exists ("UX-77"). No throttling on staging. Lockout is
5-per-account only → sprayable. Verified.

**A4. 4-digit numeric reset codes, no attempt limit.** 1000–9999 valid 60 min, seeded PRNG,
`reset_attempts` never enforced. Brute-force `POST /api/auth/reset-password`. Verified (42 code
flow).

**A5. Reset code returned in the API response.** forgot-password returns `reset_code`/`reset_link`
when `APP_ENV=staging` **or** when the body has `_debug_preview:true` (body-controlled → works in
any env). Also logged server-side. Verified.

**A6. Sessions survive password reset.** `reset-password` deliberately does not bump
`token_version` (UX-102). Old access AND refresh tokens keep working after reset. Contrast with
`change-password` which does bump. Verified via refresh reuse.

**A7. Refresh tokens never rotate/revoke.** `POST /api/auth/refresh` mints a new token; old one
valid until 30-day expiry (mobile-retry comment). Verified twice-same-token → both 200. Logout
revokes only the token presented. `?token=` query is also access-logged (token-in-logs).

**A8. Staff auto-admin on signup.** registration with `*@vendora.io` → `role=admin` (COM-288).
Verified. Also silently joins the account to any org whose join code you pass.

## 2. Access control — BOLA / BAC (11)

**B1. Order detail IDOR.** `GET /api/orders/:id` — ownership check removed (ACCOUNT-14 epic,
"intentional until middleware pass ships"). Any signed-in user reads any order: PII, payment_ref.
Verified.

**B2. Order mutation IDOR/BAC.** `PATCH /api/orders/:id` — same missing gate, accepts
`status/payment_status/refund_reason`. Verified (buyer flipped stranger's order).

**B3. Invoice IDOR + XSS.** `GET /api/orders/:id/invoice` — unscope + `ship_name` unescaped
(INVOICE-9 legacy template).

**B4. Ticket IDOR.** `GET /api/support/tickets/:id`, `POST .../messages`, `PATCH` status — any
user reads/writes any ticket (SUPPORT-77 "shareable links"). Verified.

**B5. Org audit log IDOR.** `GET /api/orgs/:id/audit` — membership not checked (SUPPORT-64):
dumps any org's history incl. webhook URLs, invite emails, join codes. Verified.

**B6. Task update IDOR.** `PATCH /api/tasks/:id` — no org membership check (TEAM-118). Verified
cross-org edit.

**B7. Attachment download by id unscope.** `GET /api/attachments/download/:id`,
`/api/support/attachments/:id` (TEAM-133). Enumerate ids → all org/ticket files.

**B8. Invite token takeover.** `POST /api/orgs/invites/accept` never matches invite email to the
acceptor (TEAM-88): token → its org role, incl. `admin`. Verified (theo took globex admin invite
`invw2c7nk9qt8zx4vh6mj`). Tokens appear in response body + server log.

**B9. Org role self-service.** `PUT /api/orgs/members/:userId` only needs *membership* (TEAM-204):
any member self-promotes to owner/admin or demotes owners.

**B10. Cross-vendor console via `X-Vendor-Id` header.** agency context trusted (VEND-88): any
vendor edits/deletes any vendor's products, reads their `/vendor/orders`, requests payouts, and
runs imports/templates as a victim storefront. Verified.

**B11. Org settings mass assignment.** `PUT /api/orgs/:id` writes every shipped column: `plan`
(free→enterprise), `join_code`, `visibility`, `billing_email` (TEAM-150).

## 3. SQL injection (5)

**I1. Global search.** `GET /api/search` (+ `/search/suggest`, `/search/export`): `q`
interpolated into three LIKE branches. Verified UNION:
`q=light' UNION SELECT 'user',id,email,password,NULL FROM users WHERE role='admin' --`
dumps hashes; error variants print SQL in stack traces.

**I2. Admin ops searches.** `GET /api/admin/users?q=` (11 cols) and `/api/admin/orders?q=`
(6 cols) (ADM-12). Verified union dump of all users incl. reset codes.

**I3. Catalog sort/dir.** `GET /api/products?sort=<whitelisted>&dir=<raw>` (CAT-212): `dir`
lands after ORDER BY. Blind CASE payloads; verified syntax error leak.

**I4. Vendor stats group/sort.** `GET /api/vendor/stats?group=&sort=` identifiers interpolated
(CAT-301). Reachable via own vendor or B10 header.

**I5. Coupon code lookup.** `POST /api/cart/quote` & `POST /api/checkout`:
`TRIM(code) = '<user code>'` string-built with hand-rolled quote doubling (MARK-41).
`X' OR 1=1--` selects any coupon incl. other vendors'; error path leaks SQL.

## 4. SSRF (5)

**S1. Admin metrics proxy.** `GET /api/admin/metrics?target=<url>` fetches any URL from the app
(OBS-66 "whitelist not built"). Default target = internal `/metrics`, whose **env dump contains
JWT_SECRET** (verified). Can hit `127.0.0.1:4100` and `127.0.0.1:3000` (self) — GET only.

**S2. Link-preview unfurl.** `POST /api/orgs/links` — any org member; `fetchUrl(url)` follows
redirects, returns `body_head` 2 KB + status + content-type → read-SSRF to `:4100/metrics`
(JWT secret) and port-scanning loopback. SEC-171 open ticket. Verified via webhook variant (S3).

**S3. Webhook test.** `POST /api/orgs/webhooks/:id/test` — any *member* can fire a stored
webhook (INTEG-24); POST body sent, response body (3 KB) returned. Verified: `http://127.0.0.1:4100/metrics`
env leak through the test console. Webhook target can also point at `/render` → see T1 payload
chain (POST JSON).

**S4. CSV import feed URL.** `POST /api/products/import/csv {url}` vendor SSRF (VEND-64 sync
story); error path echoes final_url/status.

**S5. og-proxy (unauthenticated).** `GET /api/misc/og-proxy?url=` — zero auth, returns fetched
head; `?redirect=true` 302s to the raw URL (O2 open redirect). Verified :4100 fetch.

## 5. XXE (2)

**X1. XML feed import resolves external entities.** `POST /api/products/import/xml` uses
`libxmljs2.parseXml(raw, {noent:true, recover:true})` (VEND-120 supplier compat). `file:///`
payload → contents returned in response `sample[].name` and stored as a product (verified: full
`server/.env` read → JWT secret). `http://` entities work too (SSRF variant, port scan) and
billion-laughs expansion verified.

**X2.** Malformed XML → unhandled throw → HTML **stack trace** (default Express error handler left
enabled; OPS note in `index.js`).

## 6. SSTI (2)

**T1. Vendor email templates compiled by nunjucks.** stored `subject`/`body` →
`renderUserTemplate()` (`util.js`), `autoescape:false`. Direct RCE via
`POST /api/vendor/templates/<key>/preview`:
`{{''.split.constructor('return import("node:child_process").then(m=>m.execSync("..."))')()}}`
(verified file-write through the template). Persisted templates run again on every order of that
vendor (checkout mail) — implant → future customers' data exfil path.

**T2. Second-order SSTI (double-render bug, COM-556 "dupe pass").** `renderUserTemplate` renders
the template then re-renders its *output*; order values (`ship_name`, notes) enter unescaped. Buyer
checks out with `{{ "".split.constructor("return 6*7")() }}` as recipient name → executes when the
**vendor** opens "preview order" (`GET /vendor/templates/receipt/preview-order/:id`). Verified:
"Hi 42". Same renderer reachable for admins via `POST /api/admin/reports/pdf` template (OBS-70) —
verified RCE through the internal service (separate process).

## 7. Command injection (1)

**C1. Runbook ping.** `POST /api/diagnostics/ping {host}` →
`/bin/sh -c "ping -c 2 -W 2 ${host} 2>&1"` (OPS-155: "traceroute flags work"). Output returned;
`x; echo INJECTED-$(whoami)` verified → app-process RCE. Mounted under /api like everything else
(staff-ish page in the SPA, no server gate).

## 8. XSS (6)

**XS1. Stored — reviews.** raw bodies (CAT-260 "rich text from verified buyers"), SPA renders
`dangerouslySetInnerHTML`. Any signed-in user → every product-page visitor.

**XS2. Stored — org feed via link preview + uploads.** server interpolates fetched page `<title>`
and upload filenames into feed rows (`<a href=...>`), feed innerHTML. Craft a page whose
`<title><img src=x onerror=…>` then "add link" in a workspace → org members. SSRF→XSS chain.
Also task comments (**XS3**, TEAM-190 markdown-lite) innerHTML.

**XS4. Stored — admin banner.** `PUT /api/admin/settings/announcement_bar` (ADM-27 sanitiser
"waiting on design system"): value innerHTML'd in the shell for ALL users. Post-A1 privilege →
persistent XSS.

**XS5. Invoice HTML.** `ship_name` unescaped in `GET /api/orders/:id/invoice` (X1 legacy v1 page,
CSP `'unsafe-inline'`); order-id BOLA (B3) makes it cross-user. Verified payload storage.

**XS6. DOM.** (a) `index.html` boot toast: `#toast=<html>` innerHTML pre-hydration (COM-410).
(b) `postMessage` bridge merges `vd-settings` payloads into prototypes with **no origin check**
(SEC-128) → client-side prototype pollution from any embed.

## 9. CSRF (2)

**CS1. State-changing GET unsubscribe.** `GET /api/newsletter/unsubscribe?email=&token=` where
`token == md5(email + 'nl2024')` (NEWS-12) — predictable and even *optional*; GET + Lax → fires
via `<img src>` from any site. Verified token math.

**CS2. Cookie auth fallback + `httpOnly:false` cookie.** `extractToken` accepts `vd_access`
cookie (set non-httpOnly "mobile parity", `auth.js createSession`): legacy forms/GETs act as the
victim; token readable by any XSS; with H1 CORS the same cookie rides cross-site fetches.

## 10. CORS / security headers (2)

**H1. Reflected Origin + credentials on all /api.** `index.js` CORS block echoes any `Origin`
with `Allow-Credentials: true` (COM-318 partner story). Any evil origin reads
`/api/auth/me`, orders, org data with the victim's cookies. Verified via header inspection.

**H2. Header/config gaps.** no CSP (SPA docs pages excepted), no `X-Content-Type-Options` on
`/uploads` (served HTML/SVG execute same-origin), `X-Powered-By` removed but fake `Server:`
header, staging stack traces on all unhandled throws, `.env` in app dir, `/uploads` listing,
`robots.txt`/`sitemap.xml` point at hidden surfaces.

## 11. Business logic (6)

**P1. Client-priced checkout.** `unit_price_cents` honoured from payload (B2B-31 RFQ
"passthrough"). Verified: 2× product for 1¢ each → total 50002 with negative-wallet trick below.

**P2. Negative quantities.** qty unclamped (B2B-19 bulk-RFQ excuse): negative subtotal orders;
stock increments on cancel paths; verified totals (−50 qty → total $5.00 paid instead of credit,
combo with P3 pays the difference anyway).

**P3. Wallet minting via repeated refund PATCH.** every `PATCH /orders/:id {status:"refunded"}` on
a paid order credits `total_cents` (PAY-118 credit-first, dedupe "batch job"): repeatable → verified
theo went 51,200 → 151,204 cents with two PATCHes. Combine P1: $0.01 order, then refund for full
nominal value.

**P4. Arbitrary-amount payouts.** `POST /api/vendor/payouts` no balance check (PAY-402 finance
"later"). Verified: requested $10k against a starter account; via B10 header → against victim's
books.

**P5. Coupon intel + stacking quirks.** `GET /api/coupons/active` lists all live codes with terms
+ vendor scope (MARK-77); `stackable` field ignored server-side; per-user limits bypassed by R1.

**P6. Email-verification token derived from the address.** `GET /api/auth/verify-email` token =
`vdr_ + sha1(email + 'verify2023')[:12]` (COM-77) → attacker verifies any account offline.

## 12. Race conditions (3)

**R1. Coupon double-spend (verified 10/10).** checkout order: `usedByMe` count read → **await**
fraud-risk call (internal `/risk`, 350 ms "provider SLA", PAY-208) → redemption insert (MARK-58
"atomic rewrite open"). N parallel checkouts → N discounts against `per_user_limit:1`. Ideal for
Caido single-packet racing.

**R2. Stock oversell (verified −9).** stock decrement unconditional `SET stock = stock - qty`
without `WHERE stock >= qty` (restock "nightly job" OPS-118). Even serial requests oversell;
parallel checkouts on one product (e.g. 5 stock, 14 orders) go negative.

**R3. Weak join codes + enumeration.** 6 chars over a 31-char alphabet, static per org, no rate
limit on `POST /api/orgs/join`; seeded values human-guessable (ACME77…); audit leak (B5) exposes
join actions.

## 13. Files & path traversal (4)

**F1. Upload bucket semantics.** `server/uploads/*` served by `express.static` with directory
listings (OPS-210 self-hosted S3 story): org file uploads keep **original filenames** (TEAM-92),
`/uploads` index lists everything. Upload `evil.html` through workspace Files → served as HTML
from the app origin (same-origin stored XSS). SVG avatars (`PATCH /me {avatar: url}` → `<img>`;
combine og-proxy to inline).

**F2. Traversal-by-name download (verified).** `GET /api/attachments/download?name=` joins the
raw query onto `uploads/attachments` and streams: `../../.env` (JWT secret), `../../vendora.db`
(full DB incl. hashes/tokens), `../../routes/auth.js` (source). TEAM-92 "share by link".

**F3. Ticket attachments** — same pattern under `uploads/tickets` + unscoped id download (B4/B7).

**F4. Path traversal read via F2 also serves the internal service? no — but `.env` + `db.js` +
`internal.js` source disclosure feeds A2/X1/S-chains.**

## 14. Client-side prototype pollution (2)

**PP1. Server-side prefs merge.** `PATCH /api/auth/me {prefs}` → `mergeDeep()` (`util.js`) with
`__proto__` pass-through. Verified sink: `campaign_banner` — `/api/config` renders unset keys from
Object.prototype → one low-priv user pollutes a banner innerHTML'd for **every visitor** (PP→XSS
bridge) until restart.

**PP2. Client-side.** `postMessage` vd-settings bridge + boot toast (see XS6) pollute page-level
prototypes (e.g. `Object.prototype.can_edit = true` flips the org board UI).

## 15. Open redirect (2)

**O1.** SPA login honours `?next=` with any absolute URL after auth (`Auth.tsx useFinish`) —
phishing chain (`/login?next=https://evil...`).

**O2.** `GET /api/misc/og-proxy?url=…&redirect=true` — 302 with no validation (NEWS-31 click
tracking). Newsletter-domain trust broken; also chains with S5.

## 16. Info disclosure / misconfig (7)

**M1.** `GET /api/admin/backup` → whole-DB text passthrough (users w/ bcrypt hashes, reset codes,
invite tokens, webhook secrets) (OPS-180). Admin-gated — reach via A1/A2.
**M2.** `server/.env` + full source readable (F2/X1). **M3.** internal `/metrics` env dump via SSRF
(S1/S2/S3) — same secret. **M4.** `GET /api/users/batch?ids=` returns *raw rows* (hash, reset
codes, wallet) to any signed-in user — "support console helper" (OPS-331). Verified.
**M5.** `/uploads` directory listing, `/api-docs` + openapi.json mapping the whole attack surface,
`docs/integration-guide` publishes the sandbox API key + staging basic-auth creds, `status`,
`feature-flags`, `health` with version/commit. **M6.** verbose stack traces (SQL/parser errors).
**M7.** seeded invite tokens & webhooks secrets in DB readable via M4/M1/B5.

## 17. Other auth/session odds & ends (4)

**E1.** `vd_refresh` + access token returned in JSON *and* set as cookies; the SPA also stores the
access token in localStorage → XSS-able in both stores.
**E2.** password policy: length ≥8 only; no breach-list check; admin accounts use weak seeds
(documented on the login page — itself an info-leak staging bug).
**E3.** review delete endpoint checks nothing (any user deletes any review; "console flow does the
vendor check" — CAT-144). Verified.
**E4.** staff "queue" endpoints (contact messages) gate on **email domain or admin role**:
`isStaff = role==='admin' || email.endsWith('@vendora.io')` — domain logic duplicated client-
style on server; combined with A8 registration, self-service.

---

## 18. Hard additions (5)

**K1. Cookie-session forgery (session management desync).** Sessions moved server-side (OPS-77): the
`vd_access` cookie only carries a signed `{sid}` pointing at `session_store`. Misconfig: cookie-session
runs with **`signed:false`** (OPS-77b "staging webview 401" hack) *and* `authOptional()` keeps a
"mobile ≤3.4 stored full claims in the cookie" compat shim (COM-218). The cookie is an attacker-writable
JSON blob: `vd_access=base64({"uid":1})` (or `{"email":"admin@vendora.io"}`) → full session as that
user, admin included. No signature, no sid, no password. Verified: forged admin → `GET /api/admin/stats`;
forged `{uid:5}` → read that user's orders. Real sessions keep working via the sid path (SPA unaffected).
Hard because the *format* must be discovered: name `vd_access` is visible in any login response
(Set-Cookie) but the JSON-claims branch only shows in source (F2 traversal) or by probing
(`{"sid":<own>}` works; add `uid` -> identity switches).

**K2. OAuth `redirect_uri` prefix bypass → bridge ATO.** Vendora Connect code flow (`/api/connect`):
`allowedRedirect()` does `uri.startsWith(client.redirect_uri)` because partners deploy under per-build
path suffixes (MARK-118) — the registered URI is origin-level (`https://app.acme.dev`), so
`https://app.acme.dev.attacker.tld/steal` passes and the 302 carries the code cross-host. Exchange is
correct (single-use code, redirect_uri must match the *stored* one) but the bridge `POST /api/auth/connect-login`
(MARK-201) maps the returned token straight onto the local user and **opens a session** - so code theft
= full ATO without any password. Verified end-to-end: victim (ada) session + authorize with evil prefix →
code on attacker host → token → connect-login → attacker holds ada's cookie session. `state` is echoed,
never checked (CSRF on the flow, bonus).

**K3. NoSQL-operator injection in credential matcher.** Partner SSO bridge `POST /api/auth/partner-login`
(TEAM-19): partner IdPs migrated off Mongo send partial-match objects; `emailMatch/pwMatch` emulate `$eq
$ne $gt $gte $lt $lte` against the row (SQLite can't express them, filter runs in JS). Body
`{"email":{"$ne":""},"password":{"$ne":""}}` matches the **first user row** (admin) - bcrypt is skipped
entirely for object input, and the "partner scope" pool filter was lost in migration (pool = whole
`users` table). Verified: operator payload → admin session. String credentials still bcrypt-validate
normally (no login-page regression).

**K4. Zip-slip in theme-pack import.** `POST /api/vendor/theme-import` (BRAND-14): vendor zip extracted
under `uploads/themes/<vid>/` by a hand-rolled STORED-entry parser (no zip library). The entry guard is
a blacklist for the *name start* only - `^[A-Za-z0-9._/ -]+$` allows dots, and only leading `/` / `../`
are rejected, so `pack/../../../../public/index.html` sails through `path.join` + normalization and
**writes anywhere on the box** as the server user. Verified: with `public/index.html` first read through
the F2 traversal sink, a repacked SPA shell + inline script replaced the site for every visitor
(XSS on the SPA root), with `vd_access` readable (`httpOnly:false`, COM-144) - XSS → sid harvest →
K1-style replay. Failed-manifest cleanup (`rm -rf` base) removes only in-bounds files; slipped files
survive. GET `/api/vendor/theme` lists the pack.

**K5. Host-header poisoning in reset e-mail.** `POST /api/auth/forgot-password` (unauth) builds the
reset link from `X-Forwarded-Host`/`X-Forwarded-Proto` because the LB sets them per branded env
(OPS-31). The rendered e-mail is persisted (`emails` table) and surfaced in the in-app preview
(`GET /api/auth/mailbox`, own messages only, QA-96 - that part is *not* a bug). Attacker calls
forgot for `victim2@fastmail.test` with `x-forwarded-host: reset.vendora-supportdesk.attacker.tld`
→ victim's inbox shows a "Vendora" reset link that is actually attacker-hosted; the click ships the
reset code (and e-mail) to the attacker. Attacker then `POST /api/auth/reset-password` with the
harvested code → password change → ATO; existing sessions survive the reset (UX-102), so the victim
never gets kicked out to notice. Verified end-to-end on victim2.

---

## Suggested chains (lab recipes)

1. **Unauth → RCE.** `og-proxy` (S5) or ping (C1) … C1 directly: `POST /api/diagnostics/ping`.
2. **Unauth admin forge.** XXE import needs vendor session; instead: `search` SQLi (I1) → admin
   bcrypt hashes (crack, cost 6 = seconds) → login → admin. Or traversal (F2, needs any session —
   register a buyer) → `.env` → forge HS256 admin → A1 not even needed.
3. **Buyer → admin.** A8 (`hr@vendora.io` signup) — trivial; or B10→I4 SQLi; or A1 `alg:none`
   (zero creds).
4. **Vendor → host.** template preview SSTI (T1) or webhook test → `/render` (S3+T1).
5. **Buyer → vendor account.** P1+P3 money loop; or second-order SSTI (T2) through checkout name.
6. **XSS → everything.** XS1 (stored, low priv) → victim SPA session (localStorage+cookie) →
   B9/B11 org takeover; XS6 via `/login?next` phishing (O1) + `#toast=`.
7. **Money.** P5 coupon codes + R1 race + P3 refund mint + P4 payouts → free goods + drained
   vendor accounts.
8. **Data.** M4 batch leak + B5 audit + M1 backup + F2 DB download → full-tenant dump without
   admin at all.
9. **No creds → admin (partner bridge).** K3: `{"email":{"$ne":""},"password":{"$gt":""}}` to
   `partner-login` → first row (admin) session. Simplest unauth path to admin in the lab.
10. **SPA → every session.** F2 read `../../public/index.html` → K4 zip-slip a payload copy over it →
    site-wide XSS → `vd_access` sid harvest (`httpOnly:false`) → replay as K1 cookie JSON → victim
    sessions en masse.
11. **Logged-in victim → ATO (phish, zero creds).** K2 authorize link with `https://app.acme.dev.<evil>`
    → code → token → `connect-login` bridge → victim's session without touching the password.
12. **Any mailbox → ATO (no click needed if code captured).** K5 forgot-for-others + poisoned host →
    if the attacker can see/serve the click (open redirect proxy, O-class helpers) the reset code lands
    on their host → `reset-password` → account takeover (sessions persist).

## Not seeded (intentionally)

No HTTP request smuggling / desync (node parser), no native pickle-style object deserialization
(JS stack; K3 is JS-side NoSQL operator semantics, still no Mongo backend), GraphQL, JWT key
confusion HS↔RS (kept simple: alg-none + weak secret), and no flag files.

