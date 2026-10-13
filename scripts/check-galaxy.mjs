import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import * as THREE from '../vendor/three.module.min.js';
import { buildParticleField, buildShapeSamples, shapeCoordinates, particlePosition, createPositionScratch, introState, introLetterProgress, SCULPTURE_KINDS, sculptureState, logoPairLayout, logoMotionTime, logoMotionAngles } from '../galaxy.js';
import { LOGO_GEOMETRY, buildLogoSamples, logoContains, logoClearance } from '../particle-logos.js';

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

// These empty points were checked independently against the official SVG paths.
const logoEmptyPoints = new Map([
  [2, [[8, 14, 1], [16.5, 11.7, .35], [14.46, 11.25, .14], [24, 9, .3]]],
  [3, [[.20, .40, .025], [.20, .58, .025], [.84, .35, .025], [.40, .90, .025]]]
]);
const logoFilledPoints = new Map([[2, [[8, 6], [24, 6]]], [3, [[47, 47], [26, 8]]]]);
const logoSamples = buildLogoSamples();
assert.deepEqual(LOGO_GEOMETRY.map(({name, kind}) => [name, kind]), [['deepseek', 2], ['claude', 3]]);
assert.equal(logoSamples.length, 2 * 1024 * 4);
assert.equal(shapes.length, 4 * 1024 * 4);
assert.deepEqual(shapes.slice(2 * 1024 * 4), logoSamples, 'the GPU atlas must contain the same complete logo targets');
function logoDensityStats(kind, points) {
  const bins = 8, grid = 128, n = points.length;
  const area = Array(bins * bins).fill(0), counts = area.slice();
  const cell = (x, y) => Math.min(7, Math.max(0, Math.floor((y + .5) * bins))) * bins + Math.min(7, Math.max(0, Math.floor((x + .5) * bins)));
  for (let y = 0; y < grid; y++) for (let x = 0; x < grid; x++) {
    const u = (x + .5) / grid - .5, v = (y + .5) / grid - .5;
    if (logoContains(kind, u, v)) area[cell(u, v)]++;
  }
  for (const [x, y] of points) counts[cell(x, y)]++;
  const total = area.reduce((sum, value) => sum + value, 0);
  const cells = area.map((value, i) => ({ p: value / total, c: counts[i] })).filter(({ p }) => n * p >= 4).map(item => ({ ...item, d: item.c / (n * item.p) }));
  const validArea = cells.reduce((sum, item) => sum + item.p, 0), sparse = cells.filter(item => item.d < .5);
  let topArea = 0, topMass = 0;
  for (const item of cells.slice().sort((a, b) => b.d - a.d)) {
    if (topArea >= .25) break;
    topArea += item.p; topMass += item.c / n;
  }
  return { cv: Math.sqrt(cells.reduce((sum, item) => sum + item.p * (item.d - 1) ** 2, 0) / validArea), topMass,
    sparseArea: sparse.reduce((sum, item) => sum + item.p, 0), sparseMass: sparse.reduce((sum, item) => sum + item.c, 0) / n,
    coverage: cells.filter(item => item.c > 0).reduce((sum, item) => sum + item.p, 0) / validArea };
}
let logoSampleChecks = 0;
const logoSamplingStats = [];
for (const logo of LOGO_GEOMETRY) {
  const [left, top, width, height] = logo.viewBox;
  const row = (logo.kind - 2) * 1024 * 4;
  let edgeCount = 0, minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < 1024; i++) {
    const j = row + i * 4, [x, y, edge, radius] = logoSamples.slice(j, j + 4);
    assert([x, y, edge, radius].every(Number.isFinite), `${logo.name} has a non-finite target`);
    assert(Math.abs(x) <= .500001 && Math.abs(y) <= .500001, `${logo.name} target escaped its official bounds`);
    assert(logoContains(logo.kind, x, y), `${logo.name} target entered negative space`);
    assert(edge === 0 || edge === 1, `${logo.name} has an invalid boundary marker`);
    assert(radius >= 0 && radius <= .030001, `${logo.name} has an unsafe motion radius`);
    assert(radius <= logoClearance(logo.kind, x, y) * .6001 + 1e-6, `${logo.name} motion may enter a cutout`);
    edgeCount += edge; minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    logoSampleChecks++;
  }
  assert(edgeCount > 20 && edgeCount < 1000, `${logo.name} needs both silhouette and filled-body samples`);
  assert(minX < -.4 && maxX > .4 && minY < -.4 && maxY > .4, `${logo.name} samples must cover the complete mark`);
  const fill = [];
  for (let i = 0; i < 1024; i++) { const j = row + i * 4; if (logoSamples[j + 2] === 0) fill.push([logoSamples[j], logoSamples[j + 1]]); }
  const stats = logoDensityStats(logo.kind, fill);
  assert(stats.cv > .55 && stats.topMass > .45, `${logo.name} needs dense star clusters instead of uniform fill`);
  assert(stats.sparseArea > .15 && stats.sparseMass > .025 && stats.coverage > .90, `${logo.name} needs sparse stars between its clusters`);
  logoSamplingStats.push({ name: logo.name, ...stats });
  for (const [x, y] of logoFilledPoints.get(logo.kind)) {
    assert(logoContains(logo.kind, (x - left) / width - .5, .5 - (y - top) / height), `${logo.name} official solid body is missing`);
  }
  for (const [a, b, radius] of logoEmptyPoints.get(logo.kind)) {
    const u = logo.kind === 2 ? (a - left) / width : a, v = logo.kind === 2 ? (b - top) / height : b;
    assert.equal(logoContains(logo.kind, u - .5, .5 - v), false, `${logo.name} official cutout was filled`);
    for (let i = 0; i < 1024; i++) {
      const j = row + i * 4;
      const dx = (logoSamples[j] + .5 - u) * (logo.kind === 2 ? width : 1);
      const dy = (.5 - logoSamples[j + 1] - v) * (logo.kind === 2 ? height : 1);
      assert(Math.hypot(dx, dy) > radius, `${logo.name} sample entered a verified empty region`);
    }
  }
}

