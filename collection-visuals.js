import * as THREE from './vendor/three.module.min.js';

// Each small sculpture has a transparent canvas. A single clock owns all three,
// and stops completely when the controls, visibility, or motion preference say so.
const hosts = [...document.querySelectorAll('[data-collection-visual]')];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = matchMedia('(pointer: fine)');
const sculptures = [];
let paused = false;
let frame = 0;
let lastTime = 0;

const palette = { blue: 0x8dbbd9, silver: 0xc2e0f1, navy: 0x183b56, warm: 0xd1a777 };

function makeMaterials() {
  return {
    metal: new THREE.MeshPhysicalMaterial({ color: palette.blue, metalness: .94, roughness: .21, clearcoat: 1, clearcoatRoughness: .12, envMapIntensity: 1.6 }),
    silver: new THREE.MeshPhysicalMaterial({ color: palette.silver, metalness: .91, roughness: .16, clearcoat: 1, envMapIntensity: 1.7 }),
    dark: new THREE.MeshPhysicalMaterial({ color: palette.navy, metalness: .76, roughness: .25, clearcoat: 1, envMapIntensity: 1.5 }),
    glass: new THREE.MeshPhysicalMaterial({ color: 0x77bcdf, metalness: .1, roughness: .09, transmission: .72, thickness: .25, ior: 1.45, clearcoat: 1, envMapIntensity: 1.8 }),
    warm: new THREE.MeshPhysicalMaterial({ color: palette.warm, metalness: .82, roughness: .22, clearcoat: 1, envMapIntensity: 1.45 }),
    glow: new THREE.MeshStandardMaterial({ color: 0xafddf6, emissive: 0x559cc6, emissiveIntensity: .5, metalness: .35, roughness: .23 }),
  };
}

function mesh(geometry, material, parent, position = [0, 0, 0]) {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(...position);
  parent.add(object);
  return object;
}

function ring(parent, material, radius, thickness, rotation = [0, 0, 0]) {
  const object = mesh(new THREE.TorusGeometry(radius, thickness, 12, 80), material, parent);
  object.rotation.set(...rotation);
  return object;
}

function roundedPrism(width, height, depth, radius = .1) {
  const shape = new THREE.Shape();
  const x = -width / 2, y = -height / 2;
  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + radius);
  shape.lineTo(x + width, y + height - radius);
  shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  shape.lineTo(x + radius, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, steps: 1, bevelEnabled: true, bevelSegments: 3, bevelSize: .025, bevelThickness: .025, curveSegments: 8 });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

function createAgents(root, materials) {
  const gyroscope = new THREE.Group();
  root.add(gyroscope);
  const outer = ring(gyroscope, materials.silver, 1.04, .095, [.52, .45, -.22]);
  const inner = ring(gyroscope, materials.metal, .82, .09, [1.12, -.22, .35]);
  const orbit = ring(gyroscope, materials.warm, .97, .027, [-.48, .93, .18]);
  const core = mesh(new THREE.IcosahedronGeometry(.46, 0), materials.metal, gyroscope);
  const shell = mesh(new THREE.OctahedronGeometry(.59, 0), materials.glass, gyroscope);
  shell.rotation.set(.35, .38, .12);
  const beads = new THREE.Group();
  orbit.add(beads);
  for (let i = 0; i < 3; i++) {
    const angle = i * Math.PI * 2 / 3;
    mesh(new THREE.SphereGeometry(.068, 16, 12), materials.glow, beads, [Math.cos(angle) * .97, Math.sin(angle) * .97, 0]);
  }
  root.rotation.set(.08, -.28, -.04);
  return time => {
    gyroscope.rotation.y = time * .17;
    outer.rotation.z = -.22 + time * .1;
    inner.rotation.y = -.22 - time * .12;
    beads.rotation.z = time * .45;
    core.rotation.set(time * .16, time * .25, .2);
  };
}

