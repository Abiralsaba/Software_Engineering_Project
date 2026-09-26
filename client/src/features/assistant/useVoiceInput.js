import { useEffect, useRef, useState } from 'react';
import { apiRequest } from '../../services/api.js';

export function useVoiceInput({ language, onTranscript, onError }) {
  const [state,setState]=useState('idle');
  const current=useRef({generation:0,recorder:null,stream:null,timer:null,controller:null});
  function cancel() {
    const value=current.current; value.generation++;
    clearTimeout(value.timer); value.controller?.abort();
    if(value.recorder?.state==='recording') { value.recorder.onstop=null; value.recorder.stop(); }
    value.stream?.getTracks().forEach(track=>track.stop()); setState('idle');
  }
  useEffect(()=>cancel,[]);
  async function toggle() {
    const value=current.current;
    if(value.recorder?.state==='recording') { value.recorder.stop(); return; }
    if(state!=='idle') return;
    if(!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { onError('Microphone unavailable. You can type your answer.'); return; }
    const generation=++value.generation; setState('permission');
    try {
      const stream=await navigator.mediaDevices.getUserMedia({audio:true});
      if(generation!==value.generation) { stream.getTracks().forEach(track=>track.stop()); return; }
      value.stream=stream;
      const mimeType=['audio/webm','audio/mp4','audio/ogg'].find(type=>MediaRecorder.isTypeSupported(type));
      const recorder=new MediaRecorder(stream,mimeType?{mimeType}:undefined); value.recorder=recorder;
      const chunks=[];
      recorder.ondataavailable=event=>{if(event.data.size) chunks.push(event.data);};
      recorder.onerror=()=>{ if(generation===value.generation) { cancel(); onError('Recording failed. You can type your answer.'); } };
      recorder.onstop=async()=>{
        clearTimeout(value.timer); stream.getTracks().forEach(track=>track.stop());
        if(generation!==value.generation) return;
        setState('transcribing');
        try {
          const body=new FormData(); body.append('audio',new Blob(chunks,{type:recorder.mimeType}),'recording'); body.append('language',language);
          value.controller=new AbortController();
          const result=await apiRequest('/api/assistant/audio',{method:'POST',body,signal:value.controller.signal});
          if(generation===value.generation) onTranscript(result.transcript || '');
        } catch(error) { if(generation===value.generation) onError(error.data?.message || 'Transcription unavailable. Please type your answer.'); }
        finally { if(generation===value.generation) setState('idle'); }
      };
      recorder.start(); setState('listening'); value.timer=setTimeout(()=>{if(recorder.state==='recording')recorder.stop();},15000);
    } catch { if(generation===value.generation) { cancel(); onError('Microphone permission denied or unavailable. Typing still works.'); } }
  }
  return {state,toggle,cancel};
}
