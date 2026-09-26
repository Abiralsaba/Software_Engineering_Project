import { useId, useState } from 'react';
import './demo-payment.css';

function demoReference() {
  return `NATIONX-DEMO-${crypto.randomUUID()}`;
}

export default function DemoPaymentPanel({ service, amount, note }) {
  const id = useId();
  const [receipt, setReceipt] = useState(null);
  const [stage, setStage] = useState('details');
  const [value, setValue] = useState('');
  const [method, setMethod] = useState('Card');
  const total = Number(amount ?? value);
  const valid = Number.isFinite(total) && total > 0 && total <= 10000000;
  function finish(outcome) {
    if (!valid) return;
    setReceipt({ reference: demoReference(), createdAt: new Date().toLocaleString(), amount: total.toFixed(2), method, outcome });
    setStage('receipt');
  }

  return <section className="react-panel react-service-spaced nx-demo-payment" aria-label={`${service} payment demonstration`}>
    <p className="nx-demo-label"><i className="fas fa-shield-halved" aria-hidden="true" /> SSLCommerz-style checkout · Local demo</p>
    <h2>{service} payment demonstration</h2>
    {note && <p>{note}</p>}
    {stage === 'details' && <form className="react-form-stack" onSubmit={event => { event.preventDefault(); if (valid) setStage('checkout'); }}>
      {amount == null ? <label>Demo amount (BDT)<input type="number" min="0.01" max="10000000" step="0.01" inputMode="decimal" value={value} onChange={event => setValue(event.target.value)} placeholder="Enter a demonstration amount" required /></label> : <p>Demonstration amount: <strong>৳{valid ? total.toFixed(2) : '0.00'}</strong></p>}
      {amount != null && !valid && <p role="alert">A positive amount is required to start the demo.</p>}
      <button className="btn-primary" type="submit" disabled={!valid}>Open demo checkout</button>
    </form>}
    {stage === 'checkout' && <form className="react-form-stack nx-checkout" aria-label="Demo checkout" onSubmit={event => { event.preventDefault(); finish('success'); }}>
      <div className="nx-checkout-summary"><span>{service}<small>Demonstration total · BDT</small></span><strong>৳{total.toFixed(2)}</strong></div>
      <fieldset><legend>Select a demo payment method</legend><div className="nx-payment-methods">{[['Card', 'credit-card'], ['Mobile banking', 'mobile-screen-button'], ['Internet banking', 'building-columns']].map(([label, icon]) => <label className="nx-payment-method" key={label}><input type="radio" name={`${id}-method`} checked={method === label} onChange={() => setMethod(label)} /><i className={`fas fa-${icon}`} aria-hidden="true" /><span>{label}</span></label>)}</div></fieldset>
      <p>Test success, decline, or cancellation. No financial information is needed.</p>
      <div className="nx-payment-actions"><button className="btn-primary" type="submit">Simulate presentation payment</button><button className="btn-secondary" type="button" onClick={() => finish('failed')}>Simulate declined payment</button><button className="btn-secondary" type="button" onClick={() => finish('cancelled')}>Cancel demo checkout</button></div>
    </form>}
    {stage === 'receipt' && receipt && <div className={`react-result-card nx-demo-receipt nx-demo-${receipt.outcome}`} role="status" tabIndex={-1} ref={element => element?.focus()}>
          <h3>{receipt.outcome === 'success' ? 'Simulation completed' : receipt.outcome === 'failed' ? 'Demo payment declined' : 'Demo checkout cancelled'}</h3>
          <p className="nx-demo-label">DEMO ONLY — NOT A PAYMENT RECEIPT</p>
          <p>{receipt.method} · BDT {receipt.amount}</p>
          <p>Demo reference: <strong>{receipt.reference}</strong></p>
          <p>{receipt.createdAt}</p>
          <p>No gateway verification or server-side payment update occurred.</p>
          <button className="btn-secondary" type="button" onClick={() => { setReceipt(null); setStage('details'); }}>Start another demo</button>
        </div>}
  </section>;
}
