# Vendora — deliberately vulnerable lab app

A realistic **marketplace + B2B team-workspace** SaaS ("sell together, buy smarter") built as a
bug-bounty / pentest training target. No CTF flags, no hints, no game mechanics: every weakness is
seeded as something a plausible team of devs would actually write, with ticket numbers in the
comments.

- **Stack**: Node 22 + Express 4 + better-sqlite3 (SQLite), JWT auth, React 19 SPA (Vite), nunjucks,
  libxmljs2, multer. An internal second service (loopback :4100) runs the PDF renderer + metrics.
- **Served on**: `http://localhost:3000` (SPA + API + uploads). Internal service on `127.0.0.1:4100`.
- **API docs**: `http://localhost:3000/api-docs` (+ `openapi.json`), integration-guide page with a
  sandbox key.

## Run

```bash
cd server
npm install          # prebuilt better-sqlite3/libxmljs2 are used; no compiler needed
npm start            # seeds the DB automatically on first run, serves :3000
npm run seed         # wipe & reseed only (stop server first, then: rm -f vendora.db* && npm run seed)
```

Frontend (only if you change it):

```bash
cd web && npm install && npm run build
cp -r dist/. ../server/public/
```

## Seeded accounts

| account | password | notes |
|---|---|---|
| `admin@vendora.io` | `Admin!2024Lab` | platform admin (ops console) |
| `ops@vendora.io` | `Ops!2024Lab` | SRE / staff |
| `support@vendora.io` | `Support!2024Lab` | support agent (staff) |
| `ada@acme.dev` | `Buyer!2024` | buyer org owner (Acme Studios, `ACME77`) |
| `sam@acme.dev` | `Member!2024` | org admin |
| `bruce@acme.dev` | `Member!2024` | org member |
| `jonas@globex.dev` | `Vendor!2024` | vendor (Globex Supply, org `GLBX11`) |
| `rita@globex.dev` | `Member!2024` | vendor rep |
| `kenji@northloop.co` / `lena@northloop.co` | `Member!2024` | public org Northloop Films (`NTH205`) |
| `victim2@fastmail.test` | `Victim!2024` | reset-flow target |
| `theo/hanna/devon/sofia/mia@example.com` | `Member!2024` | freelancers (RentalUser Org, `RENT42`) |

Join codes for orgs: `ACME77 GLBX11 NTH205 RENT42 STAFF1`.

## Testing notes

- Registration with any `*@vendora.io` email is a real onboarding path (it is *also* a bug — see the
  catalog), so you can mint staff accounts freely.
- The DB auto-reseeds when empty. Password hashes use bcrypt cost 6 to keep brute-force labs fast.
- Outbound fetches (link unfurl, imports, webhooks, SSRF sinks) run from the server process — they
  can reach `127.0.0.1:3000`, `127.0.0.1:4100`, and the internet through the sandbox proxy.
- Staging mode is on by default (`APP_ENV=staging`): password-reset codes are returned in responses
  and logged.

A complete, ordered catalog of every seeded weakness (65 entries) is in **VULNS.md**.
