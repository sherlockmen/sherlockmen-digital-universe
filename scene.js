(() => {
  'use strict';

  const canvas = document.getElementById('hero-canvas');
  if (!canvas) return;
  const status = document.getElementById('scene-status');
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let gl;
  let program;
  let uniforms;
  let frame = 0;
  let visible = true;
  let lost = false;
  let paused = false;
  let elapsed = 8.2;
  let previous = 0;
  let mode = 0;
  let dragging = false;
  let pointerId = null;
  let lastX = 0;
  let lastY = 0;
  const rotation = [0, 0];
  const hover = [0, 0];
  const targetHover = [0, 0];

  const vertexSource = `
    attribute vec2 aPosition;
    void main() { gl_Position = vec4(aPosition, 0.0, 1.0); }
  `;

  const fragmentSource = `
    precision highp float;
    uniform vec2 uResolution;
    uniform vec2 uRotation;
    uniform float uTime;
    uniform float uMode;

    mat2 turn(float a) { float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
    float torus(vec3 p, float radius, float tube) {
      return length(vec2(length(p.xy) - radius, p.z)) - tube;
    }
    vec3 localPoint(vec3 p) {
      p.yz = turn(0.58 + uRotation.y) * p.yz;
      p.xz = turn(uTime * 0.13 + uRotation.x) * p.xz;
      p.xy = turn(-0.32) * p.xy;
      return p;
    }
    float shape(vec3 point) {
      vec3 p = localPoint(point);
      if (uMode < 0.5) {
        // The two toroidal branches join into one continuous (2, 3) trefoil.
        float angle = atan(p.y, p.x);
        vec2 q = vec2(length(p.xy) - 0.96, p.z);
        vec2 branch = 0.38 * vec2(cos(angle * 1.5), sin(angle * 1.5));
        return (min(length(q - branch), length(q + branch)) - 0.205) * 0.54;
      }
      if (uMode < 1.5) {
        float sphere = length(p) - 0.52;
        vec3 a = p; a.yz = turn(0.48) * a.yz;
        vec3 b = p; b.xz = turn(1.21) * b.xz;
        vec3 c = p; c.yz = turn(-1.13) * c.yz; c.xz = turn(0.50) * c.xz;
        return min(sphere, min(torus(a, 1.16, 0.065), min(torus(b, 1.16, 0.065), torus(c, 1.16, 0.065))));
      }
      vec3 q = abs(p);
      float octahedron = (q.x + q.y + q.z - 1.66) * 0.57735027;
      vec3 orbit = p; orbit.yz = turn(0.80) * orbit.yz;
      return min(octahedron, torus(orbit, 1.32, 0.035));
    }
    vec3 normalAt(vec3 p) {
      vec2 e = vec2(0.0018, -0.0018);
      return normalize(e.xyy * shape(p + e.xyy) + e.yyx * shape(p + e.yyx)
        + e.yxy * shape(p + e.yxy) + e.xxx * shape(p + e.xxx));
    }
    float occlusion(vec3 p, vec3 n) {
      float shade = 0.0;
      float weight = 1.0;
      for (int i = 1; i <= 3; i++) {
        float distance = 0.11 * float(i);
        shade += (distance - shape(p + n * distance)) * weight;
        weight *= 0.55;
      }
      return clamp(1.0 - shade * 1.35, 0.35, 1.0);
    }
    vec3 environment(vec3 r) {
      float upper = pow(max(dot(r, normalize(vec3(-0.75, 0.7, 0.5))), 0.0), 9.0);
      float strip = pow(max(dot(r, normalize(vec3(0.8, 0.4, 0.7))), 0.0), 26.0);
      float purple = pow(max(dot(r, normalize(vec3(-0.15, -0.4, -0.9))), 0.0), 7.0);
      float band = pow(1.0 - abs(r.y * 0.7 + r.x * 0.4), 18.0);
      return vec3(0.014, 0.009, 0.025)
        + vec3(0.90, 0.77, 1.14) * upper * 1.45
        + vec3(1.00, 0.98, 1.20) * strip * 2.6
        + vec3(0.29, 0.065, 0.90) * purple * 1.15
        + vec3(0.26, 0.18, 0.58) * band * 0.6;
    }
    float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    vec3 tonemap(vec3 c) {
      return pow(clamp((c * (2.51 * c + 0.03)) / (c * (2.43 * c + 0.59) + 0.14), 0.0, 1.0), vec3(0.454545));
    }
    void main() {
      vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution) / min(uResolution.x, uResolution.y);
      uv.y -= 0.012;
      vec3 ro = vec3(0.0, 0.0, 6.10);
      vec3 rd = normalize(vec3(uv, -1.68));
      vec3 color = vec3(0.00135, 0.00125, 0.0036);
      color += vec3(0.006, 0.0018, 0.015) * exp(-dot(uv, uv) * 8.0);

      vec2 grid = uv * 135.0;
      float seed = hash(floor(grid));
      vec2 star = fract(grid) - vec2(hash(floor(grid) + 3.0), hash(floor(grid) + 7.0));
      float dust = pow(max(0.0, 1.0 - length(star) * 2.2), 17.0) * step(0.993, seed);
      color += vec3(0.38, 0.32, 0.54) * dust * (0.70 + 0.30 * sin(uTime * 0.5 + seed * 80.0));

      float travel = 2.6;
      float nearest = 2.0;
      bool hit = false;
      for (int i = 0; i < 96; i++) {
        float d = shape(ro + rd * travel);
        nearest = min(nearest, abs(d));
        if (d < 0.0017) { hit = true; break; }
        travel += max(d, 0.002);
        if (travel > 8.0) break;
      }
      if (hit) {
        vec3 p = ro + rd * travel;
        vec3 n = normalAt(p);
        vec3 reflection = reflect(rd, n);
        float facing = max(dot(n, -rd), 0.0);
        float rim = pow(1.0 - facing, 3.0);
        float ao = occlusion(p, n);
        vec3 surface = environment(reflection);
        vec3 light = normalize(vec3(-0.7, 1.0, 1.4));
        float diffuse = max(dot(n, light), 0.0);
        float specular = pow(max(dot(reflect(-light, n), -rd), 0.0), 90.0);
        float sheen = 0.5 + 0.5 * sin(localPoint(p).z * 2.4 + 0.7);
        vec3 tint = mix(vec3(0.72, 0.63, 0.97), vec3(0.53, 0.34, 0.86), sheen * 0.48);
        color = surface * tint * ao * (0.7 + 0.45 * rim);
        color += vec3(0.10, 0.055, 0.17) * diffuse * ao;
        color += vec3(1.10, 1.00, 1.30) * specular;
        color += vec3(0.30, 0.08, 0.75) * rim * 0.33;
        color += vec3(0.012, 0.006, 0.025);
      } else {
        color += vec3(0.014, 0.004, 0.04) * exp(-nearest * 22.0);
      }
      color = tonemap(color);
      color += (hash(gl_FragCoord.xy) - 0.5) / 255.0;
      gl_FragColor = hit ? vec4(color, 1.0) : vec4(0.0);
    }
  `;

  function announce(message) {
    if (status) status.textContent = message;
  }

  function fallback() {
    lost = true;
    cancelAnimationFrame(frame);
    frame = 0;
    canvas.classList.add('scene-unavailable');
    announce('3D 暂时不可用 · 仍可浏览完整主页');
  }

  function compile(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      const message = gl.getShaderInfoLog(shader);
      gl.deleteShader(shader);
      throw new Error(message || 'Could not compile the 3D scene');
    }
    return shader;
  }

  function setup() {
    try {
      gl = canvas.getContext('webgl', { alpha: true, antialias: false, depth: false, powerPreference: 'high-performance' });
      if (!gl) return fallback();
      const vertex = compile(gl.VERTEX_SHADER, vertexSource);
      const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
      program = gl.createProgram();
      gl.attachShader(program, vertex);
      gl.attachShader(program, fragment);
      gl.linkProgram(program);
      gl.deleteShader(vertex);
      gl.deleteShader(fragment);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
      gl.useProgram(program);
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
      const position = gl.getAttribLocation(program, 'aPosition');
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      uniforms = ['uResolution', 'uRotation', 'uTime', 'uMode'].map(name => gl.getUniformLocation(program, name));
      lost = false;
      canvas.classList.remove('scene-unavailable');
      announce(reduceMotion.matches ? '3D 已就绪 · 拖动探索' : '实时 3D · 拖动探索');
      requestDraw();
    } catch (error) {
      console.warn('SherlockMen 3D scene:', error.message);
      fallback();
    }
  }

  function canDraw() { return !lost && visible && !document.hidden && gl && uniforms; }
  function animated() { return !paused && !reduceMotion.matches; }

  function requestDraw() {
    if (!frame && canDraw()) frame = requestAnimationFrame(draw);
  }

  function draw(timestamp) {
    frame = 0;
    if (!canDraw()) { previous = 0; return; }
    const delta = previous ? Math.min((timestamp - previous) / 1000, 0.05) : 0;
    previous = timestamp;
    if (animated()) elapsed += delta;
    const smoothing = dragging || reduceMotion.matches ? 1 : 1 - Math.exp(-Math.max(delta, 0.016) * 8);
    hover[0] += (targetHover[0] - hover[0]) * smoothing;
    hover[1] += (targetHover[1] - hover[1]) * smoothing;
    const rect = canvas.getBoundingClientRect();
    if (rect.width < 1 || rect.height < 1) { previous = 0; return; }
    // Cap total pixels to keep raymarching smooth on large and Retina displays.
    const ratio = Math.min(window.devicePixelRatio || 1, 1.65, Math.sqrt(850000 / (rect.width * rect.height)));
    const width = Math.max(1, Math.round(rect.width * ratio));
    const height = Math.max(1, Math.round(rect.height * ratio));
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      gl.viewport(0, 0, width, height);
    }
    gl.uniform2f(uniforms[0], width, height);
    gl.uniform2f(uniforms[1], rotation[0] + hover[0], rotation[1] + hover[1]);
    gl.uniform1f(uniforms[2], elapsed);
    gl.uniform1f(uniforms[3], mode);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
    const settling = Math.abs(targetHover[0] - hover[0]) + Math.abs(targetHover[1] - hover[1]) > 0.0005;
    if (animated() || settling) requestDraw();
    else previous = 0;
  }

  window.SherlockScene = {
    setMode(name) {
      const next = { knot: 0, orbit: 1, crystal: 2 }[name];
      if (next === undefined) return;
      mode = next;
      requestDraw();
    },
    setPaused(value) {
      paused = Boolean(value);
      previous = 0;
      if (!lost) announce(paused ? '3D 已暂停 · 仍可拖动探索' : reduceMotion.matches ? '3D 已就绪 · 拖动探索' : '实时 3D · 拖动探索');
      requestDraw();
    },
    reset() {
      rotation[0] = rotation[1] = 0;
      hover[0] = hover[1] = targetHover[0] = targetHover[1] = 0;
      elapsed = 8.2;
      previous = 0;
      requestDraw();
    }
  };

  canvas.style.touchAction = 'pan-y';
  if (!canvas.hasAttribute('tabindex')) canvas.tabIndex = 0;
  if (!canvas.hasAttribute('aria-label')) canvas.setAttribute('aria-label', '可交互的三维雕塑。拖动或使用方向键旋转，Home 键复位。');
  canvas.addEventListener('pointerdown', event => {
    if (event.button !== 0 || lost) return;
    dragging = true;
    pointerId = event.pointerId;
    lastX = event.clientX;
    lastY = event.clientY;
    canvas.classList.add('is-dragging');
  });
  canvas.addEventListener('pointermove', event => {
    if (dragging && pointerId === event.pointerId) {
      rotation[0] += (event.clientX - lastX) * 0.008;
      rotation[1] = Math.max(-1.25, Math.min(1.25, rotation[1] + (event.clientY - lastY) * 0.008));
      lastX = event.clientX;
      lastY = event.clientY;
    } else if (event.pointerType === 'mouse' && !reduceMotion.matches) {
      const rect = canvas.getBoundingClientRect();
      targetHover[0] = ((event.clientX - rect.left) / rect.width - 0.5) * 0.24;
      targetHover[1] = ((event.clientY - rect.top) / rect.height - 0.5) * 0.16;
    }
    requestDraw();
  });
  function release(event) {
    if (event && pointerId !== event.pointerId) return;
    dragging = false;
    pointerId = null;
    canvas.classList.remove('is-dragging');
  }
  window.addEventListener('pointerup', release);
  window.addEventListener('pointercancel', release);
  canvas.addEventListener('pointerleave', () => {
    release();
    targetHover[0] = targetHover[1] = 0;
    requestDraw();
  });
  canvas.addEventListener('keydown', event => {
    if (event.key === 'Home') window.SherlockScene.reset();
    else if (event.key === 'ArrowLeft') rotation[0] -= 0.13;
    else if (event.key === 'ArrowRight') rotation[0] += 0.13;
    else if (event.key === 'ArrowUp') rotation[1] = Math.max(-1.25, rotation[1] - 0.13);
    else if (event.key === 'ArrowDown') rotation[1] = Math.min(1.25, rotation[1] + 0.13);
    else return;
    event.preventDefault();
    requestDraw();
  });

  document.addEventListener('visibilitychange', () => {
    previous = 0;
    if (document.hidden) { cancelAnimationFrame(frame); frame = 0; }
    else requestDraw();
  });
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(entries => {
      visible = entries[0].isIntersecting;
      previous = 0;
      if (!visible) { cancelAnimationFrame(frame); frame = 0; }
      else requestDraw();
    }, { threshold: 0.01 }).observe(canvas);
  }
  if ('ResizeObserver' in window) new ResizeObserver(requestDraw).observe(canvas);
  else window.addEventListener('resize', requestDraw);
  reduceMotion.addEventListener('change', () => {
    targetHover[0] = targetHover[1] = 0;
    previous = 0;
    requestDraw();
  });
  canvas.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    lost = true;
    cancelAnimationFrame(frame);
    frame = 0;
    announce('3D 正在恢复…');
  });
  canvas.addEventListener('webglcontextrestored', setup);
  setup();
})();
