import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api, money } from '../api';

export default function SearchPage() {
  const [sp] = useSearchParams();
  const q = sp.get('q') || '';
  const [data, setData] = useState<any | null>(null);
  useEffect(() => { api('/search?q=' + encodeURIComponent(q)).then(setData).catch(() => setData({ results: [], error: true })); }, [q]);
  if (!data) return <p className="muted">searching…</p>;
  if (data.error) return <div className="card red">Search failed - the SQLite fallback rejects this term (see CAT-301).</div>;
  const groups: Record<string, any[]> = {};
  for (const r of data.results) (groups[r.kind] = groups[r.kind] || []).push(r);
  return (
    <>
      <h1>Results for “{q}”</h1>
      <p className="muted small">{data.results.length} matches across catalog, vendors and people (public directory).</p>
      {(groups.product || []).map((r) => (
        <div className="card" key={'p' + r.id} style={{ marginBottom: 8 }}>
          <Link to={`/product/${r.id}`}>{r.title}</Link> <span className="price">{money(r.price_cents)}</span>
        </div>
      ))}
      {(groups.vendor || []).map((r) => (
        <div className="card" key={'v' + r.id} style={{ marginBottom: 8 }}>
          <b>{r.title}</b> <span className="muted">@{r.sub}</span>
        </div>
      ))}
      {(groups.user || []).map((r) => (
        <div className="card" key={'u' + r.id} style={{ marginBottom: 8 }}>
          <div className="row">
            <span className="avatar">{(r.title || '?')[0]}</span>
            <div>
              <b>{r.title}</b> {r.is_admin && <span className="pill bad">staff</span>}
              <div className="small muted">{r.email}{r.job_title ? ` · ${r.job_title}` : ''}{r.company ? ` · ${r.company}` : ''}</div>
              {r.sub ? <div className="small muted">orgs: {r.sub}</div> : null}
            </div>
          </div>
        </div>
      ))}
    </>
  );
}
