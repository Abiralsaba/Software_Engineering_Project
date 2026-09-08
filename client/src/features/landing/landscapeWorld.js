import * as THREE from 'three';
import { smooth } from './sceneTimeline.js';

export const riverX = z => Math.sin(z * .068) * 6 + Math.sin(z * .145) * 1.4;
const riverWidth = z => 3.5 + Math.sin(z * .037) * .55;
const groundY = (x, z) => {
  const distance = Math.max(0, Math.abs(x - riverX(z)) - riverWidth(z));
  return .15 + Math.min(distance * .04, 1.2) + (Math.sin(x * .16 + z * .08) * .6 + Math.cos(z * .13) * .4) * Math.min(1, distance / 8);
};
export const locations = [
  { x: 9, z: -13, name: 'Identity' },
  { x: -13, z: -29, name: 'Health' },
  { x: 10, z: -44, name: 'Education' }
];

// Continuous terrain, not an extruded island. All artwork is original procedural geometry.
export function createLandscape(scene, compact) {
  const root = new THREE.Group(); scene.add(root);
  const materials = new Set(), geometries = new Set();
  const mat = (color, options = {}) => { const m = new THREE.MeshStandardMaterial({ color, roughness: .87, ...options }); materials.add(m); return m; };
  const clay = mat('#a66b50'), stone = mat('#c1b599'), roof = mat('#365f52'), shadow = mat('#15382f'), brass = mat('#b09b70', { metalness: .25 });
  const windowMat = mat('#e8b974', { emissive: '#db9d53', emissiveIntensity: .25 });
  function mesh(geometry, material, position = [0, 0, 0], parent = root) {
    geometries.add(geometry); const item = new THREE.Mesh(geometry, material);
    item.position.set(...position); item.castShadow = true; item.receiveShadow = true; parent.add(item); return item;
  }
  const box = (size, material, pos, parent) => mesh(new THREE.BoxGeometry(...size), material, pos, parent);
  const segmentCount = compact ? 100 : 180;
  for (const side of [-1, 1]) {
    const positions = [], indices = [], colors = [];
    for (let row = 0; row <= segmentCount; row++) {
      const z = 70 - row / segmentCount * 220;
      for (let col = 0; col <= 20; col++) {
        const x = riverX(z) + side * (riverWidth(z) + col / 20 * 95);
        positions.push(x, groundY(x, z), z);
        const color = new THREE.Color().setHSL(.405 + Math.sin(z * .07) * .015, .30, .085 + Math.sin(x * .17 + z * .1) * .016);
        colors.push(color.r, color.g, color.b);
        if (row < segmentCount && col < 20) {
          const a = row * 21 + col;
          if (side === 1) indices.push(a, a + 1, a + 21, a + 1, a + 22, a + 21);
          else indices.push(a, a + 21, a + 1, a + 1, a + 21, a + 22);
        }
      }
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geo.setIndex(indices); geo.computeVertexNormals();
    mesh(geo, mat('#ffffff', { vertexColors: true, side: THREE.DoubleSide }));
  }
  // The water surface follows the same bank function. Small analytic ripples, no textures/postprocessing.
  const waterVertices = [], waterIndices = [];
  for (let row = 0; row <= segmentCount; row++) {
    const z = 70 - row / segmentCount * 220;
    waterVertices.push(riverX(z) - riverWidth(z), .12, z, riverX(z) + riverWidth(z), .12, z);
    if (row < segmentCount) { const n = row * 2; waterIndices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2); }
  }
  const waterGeo = new THREE.BufferGeometry(); waterGeo.setAttribute('position', new THREE.Float32BufferAttribute(waterVertices, 3)); waterGeo.setIndex(waterIndices); waterGeo.computeVertexNormals();
  const waterMat = new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 } },
    vertexShader: `varying vec3 world; varying float depth; void main(){vec4 w=modelMatrix*vec4(position,1.);world=w.xyz;vec4 v=viewMatrix*w;depth=-v.z;gl_Position=projectionMatrix*v;}`,
    fragmentShader: `uniform float time;varying vec3 world;varying float depth;void main(){float wave=sin(world.z*5.+world.x*2.+time*.5)*sin(world.z*2.3-world.x*3.-time*.3);float glint=pow(max(0.,wave),14.);vec3 color=mix(vec3(.065,.24,.22),vec3(.15,.39,.35),.5+.25*sin(world.z*.17));color+=vec3(.32,.30,.18)*glint*.4;color=mix(color,vec3(.065,.16,.145),1.-exp(-depth*depth*.00008));gl_FragColor=vec4(color,1.);}`,
    side: THREE.DoubleSide
  }); materials.add(waterMat); mesh(waterGeo, waterMat).castShadow = false;
  // Fine water-current lines describe the river direction without a glowing outline.
  for (let line = 0; line < 5; line++) {
    const pts = [];
    for (let n = 0; n <= 150; n++) { const z = 38 - n * .8; pts.push(new THREE.Vector3(riverX(z) + (line - 2) * .53 + Math.sin(z * .4 + line) * .05, .135, z)); }
    const g = new THREE.BufferGeometry().setFromPoints(pts); geometries.add(g);
    const m = new THREE.LineBasicMaterial({ color: '#88baa0', transparent: true, opacity: .12 }); materials.add(m); root.add(new THREE.Line(g, m));
  }
  // Long, low rice terraces, laid over the terrain rather than a yellow checkerboard.
  for (let field = 0; field < 14; field++) {
    const z = 16 - Math.floor(field / 2) * 10, x = riverX(z) - 11 - (field % 2) * 11;
    const width = 8.5, depth = 7.5;
    const geo = new THREE.PlaneGeometry(width, depth, 8, 8); geo.rotateX(-Math.PI / 2);
    const points = geo.attributes.position;
    for (let i = 0; i < points.count; i++) points.setY(i, groundY(points.getX(i) + x, points.getZ(i) + z) + .035);
    geo.computeVertexNormals(); mesh(geo, mat(field % 3 ? '#476348' : '#65734b'), [x, 0, z]);
    for (let row = 0; row < (compact ? 6 : 12); row++) {
      const lineZ = z - depth / 2 + row / (compact ? 6 : 12) * depth;
      const pts = Array.from({ length: 10 }, (_, i) => { const lineX = x - width / 2 + i / 9 * width; return new THREE.Vector3(lineX, groundY(lineX, lineZ) + .085, lineZ); });
      const g = new THREE.BufferGeometry().setFromPoints(pts); geometries.add(g);
      const m = new THREE.LineBasicMaterial({ color: '#99a06c', transparent: true, opacity: .3 }); materials.add(m); root.add(new THREE.Line(g, m));
    }
  }
  const highlights = [];
  locations.forEach(({ x, z }, index) => {
    const building = new THREE.Group(); building.position.set(x, groundY(x, z), z); building.rotation.y = index === 1 ? .3 : -.12; root.add(building);
    const body = mat(index === 1 ? '#a69b7d' : '#9b654e', { emissive: '#8d6e38', emissiveIntensity: 0 }); highlights.push(body);
    box([6.4, .12, 4.9], stone, [0, .06, 0], building);
    // Asymmetric courtyard pavilions: terracotta fins, deep eaves, shaded openings.
    box([4.8, 2.2, 1.5], body, [0, 1.2, -1.3], building);
    box([1.15, 2.2, 3.5], body, [-2.1, 1.2, .3], building);
    box([1.15, 1.7, 3.5], body, [2.1, .95, .3], building);
    box([5.6, .14, 2.15], roof, [0, 2.39, -1.2], building);
    box([1.6, .12, 3.8], roof, [-2.1, 2.4, .4], building);
    box([1.6, .12, 3.8], stone, [2.1, 1.92, .4], building);
    box([2.8, .03, 2.1], shadow, [0, .14, .4], building);
    for (let fin = 0; fin < 13; fin++) box([.065, 1.6, .32], clay, [-1.8 + fin * .3, 1.15, -.37], building);
    for (let window = 0; window < 5; window++) box([.3, .9, .03], windowMat, [-1.5 + window * .75, 1.1, -.53], building);
    if (index === 2) { box([.9, 4.1, .9], body, [-2.2, 2.05, -1.3], building); box([1.1, .08, 1.1], brass, [-2.2, 4.15, -1.3], building); }
    for (let stair = 0; stair < 3; stair++) box([2.2, .07, .55], stone, [0, .1 - stair * .035, 2.5 + stair * .35], building);
  });
  // Seeded variation keeps screenshots/reverse playback reproducible.
  let seed = 31;
  const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const count = compact ? 55 : 105;
  const leafGeo = new THREE.SphereGeometry(1, compact ? 8 : 14, compact ? 6 : 10), trunkGeo = new THREE.CylinderGeometry(.035, .075, 1, 5);
  geometries.add(leafGeo); geometries.add(trunkGeo);
  const leaves = new THREE.InstancedMesh(leafGeo, mat('#86a58a'), count * 3), trunks = new THREE.InstancedMesh(trunkGeo, mat('#5b5940'), count);
  leaves.castShadow = true; leaves.receiveShadow = true; root.add(leaves, trunks);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < count; i++) {
    const groves = [[23, 0], [22, -25], [24, -49], [-22, -64], [-21, 8], [13, 29], [-30, -30]];
    const grove = groves[i % groves.length], side = Math.sign(grove[0]);
    const z = grove[1] + (random() - .5) * 13;
    let x = grove[0] + (random() - .5) * 9;
    if (locations.some(site => Math.hypot(site.x - x, site.z - z) < 6.5)) x += side * 8;
    const y = groundY(x, z), height = .7 + random() * 1.25;
    dummy.position.set(x, y + height * .45, z); dummy.scale.set(1, height * .9, 1); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); trunks.setMatrixAt(i, dummy.matrix);
    for (let crown = 0; crown < 3; crown++) {
      dummy.position.set(x + (random() - .5) * .9, y + height + random() * .4, z + (random() - .5) * .8);
      dummy.scale.set(.5 + random() * .45, .5 + random() * .5, .5 + random() * .4); dummy.updateMatrix(); leaves.setMatrixAt(i * 3 + crown, dummy.matrix);
      leaves.setColorAt(i * 3 + crown, new THREE.Color().setHSL(.37, .22 + random() * .15, .13 + random() * .09));
    }
  }
  // Sparse foreground reed silhouettes give the opening shot a near plane.
  for (let i = 0; i < (compact ? 12 : 28); i++) {
    const z = 22 + random() * 14, x = riverX(z) + riverWidth(z) + 1 + random() * 3;
    const blade = mesh(new THREE.PlaneGeometry(.05, .8 + random() * 1.2), mat('#4d694a', { side: THREE.DoubleSide }), [x, groundY(x, z) + .55, z]); blade.rotation.z = (random() - .5) * .45;
  }
  // A slender wooden riverboat with a curved fabric sail.
  const boat = new THREE.Group(); root.add(boat);
  const hull = mesh(new THREE.SphereGeometry(1, 18, 8), mat('#654833'), [0, .04, 0], boat); hull.scale.set(.43, .17, 1.8);
  box([.57, .045, 2.3], mat('#a27b53'), [0, .15, 0], boat);
  box([.035, 2.4, .035], brass, [0, 1.3, -.2], boat);
  const sailGeo = new THREE.PlaneGeometry(1.35, 1.95, 10, 10);
  const sailPoints = sailGeo.attributes.position;
  for (let i = 0; i < sailPoints.count; i++) { const x = sailPoints.getX(i), y = sailPoints.getY(i); sailPoints.setZ(i, Math.sin((x + .675) / 1.35 * Math.PI) * .3); sailPoints.setX(i, x * (.65 + (y + .975) * .18)); }
  sailGeo.computeVertexNormals(); const sail = mesh(sailGeo, mat('#d5c8a2', { side: THREE.DoubleSide }), [.55, 1.45, -.2], boat); sail.rotation.y = -.45;
  const sun = mesh(new THREE.SphereGeometry(4.5, 32, 16), new THREE.MeshBasicMaterial({ color: '#b8564b', fog: false, toneMapped: false }), [12, 19, -105]); materials.add(sun.material); sun.castShadow = false;
  const paths = [];
  for (let i = 0; i < 3; i++) {
    const a = locations[i], b = locations[(i + 1) % 3];
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(a.x, 2.9, a.z), new THREE.Vector3((a.x + b.x) / 2, 4.8, (a.z + b.z) / 2), new THREE.Vector3(b.x, 2.9, b.z)]);
    const geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(90)); geometries.add(geometry); geometry.setDrawRange(0, 0);
    const material = new THREE.LineBasicMaterial({ color: '#d8be83', transparent: true, opacity: .85 }); materials.add(material);
    const line = new THREE.Line(geometry, material); root.add(line); paths.push(line);
  }
  return {
    locations: locations.map(site => new THREE.Vector3(site.x, groundY(site.x, site.z) + 3, site.z)),
    update(progress, time) {
      waterMat.uniforms.time.value = time;
      const z = 9 - smooth(.05, .66, progress) * 45;
      boat.position.set(riverX(z) + .7, .15 + Math.sin(time * .6) * .025, z);
      boat.rotation.y = Math.atan2(riverX(z - .1) - riverX(z + .1), -.2);
      highlights.forEach((m, i) => { m.emissiveIntensity = smooth(.54 + i * .065, .64 + i * .065, progress) * .45; });
      paths.forEach((line, i) => line.geometry.setDrawRange(0, Math.floor(smooth(.55 + i * .055, .77 + i * .055, progress) * 91)));
    },
    dispose() { leaves.dispose(); trunks.dispose(); geometries.forEach(geo => geo.dispose()); materials.forEach(material => material.dispose()); root.removeFromParent(); }
  };
}
