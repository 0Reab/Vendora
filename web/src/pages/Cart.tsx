import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, money } from '../api';
import { useApp } from '../store';

export default function Cart() {
  const { bumpCart, toast, user } = useApp();
  const [c, setC] = useState<any>({ items: [] });
  const [quote, setQuote] = useState<any>(null);
  const [code, setCode] = useState('');
  const [method, setMethod] = useState('normal');
  const nav = useNavigate();
  const shipCost = method === 'express' ? 1500 : method === 'pickup' ? 0 : 500;
  const load = () => api('/cart').then((c2) => { setC(c2); bumpCart(); });
  useEffect(() => { load(); }, []);
  useEffect(() => {
    api('/cart/quote', { body: { coupon_code: code, shipping_cents: shipCost } })
      .then(setQuote).catch(() => setQuote(null));
  }, [code, method, c.items.length]);

  const setQty = async (id: number, qty: number) => { await api('/cart/items/' + id, { body: { qty }, method: 'PUT' }); load(); };
  const del = async (id: number) => { await api('/cart/items/' + id, { method: 'DELETE' }); load(); };

  const items = c.items || [];
  return (
    <>
      <h1>Cart</h1>
      {items.length === 0 && <div className="card">empty — <Link to="/shop">browse catalog</Link></div>}
      <table>
        {items.map((i: any) => (
          <tr key={i.id}>
            <td><Link to={'/product/' + i.product_id}>{i.name}</Link><div className="small muted">{i.vendor_name}</div></td>
            <td><input type="number" value={i.qty} style={{ width: 70 }} onChange={(e) => setQty(i.id, Number(e.target.value))} /></td>
            <td>{money(i.price_cents)}</td>
            <td className="right">{money(i.price_cents * i.qty)}</td>
            <td><button className="btn sm danger" onClick={() => del(i.id)}>remove</button></td>
          </tr>
        ))}
      </table>
      <div className="grid cols-2" style={{ marginTop: 16 }}>
        <div className="card">
          <label>coupon code</label>
          <div className="row">
            <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="try TEAMTREAT" />
          </div>
          <label style={{ marginTop: 12 }}>delivery</label>
          <select value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="normal">standard · $5.00</option>
            <option value="express">express · $15.00</option>
            <option value="pickup">studio pickup · free</option>
          </select>
        </div>
        <div className="card">
          {quote && (
            <div className="kv">
              <span className="k">subtotal</span><span>{money(quote.subtotal_cents)}</span>
              <span className="k">discount</span><span className="green">-{money(quote.discount_cents)}</span>
              <span className="k">shipping</span><span>{money(quote.shipping_cents)}</span>
              <span className="k">tax</span><span>{money(quote.tax_cents)}</span>
              <span className="k"><b>total</b></span><span className="price" style={{ fontSize: 20 }}>{money(quote.total_cents)}</span>
            </div>
          )}
          <button className="btn primary" style={{ marginTop: 12 }}
            onClick={() => user ? nav(`/checkout?code=${encodeURIComponent(code)}&method=${method}`) : nav('/login?next=/checkout')}>
            Checkout
          </button>
        </div>
      </div>
    </>
  );
}
