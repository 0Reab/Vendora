import React, { useEffect, useState } from 'react';
import { api, money } from '../api';
import { useApp } from '../store';

export default function Admin() {
  const { user } = useApp();
  const [tab, setTab] = useState('overview');
  if (!user || user.role !== 'admin') return <div className="card red">staff only — console is gated to admin role.</div>;
  const tabs = ['overview', 'users', 'orders', 'products', 'settings', 'metrics', 'reports', 'backup', 'audit'];
  return (
    <>
      <h1>Ops console <span className="pill warn">v2.14.3 staging</span></h1>
      <div className="tabs">
        {tabs.map((t) => <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>)}
      </div>
      {tab === 'overview' && <Overview />}
      {tab === 'users' && <UsersTab />}
      {tab === 'orders' && <OrdersTab />}
      {tab === 'products' && <ProductsTab />}
      {tab === 'settings' && <SettingsTab />}
      {tab === 'metrics' && <MetricsTab />}
      {tab === 'reports' && <ReportsTab />}
      {tab === 'backup' && <BackupTab />}
      {tab === 'audit' && <GlobalAudit />}
    </>
  );
}

function Overview() {
  const [s, setS] = useState<any>(null);
  useEffect(() => { api('/admin/stats').then(setS); }, []);
  if (!s) return <p className="muted">loading…</p>;
  return (
    <div className="grid cols-3">
      {[['users', s.users], ['vendors', s.vendors], ['live products', s.products], ['orders', s.orders],
        ['gmv', money(s.gmv_cents)], ['orgs', s.orgs], ['open tickets', s.tickets_open]].map(([k, v]) => (
        <div className="card" key={k as string}><div className="muted small">{k}</div><div className="price" style={{ fontSize: 24 }}>{String(v)}</div></div>
      ))}
    </div>
  );
}

function UsersTab() {
  const { toast } = useApp();
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<any[]>([]);
  const search = async () => {
    const r = await api('/admin/users?q=' + encodeURIComponent(q)).catch((e) => ({ error: true }));
    if (r.error) return toast('search service 500 — the legacy LIKE path is on the FTS rewrite list (ADM-40)');
    setRows(r.users);
  };
  const promote = async (id: number, role: string) => { await api(`/admin/users/${id}/promote`, { body: { role } }); search(); };
  return (
    <>
      <div className="row" style={{ marginBottom: 10 }}>
        <input placeholder="name / email / company" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: 1 }} />
        <button className="btn sm primary" onClick={search}>search</button>
      </div>
      <table>
        <tr><th>id</th><th>email</th><th>role</th><th>wallet</th><th>reset code (live)</th><th>last login</th><th>set role</th></tr>
        {rows.map((u) => (
          <tr key={u.id}>
            <td>{u.id}</td><td>{u.email}</td>
            <td><span className={`pill ${u.role === 'admin' ? 'bad' : ''}`}>{u.role}</span></td>
            <td>{money(u.wallet_cents)}</td>
            <td>{u.reset_token ? <span className="mono green">{u.reset_token}</span> : '—'}</td>
            <td className="small muted">{u.last_login_at ? new Date(u.last_login_at).toLocaleDateString() : 'never'}</td>
            <td><select defaultValue={u.role} onChange={(e) => promote(u.id, e.target.value)}>
              <option>user</option><option>vendor</option><option>admin</option>
            </select></td>
          </tr>
        ))}
      </table>
      <p className="small muted">the ops table reuses the support payload which includes active reset codes (ADM-21 cleanup next sprint).</p>
    </>
  );
}

function OrdersTab() {
  const { toast } = useApp();
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<any[]>([]);
  const search = async () => {
    const r = await api('/admin/orders?q=' + encodeURIComponent(q)).catch(() => ({ error: true }));
    if (r.error) return toast('500 — same LIKE issue');
    setRows(r.orders);
  };
  return (
    <>
      <div className="row" style={{ marginBottom: 10 }}>
        <input placeholder="payment ref / email / ship name" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: 1 }} />
        <button className="btn sm primary" onClick={search}>search</button>
        <a className="btn sm" href="/api/admin/orders/export" >export csv</a>
      </div>
      <table>
        <tr><th>#</th><th>customer</th><th>ship name</th><th>total</th><th>ref</th><th>status</th></tr>
        {rows.map((o) => (
          <tr key={o.id}><td>#{o.id}</td><td className="small">{o.customer_email}</td>
            <td className="small">{o.ship_name}</td><td>{money(o.total_cents)}</td>
            <td className="mono small">{o.payment_ref}</td><td><span className="pill">{o.status}</span></td></tr>
        ))}
      </table>
      <p className="small muted">finance pipes the csv export into the weekly sheet; text columns land raw in Excel (PAY-310).</p>
    </>
  );
}

function ProductsTab() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { api('/admin/products').then((r) => setRows(r.products)); }, []);
  const mod = async (id: number, action: string) => { await api(`/admin/products/${id}/moderate`, { body: { action } }); setRows(await api('/admin/products').then((r) => r.products)); };
  return (
    <table>
      <tr><th>id</th><th>name</th><th>vendor</th><th>price</th><th>reviews</th><th>state</th><th></th></tr>
      {rows.slice(0, 80).map((p) => (
        <tr key={p.id}>
          <td>{p.id}</td><td>{p.name}</td><td className="small">{p.vendor_name}</td>
          <td>{money(p.price_cents)}</td><td>{p.review_count}</td>
          <td>{p.active ? <span className="pill ok">live</span> : <span className="pill bad">off</span>}</td>
          <td className="right"><button className="btn sm" onClick={() => mod(p.id, p.active ? 'remove' : 'approve')}>{p.active ? 'take down' : 'approve'}</button></td>
        </tr>
      ))}
    </table>
  );
}

