import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
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
        const color = new THREE.Color().setHSL(.38 + Math.sin(z * .07) * .025, .26, .115 + Math.sin(x * .17 + z * .1) * .022);
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
  // Narrow alluvial shelves connect water to planted ground. Their width follows
  // each bend, so they read as deposited silt rather than an outlined canal.
  const silt = mat('#8b8564', { roughness: 1, side: THREE.DoubleSide });
  for (const side of [-1, 1]) {
    const points = [], indices = [];
    for (let row = 0; row <= segmentCount; row++) {
      const z = 70 - row / segmentCount * 220;
      const bank = riverX(z) + side * riverWidth(z);
      const shelf = .22 + .65 * (.5 + .5 * Math.sin(z * .13 + side * 1.4));
      points.push(bank, .155, z, bank + side * shelf, groundY(bank + side * shelf, z) + .018, z);
      if (row < segmentCount) { const n = row * 2; indices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2); }
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3)); geometry.setIndex(indices); geometry.computeVertexNormals();
    mesh(geometry, silt);
  }
  // Fine water-current lines describe the river direction without a glowing outline.
  for (let line = 0; line < 5; line++) {
    const pts = [];
    for (let n = 0; n <= 150; n++) { const z = 38 - n * .8; pts.push(new THREE.Vector3(riverX(z) + (line - 2) * .53 + Math.sin(z * .4 + line) * .05, .135, z)); }
    const g = new THREE.BufferGeometry().setFromPoints(pts); geometries.add(g);
    const m = new THREE.LineBasicMaterial({ color: '#88baa0', transparent: true, opacity: .12 }); materials.add(m); root.add(new THREE.Line(g, m));
  }
  // Low paddy plots and narrow earthen bunds follow the floodplain surface.
  const bund = mat('#7b7952');
  const fieldMaterials = [mat('#65734b'), mat('#476348')];
  for (let field = 0; field < 14; field++) {
    const z = 16 - Math.floor(field / 2) * 10, x = riverX(z) - 11 - (field % 2) * 11;
    const width = 8.5, depth = 7.5;
    const geo = new THREE.PlaneGeometry(width, depth, 8, 8); geo.rotateX(-Math.PI / 2);
    const points = geo.attributes.position;
    for (let i = 0; i < points.count; i++) points.setY(i, groundY(points.getX(i) + x, points.getZ(i) + z) + .035);
    geo.computeVertexNormals(); mesh(geo, fieldMaterials[field % 3 ? 1 : 0], [x, 0, z]);
    const bundPoints = Array.from({ length: 13 }, (_, i) => {
      const px = x - width / 2 + i / 12 * width, pz = z + depth / 2;
      return new THREE.Vector3(px, groundY(px, pz) + .045, pz);
    });
    mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(bundPoints), 12, .055, 4, false), bund);
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
  // A quiet landing on the east bank: a bamboo jetty, mooring posts and
  // a path connecting river traffic to the existing courtyard architecture.
  const bamboo = mat('#9a865b'), timber = mat('#806345');
  const landingZ = -9, landingX = riverX(landingZ) + riverWidth(landingZ);
  for (let plank = 0; plank < 11; plank++) box([.19, .065, 1.45], timber, [landingX - .6 + plank * .22, .34, landingZ]);
  for (const x of [landingX - .55, landingX + 1.5]) for (const z of [landingZ - .68, landingZ + .68]) {
    mesh(new THREE.CylinderGeometry(.045, .065, 1.05, 6), bamboo, [x, .3, z]);
  }
  const pathPoints = Array.from({length: 20}, (_, i) => {
    const t = i / 19, x = landingX + 1.5 + t * (9 - landingX - 1.5), z = landingZ - t * 1.7;
    return new THREE.Vector3(x, groundY(x, z) + .025, z);
  });
  mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pathPoints), 20, .16, 5, false), silt);
  // Small pitched-roof homesteads sit beyond the civic pavilions. Roof slopes,
  // raised plinths and shaded verandas are geometry, with no downloaded assets.
  const roofGeo = new THREE.BufferGeometry();
  roofGeo.setAttribute('position', new THREE.Float32BufferAttribute([-1.2,0,-1, 0,.65,-1, -1.2,0,1, 0,.65,-1, 0,.65,1, -1.2,0,1, 0,.65,-1, 1.2,0,-1, 0,.65,1, 1.2,0,-1, 1.2,0,1, 0,.65,1], 3));
  roofGeo.computeVertexNormals();
  const hutRoof = mat('#69766c', { side: THREE.DoubleSide, roughness: .72 });
  for (const [x,z,turn] of [[17,-32,.18],[20,-35,-.35],[17,-52,.1],[-24,-16,.5]]) {
    const home = new THREE.Group(); home.position.set(x, groundY(x,z), z); home.rotation.y = turn; root.add(home);
    box([2.5,.16,2.3], silt, [0,.08,0], home);
    box([1.9,1.2,1.5], clay, [0,.76,0], home);
    mesh(roofGeo,hutRoof,[0,1.4,0],home);
    box([.4,.83,.035],shadow,[0,.62,.765],home);
    for(const side of [-1,1]) {
      box([.055,1.3,.055],bamboo,[side*.92,.72,.95],home);
      box([.3,.36,.025],shadow,[side*.63,.95,.765],home);
    }
  }
  // Seeded variation keeps screenshots/reverse playback reproducible.
  let seed = 31;
  const random = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  const count = compact ? 55 : 105;
  const leafGeo = new THREE.SphereGeometry(1, compact ? 7 : 10, compact ? 5 : 7), trunkGeo = new THREE.CylinderGeometry(.035, .075, 1, 5);
  geometries.add(leafGeo); geometries.add(trunkGeo);
  const foliage = new THREE.MeshLambertMaterial({ color: '#86a58a' }); materials.add(foliage);
  const leaves = new THREE.InstancedMesh(leafGeo, foliage, count * 3), trunks = new THREE.InstancedMesh(trunkGeo, mat('#5b5940'), count);
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
  const reedMaterial = mat('#4d694a', { side: THREE.DoubleSide });
  for (let i = 0; i < (compact ? 12 : 28); i++) {
    const z = 22 + random() * 14, x = riverX(z) + riverWidth(z) + 1 + random() * 3;
    const blade = mesh(new THREE.PlaneGeometry(.05, .8 + random() * 1.2), reedMaterial, [x, groundY(x, z) + .55, z]); blade.rotation.z = (random() - .5) * .45;
  }
  // A few fan-shaped palms break up the rounded grove silhouettes.
  const palmLeaf = mat('#506a44', { side: THREE.DoubleSide });
  for (const [x,z] of [[16,-8],[18,-33],[-18,-20],[19,-52]]) {
    const y = groundY(x,z);
    mesh(new THREE.CylinderGeometry(.08,.15,3.7,7),timber,[x,y+1.85,z]);
    for(let leaf=0;leaf<7;leaf++) {
      const a=leaf/7*Math.PI*2;
      const fan=new THREE.BufferGeometry();
      fan.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0, Math.cos(a-.38)*1.65,.2,Math.sin(a-.38)*1.65, Math.cos(a)*1.9,-.25,Math.sin(a)*1.9, 0,0,0, Math.cos(a)*1.9,-.25,Math.sin(a)*1.9, Math.cos(a+.38)*1.65,.2,Math.sin(a+.38)*1.65],3)); fan.computeVertexNormals();
      mesh(fan,palmLeaf,[x,y+3.7,z]);
    }
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
  for(let rib=0;rib<7;rib++) box([.5,.025,.04],timber,[0,.185,-.9+rib*.3],boat);
  const wakeMaterial = new THREE.LineBasicMaterial({ color:'#b9c9b1', transparent:true, opacity:.22 }); materials.add(wakeMaterial);
  for(const side of [-1,1]) {
    const points=Array.from({length:20},(_,i)=>new THREE.Vector3(side*(.28+i*.018),.01,1.3+i*.1));
    const geometry=new THREE.BufferGeometry().setFromPoints(points);geometries.add(geometry);boat.add(new THREE.Line(geometry,wakeMaterial));
  }
  const sun = mesh(new THREE.SphereGeometry(4.5, 32, 16), new THREE.MeshBasicMaterial({ color: '#b8564b', fog: false, toneMapped: false }), [12, 19, -105]); materials.add(sun.material); sun.castShadow = false;
  const paths = [];
  for (let i = 0; i < 3; i++) {
    const a = locations[i], b = locations[(i + 1) % 3];
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(a.x, 2.9, a.z), new THREE.Vector3((a.x + b.x) / 2, 4.8, (a.z + b.z) / 2), new THREE.Vector3(b.x, 2.9, b.z)]);
    const geometry = new THREE.BufferGeometry().setFromPoints(curve.getPoints(90)); geometries.add(geometry); geometry.setDrawRange(0, 0);
    const material = new THREE.LineBasicMaterial({ color: '#d8be83', transparent: true, opacity: .85 }); materials.add(material);
    const line = new THREE.Line(geometry, material); root.add(line); paths.push(line);
  }
  // Merge static opaque geometry by material. Added craftsmanship should not
  // multiply per-frame draw calls. The boat, water and service paths stay live.
  root.updateMatrixWorld(true);
  const batches = new Map();
  root.traverse(item => {
    if (!item.isMesh || item.isInstancedMesh || !item.material.isMeshStandardMaterial) return;
    for(let parent=item;parent;parent=parent.parent) if(parent===boat) return;
    const transformed=item.geometry.clone().applyMatrix4(item.matrixWorld);
    // Normalize attributes so mixed primitive geometries can share one batch.
    if(transformed.getAttribute('uv')) transformed.deleteAttribute('uv');
    const key=item.material;
    if(!batches.has(key)) batches.set(key,[]);
    batches.get(key).push({item,geometry:transformed});
  });
  batches.forEach((entries,material)=>{
    if(entries.length<2) { entries.forEach(({geometry})=>geometry.dispose()); return; }
    const flattened=entries.map(({geometry})=>geometry.index ? geometry.toNonIndexed() : geometry);
    const merged=mergeGeometries(flattened);
    if(merged) { mesh(merged,material); entries.forEach(({item})=>item.removeFromParent()); }
    flattened.forEach(geometry=>geometry.dispose()); entries.forEach(({geometry})=>geometry.dispose());
  });
  const lineBatches = new Map();
  [...root.children].filter(item=>item.isLine && !paths.includes(item)).forEach(line=>{
    const key = `${line.material.color.getHex()}:${line.material.opacity}`;
    if(!lineBatches.has(key)) lineBatches.set(key,{material:line.material,points:[]});
    const batch=lineBatches.get(key), points=line.geometry.attributes.position;
    for(let i=0;i<points.count-1;i++) for(const j of [i,i+1]) batch.points.push(points.getX(j),points.getY(j),points.getZ(j));
    line.removeFromParent();
  });
  lineBatches.forEach(({material,points})=>{
    const geometry=new THREE.BufferGeometry(); geometry.setAttribute('position',new THREE.Float32BufferAttribute(points,3)); geometries.add(geometry); root.add(new THREE.LineSegments(geometry,material));
  });
  return {
    locations: locations.map(site => new THREE.Vector3(site.x, groundY(site.x, site.z) + 3, site.z)),
    update(progress, time) {
      waterMat.uniforms.time.value = time;
      const z = 9 - smooth(.05, .66, progress) * 45;
      boat.position.set(riverX(z) + .7, .15 + Math.sin(time * .6) * .025, z);
      boat.rotation.y = Math.atan2(riverX(z - .1) - riverX(z + .1), -.2);
      boat.rotation.z = Math.sin(time * .55) * .018;
      sail.rotation.y = -.45 + Math.sin(time * .4) * .025;
      highlights.forEach((m, i) => { m.emissiveIntensity = smooth(.54 + i * .065, .64 + i * .065, progress) * .45; });
      paths.forEach((line, i) => line.geometry.setDrawRange(0, Math.floor(smooth(.55 + i * .055, .77 + i * .055, progress) * 91)));
    },
    dispose() { leaves.dispose(); trunks.dispose(); geometries.forEach(geo => geo.dispose()); materials.forEach(material => material.dispose()); root.removeFromParent(); }
  };
}
