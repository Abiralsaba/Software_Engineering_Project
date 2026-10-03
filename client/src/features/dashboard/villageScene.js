import * as THREE from 'three';

// An original miniature of a Bangladeshi river village. No remote models/textures.
function createVillage(scene, detailed = false, theme) {
  const root = new THREE.Group(); scene.add(root);
  const geometries = new Set(), materials = new Set();
  const material = (color, extra = {}) => {
    const value = new THREE.MeshStandardMaterial({ color, roughness: .72, ...extra });
    materials.add(value); return value;
  };
  const green = material('#27765b'), grass = material('#3f9770'), dark = material('#103f36');
  const clay = material('#8aab80'), roof = material('#bc5261', { metalness: .25, roughness: .45 });
  const wood = material('#8a7851'), cream = material('#e2d7ae'), water = material('#168e83', { metalness: .55, roughness: .28 });
  const glow = material('#ffc884', { emissive: '#f5a959', emissiveIntensity: .8 });
  const leaf = material('#399f70', { side: THREE.DoubleSide });
  const white = material('#d3d8bc'), spot = material('#42564a');
  const group = (parent = root, position = [0, 0, 0]) => {
    const g = new THREE.Group(); g.position.set(...position); parent.add(g); return g;
  };
  const mesh = (geometry, mat, position = [0, 0, 0], parent = root) => {
    geometries.add(geometry);
    const value = new THREE.Mesh(geometry, mat); value.position.set(...position);
    value.castShadow = true; value.receiveShadow = true;
    parent.add(value); return value;
  };
  const box = (size, mat, position, parent) => mesh(new THREE.BoxGeometry(...size), mat, position, parent);
  const sphereGeometry = new THREE.SphereGeometry(1, 16, 10);
  const ellipsoid = (size, mat, position, parent) => {
    const value = mesh(sphereGeometry, mat, position, parent); value.scale.set(...size); return value;
  };
  function tube(points, radius, mat, parent = root) {
    return mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), 16, radius, 5, false), mat, [0, 0, 0], parent);
  }

  // Beveled land and river shelves give the scene a small, sculpted diorama feel.
  const island = mesh(new THREE.CylinderGeometry(5.4, 4.85, .65, 64), dark, [0, -.32, 0]); island.scale.z = .62;
  const rim = mesh(new THREE.CylinderGeometry(5.4, 5.35, .13, 64), grass, [0, .055, 0]); rim.scale.z = .62;
  const riverShape = new THREE.Shape();
  riverShape.moveTo(-5.05, 1.08); riverShape.bezierCurveTo(-2.9, .2, -.2, 2.7, 2.5, 1.23);
  riverShape.bezierCurveTo(3.5, .7, 4.1, .65, 5.1, .95);
  riverShape.bezierCurveTo(5, 2.2, 2, 3.4, 0, 3.35);
  riverShape.bezierCurveTo(-2, 3.25, -4.3, 2.5, -5.05, 1.08);
  const riverGeo = new THREE.ShapeGeometry(riverShape, 40); riverGeo.rotateX(Math.PI / 2);
  // Shape coordinates are authored in the ground's x/z plane.
  mesh(riverGeo, water, [0, .145, 0]).material.side = THREE.DoubleSide;

  const ripples = [];
  const rippleMat = material('#8fddba', { transparent: true, opacity: .34 });
  for (let i = 0; i < 14; i++) {
    const x = -3.6 + (i % 7) * 1.08, z = 1.95 + Math.floor(i / 7) * .47;
    const ripple = ellipsoid([.19 + (i % 3) * .1, .008, .013], rippleMat, [x, .17, z]);
    ripples.push({ mesh: ripple, x, phase: i * 1.7 });
  }

  // Paddy rows on the left bank, with small raised earthen divisions.
  for (let i = 0; i < 3; i++) {
    box([1.3, .06, .68], i % 2 ? grass : green, [-2.9, .16, -.8 + i * .76]);
    for (let row = 0; row < 5; row++) {
      box([1.18, .04, .022], cream, [-2.9, .2, -1.04 + i * .76 + row * .12]);
    }
  }

  function hut(x, z, scale, turn) {
    const home = group(root, [x, .14, z]); home.scale.setScalar(scale); home.rotation.y = turn;
    box([1.95, .15, 1.7], wood, [0, .06, 0], home);
    box([1.6, 1.12, 1.32], clay, [0, .68, 0], home);
    // Gabled corrugated tin roofs; separate planes catch emerald and rose light.
    for (const side of [-1, 1]) {
      const panel = box([1.13, .075, 1.77], roof, [side * .43, 1.45, 0], home);
      panel.rotation.z = -side * .51;
      for (let seam = 0; seam < 9; seam++) {
        box([1.13, .025, .016], roof, [0, .053, -.79 + seam * .2], panel);
      }
    }
    box([.35, .74, .03], dark, [0, .48, .674], home);
    for (const side of [-1, 1]) {
      box([.31, .36, .035], wood, [side * .52, .87, .677], home);
      box([.23, .27, .04], glow, [side * .52, .87, .696], home);
      box([.027, .29, .045], wood, [side * .52, .87, .72], home);
      box([.065, 1.05, .065], wood, [side * .82, .57, .83], home);
    }
    box([.34, .34, .025], glow, [.81, .85, .08], home).rotation.y = Math.PI / 2;
    box([.8, .09, .4], wood, [0, .04, 1], home);
  }
  hut(.1, -.7, 1.12, -.12); hut(2.22, -.96, .76, -.2);

  // The service lives in the village: clinic, school, union office or departure ghat.
  if (theme) {
    const civic = group(root, [.05, .2, .28]);
    if (theme === 'health') {
      const medical = material('#e9ead3');
      box([.67, .39, .07], medical, [0, 1.2, 0], civic);
      box([.23, .065, .02], green, [0, 1.2, .05], civic);
      box([.065, .23, .02], green, [0, 1.2, .05], civic);
      // Shaded clinic waiting benches on the approach.
      for (const x of [-.85, .85]) {
        box([.55, .06, .25], cream, [x, .25, .65], civic);
        for (const dx of [-.2, .2]) box([.045, .23, .2], wood, [x + dx, .11, .65], civic);
      }
    } else if (theme === 'education') {
      box([.8, .46, .06], wood, [0, 1.2, 0], civic);
      box([.71, .37, .025], dark, [0, 1.2, .05], civic);
      for (let i = 0; i < 3; i++) box([.45 - i * .07, .022, .02], cream, [0, 1.3 - i * .09, .07], civic);
      for (const z of [.6, 1]) {
        box([.85, .05, .22], wood, [1.4, .36, z], civic);
        for (const x of [1.08, 1.72]) box([.06, .35, .15], wood, [x, .17, z], civic);
      }
    } else if (theme === 'nid') {
      box([.83, .43, .05], cream, [0, 1.2, 0], civic);
      box([.16, .22, .025], green, [-.24, 1.2, .04], civic);
      for (let i = 0; i < 3; i++) box([.32, .025, .025], dark, [.12, 1.29 - i * .08, .04], civic);
      box([.9, .08, .46], wood, [.2, .42, .8], civic);
      for (const x of [-.17, .57]) box([.06, .4, .35], wood, [x, .2, .8], civic);
      box([.25, .015, .3], cream, [.1, .47, .8], civic);
    } else if (theme === 'passport') {
      // Luggage beside the ferry landing: a departure from home, rooted in place.
      for (const [x, c] of [[-.45, roof], [.05, wood]]) {
        box([.32, .42, .19], c, [x, .25, 1.15], civic);
        box([.13, .04, .06], dark, [x, .49, 1.15], civic);
        box([.025, .42, .2], cream, [x - .09, .25, 1.15], civic);
      }
    }
  }

  const palms = [];
  function palm(x, z, scale, lean) {
    const tree = group(root, [x, .12, z]); tree.scale.setScalar(scale);
    tube([[0, 0, 0], [-.16, 1, 0], [lean, 2.35, .03], [lean + .1, 3.05, .02]], .085, wood, tree);
    const crown = group(tree, [lean + .1, 3.05, .02]); palms.push(crown);
    for (let i = 0; i < 8; i++) {
      const frond = group(crown); frond.rotation.y = i * Math.PI / 4;
      const vertices = [], indices = [];
      for (let j = 0; j <= 10; j++) {
        const t = j / 10, width = Math.sin(t * Math.PI) * .21;
        const y = Math.sin(t * Math.PI) * .36 - t * t * .6;
        vertices.push(t * 1.6, y, -width, t * 1.6, y + .045, 0, t * 1.6, y, width);
        if (j < 10) { const n = j * 3; indices.push(n, n + 3, n + 1, n + 1, n + 3, n + 4, n + 1, n + 4, n + 2, n + 2, n + 4, n + 5); }
      }
      const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3)); geo.setIndex(indices); geo.computeVertexNormals();
      mesh(geo, leaf, [0, 0, 0], frond);
    }
    for (let i = 0; i < 3; i++) ellipsoid([.14, .17, .14], green, [Math.cos(i * 2) * .16, -.08, Math.sin(i * 2) * .16], crown);
  }
  palm(1.6, -2, 1.15, .28); palm(-1.82, -1.8, .9, -.12); palm(3.58, -.25, .83, .25);
  for (const [x, z, s] of [[-4, -.8, .55], [3.8, -1.1, .5], [2.8, -2, .4]]) {
    ellipsoid([s, s * .85, s], green, [x, s * .6, z]);
    ellipsoid([s * .7, s * .7, s * .7], grass, [x - .22, s, z + .12]);
  }

  // A small native cow: ears, horns, hump, patches, and a slowly swishing tail.
  const cow = group(root, [-1.2, .23, .8]); cow.rotation.y = -.5; cow.scale.setScalar(.65);
  ellipsoid([.7, .36, .3], white, [0, .65, 0], cow);
  ellipsoid([.22, .24, .29], spot, [-.22, .74, .01], cow);
  ellipsoid([.16, .17, .21], white, [.3, .93, 0], cow);
  for (const x of [-.4, .4]) for (const z of [-.2, .2]) {
    box([.11, .48, .12], white, [x, .29, z], cow);
    box([.12, .08, .14], spot, [x, .075, z], cow);
  }
  const head = group(cow, [.65, .74, 0]);
  ellipsoid([.22, .3, .21], white, [.06, 0, 0], head);
  ellipsoid([.2, .11, .22], clay, [.16, -.21, 0], head);
  for (const side of [-1, 1]) {
    ellipsoid([.1, .055, .18], white, [0, .11, side * .26], head);
    ellipsoid([.035, .035, .025], dark, [.16, .045, side * .18], head);
    tube([[-.05, .18, side * .13], [-.1, .33, side * .2], [-.02, .39, side * .19]], .035, cream, head);
  }
  const tail = group(cow, [-.63, .7, 0]);
  tube([[0, 0, 0], [-.2, -.06, 0], [-.23, -.4, .06]], .028, white, tail);
  ellipsoid([.045, .085, .045], spot, [-.23, -.4, .06], tail);

  // Bangladesh flag: both cloth and red disc share the same wave deformation.
  const pole = group(root, [-3.85, .16, .18]);
  mesh(new THREE.CylinderGeometry(.025, .035, 2.2, 8), cream, [0, 1.1, 0], pole);
  ellipsoid([.06, .06, .06], cream, [0, 2.24, 0], pole);
  const flagGeo = new THREE.PlaneGeometry(.96, .57, 18, 10); flagGeo.translate(.48, 1.87, 0);
  const flag = mesh(flagGeo, material('#00895c', { side: THREE.DoubleSide }), [0, 0, 0], pole);
  const discGeo = new THREE.CircleGeometry(.18, 32); discGeo.translate(.42, 1.87, .012);
  mesh(discGeo, material('#f42a41', { side: THREE.DoubleSide }), [0, 0, 0], pole);

  const boat = group(root, [1.6, .23, 2.18]); boat.rotation.y = -.12;
  const hullShape = new THREE.Shape(); hullShape.moveTo(-1.05, .15);
  hullShape.quadraticCurveTo(-.58, -.51, .6, -.19); hullShape.quadraticCurveTo(.88, -.05, 1.06, .2); hullShape.quadraticCurveTo(0, -.05, -1.05, .15);
  const hullGeo = new THREE.ExtrudeGeometry(hullShape, { depth: .4, bevelEnabled: true, bevelThickness: .04, bevelSize: .04, bevelSegments: 2, steps: 1 });
  mesh(hullGeo, wood, [0, .16, -.2], boat);
  box([1.35, .04, .37], dark, [0, .12, 0], boat);
  mesh(new THREE.CylinderGeometry(.024, .035, 1.66, 8), cream, [.06, .92, 0], boat);
  const sailShape = new THREE.Shape(); sailShape.moveTo(.12, .55); sailShape.lineTo(.12, 1.74); sailShape.quadraticCurveTo(.93, 1.29, .86, .5); sailShape.closePath();
  mesh(new THREE.ShapeGeometry(sailShape), material('#dbb99a', { side: THREE.DoubleSide }), [0, 0, .025], boat);
  tube([[-.4, .4, .02], [-.8, .12, .4], [-1, -.05, .7]], .025, cream, boat);

  const birds = [];
  for (let i = 0; i < 5; i++) {
    const bird = group(root, [-2 + i * .78, 3.6 + Math.sin(i) * .27, -1.5 - i * .1]);
    const wings = [];
    for (const side of [-1, 1]) {
      const wing = group(bird); const shape = new THREE.Shape();
      shape.moveTo(0, 0); shape.quadraticCurveTo(side * .16, .16, side * .34, .04); shape.lineTo(side * .1, -.04);
      mesh(new THREE.ShapeGeometry(shape), cream, [0, 0, 0], wing).material.side = THREE.DoubleSide; wings.push(wing);
    }
    birds.push({ bird, wings, i });
  }

  const laundry = [], kites = [];
  if (detailed) {
    const straw = material('#b39a55'), terracotta = material('#a85f49'), pink = material('#cd797e');
    // Bamboo fences, a haystack and earthen pots around the courtyard.
    for (let i = 0; i < 9; i++) {
      box([.045, .42, .045], wood, [.35 + i * .26, .36, .58]);
    }
    for (const y of [.29, .48]) box([2.15, .035, .035], wood, [1.4, y, .58]);
    mesh(new THREE.ConeGeometry(.43, .86, 20), straw, [-.94, .57, -1.22]);
    mesh(new THREE.CylinderGeometry(.11, .14, .12, 12), terracotta, [.94, .2, .22]);
    ellipsoid([.18, .22, .18], terracotta, [1.1, .3, -.03]);
    // A bamboo landing on the river, complete with mooring posts.
    for (let i = 0; i < 9; i++) box([.7, .04, .1], wood, [3.15, .23, .6 + i * .12]);
    for (const x of [2.85, 3.45]) box([.06, .58, .06], wood, [x, .18, 1.6]);
    // Laundry catches the same breeze as the palms and the flag.
    for (const x of [-1.9, -.7]) box([.035, 1.02, .035], wood, [x, .66, -1.28]);
    tube([[-1.9, 1.17, -1.28], [-1.3, 1.1, -1.28], [-.7, 1.17, -1.28]], .008, cream);
    for (let i = 0; i < 3; i++) {
      const cloth = group(root, [-1.72 + i * .33, 1.1, -1.28]);
      box([.25, .37, .015], i === 1 ? pink : cream, [0, -.17, 0], cloth); laundry.push(cloth);
    }
    // A little cycle rickshaw: three wheels, curved canopy, seat and handlebars.
    const rickshaw = group(root, [2.5, .2, .1]); rickshaw.scale.setScalar(.48); rickshaw.rotation.y = -.45;
    for (const [x, z] of [[-.43, -.35], [.43, -.35], [0, .8]]) {
      const wheel = mesh(new THREE.TorusGeometry(.3, .035, 6, 20), dark, [x, .3, z], rickshaw); wheel.rotation.y = Math.PI / 2;
      tube([[x, .3, z], [x, .58, z]], .014, cream, rickshaw);
    }
    box([.7, .1, .66], roof, [0, .57, -.29], rickshaw);
    box([.7, .4, .08], pink, [0, .8, -.55], rickshaw);
    const hood = mesh(new THREE.CylinderGeometry(.46, .46, .8, 16, 1, true, 0, Math.PI), green, [0, 1.02, -.31], rickshaw); hood.rotation.z = Math.PI / 2;
    tube([[0, .3, .8], [0, .85, .6], [0, .87, .4]], .035, wood, rickshaw);
    tube([[-.25, .85, .6], [.25, .85, .6]], .035, cream, rickshaw);
    for (let i = 0; i < 5; i++) {
      const x = -2.8 + i * .37, z = 2.14 + Math.sin(i * 2) * .14;
      const pad = mesh(new THREE.CircleGeometry(.13, 14), leaf, [x, .18, z]); pad.rotation.x = -Math.PI / 2;
      ellipsoid([.05, .04, .05], pink, [x, .21, z]);
    }
    const kite = group(root, [-3, 3.55, -.5]);
    const diamond = new THREE.Shape(); diamond.moveTo(0, .42); diamond.lineTo(.28, 0); diamond.lineTo(0, -.34); diamond.lineTo(-.28, 0); diamond.closePath();
    mesh(new THREE.ShapeGeometry(diamond), material('#d88f61', { side: THREE.DoubleSide }), [0, 0, 0], kite);
    tube([[0, -.3, 0], [-.16, -.6, 0], [.08, -.83, 0]], .014, roof, kite);
    tube([[0, 0, 0], [.4, -1.2, .1], [.7, -2.5, .25]], .006, cream, kite); kites.push(kite);
  }

  return {
    root,
    setMood(mood) {
      grass.color.set(mood === 'harvest' ? '#9a9958' : mood === 'winter' ? '#72917b' : '#3f9770');
      leaf.color.set(mood === 'harvest' ? '#73934e' : '#399f70');
      water.color.set(mood === 'monsoon' ? '#427b7d' : '#168e83');
    },
    update(time) {
      laundry.forEach((cloth, i) => { cloth.rotation.x = Math.sin(time * 1.5 + i) * .15; });
      kites.forEach(kite => { kite.rotation.z = Math.sin(time * .65) * .15; kite.position.y = 3.55 + Math.sin(time * .8) * .12; });
      palms.forEach((crown, i) => { crown.rotation.z = Math.sin(time * .8 + i) * .045; crown.rotation.x = Math.cos(time * .65 + i) * .025; });
      head.rotation.z = -.15 + Math.sin(time * .65) * .16;
      tail.rotation.x = Math.sin(time * 1.8) * .55;
      boat.position.x = 1.5 + Math.sin(time * .18) * .7; boat.position.y = .25 + Math.sin(time * 1.4) * .04;
      boat.rotation.z = Math.sin(time * 1.25) * .025;
      for (const geo of [flagGeo, discGeo]) {
        const positions = geo.attributes.position;
        for (let i = 0; i < positions.count; i++) { const x = positions.getX(i); positions.setZ(i, Math.sin(x * 7 - time * 2.4) * x * .12 + (geo === discGeo ? .015 : 0)); }
        positions.needsUpdate = true; geo.computeVertexNormals();
      }
      ripples.forEach(({ mesh: ripple, x, phase }) => { ripple.position.x = x + Math.sin(time * .45 + phase) * .14; ripple.scale.x = .18 + (Math.sin(time + phase) + 1) * .13; });
      birds.forEach(({ bird, wings, i }) => {
        bird.position.x = -2 + i * .78 + Math.sin(time * .16) * .9;
        bird.position.y = 3.6 + Math.sin(i + time * .65) * .17;
        wings.forEach((wing, side) => { wing.rotation.x = Math.sin(time * 3.5 + i) * .55 * (side ? 1 : -1); });
      });
    },
    dispose() { geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); }
  };
}

