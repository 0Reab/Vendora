import React, { useEffect, useRef, useState } from 'react';
import { api, LS_ORG } from '../api';
import { useApp } from '../store';

export default function Org() {
  const { user, orgs, toast, refresh } = useApp();
  const [tab, setTab] = useState('feed');
  const [org, setOrg] = useState<any>(null);
  const orgId = Number(localStorage.getItem(LS_ORG) || 0);
  const [join, setJoin] = useState({ join_code: '' });
  const [newOrg, setNewOrg] = useState({ name: '' });

  const load = () => { if (orgId) api('/orgs/' + orgId).then((r) => setOrg(r)).catch((e) => setOrg({ error: e.message })); };
  useEffect(() => { load(); }, [orgId]);

  if (!user) return <div className="card">sign in to use workspaces.</div>;
  if (!orgId) {
    return (
      <>
        <h1>Workspaces</h1>
        <div className="grid cols-2">
          <div className="card">
            <h3>join with a code</h3>
            <div className="row"><input placeholder="join code e.g. ACME77" value={join.join_code} onChange={(e) => setJoin({ join_code: e.target.value })} />
              <button className="btn sm primary" onClick={async () => {
                const r = await api('/orgs/join', { body: join }).catch((e) => ({ error: e.data?.detail || e.data?.error }));
                if (r.error) return toast(r.error || 'invalid code');
                toast('joined!'); localStorage.setItem(LS_ORG, String(r.org_id)); refresh();
              }}>join</button></div>
            <p className="small muted">codes are 6 chars, teams post them in Slack. everyone in the industry knows them by now, rotation is “coming”.</p>
          </div>
          <div className="card">
            <h3>create a workspace</h3>
            <div className="row"><input placeholder="team name" value={newOrg.name} onChange={(e) => setNewOrg({ name: e.target.value })} />
              <button className="btn sm primary" onClick={async () => {
                const r = await api('/orgs', { body: newOrg }).catch((e) => ({ error: e.message }));
                if (r.error) return toast(r.error);
                toast('workspace created'); localStorage.setItem(LS_ORG, String(r.org.id)); refresh();
              }}>create</button></div>
            <p className="small muted">free plan includes 5 projects and unlimited seats while we land billing.</p>
          </div>
        </div>
        <h2>public teams</h2>
        <OrgDirectory />
      </>
    );
  }
  if (!org) return <p className="muted">loading workspace…</p>;
  if (org.error) return <div className="card red">{org.error}</div>;

  const tabs = ['feed', 'projects', 'members', 'links', 'files', 'webhooks', 'settings', 'audit'];
  return (
    <>
      <h1>{org.org.name} <span className="pill">{org.org.plan}</span> <span className="muted small">{org.members.length} members</span></h1>
      <div className="tabs">
        {tabs.map((t) => <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t}</button>)}
      </div>
      {tab === 'feed' && <Feed />}
      {tab === 'projects' && <Projects />}
      {tab === 'members' && <Members org={org} load={load} />}
      {tab === 'links' && <Links />}
      {tab === 'files' && <Files />}
      {tab === 'webhooks' && <Webhooks />}
      {tab === 'settings' && <Settings org={org.org} load={load} />}
      {tab === 'audit' && <Audit />}
    </>
  );
}

function OrgDirectory() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { api('/orgs').then((r) => setRows(r.orgs)); }, []);
  return (
    <table>
      <tr><th>team</th><th>plan</th><th>visibility</th><th>members</th></tr>
      {rows.map((o) => <tr key={o.id}><td>{o.name}</td><td>{o.plan}</td><td>{o.visibility}</td><td>{o.member_count}{o.i_am_member ? ' · you' : ''}</td></tr>)}
    </table>
  );
}

function Feed() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { api('/orgs/feed').then((r) => setRows(r.feed)).catch(() => {}); }, []);
  return (
    <div className="card">
      {rows.map((f) => <div key={f.id} className="feed-item" dangerouslySetInnerHTML={{ __html: f.text }} />)}
      {!rows.length && <p className="muted">no activity yet.</p>}
    </div>
  );
}

