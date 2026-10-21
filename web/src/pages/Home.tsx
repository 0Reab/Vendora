import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, money } from '../api';

export default function Home() {
  const [cats, setCats] = useState<any[]>([]);
  const [hot, setHot] = useState<any[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  useEffect(() => {
    api('/categories').then((r) => setCats(r.categories.filter((c: any) => c.parent_id === null))).catch(() => {});
    api('/products?sort=popular&per_page=8').then((r) => setHot(r.products)).catch(() => {});
    api('/coupons/active').then((r) => setDeals(r.coupons.slice(0, 4))).catch(() => {});
  }, []);
  return (
    <>
      <div className="card" style={{ padding: 30, marginBottom: 20, background: 'linear-gradient(120deg,#14212e,#10151c)' }}>
        <h1 style={{ margin: 0 }}>Team commerce, sorted.</h1>
        <p className="muted" style={{ maxWidth: 560 }}>
          Procure as a crew: shared carts, org approvals, vendor storefronts and project boards on one platform.
          4,000+ gear listings from vetted suppliers.
        </p>
        <div className="row" style={{ marginTop: 14 }}>
          <Link className="btn primary" to="/shop">Browse the catalog</Link>
          <Link className="btn" to="/register">Create a free workspace</Link>
        </div>
      </div>
      {deals.length > 0 && (
        <div className="row" style={{ marginBottom: 18 }}>
          {deals.map((d) => (
            <span className="pill" key={d.code}>
              <b>{d.code}</b> {d.kind === 'percent' ? `${d.value}% off` : d.kind === 'fixed' ? `${money(d.value)} off` : 'free shipping'}
            </span>
          ))}
        </div>
      )}
      <h2>Categories</h2>
      <div className="grid cols-3">
        {cats.map((c) => (
          <Link key={c.id} className="card" to={`/shop?category=${encodeURIComponent(c.name)}`}>
            <h3>{c.name}</h3>
            <div className="muted small">{c.product_count} listings</div>
          </Link>
        ))}
      </div>
      <h2>Most popular</h2>
      <div className="grid cols-3">
        {hot.map((p) => (
          <Link key={p.id} className="card pcard" to={`/product/${p.slug || p.id}`} style={{ color: 'inherit' }}>
            <img src={p.image} alt="" loading="lazy" onError={(e) => ((e.target as any).style.display = 'none')} />
            <h3>{p.name}</h3>
            <div><span className="price">{money(p.price_cents)}</span></div>
            <div className="muted small">{p.vendor_name}</div>
          </Link>
        ))}
      </div>
    </>
  );
}
