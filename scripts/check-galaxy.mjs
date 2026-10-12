import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import * as THREE from '../vendor/three.module.min.js';
import { buildParticleField, buildShapeSamples, shapeCoordinates, particlePosition, createPositionScratch, introState, introLetterProgress } from '../galaxy.js';

// Source contracts: 019ulkdkl8r2h.js nucleus generator and path-shape shader.
const sourceCore = [
  [0, [-.023165863007307053, .06619920581579208, .03125840052962303], 2.9816980361938477, 3.78786301612854],
  [17, [-.3549082279205322, -.1199064627289772, .07784385979175568], 1.2174097299575806, 1.5357993841171265],
  [47, [-.20732338726520538, .04342484846711159, .0012549113016575575], 1.9009636640548706, 3.129037618637085],
  [95, [.0034939164761453867, .053224485367536545, -.042943745851516724], 2.9041905403137207, 3.5519583225250244]
];
const near = (a, b, note) => assert(Math.abs(a - b) < 2e-6, `${note}: ${a} versus ${b}`);
const vectorNear = (a, b, note) => a.forEach((value, i) => near(value, b[i], `${note}[${i}]`));
const fract = p => p - Math.floor(p);
const density = p => p + .22 * Math.sin(p * Math.PI * 2) / (Math.PI * 2);
const identity = new THREE.Matrix4();
const sideView = new THREE.Matrix4().makeRotationY(Math.PI / 2);
const shapes = buildShapeSamples();
let comparisons = 0, minDepth = Infinity, maxDepth = -Infinity;

for (const [quality, authored, backgroundCount, cores] of [[2, 2048, 274, 48], [4, 4096, 546, 96]]) {
  const { stars, background, armCounts, backCounts, coreCount } = buildParticleField(quality);
  assert.equal(stars.masses.length, authored);
  assert.equal(background.masses.length, backgroundCount);
  assert.equal(coreCount, cores);
  assert.deepEqual(armCounts, quality === 2 ? [440, 340, 440, 340, 440] : [880, 680, 880, 680, 880]);
  assert.deepEqual(backCounts, quality === 2 ? [60, 47, 60, 47, 60] : [120, 93, 120, 93, 120]);
  let offset = 0;
  for (const [arm, count] of armCounts.entries()) {
    let heroes = 0;
    for (let i = offset; i < offset + count; i++) {
      assert.equal(stars.loops[i * 4], arm);
      near(stars.shape[i * 4 + 1], [.62, -.46, .78, -.7, .42][arm] * 1.4, 'original layer depth');
      near(stars.shape[i * 4 + 2], .82 * arm, 'original layer phase');
      heroes += stars.shape[i * 4 + 3];
    }
    assert.equal(heroes, 1);
    offset += count;
  }
  for (const [index, position, scale, brightness] of sourceCore) {
    if (index >= coreCount) continue;
    const i = offset + index;
    vectorNear(Array.from(stars.positions.slice(i * 3, i * 3 + 3)), position, 'source nucleus RNG');
    near(stars.styles[i * 4], scale, 'source nucleus scale');
    near(stars.light[i * 3], brightness, 'source nucleus brightness');
  }
  assert.equal(stars.shape[(offset + 5) * 4 + 3], 1, 'source brightest × largest nucleus hero');
  assert.equal(Array.from(stars.shape).filter((value, i) => i % 4 === 3 && value === 1).length, 6);

  const travel = new Float32Array([.012, .028, .041, .016, .074, .033]);
  const params = {
    weights: [0, 0, 1, 0], time: 3.7, view: [19.2, 10.9], rail: .402,
    galaxyMatrix: identity, galaxyOrigin: [0, -1.09, 0],
    shapeMatrix: sideView, shapeOrigin: [0, .4, 0], shapeSize: [7.2, 7.2], travel, entry: 1
  };
  const scratch = createPositionScratch(), shapeScratch = createPositionScratch().shape;
  const local = new Float64Array(3), wide = new Float64Array(3), output = new Float64Array(3);
  for (const kind of [0, 1]) {
    params.weights = kind ? [0, 0, 0, 1] : [0, 0, 1, 0];
    for (let i = 0; i < authored; i += 31) {
      const k = i * 4, seed = stars.shape[k], entry = (kind * 1024 + Math.min(Math.floor(Math.min(seed, .999999) * 1024), 1023)) * 4;
      const start = shapes[entry + 2], end = shapes[entry + 3], span = Math.max(end - start, 1 / 1024);
      const localSeed = Math.max(0, Math.min(1, (seed - start) / span));
      const p = density(fract(localSeed + travel[stars.loops[k]] / span));
      near(shapeCoordinates(stars, i, kind, travel, [7.2, 7.2], local, shapeScratch), p, 'source contour phase');
      const expectedZ = Math.sin(p * Math.PI * 1.35 + stars.shape[k + 2]) * stars.shape[k + 1] * Math.sin(p * Math.PI)
        + stars.loops[k + 3] * .75 + (stars.seeds[k + 2] - .5) * .22;
      near(local[2], expectedZ, 'source world depth');
      shapeCoordinates(stars, i, kind, travel, [2, 2], wide, shapeScratch);
      near(wide[2], local[2], 'XY fitting must preserve depth');
      particlePosition(stars, i, params, output, scratch);
      vectorNear(Array.from(output), [local[2], local[1] + .4, -local[0]], '90-degree side view');
      minDepth = Math.min(minDepth, local[2]); maxDepth = Math.max(maxDepth, local[2]); comparisons++;
    }
  }
  for (let i = 0; i < authored; i += 127) {
    const positions = [];
    for (const weights of [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 0, 1]]) {
      params.weights = weights; particlePosition(stars, i, params, output, scratch); positions.push(Array.from(output));
    }
    params.weights = [.2, .3, 0, .5]; particlePosition(stars, i, params, output, scratch);
    vectorNear(Array.from(output), [0, 1, 2].map(axis => positions[0][axis] * .2 + positions[1][axis] * .3 + positions[2][axis] * .5), 'mixed world coordinates');
    params.weights = [0, 1, 0, 0]; params.shapeMatrix = identity;
    particlePosition(stars, i, params, output, scratch); const cloud = Array.from(output);
    params.shapeMatrix = sideView; params.galaxyMatrix = sideView;
    particlePosition(stars, i, params, output, scratch); vectorNear(Array.from(output), cloud, 'cloud is independent of shape rotation');
    params.galaxyMatrix = identity;
  }
  const rx = .08 * Math.sin(.22 * params.time), ry = .14 * Math.cos(.28 * params.time), rz = .7;
  params.coreMatrix = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(rx, ry, rz, 'XYZ'));
  params.galaxyMatrix = sideView; params.weights = [1, 0, 0, 0];
  const [cx, cy, cz] = sourceCore[0][1];
  const zx = cx * Math.cos(rz) - cy * Math.sin(rz), zy = cx * Math.sin(rz) + cy * Math.cos(rz);
  const yx = zx * Math.cos(ry) + cz * Math.sin(ry), yz = -zx * Math.sin(ry) + cz * Math.cos(ry);
  const xy = zy * Math.cos(rx) - yz * Math.sin(rx), xz = zy * Math.sin(rx) + yz * Math.cos(rx);
  particlePosition(stars, offset, params, output, scratch);
  vectorNear(Array.from(output), [xz, xy - 1.09, -yx], 'source nucleus XYZ rotation then galaxy rotation');
  const camera = new THREE.OrthographicCamera(-9.6, 9.6, 5.45, -5.45, .1, 100);
  camera.position.z = 12; camera.updateMatrixWorld();
  const projected = new THREE.Vector3(...output).project(camera);
  near(projected.x, xz / 9.6, 'rotated nucleus horizontal hover projection');
  near(projected.y, (xy - 1.09) / 5.45, 'rotated nucleus vertical hover projection');
}
assert(minDepth < -.8 && maxDepth > .8, 'side view needs the authored world-depth span');

