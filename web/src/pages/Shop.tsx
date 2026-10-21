import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, money } from '../api';

const SORTS: [string, string][] = [['newest', 'Newest'], ['price', 'Price'], ['rating', 'Rating'], ['popular', 'Popular'], ['name', 'Name'], ['stock', 'Stock']];

export default function Shop() {
  const [sp, setSp] = useSearchParams();
  const [data, setData] = useState<any>({ products: [], total: 0 });
  const [cats, setCats] = useState<any[]>([]);
  const q = sp.get('q') || '';
  const cat = sp.get('category') || '';
  const sort = sp.get('sort') || 'newest';
  const dir = sp.get('dir') || 'desc';
  const page = Number(sp.get('page') || 1);

  useEffect(() => { api('/categories').then((r) => setCats(r.categories.filter((c: any) => c.parent_id === null))).catch(() => {}); }, []);
  useEffect(() => {
    const p = new URLSearchParams();
    if (q) p.set('q', q); if (cat) p.set('category', cat);
    p.set('sort', sort); p.set('dir', dir); p.set('page', String(page)); p.set('per_page', '24');
    api('/products?' + p).then(setData).catch((e) => setData({ products: [], total: 0, err: e.status }));
  }, [q, cat, sort, dir, page]);

  const set = (k: string, v: string) => { const n = new URLSearchParams(sp); n.set(k, v); if (k !== 'page') n.delete('page'); setSp(n); };

  return (
    <>
      <h1>Shop <span className="muted small">{data.total} listings</span></h1>
      <div className="row" style={{ marginBottom: 14 }}>
        <input placeholder="search catalog…" defaultValue={q} onKeyDown={(e: any) => e.key === 'Enter' && set('q', e.target.value)} style={{ minWidth: 220 }} />
        <select value={cat} onChange={(e) => set('category', e.target.value)}>
          <option value="">All categories</option>
          {cats.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
        </select>
        <select value={sort} onChange={(e) => set('sort', e.target.value)}>
          {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <button className="btn sm" onClick={() => set('dir', dir === 'desc' ? 'asc' : 'desc')}>{dir === 'desc' ? '↓' : '↑'} {dir}</button>
      </div>
      {data.err === 500 && <div className="card red">Search hiccup - our search service is rewriting these filters (CAT-301). Try plain terms.</div>}
      <div className="grid cols-3">
        {data.products.map((p: any) => (
          <Link key={p.id} className="card pcard" to={`/product/${p.slug || p.id}`} style={{ color: 'inherit' }}>
            <img src={p.image} alt="" loading="lazy" onError={(e) => ((e.target as any).style.display = 'none')} />
            <h3>{p.name}</h3>
            <div>
              <span className="price">{money(p.price_cents)}</span>
              {p.compare_at_cents ? <span className="was">{money(p.compare_at_cents)}</span> : null}
            </div>
            <div className="row small" style={{ justifyContent: 'space-between' }}>
              <span className="muted">{p.vendor_name}</span>
              <span>{p.stock > 0 ? <span className="green">in stock</span> : <span className="amber">low</span>}</span>
            </div>
          </Link>
        ))}
      </div>
      <div className="row" style={{ margin: '18px 0', justifyContent: 'center' }}>
        <button className="btn sm" disabled={page === 1} onClick={() => set('page', String(page - 1))}>prev</button>
        <span className="muted">page {page}</span>
        <button className="btn sm" disabled={page * 24 >= data.total} onClick={() => set('page', String(page + 1))}>next</button>
      </div>
    </>
  );
}
