import { useEffect, useMemo, useRef, useState } from 'react';
import { apiRequest } from '../../services/api.js';

const CONSENT = 'I understand that image extraction may make mistakes. I will verify the result and consult a doctor or pharmacist before changing medicine.';
const WARNINGS = ['Dataset-derived estimated price', 'Current pharmacy price may differ', 'Professional confirmation is required'];
const editableFields = [
  ['brand_name_candidate', 'Brand'], ['generic_name_candidate', 'Generic/ingredient'], ['strength_text', 'Strength'],
  ['dosage_form', 'Dosage form'], ['manufacturer_candidate', 'Manufacturer'], ['registration_reference_candidate', 'Registration-like reference']
];

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
    <div><MedicineFacts medicine={candidate.medicine} /><p className="medicine-evidence"><strong>Matched:</strong> {candidate.matching_evidence.join(', ') || 'bounded catalogue retrieval'}</p>
      {!!candidate.conflicts_or_missing.length && <p className="medicine-warning"><i className="fas fa-triangle-exclamation" aria-hidden="true" /> <strong>Check:</strong> {candidate.conflicts_or_missing.join(', ')}</p>}
    </div>
  </label>;
}

function ScanItem({ scan, item, onUpdated }) {
  const extracted = item.structured_extraction || {};
  const [selected, setSelected] = useState(item.confirmation?.medicine_id || '');
  const [manualLabel, setManualLabel] = useState('');
  const [manualMode, setManualMode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [alternatives, setAlternatives] = useState(null);
  const [confirmedDetail, setConfirmedDetail] = useState(null);

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
      if (selectionType === 'CATALOGUE' && selected) setConfirmedDetail(await apiRequest(`/api/medicines/${selected}`));
      setAlternatives(null);
    } catch (requestError) { setError(requestError.message); }
    finally { setSubmitting(false); }
  }

  async function loadAlternatives() {
    setSubmitting(true); setError('');
    try { setAlternatives(await apiRequest(`/api/medicine-scans/${scan.scan_id}/items/${item.item_id}/alternatives`)); }
    catch (requestError) { setError(requestError.message); }
    finally { setSubmitting(false); }
  }

  const confirmedId = item.confirmation?.medicine_id;
  const confirmedCandidate = item.candidates.find(candidate => candidate.medicine.medicine_id === confirmedId)?.medicine;
  return <article className="medicine-review-item">
    <header><div><span>Visible medicine line</span><h3>{item.raw_visible_text || 'No readable medicine line'}</h3></div><span className="medicine-confidence">{extracted.model_confidence == null ? 'Confidence unavailable' : `${Math.round(extracted.model_confidence * 100)}% extraction confidence`}</span></header>
    {!!item.uncertain_fields?.length && <p className="medicine-warning" role="note"><i className="fas fa-circle-question" aria-hidden="true" /> Uncertain fields: {item.uncertain_fields.join(', ')}</p>}
    <form className="medicine-review-form">
      <fieldset><legend>Review and correct extracted fields</legend><div className="react-form-grid">{editableFields.map(([field, label]) => <label key={field}>{label}{item.uncertain_fields?.includes(field) && <span className="medicine-uncertain">Uncertain</span>}<input name={field} defaultValue={item.user_corrections?.[field] ?? extracted[field] ?? ''} /></label>)}</div>
        {scan.scan_mode === 'prescription' && <div className="react-form-grid"><label>Dose amount<input name="dose_amount" type="number" min="0" step="any" defaultValue={item.user_corrections?.dose_amount ?? extracted.dose_amount ?? ''} /></label><label>Times per day<input name="frequency_per_day" type="number" min="0" step="any" defaultValue={item.user_corrections?.frequency_per_day ?? extracted.frequency_per_day ?? ''} /></label><label>Duration days<input name="duration_days" type="number" min="0" step="any" defaultValue={item.user_corrections?.duration_days ?? extracted.duration_days ?? ''} /></label><label>Total quantity<input name="total_quantity" type="number" min="0" step="any" defaultValue={item.user_corrections?.total_quantity ?? extracted.total_quantity ?? ''} /></label></div>}
      </fieldset>
      <fieldset><legend>Catalogue candidates — choose one yourself</legend>
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
    </form>
    {item.confirmation?.selection_type === 'CATALOGUE' && <section className="medicine-confirmed" aria-label="Confirmed catalogue medicine"><h3>Confirmed by you</h3><MedicineFacts medicine={confirmedDetail || confirmedCandidate} packages={confirmedDetail?.packages || []} /><button className="btn-primary react-auto-width" type="button" disabled={submitting} onClick={loadAlternatives}>View possible lower-cost products</button></section>}
    {alternatives && <section className="medicine-alternatives"><h3>Possible lower-cost products with the same recorded specifications</h3>{alternatives.limitation && <p className="medicine-warning">{alternatives.limitation}</p>}<div className="medicine-alternative-grid">{alternatives.alternatives.map(option => <article key={option.medicine.medicine_id}><MedicineFacts medicine={option.medicine} /><p><strong>Matching evidence:</strong> {option.matching_specifications.join(', ')}</p>{option.package_comparison && <p><strong>Lowest package/unit:</strong> {option.package_comparison.currency} {option.package_comparison.estimated_per_unit}</p>}{option.purchase_estimate && <p><strong>Estimated purchase cost:</strong> {option.purchase_estimate.currency} {option.purchase_estimate.estimated_cost} ({option.purchase_estimate.selected_packages.map(pack => `${pack.count} × ${pack.package_original}`).join(', ')})</p>}{option.estimated_saving != null && <p className="medicine-saving"><strong>Estimated saving:</strong> BDT {option.estimated_saving}</p>}<p>{option.calculation}</p><p className="medicine-warning"><i className="fas fa-user-doctor" aria-hidden="true" /> Professional confirmation is required.</p></article>)}</div>{!alternatives.alternatives.length && !alternatives.limitation && <p className="react-empty-state">No eligible lower-cost catalogue match was found.</p>}</section>}
  </article>;
}

