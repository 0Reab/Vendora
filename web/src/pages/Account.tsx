import React, { useEffect, useState } from 'react';
import { api, money } from '../api';
import { useApp } from '../store';

export default function Account() {
  const { user, refresh, toast } = useApp();
  const [me, setMe] = useState<any>(null);
  const [keys, setKeys] = useState<any[]>([]);
  const [prefs, setPrefs] = useState('{}');
  const [pw, setPw] = useState({ current_password: '', new_password: '' });
  const load = () => {
    api('/auth/me').then((m) => { setMe(m.user); setPrefs(m.user.bio_prefs || '{}'); });
    api('/auth/me/api-keys').then((r) => setKeys(r.keys)).catch(() => {});
  };
  useEffect(() => { load(); }, []);
  if (!me) return <p className="muted">loading… (sign in)</p>;
  const save = async (body: any) => {
    await api('/auth/me', { body, method: 'PATCH' }).catch((e) => toast(e.data?.error));
    toast('saved'); refresh();
  };
  const savePrefs = async () => {
    try { await save({ prefs: JSON.parse(prefs) }); } catch { toast('invalid json'); }
  };
  const addKey = async () => {
    const r = await api('/auth/me/api-keys', { body: { label: 'console ' + new Date().toISOString().slice(0, 10), scopes: ['read', 'write'] } });
    setKeys(await api('/auth/me/api-keys').then((x) => x.keys));
    toast('new key: ' + r.key);
  };
  const changePw = async () => {
    const r = await api('/auth/change-password', { body: pw }).catch((e) => ({ error: e.data?.error }));
    toast(r.ok ? 'password changed, sessions refreshed' : 'error: ' + r.error);
  };
  return (
    <>
      <h1>Account</h1>
      <div className="grid cols-2">
        <div className="card">
          <h3>profile</h3>
          <div className="field"><label>name</label><input defaultValue={me.name} onBlur={(e: any) => save({ name: e.target.value })} /></div>
          <div className="field"><label>job title</label><input defaultValue={me.job_title || ''} onBlur={(e: any) => save({ job_title: e.target.value })} /></div>
          <div className="field"><label>company</label><input defaultValue={me.company || ''} onBlur={(e: any) => save({ company: e.target.value })} /></div>
          <div className="field"><label>phone</label><input defaultValue={me.phone || ''} onBlur={(e: any) => save({ phone: e.target.value })} /></div>
          <h3>change password</h3>
          <div className="row">
            <input type="password" placeholder="current" value={pw.current_password} onChange={(e) => setPw({ ...pw, current_password: e.target.value })} />
            <input type="password" placeholder="new" value={pw.new_password} onChange={(e) => setPw({ ...pw, new_password: e.target.value })} />
            <button className="btn sm" onClick={changePw}>update</button>
          </div>
          <div className="kv" style={{ marginTop: 14 }}>
            <span className="k">wallet</span><span className="green">{money(me.wallet_cents)}</span>
            <span className="k">role</span><span>{me.role}</span>
            <span className="k">vendor</span><span>{me.is_vendor ? 'yes (storefront ' + me.vendor_id + ')' : 'no'}</span>
          </div>
          {!me.email_verified && <div className="pill warn" style={{ marginTop: 10 }}>email not verified</div>}
        </div>
        <div>
          <div className="card" style={{ marginBottom: 14 }}>
            <h3>interface preferences</h3>
            <p className="small muted">JSON blob consumed by the new settings page (migrated from v1 — legacy fields may be merged into defaults).</p>
            <textarea rows={6} value={prefs} onChange={(e) => setPrefs(e.target.value)} style={{ width: '100%' }} />
            <div className="row" style={{ marginTop: 8 }}>
              <button className="btn sm primary" onClick={savePrefs}>save preferences</button>
              <button className="btn sm" onClick={() => setPrefs('{"theme":"dark","density":"cozy"}')}>use defaults</button>
            </div>
          </div>
          <div className="card">
            <h3>API keys</h3>
            <table>
              {keys.map((k) => <tr key={k.id}><td className="mono">{k.prefix}…</td><td>{k.label}</td><td className="small muted">{k.scopes}</td>
                <td className="right"><button className="btn sm danger" onClick={async () => { await api('/auth/me/api-keys/' + k.id, { method: 'DELETE' }); load(); }}>revoke</button></td></tr>)}
            </table>
            <button className="btn sm" style={{ marginTop: 10 }} onClick={addKey}>create key</button>
            <p className="small muted">shown once; stored hashed. sandbox key used in the docs is the one from the guide page.</p>
          </div>
        </div>
      </div>
    </>
  );
}
