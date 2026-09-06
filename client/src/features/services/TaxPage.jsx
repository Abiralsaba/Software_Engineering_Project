import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import CitizenShell from '../../layouts/CitizenShell.jsx';
import { apiRequest } from '../../services/api.js';
import { alerts } from '../../utils/alerts.js';
import { useSubmissionLock } from '../../hooks/useSubmissionLock.js';
import { dateText, EmptyRow, formPayload, StatusBadge } from './ServiceUi.jsx';

const API = '/api/tax';
const sections = ['dashboard', 'tin', 'ereturn', 'calculator', 'payments', 'challan', 'vat', 'notices', 'zones'];
const zeroFields = ['salary_income', 'house_property_income', 'agriculture_income', 'business_income', 'capital_gains', 'other_income', 'tax_exempted_income', 'tax_rebate', 'tax_paid_advance', 'tax_deducted_source', 'total_assets', 'total_liabilities', 'total_expenditure'];

export function calculateIncomeTax(incomeValue, exemptedValue, investmentValue) {
  const income = Math.max(0, Number(incomeValue) || 0);
  const exempted = Math.max(0, Number(exemptedValue) || 0);
  const investment = Math.max(0, Number(investmentValue) || 0);
  const taxableIncome = Math.max(0, income - exempted);
  const slabs = [[350000, 0], [100000, 0.05], [400000, 0.10], [500000, 0.15], [500000, 0.20], [Infinity, 0.25]];
  let remaining = taxableIncome;
  let grossTax = 0;
  for (const [limit, rate] of slabs) {
    if (remaining <= 0) break;
    const applicable = Math.min(remaining, limit);
    grossTax += applicable * rate;
    remaining -= applicable;
  }
  const eligibleInvestment = Math.min(investment, income * 0.25, 10000000);
  const rebate = Math.min(eligibleInvestment * 0.15, grossTax);
  const minimumTax = taxableIncome > 0 ? 5000 : 0;
  return { income, exempted, taxableIncome, grossTax, rebate, finalTax: Math.max(grossTax - rebate, minimumTax) };
}

export function taxPayload(kind, form) {
  const values = formPayload(form);
  if (kind === 'tin') return { ...values, zone_id: values.zone_id || null };
  if (kind === 'return') {
    const payload = { ...values };
    zeroFields.forEach(field => { payload[field] = payload[field] || 0; });
    return payload;
  }
  if (kind === 'payment') return {
    payment_type: values.payment_type, amount: values.amount, payment_method: values.payment_method,
    bank_name: values.bank_name, branch_name: values.branch_name,
    transaction_id: values.transaction_id, fiscal_year: values.fiscal_year
  };
  if (kind === 'vat') return { ...values, annual_turnover: values.annual_turnover || 0 };
  return {
    tin_number: values.challan_tin, assessment_year: values.challan_year,
    tax_zone: values.challan_zone, deposit_type: values.deposit_type,
    amount: values.challan_amount, bank_name: values.challan_bank, branch_name: values.challan_branch
  };
}

function money(value) {
  return `৳${Number(value || 0).toLocaleString('en-IN')}`;
}

