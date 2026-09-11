import { useEffect, useRef, useState } from 'react';
export function useSpeech(language) {
  const [available, setAvailable] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const voices = useRef([]);
  useEffect(() => {
    const engine = window.speechSynthesis;
    if (!engine) return;
    const load = () => { voices.current = engine.getVoices(); setAvailable(voices.current.length > 0); };
    load(); engine.addEventListener('voiceschanged', load);
    return () => { engine.cancel(); engine.removeEventListener('voiceschanged', load); };
  }, []);
  function stop() { window.speechSynthesis?.cancel(); setSpeaking(false); }
  function speak(bn, en) {
    stop();
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) return;
    const preferred = (language === 'bn' ? ['bn-BD','bn-IN','en-US'] : ['en-US']).map(lang => voices.current.find(v => v.lang.toLowerCase() === lang.toLowerCase())).find(Boolean);
    const voice = preferred || voices.current.find(v => v.lang.startsWith('en'));
    if (!voice) return;
    const utterance = new SpeechSynthesisUtterance(voice.lang.startsWith('bn') ? bn : en);
    utterance.voice = voice; utterance.lang = voice.lang; utterance.rate = 0.9;
    utterance.onend = utterance.onerror = () => setSpeaking(false);
    setSpeaking(true); window.speechSynthesis.speak(utterance);
  }
  return { speak, stop, available, speaking };
}
