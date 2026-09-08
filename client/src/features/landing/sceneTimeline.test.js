import { describe, expect, it } from 'vitest';
import { cameraAt, panelWeights, shots } from './sceneTimeline.js';

describe('single cinematic timeline', () => {
  it.each(shots)('reaches the actual camera keyframe at $at', shot => {
    expect(cameraAt(shot.at)).toEqual({ position: shot.position, target: shot.target });
  });
  it('is deterministic in either scroll direction and clamps its endpoints', () => {
    const forward = [.1, .4, .6, .9].map(cameraAt);
    expect([.9, .6, .4, .1].map(cameraAt).reverse()).toEqual(forward);
    expect(cameraAt(-1)).toEqual(cameraAt(0)); expect(cameraAt(2)).toEqual(cameraAt(1));
  });
  it('never overlays two translucent text panels', () => {
    for (let i = 0; i <= 1000; i++) expect(panelWeights(i / 1000).filter(weight => weight > .01).length).toBeLessThanOrEqual(1);
  });
});
