import { useEffect, useRef, useState } from 'react';
import { apiRequest } from '../../services/api.js';
import { useSpeech } from './useSpeech';
import './assistant.css';
const destinations = new Set(['/nid.html','/nid.html?section=reissue','/nid.html?section=correction','/nid.html?section=smart-card','/nid.html?section=applications']);
export default function AssistantPanel({ onApplication, application, accountKey = 'citizen' }) {
  const [session, setSession] = useState(null);
  const [language, setLanguage] = useState('bn');
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [field, setField] = useState('');
  const recorder = useRef(null); const stream = useRef(null); const timer = useRef(null); const abort = useRef(null); const alive = useRef(true);
  const speech = useSpeech(language);
  const storageKey = `nationx-assistant-${accountKey}`;
  useEffect(() => {
    if (application && session?.application?.id === application.id && session.application.version !== application.version) {
      setSession(current => ({ ...current, application, expected_field: application.missing_fields[0] || null }));
      setField(application.missing_fields[0] || '');
    }
  }, [application, session?.application?.id, session?.application?.version]);
  useEffect(() => {
    alive.current = true;
    const id = sessionStorage.getItem(storageKey);
    if (id) apiRequest(`/api/assistant/sessions/${id}`).then(apply).catch(() => sessionStorage.removeItem(storageKey));
    return () => { alive.current = false; clearTimeout(timer.current); abort.current?.abort(); if (recorder.current?.state === 'recording') recorder.current.stop(); stream.current?.getTracks().forEach(t => t.stop()); };
  }, [storageKey]);
  function apply(value) {
    if (!alive.current) return;
    setSession(value); setField(value.expected_field || '');
    if (value.session_id) sessionStorage.setItem(storageKey, value.session_id);
    if (value.application) onApplication?.(value.application);
  }
  async function ensure() {
    if (session && session.state !== 'CANCELLED') return session.session_id;
    const value = await apiRequest('/api/assistant/sessions', { method: 'POST', body: {} }); apply(value); return value.session_id;
  }
  async function send(event, command) {
    event?.preventDefault(); if (busy) return;
    setBusy(true); setError(''); speech.stop();
    try {
      const id = await ensure();
      const value = await apiRequest(`/api/assistant/sessions/${id}/message`, { method: 'POST', body: { text: command || text, confirmed: true, ...(!command && field ? { field, version: session.application.version } : {}) } });
      apply(value); setText(''); speech.speak(value.message_bn, value.message_en);
    } catch (e) { setError(e.data?.message || e.message); }
    finally { setBusy(false); }
  }
  async function record() {
    if (listening) { recorder.current?.stop(); return; }
    speech.stop(); setError('');
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { setError('Microphone is unavailable. Type your message below.'); return; }
    try {
      const id = await ensure();
      stream.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = ['audio/webm','audio/mp4','audio/ogg'].find(t => MediaRecorder.isTypeSupported(t));
      const r = new MediaRecorder(stream.current, mimeType ? { mimeType } : undefined); recorder.current = r;
      const parts = [];
      r.ondataavailable = e => { if (e.data.size) parts.push(e.data); };
      r.onstop = async () => {
        clearTimeout(timer.current); stream.current?.getTracks().forEach(t => t.stop());
        if (!alive.current) return;
        setListening(false); setBusy(true);
        try {
          const form = new FormData(); form.append('audio', new Blob(parts, { type: r.mimeType }), 'recording'); form.append('language', language);
          abort.current = new AbortController();
          const result = await apiRequest(`/api/assistant/sessions/${id}/audio`, { method: 'POST', body: form, signal: abort.current.signal });
          if (alive.current) setText(result.transcript); // Never automatically send a heard answer.
        } catch (e) { if (alive.current) setError(e.data?.message || 'Speech failed. Please type your answer.'); }
        finally { if (alive.current) setBusy(false); }
      };
      r.start(); setListening(true); timer.current = setTimeout(() => r.stop(), 15000);
    } catch { stream.current?.getTracks().forEach(t => t.stop()); setError('Microphone permission denied or unavailable. Text input still works.'); }
  }
  async function cancel() {
    abort.current?.abort(); speech.stop();
    if (recorder.current?.state === 'recording') { recorder.current.onstop = null; recorder.current.stop(); }
    clearTimeout(timer.current); stream.current?.getTracks().forEach(t => t.stop()); setListening(false);
    try { if (session) apply(await apiRequest(`/api/assistant/sessions/${session.session_id}/cancel`, { method: 'POST', body: {} })); }
    catch (e) { setError(e.message); }
    sessionStorage.removeItem(storageKey);
  }
  return <section className="nx-assistant" aria-label="NationX voice assistant">
    <header><div><small>NATIONX · VOICE & TEXT</small><h2>আপনার সেবা সহকারী</h2><p>Your service assistant</p></div><label>Language<select value={language} onChange={e => setLanguage(e.target.value)}><option value="bn">বাংলা</option><option value="en">English</option></select></label></header>
    <p role="status" aria-live="polite">{listening ? 'শুনছি… Listening (maximum 15 seconds)' : busy ? 'Processing…' : speech.speaking ? 'Speaking…' : session?.message_bn || 'কী সেবা প্রয়োজন? বলুন অথবা লিখুন।'}</p>
    <p>{session?.message_en || 'Say or type what you need. Always check the transcript before sending.'}</p>
    {error && <p role="alert">{error}</p>}
    <div className="nx-actions"><button type="button" className="nx-mic" onClick={record} disabled={busy}>{listening ? '■ Stop recording' : '● Tap to speak'}</button><button type="button" onClick={() => speech.speak(session?.message_bn || 'কী সেবা প্রয়োজন?',session?.message_en || 'What service do you need?')}>Replay</button><button type="button" onClick={speech.stop}>Stop speech</button></div>
    {!speech.available && <small>No speech voice is available yet. You can complete every step using text.</small>}
    <form onSubmit={send}>
      {session?.application && <label>Answer or correct a field<select value={field} onChange={e => { setField(e.target.value); setText(session.application.fields[e.target.value] || ''); }}><option value="">Service command</option>{session.application.rules.fields.map(key => <option value={key} key={key}>{session.application.rules.labels[key][1]}</option>)}</select></label>}
      <label htmlFor="assistant-transcript">{field ? session?.application?.rules.labels[field][1] : 'Transcript / typed message'}</label>
      {field === 'gender' ? <select id="assistant-transcript" value={text} onChange={e => setText(e.target.value)} required><option value="">Choose</option><option>Male</option><option>Female</option><option>Other</option></select> : <textarea id="assistant-transcript" maxLength={1000} value={text} onChange={e => setText(e.target.value)} required placeholder="আমার NID বানাও" />}
      <div className="nx-actions"><button disabled={busy || listening || !text.trim()} type="submit">Yes — confirm and send</button><button type="button" onClick={() => setText('')}>No — clear answer</button></div>
    </form>
    <div className="nx-actions"><button disabled={busy} onClick={e => send(e,'আমার NID বানাও')}>New application</button><button disabled={busy} onClick={e => send(e,'আমার আবেদন কোথায় আছে?')}>Application status</button><button disabled={busy} onClick={e => send(e,'back')}>Back / Correct</button><button type="button" onClick={cancel}>Cancel assistant</button></div>
    {session?.action === 'NAVIGATE' && destinations.has(session.destination) && <a href={session.destination}>Open NID service form →</a>}
    <small>Local transcription · AI understands commands only · Nothing is submitted without final review and confirmation.</small>
  </section>;
}