function createService(root, materials) {
  const headset = new THREE.Group();
  root.add(headset);
  const band = mesh(new THREE.TorusGeometry(.82, .135, 16, 64, Math.PI), materials.silver, headset, [0, .1, 0]);
  band.scale.x = 1.05;
  const inset = mesh(new THREE.TorusGeometry(.82, .036, 10, 64, Math.PI), materials.dark, headset, [0, .095, .12]);
  inset.scale.x = 1.05;
  for (const direction of [-1, 1]) {
    const cup = mesh(roundedPrism(.34, .66, .32, .15), materials.metal, headset, [direction * .86, -.15, 0]);
    cup.rotation.z = direction * -.14;
    const pad = mesh(roundedPrism(.26, .48, .065, .11), materials.dark, cup, [0, 0, .195]);
    mesh(new THREE.SphereGeometry(.046, 12, 8), materials.warm, pad, [0, -.12, .045]);
  }
  const waveform = new THREE.Group();
  headset.add(waveform);
  const bars = [];
  for (let i = 0; i < 5; i++) {
    const height = [.2, .42, .6, .42, .2][i];
    const bar = mesh(new THREE.CapsuleGeometry(.036, height, 4, 10), i === 2 ? materials.warm : materials.glow, waveform, [(i - 2) * .15, -.13, .2]);
    bars.push(bar);
  }
  const boom = new THREE.CatmullRomCurve3([new THREE.Vector3(.93, -.4, .09), new THREE.Vector3(.8, -.64, .25), new THREE.Vector3(.37, -.68, .4), new THREE.Vector3(.2, -.59, .43)]);
  mesh(new THREE.TubeGeometry(boom, 24, .035, 10, false), materials.silver, headset);
  const microphone = mesh(new THREE.SphereGeometry(.095, 16, 12), materials.warm, headset, [.2, -.59, .43]);
  microphone.scale.set(1.45, .8, .8);
  root.rotation.set(.07, -.35, -.13);
  root.position.y = -.035;
  return time => {
    headset.rotation.y = Math.sin(time * .36) * .35;
    headset.rotation.z = Math.sin(time * .29) * .055;
    bars.forEach((bar, i) => { bar.scale.y = .8 + Math.sin(time * 1.8 + i * .68) * .22; });
  };
}

function createPlatform(root, materials) {
  const stack = new THREE.Group();
  root.add(stack);
  const levels = [];
  for (let i = 0; i < 3; i++) {
    const level = new THREE.Group();
    level.position.y = -.6 + i * .44;
    stack.add(level);
    const slab = mesh(roundedPrism(1.5, 1.08, .15, .12), i === 2 ? materials.silver : materials.metal, level);
    slab.rotation.x = -Math.PI / 2;
    const inset = mesh(roundedPrism(1.25, .86, .018, .09), materials.dark, level, [0, .1, 0]);
    inset.rotation.x = -Math.PI / 2;
    for (let j = 0; j < 3; j++) {
      const light = mesh(new THREE.SphereGeometry(.026, 10, 8), j === 0 ? materials.warm : materials.glow, level, [-.5 + j * .115, -.002, .558]);
      light.scale.z = .4;
    }
    levels.push(level);
  }
  const crystal = mesh(new THREE.OctahedronGeometry(.34, 0), materials.glass, stack, [0, .92, 0]);
  crystal.rotation.z = .08;
  mesh(new THREE.OctahedronGeometry(.16, 0), materials.warm, crystal);
  mesh(new THREE.CylinderGeometry(.035, .035, 1.48, 12), materials.glow, stack, [0, .19, 0]);
  root.rotation.set(.2, -.52, -.08);
  root.position.y = -.05;
  return time => {
    stack.rotation.y = time * .14;
    levels.forEach((level, i) => { level.rotation.y = Math.sin(time * .35 + i * .6) * .07; });
    crystal.rotation.y = time * .45;
  };
}

