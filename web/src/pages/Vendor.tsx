import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, money, LS_VENDOR } from '../api';
import { useApp } from '../store';

function Apply() {
  const { refresh, toast } = useApp();
  const [f, setF] = useState({ name: '', handle: '', bio: '', payout_bank: '' });
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const r = await api('/vendor/apply', { body: f }).catch((e2) => ({ error: e2.data?.error }));
    if (r.error) return toast(r.error);
    toast('storefront created'); refresh();
  };
  return (
    <div style={{ maxWidth: 480, margin: '30px auto' }} className="card">
      <h1>Open a storefront</h1>
      <p className="small muted">sell to production teams: shared catalog, payout to bank, org buyers.</p>
      <form onSubmit={submit}>
        <div className="field"><label>store name</label><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div className="field"><label>handle</label><input value={f.handle} onChange={(e) => setF({ ...f, handle: e.target.value })} placeholder="my-gear-shop" /></div>
        <div className="field"><label>about</label><textarea rows={3} value={f.bio} onChange={(e) => setF({ ...f, bio: e.target.value })} /></div>
        <div className="field"><label>payout IBAN</label><input value={f.payout_bank} onChange={(e) => setF({ ...f, payout_bank: e.target.value })} /></div>
        <button className="btn primary">Create storefront</button>
      </form>
    </div>
  );
}

function Products({ vid }: { vid: number }) {
  const [rows, setRows] = useState<any[]>([]);
  const [edit, setEdit] = useState<any>(null);
  const [n, setN] = useState({ name: '', price_cents: 1000, stock: 5, category: 'Lighting', description: '' });
  const load = () => api('/vendor/products').then((r) => setRows(r.products)).catch(() => {});
  useEffect(() => { load(); }, [vid]);
  const create = async () => { await api('/products', { body: n }); setN({ ...n, name: '' }); load(); };
  const upd = async () => {
    await api('/products/' + edit.id, { body: { name: edit.name, price_cents: edit.price_cents, stock: edit.stock, description: edit.description }, method: 'PUT' });
    setEdit(null); load();
  };
  const off = async (id: number) => { await api('/products/' + id, { method: 'DELETE' }); load(); };
  return (
    <>
      <div className="card" style={{ marginBottom: 14 }}>
        <h3>add product</h3>
        <div className="row">
          <input placeholder="name" value={n.name} onChange={(e) => setN({ ...n, name: e.target.value })} style={{ flex: 1 }} />
          <input type="number" placeholder="price cents" value={n.price_cents} onChange={(e) => setN({ ...n, price_cents: Number(e.target.value) })} style={{ width: 120 }} />
          <input type="number" placeholder="stock" value={n.stock} onChange={(e) => setN({ ...n, stock: Number(e.target.value) })} style={{ width: 90 }} />
          <button className="btn sm primary" onClick={create}>add</button>
        </div>
      </div>
      <table>
        <tr><th>id</th><th>name</th><th>price</th><th>stock</th><th>active</th><th></th></tr>
        {rows.map((p) => (
          <tr key={p.id}>
            <td>{p.id}</td>
            <td>
              {edit?.id === p.id
                ? <><input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /><br />
                    <input type="number" value={edit.price_cents} onChange={(e) => setEdit({ ...edit, price_cents: Number(e.target.value) })} style={{ width: 110 }} />
                    <input type="number" value={edit.stock} onChange={(e) => setEdit({ ...edit, stock: Number(e.target.value) })} style={{ width: 90 }} /></>
                : <>{p.name} <div className="small muted">{p.sku}</div></>}
            </td>
            <td>{money(p.price_cents)}</td>
            <td>{p.stock}</td>
            <td>{p.active ? <span className="pill ok">live</span> : <span className="pill bad">off</span>}</td>
            <td className="right row">
              {edit?.id === p.id
                ? <><button className="btn sm primary" onClick={upd}>save</button><button className="btn sm" onClick={() => setEdit(null)}>x</button></>
                : <><button className="btn sm" onClick={() => setEdit({ ...p })}>edit</button>
                  {p.active ? <button className="btn sm danger" onClick={() => off(p.id)}>deactivate</button> : null}</>}
            </td>
          </tr>
        ))}
      </table>
      <p className="small muted">console mode: agency accounts can manage several storefronts by switching vendor context (X-Vendor-Id). “agency” in the badge below marks the active context.</p>
    </>
  );
}

