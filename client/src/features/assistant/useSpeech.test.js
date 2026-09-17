import { describe, expect, it } from 'vitest';
import { selectVoice } from './useSpeech';

describe('speech language selection', () => {
  const english = { lang: 'en-US' }, hindi = { lang: 'hi-IN' };
  const bengaliIndia = { lang: 'bn-IN' }, bengaliBangladesh = { lang: 'bn-BD' };
  it('prefers Bangladesh Bengali and accepts another Bengali voice', () => {
    expect(selectVoice([english, bengaliIndia, bengaliBangladesh], 'bn')).toBe(bengaliBangladesh);
    expect(selectVoice([english, bengaliIndia], 'bn')).toBe(bengaliIndia);
  });
  it('does not substitute Hindi or English when Bengali is unavailable', () => {
    expect(selectVoice([english, hindi], 'bn')).toBeUndefined();
    expect(selectVoice([english, hindi], 'en')).toBe(english);
  });
});