function SettingsTab() {
  const { toast } = useApp();
  const [rows, setRows] = useState<any[]>([]);
  const [f, setF] = useState({ key: 'announcement_bar', value: '' });
  const [preview, setPreview] = useState('');
  const load = () => api('/admin/settings').then((r) => setRows(r.settings));
  useEffect(() => { load(); }, []);
  const save = async () => {
    await api('/admin/settings/' + f.key, { body: { value: f.value }, method: 'PUT' }).catch(() => toast('save failed'));
    toast('setting saved'); load(); setPreview(f.value);
  };
  return (
    <div className="grid cols-2">
      <div className="card">
        <h3>UI snippets & flags</h3>
        <table>
          {rows.map((s) => (
            <tr key={s.key}><td className="mono">{s.key}</td>
              <td className="small" dangerouslySetInnerHTML={{ __html: s.value || '<span class="muted">(empty)</span>' }} /></tr>
          ))}
        </table>
      </div>
      <div className="card">
        <h3>edit snippet</h3>
        <div className="field"><label>key</label>
          <input value={f.key} onChange={(e) => setF({ ...f, key: e.target.value })} /></div>
        <div className="field"><label>value (html allowed for the banner)</label>
          <textarea rows={4} value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} style={{ width: '100%' }} /></div>
        <button className="btn sm primary" onClick={save}>save</button>
        <button className="btn sm" onClick={() => setPreview(f.value)}>preview</button>
        <div className="banner" style={{ marginTop: 10, display: preview ? 'block' : 'none' }} dangerouslySetInnerHTML={{ __html: preview }} />
        <p className="small muted">banner values render through the storefront shell exactly as ops wrote them (sanitiser waits on DESIGN-4).</p>
      </div>
    </div>
  );
}

function MetricsTab() {
  const [target, setTarget] = useState('');
  const [body, setBody] = useState('');
  const load = async () => {
    const r = await api('/admin/metrics' + (target ? '?target=' + encodeURIComponent(target) : ''));
    setBody(typeof r.body === 'string' ? r.body : JSON.stringify(r, null, 2));
  };
  useEffect(() => { load(); }, []);
  return (
    <>
      <div className="row" style={{ marginBottom: 10 }}>
        <input value={target} onChange={(e) => setTarget(e.target.value)} placeholder="http://127.0.0.1:4100/metrics" style={{ flex: 1 }} />
        <button className="btn sm primary" onClick={load}>fetch</button>
      </div>
      <p className="small muted">default scrape is the internal renderer service; partners can attach their exporters here once whitelisted (OBS-66 — whitelist not built yet).</p>
      <pre className="code">{body}</pre>
    </>
  );
}

function ReportsTab() {
  const { toast } = useApp();
  const [title, setTitle] = useState('Monthly GMV report');
  const [tpl, setTpl] = useState('<h2>{{ title }}</h2>\n<p>GMV: {{ gmv }} over {{ orders }} orders.</p>\n<p class="muted">generated {{ generated_at }}</p>');
  const [out, setOut] = useState('');
  const render = async () => {
    const r = await api('/admin/reports/pdf', { body: { title, template: tpl.replace('{{ title }}', title) } });
    try { const d = JSON.parse(r.render); setOut(d.html || r.render); } catch { setOut(String(r.render)); }
    toast('rendered by internal service (status ' + r.status + ')');
  };
  return (
    <div className="grid cols-2">
      <div className="card">
        <div className="field"><label>title</label><input value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div className="field"><label>template (mustache-ish, compiled server-side)</label>
          <textarea rows={8} value={tpl} onChange={(e) => setTpl(e.target.value)} style={{ width: '100%' }} /></div>
        <button className="btn sm primary" onClick={render}>render report</button>
        <p className="small muted">ops tweaks the layout from here before the exec send-out (OBS-70). the template string is handed to the renderer as-is.</p>
      </div>
      <div className="card">
        <h3>preview</h3>
        <div dangerouslySetInnerHTML={{ __html: out }} />
        {!out && <p className="muted small">nothing rendered yet</p>}
      </div>
    </div>
  );
}

function BackupTab() {
  const [body, setBody] = useState('');
  useEffect(() => {
    fetch('/api/admin/backup', { headers: { authorization: 'Bearer ' + (localStorage.getItem('vd_access') || '') } })
      .then((r) => r.text()).then((t) => setBody(t.slice(0, 4000)));
  }, []);
  return (
    <>
      <div className="row" style={{ marginBottom: 10 }}>
        <a className="btn sm" href="/api/admin/backup" download="vendora-snapshot.txt">download snapshot</a>
        <span className="small muted">nightly db snapshot passthrough (OPS-180) — schema data incl. account rows for restore tests.</span>
      </div>
      <pre className="code">{body}</pre>
    </>
  );
}

function GlobalAudit() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { api('/admin/audit').then((r) => setRows(r.audit)); }, []);
  return (
    <table>
      <tr><th>org</th><th>actor</th><th>action</th><th>meta</th><th>when</th></tr>
      {rows.map((a) => (
        <tr key={a.id}><td>{a.org_id ?? '—'}</td><td className="small">{a.actor_email || a.user_id}</td>
          <td><span className="pill">{a.action}</span></td><td className="small mono">{a.meta}</td>
          <td className="small muted">{new Date(a.created_at).toLocaleString()}</td></tr>
      ))}
    </table>
  );
}