// A local studio environment supplies broad reflections, rather than flat
// point-light shading. No images, remote textures, or CDN dependencies are used.
function studioEnvironment(renderer) {
  const studio = new THREE.Scene();
  const room = mesh(new THREE.BoxGeometry(14, 14, 14), new THREE.MeshBasicMaterial({ color: 0x07121e, side: THREE.BackSide }), studio);
  const panels = [
    { color: 0xc8e8ff, power: 4.5, position: [-3, 4, 4], size: [3, 7] },
    { color: 0x5ca4db, power: 2.3, position: [4, 1, -2], size: [2, 6] },
    { color: 0xf0c899, power: 1.9, position: [-4, -1, -3], size: [1.5, 3] },
    { color: 0xf2faff, power: 2.8, position: [0, 5, -1], size: [4, 2] },
  ];
  for (const panel of panels) {
    const surface = mesh(new THREE.PlaneGeometry(...panel.size), new THREE.MeshBasicMaterial({ color: new THREE.Color(panel.color).multiplyScalar(panel.power), side: THREE.DoubleSide }), studio, panel.position);
    surface.lookAt(0, 0, 0);
  }
  const generator = new THREE.PMREMGenerator(renderer);
  const environment = generator.fromScene(studio, .03, .1, 30);
  generator.dispose();
  studio.traverse(object => { object.geometry?.dispose(); object.material?.dispose(); });
  room.removeFromParent();
  return environment;
}

function addStars(scene, seed) {
  const positions = new Float32Array(42 * 3);
  let value = seed;
  const random = () => { value = (value * 16807) % 2147483647; return value / 2147483647; };
  for (let i = 0; i < 42; i++) {
    positions[i * 3] = (random() - .5) * 5.5;
    positions[i * 3 + 1] = (random() - .5) * 3.3;
    positions[i * 3 + 2] = -2 - random() * 1.5;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  scene.add(new THREE.Points(geometry, new THREE.PointsMaterial({ color: 0x9cc6df, size: .022, transparent: true, opacity: .6, depthWrite: false })));
}

function canAnimate(item) {
  return !paused && !reducedMotion.matches && !document.hidden && item.visible && !item.lost;
}

function render(item) {
  if (item.lost || document.hidden || !item.visible) return;
  item.renderer.render(item.scene, item.camera);
}

function syncLoop() {
  const active = sculptures.some(canAnimate);
  if (active && !frame) {
    lastTime = 0;
    frame = requestAnimationFrame(tick);
  } else if (!active && frame) {
    cancelAnimationFrame(frame);
    frame = 0;
  }
  for (const item of sculptures) item.host.dataset.visualMotion = canAnimate(item) ? 'running' : 'paused';
}

function tick(now) {
  frame = 0;
  if (!sculptures.some(canAnimate)) return;
  // Cap at 30 frames/sec and cap elapsed time after pauses to avoid rotation jumps.
  if (lastTime && now - lastTime < 31) { frame = requestAnimationFrame(tick); return; }
  const delta = lastTime ? Math.min((now - lastTime) / 1000, .055) : 0;
  lastTime = now;
  for (const item of sculptures) {
    if (!canAnimate(item)) continue;
    item.time += delta;
    item.update(item.time);
    const blend = 1 - Math.exp(-delta * 7);
    item.pointer.x += (item.target.x - item.pointer.x) * blend;
    item.pointer.y += (item.target.y - item.pointer.y) * blend;
    item.tilt.rotation.y = item.pointer.x * .42;
    item.tilt.rotation.x = -item.pointer.y * .22;
    const desired = item.hovered ? 1.08 : 1;
    item.scale += (desired - item.scale) * blend;
    item.tilt.scale.setScalar(item.scale);
    render(item);
  }
  frame = requestAnimationFrame(tick);
}

function createSculpture(host, index) {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  renderer.domElement.className = 'collection-sculpture-canvas';
  host.prepend(renderer.domElement);
  const scene = new THREE.Scene();
  const environment = studioEnvironment(renderer);
  scene.environment = environment.texture;
  scene.add(new THREE.HemisphereLight(0xccecff, 0x0d1b2c, 1.6));
  const key = new THREE.DirectionalLight(0xdaefff, 4);
  key.position.set(-3, 4, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x75bcf1, 3);
  rim.position.set(3, 1, -3);
  scene.add(rim);
  const warmth = new THREE.DirectionalLight(0xecc497, 1.4);
  warmth.position.set(-3, -1, 1);
  scene.add(warmth);
  const camera = new THREE.PerspectiveCamera(36, 1, .1, 40);
  camera.position.set(0, .12, 5.1);
  camera.lookAt(0, .05, 0);
  const tilt = new THREE.Group();
  scene.add(tilt);
  const root = new THREE.Group();
  root.scale.setScalar(1.12);
  tilt.add(root);
  const materials = makeMaterials();
  const creators = { agents: createAgents, service: createService, platform: createPlatform };
  const update = (creators[host.dataset.collectionVisual] || createAgents)(root, materials);
  addStars(scene, 7253 + index * 4927);
  const item = { host, renderer, scene, camera, environment, tilt, update, visible: true, lost: false, time: 0, pointer: { x: 0, y: 0 }, target: { x: 0, y: 0 }, scale: 1, hovered: false };
  const resize = () => {
    const { width, height } = host.getBoundingClientRect();
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    // Narrow three-column slots still show the complete, substantial sculpture.
    camera.position.z = 5.1 * Math.max(1, 1 / camera.aspect);
    camera.updateProjectionMatrix();
    render(item);
  };
  new ResizeObserver(resize).observe(host);
  update(0);
  resize();
  host.classList.add('is-sculpture-ready');
  const button = host.closest('button') || host;
  button.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse' && finePointer.matches) item.hovered = true; });
  button.addEventListener('pointermove', event => {
    if (!canAnimate(item) || !finePointer.matches || event.pointerType !== 'mouse') return;
    const rect = host.getBoundingClientRect();
    item.target.x = THREE.MathUtils.clamp((event.clientX - rect.left) / rect.width * 2 - 1, -1, 1);
    item.target.y = THREE.MathUtils.clamp((event.clientY - rect.top) / rect.height * 2 - 1, -1, 1);
  });
  button.addEventListener('pointerleave', () => { item.hovered = false; item.target.x = 0; item.target.y = 0; });
  // Keyboard feedback is immediate and static, without causing a new animation.
  button.addEventListener('focus', () => { if (button.matches(':focus-visible')) { key.intensity = 5; render(item); } });
  button.addEventListener('blur', () => { key.intensity = 4; render(item); });
  renderer.domElement.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    item.lost = true;
    host.classList.remove('is-sculpture-ready');
    syncLoop();
  });
  renderer.domElement.addEventListener('webglcontextrestored', () => {
    item.lost = false;
    resize();
    host.classList.add('is-sculpture-ready');
    syncLoop();
  });
  return item;
}

