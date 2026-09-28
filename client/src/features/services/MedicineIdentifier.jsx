import { useEffect, useMemo, useRef, useState } from 'react';
import { apiRequest } from '../../services/api.js';

const CONSENT = 'I understand that image extraction may make mistakes. I will verify the result and consult a doctor or pharmacist before changing medicine.';
const WARNINGS = ['Dataset-derived estimated price', 'Current pharmacy price may differ', 'Professional confirmation is required'];
const editableFields = [
  ['brand_name_candidate', 'Brand'], ['generic_name_candidate', 'Generic/ingredient'], ['strength_text', 'Strength'],
  ['dosage_form', 'Dosage form'], ['manufacturer_candidate', 'Manufacturer'], ['registration_reference_candidate', 'Registration-like reference']
];
const prescriptionFields = [
  ['dose_amount', 'Dose amount'], ['frequency_per_day', 'Times per day'],
  ['duration_days', 'Duration days'], ['total_quantity', 'Total quantity']
];

function price(value) {
  const amount = Number(value);
  return Number.isFinite(amount) ? `৳${amount.toLocaleString('en-BD', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'Price unavailable';
}

function lowCostError(error) {
  const serverMessage = String(error?.data?.error || error?.message || '');
  if (/<\s*!doctype|<\s*html|cannot get \/api\/medicine-scans\//i.test(serverMessage)) {
    return 'Low-cost search is not available on the running server yet. Restart the NationX API, then try again.';
  }
  return error?.message || 'Low-cost search is temporarily unavailable. Please try again.';
}

function medicineTitle(item, index) {
  const extracted = item.structured_extraction || {};
  return extracted.brand_name_candidate || item.confirmation?.manual_label || item.raw_visible_text || `Medicine ${index + 1}`;
}

function previewFor(file) {
  return typeof URL.createObjectURL === 'function' ? URL.createObjectURL(file) : '';
}

function revokePreview(item) {
  if (item.preview && typeof URL.revokeObjectURL === 'function') URL.revokeObjectURL(item.preview);
}

function MedicineFacts({ medicine, packages = [] }) {
  if (!medicine) return null;
  return <div className="medicine-facts">
    <div><strong>{medicine.brand_name}</strong><span>{medicine.manufacturer}</span></div>
    <dl>
      <div><dt>Ingredients</dt><dd>{medicine.ingredients?.map(row => row.ingredient).join(' + ') || medicine.generic_name}</dd></div>
      <div><dt>Strength</dt><dd>{medicine.strength}</dd></div>
      <div><dt>Dosage form</dt><dd>{medicine.dosage_form}</dd></div>
      <div><dt>Medicine type</dt><dd>{medicine.medicine_type}</dd></div>
      <div><dt>Registration-like reference</dt><dd>{medicine.registrations?.map(row => row.reference).join(', ') || 'Not recorded'}</dd></div>
    </dl>
    {!!packages.length && <div className="medicine-package-list" aria-label="Packages and dataset prices">{packages.map(row => <p key={`${row.package_id}-${row.price_id || 'no-price'}`}><span>{row.package_original}</span><strong>{row.amount ? `${row.currency || 'BDT'} ${row.amount}` : 'Price unavailable'}</strong></p>)}</div>}
  </div>;
}

function CandidateCard({ candidate, selected, onSelect, itemId }) {
  const id = `${itemId}-${candidate.medicine.medicine_id}`;
  return <label className={`medicine-candidate ${selected ? 'selected' : ''}`} htmlFor={id}>
    <input id={id} type="radio" name={`candidate-${itemId}`} checked={selected} onChange={onSelect} />
    <div><div className="medicine-candidate-heading"><strong>{candidate.medicine.brand_name}</strong><span>{candidate.medicine.strength} · {candidate.medicine.dosage_form}</span></div><p>{candidate.medicine.generic_name} · {candidate.medicine.manufacturer}</p><p className="medicine-evidence"><strong>Matched:</strong> {candidate.matching_evidence.join(', ') || 'Catalogue text'}</p>
      {!!candidate.conflicts_or_missing.length && <p className="medicine-warning"><i className="fas fa-triangle-exclamation" aria-hidden="true" /> <strong>Check:</strong> {candidate.conflicts_or_missing.join(', ')}</p>}
    </div>
  </label>;
}

function ExtractedField({ field, label, value, uncertain, numeric = false }) {
  return <label className={`medicine-extracted-field ${uncertain ? 'is-uncertain' : ''}`}>
    <span className="medicine-field-heading"><span>{label}</span>{uncertain && <small>Uncertain</small>}</span>
    <input name={field} type={numeric ? 'number' : 'text'} min={numeric ? '0' : undefined} step={numeric ? 'any' : undefined} defaultValue={value} />
  </label>;
}

function ManualCatalogueDetail({ medicine, quantity }) {
  const [detail, setDetail] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setDetail(null); setComparison(null);
    const amount = Number(quantity);
    const query = Number.isInteger(amount) && amount > 0 ? `?quantity=${amount}` : '';
    Promise.allSettled([
      apiRequest(`/api/medicines/${medicine.medicine_id}`),
      apiRequest(`/api/medicines/${medicine.medicine_id}/alternatives${query}`)
    ]).then(([medicineResult, comparisonResult]) => {
      if (!active) return;
      if (medicineResult.status === 'fulfilled') setDetail(medicineResult.value);
      if (comparisonResult.status === 'fulfilled') setComparison(comparisonResult.value);
      else setError(comparisonResult.reason?.message || 'Price comparison is unavailable.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [medicine.medicine_id, quantity]);

  return <div className="medicine-manual-detail">
    {loading && <p className="medicine-live-status" role="status"><span className="medicine-spinner" aria-hidden="true" /> Loading recorded prices…</p>}
    {error && <p className="medicine-error" role="alert">{error}</p>}
    {comparison && <>
      <div className="medicine-price-summary"><div><small>Lowest recorded unit price</small><strong>{comparison.original_package_comparison ? price(comparison.original_package_comparison.estimated_per_unit) : 'Unavailable'}</strong></div><div><small>{quantity ? `Estimated cost for ${quantity} units` : 'Quantity based cost'}</small><strong>{comparison.original_purchase_estimate ? price(comparison.original_purchase_estimate.estimated_cost) : 'Enter a quantity above'}</strong></div></div>
      {detail?.packages?.length > 0 && <details className="medicine-price-details"><summary>See recorded package prices</summary><MedicineFacts medicine={detail} packages={detail.packages} /></details>}
      <div className="medicine-alternatives"><div className="medicine-alternatives-heading"><div><h3>Comparable catalogue products</h3><p>Matches are based on recorded specifications.</p></div><span>{comparison.alternatives.length} found</span></div>
        {comparison.limitation && <p className="medicine-warning">{comparison.limitation}</p>}
        <div className="medicine-alternative-grid">{comparison.alternatives.map(option => <article key={option.medicine.medicine_id}><div className="medicine-alternative-top"><div><h4>{option.medicine.brand_name}</h4><p>{option.medicine.manufacturer}</p></div>{Number(option.estimated_saving) > 0 && <span className="medicine-saving">Save {price(option.estimated_saving)}</span>}</div><p className="medicine-alternative-spec">{option.medicine.generic_name} · {option.medicine.strength} · {option.medicine.dosage_form}</p><div className="medicine-alternative-prices"><div><small>Lowest price per unit</small><strong>{option.package_comparison ? price(option.package_comparison.estimated_per_unit) : 'Unavailable'}</strong></div><div><small>Estimated purchase cost</small><strong>{option.purchase_estimate ? price(option.purchase_estimate.estimated_cost) : 'Enter a quantity'}</strong></div></div><details><summary>How this was compared</summary><p>{option.calculation}</p><p>Recorded match: {option.matching_specifications.join(', ')}.</p></details></article>)}</div>
        {!comparison.alternatives.length && !comparison.limitation && <p className="react-empty-state">No comparable lower-cost catalogue product was found.</p>}
      </div>
      <p className="medicine-detail-note"><i className="fas fa-user-doctor" aria-hidden="true" /> Prices are dataset estimates. Confirm suitability with a doctor or pharmacist.</p>
    </>}
  </div>;
}

function ScanItem({ scan, item, onUpdated, requestSavings, onRequestSavings }) {
  const extracted = item.structured_extraction || {};
  const [selected, setSelected] = useState(item.confirmation?.medicine_id || '');
  const [manualLabel, setManualLabel] = useState('');
  const [manualMode, setManualMode] = useState(false);
  const [reviewMode, setReviewMode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [alternatives, setAlternatives] = useState(null);
  const [confirmedDetail, setConfirmedDetail] = useState(null);
  const [comparing, setComparing] = useState(false);
  const confirmedId = item.confirmation?.selection_type === 'CATALOGUE' ? item.confirmation.medicine_id : null;

  useEffect(() => {
    if (!confirmedId) { setConfirmedDetail(null); setAlternatives(null); return undefined; }
    let active = true;
    setError(''); setAlternatives(null);
    apiRequest(`/api/medicines/${confirmedId}`).then(detail => {
      if (active) setConfirmedDetail(detail);
    }).catch(requestError => { if (active) setError(requestError.message); });
    return () => { active = false; };
  }, [confirmedId]);

  useEffect(() => {
    if (!confirmedId || !requestSavings) return undefined;
    let active = true;
    setComparing(true); setError(''); setAlternatives(null);
    apiRequest(`/api/medicine-scans/${scan.scan_id}/items/${item.item_id}/low-cost-options`).then(result => {
      if (active) setAlternatives(result);
    }).catch(requestError => { if (active) setError(lowCostError(requestError)); })
      .finally(() => { if (active) setComparing(false); });
    return () => { active = false; };
  }, [confirmedId, requestSavings, item.item_id, scan.scan_id]);

  async function confirm(event, selectionType) {
    event.preventDefault();
    const form = event.currentTarget.closest('form');
    const values = Object.fromEntries(new FormData(form).entries());
    const corrections = {};
    editableFields.forEach(([field]) => { corrections[field] = values[field]?.trim() || null; });
    ['dose_amount', 'frequency_per_day', 'duration_days', 'total_quantity'].forEach(field => {
      corrections[field] = values[field] ? Number(values[field]) : null;
    });
    setSubmitting(true); setError('');
    try {
      const result = await apiRequest(`/api/medicine-scans/${scan.scan_id}/items/${item.item_id}/confirm`, {
        method: 'POST', body: { selection_type: selectionType, medicine_id: selectionType === 'CATALOGUE' ? selected : null, manual_label: manualLabel, corrections }
      });
      onUpdated(result);
      setReviewMode(false);
      setManualMode(false);
      setAlternatives(null);
    } catch (requestError) { setError(requestError.message); }
    finally { setSubmitting(false); }
  }

  async function loadAlternatives() {
    setComparing(true); setError('');
    try { setAlternatives(await apiRequest(`/api/medicine-scans/${scan.scan_id}/items/${item.item_id}/low-cost-options`)); }
    catch (requestError) { setError(lowCostError(requestError)); }
    finally { setComparing(false); }
  }

  const confirmedCandidate = item.candidates.find(candidate => candidate.medicine.medicine_id === confirmedId)?.medicine;
  const fieldValue = field => item.user_corrections?.[field] ?? extracted[field] ?? '';
  const reviewFields = [
    ...editableFields.map(([field, label]) => ({ field, label, value: fieldValue(field), numeric: false })),
    ...(scan.scan_mode === 'prescription' ? prescriptionFields.map(([field, label]) => ({ field, label, value: fieldValue(field), numeric: true })) : [])
  ];
  const populatedFields = reviewFields.filter(({ value }) => String(value).trim() !== '');
  const emptyFields = reviewFields.filter(({ value }) => String(value).trim() === '');
  const renderField = ({ field, label, value, numeric }) => <ExtractedField key={field} field={field} label={label} value={value} numeric={numeric} uncertain={item.uncertain_fields?.includes(field)} />;
  return <article className="medicine-review-item" aria-label="Selected medicine details">
    <header><div><span>Selected medicine · visible text</span><h3>{item.raw_visible_text || 'No readable medicine line'}</h3></div><span className="medicine-confidence">{extracted.model_confidence == null ? 'Check the text' : `${Math.round(extracted.model_confidence * 100)}% reading confidence`}</span></header>
    {!!item.uncertain_fields?.length && <p className="medicine-warning" role="note"><i className="fas fa-circle-question" aria-hidden="true" /> Uncertain fields: {item.uncertain_fields.join(', ')}</p>}
    {requestSavings && !confirmedId && <p className="medicine-savings-guidance" role="note">Review the scan and confirm the matching catalogue medicine first. An OCR reading alone is not enough to compare prices safely.</p>}
    {confirmedId ? <section className="medicine-comparison" aria-label="Medicine price comparison">
      <div className="medicine-comparison-heading"><div><span className="medicine-kicker">Confirmed catalogue match</span><h3>{(confirmedDetail || confirmedCandidate)?.brand_name || 'Selected medicine'}</h3><p>{(confirmedDetail || confirmedCandidate)?.generic_name} · {(confirmedDetail || confirmedCandidate)?.strength} · {(confirmedDetail || confirmedCandidate)?.dosage_form}</p></div><span className="medicine-confirmed-mark"><i className="fas fa-check" aria-hidden="true" /> Confirmed by you</span></div>
      {!requestSavings && <button className="btn-secondary react-auto-width" type="button" onClick={onRequestSavings}>Find lower-cost options</button>}
      {alternatives && (alternatives.original_purchase_estimate || alternatives.original_package_comparison) && <div className="medicine-price-summary">
        <div><small>Estimated cost for recorded quantity</small><strong>{alternatives?.original_purchase_estimate ? price(alternatives.original_purchase_estimate.estimated_cost) : 'Unavailable'}</strong>{alternatives?.original_purchase_estimate?.required_quantity && <span>For {alternatives.original_purchase_estimate.required_quantity} units</span>}</div>
        <div><small>Lowest recorded unit price</small><strong>{alternatives?.original_package_comparison ? price(alternatives.original_package_comparison.estimated_per_unit) : 'Unavailable'}</strong><span>Dataset estimate per unit</span></div>
      </div>}
      {confirmedDetail?.packages?.length > 0 && <details className="medicine-price-details"><summary>See recorded package prices</summary><MedicineFacts medicine={confirmedDetail} packages={confirmedDetail.packages} /></details>}
      {comparing && <p className="medicine-live-status" role="status"><span className="medicine-spinner" aria-hidden="true" /> Checking catalogue prices first…</p>}
      {alternatives && <div className="medicine-alternatives"><div className="medicine-alternatives-heading"><div><h3>{alternatives.alternatives.length ? 'Lower-cost catalogue options' : 'Catalogue price check'}</h3><p>{alternatives.alternatives.length ? `${alternatives.basis === 'purchase_cost' ? 'Compared for the recorded quantity.' : 'Compared by recorded unit price; total cost is not known.'} Same recorded ingredient set, strength, form and release type.` : 'NationX checked the recorded medicine catalogue before using the additional search.'}</p></div><span>{alternatives.alternatives.length ? `${alternatives.alternatives.length} found` : 'Checked'}</span></div>
        {alternatives.limitation && <p className="medicine-catalogue-notice"><i className="fas fa-circle-info" aria-hidden="true" /><span>{alternatives.limitation} {alternatives.gemini?.brands?.length ? 'Possible brand names from the additional search are listed below for professional verification.' : ''}</span></p>}
        <div className="medicine-alternative-grid">{alternatives.alternatives.map(option => <article key={option.medicine.medicine_id}>
          <div className="medicine-alternative-top"><div><h4>{option.medicine.brand_name}</h4><p>{option.medicine.manufacturer}</p></div>{Number(option.estimated_saving) > 0 && <span className="medicine-saving">Save {price(option.estimated_saving)}</span>}</div>
          <p className="medicine-alternative-spec">{option.medicine.generic_name} · {option.medicine.strength} · {option.medicine.dosage_form}</p>
          <div className="medicine-alternative-prices"><div><small>Estimated purchase cost</small><strong>{option.purchase_estimate ? price(option.purchase_estimate.estimated_cost) : 'Quantity unavailable'}</strong></div><div><small>Lowest price per unit</small><strong>{option.package_comparison ? price(option.package_comparison.estimated_per_unit) : 'Unavailable'}</strong></div></div>
          <details><summary>How this was compared</summary><p>{option.calculation}</p><p>Recorded match: {option.matching_specifications.join(', ')}.</p>{option.purchase_estimate?.selected_packages?.length > 0 && <p>Package estimate: {option.purchase_estimate.selected_packages.map(pack => `${pack.count} × ${pack.package_original}`).join(', ')}.</p>}</details>
        </article>)}</div>
        {!alternatives.alternatives.length && !alternatives.limitation && <p className="react-empty-state">No lower-cost product with a comparable recorded specification and price was found in the catalogue.</p>}
      </div>}
      {alternatives?.gemini?.brands?.length > 0 && <section className="medicine-gemini-leads" aria-label="AI-assisted medicine search results"><span className="medicine-kicker">Additional search · Gemini</span><h3>Possible brands to verify</h3><p>These names match the recorded medicine description, but NationX has not verified their current price, availability, registration or suitability. Ask a pharmacist before choosing one.</p><ul>{alternatives.gemini.brands.map(name => <li key={name}>{name}</li>)}</ul></section>}
      {alternatives?.gemini?.status === 'no_leads' && <p className="medicine-savings-guidance">No additional brand names were found for this exact medicine description. A pharmacist may be able to check current local availability.</p>}
      {alternatives?.gemini?.status === 'unavailable' && <p className="medicine-savings-guidance">The additional medicine search is temporarily unavailable. Please try again later or ask a pharmacist to check equivalent products and current prices.</p>}
      {error && <p className="medicine-error" role="alert">{error}</p>}
      <div className="medicine-actions">{requestSavings && <button className="btn-secondary" type="button" disabled={comparing} onClick={loadAlternatives}>Refresh low-cost search</button>}<button className="medicine-text-button" type="button" onClick={() => setReviewMode(value => !value)}>{reviewMode ? 'Hide review' : 'Review or change match'}</button></div>
    </section> : null}
    {(!confirmedId || reviewMode) && <form className="medicine-review-form">
      <fieldset className="medicine-extracted-fields"><legend>Review extracted details</legend><p>Correct anything the scan read incorrectly before confirming.</p><div className="medicine-fields-grid">{populatedFields.map(renderField)}</div>
        {!!emptyFields.length && <details className="medicine-optional-fields"><summary><span>Add missing details</span><small>{emptyFields.length} empty {emptyFields.length === 1 ? 'field' : 'fields'}</small></summary><div className="medicine-fields-grid">{emptyFields.map(renderField)}</div></details>}
      </fieldset>
      <fieldset><legend>Choose the matching catalogue medicine</legend><p className="medicine-field-help">Check the name, strength and form. No match is selected automatically.</p>
        <div className="medicine-candidates">{item.candidates.map(candidate => <CandidateCard key={candidate.candidate_id} candidate={candidate} itemId={item.item_id} selected={selected === candidate.medicine.medicine_id} onSelect={() => setSelected(candidate.medicine.medicine_id)} />)}
          {!item.candidates.length && <p className="react-empty-state">No safe Tier A/B candidates found. Use manual search or choose none.</p>}
        </div>
      </fieldset>
      {error && <p className="medicine-error" role="alert">{error}</p>}
      <div className="medicine-actions">
        <button className="btn-primary" type="button" disabled={!selected || submitting} onClick={event => confirm(event, 'CATALOGUE')}>Confirm selected medicine</button>
        <button className="btn-secondary" type="button" disabled={submitting} onClick={event => confirm(event, 'NONE')}>None of these</button>
        <button className="btn-secondary" type="button" onClick={() => setManualMode(value => !value)}>Manual entry</button>
      </div>
      {manualMode && <div className="medicine-manual-row"><label>Visible medicine text<input value={manualLabel} onChange={event => setManualLabel(event.target.value)} /></label><button className="btn-secondary" type="button" disabled={!manualLabel.trim() || submitting} onClick={event => confirm(event, 'MANUAL')}>Save manual entry</button></div>}
    </form>}
    <p className="medicine-detail-note"><i className="fas fa-user-doctor" aria-hidden="true" /> Dataset prices may differ from a pharmacy. Ask a doctor or pharmacist before changing medicine.</p>
  </article>;
}

export default function MedicineIdentifier() {
  const [mode, setMode] = useState('prescription');
  const [files, setFiles] = useState([]);
  const filesRef = useRef(files);
  const [consent, setConsent] = useState(false);
  const [scan, setScan] = useState(null);
  const [selectedItemId, setSelectedItemId] = useState(null);
  const [savingsItemId, setSavingsItemId] = useState(null);
  const [history, setHistory] = useState([]);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [manualQuery, setManualQuery] = useState('');
  const [manualResults, setManualResults] = useState([]);
  const [manualSelectedId, setManualSelectedId] = useState(null);
  const [manualQuantity, setManualQuantity] = useState('');
  const maximum = mode === 'prescription' ? 3 : 2;

  useEffect(() => { filesRef.current = files; }, [files]);
  useEffect(() => () => filesRef.current.forEach(revokePreview), []);
  useEffect(() => { apiRequest('/api/medicine-scans?limit=10').then(result => setHistory(result.scans || [])).catch(() => {}); }, []);

  function addFiles(incoming) {
    setError('');
    const selected = [...incoming];
    if (selected.some(file => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 8 * 1024 * 1024)) {
      setError('Choose JPEG, PNG, or WebP images no larger than 8 MB each.'); return;
    }
    if (files.length + selected.length > maximum) { setError(`This mode allows up to ${maximum} images.`); return; }
    setFiles(current => [...current, ...selected.map(file => ({ file, preview: previewFor(file) }))]);
  }

  function removeFile(index) {
    setFiles(current => current.filter((item, itemIndex) => { if (itemIndex === index) revokePreview(item); return itemIndex !== index; }));
  }

  function changeMode(next) {
    files.forEach(revokePreview); setFiles([]); setMode(next); setScan(null); setSelectedItemId(null); setSavingsItemId(null); setError('');
  }

  async function analyze() {
    if (!files.length || !consent) return;
    setError(''); setScan(null); setSelectedItemId(null); setSavingsItemId(null); setProgress('Checking image');
    const timers = [setTimeout(() => setProgress('Reading visible text'), 350), setTimeout(() => setProgress('Searching medicine catalogue'), 900)];
    try {
      const form = new FormData(); form.set('mode', mode); form.set('consent', 'true'); files.forEach(item => form.append('images', item.file));
      const result = await apiRequest('/api/medicine-scans', { method: 'POST', body: form });
      setScan(result);
      apiRequest('/api/medicine-scans?limit=10').then(list => setHistory(list.scans || [])).catch(() => {});
    } catch (requestError) { setError(requestError.message); setProgress(''); }
    finally { timers.forEach(clearTimeout); setProgress(''); }
  }

  async function manualSearch(event) {
    event.preventDefault(); setError('');
    setManualSelectedId(null);
    try { const result = await apiRequest(`/api/medicines/search?q=${encodeURIComponent(manualQuery)}&limit=5`); setManualResults(result.medicines || []); }
    catch (requestError) { setError(requestError.message); }
  }

  async function openHistory(scanId) {
    try { setScan(await apiRequest(`/api/medicine-scans/${scanId}`)); setSelectedItemId(null); setSavingsItemId(null); setError(''); }
    catch (requestError) { setError(requestError.message); }
  }

  async function deleteScan(scanId) {
    try { await apiRequest(`/api/medicine-scans/${scanId}`, { method: 'DELETE' }); setHistory(current => current.filter(row => row.scan_id !== scanId)); if (scan?.scan_id === scanId) { setScan(null); setSelectedItemId(null); setSavingsItemId(null); } }
    catch (requestError) { setError(requestError.message); }
  }

  const modeLabel = useMemo(() => mode === 'prescription' ? 'Prescription Scan' : 'Medicine Package Scan', [mode]);
  return <div className="medicine-identifier">
    <section className="react-panel medicine-intro"><div><span className="medicine-kicker">Citizen-controlled catalogue matching</span><h2>Medicine Identifier</h2><p>Extract visible medicine text, review the result, and choose the catalogue match yourself.</p></div><i className="fas fa-prescription-bottle-medical" aria-hidden="true" /></section>
    <div className="medicine-safety-banner" role="note"><i className="fas fa-shield-heart" aria-hidden="true" /><div><strong>Identification support—not medical advice.</strong><p>Gemini reads visible text and may offer unverified names to investigate only when the catalogue has no cheaper match. It does not diagnose, prescribe, set prices, or confirm that medicines are interchangeable.</p></div></div>
    <section className="react-panel">
      <fieldset className="medicine-mode"><legend>Scan mode</legend>{[['prescription', 'Prescription Scan', 'Up to 3 pages'], ['package', 'Medicine Package Scan', 'Up to 2 package views']].map(([value, label, hint]) => <label className={mode === value ? 'selected' : ''} key={value}><input type="radio" name="scan-mode" checked={mode === value} onChange={() => changeMode(value)} /><span><strong>{label}</strong><small>{hint}</small></span></label>)}</fieldset>
      <div className="medicine-upload" onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); addFiles(event.dataTransfer.files); }}>
        <i className="fas fa-cloud-arrow-up" aria-hidden="true" /><h3>Add {modeLabel.toLowerCase()} images</h3><p>JPEG, PNG or WebP · 8 MB maximum each · images are processed in memory and not stored</p>
        <div className="medicine-actions"><label className="btn-primary medicine-file-button">Choose images<input aria-label="Choose medicine images" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={event => addFiles(event.target.files)} /></label><label className="btn-secondary medicine-file-button">Use camera<input aria-label="Capture medicine image" type="file" accept="image/*" capture="environment" onChange={event => addFiles(event.target.files)} /></label></div>
      </div>
      {!!files.length && <div className="medicine-previews" aria-label="Selected image previews">{files.map((item, index) => <article key={`${item.file.name}-${index}`}>{item.preview ? <img src={item.preview} alt={`Selected medicine image ${index + 1}`} /> : <i className="fas fa-file-image" aria-hidden="true" />}<div><strong>{item.file.name}</strong><small>{(item.file.size / 1024 / 1024).toFixed(2)} MB</small></div><button type="button" aria-label={`Remove ${item.file.name}`} onClick={() => removeFile(index)}><i className="fas fa-xmark" aria-hidden="true" /></button></article>)}</div>}
      <label className="medicine-consent"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} /><span>{CONSENT}</span></label>
      {error && <p className="medicine-error" role="alert">{error}</p>}
      {progress && <div className="medicine-live-status" role="status" aria-live="polite"><span className="medicine-spinner" aria-hidden="true" /> {progress}</div>}
      <button className="btn-primary react-auto-width" type="button" disabled={!files.length || !consent || !!progress} onClick={analyze}>{progress ? 'Analyzing…' : 'Analyze visible text'}</button>
    </section>

    {scan?.status === 'RETAKE_REQUIRED' && <section className="react-panel medicine-retake" role="alert"><h2>Another image is needed</h2><p>{scan.extraction_summary?.retake_reason || 'The visible medicine text could not be read reliably.'}</p><p>No catalogue match was attempted.</p></section>}
    {!!scan?.items?.length && <section className="medicine-review" aria-label="Medicines read from image">
      <div className="medicine-review-heading"><div><span className="medicine-kicker">Scan result</span><h2>Medicines read from your image</h2><p>Select a medicine to review its catalogue match, price and alternatives.</p></div><span className="medicine-result-count">{scan.items.length} {scan.items.length === 1 ? 'medicine' : 'medicines'}</span></div>
      <div className="medicine-read-list">{scan.items.map((item, index) => {
        const extracted = item.structured_extraction || {};
        const isSelected = selectedItemId === item.item_id;
        const confirmed = item.confirmation?.selection_type === 'CATALOGUE';
        return <div className="medicine-read-row" key={item.item_id}>
          <button type="button" className={`medicine-read-card ${isSelected ? 'is-selected' : ''}`} aria-expanded={isSelected} aria-controls={isSelected ? 'medicine-selected-detail' : undefined} onClick={() => setSelectedItemId(isSelected ? null : item.item_id)}>
            <span className="medicine-read-number">{String(index + 1).padStart(2, '0')}</span>
            <span className="medicine-read-copy"><strong>{medicineTitle(item, index)}</strong><small>{item.raw_visible_text || [extracted.generic_name_candidate, extracted.strength_text, extracted.dosage_form].filter(Boolean).join(' · ') || 'Review the extracted text'}</small></span>
            <span className={`medicine-read-state ${confirmed ? 'is-confirmed' : ''}`}>{confirmed ? 'Confirmed' : item.confirmation ? 'Recorded' : 'Review needed'}</span>
            <i className="fas fa-chevron-right" aria-hidden="true" />
          </button>
          <button type="button" className="medicine-read-savings" aria-label={`Show low-cost options for ${medicineTitle(item, index)}`} onClick={() => { setSelectedItemId(item.item_id); setSavingsItemId(item.item_id); }}><i className="fas fa-tags" aria-hidden="true" /><span>Low-cost options</span></button>
        </div>;
      })}</div>
      {scan.items.filter(item => item.item_id === selectedItemId).map(item => <div id="medicine-selected-detail" key={item.item_id}><ScanItem scan={scan} item={item} onUpdated={setScan} requestSavings={savingsItemId === item.item_id} onRequestSavings={() => setSavingsItemId(item.item_id)} /></div>)}
      <p className="medicine-list-note">Text recognition can be wrong. Confirm the medicine details before using a price comparison.</p>
    </section>}

    <details className="react-panel medicine-manual-search"><summary>Search the catalogue manually <i className="fas fa-chevron-down" aria-hidden="true" /></summary><p>Use this if the image is unclear or a medicine was not read. Quantity means number of units for a price estimate, not a dose recommendation.</p><form onSubmit={manualSearch}><label>Brand, ingredient, or registration-like reference<input value={manualQuery} onChange={event => setManualQuery(event.target.value)} required /></label><label>Quantity (optional)<input type="number" min="1" step="1" value={manualQuantity} onChange={event => setManualQuantity(event.target.value)} /></label><button className="btn-secondary" type="submit">Search catalogue</button></form><div className="medicine-manual-results">{manualResults.map(medicine => <article key={medicine.medicine_id}><button className="medicine-manual-result-button" type="button" aria-expanded={manualSelectedId === medicine.medicine_id} onClick={() => setManualSelectedId(current => current === medicine.medicine_id ? null : medicine.medicine_id)}><span><strong>{medicine.brand_name}</strong><small>{medicine.generic_name} · {medicine.strength} · {medicine.dosage_form}</small></span><span>View prices and alternatives <i className="fas fa-chevron-right" aria-hidden="true" /></span></button>{manualSelectedId === medicine.medicine_id && <ManualCatalogueDetail medicine={medicine} quantity={manualQuantity} />}</article>)}</div></details>

    {!!history.length && <section className="react-panel medicine-history"><h2>My recent scans</h2><div>{history.map(row => <article key={row.scan_id}><button type="button" onClick={() => openHistory(row.scan_id)}><strong>{row.scan_mode === 'prescription' ? 'Prescription' : 'Package'} scan</strong><span>{row.status.replaceAll('_', ' ').toLowerCase()}</span></button><button className="medicine-delete" type="button" aria-label="Delete scan" onClick={() => deleteScan(row.scan_id)}><i className="fas fa-trash" aria-hidden="true" /></button></article>)}</div></section>}
    <footer className="medicine-disclaimer">{WARNINGS.map(warning => <p key={warning}><i className="fas fa-circle-info" aria-hidden="true" /> {warning}</p>)}</footer>
  </div>;
}