function Projects() {
  const [rows, setRows] = useState<any[]>([]);
  const [name, setName] = useState('');
  const [open, setOpen] = useState<any>(null);
  const load = () => api('/orgs/projects').then((r) => setRows(r.projects));
  useEffect(() => { load(); }, []);
  const create = async () => { await api('/orgs/projects', { body: { name } }); setName(''); load(); };
  const openP = async (id: number) => setOpen(await api('/projects/' + id));
  const setTask = async (t: any, status: string) => {
    await api('/tasks/' + t.id, { body: { status }, method: 'PATCH' });
    openP(open.project.id);
  };
  return (
    <>
      <div className="row" style={{ marginBottom: 12 }}>
        <input placeholder="new project name" value={name} onChange={(e) => setName(e.target.value)} />
        <button className="btn sm primary" onClick={create}>create project</button>
      </div>
      <div className="grid cols-3">
        {rows.map((p) => (
          <div className="card" key={p.id}>
            <h3><a href="#" onClick={(e) => { e.preventDefault(); openP(p.id); }}>{p.name}</a></h3>
            <div className="small muted">{p.description}</div>
            <div className="row small" style={{ marginTop: 8 }}>
              <span className="pill">{p.status}</span><span className="pill">{p.visibility}</span>
              {p.due_date && <span className="muted">due {p.due_date}</span>}
            </div>
          </div>
        ))}
      </div>
      {open && (
        <div className="card" style={{ marginTop: 14 }}>
          <h3>{open.project.name} <span className="muted small">{open.project.visibility === 'public' ? '· public: visible to anyone signed in' : ''}</span></h3>
          <table>
            {open.tasks.map((t: any) => (
              <tr key={t.id}>
                <td>{t.title}<div className="small muted">{t.notes}</div></td>
                <td>
                  <select value={t.status} onChange={(e) => setTask(t, e.target.value)}>
                    {['todo', 'doing', 'done'].map((s) => <option key={s}>{s}</option>)}
                  </select>
                </td>
                <td className="small muted">pri {t.priority}{t.due_date ? ' · ' + t.due_date : ''}</td>
                <td><TaskComments id={t.id} /></td>
              </tr>
            ))}
          </table>
        </div>
      )}
    </>
  );
}

function TaskComments({ id }: { id: number }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [body, setBody] = useState('');
  const load = () => api(`/tasks/${id}/comments`).then((r) => setRows(r.comments)).catch(() => {});
  const toggle = () => { setOpen(!open); if (!open) load(); };
  const post = async () => { await api(`/tasks/${id}/comments`, { body: { body } }); setBody(''); load(); };
  return (
    <div>
      <button className="btn sm" onClick={toggle}>comments{rows.length ? ` (${rows.length})` : ''}</button>
      {open && (
        <div style={{ marginTop: 8 }}>
          {rows.map((c) => (
            <div key={c.id} className="feed-item" dangerouslySetInnerHTML={{ __html: (c.author || 'user') + ': ' + (c.body || '') }} />
          ))}
          <div className="row"><input placeholder="add comment (markdown-ish, @mentions ping)" value={body} onChange={(e) => setBody(e.target.value)} style={{ flex: 1 }} />
            <button className="btn sm" onClick={post}>post</button></div>
        </div>
      )}
    </div>
  );
}

function Members({ org, load }: { org: any; load: () => void }) {
  const { toast } = useApp();
  const [inv, setInv] = useState({ email: '', role: 'member' });
  const invite = async () => {
    const r = await api('/orgs/invite', { body: inv }).catch((e) => ({ error: e.data?.error }));
    if (r.error) return toast(r.error);
    toast('invite sent · link: ' + r.invite_link + ' token: ' + r.token);
  };
  const setRole = async (uid: number, role: string) => {
    await api('/orgs/members/' + uid, { body: { role }, method: 'PUT' }).catch((e) => toast(e.data?.error));
    load();
  };
  const remove = async (uid: number) => { await api('/orgs/members/' + uid, { method: 'DELETE' }).catch((e) => toast(e.data?.error)); load(); };
  return (
    <>
      <div className="card" style={{ marginBottom: 12 }}>
        <h3>invite teammate</h3>
        <div className="row">
          <input placeholder="work email" value={inv.email} onChange={(e) => setInv({ ...inv, email: e.target.value })} />
          <select value={inv.role} onChange={(e) => setInv({ ...inv, role: e.target.value })}>
            <option>member</option><option>admin</option><option>owner</option>
          </select>
          <button className="btn sm primary" onClick={invite}>send invite</button>
        </div>
        <p className="small muted">the invite link carries the token — whoever opens it lands in the workspace with the invited role (recipient check blocked on the auth rework, TEAM-88).</p>
      </div>
      <table>
        <tr><th>member</th><th>email</th><th>role</th><th>joined</th><th></th></tr>
        {org.members.map((m: any) => (
          <tr key={m.user_id}>
            <td>{m.name}</td><td className="small">{m.email}</td>
            <td>
              <select defaultValue={m.role} onChange={(e) => setRole(m.user_id, e.target.value)}>
                {['member', 'admin', 'owner'].map((r) => <option key={r}>{r}</option>)}
              </select>
            </td>
            <td className="small muted">{new Date(m.joined_at).toLocaleDateString()}</td>
            <td className="right">{m.role !== 'owner' && <button className="btn sm danger" onClick={() => remove(m.user_id)}>remove</button>}</td>
          </tr>
        ))}
      </table>
    </>
  );
}