for (const [index, host] of hosts.entries()) {
  try { sculptures.push(createSculpture(host, index)); }
  catch (error) {
    host.classList.remove('is-sculpture-ready');
    host.querySelector('canvas')?.remove();
    host.dataset.visualMotion = 'unavailable';
    console.warn('Collection sculpture uses its static fallback.', error);
  }
}

const observer = new IntersectionObserver(entries => {
  for (const entry of entries) {
    const item = sculptures.find(candidate => candidate.host === entry.target);
    if (!item) continue;
    item.visible = entry.isIntersecting;
    if (item.visible) render(item);
  }
  syncLoop();
}, { threshold: .05 });
sculptures.forEach(item => observer.observe(item.host));
document.addEventListener('visibilitychange', syncLoop);
reducedMotion.addEventListener('change', () => {
  if (reducedMotion.matches) {
    for (const item of sculptures) {
      item.target.x = item.target.y = item.pointer.x = item.pointer.y = 0;
      item.tilt.rotation.set(0, 0, 0);
      item.tilt.scale.setScalar(1);
      item.scale = 1;
      render(item);
    }
  }
  syncLoop();
});

window.SherlockCollections = {
  setPaused(value) { paused = Boolean(value); syncLoop(); },
  get paused() { return paused; },
};
window.dispatchEvent(new CustomEvent('collections-ready', { detail: { count: sculptures.length } }));
syncLoop();