// Read the shipped names so changing a word also changes the verified timeline.
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const orders = [...html.matchAll(/data-intro-letter="(\d+)"/g)].map(match => Number(match[1]));
assert.deepEqual(orders, [7, 6, 5, 4, 3, 2, 1, 0, 0, 1, 2, 3]);
assert(html.includes('aria-label="SherlockMen 的个人主页"'));
for (const removed of ['pause-motion', 'reset-galaxy', 'galaxy-hint', 'galaxy-controls', 'scroll-cue', 'SCROLL TO DISCOVER']) {
  assert(!html.includes(removed) && !app.includes(removed), `deleted control still referenced: ${removed}`);
}
assert(!css.includes('galaxy-controls') && !css.includes('scroll-cue'));
assert(!css.includes(String.fromCharCode(92) + 'n'), 'CSS contains a literal newline escape');
assert(css.includes('.pause-button{'), 'the project dialog pause button must retain its styling');
const maxOrder = Math.max(...orders), timing = introState(0, maxOrder);
const bootstrap = html.match(/<script>([\s\S]*?)<\/script>/)[1];
for (const reduced of [false, true]) {
  const root = { dataset: {} }, title = { dataset: {}, getAnimations: () => [{ cancel: () => { title.cancelled = true; } }] };
  let onError;
  runInNewContext(bootstrap, { matchMedia: () => ({ matches: reduced }), document: { documentElement: root, getElementById: () => title }, addEventListener: (type, handler) => { if (type === 'error') onError = handler; } });
  assert.equal(root.dataset.heroIntro === 'pending', !reduced, 'only normal-motion first paint hides the title');
  onError({ filename: 'https://example.com/portfolio/galaxy.js', target: {} });
  assert.equal(root.dataset.heroIntro, 'complete', 'a module SyntaxError must restore the full name');
  assert.equal(root.dataset.heroIntroFailed, 'true');
  assert.equal(title.cancelled, true, 'failed execution must remove existing character opacity animations');
}
near(timing.titleEnd, 2.55, 'complete title threshold');
near(timing.gatherStart, 2.65, 'particle gather threshold');
near(timing.end, 8.15, 'complete assembly threshold');
assert.equal(introLetterProgress(.84, 0), 0);
assert(introLetterProgress(.86, 0) > 0);
assert(orders.every(order => introLetterProgress(timing.titleEnd, order) > 1 - 1e-9));
assert.equal(introState(2.60, maxOrder).phase, 'hold');
assert.equal(introState(2.65, maxOrder).assembly, 0);
near(introState(5.40, maxOrder).assembly, .5, 'assembly midpoint');
assert.equal(introState(8.15, maxOrder).phase, 'complete');
let previousAssembly = 0;
for (let n = 0; n <= 170; n++) {
  const timeline = introState(n * .05, maxOrder);
  assert(timeline.titleComplete || timeline.assembly === 0, 'gathering began before the name completed');
  assert(timeline.assembly >= previousAssembly && timeline.assembly <= 1, 'assembly must be monotonic');
  previousAssembly = timeline.assembly;
}
console.log(JSON.stringify({ status: 'passed', sourceCounts: '2048+274 / 4096+546', sourceCoreFixtures: sourceCore.length, depthAndSideViewComparisons: comparisons, minDepth, maxDepth, intro: { letters: orders.length, titleEnd: timing.titleEnd, gatherStart: timing.gatherStart, end: timing.end } }));