export default function MedicineIdentifier() {
  const [mode, setMode] = useState('prescription');
  const [files, setFiles] = useState([]);
  const filesRef = useRef(files);
  const [consent, setConsent] = useState(false);
  const [scan, setScan] = useState(null);
  const [history, setHistory] = useState([]);
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [manualQuery, setManualQuery] = useState('');
  const [manualResults, setManualResults] = useState([]);
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
    files.forEach(revokePreview); setFiles([]); setMode(next); setScan(null); setError('');
  }

  async function analyze() {
    if (!files.length || !consent) return;
    setError(''); setScan(null); setProgress('Checking image');
    const timers = [setTimeout(() => setProgress('Reading visible text'), 350), setTimeout(() => setProgress('Searching medicine catalogue'), 900)];
    try {
      const form = new FormData(); form.set('mode', mode); form.set('consent', 'true'); files.forEach(item => form.append('images', item.file));
      const result = await apiRequest('/api/medicine-scans', { method: 'POST', body: form });
      setProgress(result.status === 'RETAKE_REQUIRED' ? '' : 'Waiting for confirmation'); setScan(result);
      const list = await apiRequest('/api/medicine-scans?limit=10'); setHistory(list.scans || []);
    } catch (requestError) { setError(requestError.message); setProgress(''); }
    finally { timers.forEach(clearTimeout); }
  }

  async function manualSearch(event) {
    event.preventDefault(); setError('');
    try { const result = await apiRequest(`/api/medicines/search?q=${encodeURIComponent(manualQuery)}&limit=5`); setManualResults(result.medicines || []); }
    catch (requestError) { setError(requestError.message); }
  }

  async function openHistory(scanId) {
    try { setScan(await apiRequest(`/api/medicine-scans/${scanId}`)); setError(''); }
    catch (requestError) { setError(requestError.message); }
  }

  async function deleteScan(scanId) {
    try { await apiRequest(`/api/medicine-scans/${scanId}`, { method: 'DELETE' }); setHistory(current => current.filter(row => row.scan_id !== scanId)); if (scan?.scan_id === scanId) setScan(null); }
    catch (requestError) { setError(requestError.message); }
  }

  const modeLabel = useMemo(() => mode === 'prescription' ? 'Prescription Scan' : 'Medicine Package Scan', [mode]);
  return <div className="medicine-identifier">
    <section className="react-panel medicine-intro"><div><span className="medicine-kicker">Citizen-controlled catalogue matching</span><h2>Medicine Identifier</h2><p>Extract visible medicine text, review the result, and choose the catalogue match yourself.</p></div><i className="fas fa-prescription-bottle-medical" aria-hidden="true" /></section>
    <div className="medicine-safety-banner" role="note"><i className="fas fa-shield-heart" aria-hidden="true" /><div><strong>Identification support—not medical advice.</strong><p>Gemini reads visible text only. It does not diagnose, prescribe, change dosage, confirm equivalence, or choose your medicine.</p></div></div>
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

    <section className="react-panel medicine-manual-search"><h2>Manual catalogue search</h2><p>Use this if the image is unclear or Gemini is unavailable.</p><form onSubmit={manualSearch}><label>Brand, ingredient, or registration-like reference<input value={manualQuery} onChange={event => setManualQuery(event.target.value)} required /></label><button className="btn-secondary" type="submit">Search catalogue</button></form><div className="medicine-manual-results">{manualResults.map(medicine => <article key={medicine.medicine_id}><MedicineFacts medicine={medicine} /></article>)}</div></section>

    {scan?.status === 'RETAKE_REQUIRED' && <section className="react-panel medicine-retake" role="alert"><h2>Another image is needed</h2><p>{scan.extraction_summary?.retake_reason || 'The visible medicine text could not be read reliably.'}</p><p>No catalogue match was attempted.</p></section>}
    {!!scan?.items?.length && <section className="medicine-review"><h2>Review extraction and confirm each medicine</h2><p>Model output and your corrections are kept separately. No candidate is confirmed automatically.</p>{scan.items.map(item => <ScanItem key={item.item_id} scan={scan} item={item} onUpdated={setScan} />)}</section>}

    {!!history.length && <section className="react-panel medicine-history"><h2>My recent scans</h2><div>{history.map(row => <article key={row.scan_id}><button type="button" onClick={() => openHistory(row.scan_id)}><strong>{row.scan_mode === 'prescription' ? 'Prescription' : 'Package'} scan</strong><span>{row.status.replaceAll('_', ' ').toLowerCase()}</span></button><button className="medicine-delete" type="button" aria-label="Delete scan" onClick={() => deleteScan(row.scan_id)}><i className="fas fa-trash" aria-hidden="true" /></button></article>)}</div></section>}
    <footer className="medicine-disclaimer">{WARNINGS.map(warning => <p key={warning}><i className="fas fa-circle-info" aria-hidden="true" /> {warning}</p>)}</footer>
  </div>;
}