export default function TaxPage() {
  const [params, setParams] = useSearchParams();
  const requested = params.get('section');
  const [section, setSectionState] = useState(sections.includes(requested) ? requested : 'dashboard');
  const [data, setData] = useState({ dashboard: {}, tin: null, returns: [], payments: [], vat: null, zones: [], notices: [], challans: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [calculation, setCalculation] = useState(null);
  const { submitting, runLocked } = useSubmissionLock();

  async function loadAll() {
    setLoading(true); setError('');
    try {
      const [dashboard, tin, returns, payments, vat, zones, notices, challans] = await Promise.all([
        apiRequest(`${API}/dashboard`), apiRequest(`${API}/tin/status`), apiRequest(`${API}/returns`),
        apiRequest(`${API}/payments`), apiRequest(`${API}/vat/status`), apiRequest(`${API}/zones`),
        apiRequest(`${API}/notices`), apiRequest(`${API}/challan`)
      ]);
      setData({ dashboard: dashboard || {}, tin, returns: returns || [], payments: payments || [], vat, zones: zones || [], notices: notices || [], challans: challans || [] });
    } catch (requestError) { setError(requestError.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadAll(); }, []);

  function setSection(next) {
    setSectionState(next);
    const nextParams = new URLSearchParams(params);
    if (next === 'dashboard') nextParams.delete('section'); else nextParams.set('section', next);
    setParams(nextParams, { replace: true });
  }

  async function submit(event, kind, path) {
    event.preventDefault(); const form = event.currentTarget;
    await runLocked(async () => {
      try {
        const response = await apiRequest(`${API}${path}`, { method: 'POST', body: taxPayload(kind, form) });
        form.reset(); await alerts.success('Submitted', response.message || response.receipt_no || response.challan_no || response.submission_ref || 'Submitted successfully.');
        await loadAll();
      } catch (requestError) { setError(requestError.message); await alerts.error(requestError.message); }
    });
  }

  async function markRead(id) {
    await runLocked(async () => {
      try { await apiRequest(`${API}/notices/${id}/read`, { method: 'PUT' }); await loadAll(); }
      catch (requestError) { setError(requestError.message); }
    });
  }

  function calculate(event) {
    event.preventDefault(); const values = formPayload(event.currentTarget);
    setCalculation(calculateIncomeTax(values.income, values.exempted, values.investment));
  }

  const canApplyTin = !data.tin || data.tin.status === 'Rejected';
  const canApplyVat = !data.vat || !['Pending', 'Active'].includes(data.vat.status);

  return <CitizenShell>
    <header className="react-page-header"><div><h1>NBR Tax Portal</h1><p>TIN, e-return, tax records, VAT, notices, zones, and challans.</p></div></header>
    <nav className="react-service-tabs" aria-label="Tax sections">{sections.map(value => <button type="button" className={section === value ? 'active' : ''} onClick={() => setSection(value)} key={value}>{value}</button>)}</nav>
    {error && <div className="react-dashboard-error" role="alert">{error}<button type="button" onClick={loadAll}>Retry</button></div>}
    {loading ? <p className="react-empty-state">Loading tax services…</p> : <>
      {section === 'dashboard' && <><div className="react-service-stats">{[['TIN', data.dashboard.tin?.status || 'Not registered'], ['Returns', data.dashboard.returns?.total_returns || 0], ['Verified tax paid', money(data.dashboard.payments?.total_paid)], ['Pending returns', data.dashboard.returns?.pending_returns || 0], ['Unread notices', data.dashboard.unreadNotices || 0]].map(([label, value]) => <article className="react-panel" key={label}><strong>{value}</strong><span>{label}</span></article>)}</div><section className="react-panel"><h2>Current registrations</h2><div className="react-card-list"><article><div><h3>TIN</h3><p>{data.dashboard.tin?.tin_number || 'No approved number'}</p></div><StatusBadge value={data.dashboard.tin?.status || 'Not Registered'} /></article><article><div><h3>VAT/BIN</h3><p>{data.dashboard.vat?.bin_number || 'No active number'}</p></div><StatusBadge value={data.dashboard.vat?.status || 'Not Registered'} /></article></div></section></>}

      {section === 'tin' && <div className="react-two-column"><section className="react-panel"><h2>TIN status</h2>{data.tin ? <div className="react-card-list"><article><div><h3>{data.tin.tin_number || 'Application pending'}</h3><p>{data.tin.taxpayer_name} · {data.tin.taxpayer_type}</p><p>{data.tin.zone_name || 'No zone'} · {dateText(data.tin.created_at)}</p>{data.tin.remarks && <p>{data.tin.remarks}</p>}</div><StatusBadge value={data.tin.status} /></article></div> : <p className="react-empty-state">No TIN application.</p>}</section>{canApplyTin && <section className="react-panel"><h2>Apply for TIN</h2><form className="react-form-stack" onSubmit={event => submit(event, 'tin', '/tin/apply')}><div className="react-form-grid"><label>Taxpayer name<input name="taxpayer_name" required /></label><label>Taxpayer type<select name="taxpayer_type" defaultValue="Individual"><option>Individual</option><option>Company</option><option>Firm</option><option>AOP</option><option>Trust</option><option>Other</option></select></label><label>Father name<input name="father_name" /></label><label>Mother name<input name="mother_name" /></label><label>Date of birth<input name="date_of_birth" type="date" required /></label><label>NID number<input name="nid_number" required /></label><label>Passport number<input name="passport_number" /></label><label>Mobile<input name="mobile" required /></label><label>Email<input name="email" type="email" /></label><label>Source of income<input name="source_of_income" /></label><label>Tax zone<select name="zone_id" defaultValue=""><option value="">Select zone</option>{data.zones.map(row => <option value={row.id} key={row.id}>{row.zone_name} ({row.zone_code})</option>)}</select></label></div><label>Present address<textarea name="present_address" /></label><label>Permanent address<textarea name="permanent_address" /></label><button className="btn-primary" disabled={submitting} type="submit">Submit TIN application</button></form></section>}</div>}

      {section === 'ereturn' && <><section className="react-panel"><h2>File e-return</h2><form className="react-form-stack" onSubmit={event => submit(event, 'return', '/returns/file')}><div className="react-form-grid"><label>Assessment year<input name="assessment_year" placeholder="2026-27" required /></label><label>Income year<input name="income_year" placeholder="2025-26" required /></label><label>Return type<select name="return_type" defaultValue="Normal"><option>Normal</option><option>Revised</option><option>Belated</option></select></label>{zeroFields.map(field => <label key={field}>{field.replaceAll('_', ' ')}<input name={field} type="number" min="0" /></label>)}</div><button className="btn-primary" disabled={submitting} type="submit">File return</button></form></section><section className="react-panel react-service-spaced"><h2>My returns</h2><div className="react-table-wrap"><table><thead><tr><th>Reference</th><th>Assessment year</th><th>Income</th><th>Tax liability</th><th>Due</th><th>Status</th></tr></thead><tbody>{data.returns.map(row => <tr key={row.id}><td>{row.submission_ref}</td><td>{row.assessment_year}</td><td>{money(row.total_income)}</td><td>{money(row.net_tax_liability)}</td><td>{money(row.tax_due)}</td><td><StatusBadge value={row.status} /></td></tr>)}{!data.returns.length && <EmptyRow columns={6}>No returns filed.</EmptyRow>}</tbody></table></div></section></>}

      {section === 'calculator' && <section className="react-panel react-narrow-panel"><h2>Tax calculator</h2><p>Uses the same 2025–26 client-side slab calculation as the legacy page; this is an estimate.</p><form className="react-form-stack" onSubmit={calculate}><label>Gross income<input name="income" type="number" min="0" required /></label><label>Tax-exempt income<input name="exempted" type="number" min="0" /></label><label>Rebate investment<input name="investment" type="number" min="0" /></label><button className="btn-primary" type="submit">Calculate</button></form>{calculation && <div className="react-calculation"><p>Taxable income <strong>{money(calculation.taxableIncome)}</strong></p><p>Tax before rebate <strong>{money(calculation.grossTax)}</strong></p><p>Rebate <strong>{money(calculation.rebate)}</strong></p><p>Estimated net tax <strong>{money(calculation.finalTax)}</strong></p></div>}</section>}

      {section === 'payments' && <div className="react-two-column"><section className="react-panel"><div className="react-payment-warning" role="status"><i className="fas fa-circle-info" /><span>This records a claimed payment as <strong>Pending</strong> for later verification. A receipt number is not proof that funds were received.</span></div><h2>Record tax payment</h2><form className="react-form-stack" onSubmit={event => submit(event, 'payment', '/payments/pay')}><label>Payment type<select name="payment_type" required defaultValue="Income Tax"><option>Income Tax</option><option>VAT</option><option>Supplementary Duty</option><option>Customs Duty</option><option>Excise Duty</option><option>Other</option></select></label><label>Amount<input name="amount" type="number" min="1" required /></label><label>Payment method<select name="payment_method" defaultValue="Online"><option>Online</option><option>Bank Transfer</option><option>Mobile Banking</option><option>Cash</option><option>Challan</option></select></label><label>Fiscal year<input name="fiscal_year" placeholder="2025-26" /></label><label>Bank name<input name="bank_name" /></label><label>Branch name<input name="branch_name" /></label><label>Transaction id<input name="transaction_id" /></label><button className="btn-primary" disabled={submitting} type="submit">Submit pending payment record</button></form></section><section className="react-panel"><h2>My payment records</h2><div className="react-card-list">{data.payments.map(row => <article key={row.id}><div><h3>{row.receipt_no || 'Pending receipt'} — {money(row.amount)}</h3><p>{row.payment_type} · {row.payment_method} · {row.transaction_id || 'No transaction id'}</p></div><StatusBadge value={row.status} /></article>)}{!data.payments.length && <p className="react-empty-state">No payment records.</p>}</div></section></div>}

      {section === 'challan' && <div className="react-two-column"><section className="react-panel"><h2>Generate challan record</h2><form className="react-form-stack" onSubmit={event => submit(event, 'challan', '/challan')}><label>TIN number<input name="challan_tin" /></label><label>Assessment year<input name="challan_year" /></label><label>Tax zone<input name="challan_zone" /></label><label>Deposit type<select name="deposit_type" defaultValue="Income Tax"><option>Income Tax</option><option>VAT</option><option>Advance Tax</option><option>TDS</option><option>Penalty</option><option>Other</option></select></label><label>Amount<input name="challan_amount" type="number" min="1" required /></label><label>Bank<input name="challan_bank" /></label><label>Branch<input name="challan_branch" /></label><button className="btn-primary" disabled={submitting} type="submit">Generate challan</button></form></section><section className="react-panel"><h2>My challans</h2><div className="react-card-list">{data.challans.map(row => <article key={row.id}><div><h3>{row.challan_no} — {money(row.amount)}</h3><p>{row.deposit_type} · {row.assessment_year || '—'} · {row.bank_name || '—'}</p></div><StatusBadge value={row.status} /></article>)}{!data.challans.length && <p className="react-empty-state">No challans.</p>}</div></section></div>}

      {section === 'vat' && <div className="react-two-column"><section className="react-panel"><h2>VAT/BIN status</h2>{data.vat ? <div className="react-card-list"><article><div><h3>{data.vat.bin_number || 'Application pending'}</h3><p>{data.vat.business_name} · {data.vat.business_type}</p></div><StatusBadge value={data.vat.status} /></article></div> : <p className="react-empty-state">No VAT application.</p>}</section>{canApplyVat && <section className="react-panel"><h2>Register for VAT</h2><form className="react-form-stack" onSubmit={event => submit(event, 'vat', '/vat/register')}><label>Business name<input name="business_name" required /></label><label>Business name (Bangla)<input name="business_name_bn" /></label><label>Business type<select name="business_type" defaultValue="Service Provider"><option>Service Provider</option><option>Manufacturer</option><option>Trader</option><option>Importer</option><option>Exporter</option><option>Other</option></select></label><label>Trade license<input name="trade_license_no" /></label><label>Business address<textarea name="business_address" required /></label><label>Annual turnover<input name="annual_turnover" type="number" min="0" /></label><label>Contact person<input name="contact_person" /></label><label>Contact phone<input name="contact_phone" /></label><label>Contact email<input name="contact_email" type="email" /></label><button className="btn-primary" disabled={submitting} type="submit">Submit VAT application</button></form></section>}</div>}

      {section === 'notices' && <section className="react-panel"><h2>Tax notices</h2><div className="react-card-list">{data.notices.map(row => <article key={row.id}><div><h3>{row.subject}</h3><p className="react-safe-text">{row.message}</p><p>{row.notice_type} · {row.priority} · {dateText(row.created_at)}</p></div><div><StatusBadge value={row.status} />{row.status === 'Issued' && <button className="btn-secondary react-service-action" disabled={submitting} type="button" onClick={() => markRead(row.id)}>Mark read</button>}</div></article>)}{!data.notices.length && <p className="react-empty-state">No tax notices.</p>}</div></section>}

      {section === 'zones' && <section className="react-panel"><h2>Tax zones</h2><div className="react-service-card-grid">{data.zones.map(row => <article key={row.id}><h3>{row.zone_name}</h3>{row.zone_name_bn && <p>{row.zone_name_bn}</p>}<p>{row.zone_code} · {row.district}, {row.division}</p><p>{row.office_address}</p></article>)}{!data.zones.length && <p className="react-empty-state">No tax zones.</p>}</div></section>}
    </>}
  </CitizenShell>;
}
