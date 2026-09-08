import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { createLandscape } from './landscapeWorld.js';
import { cameraAt, smooth } from './sceneTimeline.js';

export default function LandscapeScene({ timeline, compact, onReady, onFailure }) {
  const canvas = useRef(null), callbacks = useRef({ onReady, onFailure });
  callbacks.current = { onReady, onFailure };
  useEffect(() => {
    const element = canvas.current;
    let renderer, world;
    try {
      const context = element.getContext('webgl2', { alpha: true, antialias: !compact });
      if (!context) { callbacks.current.onFailure('webgl-unavailable'); return; }
      renderer = new THREE.WebGLRenderer({ canvas: element, context, alpha: true, antialias: !compact });
    } catch { callbacks.current.onFailure('webgl-initialization'); return; }
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, compact ? 1 : 1.5));
    renderer.shadowMap.enabled = !compact; renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace; renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.1;
    const scene = new THREE.Scene(); scene.fog = new THREE.FogExp2('#173c35', .014);
    const camera = new THREE.PerspectiveCamera(compact ? 52 : 46, 1, .2, 250);
    scene.add(new THREE.HemisphereLight('#cad6cb', '#142e27', 2.5));
    const sun = new THREE.DirectionalLight('#ffe3b8', 2.6); sun.position.set(-25, 38, -35); sun.castShadow = !compact;
    sun.shadow.mapSize.set(1024, 1024); sun.shadow.normalBias = .15; sun.shadow.radius = 3;
    Object.assign(sun.shadow.camera, { left: -50, right: 50, top: 50, bottom: -50, near: .5, far: 160 });
    sun.target.position.set(0, 0, -20); scene.add(sun, sun.target);
    try { world = createLandscape(scene, compact); }
    catch { renderer.dispose(); callbacks.current.onFailure('scene-construction'); return; }
    const stage = element.closest('.nx-stage');
    const labels = [...stage.querySelectorAll('[data-place]')];
    let frame = 0, visible = true, dead = false, first = true, previousProgress = -1, elapsed = 0, lastTime = 0;
    const point = new THREE.Vector3();
    function draw(time) {
      frame = 0; if (dead || !visible || document.hidden) return;
      if (lastTime) elapsed += Math.min((time - lastTime) / 1000, .05); lastTime = time;
      const p = timeline.motion ? timeline.progress : 0;
      const shot = compact ? { position: [20, 27, 31], target: [-3, 0, -24] } : cameraAt(p);
      camera.position.set(...shot.position); camera.lookAt(...shot.target); camera.updateMatrixWorld();
      world.update(p, compact ? 0 : elapsed);
      try { renderer.render(scene, camera); }
      catch { dead = true; callbacks.current.onFailure('render-error'); return; }
      if (first) { first = false; callbacks.current.onReady(); }
      if (previousProgress !== p) {
        previousProgress = p;
        // Inspectable local rendering diagnostics: actual camera values, never simulated test values.
        element.dataset.camera = camera.position.toArray().map(n => n.toFixed(3)).join(',');
        element.dataset.target = shot.target.map(n => n.toFixed(3)).join(',');
        element.dataset.progress = p.toFixed(4);
      }
      const stageRect = stage.getBoundingClientRect();
      const activePanel = stage.querySelector('[data-scene-panel][aria-hidden="false"]')?.getBoundingClientRect();
      const placedLabels = [];
      labels.forEach((label, i) => {
        point.copy(world.locations[i]).project(camera);
        const alpha = timeline.motion ? smooth(.54 + i * .06, .62 + i * .06, p) : 0;
        const show = alpha > .01 && point.z < 1 && Math.abs(point.x) < .96 && Math.abs(point.y) < .92;
        const w = label.offsetWidth, h = label.offsetHeight;
        let x = (point.x * .5 + .5) * stageRect.width, y = (-point.y * .5 + .5) * stageRect.height;
        // Leave the editorial copy its negative space, even at intermediate camera angles.
        if (activePanel && x - w / 2 < activePanel.right - stageRect.left + 16 && y > activePanel.top - stageRect.top && y - h < activePanel.bottom - stageRect.top) x = activePanel.right - stageRect.left + w / 2 + 20;
        x = Math.min(stageRect.width - w / 2 - 20, Math.max(w / 2 + 20, x));
        y = Math.max(h + 30, Math.min(stageRect.height - 120, y));
        for (const other of placedLabels) if (Math.abs(x - other.x) < (w + other.w) / 2 + 12 && Math.abs(y - other.y) < h + 12) y = other.y + h + 16;
        if (show) placedLabels.push({ x, y, w });
        label.style.left = `${x}px`; label.style.top = `${y}px`;
        label.style.opacity = show ? alpha : 0;
        label.style.visibility = show ? 'visible' : 'hidden';
        label.tabIndex = show && alpha > .5 ? 0 : -1;
        label.setAttribute('aria-hidden', String(!show || alpha < .5));
      });
      if (!compact) frame = requestAnimationFrame(draw);
    }
    function resume() { if (!frame && !dead && visible && !document.hidden) frame = requestAnimationFrame(draw); }
    function visibility() { cancelAnimationFrame(frame); frame = 0; lastTime = 0; resume(); }
    const observer = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; visibility(); }); observer.observe(element);
    const resize = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect; if (!width || !height) return;
      renderer.setSize(width, height, false); camera.aspect = width / height; camera.updateProjectionMatrix(); resume();
    }); resize.observe(element);
    function contextLost(event) { event.preventDefault(); dead = true; cancelAnimationFrame(frame); callbacks.current.onFailure('webgl-context-lost'); }
    element.addEventListener('webglcontextlost', contextLost);
    document.addEventListener('visibilitychange', visibility); timeline.listeners.add(resume); resume();
    return () => {
      dead = true; cancelAnimationFrame(frame); observer.disconnect(); resize.disconnect();
      document.removeEventListener('visibilitychange', visibility); element.removeEventListener('webglcontextlost', contextLost); timeline.listeners.delete(resume);
      world.dispose(); sun.shadow.dispose(); renderer.dispose();
      labels.forEach(label => { label.style.visibility = 'hidden'; label.tabIndex = -1; });
    };
  }, [timeline, compact]);
  return <canvas ref={canvas} className="nx-landscape-canvas" aria-hidden="true" />;
}
