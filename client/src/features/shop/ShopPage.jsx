import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import CitizenShell, { resolveAssetUrl } from '../../layouts/CitizenShell.jsx';
import Modal from '../../components/Modal.jsx';
import DemoPaymentPanel from '../../components/DemoPaymentPanel.jsx';
import RouteLoading from '../../components/RouteLoading.jsx';
import { useSubmissionLock } from '../../hooks/useSubmissionLock.js';
import { apiRequest } from '../../services/api.js';
import { alerts } from '../../utils/alerts.js';

export function calculateCartTotal(rows) {
  return rows.reduce((sum, row) => sum + (Number(row.price) * Number(row.quantity)), 0);
}

function money(value) {
  const number = Number(value);
  return Number.isFinite(number) ? `৳ ${number.toFixed(2)}` : '৳ 0.00';
}

function safeProductImage(value) {
  if (!value || value.includes('<') || value.includes('>')) return '';
  return resolveAssetUrl(value);
}

export default function ShopPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState([]);
  const [cart, setCart] = useState([]);
  const [modal, setModal] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const actionLocks = useRef(new Set());
  const { submitting, runLocked } = useSubmissionLock();

  const load = useCallback(async () => {
    setError('');
    try {
      const [productRows, cartRows] = await Promise.all([
        apiRequest('/api/shop/items'),
        apiRequest('/api/shop/cart')
      ]);
      setItems(Array.isArray(productRows) ? productRows : []);
      setCart(Array.isArray(cartRows) ? cartRows : []);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const status = searchParams.get('status');
    const orderId = searchParams.get('order_id');
    if (status === 'success') {
      setNotice(`Payment return received for order ${orderId || 'unknown'}, but payment is not confirmed because the current callback is not cryptographically verified.`);
    } else if (status === 'fail') {
      setNotice(`Payment failed${orderId ? ` for order ${orderId}` : ''}.`);
    } else if (status === 'cancel') {
      setNotice('Payment was cancelled.');
    } else if (status === 'error') {
      setNotice('The payment return reported an error.');
    }
  }, [searchParams]);

  async function once(key, action) {
    if (actionLocks.current.has(key)) return;
    actionLocks.current.add(key);
    try { await action(); } finally { actionLocks.current.delete(key); }
  }

  async function addToCart(itemId) {
    await once(`add-${itemId}`, async () => {
      try {
        await apiRequest('/api/shop/cart', { method: 'POST', body: { item_id: itemId, quantity: 1 } });
        const rows = await apiRequest('/api/shop/cart');
        setCart(rows);
        await alerts.success('Added to Cart!', 'The item is now in your cart.');
      } catch (requestError) {
        setError(requestError.message);
      }
    });
  }

  async function removeFromCart(cartId) {
    await once(`remove-${cartId}`, async () => {
      try {
        await apiRequest(`/api/shop/cart/${cartId}`, { method: 'DELETE' });
        setCart(current => current.filter(row => row.cart_id !== cartId));
      } catch (requestError) {
        setError(requestError.message);
      }
    });
  }

  async function checkout(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    await runLocked(async () => {
      try {
        const data = await apiRequest('/api/shop/order', {
          method: 'POST',
          body: {
            contact_number: formElement.elements.contact_number.value,
            delivery_address: formElement.elements.delivery_address.value,
            payment_method: 'COD'
          }
        });
        if (!data.success) throw new Error(data.error || 'Order could not be placed');
        setCart([]);
        setModal(null);
        await alerts.success('Order Placed!', data.message);
      } catch (requestError) {
        setError(requestError.message);
        await alerts.error(requestError.message);
      }
    });
  }

  const total = useMemo(() => calculateCartTotal(cart), [cart]);
  const count = useMemo(() => cart.reduce((sum, row) => sum + Number(row.quantity), 0), [cart]);

  return (
    <CitizenShell pageStyles={['/css/shop_images.css']}>
      <header className="react-page-header"><div><h1>Official Store</h1><p>Government publications, souvenirs and essential goods.</p></div><button className="btn-primary react-auto-width" type="button" onClick={() => setModal({ type: 'cart' })}><i className="fas fa-shopping-basket" /> Cart <span className="react-cart-count">{count}</span></button></header>
      {notice && <div className="react-payment-warning" role="status"><i className="fas fa-shield-halved" /><span>{notice}</span><button type="button" aria-label="Dismiss payment notice" onClick={() => { setNotice(''); setSearchParams({}, { replace: true }); }}><i className="fas fa-times" /></button></div>}
      {error && <div className="react-dashboard-error" role="alert">{error}<button type="button" onClick={load}>Retry</button></div>}
      {loading ? <RouteLoading label="Loading store…" /> : <div className="shop-grid react-shop-grid">{items.map(item => { const image = safeProductImage(item.image_url); return <article className="product-card" key={item.id}><div className="product-img-container">{image ? <img className="product-image-cover" src={image} alt={item.name} /> : <div className="react-product-placeholder"><i className="fas fa-box" /></div>}</div><h3>{item.name}</h3><p className="product-desc">{item.description}</p><div className="product-price">{money(item.price)}</div><button className="btn-buy" type="button" onClick={() => addToCart(item.id)}>Add to Cart</button></article>})}{!items.length && <p className="react-empty-state">No items available.</p>}</div>}
      {modal?.type === 'cart' && <Modal title="Your Cart" onClose={() => setModal(null)} width="700px"><div className="react-cart-list">{cart.map(item => { const image = safeProductImage(item.image_url); return <article key={item.cart_id}>{image ? <img src={image} alt="" /> : <i className="fas fa-box" />}<div><h3>{item.name}</h3><p>{money(item.price)} × {item.quantity}</p></div><strong>{money(Number(item.price) * Number(item.quantity))}</strong><button className="react-icon-button danger" type="button" aria-label={`Remove ${item.name}`} onClick={() => removeFromCart(item.cart_id)}><i className="fas fa-trash" /></button></article>})}{!cart.length && <p className="react-empty-state">Your cart is empty.</p>}</div><div className="react-cart-total"><strong>Total: {money(total)}</strong><button className="btn-primary react-auto-width" disabled={!cart.length} type="button" onClick={() => setModal({ type: 'checkout' })}>Proceed to Checkout</button></div></Modal>}
      {modal?.type === 'checkout' && <Modal title="Checkout" onClose={() => setModal(null)}><form className="react-form-stack" onSubmit={checkout}><label>Contact Number<input name="contact_number" placeholder="017…" required /></label><label>Delivery Address<textarea name="delivery_address" rows="4" required /></label><fieldset className="react-payment-methods"><legend>Payment Method</legend><label><input type="radio" checked readOnly /> Cash on Delivery</label></fieldset><div className="react-checkout-total">Order total: <strong>{money(total)}</strong></div><button className="btn-primary" disabled={submitting || !cart.length} type="submit">{submitting ? 'Placing Order…' : 'Place COD Order'}</button></form><DemoPaymentPanel service="Shop online payment" amount={total} note="For a real database-backed demonstration order, use Cash on Delivery. This simulation does not place an order." /></Modal>}
    </CitizenShell>
  );
}
