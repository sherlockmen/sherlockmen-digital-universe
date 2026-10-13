import assert from 'node:assert/strict';
import { WORDMARK } from '../wordmark.js';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import * as THREE from '../vendor/three.module.min.js';
import { buildParticleField, buildShapeSamples, shapeCoordinates, particlePosition, createPositionScratch, introState, introLetterProgress, SCULPTURE_KINDS, sculptureState, LOGO_SLOTS, logoSlot, logoRowLayout, logoMotionTime, logoMotionAngles, shapeFlowSpeed, shapeFlowDistance, wordmarkFlowScale, cursorPoint } from '../galaxy.js';
import { LOGO_GEOMETRY, buildLogoFlowData, logoFlowLane, LOGO_FLOW_POINTS, LOGO_FLOW_BANDS, logoContains, logoClearance } from '../particle-logos.js';

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
assert.equal(WORDMARK.text, 'SHERLOCK MEN');
const wordAspect = WORDMARK.width / WORDMARK.height;
let wordArc = 0, wordContours = 0;
for (let from = 0; from < 1024;) {
  const to = Math.round(shapes[from * 4 + 3] * 1024), last = (to - 1) * 4;
  assert(to > from + 2 && to <= 1024, 'every letter contour has a complete sample range');
  vectorNear(Array.from(shapes.slice(from * 4, from * 4 + 2)), Array.from(shapes.slice(last, last + 2)), 'closed letter contour');
  for (let i = from + 1; i < to; i++) wordArc += Math.hypot(shapes[i * 4] - shapes[(i - 1) * 4], (shapes[i * 4 + 1] - shapes[(i - 1) * 4 + 1]) / wordAspect);
  wordContours++;from = to;
}
assert.equal(wordContours, WORDMARK.paths.length);
let cursorArc = 0, cursorPrevious = cursorPoint(0);
for (let i = 1; i <= 8192; i++) {
  const current = cursorPoint(i / 8192);cursorArc += Math.hypot(current[0] - cursorPrevious[0], current[1] - cursorPrevious[1]) / 7.2;cursorPrevious = current;
}
assert(Math.abs(wordArc * wordmarkFlowScale() / cursorArc - 1) < .01, 'letter flow must keep the original cursor world speed');
const { stars: wordStars } = buildParticleField(2), wordScratch = createPositionScratch().shape;
const wordSize = [7.2, 7.2 / wordAspect], wordA = new Float64Array(3), wordB = new Float64Array(3), wordTravel = new Float64Array(6);
for (let from = 0; from < 1024;) {
  const end = shapes[from * 4 + 3], start = from / 1024, span = end - start;
  wordStars.shape[0] = start + span * .5;wordStars.loops[2] = .08;
  const seamGap = epsilon => {
    wordTravel[0] = (.5 - epsilon) * span / wordmarkFlowScale();shapeCoordinates(wordStars, 0, 0, wordTravel, wordSize, wordA, wordScratch);
    wordTravel[0] = (.5 + epsilon) * span / wordmarkFlowScale();shapeCoordinates(wordStars, 0, 0, wordTravel, wordSize, wordB, wordScratch);
    return Math.hypot(wordB[0] - wordA[0], wordB[1] - wordA[1]);
  };
  assert(seamGap(1e-6) <= seamGap(1e-4) * .025 + 1e-7, 'letter contours must flow across their seam without a jump');
  from = Math.round(end * 1024);
}
for (let time = 0; time <= 10; time += .5) for (let i = 17; i < wordStars.masses.length; i += 17) {
  wordTravel.forEach((_, layer) => { wordTravel[layer] = time * shapeFlowSpeed(layer); });shapeCoordinates(wordStars, i, 0, wordTravel, wordSize, wordA, wordScratch);
  wordTravel.forEach((_, layer) => { wordTravel[layer] = (time + .001) * shapeFlowSpeed(layer); });shapeCoordinates(wordStars, i, 0, wordTravel, wordSize, wordB, wordScratch);
  const speed = Math.hypot(wordB[0] - wordA[0], wordB[1] - wordA[1]) / .001;
  assert(speed <= cursorArc * wordSize[0] * shapeFlowSpeed(wordStars.loops[i * 4]) * 1.30, 'letter corners must not accelerate stars beyond the original cursor flow range');
}

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
      const p = density(fract(localSeed + travel[stars.loops[k]] * (kind === 0 ? wordmarkFlowScale() : 1) / span));
      const styleP = kind === 0 ? density(fract(seed + travel[stars.loops[k]])) : p;
      near(shapeCoordinates(stars, i, kind, travel, [7.2, 7.2], local, shapeScratch), p, 'source contour phase');
      const expectedZ = Math.sin(styleP * Math.PI * 1.35 + stars.shape[k + 2]) * stars.shape[k + 1] * Math.sin(styleP * Math.PI)
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
  for (let i = 0; i < authored; i += 127) {
    params.entry = 0;
    particlePosition(stars, i, params, output, scratch);
    const dispersed = Array.from(output), k = i * 4;
    vectorNear(dispersed, [(stars.seeds[k] - .5) * params.view[0] * 1.12, (stars.seeds[k + 1] - .5) * params.view[1] * 1.12, (stars.seeds[k + 2] - .5) * .5], 'letters must retain the dispersed field');
    params.entry = .02;
    particlePosition(stars, i, params, output, scratch);
    assert(Math.hypot(...output.map((value, axis) => value - dispersed[axis])) > 1e-7, 'particle convergence must start without a per-star waiting period');
  }
}
assert(minDepth < -.8 && maxDepth > .8, 'side view needs the authored world-depth span');