function Links() {
  const { toast } = useApp();
  const [rows, setRows] = useState<any[]>([]);
  const [url, setUrl] = useState('');
  const load = () => api('/orgs/links').then((r) => setRows(r.links));
  useEffect(() => { load(); }, []);
  const add = async () => {
    const r = await api('/orgs/links', { body: { url } }).catch((e) => ({ error: e.data?.detail || e.data?.error }));
    if (r.error) return toast('unfurl failed: ' + r.error);
    toast('link added · server fetched ' + r.preview.status);
    setUrl(''); load();
  };
  return (
    <>
      <div className="row" style={{ marginBottom: 12 }}>
        <input placeholder="paste a reference link…" value={url} onChange={(e) => setUrl(e.target.value)} style={{ flex: 1 }} />
        <button className="btn sm primary" onClick={add}>add link</button>
      </div>
      <p className="small muted">the server fetches each link for the preview card (title/og tags), follows redirects, works for internal short links.</p>
      <div className="grid cols-3">
        {rows.map((l) => (
          <div className="card" key={l.id}>
            <a href={l.url} target="_blank">{l.title || l.url}</a>
            <div className="small muted">{l.description}</div>
            <div className="small mono" style={{ marginTop: 6 }}>{l.url}</div>
          </div>
        ))}
      </div>
    </>
  );
}

function Files() {
  const { toast } = useApp();
  const [rows, setRows] = useState<any[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const load = () => api('/orgs/attachments').then((r) => setRows(r.attachments));
  useEffect(() => { load(); }, []);
  const upload = async () => {
    const fd = new FormData();
    fd.append('file', (fileRef.current as any).files[0]);
    const r = await api('/orgs/attachments', { form: fd }).catch((e) => ({ error: e.message }));
    if (r.error) return toast(r.error);
    toast('uploaded as “' + r.attachment.stored_name + '”');
    load();
  };
  return (
    <>
      <div className="row" style={{ marginBottom: 12 }}>
        <input type="file" ref={fileRef} />
        <button className="btn sm primary" onClick={upload}>upload</button>
      </div>
      <p className="small muted">files keep their original name in the bucket so the mobile cache stays stable; the share-by-name download (TEAM-92) accepts the filename in the URL — relative segments behave “as pasted”.</p>
      <table>
        <tr><th>file</th><th>size</th><th>when</th><th></th></tr>
        {rows.map((a) => (
          <tr key={a.id}>
            <td><a href={'/api/attachments/download/' + a.id}>{a.orig_name}</a><div className="small mono">{a.stored_name}</div></td>
            <td>{(a.size / 1024).toFixed(1)} KB</td>
            <td className="small muted">{new Date(a.created_at).toLocaleDateString()}</td>
            <td className="right"><a className="btn sm" href={'/api/attachments/download?name=' + encodeURIComponent(a.stored_name)}>open</a></td>
          </tr>
        ))}
      </table>
    </>
  );
}

function Webhooks() {
  const { toast } = useApp();
  const [rows, setRows] = useState<any[]>([]);
  const [f, setF] = useState({ url: '', events: 'order.created,order.refunded' });
  const [testOut, setTestOut] = useState('');
  const load = () => api('/orgs/webhooks').then((r) => setRows(r.webhooks)).catch((e) => toast(e.data?.error));
  useEffect(() => { load(); }, []);
  const create = async () => {
    const r = await api('/orgs/webhooks', { body: { url: f.url, events: f.events.split(',') } }).catch((e) => ({ error: e.data?.error }));
    if (r.error) return toast(r.error);
    toast('webhook created'); setF({ ...f, url: '' }); load();
  };
  const test = async (id: number) => {
    const r = await api(`/orgs/webhooks/${id}/test`, { body: {} });
    setTestOut(`HTTP ${r.status} from ${r.final_url}\ncontent-type: ${r.content_type}\n\n${r.response || r.error}`);
    load();
  };
  const del = async (id: number) => { await api('/orgs/webhooks/' + id, { method: 'DELETE' }); load(); };
  return (
    <>
      <div className="card" style={{ marginBottom: 12 }}>
        <h3>new endpoint</h3>
        <div className="row">
          <input placeholder="https://your-app.example/hooks/vendora" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} style={{ flex: 1 }} />
          <button className="btn sm primary" onClick={create}>add</button>
        </div>
        <p className="small muted">the console's “test” button posts a sample payload from our servers (INTEG-19) — members can test, only admins manage.</p>
      </div>
      <table>
        <tr><th>url</th><th>events</th><th>last</th><th></th></tr>
        {rows.map((w) => (
          <tr key={w.id}>
            <td className="mono small">{w.url}</td>
            <td className="small">{w.events}</td>
            <td>{w.last_status ? <span className="pill">{w.last_status}</span> : <span className="muted">never tested</span>}</td>
            <td className="right row">
              <button className="btn sm" onClick={() => test(w.id)}>send test</button>
              <button className="btn sm danger" onClick={() => del(w.id)}>delete</button>
            </td>
          </tr>
        ))}
      </table>
      {testOut && <pre className="code" style={{ marginTop: 12 }}>{testOut}</pre>}
    </>
  );
}