// Independently apply the shader's nearest-texel, depth, world and clip transforms.
let logoWorldChecks = 0;
const logoCamera = new THREE.OrthographicCamera(-9.6, 9.6, 5.45, -5.45, .1, 100);
logoCamera.position.z = 12; logoCamera.updateMatrixWorld();
for (const quality of [2, 4]) {
  const { stars } = buildParticleField(quality);
  const travel = new Float32Array([.012, .028, .041, .016, .074, .033]);
  const scratch = createPositionScratch(), local = new Float64Array(3), world = new Float64Array(3);
  for (const logo of LOGO_GEOMETRY) {
    const size = [7.2, 7.2 * logo.viewBox[3] / logo.viewBox[2]];
    for (let i = 0; i < stars.masses.length; i += 127) {
      const k = i * 4, seed = stars.shape[k], texel = (logo.kind * 1024 + Math.min(Math.floor(Math.min(seed, .999999) * 1024), 1023)) * 4;
      const phase = density(fract(seed + travel[stars.loops[k]]));
      const expected = [shapes[texel] * size[0], shapes[texel + 1] * size[1],
        Math.sin(phase * Math.PI * 1.35 + stars.shape[k + 2]) * stars.shape[k + 1] * Math.sin(phase * Math.PI)
          + stars.loops[k + 3] * .75 + (stars.seeds[k + 2] - .5) * .22];
      near(shapeCoordinates(stars, i, logo.kind, travel, size, local, scratch.shape), phase, `${logo.name} GPU contour phase`);
      vectorNear(Array.from(local), expected, `${logo.name} GPU texel and depth contract`);
      const laterTravel = travel.map(value => value + .27);
      shapeCoordinates(stars, i, logo.kind, laterTravel, size, world, scratch.shape);
      vectorNear(Array.from(world.slice(0, 2)), expected.slice(0, 2), `${logo.name} flow must not cross a cutout`);
      for (const angle of [0, Math.PI / 2, .73]) {
        const params = { weights: [0, 0, 1, 0], shapeKind: logo.kind, time: 3.7, view: [19.2, 10.9], rail: .402,
          galaxyMatrix: identity, galaxyOrigin: [0, -1.09, 0], shapeMatrix: new THREE.Matrix4().makeRotationY(angle),
          shapeOrigin: [0, .4, 0], shapeSize: size, travel, entry: 1 };
        particlePosition(stars, i, params, world, scratch);
        const rotated = [Math.cos(angle) * expected[0] + Math.sin(angle) * expected[2], expected[1] + .4,
          -Math.sin(angle) * expected[0] + Math.cos(angle) * expected[2]];
        vectorNear(Array.from(world), rotated, `${logo.name} rotated world target`);
        const clip = new THREE.Vector3(...world).project(logoCamera), offset = [.012, -.024];
        near(clip.x + offset[0], rotated[0] / 9.6 + offset[0], `${logo.name} disturbed horizontal clip target`);
        near(clip.y + offset[1], rotated[1] / 5.45 + offset[1], `${logo.name} disturbed vertical clip target`);
        params.weights = [0, .35, .65, 0]; particlePosition(stars, i, params, world, scratch);
        params.weights = [0, 1, 0, 0]; particlePosition(stars, i, params, local, scratch);
        vectorNear(Array.from(world), rotated.map((value, axis) => value * .65 + local[axis] * .35), `${logo.name} cloud blend`);
        logoWorldChecks++;
      }
    }
  }
}
let pairWorldChecks = 0, orbitChecks = 0;
const pairStars = buildParticleField(4).stars, pairTravel = new Float32Array(6), pairScratch = createPositionScratch();
const pairLocal = new Float64Array(3), pairWorld = new Float64Array(3);
const matricesAt = time => [2, 3].map(kind => new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(...logoMotionAngles(kind, time), 'XYZ')));
const glyphCounts = [0, 0], brightCounts = [0, 0];
for (let i = 0; i < pairStars.masses.length; i++) {
  const side = Number(pairStars.seeds[i * 4 + 3] >= .5); glyphCounts[side]++;
  if (pairStars.light[i * 3] >= 2) brightCounts[side]++;
}
assert(glyphCounts.every(count => count > pairStars.masses.length * .4), 'both glyphs need their share of the star field');
assert(brightCounts.every(count => count > (brightCounts[0] + brightCounts[1]) * .35), 'both glyphs must retain the bright-star tail');
for (const [width, height, viewHeight] of [[390, 844, 12.7], [1920, 854, 10.9]]) {
  const layout = logoPairLayout(width, height, viewHeight);
  assert(layout.iconWidth > 0 && layout.gap > 0 && layout.iconWidth * 2 + layout.gap <= width - 32, 'the pair must fit one row with a clear gap');
  near(layout.offset * 2 - layout.size[0], layout.gap / height * viewHeight, 'local glyph centers must preserve the row gap');
  near(layout.sizes[0][0] / layout.sizes[0][1], 26.634 / 19.6, 'DeepSeek must retain its official aspect ratio');
  const manual = new THREE.Matrix4().makeRotationY(.73);
  for (let i = 0; i < pairStars.masses.length; i += 137) {
    const side = Number(pairStars.seeds[i * 4 + 3] >= .5), kind = side + 2, frames = [];
    for (const time of [0, 6]) {
      const params = { weights: [0, 0, 1, 0], time, view: [width / height * viewHeight, viewHeight], rail: .402,
        galaxyMatrix: identity, galaxyOrigin: [0, 0, 0], shapeMatrix: manual, shapeOrigin: [0, .3, 0],
        shapeSize: layout.size, travel: pairTravel, entry: 1, logoPair: true, logoTime: logoMotionTime(time),
        logoOffset: layout.offset, logoMatrices: matricesAt(logoMotionTime(time)) };
      shapeCoordinates(pairStars, i, kind, pairTravel, layout.sizes[side], pairLocal, pairScratch.shape, params.logoTime);
      pairLocal[2] *= Math.min(1, layout.size[0] / 5.8);
      const expected = new THREE.Vector3(...pairLocal).applyMatrix4(params.logoMatrices[side]).applyMatrix4(manual);
      expected.x += (side ? 1 : -1) * layout.offset; expected.y += .3;
      particlePosition(pairStars, i, params, pairWorld, pairScratch);
      vectorNear(Array.from(pairWorld), expected.toArray(), 'pair automatic/local/manual rotation before final row offset');
      frames.push(Array.from(pairWorld)); pairWorldChecks++;
      params.logoTime = logoMotionTime(time, true); params.logoMatrices = matricesAt(params.logoTime);
      particlePosition(pairStars, i, params, pairWorld, pairScratch); const fixed = Array.from(pairWorld);
      params.time = 1000; params.logoTime = logoMotionTime(1000, true); params.logoMatrices = matricesAt(params.logoTime);
      particlePosition(pairStars, i, params, pairWorld, pairScratch);
      vectorNear(Array.from(pairWorld), fixed, 'reduced motion fixes the complete pair independently of elapsed time');
    }
    assert(Math.hypot(...frames[0].map((value, axis) => frames[1][axis] - value)) > 1e-5, 'automatic motion must change the rendered world point');
  }
}
for (const logo of LOGO_GEOMETRY) for (let i = 0; i < pairStars.masses.length; i += 17) {
  const seed = pairStars.shape[i * 4], texel = (logo.kind * 1024 + Math.min(Math.floor(Math.min(seed, .999999) * 1024), 1023)) * 4;
  for (const time of [0, 1, 6, 12]) {
    shapeCoordinates(pairStars, i, logo.kind, pairTravel, [1, 1], pairLocal, pairScratch.shape, time);
    assert(logoContains(logo.kind, pairLocal[0], pairLocal[1]), 'particle flow must preserve the logo cutouts');
    assert(Math.hypot(pairLocal[0] - shapes[texel], pairLocal[1] - shapes[texel + 1]) <= shapes[texel + 3] + 1e-6, 'particle flow must stay inside its safe orbit');
    orbitChecks++;
  }
}
let logoScrollChecks = 0;
for (const name of ['logos']) {
  assert.equal(SCULPTURE_KINDS[name], 2);
  for (const height of [653, 854]) {
    for (const top of [height, height * .4, 0, -height * .4, -height]) {
      const rect = { top, height }, normal = sculptureState(name, rect, height), reduced = sculptureState(name, rect, height, true);
      assert.equal(Boolean(normal), Boolean(reduced));
      if (normal) {
        assert.equal(normal.kind, 2); assert(normal.strength >= 0 && normal.strength <= 1);
        assert.equal(reduced.scene, name); assert.equal(reduced.strength, 1, 'reduced motion must show the complete stationary pair');
      }
      logoScrollChecks++;
    }
    near(sculptureState(name, { top: 0, height }, height).strength, 1, 'the pair is fully formed at the viewport center');
  }
}
// Adjacent shapes must meet through the dispersed field instead of overlapping.
for (const [first, second] of [['blossom', 'logos']]) {
  const viewport = 653, firstHeight = 720, secondHeight = 854;
  const seam = viewport / 2 - (3 * firstHeight + secondHeight) / 4;
  for (const offset of [-50, -1, 0, 1, 50]) {
    const a = sculptureState(first, { top: seam - offset, height: firstHeight }, viewport, false, { afterHeight: secondHeight });
    const b = sculptureState(second, { top: seam + firstHeight - offset, height: secondHeight }, viewport, false, { beforeHeight: firstHeight });
    assert(!(a && b), `${first}/${second} overlap at their shared midpoint`);
    if (a || b) assert((a || b).strength < .02, 'neighbor handoff must pass through dispersed particles');
    logoScrollChecks++;
  }
}
assert.equal(sculptureState('unknown', { top: 0, height: 854 }, 854), null);