// Independently checked empty regions of the official nonzero-fill SVGs.
const logoEmptyPoints = new Map([
  [2, [[8, 14, 1], [16.5, 11.7, .35], [14.46, 11.25, .14], [24, 9, .3]]],
  [3, [[.20, .40, .025], [.20, .58, .025], [.84, .35, .025], [.40, .90, .025]]]
]);
const logoFilledPoints = new Map([[2, [[8, 6], [24, 6]]], [3, [[47, 47], [26, 8]]]]);
const flowData = buildLogoFlowData();
assert.deepEqual(LOGO_SLOTS.map(({ name, kind }) => [name, kind]), [['deepseek', 2], ['gpt', 1], ['claude', 3]]);
assert.equal(flowData.samples.length, 2 * 1024 * 4);
assert.equal(flowData.laneCount, 40);
assert.equal(flowData.lanePoints, LOGO_FLOW_POINTS);
assert.equal(flowData.lanes.length, 40 * LOGO_FLOW_POINTS * 4);
assert.equal(shapes.length, 4 * 1024 * 4);
assert.deepEqual(shapes.slice(2 * 1024 * 4), flowData.samples, 'CPU and GPU must share the same contour atlas');
let logoSampleChecks = 0;
const contourCounts = [];
for (const logo of LOGO_GEOMETRY) {
  const [left, top, width, height] = logo.viewBox, row = (logo.kind - 2) * 1024 * 4, ranges = new Set();
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < 1024; i++) {
    const j = row + i * 4, [x, y, start, end] = flowData.samples.slice(j, j + 4);
    assert([x, y, start, end].every(Number.isFinite), `${logo.name} has a non-finite flow sample`);
    assert(Math.abs(x) <= .500001 && Math.abs(y) <= .500001, `${logo.name} flow escaped its official bounds`);
    assert(start >= 0 && end <= 1 && end > start && i / 1023 >= start - 1e-6 && i / 1023 <= end + 1e-6, 'flow texels must stay in their own contour range');
    assert(logoContains(logo.kind, x, y) && logoClearance(logo.kind, x, y) <= .01, 'the inward guide must stay painted and near the official boundary');
    ranges.add(`${start},${end}`); minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    logoSampleChecks++;
  }
  assert.equal(ranges.size, logo.kind === 2 ? 4 : 1, 'all whale cutouts and Claude rays need their own complete contours');
  contourCounts.push(ranges.size);
  assert(minX < -.4 && maxX > .4 && minY < -.4 && maxY > .4, `${logo.name} samples must cover the complete mark`);
  for (const [x, y] of logoFilledPoints.get(logo.kind)) assert(logoContains(logo.kind, (x - left) / width - .5, .5 - (y - top) / height), `${logo.name} solid body is missing`);
  for (const [a, b] of logoEmptyPoints.get(logo.kind)) {
    const u = logo.kind === 2 ? (a - left) / width : a, v = logo.kind === 2 ? (b - top) / height : b;
    assert.equal(logoContains(logo.kind, u - .5, .5 - v), false, `${logo.name} official cutout was filled`);
  }
}
// These official vertices distinguish the radiating star from a rounded blob.
const claudeTips = [[.399902,46.1553],[26.5067,.200195],[55.1433,1.56148],[78.7203,10.668],[93.6963,40.006],[93.9999,56.4822],[84.1845,77.4648],[69.9675,86.7121],[44.7714,93.8002],[23.8758,86.8999],[12.0873,73.1932],[7.58433,20.5256]];
for (const [x, y] of claudeTips) {
  let distance = Infinity;
  for (let i = 0; i < 1024; i++) { const j = (1024 + i) * 4; distance = Math.min(distance, Math.hypot((flowData.samples[j] + .5) * 94 - x, (.5 - flowData.samples[j + 1]) * 94 - y)); }
  assert(distance < 1.3, 'Claude flow atlas lost a characteristic ray tip');
}

