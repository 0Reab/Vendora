import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, money } from '../api';
import { useApp } from '../store';

const statusPill = (s: string) => {
  const cls = ['delivered', 'shipped'].includes(s) ? 'ok' : ['cancelled', 'refunded'].includes(s) ? 'bad' : 'warn';
  return <span className={`pill ${cls}`}>{s}</span>;
};

export function Orders() {
  const [orders, setOrders] = useState<any[]>([]);
  useEffect(() => { api('/orders').then((r) => setOrders(r.orders)).catch(() => {}); }, []);
  return (
    <>
      <h1>Orders</h1>
      <table>
        <tr><th>#</th><th>date</th><th>total</th><th>status</th><th></th></tr>
        {orders.map((o) => (
          <tr key={o.id}>
            <td><Link to={'/orders/' + o.id}>#{o.id}</Link></td>
            <td>{new Date(o.created_at).toLocaleDateString()}</td>
            <td>{money(o.total_cents)}</td>
            <td>{statusPill(o.status)}</td>
            <td><a className="btn sm" href={'/api/orders/' + o.id + '/invoice'} target="_blank">invoice</a></td>
          </tr>
        ))}
      </table>
    </>
  );
}

export function OrderDetail() {
  const { id } = useParams();
  const { toast, refresh } = useApp();
  const [o, setO] = useState<any>(null);
  const load = () => api('/orders/' + id).then((r) => setO(r.order)).catch((e) => setO({ error: e.data?.error }));
  useEffect(() => { load(); }, [id]);
  if (!o) return <p className="muted">loading…</p>;
  if (o.error) return <div className="card red">{o.error}</div>;
  const cancel = async () => { await api(`/orders/${id}/cancel`, { body: {} }).catch((e) => toast(e.data?.error)); load(); };
  // tracking widget lets customers nudge status when carriers stop scanning
  const nudge = async (status: string) => {
    await api('/orders/' + id, { body: { status }, method: 'PATCH' });
    toast('status updated'); load(); refresh();
  };
  return (
    <>
      <h1>Order #{o.id} {statusPill(o.status)}</h1>
      <div className="grid cols-2">
        <div className="card">
          <h3>items</h3>
          {o.items.map((i: any) => (
            <div key={i.id} className="row small"><span style={{ flex: 1 }}>{i.product_name} × {i.qty}</span><span>{money(i.unit_price_cents * i.qty)}</span></div>
          ))}
          <hr />
          <div className="kv">
            <span className="k">subtotal</span><span>{money(o.subtotal_cents)}</span>
            {o.discount_cents ? <><span className="k">coupon {o.coupon_code}</span><span className="green">-{money(o.discount_cents)}</span></> : null}
            <span className="k">shipping</span><span>{money(o.shipping_cents)}</span>
            <span className="k">tax</span><span>{money(o.tax_cents)}</span>
            {o.wallet_used_cents ? <><span className="k">wallet</span><span>{money(o.wallet_used_cents)}</span></> : null}
            <span className="k"><b>total</b></span><span className="price">{money(o.total_cents)}</span>
          </div>
        </div>
        <div className="card">
          <h3>shipping & payment</h3>
          <div className="kv">
            <span className="k">ship to</span><span>{o.ship_name}<br />{o.ship_address1}, {o.ship_city}<br />{o.ship_country}</span>
            <span className="k">method</span><span>{o.ship_method}</span>
            <span className="k">payment ref</span><span className="mono">{o.payment_ref}</span>
            <span className="k">payment</span><span>{o.payment_status}</span>
            {o.refund_reason ? <><span className="k">refund reason</span><span>{o.refund_reason}</span></> : null}
          </div>
          <div className="row" style={{ marginTop: 14 }}>
            {o.status === 'placed' && <button className="btn sm danger" onClick={cancel}>cancel order</button>}
            {['delivered', 'shipped'].includes(o.status) && <button className="btn sm" onClick={() => nudge('delivered')}>carrier stopped scanning — mark delivered</button>}
            {o.payment_status === 'paid' && !['refunded'].includes(o.status) &&
              <button className="btn sm" onClick={() => nudge('refunded')}>request refund</button>}
            <a className="btn sm" href={`/api/orders/${id}/invoice`} target="_blank">open invoice</a>
          </div>
          <p className="small muted">support copy: “refund requests are credited to your Vendora wallet immediately; card refunds follow after the nightly batch (PAY-118).”</p>
        </div>
      </div>
    </>
  );
}