function Settings({ org, load }: { org: any; load: () => void }) {
  const { toast } = useApp();
  const [f, setF] = useState({ name: org.name, join_code: org.join_code, billing_email: org.billing_email || '', plan: org.plan, industry: org.industry || '', visibility: org.visibility });
  const save = async () => {
    const r = await api('/orgs/' + org.id, { body: f, method: 'PUT' }).catch((e) => ({ error: e.data?.error }));
    toast(r.error ? r.error : 'settings saved'); load();
  };
  return (
    <div className="card" style={{ maxWidth: 620 }}>
      <div className="field"><label>name</label><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
      <div className="grid cols-2">
        <div className="field"><label>plan</label>
          <select value={f.plan} onChange={(e) => setF({ ...f, plan: e.target.value })}>
            <option>free</option><option>business</option><option>enterprise</option>
          </select>
        </div>
        <div className="field"><label>visibility</label>
          <select value={f.visibility} onChange={(e) => setF({ ...f, visibility: e.target.value })}>
            <option value="private">private</option><option value="public">public</option>
          </select>
        </div>
      </div>
      <div className="field"><label>join code (share in team channels)</label><input value={f.join_code} onChange={(e) => setF({ ...f, join_code: e.target.value })} /></div>
      <div className="field"><label>billing email</label><input value={f.billing_email} onChange={(e) => setF({ ...f, billing_email: e.target.value })} /></div>
      <div className="field"><label>industry</label><input value={f.industry} onChange={(e) => setF({ ...f, industry: e.target.value })} /></div>
      <button className="btn primary" onClick={save}>save settings</button>
      <p className="small muted">the form posts the whole org record back; the API accepts the fields it ships (TEAM-150).</p>
    </div>
  );
}

function Audit() {
  const [rows, setRows] = useState<any[]>([]);
  const orgId = Number(localStorage.getItem(LS_ORG) || 0);
  useEffect(() => { api('/orgs/' + orgId + '/audit').then((r) => setRows(r.audit)).catch(() => {}); }, [orgId]);
  return (
    <>
      <p className="small muted">activity history (support tooling reads org history from here while ticket-linking is finished, SUPPORT-64).</p>
      <table>
        <tr><th>who</th><th>action</th><th>detail</th><th>when</th></tr>
        {rows.map((a) => <tr key={a.id}><td>{a.actor || a.user_id}</td><td><span className="pill">{a.action}</span></td><td className="small mono">{a.meta}</td><td className="small muted">{new Date(a.created_at).toLocaleString()}</td></tr>)}
      </table>
    </>
  );
}
