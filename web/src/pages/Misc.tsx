import React, { useEffect, useState } from 'react';
import { api, money } from '../api';
import { useApp } from '../store';

export function Contact() {
  const [f, setF] = useState({ name: '', email: '', subject: '', message: '' });
  const [res, setRes] = useState<any>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRes(await api('/contact', { body: f }).catch((e2) => ({ error: e2.data?.error })));
  };
  return (
    <div style={{ maxWidth: 520, margin: '30px auto' }} className="card">
      <h1>Contact sales</h1>
      {res && <div className="pill ok" style={{ marginBottom: 10 }}>{res.ticket_ref || res.error}</div>}
      <form onSubmit={submit}>
        <div className="field"><label>name</label><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div className="field"><label>email</label><input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
        <div className="field"><label>subject</label><input value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} /></div>
        <div className="field"><label>message</label><textarea rows={5} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} /></div>
        <button className="btn primary">Send</button>
      </form>
      <p className="small muted">we reply from support@vendora.io. your message is relayed as a plain-text email to the sales inbox.</p>
    </div>
  );
}

export function Deals() {
  const [c, setC] = useState<any[]>([]);
  useEffect(() => { api('/coupons/active').then((r) => setC(r.coupons)).catch(() => {}); }, []);
  return (
    <>
      <h1>Live deals</h1>
      <p className="muted small">marketing lists every active code (MARK-77). codes work while the banner counts them below.</p>
      <div className="grid cols-3">
        {c.map((x) => (
          <div key={x.code} className="card">
            <div className="price">{x.kind === 'percent' ? x.value + '% off' : x.kind === 'fixed' ? money(x.value) + ' off' : 'free shipping'}</div>
            <div className="mono" style={{ margin: '6px 0' }}>{x.code}</div>
            <div className="small muted">{x.terms}{x.min_subtotal_cents ? ` · min ${money(x.min_subtotal_cents)}` : ''}</div>
          </div>
        ))}
      </div>
    </>
  );
}

export function Diagnostics() {
  const { toast } = useApp();
  const [host, setHost] = useState('api.vendora.dev');
  const [out, setOut] = useState('');
  const run = async () => {
    const r = await api('/diagnostics/ping', { body: { host } }).catch((e) => ({ error: e.message }));
    setOut(typeof r.output === 'string' ? r.output : JSON.stringify(r, null, 2));
  };
  return (
    <>
      <h1>Runbook tools <span className="muted small">(ops section 7)</span></h1>
      <div className="card" style={{ maxWidth: 640 }}>
        <label>ping a host from the app box (traceroute flags supported)</label>
        <div className="row">
          <input value={host} onChange={(e) => setHost(e.target.value)} style={{ flex: 1 }} />
          <button className="btn primary" onClick={run}>run</button>
        </div>
        <pre className="code" style={{ marginTop: 12 }}>{out || 'no output yet'}</pre>
        <p className="small muted">used during the 09/2023 packet-loss incident; kept for the on-call rotation.</p>
      </div>
    </>
  );
}
