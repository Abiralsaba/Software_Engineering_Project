import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useVoiceInput } from './useVoiceInput.js';
import { apiRequest } from '../../services/api.js';
vi.mock('../../services/api.js',()=>({apiRequest:vi.fn()}));
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();apiRequest.mockReset();});
function microphone(getStream){
  vi.stubGlobal('navigator',{mediaDevices:{getUserMedia:vi.fn(getStream)}});
  class Recorder { static isTypeSupported(){return true;} constructor(){this.state='inactive';this.mimeType='audio/webm';} start(){this.state='recording';} stop(){this.state='inactive';this.ondataavailable?.({data:new Blob(['synthetic'])});this.onstop?.();} }
  vi.stubGlobal('MediaRecorder',Recorder);
}
describe('voice input lifecycle',()=>{
  it('only produces an editable transcript and stops microphone tracks',async()=>{
    const stop=vi.fn(),onTranscript=vi.fn();microphone(async()=>({getTracks:()=>[{stop}]}));
    apiRequest.mockResolvedValue({transcript:'পানির সংযোগ'});
    const {result}=renderHook(()=>useVoiceInput({language:'bn',onTranscript,onError:vi.fn()}));
    await act(async()=>result.current.toggle());expect(result.current.state).toBe('listening');expect(onTranscript).not.toHaveBeenCalled();
    await act(async()=>result.current.toggle());
    expect(onTranscript).toHaveBeenCalledWith('পানির সংযোগ');expect(stop).toHaveBeenCalled();
    expect(apiRequest.mock.calls[0][0]).toBe('/api/assistant/audio');
    expect(apiRequest).toHaveBeenCalledTimes(1);
  });
  it('discards permission results after cancellation',async()=>{
    let resolve;const stop=vi.fn(),onTranscript=vi.fn();microphone(()=>new Promise(r=>{resolve=r;}));
    const {result}=renderHook(()=>useVoiceInput({language:'bn',onTranscript,onError:vi.fn()}));
    let pending;act(()=>{pending=result.current.toggle();});act(()=>result.current.cancel());
    await act(async()=>{resolve({getTracks:()=>[{stop}]});await pending;});
    expect(stop).toHaveBeenCalled();expect(apiRequest).not.toHaveBeenCalled();expect(result.current.state).toBe('idle');
  });
  it('discards a late transcript after cancellation',async()=>{
    let resolve;const onTranscript=vi.fn();microphone(async()=>({getTracks:()=>[{stop:vi.fn()}]}));
    apiRequest.mockImplementation(()=>new Promise(r=>{resolve=r;}));
    const {result}=renderHook(()=>useVoiceInput({language:'bn',onTranscript,onError:vi.fn()}));
    await act(async()=>result.current.toggle());await act(async()=>result.current.toggle());
    act(()=>result.current.cancel());await act(async()=>resolve({transcript:'stale answer'}));
    expect(onTranscript).not.toHaveBeenCalled();expect(result.current.state).toBe('idle');
  });
});