// Apply the GPU texture lookup and world transforms independently of the CPU helper.
const sampleAtlas = (table, kind, progress) => {
  const along = Math.max(0, Math.min(1, progress)) * 1023, a = Math.floor(along), b = Math.min(a + 1, 1023), f = along - a;
  return [0, 1, 2, 3].map(axis => table[(kind * 1024 + a) * 4 + axis] * (1 - f) + table[(kind * 1024 + b) * 4 + axis] * f);
};
const sampleLane = (row, progress) => {
  const offset = row * LOGO_FLOW_POINTS * 4;
  let a = 0, b = LOGO_FLOW_POINTS - 1;
  while (b - a > 1) { const mid = Math.floor((a + b) / 2); if (flowData.lanes[offset + mid * 4 + 2] <= progress) a = mid; else b = mid; }
  const j = offset + a * 4, k = offset + b * 4, fraction = (progress - flowData.lanes[j + 2]) / (flowData.lanes[k + 2] - flowData.lanes[j + 2]);
  return [0, 1].map(axis => flowData.lanes[j + axis] + (flowData.lanes[k + axis] - flowData.lanes[j + axis]) * fraction);
};
let laneArcChecks = 0, referenceArc = 0;
const whaleOutlineDistances = [];
for (let i = 1; i < 1024; i++) { const j = (1024 + i) * 4, k = j - 4; if (shapes[j + 2] === shapes[k + 2]) referenceArc += Math.hypot(shapes[j] - shapes[k], (shapes[j + 1] - shapes[k + 1]) / LOGO_SLOTS[1].aspect); }
near(shapeFlowDistance(), referenceArc, 'source GPT distance governs every lane');
for (const lane of flowData.laneInfo) {
  const aspect = LOGO_SLOTS.find(slot => slot.kind === lane.kind).aspect, offset = lane.row * LOGO_FLOW_POINTS * 4;
  assert(lane.length > 0 && lane.feature > 0 && lane.feature <= 1);
  vectorNear(Array.from(flowData.lanes.slice(offset, offset + 2)), Array.from(flowData.lanes.slice(offset + (LOGO_FLOW_POINTS - 1) * 4, offset + (LOGO_FLOW_POINTS - 1) * 4 + 2)), 'closed lane endpoints');
  near(flowData.lanes[offset + 2], 0, 'lane cumulative start'); near(flowData.lanes[offset + (LOGO_FLOW_POINTS - 1) * 4 + 2], 1, 'lane cumulative end');
  for (let i = 0; i < LOGO_FLOW_POINTS; i++) {
    const j = offset + i * 4, [x, y, progress, length] = flowData.lanes.slice(j, j + 4);
    assert([x, y, progress, length].every(Number.isFinite) && logoContains(lane.kind, x, y), 'a real flow lane entered negative space');
    if (lane.kind === 2 && lane.contour === 0 && i % 8 === 0) whaleOutlineDistances.push(logoClearance(2, x, y));
    near(length, lane.length, 'CPU/GPU share the same stored lane length');
    if (i) {
      const k = j - 4, distance = Math.hypot(x - flowData.lanes[k], (y - flowData.lanes[k + 1]) / aspect);
      assert(progress >= flowData.lanes[k + 2], 'cumulative arc must be monotonic');
      assert(Math.abs(distance - (progress - flowData.lanes[k + 2]) * length) < 2e-6, 'stored arc must measure the repaired path, including corners');
      assert(logoContains(lane.kind, (x + flowData.lanes[k]) / 2, (y + flowData.lanes[k + 1]) / 2), 'a lane segment crossed a cutout');
    }
    laneArcChecks++;
  }
}
whaleOutlineDistances.sort((a, b) => a - b);
assert(whaleOutlineDistances[Math.floor(whaleOutlineDistances.length * .95)] < .05, 'DeepSeek outer flow must stay within a narrow silhouette band');
let logoWorldChecks = 0, flowHoleChecks = 0;
const logoCamera = new THREE.OrthographicCamera(-9.6, 9.6, 5.45, -5.45, .1, 100);
logoCamera.position.z = 12; logoCamera.updateMatrixWorld();
for (const quality of [2, 4]) {
  const { stars } = buildParticleField(quality), travel = new Float32Array([.012, .028, .041, .016, .074, .033]);
  const scratch = createPositionScratch(), local = new Float64Array(3), world = new Float64Array(3);
  for (const logo of LOGO_GEOMETRY) {
    const size = [7.2, 7.2 * logo.viewBox[3] / logo.viewBox[2]];
    for (let i = 0; i < stars.masses.length; i += 127) {
      const k = i * 4, seed = stars.shape[k], texel = (logo.kind * 1024 + Math.min(Math.floor(Math.min(seed, .999999) * 1024), 1023)) * 4;
      const start = shapes[texel + 2], end = shapes[texel + 3], span = Math.max(end - start, 1 / 1024);
      const bin = Math.min(LOGO_FLOW_BANDS - 1, Math.floor(fract(stars.seeds[k] * 3.17 + stars.seeds[k + 1] * 5.31 + stars.loops[k + 1] * 1.79) * LOGO_FLOW_BANDS));
      const lane = flowData.laneInfo.find(info => info.kind === logo.kind && info.start === start && info.row % LOGO_FLOW_BANDS === bin);
      const phase = density(fract(Math.max(0, Math.min(1, (seed - start) / span)) + travel[stars.loops[k]] * Math.fround(referenceArc) / lane.length));
      const point = sampleLane(lane.row, phase);
      const expected = [point[0] * size[0], point[1] * size[1],
        Math.sin(phase * Math.PI * 1.35 + stars.shape[k + 2]) * stars.shape[k + 1] * Math.sin(phase * Math.PI) + stars.loops[k + 3] * .75 + (stars.seeds[k + 2] - .5) * .22];
      near(shapeCoordinates(stars, i, logo.kind, travel, size, local, scratch.shape), phase, `${logo.name} GPU contour phase`);
      vectorNear(Array.from(local), expected, `${logo.name} GPU cumulative-arc lookup and depth contract`);
      for (const angle of [0, Math.PI / 2, .73]) {
        const params = { weights: [0, 0, 1, 0], shapeKind: logo.kind, time: 3.7, view: [19.2, 10.9], rail: .402,
          galaxyMatrix: identity, galaxyOrigin: [0, -1.09, 0], shapeMatrix: new THREE.Matrix4().makeRotationY(angle), shapeOrigin: [0, .4, 0], shapeSize: size, travel, entry: 1 };
        particlePosition(stars, i, params, world, scratch);
        const rotated = [Math.cos(angle) * expected[0] + Math.sin(angle) * expected[2], expected[1] + .4, -Math.sin(angle) * expected[0] + Math.cos(angle) * expected[2]];
        vectorNear(Array.from(world), rotated, `${logo.name} rotated world target`);
        const clip = new THREE.Vector3(...world).project(logoCamera);
        near(clip.x + .012, rotated[0] / 9.6 + .012, `${logo.name} disturbed horizontal clip target`);
        near(clip.y - .024, rotated[1] / 5.45 - .024, `${logo.name} disturbed vertical clip target`);
        params.weights = [0, .35, .65, 0]; particlePosition(stars, i, params, world, scratch);
        params.weights = [0, 1, 0, 0]; particlePosition(stars, i, params, local, scratch);
        vectorNear(Array.from(world), rotated.map((value, axis) => value * .65 + local[axis] * .35), `${logo.name} cloud blend`);
        logoWorldChecks++;
      }
    }
  }
}
const rowStars = buildParticleField(4).stars, rowScratch = createPositionScratch(), rowLocal = new Float64Array(3), rowWorld = new Float64Array(3);
const travelAt = time => Float32Array.from({ length: 6 }, (_, layer) => time * shapeFlowSpeed(layer));
const glyphCounts = [0, 0, 0], brightCounts = [0, 0, 0];
for (let i = 0; i < rowStars.masses.length; i++) {
  const slot = logoSlot(rowStars, i); assert(slot >= 0 && slot < 3); glyphCounts[slot]++;
  if (rowStars.light[i * 3] >= 2) brightCounts[slot]++;
}
assert(glyphCounts.every(count => count > rowStars.masses.length * .28), 'each glyph needs its share of the authored field');
assert(brightCounts.every(count => count > brightCounts.reduce((a, b) => a + b, 0) * .27), 'all three glyphs must retain the bright-star tail');
for (const layer of [0, 1, 2, 3, 4, 5]) near(shapeFlowSpeed(layer), [.020, .0144, .0168, .0128, .024, .0176][layer], 'original GPT flow clock');
for (const time of [0, 6, 60]) for (const { kind } of LOGO_SLOTS) vectorNear(logoMotionAngles(kind, time), [0, 0, 0], 'automatic glyph rotation must stay disabled');
let rowWorldChecks = 0;
const rowGaps = [];
for (const [width, height, viewHeight] of [[390, 844, 12.7], [1920, 854, 10.9]]) {
  const layout = logoRowLayout(width, height, viewHeight);
  assert.equal(layout.count, 3);
  assert(layout.iconWidth > 0 && layout.gap > 0 && layout.iconWidth * 3 + layout.gap * 2 <= width - 32, 'three glyphs must fit one row');
  vectorNear(layout.centers, [-layout.offset, 0, layout.offset], 'DeepSeek / GPT / Claude horizontal order');
  near(layout.offset - layout.size[0], layout.gap / height * viewHeight, 'adjacent glyphs must keep a visible gap');
  for (const [slot, definition] of LOGO_SLOTS.entries()) near(layout.sizes[slot][0] / layout.sizes[slot][1], definition.aspect, `${definition.name} official aspect`);
  let minGap = Infinity;
  for (const time of [0, 6, 30]) {
    const bounds = Array.from({ length: 3 }, () => [Infinity, -Infinity]);
    const params = { weights: [0, 0, 1, 0], time, view: [width / height * viewHeight, viewHeight], rail: .402,
      galaxyMatrix: identity, galaxyOrigin: [0, 0, 0], shapeMatrix: identity, shapeOrigin: [0, 0, 0], shapeSize: layout.size,
      travel: travelAt(time), entry: 1, logoPair: true, logoSlots: 3, logoOffset: layout.offset, logoMatrices: [identity, identity, identity] };
    for (let i = 0; i < rowStars.masses.length; i++) {
      particlePosition(rowStars, i, params, rowWorld, rowScratch);
      const slot = logoSlot(rowStars, i); bounds[slot][0] = Math.min(bounds[slot][0], rowWorld[0]); bounds[slot][1] = Math.max(bounds[slot][1], rowWorld[0]);
    }
    for (const gap of [bounds[1][0] - bounds[0][1], bounds[2][0] - bounds[1][1]]) {
      assert(gap * height / viewHeight > layout.gap * .5, 'actual flowing points must not overlap adjacent glyphs');
      minGap = Math.min(minGap, gap * height / viewHeight);
    }
  }
  rowGaps.push({ width, minGapPixels: +minGap.toFixed(2) });
  const matrices = [identity, new THREE.Matrix4().makeRotationY(.73), sideView];
  for (let i = 0; i < rowStars.masses.length; i += 137) {
    const slot = logoSlot(rowStars, i), kind = LOGO_SLOTS[slot].kind, frames = [];
    for (const time of [0, 6]) {
      const travel = travelAt(time), params = { weights: [0, 0, 1, 0], time, view: [width / height * viewHeight, viewHeight], rail: .402,
        galaxyMatrix: identity, galaxyOrigin: [0, 0, 0], shapeMatrix: sideView, shapeOrigin: [0, .3, 0], shapeSize: layout.size,
        travel, entry: 1, logoPair: true, logoSlots: 3, logoOffset: layout.offset, logoMatrices: matrices };
      const size = kind === 1 ? [5.8, 5.8 / LOGO_SLOTS[slot].aspect] : layout.sizes[slot];
      shapeCoordinates(rowStars, i, kind, travel, size, rowLocal, rowScratch.shape);
      if (kind === 1) rowLocal.forEach((value, axis) => { rowLocal[axis] = value * layout.size[0] / 5.8; });
      else rowLocal[2] *= Math.min(1, layout.size[0] / 5.8);
      const expected = new THREE.Vector3(...rowLocal).applyMatrix4(matrices[slot]); expected.x += layout.centers[slot]; expected.y += .3;
      particlePosition(rowStars, i, params, rowWorld, rowScratch);
      vectorNear(Array.from(rowWorld), expected.toArray(), 'glyph-local matrix must precede the final horizontal slot offset');
      frames.push(Array.from(rowWorld)); rowWorldChecks++;
      params.time = 1000; particlePosition(rowStars, i, params, rowWorld, rowScratch);
      vectorNear(Array.from(rowWorld), frames.at(-1), 'frozen travel and manual pose must freeze the glyph; elapsed alone cannot rotate it');
    }
    assert(Math.hypot(...frames[0].map((value, axis) => frames[1][axis] - value)) > 1e-5, 'the actual rendered point must flow');
  }
}
for (const logo of LOGO_GEOMETRY) for (let i = 0; i < rowStars.masses.length; i++) for (const time of [0, 1, 6, 12, 30]) {
  shapeCoordinates(rowStars, i, logo.kind, travelAt(time), [1, 1], rowLocal, rowScratch.shape);
  assert(logoContains(logo.kind, rowLocal[0], rowLocal[1]), `${logo.name} flow entered negative space at index ${i}, time ${time}: ${rowLocal[0]}, ${rowLocal[1]}`);
  const [left, top, width, height] = logo.viewBox;
  for (const [a, b, radius] of logoEmptyPoints.get(logo.kind)) {
    const u = logo.kind === 2 ? (a - left) / width : a, v = logo.kind === 2 ? (b - top) / height : b;
    const dx = (rowLocal[0] + .5 - u) * (logo.kind === 2 ? width : 1), dy = (.5 - rowLocal[1] - v) * (logo.kind === 2 ? height : 1);
    assert(Math.hypot(dx, dy) > radius, 'a moving point filled a verified eye, belly or ray gap');
  }
  flowHoleChecks++;
}
assert.equal(logoMotionTime(1000, true), 0, 'reduced motion must not accumulate logo time');
// Same phase is insufficient: compare actual XY world distance on the same lanes.
const median = values => { const sorted = values.slice().sort((a, b) => a - b); return sorted[Math.floor(sorted.length / 2)]; };
function velocitySample(i, kind, dt) {
  const k = i * 4, seed = rowStars.shape[k], texel = (kind * 1024 + Math.min(Math.floor(Math.min(seed, .999999) * 1024), 1023)) * 4;
  const start = shapes[texel + 2], end = shapes[texel + 3], size = [5.8, 5.8 / LOGO_SLOTS.find(slot => slot.kind === kind).aspect];
  const points = [], phases = [];
  for (const offset of [-2, -1, 0, 1, 2]) {
    const phase = shapeCoordinates(rowStars, i, kind, travelAt(3.7 + offset * dt), size, rowLocal, rowScratch.shape);
    if (phase <= .03 || phase >= .97) return null;
    const index = Math.floor((start + (end - start) * phase) * 1023);
    for (const nearby of [index - 2, index + 2]) {
      if (nearby < 0 || nearby > 1023) return null;
      const j = (kind * 1024 + nearby) * 4;
      if (shapes[j + 2] !== start || shapes[j + 3] !== end) return null;
    }
    points.push(Array.from(rowLocal.slice(0, 2))); phases.push(phase);
  }
  if (phases.some((value, n) => n && value <= phases[n - 1])) return null;
  const deltas = points.slice(1).map((point, n) => [point[0] - points[n][0], point[1] - points[n][1]]), lengths = deltas.map(delta => Math.hypot(...delta));
  if (Math.min(...lengths) < 1e-9 || Math.max(...lengths) / Math.min(...lengths) > 1.15) return null;
  for (let n = 1; n < deltas.length; n++) if ((deltas[n][0] * deltas[n - 1][0] + deltas[n][1] * deltas[n - 1][1]) / (lengths[n] * lengths[n - 1]) < .99) return null;
  return Math.hypot(points[3][0] - points[1][0], points[3][1] - points[1][1]) / (2 * dt);
}
function measureWorldFlow() {
  const steps = [.001, .005], velocities = steps.map(() => Array.from({ length: 6 }, () => [[], [], []]));
  for (let i = 0; i < rowStars.masses.length; i++) {
    const speeds = steps.map(dt => LOGO_SLOTS.map(({ kind }) => velocitySample(i, kind, dt)));
    if (speeds.some(slots => slots.some(value => value === null))) continue;
    speeds.forEach((slots, step) => slots.forEach((value, slot) => velocities[step][rowStars.loops[i * 4]][slot].push(value)));
  }
  return velocities.map(lanes => lanes.map((slots, lane) => {
    assert(slots[0].length >= (lane === 5 ? 50 : 400), 'too few smooth-contour samples to compare visible speed');
    const medians = slots.map(median);
    assert(Math.min(...medians) > .3, 'flow must move visible XY points, not only depth or twinkle');
    assert(Math.max(...medians) / Math.min(...medians) < 1.15, 'side glyphs must match the original GPT world speed');
    return { lane, points: slots[0].length, medians };
  }));
}
const [measuredFlow, alternateStep] = measureWorldFlow();
const worldFlowSpeed = measuredFlow.map(({ lane, points, medians }) => {
  medians.forEach((value, slot) => assert(Math.abs(alternateStep[lane].medians[slot] / value - 1) < .02, 'XY speed measurement must remain stable at a second small time step'));
  return { lane, points, deepseek: +medians[0].toFixed(5), gpt: +medians[1].toFixed(5), claude: +medians[2].toFixed(5) };
});
// Keep corners and seams: medians alone hid the former local velocity spikes.
const peakSpeeds = [[], []], speedA = new Float64Array(3), speedB = new Float64Array(3), speedStep = .005;
let peakChecks = 0, periodChecks = 0, seamChecks = 0;
function checkStep(i, time, before, after) {
  const slot = logoSlot(rowStars, i), { kind, aspect } = LOGO_SLOTS[slot], layer = rowStars.loops[i * 4];
  shapeCoordinates(rowStars, i, kind, before, [5.8, 5.8 / aspect], speedA, rowScratch.shape);
  shapeCoordinates(rowStars, i, kind, after, [5.8, 5.8 / aspect], speedB, rowScratch.shape);
  const speed = Math.hypot(speedB[0] - speedA[0], speedB[1] - speedA[1]) / speedStep;
  const bound = shapeFlowDistance() * 5.8 * shapeFlowSpeed(layer) * 1.22;
  assert(speed <= bound * 1.02, `${LOGO_SLOTS[slot].name} local spike at index ${i}, time ${time}: ${speed} > ${bound}`);
  return speed * 400 / 5.8;
}
for (let tick = 0; tick <= 600; tick++) {
  const time = tick / 10, before = travelAt(time), after = travelAt(time + speedStep);
  for (let i = 0; i < rowStars.masses.length; i++) {
    const slot = logoSlot(rowStars, i); if (slot === 1) continue;
    peakSpeeds[slot === 0 ? 0 : 1].push(checkStep(i, time, before, after)); peakChecks++;
  }
}
for (let layer = 0; layer < 6; layer++) {
  const time = 1 / shapeFlowSpeed(layer), before = travelAt(time - speedStep), after = travelAt(time);
  for (let i = 0; i < rowStars.masses.length; i++) if (logoSlot(rowStars, i) !== 1) { checkStep(i, time - speedStep, before, after); periodChecks++; }
}
for (const lane of flowData.laneInfo) for (const epsilon of [1e-5, .001]) {
  const a = sampleLane(lane.row, 1 - epsilon), b = sampleLane(lane.row, epsilon), aspect = LOGO_SLOTS.find(slot => slot.kind === lane.kind).aspect;
  assert(Math.hypot(a[0] - b[0], (a[1] - b[1]) / aspect) <= 2 * epsilon * lane.length * 1.02, 'closed contour seam must not jump'); seamChecks++;
}
const peakFlowSpeed = peakSpeeds.map((values, i) => {
  values.sort((a, b) => a - b);
  return { name: ['deepseek', 'claude'][i], samples: values.length, p99PixelsPerSecond: +values[Math.floor(values.length * .99)].toFixed(3), maxPixelsPerSecond: +values.at(-1).toFixed(3) };
});
let logoScrollChecks = 0;
for (const height of [653, 854]) {
  for (const top of [height, height * .4, 0, -height * .4, -height]) {
    const rect = { top, height }, normal = sculptureState('logos', rect, height), reduced = sculptureState('logos', rect, height, true);
    assert.equal(Boolean(normal), Boolean(reduced));
    if (normal) {
      assert.equal(normal.kind, SCULPTURE_KINDS.logos); assert(normal.strength >= 0 && normal.strength <= 1);
      assert.equal(reduced.scene, 'logos'); assert.equal(reduced.strength, 1, 'reduced motion must show the complete stationary row');
    }
    logoScrollChecks++;
  }
  near(sculptureState('logos', { top: 0, height }, height).strength, 1, 'the row is fully formed at the viewport center');
}
assert.equal(sculptureState('unknown', { top: 0, height: 854 }, 854), null);