export function mountVillage(canvas, onReady, onFailure, options = {}) {
  let renderer;
  try {
    const context = canvas.getContext('webgl2', { alpha: true, antialias: true, powerPreference: 'low-power' });
    if (!context) return null;
    renderer = new THREE.WebGLRenderer({ canvas, context, alpha: true, antialias: true });
  } catch { return null; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x000000, 0);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // Cache the miniature's shadows; the small ambient movements don't need a
  // second full scene render every frame on mobile GPUs.
  renderer.shadowMap.autoUpdate = false; renderer.shadowMap.needsUpdate = true;
  renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.05;
  const scene = new THREE.Scene();
  const ambient = new THREE.HemisphereLight('#daf7df', '#173b38', 1.8); scene.add(ambient);
  const sun = new THREE.DirectionalLight('#ffe0b2', 2.8); sun.position.set(-3, 7, 5); scene.add(sun);
  sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024); sun.shadow.normalBias = .035;
  Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: .5, far: 22 });
  const rim = new THREE.DirectionalLight('#ff8294', 1.3); rim.position.set(4, 3, -4); scene.add(rim);
  const camera = new THREE.PerspectiveCamera(35, 1, .1, 60);
  const world = createVillage(scene, options.detailed, options.theme);
  let frame = 0, disposed = false, paused = false, failed = false, elapsed = 0, previous = 0, rendered = false, visible = true;
  const pointer = { x: 0, y: 0 }, current = { x: 0, y: 0 };
  let aspect = 1;
  function draw(now) {
    frame = 0;
    if (disposed || failed || document.hidden || !visible) return;
    // 30 fps is ample for ambient motion and halves work on high refresh displays.
    if (!paused && previous && now - previous < 32) { frame = requestAnimationFrame(draw); return; }
    if (!paused && previous) elapsed += Math.min((now - previous) / 1000, .06);
    previous = now;
    current.x += ((paused ? 0 : pointer.x) - current.x) * .035;
    current.y += ((paused ? 0 : pointer.y) - current.y) * .035;
    const distance = aspect < 1.4 ? 1.4 / aspect : 1;
    camera.position.set((7.8 + current.x * .55) * distance, (7.4 + current.y * .35) * distance, 12.8 * distance);
    camera.lookAt(0, 1.05, 0);
    world.root.rotation.y = -.1;
    world.update(elapsed);
    try { renderer.render(scene, camera); }
    catch { failed = true; onFailure(); return; }
    if (!rendered) { rendered = true; onReady(); }
    if (!paused) frame = requestAnimationFrame(draw);
  }
  function resume() { if (!disposed && !failed && !document.hidden && visible && !frame) frame = requestAnimationFrame(draw); }
  const resize = new ResizeObserver(entries => {
    const { width, height } = entries[0].contentRect;
    if (!width || !height) return;
    aspect = width / height; camera.aspect = aspect; camera.updateProjectionMatrix();
    renderer.setSize(width, height, false); resume();
  }); resize.observe(canvas);
  const move = event => { if (event.pointerType === 'touch' || paused) return; pointer.x = event.clientX / window.innerWidth * 2 - 1; pointer.y = event.clientY / window.innerHeight * 2 - 1; };
  const visibility = () => { cancelAnimationFrame(frame); frame = 0; previous = 0; resume(); };
  const observer = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; visibility(); }); observer.observe(canvas);
  const lost = event => { event.preventDefault(); failed = true; cancelAnimationFrame(frame); frame = 0; onFailure(); };
  window.addEventListener('pointermove', move, { passive: true });
  document.addEventListener('visibilitychange', visibility); canvas.addEventListener('webglcontextlost', lost);
  resume();
  return {
    setMood(mood) {
      world.setMood(mood);
      const dusk = mood === 'dusk', rain = mood === 'monsoon';
      sun.color.set(dusk ? '#f5a175' : rain ? '#c3dce8' : '#ffe0b2');
      sun.intensity = dusk ? .75 : rain ? 1.5 : 2.8;
      ambient.intensity = dusk ? .85 : 1.8;
      rim.intensity = dusk ? 2 : 1.3;
      renderer.shadowMap.needsUpdate = true; resume();
    },
    setPaused(value) { paused = value; previous = 0; resume(); },
    dispose() {
      disposed = true; cancelAnimationFrame(frame); resize.disconnect(); observer.disconnect();
      window.removeEventListener('pointermove', move); document.removeEventListener('visibilitychange', visibility);
      canvas.removeEventListener('webglcontextlost', lost); world.dispose(); sun.shadow.dispose(); renderer.dispose();
    }
  };
}
