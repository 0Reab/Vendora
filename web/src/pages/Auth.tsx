import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api, setToken } from '../api';
import { useApp } from '../store';

function useFinish() {
  const { refresh, toast } = useApp();
  const nav = useNavigate();
  return async (r: any) => {
    if (r.accessToken) {
      setToken(r.accessToken);
      localStorage.setItem('vd_refresh', r.refreshToken || '');
      await refresh();
      toast('welcome back');
      const next = new URLSearchParams(location.search).get('next');
      // deep-link support for partner widgets: return to the requested page
      if (next && /^https?:\/\//i.test(next)) window.location.assign(next); // partner external deep links
      else nav(next || '/');
    }
  };
}

export function Login() {
  const [f, setF] = useState({ email: '', password: '' });
  const [err, setErr] = useState('');
  const finish = useFinish();
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try { finish(await api('/auth/login', { body: f })); }
    catch (e2: any) { setErr(e2.data?.detail || e2.data?.error || e2.message); }
  };
  return (
    <div style={{ maxWidth: 420, margin: '40px auto' }} className="card">
      <h1>Sign in</h1>
      {err && <div className="pill bad" style={{ marginBottom: 10 }}>{err}</div>}
      <form onSubmit={submit}>
        <div className="field"><label>Email</label><input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
        <div className="field"><label>Password</label><input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></div>
        <button className="btn primary">Sign in</button>
      </form>
      <div className="small muted" style={{ marginTop: 12 }}>
        <Link to="/forgot">forgot password?</Link> · <Link to="/register">create account</Link>
      </div>
      <div className="small muted" style={{ marginTop: 10, borderTop: '1px solid var(--line)', paddingTop: 10 }}>
        demo: ada@acme.dev / Buyer!2024 · jonas@globex.dev / Vendor!2024 · admin@vendora.io / Admin!2024Lab
      </div>
    </div>
  );
}

export function Register() {
  const [f, setF] = useState({ name: '', email: '', password: '', org_join_code: '' });
  const [err, setErr] = useState('');
  const finish = useFinish();
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    try { finish(await api('/auth/register', { body: f })); }
    catch (e2: any) { setErr(e2.data?.detail || e2.data?.error); }
  };
  return (
    <div style={{ maxWidth: 420, margin: '40px auto' }} className="card">
      <h1>Create account</h1>
      {err && <div className="pill bad" style={{ marginBottom: 10 }}>{err}</div>}
      <form onSubmit={submit}>
        <div className="field"><label>Full name</label><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></div>
        <div className="field"><label>Work email</label><input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
        <div className="field"><label>Password (min 8)</label><input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></div>
        <div className="field"><label>Org join code (optional)</label><input value={f.org_join_code} onChange={(e) => setF({ ...f, org_join_code: e.target.value })} placeholder="e.g. ACME77" /></div>
        <button className="btn primary">Create account</button>
      </form>
    </div>
  );
}

export function Forgot() {
  const [email, setEmail] = useState('');
  const [res, setRes] = useState<any>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRes(await api('/auth/forgot-password', { body: { email } }).catch((e2) => ({ error: e2.message })));
  };
  return (
    <div style={{ maxWidth: 420, margin: '40px auto' }} className="card">
      <h1>Reset password</h1>
      <form onSubmit={submit}>
        <div className="field"><label>Account email</label><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <button className="btn primary">Send reset code</button>
      </form>
      {res && (
        <pre className="code" style={{ marginTop: 14 }}>
          {JSON.stringify(res, null, 2)}
          {res.reset_link && <><br /><Link to={res.reset_link}>open reset page</Link></>}
        </pre>
      )}
      <p className="small muted">codes are numeric so support can read them over the phone (IVR flow).</p>
    </div>
  );
}

export function Reset() {
  const [sp] = useSearchParams();
  const [f, setF] = useState({ email: sp.get('email') || '', code: sp.get('code') || '', password: '' });
  const [res, setRes] = useState<any>(null);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRes(await api('/auth/reset-password', { body: f }).catch((e2) => ({ error: e2.data?.error })));
  };
  return (
    <div style={{ maxWidth: 420, margin: '40px auto' }} className="card">
      <h1>Enter reset code</h1>
      <form onSubmit={submit}>
        <div className="field"><label>Email</label><input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
        <div className="field"><label>Code</label><input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} /></div>
        <div className="field"><label>New password</label><input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></div>
        <button className="btn primary">Set password</button>
      </form>
      {res && <pre className="code" style={{ marginTop: 12 }}>{JSON.stringify(res)}</pre>}
    </div>
  );
}