// Read the shipped names so changing a word also changes the verified timeline.
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const galaxy = readFileSync(new URL('../galaxy.js', import.meta.url), 'utf8');
const logoScenes = ['deepseek', 'gpt', 'claude'];
const pairSections = [...html.matchAll(/<section id="particle-logos"[\s\S]*?<\/section>/g)];
assert.equal(pairSections.length, 1, 'all three marks need one shared star cloud section');
const pairHTML = pairSections[0][0];
assert(pairHTML.includes('aria-label="DeepSeek、GPT 与 Claude 星云"'), 'the shared cloud must have an accessible name');
assert(!pairHTML.includes('particle-caption') && !/<(?:p|h[1-6])(?:\s|>)/.test(pairHTML), 'the paired marks must not repeat captions');
assert.equal(pairHTML.replace(/<[^>]+>/g, '').trim(), '', 'the paired marks must not contain visible explanations');
for (const scene of logoScenes) {
  assert.equal([...pairHTML.matchAll(new RegExp(`data-particle-scene="${scene}"`, 'g'))].length, 1, `${scene} needs one reachable local rotation target`);
  assert(pairHTML.includes(`id="particle-${scene}"`), `${scene} must retain its incoming hash anchor`);
  assert(!html.includes(`<section id="particle-${scene}"`), `${scene} must not remain a separate page scene`);
}
assert(pairHTML.includes('id="particle-blossom"') && !html.includes('<section id="particle-blossom"'), 'the old GPT anchor must lead to the shared row');
const logoOrder = ['featured', 'particle-logos', 'contact'].map(id => html.indexOf(`<section id="${id}"`));
assert(logoOrder.every((position, i) => position >= 0 && (!i || position > logoOrder[i - 1])), 'the shared row must follow featured work and precede contact');
assert(galaxy.includes('function canMotion(){return !paused&&!reduced.matches&&!lost&&!document.hidden;}'), 'paused and reduced motion must gate the shared animation clock');
assert(galaxy.includes('dt*shapeFlowSpeed(layer)*flow'), 'all glyphs must use the original GPT clock');
assert(galaxy.includes('shapeTravel[layer]+=dt*shapeFlowSpeed(layer)*flow'), 'shared travel must accumulate without an early phase reset');
assert(galaxy.includes('vColor=mix(aColor,vec3(1.),aOffset.z*.16)'), 'all glyphs must keep the original stellar palette');
assert(!galaxy.includes('uLogoColors') && !galaxy.includes('sizeScale=mix(sizeScale,1.,logo)'), 'side glyphs must not override shared star color or size');
assert(galaxy.includes('const rx=pair?0:') && galaxy.includes('ry=pair?0:'), 'the row must not inherit the old automatic entrance rotation');
assert(!galaxy.includes('uVisibility'), 'letter animation must not hide the particle field');
assert(!galaxy.match(/opticalLights\[n\]\.set\([^;]*assembly/), 'star glow must stay lit before assembly');
const orders = [...html.matchAll(/data-intro-letter="(\d+)"/g)].map(match => Number(match[1]));
assert.deepEqual(orders, [7, 6, 5, 4, 3, 2, 1, 0, 0, 1, 2]);
assert(html.includes('aria-label="SherlockMen 的个人主页"'));
for (const removed of ['pause-motion', 'reset-galaxy', 'galaxy-hint', 'galaxy-controls', 'scroll-cue', 'SCROLL TO DISCOVER']) {
  assert(!html.includes(removed) && !app.includes(removed), `deleted control still referenced: ${removed}`);
}
assert(!css.includes('galaxy-controls') && !css.includes('scroll-cue'));
assert(!css.includes(String.fromCharCode(92) + 'n'), 'CSS contains a literal newline escape');
assert(css.includes('.pause-button{'), 'the project dialog pause button must retain its styling');
const maxOrder = Math.max(...orders), timing = introState(0, maxOrder);
const bootstrap = html.match(/<script>([\s\S]*?)<\/script>/)[1];
for (const reduced of [false, true]) for (const filename of ['galaxy.js?v=word-clear-1', 'particle-logos.js?v=deepseek-outline-1']) {
  const root = { dataset: {} }, title = { dataset: {}, getAnimations: () => [{ cancel: () => { title.cancelled = true; } }] };
  let onError;
  runInNewContext(bootstrap, { matchMedia: () => ({ matches: reduced }), document: { documentElement: root, getElementById: () => title }, addEventListener: (type, handler) => { if (type === 'error') onError = handler; } });
  assert.equal(root.dataset.heroIntro === 'pending', !reduced, 'only normal-motion first paint hides the title');
  onError({ filename: 'https://example.com/portfolio/' + filename, target: {} });
  assert.equal(root.dataset.heroIntro, 'complete', 'a module SyntaxError must restore the full name');
  assert.equal(root.dataset.heroIntroFailed, 'true');
  assert.equal(title.cancelled, true, 'failed execution must remove existing character opacity animations');
}
near(timing.titleEnd, 2.55, 'complete title threshold');
near(timing.gatherStart, timing.titleEnd, 'particle gather starts as soon as the title completes');
near(timing.end, 8.05, 'complete assembly threshold');
assert.equal(introLetterProgress(.84, 0), 0);
assert(introLetterProgress(.86, 0) > 0);
assert(orders.every(order => introLetterProgress(timing.titleEnd, order) > 1 - 1e-9));
assert.equal(introState(timing.titleEnd, maxOrder).assembly, 0);
assert(introState(timing.titleEnd + .01, maxOrder).assembly > 0);
near(introState(5.30, maxOrder).assembly, .5, 'assembly midpoint');
assert.equal(introState(8.05, maxOrder).phase, 'complete');
let previousAssembly = 0;
for (let n = 0; n <= 170; n++) {
  const timeline = introState(n * .05, maxOrder);
  assert(timeline.titleComplete || timeline.assembly === 0, 'gathering began before the name completed');
  assert(timeline.assembly >= previousAssembly && timeline.assembly <= 1, 'assembly must be monotonic');
  previousAssembly = timeline.assembly;
}
console.log(JSON.stringify({ status: 'passed', sourceCounts: '2048+274 / 4096+546', sourceCoreFixtures: sourceCore.length, depthAndSideViewComparisons: comparisons, minDepth, maxDepth, intro: { letters: orders.length, titleEnd: timing.titleEnd, gatherStart: timing.gatherStart, end: timing.end }, logos: { samples: logoSampleChecks, contours: contourCounts, laneArcChecks, worldAndClipComparisons: logoWorldChecks, scrollAndReducedChecks: logoScrollChecks, rowWorldChecks, flowHoleChecks, glyphCounts, brightCounts, rowGaps, worldFlowSpeed, peakChecks, periodChecks, seamChecks, peakFlowSpeed } }));
