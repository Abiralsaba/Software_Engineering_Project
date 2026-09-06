import { useState } from 'react';

function demoReference() {
  const suffix = `${Date.now()}`.slice(-8);
  return `NATIONX-DEMO-${suffix}`;
}

export default function DemoPaymentPanel({ service, amount, note }) {
  const [receipt, setReceipt] = useState(null);

  return <section className="react-panel react-service-spaced" aria-label={`${service} payment demonstration`}>
    <h2>{service} payment demonstration</h2>
    <div className="react-payment-warning" role="alert">
      <i className="fas fa-flask" />
      <span><strong>SIMULATED — NOT GATEWAY VERIFIED.</strong> This local presentation control never contacts a payment gateway, never writes a payment record, and never changes an application or bill status.</span>
    </div>
    {note && <p>{note}</p>}
    {amount != null && <p>Demonstration amount: <strong>৳{Number(amount || 0).toFixed(2)}</strong></p>}
    {!receipt
      ? <button className="btn-secondary" type="button" onClick={() => setReceipt({ reference: demoReference(), createdAt: new Date().toLocaleString() })}>Simulate presentation payment</button>
      : <div className="react-result-card" role="status">
          <h3>Simulation completed</h3>
          <p>Demo reference: <strong>{receipt.reference}</strong></p>
          <p>{receipt.createdAt}</p>
          <p>No gateway verification or server-side payment update occurred.</p>
        </div>}
  </section>;
}
