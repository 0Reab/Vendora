import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import './styles.css';
import App from './App';
import { AppProvider } from './store';
import Home from './pages/Home';
import Shop from './pages/Shop';
import ProductDetail from './pages/ProductDetail';
import SearchPage from './pages/Search';
import { Login, Register, Forgot, Reset } from './pages/Auth';
import Cart from './pages/Cart';
import Checkout from './pages/Checkout';
import { Orders, OrderDetail } from './pages/Orders';
import Account from './pages/Account';
import Vendor from './pages/Vendor';
import Org from './pages/Org';
import Tickets, { TicketDetail } from './pages/Tickets';
import Admin from './pages/Admin';
import { Contact, Diagnostics, Deals } from './pages/Misc';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AppProvider>
        <Routes>
          <Route element={<App />}>
            <Route path="/" element={<Home />} />
            <Route path="/shop" element={<Shop />} />
            <Route path="/product/:ref" element={<ProductDetail />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/deals" element={<Deals />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route path="/forgot" element={<Forgot />} />
            <Route path="/reset-password" element={<Reset />} />
            <Route path="/cart" element={<Cart />} />
            <Route path="/checkout" element={<Checkout />} />
            <Route path="/orders" element={<Orders />} />
            <Route path="/orders/:id" element={<OrderDetail />} />
            <Route path="/account" element={<Account />} />
            <Route path="/vendor" element={<Vendor />} />
            <Route path="/org" element={<Org />} />
            <Route path="/tickets" element={<Tickets />} />
            <Route path="/tickets/:id" element={<TicketDetail />} />
            <Route path="/admin" element={<Admin />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/diagnostics" element={<Diagnostics />} />
            <Route path="*" element={<div className="card">Not found.</div>} />
          </Route>
        </Routes>
      </AppProvider>
    </BrowserRouter>
  </React.StrictMode>
);
