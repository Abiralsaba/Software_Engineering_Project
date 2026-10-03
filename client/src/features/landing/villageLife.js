import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

// Foreground village details for the existing continuous river landscape.
export function addVillageLife(scene, groundY, riverX) {
  const root = new THREE.Group(); scene.add(root);
  const geometries = new Set(), materials = new Set();
  const mat = color => { const m = new THREE.MeshStandardMaterial({ color, roughness: .85, side: THREE.DoubleSide }); materials.add(m); return m; };
  const bamboo = mat('#9b885d'), straw = mat('#aa975b'), cloth = mat('#bc745a'), cream = mat('#d4cfb3'), dark = mat('#324b3a');
  const mesh = (geo, material, position, parent = root) => {
    geometries.add(geo); const m = new THREE.Mesh(geo, material); m.position.set(...position); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m;
  };
  const box = (size, material, position, parent) => mesh(new THREE.BoxGeometry(...size), material, position, parent);
  const sphere = new THREE.SphereGeometry(1, 10, 7);
  const oval = (size, material, position, parent) => { const m = mesh(sphere, material, position, parent); m.scale.set(...size); return m; };
  // A bamboo footbridge connects the two banks, without blocking the boat route.
  const z = -5, x = riverX(z), deckY = 1.15;
  for (let i = 0; i < 28; i++) box([.27, .06, 1], bamboo, [x - 4.2 + i * .31, deckY, z]);
  for (const side of [-1, 1]) {
    box([9, .045, .045], bamboo, [x, deckY + .65, z + side * .5]);
    for (let i = 0; i < 5; i++) box([.075, 1.8, .075], bamboo, [x - 4 + i * 2, deckY - .2, z + side * .5]);
  }
  for (const [px, pz] of [[-10, -9], [-12, -10], [13, -27]]) mesh(new THREE.ConeGeometry(.85, 1.8, 14), straw, [px, groundY(px, pz) + .9, pz]);

  const cows = [];
  for (const [px, pz, angle] of [[-8, -12, .3], [-10, -14, 2.5], [14, -17, -.5]]) {
    const cow = new THREE.Group(); cow.position.set(px, groundY(px, pz), pz); cow.rotation.y = angle; root.add(cow);
    oval([.7, .35, .3], cream, [0, .82, 0], cow); oval([.22, .28, .31], dark, [-.2, .87, 0], cow);
    for (const a of [-.4, .4]) for (const b of [-.2, .2]) box([.12, .6, .13], cream, [a, .35, b], cow);
    const head = new THREE.Group(); head.position.set(.64, .85, 0); cow.add(head);
    oval([.23, .32, .21], cream, [.07, -.1, 0], head);
    for (const side of [-1, 1]) { oval([.12, .05, .18], cream, [0, .02, side * .23], head); mesh(new THREE.ConeGeometry(.045, .22, 5), bamboo, [0, .26, side * .12], head); }
    cows.push(head);
  }
  const laundry = [];
  for (const px of [15.1, 18.1]) box([.06, 2, .06], bamboo, [px, groundY(px, -30) + 1, -30]);
  box([3, .02, .02], cream, [16.6, groundY(16.6, -30) + 1.85, -30]);
  for (let i = 0; i < 4; i++) {
    const garment = new THREE.Group(); garment.position.set(15.5 + i * .65, groundY(16.6, -30) + 1.8, -30); root.add(garment);
    box([.48, .7, .025], i % 2 ? cream : cloth, [0, -.35, 0], garment); laundry.push(garment);
  }
  const birds = [];
  for (let i = 0; i < 7; i++) {
    const bird = new THREE.Group(); root.add(bird);
    const wings = [];
    for (const side of [-1, 1]) {
      const shape = new THREE.Shape(); shape.moveTo(0, 0); shape.quadraticCurveTo(side * .3, .2, side * .65, .03); shape.lineTo(side * .1, -.07);
      const wing = mesh(new THREE.ShapeGeometry(shape), cream, [0, 0, 0], bird); wing.castShadow = false; wings.push(wing);
    }
    birds.push({ bird, wings });
  }
  const kites = [];
  for (const [px, pz] of [[-7, -20], [9, -38]]) {
    const kite = new THREE.Group(); kite.position.set(px, 7, pz); root.add(kite);
    const shape = new THREE.Shape(); shape.moveTo(0, .7); shape.lineTo(.5, 0); shape.lineTo(0, -.55); shape.lineTo(-.5, 0); shape.closePath();
    mesh(new THREE.ShapeGeometry(shape), cloth, [0, 0, 0], kite);
    const lineMat = new THREE.LineBasicMaterial({ color: '#d4cfb3', transparent: true, opacity: .5 }); materials.add(lineMat);
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, -.5, 0), new THREE.Vector3(-.2, -1.1, 0), new THREE.Vector3(.15, -1.6, 0)]); geometries.add(geo); kite.add(new THREE.Line(geo, lineMat)); kites.push(kite);
  }
  // Batch the bridge, haystacks and animal bodies. Only the moving parts need
  // their own draw calls, even though the landscape contains more detail.
  root.updateMatrixWorld(true);
  const animated = new Set([...cows, ...laundry, ...kites, ...birds.map(({ bird }) => bird)]);
  const batches = new Map();
  root.traverse(item => {
    if (!item.isMesh) return;
    for (let parent = item; parent; parent = parent.parent) if (animated.has(parent)) return;
    let geo = item.geometry.clone().applyMatrix4(item.matrixWorld);
    if (geo.index) { const flattened = geo.toNonIndexed(); geo.dispose(); geo = flattened; }
    geo.deleteAttribute('uv');
    if (!batches.has(item.material)) batches.set(item.material, []);
    batches.get(item.material).push({ item, geo });
  });
  batches.forEach((entries, material) => {
    const merged = mergeGeometries(entries.map(({ geo }) => geo));
    if (merged) { mesh(merged, material, [0, 0, 0]); entries.forEach(({ item }) => item.removeFromParent()); }
    entries.forEach(({ geo }) => geo.dispose());
  });
  return {
    update(time) {
      cows.forEach((head, i) => { head.rotation.z = -.3 + Math.sin(time * .6 + i) * .16; });
      laundry.forEach((garment, i) => { garment.rotation.x = Math.sin(time * 1.2 + i) * .18; });
      kites.forEach((kite, i) => { kite.rotation.z = Math.sin(time * .7 + i) * .2; kite.position.y = 7 + Math.sin(time * .5 + i) * .25; });
      birds.forEach(({ bird, wings }, i) => {
        bird.position.set(-3 + i * 1.3 + Math.sin(time * .07) * 8, 8.5 + Math.sin(i * .7 + time * .4) * .3, -22 - i * 1.2);
        wings.forEach((wing, side) => { wing.rotation.y = Math.sin(time * 3 + i) * .5 * (side ? 1 : -1); });
      });
    },
    dispose() { geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); root.removeFromParent(); }
  };
}