function ImportTab() {
  const { toast } = useApp();
  const [csv, setCsv] = useState('name,price,stock,category\nTest Light,49.99,10,Lighting');
  const [xml, setXml] = useState('<catalog><product><name>Catalogic Prime 25mm</name><price>249.00</price><stock>3</stock><category>Optics</category></product></catalog>');
  const [url, setUrl] = useState('');
  const [log, setLog] = useState<any[]>([]);
  const load = () => api('/vendor/imports').then((r) => setLog(r.imports)).catch(() => {});
  useEffect(() => { load(); }, []);
  const impCsv = async () => {
    const r = url ? await api('/products/import/csv', { body: { url } })
      : await api('/products/import/csv', { body: { csv_text: csv } });
    toast(`${r.created} rows created`); load();
  };
  const impXml = async () => {
    const res = await fetch('/api/products/import/xml', { method: 'POST', headers: { 'content-type': 'application/xml', authorization: 'Bearer ' + (localStorage.getItem('vd_access') || '') }, body: xml });
    const d = await res.json().catch(async () => ({ raw: await res.text() }));
    if (res.ok) { toast(`${d.created} products from XML feed`); load(); }
    else setLog([{ id: 0, kind: 'xml', status: 'error', source: 'see console', rows: 0, created_at: Date.now(), vendor_id: 0, _err: d }]);
  };
  return (
    <>
      <div className="grid cols-2">
        <div className="card">
          <h3>CSV import</h3>
          <textarea rows={5} value={csv} onChange={(e) => setCsv(e.target.value)} style={{ width: '100%' }} />
          <div className="row" style={{ marginTop: 8 }}>
            <input placeholder="…or fetch from supplier feed URL" value={url} onChange={(e) => setUrl(e.target.value)} style={{ flex: 1 }} />
            <button className="btn sm primary" onClick={impCsv}>{url ? 'fetch & import' : 'import csv'}</button>
          </div>
          <p className="small muted">the feed-URL mode powers the scheduled catalog sync (VEND-64) — it fetches server-side.</p>
        </div>
        <div className="card">
          <h3>XML supplier feed (Catalogic exports)</h3>
          <textarea rows={5} value={xml} onChange={(e) => setXml(e.target.value)} style={{ width: '100%' }} />
          <button className="btn sm primary" style={{ marginTop: 8 }} onClick={impXml}>parse & import</button>
          <p className="small muted">compat mode stays on so supplier custom entities resolve (VEND-120). bad feeds print the parser error on staging.</p>
        </div>
      </div>
      <h3>import history</h3>
      <table>
        <tr><th>id</th><th>kind</th><th>source</th><th>rows</th><th>when</th></tr>
        {log.map((i) => <tr key={i.id}><td>{i.id}</td><td>{i.kind}</td><td className="small mono">{i.source}</td><td>{i.rows}</td><td>{new Date(i.created_at).toLocaleString()}</td></tr>)}
      </table>
    </>
  );
}

function Templates() {
  const { toast } = useApp();
  const [tpls, setTpls] = useState<any[]>([]);
  const [key, setKey] = useState('receipt');
  const [f, setF] = useState({ subject: '', body: '' });
  const [prev, setPrev] = useState<any>(null);
  const load = () => api('/vendor/templates').then((r) => setTpls(r.templates));
  useEffect(() => { load(); }, []);
  const pickKey = (k: string) => {
    setKey(k);
    const t = tpls.find((x) => x.key === k);
    setF({ subject: t?.subject || '', body: t?.body || '' });
    setPrev(null);
  };
  const save = async () => { await api('/vendor/templates/' + key, { body: f }); toast('template saved'); load(); };
  const preview = async () => {
    const r = await api('/vendor/templates/' + key + '/preview', { body: f });
    setPrev(r);
  };
  return (
    <>
      <div className="row"><label style={{ width: 160 }}>template</label>
        <select value={key} onChange={(e) => pickKey(e.target.value)}>
          <option value="receipt">receipt</option><option value="shipping">shipping notice</option>
        </select>
        <span className="small muted">mustache-style tokens: {"{{ customer }} {{ order_id }} {{ total }} {{ items }} {{ vendor }} {{ email }}"}</span>
      </div>
      <div className="grid cols-2" style={{ marginTop: 10 }}>
        <div className="card">
          <div className="field"><label>subject</label><input value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} /></div>
          <div className="field"><label>body</label><textarea rows={8} value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} style={{ width: '100%' }} /></div>
          <div className="row">
            <button className="btn primary sm" onClick={save}>save template</button>
            <button className="btn sm" onClick={preview}>render preview</button>
          </div>
          <p className="small muted">templates are compiled by the internal renderer when the mail job runs (COM-556).</p>
        </div>
        <div className="card">
          <h3>preview</h3>
          {!prev && <p className="muted small">no render yet</p>}
          {prev && <div className="kv">
            <span className="k">subject</span><span dangerouslySetInnerHTML={{ __html: prev.subject }} />
            <span className="k">body</span><span dangerouslySetInnerHTML={{ __html: prev.body }} />
          </div>}
        </div>
      </div>
    </>
  );
}