// Read the shipped names so changing a word also changes the verified timeline.
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');
const galaxy = readFileSync(new URL('../galaxy.js', import.meta.url), 'utf8');
const logoScenes = ['deepseek', 'claude'];
const pairSections = [...html.matchAll(/<section id="particle-logos"[\s\S]*?<\/section>/g)];
assert.equal(pairSections.length, 1, 'both marks need one shared star cloud section');
const pairHTML = pairSections[0][0];
assert(pairHTML.includes('aria-label="DeepSeek 与 Claude 星云"'), 'the shared cloud must have an accessible name');
assert(!pairHTML.includes('particle-caption') && !/<(?:p|h[1-6])(?:\s|>)/.test(pairHTML), 'the paired marks must not repeat captions');
assert.equal(pairHTML.replace(/<[^>]+>/g, '').trim(), '', 'the paired marks must not contain visible explanations');
for (const scene of logoScenes) {
  assert.equal([...pairHTML.matchAll(new RegExp(`data-particle-scene="${scene}"`, 'g'))].length, 1, `${scene} needs one reachable local rotation target`);
  assert(pairHTML.includes(`id="particle-${scene}"`), `${scene} must retain its incoming hash anchor`);
  assert(!html.includes(`<section id="particle-${scene}"`), `${scene} must not remain a separate page scene`);
}
const logoOrder = ['particle-blossom', 'particle-logos', 'contact'].map(id => html.indexOf(`<section id="${id}"`));
assert(logoOrder.every((position, i) => position >= 0 && (!i || position > logoOrder[i - 1])), 'logo scenes must follow the blossom and precede contact');
assert(!galaxy.includes('uVisibility'), 'letter animation must not hide the particle field');
assert(!galaxy.match(/opticalLights\[n\]\.set\([^;]*assembly/), 'star glow must stay lit before assembly');
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
for (const reduced of [false, true]) for (const filename of ['galaxy.js?v=nebula-pair-1', 'particle-logos.js?v=nebula-pair-1']) {
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
console.log(JSON.stringify({ status: 'passed', sourceCounts: '2048+274 / 4096+546', sourceCoreFixtures: sourceCore.length, depthAndSideViewComparisons: comparisons, minDepth, maxDepth, intro: { letters: orders.length, titleEnd: timing.titleEnd, gatherStart: timing.gatherStart, end: timing.end }, logos: { samples: logoSampleChecks, worldAndClipComparisons: logoWorldChecks, scrollAndReducedChecks: logoScrollChecks, pairWorldChecks, orbitChecks, glyphCounts, brightCounts, density: logoSamplingStats.map(({name, cv, topMass, coverage}) => ({name, cv: +cv.toFixed(3), topMass: +topMass.toFixed(3), coverage: +coverage.toFixed(3)})) } }));
