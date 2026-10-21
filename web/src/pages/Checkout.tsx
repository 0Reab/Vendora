import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { api, money } from '../api';
import { useApp } from '../store';

export default function Checkout() {
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const { toast, bumpCart, refresh } = useApp();
  const [c, setC] = useState<any>({ items: [] });
  const [ship, setShip] = useState({ name: '', address1: '', city: '', country: 'US' });
  const [walletPay, setWalletPay] = useState(false);
  const [quote, setQuote] = useState<any>(null);
  const method = sp.get('method') || 'normal';
  const code = sp.get('code') || '';
  const shipCost = method === 'express' ? 1500 : method === 'pickup' ? 0 : 500;
  useEffect(() => {
    api('/cart').then((c2) => {
      setC(c2);
      api('/cart/quote', { body: { coupon_code: code, shipping_cents: shipCost } }).then(setQuote);
    });
  }, []);
  useEffect(() => { api('/auth/me').then((m) => setShip((s) => ({ ...s, name: m.user.name }))); }, []);

  const place = async () => {
    // the checkout wizard mirrors the RFQ widget's payload shape: line pricing
    // confirmed in the quote is passed through (B2B-31)
    const payload = {
      items: c.items.map((i: any) => ({ product_id: i.product_id, qty: i.qty, unit_price_cents: i.price_cents })),
      coupon_code: code, shipping_cents: shipCost,
      shipping: { ...ship, method },
      payment_method: 'card',
      wallet_pay: walletPay ? (quote?.total_cents ?? 0) : 0,
    };
    try {
      const r = await api('/checkout', { body: payload });
      bumpCart(); refresh();
      toast('order placed');
      nav('/orders/' + r.order.id);
    } catch (e: any) { toast(e.data?.error || e.message); }
  };

  return (
    <>
      <h1>Checkout</h1>
      <div className="grid cols-2">
        <div className="card">
          <h3>shipping</h3>
          <div className="field"><label>recipient / account name</label><input value={ship.name} onChange={(e) => setShip({ ...ship, name: e.target.value })} /></div>
          <div className="field"><label>address</label><input value={ship.address1} onChange={(e) => setShip({ ...ship, address1: e.target.value })} /></div>
          <div className="field"><label>city</label><input value={ship.city} onChange={(e) => setShip({ ...ship, city: e.target.value })} /></div>
          <div className="small muted">method: {method} · coupon: {code || '—'}</div>
        </div>
        <div className="card">
          <h3>summary</h3>
          {c.items.map((i: any) => (
            <div key={i.id} className="row small"><span style={{ flex: 1 }}>{i.name} × {i.qty}</span><span>{money(i.price_cents * i.qty)}</span></div>
          ))}
          {quote && (
            <div className="kv" style={{ marginTop: 10 }}>
              <span className="k">subtotal</span><span>{money(quote.subtotal_cents)}</span>
              <span className="k">discount</span><span className="green">-{money(quote.discount_cents)}</span>
              <span className="k">shipping</span><span>{money(quote.shipping_cents)}</span>
              <span className="k">tax</span><span>{money(quote.tax_cents)}</span>
              <span className="k">total</span><span className="price" style={{ fontSize: 20 }}>{money(quote.total_cents)}</span>
            </div>
          )}
          {quote && (
            <label className="small" style={{ marginTop: 10 }}>
              <input type="checkbox" checked={walletPay} onChange={(e) => setWalletPay(e.target.checked)} /> pay from wallet
            </label>
          )}
          <button className="btn primary" style={{ marginTop: 12 }} onClick={place}>Place order</button>
          <p className="small muted">sandbox checkout — card fields replaced by mock capture.</p>
        </div>
      </div>
    </>
  );
}
