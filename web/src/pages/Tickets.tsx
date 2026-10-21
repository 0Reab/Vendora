import React, { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api';
import { useApp } from '../store';

const statusPill = (s: string) => <span className={`pill ${s === 'open' ? 'bad' : s === 'pending' ? 'warn' : 'ok'}`}>{s}</span>;

export default function Tickets() {
  const { user, toast } = useApp();
  const [rows, setRows] = useState<any[]>([]);
  const [orgRows, setOrgRows] = useState<any[]>([]);
  const [f, setF] = useState({ subject: '', body: '', priority: 3 });
  useEffect(() => {
    api('/support/tickets').then((r) => { setRows(r.tickets); setOrgRows(r.org_tickets || []); }).catch(() => {});
  }, []);
  const create = async () => {
    const r = await api('/support/tickets', { body: f }).catch((e) => ({ error: e.data?.error }));
    if (r.error) return toast(r.error);
    toast('ticket #' + r.ticket.id + ' opened');
    setRows(await api('/support/tickets').then((x) => x.tickets));
  };
  if (!user) return <div className="card">sign in to open tickets.</div>;
  return (
    <>
      <h1>Support</h1>
      <div className="card" style={{ marginBottom: 14 }}>
        <h3>new ticket</h3>
        <div className="row">
          <input placeholder="subject" value={f.subject} onChange={(e) => setF({ ...f, subject: e.target.value })} style={{ flex: 1 }} />
          <select value={f.priority} onChange={(e) => setF({ ...f, priority: Number(e.target.value) })}>
            <option value={1}>urgent</option><option value={3}>normal</option><option value={5}>low</option>
          </select>
        </div>
        <textarea rows={3} placeholder="what happened?" value={f.body} onChange={(e) => setF({ ...f, body: e.target.value })} style={{ width: '100%', marginTop: 8 }} />
        <button className="btn sm primary" style={{ marginTop: 8 }} onClick={create}>open ticket</button>
      </div>
      {orgRows.length > 0 && (<>
        <h3>team tickets <span className="muted small">(org admins see their workspace)</span></h3>
        <table>{orgRows.map((t) => <tr key={t.id}><td><Link to={'/tickets/' + t.id}>#{t.id} {t.subject}</Link></td><td>{statusPill(t.status)}</td></tr>)}</table>
        <hr /></>)}
      <table>
        <tr><th>#</th><th>subject</th><th>status</th><th>msgs</th><th>updated</th></tr>
        {rows.map((t) => (
          <tr key={t.id}>
            <td><Link to={'/tickets/' + t.id}>#{t.id}</Link></td>
            <td>{t.subject}</td>
            <td>{statusPill(t.status)}</td>
            <td>{t.msg_count}</td>
            <td className="small muted">{new Date(t.updated_at).toLocaleDateString()}</td>
          </tr>
        ))}
      </table>
    </>
  );
}

export function TicketDetail() {
  const { id } = useParams();
  const { user, toast } = useApp();
  const [d, setD] = useState<any>(null);
  const [body, setBody] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const load = () => api('/support/tickets/' + id).then(setD).catch((e) => setD({ error: e.data?.error }));
  useEffect(() => { load(); }, [id]);
  if (!d) return <p className="muted">loading…</p>;
  if (d.error) return <div className="card red">{d.error}</div>;
  const reply = async () => {
    await api(`/support/tickets/${id}/messages`, { body: { body } });
    setBody(''); load();
  };
  const upload = async () => {
    const fd = new FormData();
    fd.append('file', (fileRef.current as any).files[0]);
    const r = await api(`/support/tickets/${id}/attachments`, { form: fd }).catch((e) => ({ error: e.message }));
    toast(r.error || 'attachment added · id ' + r.attachment.id);
    load();
  };
  const close = async () => { await api('/support/tickets/' + id, { body: { status: 'closed' }, method: 'PATCH' }); load(); };
  return (
    <>
      <h1>#{d.ticket.id} {d.ticket.subject} {statusPill(d.ticket.status)}</h1>
      <p className="small muted">ticket links are shareable inside your company — any signed-in teammate with the URL can read the thread (SUPPORT-77).</p>
      <div className="card">
        {d.messages.map((m: any) => (
          <div key={m.id} className="feed-item">
            <b className={m.is_agent ? 'green' : ''}>{m.is_agent ? 'Vendora Support' : (m.author || 'you')}</b>
            <span className="muted small right">{new Date(m.created_at).toLocaleString()}</span>
            <div style={{ whiteSpace: 'pre-wrap' }}>{m.body}</div>
          </div>
        ))}
      </div>
      <div className="row" style={{ marginTop: 12 }}>
        <input placeholder="reply…" value={body} onChange={(e) => setBody(e.target.value)} style={{ flex: 1 }} />
        <button className="btn sm primary" onClick={reply}>send</button>
        <input type="file" ref={fileRef} style={{ width: 200 }} />
        <button className="btn sm" onClick={upload}>attach</button>
        <button className="btn sm danger" onClick={close}>close ticket</button>
      </div>
    </>
  );
}
