import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, money } from '../api';
import { useApp } from '../store';

export default function ProductDetail() {
  const { ref } = useParams();
  const { user, bumpCart, toast } = useApp();
  const [d, setD] = useState<any>(null);
  const [qty, setQty] = useState(1);
  const [rv, setRv] = useState({ rating: 5, title: '', body: '' });
  useEffect(() => { api('/products/' + ref).then(setD).catch(() => setD({ error: true })); }, [ref]);
  if (!d) return <p className="muted">loading…</p>;
  if (d.error) return <div className="card">Product not found.</div>;
  const p = d.product;
  const stars = (v: number) => '★'.repeat(Math.round(v || 0)) + '☆'.repeat(5 - Math.round(v || 0));

  const add = async () => {
    await api('/cart/add', { body: { product_id: p.id, qty } }).catch((e) => toast(e.message));
    bumpCart(); toast('added to cart');
  };
  const review = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return toast('sign in to review');
    await api('/reviews', { body: { product_id: p.id, ...rv } }).then(() => {
      toast('review posted'); setRv({ rating: 5, title: '', body: '' });
      api('/products/' + ref).then(setD);
    }).catch((e2) => toast(e2.message));
  };

  return (
    <>
      <div className="grid cols-2" style={{ alignItems: 'start' }}>
        <div>
          <img src={p.image} alt="" style={{ width: '100%', borderRadius: 10, background: '#0b0e13' }}
            onError={(e) => ((e.target as any).style.display = 'none')} />
        </div>
        <div className="card">
          <h1 style={{ marginTop: 0 }}>{p.name}</h1>
          <div className="row small muted">
            <Link to={`/shop?q=${encodeURIComponent(d.vendor?.name || '')}`}>{d.vendor?.name}</Link>
            <span className="stars">{stars(d.reviews.reduce((s: number, r: any) => s + r.rating, 0) / (d.reviews.length || 1))}</span>
            <span>{d.reviews.length} reviews</span>
          </div>
          <div style={{ margin: '12px 0' }}>
            <span className="price" style={{ fontSize: 24 }}>{money(p.price_cents)}</span>
            {p.compare_at_cents ? <span className="was">{money(p.compare_at_cents)}</span> : null}
          </div>
          <p>{p.description}</p>
          <div className="row">
            <input type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value))} style={{ width: 80 }} />
            <button className="btn primary" onClick={add}>Add to cart</button>
            {p.stock > 0 ? <span className="green small">{p.stock} in stock</span> : <span className="amber small">backorder</span>}
          </div>
          <div className="small muted" style={{ marginTop: 10 }}>SKU {p.sku} · {p.category}</div>
        </div>
      </div>
      <h2>Reviews <span className="muted small">rich text supported — **bold**, links and inline HTML render on the storefront (CAT-260 tracking sanitiser work)</span></h2>
      <form className="card" onSubmit={review} style={{ marginBottom: 16 }}>
        <div className="row">
          <select value={rv.rating} onChange={(e) => setRv({ ...rv, rating: Number(e.target.value) })}>
            {[1, 2, 3, 4, 5].map((n) => <option key={n}>{n}</option>)}
          </select>
          <input placeholder="review title" value={rv.title} onChange={(e) => setRv({ ...rv, title: e.target.value })} style={{ flex: 1 }} />
        </div>
        <textarea rows={3} placeholder="how did it perform on set?" value={rv.body} onChange={(e) => setRv({ ...rv, body: e.target.value })} style={{ width: '100%', marginTop: 8 }} />
        <button className="btn primary sm" style={{ marginTop: 8 }}>Post review</button>
      </form>
      {d.reviews.map((r: any) => (
        <div className="card" key={r.id} style={{ marginBottom: 8 }}>
          <div className="row small"><span className="stars">{stars(r.rating)}</span><b>{r.title}</b>
            <span className="muted right">{new Date(r.created_at).toLocaleDateString()}</span></div>
          {/* storefront renders verified-buyer content as authoring intended */}
          <div className="review-body" dangerouslySetInnerHTML={{ __html: r.body || '' }} />
        </div>
      ))}
      <h3>Similar in {p.category}</h3>
      <div className="grid cols-3">
        {d.related.map((r: any) => (
          <Link key={r.id} className="card pcard" to={`/product/${r.id}`} style={{ color: 'inherit' }}>
            <img src={r.image} alt="" loading="lazy" onError={(e) => ((e.target as any).style.display = 'none')} />
            <h3>{r.name}</h3><span className="price">{money(r.price_cents)}</span>
          </Link>
        ))}
      </div>
    </>
  );
}
