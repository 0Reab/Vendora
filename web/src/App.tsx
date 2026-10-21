import React, { useState } from 'react';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useApp, usePostMessageBridge } from './store';
import { money, LS_ORG } from './api';


function Nav() {
  const { user, orgs, config, cartCount, logout } = useApp();
  const [q, setQ] = useState('');
  const [menu, setMenu] = useState(false);
  const nav = useNavigate();
  const loc = useLocation();
  const orgId = localStorage.getItem(LS_ORG);
  const curOrg = orgs.find((o) => String(o.id) === orgId);

  return (
    <>
      <div className="nav">
        <div className="nav-in">
          <Link className="logo" to="/">Vend<b>ora</b></Link>
          <Link className="navlink" to="/shop">Shop</Link>
          <Link className="navlink" to="/deals">Deals</Link>
          {user && <Link className="navlink" to="/org">Team</Link>}
          {user?.is_vendor && <Link className="navlink" to="/vendor">Sell</Link>}
          {user?.role === 'admin' && <Link className="navlink" to="/admin">Console</Link>}
          <form className="search" onSubmit={(e) => { e.preventDefault(); nav('/search?q=' + encodeURIComponent(q)); }}>
            <input placeholder="Search products, vendors, people…" value={q} onChange={(e) => setQ(e.target.value)} />
          </form>
          {orgs.length > 0 && (
            <select value={orgId || ''} onChange={(e) => { localStorage.setItem(LS_ORG, e.target.value); nav(loc.pathname); }}
              title="Active workspace">
              {orgs.map((o) => <option key={o.id} value={o.id}>{o.name} ({o.role})</option>)}
            </select>
          )}
          {user && <Link to="/cart" title="cart">Cart{cartCount ? ` (${cartCount})` : ''}</Link>}
          {user ? (
            <div style={{ position: 'relative' }}>
              <span className="avatar" onClick={() => setMenu(!menu)} style={{ cursor: 'pointer' }}>
                {(user.name || '?')[0]}
              </span>
              {menu && (
                <div className="card" style={{ position: 'absolute', right: 0, top: 38, width: 230, zIndex: 60 }}>
                  <div className="small mono">{user.email}</div>
                  {user.wallet_cents ? <div className="small">wallet {money(user.wallet_cents)}</div> : null}
                  <hr />
                  <Link to="/account">Account settings</Link><br />
                  <Link to="/orders">Orders</Link><br />
                  <Link to="/tickets">Support</Link><br />
                  <a href="#" onClick={(e) => { e.preventDefault(); setMenu(false); logout(); }}>Sign out</a>
                </div>
              )}
            </div>
          ) : (
            <Link className="btn sm" to="/login">Sign in</Link>
          )}
        </div>
      </div>
      {config.announcements && <div className="banner" dangerouslySetInnerHTML={{ __html: config.announcements }} />}
      {config.campaign_banner && <div className="banner" style={{ background: '#101a26' }} dangerouslySetInnerHTML={{ __html: config.campaign_banner }} />}
    </>
  );
}

export default function App() {
  usePostMessageBridge();
  const { config } = useApp();
  return (
    <>
      <Nav />
      <div className="wrap" style={{ marginTop: 24, minHeight: '60vh' }}>
        <Outlet />
      </div>
      <footer className="wrap" style={{ margin: '56px auto 30px', color: 'var(--muted)', fontSize: 13, borderTop: '1px solid var(--line)', paddingTop: 18 }}>
        <span dangerouslySetInnerHTML={{ __html: config?.footer_text || 'Vendora Inc.' }} /> ·
        <a href="/api-docs"> API docs</a> · <Link to="/contact">Contact</Link> · <Link to="/diagnostics">Status tools</Link>
        <div className="small" style={{ marginTop: 6 }}>v2.14.3 staging · <a href="/docs/integration-guide">integration guide</a></div>
      </footer>
    </>
  );
}

