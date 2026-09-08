export const clamp = value => Math.max(0, Math.min(1, value));
export const smooth = (start, end, value) => {
  const t = clamp((value - start) / (end - start));
  return t * t * (3 - 2 * t);
};

export const shots = [
  { at: 0, position: [23, 13, 32], target: [-5, 0, -18] },
  { at: .25, position: [12, 7, 16], target: [-1, 1, -17] },
  { at: .55, position: [6, 10, -1], target: [-3, 0, -30] },
  { at: .8, position: [29, 37, 19], target: [0, 0, -21] },
  { at: 1, position: [35, 30, 27], target: [0, 0, -19] }
];

export function cameraAt(progress) {
  const p = clamp(progress);
  const index = Math.min(shots.length - 2, Math.max(0, shots.findIndex((shot, i) => i < shots.length - 1 && p <= shots[i + 1].at)));
  const a = shots[index], b = shots[index + 1];
  const t = smooth(a.at, b.at, p);
  const mix = key => a[key].map((value, i) => value + (b[key][i] - value) * t);
  return { position: mix('position'), target: mix('target') };
}

export function panelWeights(p) {
  // Separate exit/entry windows prevent translucent headlines overlapping.
  return [1 - smooth(.19, .24, p), smooth(.24, .25, p) * (1 - smooth(.46, .50, p)), smooth(.50, .55, p) * (1 - smooth(.74, .78, p)), smooth(.78, .80, p)];
}

export function findScrollRoot(element) {
  for (let parent = element.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
    if (/(auto|scroll)/.test(getComputedStyle(parent).overflowY) && parent.scrollHeight > parent.clientHeight) return parent;
  }
  return window;
}

// Native scroll only. HTML and WebGL consume this exact progress value.
export function attachTimeline(section, stage, timeline, motion) {
  let frame = 0, disposed = false;
  const scrollRoot = findScrollRoot(section);
  const panels = [...stage.querySelectorAll('[data-scene-panel]')];
  function measure() {
    frame = 0; if (disposed) return;
    const top = scrollRoot === window ? 0 : scrollRoot.getBoundingClientRect().top;
    const travel = section.offsetHeight - stage.clientHeight;
    const p = motion && travel > 0 ? clamp((top - section.getBoundingClientRect().top) / travel) : 0;
    timeline.progress = p; timeline.motion = motion;
    section.dataset.progress = p.toFixed(4); stage.style.setProperty('--progress', p);
    panelWeights(p).forEach((opacity, i) => {
      const panel = panels[i];
      panel.style.opacity = opacity;
      panel.style.transform = `translateY(${(1 - opacity) * 22}px)`;
      panel.style.visibility = opacity < .01 ? 'hidden' : 'visible';
      panel.inert = opacity < .5; panel.setAttribute('aria-hidden', String(opacity < .5));
    });
    stage.dataset.chapter = String(p < .25 ? 1 : p < .55 ? 2 : p < .8 ? 3 : 4);
    timeline.listeners.forEach(listener => listener());
  }
  function request() { if (!frame && !disposed) frame = requestAnimationFrame(measure); }
  scrollRoot.addEventListener('scroll', request, { passive: true });
  window.addEventListener('resize', request, { passive: true });
  const observer = new ResizeObserver(request); observer.observe(section); observer.observe(stage);
  document.fonts?.ready.then(request); measure();
  return () => { disposed = true; cancelAnimationFrame(frame); observer.disconnect(); scrollRoot.removeEventListener('scroll', request); window.removeEventListener('resize', request); };
}
