import { useEffect, useRef, useState } from 'react';
import { apiRequest } from '../../services/api.js';
export function selectVoice(voices, language) {
  const prefix = language === 'bn' ? 'bn' : 'en';
  const normalized = voice => voice.lang.toLowerCase().replaceAll('_', '-');
  return voices.find(voice => normalized(voice) === (prefix === 'bn' ? 'bn-bd' : 'en-us'))
    || voices.find(voice => normalized(voice).split('-')[0] === prefix);
}
export function useSpeech(language) {
  const [available, setAvailable] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [error, setError] = useState('');
  const playback = useRef(null), pending = useRef(null), objectUrl = useRef(null);
  const voices = useRef([]);
  useEffect(() => {
    const engine = window.speechSynthesis;
    if (!engine) { setAvailable(language === 'bn'); return stop; }
    const load = () => { voices.current = engine.getVoices(); setAvailable(language === 'bn' || Boolean(selectVoice(voices.current, language))); };
    load(); engine.addEventListener('voiceschanged', load);
    return () => { stop(); engine.removeEventListener('voiceschanged', load); };
  }, [language]);
  useEffect(() => { setSpeaking(false); }, [language]);
  function stop() {
    pending.current?.abort(); pending.current = null;
    if (playback.current) { playback.current.pause(); playback.current.removeAttribute('src'); playback.current = null; }
    if (objectUrl.current) { URL.revokeObjectURL(objectUrl.current); objectUrl.current = null; }
    window.speechSynthesis?.cancel(); setSpeaking(false);
  }
  async function speak(bn, en) {
    stop();
    setError('');
    if (language === 'bn') {
      const controller = new AbortController(); pending.current = controller;
      setSpeaking(true);
      try {
        const result = await apiRequest('/api/assistant/speech', { method: 'POST', body: { text: bn }, signal: controller.signal });
        if (controller.signal.aborted) return;
        const bytes = Uint8Array.from(atob(result.audio), char => char.charCodeAt(0));
        objectUrl.current = URL.createObjectURL(new Blob([bytes], { type: result.mime }));
        const audio = new Audio(objectUrl.current); playback.current = audio;
        audio.onended = () => { if (playback.current === audio) stop(); };
        audio.onerror = () => { if (playback.current === audio) { stop(); setError('বাংলা অডিও চালানো যায়নি। Replay চাপুন।'); } };
        await audio.play();
      } catch (e) {
        if (!controller.signal.aborted) { stop(); setError(e.data?.message || 'বাংলা অডিও চালাতে Replay চাপুন।'); }
      }
      return;
    }
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) return;
    const voice = selectVoice(window.speechSynthesis.getVoices(), language);
    setAvailable(Boolean(voice));
    if (!voice) return;
    const utterance = new SpeechSynthesisUtterance(language === 'bn' ? bn.replace(/\bNID\b/g, 'এন আই ডি') : en);
    utterance.voice = voice; utterance.lang = voice.lang; utterance.rate = 0.9;
    utterance.onend = utterance.onerror = () => setSpeaking(false);
    setSpeaking(true); window.speechSynthesis.speak(utterance);
  }
  return { speak, stop, available, speaking, error };
}
