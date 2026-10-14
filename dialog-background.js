// A decorative 2D field keeps the fullscreen explorer in the site's stellar world.
// It renders only while the dialog is visible, and stays still for reduced motion.
export function createDialogStarfield(dialog,reduced) {
  const canvas = document.createElement('canvas');
  canvas.className = 'portfolio-stellar-backdrop';
  canvas.setAttribute('aria-hidden','true');
  dialog.prepend(canvas);
  const context = canvas.getContext('2d',{alpha:true});
  if (!context) return {sync() {}};
  const palette = ['#b9e5ff','#6ab9e9','#f3a967'];
  const sprites = palette.map(color => {
    const sprite = document.createElement('canvas');
    sprite.width = sprite.height = 48;
    const paint = sprite.getContext('2d');
    const halo = paint.createRadialGradient(24,24,0,24,24,22);
    halo.addColorStop(0,`${color}e6`);
    halo.addColorStop(.08,`${color}80`);
    halo.addColorStop(.35,`${color}22`);
    halo.addColorStop(1,`${color}00`);
    paint.fillStyle = halo;
    paint.fillRect(0,0,48,48);
    paint.strokeStyle = `${color}9c`;
    paint.lineWidth = .65;
    paint.beginPath();
    paint.moveTo(24,9); paint.lineTo(24,39);
    paint.moveTo(13,24); paint.lineTo(35,24);
    paint.stroke();
    return sprite;
  });
  let width = 0, height = 0, frame = 0, previous = 0, elapsed = 0, stars = [];
  let active = false;
  function resize() {
    if (!dialog.open) return;
    const nextWidth = dialog.clientWidth;
    const nextHeight = dialog.clientHeight;
    if (!nextWidth || !nextHeight || (nextWidth === width && nextHeight === height)) return;
    width = nextWidth; height = nextHeight;
    const ratio = Math.min(devicePixelRatio || 1,1.5);
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio,0,0,ratio,0,0);
    let seed = 7919;
    const random = () => {seed = (seed * 16807) % 2147483647; return seed / 2147483647;};
    const count = Math.max(60,Math.min(190,Math.round(width * height / 6200)));
    stars = Array.from({length:count},(_,index) => {
      const x = random(), y = random();
      // Put the brighter sparks toward the margins, away from reading copy.
      const margin = x < .13 || x > .87;
      return {x,y,radius:.45 + random() * .8,phase:random() * Math.PI * 2,
        speed:.16 + random() * .2,drift:.3 + random() * 1.1,
        opacity:margin ? .42 + random() * .35 : .1 + random() * .22,
        color:Math.floor(random() * palette.length),spark:margin && index % 4 === 0};
    });
    draw();
  }
  function draw() {
    context.clearRect(0,0,width,height);
    for (const star of stars) {
      const time = reduced.matches ? 0 : elapsed;
      const shimmer = .7 + .3 * Math.sin(time * star.speed + star.phase);
      const x = star.x * width + Math.sin(time * .11 + star.phase) * star.drift;
      const y = star.y * height + Math.cos(time * .09 + star.phase) * star.drift;
      context.globalAlpha = star.opacity * shimmer;
      if (star.spark) {
        const size = 18 + star.radius * 10;
        context.drawImage(sprites[star.color],x - size / 2,y - size / 2,size,size);
      } else {
        context.fillStyle = palette[star.color];
        context.beginPath(); context.arc(x,y,star.radius,0,Math.PI * 2); context.fill();
      }
    }
    context.globalAlpha = 1;
  }
  function tick(now) {
    frame = 0;
    if (!active) return;
    // 24 fps is enough for slow ambient twinkle and avoids a second heavy render loop.
    if (!previous || now - previous >= 1000 / 24) {
      elapsed += previous ? Math.min((now - previous) / 1000,.1) : 0;
      previous = now;
      draw();
    }
    frame = requestAnimationFrame(tick);
  }
  function sync(suspended = false) {
    const visible = dialog.open && !document.hidden && !suspended;
    const running = visible && !reduced.matches;
    canvas.dataset.motion = running ? 'running' : visible ? 'still' : 'idle';
    if (visible) resize();
    if (running === active) {
      if (visible && !running) draw();
      return;
    }
    active = running;
    if (frame) cancelAnimationFrame(frame);
    frame = 0; previous = 0;
    if (active) frame = requestAnimationFrame(tick);
    else if (visible) draw();
  }
  const observer = new ResizeObserver(() => {resize();});
  observer.observe(dialog);
  return {sync};
}