function VendorOrders() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { api('/vendor/orders').then((r) => setRows(r.orders)); }, []);
  const upd = async (id: number, status: string) => { await api(`/vendor/orders/${id}/status`, { body: { status }, method: 'PATCH' }); setRows(await api('/vendor/orders').then((r) => r.orders)); };
  return (
    <>
      <table>
        <tr><th>order</th><th>buyer</th><th>my share</th><th>status</th><th>update</th></tr>
        {rows.map((o) => (
          <tr key={o.id}>
            <td>#{o.id}</td><td>uid {o.user_id}</td><td>{money(o.my_share_cents)}</td><td><span className="pill">{o.status}</span></td>
            <td><select defaultValue={o.status} onChange={(e) => upd(o.id, e.target.value)}>
              {['placed', 'shipped', 'delivered', 'cancelled'].map((s) => <option key={s}>{s}</option>)}
            </select></td>
          </tr>
        ))}
      </table>
    </>
  );
}

function Payouts() {
  const { toast } = useApp();
  const [rows, setRows] = useState<any[]>([]);
  const [amount, setAmount] = useState('250000');
  useEffect(() => { api('/vendor/payouts').then((r) => setRows(r.payouts)); }, []);
  const ask = async () => {
    await api('/vendor/payouts', { body: { amount_cents: Number(amount) } }).catch((e) => toast(e.data?.error));
    setRows(await api('/vendor/payouts').then((r) => r.payouts)); toast('payout requested — finance reviews before paying');
  };
  return (
    <>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="row">
          <label style={{ margin: 0 }}>amount (cents)</label><input value={amount} onChange={(e) => setAmount(e.target.value)} style={{ width: 140 }} />
          <button className="btn sm primary" onClick={ask}>request payout</button>
        </div>
        <p className="small muted">requests go straight to the finance review queue (PAY-402: balance verification happens at payout time, not here).</p>
      </div>
      <table>
        <tr><th>id</th><th>amount</th><th>bank</th><th>status</th><th>requested</th></tr>
        {rows.map((p) => <tr key={p.id}><td>{p.id}</td><td className={p.amount_cents > 1000000 ? 'amber' : ''}>{money(p.amount_cents)}</td><td className="mono small">{p.bank}</td><td><span className="pill warn">{p.status}</span></td><td>{new Date(p.created_at).toLocaleDateString()}</td></tr>)}
      </table>
    </>
  );
}

export default function Vendor() {
  const { user } = useApp();
  const [tab, setTab] = useState('products');
  const [vid, setVid] = useState(Number(localStorage.getItem(LS_VENDOR) || 0) || 0);
  const [me, setMe] = useState<any>(null);
  useEffect(() => { api('/vendor/me').then((r) => { setMe(r); if (r.vendor && !vid) { setVid(r.vendor.id); localStorage.setItem(LS_VENDOR, String(r.vendor.id)); } }); }, []);
  if (!user) return <div className="card">sign in to sell.</div>;
  if (me && !me.is_vendor) return <Apply />;
  const tabs: [string, any][] = [['products', <Products vid={vid} key="p" />], ['import', <ImportTab key="i" />], ['orders', <VendorOrders key="o" />], ['templates', <Templates key="t" />], ['payouts', <Payouts key="y" />]];
  return (
    <>
      <h1>Storefront console <span className="pill" style={{ verticalAlign: 'middle' }}>vendor context #{vid || (me?.vendor?.id ?? '?')}</span></h1>
      <div className="tabs">
        {tabs.map(([k]) => (
          <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>{k}</button>
        ))}
      </div>
      {tabs.find(([k]) => k === tab)?.[1]}
    </>
  );
}
