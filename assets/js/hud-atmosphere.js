/* EYENEX NEURAL — lightweight 3D starfield + perspective telemetry grid.
   Decorative-only layer: no DOM changes to panels, no pointer capture, no network calls. */
(() => {
  'use strict';
  if (window.__eyenexAtmosphereInitialized) return;
  window.__eyenexAtmosphereInitialized = true;

  const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const canvas = document.createElement('canvas');
  canvas.className = 'hud-atmosphere-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  const overlay = document.createElement('div');
  overlay.className = 'hud-atmosphere-overlay';
  overlay.setAttribute('aria-hidden', 'true');
  document.body.prepend(overlay);
  document.body.prepend(canvas);

  const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true });
  if (!ctx) { canvas.remove(); overlay.remove(); return; }

  let width = 0, height = 0, dpr = 1, stars = [], raf = 0, last = 0;
  let pointerX = 0, pointerY = 0, targetX = 0, targetY = 0;
  let paused = document.hidden;
  const rand = (a, b) => a + Math.random() * (b - a);

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, window.innerWidth < 700 ? 1.25 : 1.6);
    width = Math.max(1, window.innerWidth);
    height = Math.max(1, window.innerHeight);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const count = Math.min(180, Math.max(54, Math.round(width * height / 9500)));
    stars = Array.from({ length: count }, () => ({
      x: rand(-width * .12, width * 1.12),
      y: rand(-height * .12, height * 1.12),
      z: rand(.15, 1),
      r: rand(.35, 1.35),
      phase: rand(0, Math.PI * 2),
      drift: rand(.06, .28)
    }));
    draw(performance.now(), true);
  }

  function drawGrid(t) {
    const horizon = height * .66;
    const vanishX = width * (.5 + pointerX * .035);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, horizon, width, height - horizon);
    ctx.clip();
    const pulse = .045 + (Math.sin(t * .00035) + 1) * .018;
    ctx.lineWidth = 1;
    for (let i = -12; i <= 12; i++) {
      ctx.beginPath();
      ctx.moveTo(vanishX + i * width * .055, horizon);
      ctx.lineTo(width / 2 + i * width * .17 + pointerX * 22, height + 8);
      ctx.strokeStyle = 'rgba(68, 190, 233,' + pulse + ')';
      ctx.stroke();
    }
    for (let i = 0; i < 10; i++) {
      const p = i / 9;
      const y = horizon + (height - horizon) * p * p;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.strokeStyle = 'rgba(70, 174, 218,' + (pulse * (1 - p * .35)) + ')';
      ctx.stroke();
    }
    const glow = ctx.createLinearGradient(0, horizon - 18, 0, horizon + 30);
    glow.addColorStop(0, 'rgba(33, 183, 238, 0)');
    glow.addColorStop(.5, 'rgba(33, 183, 238, .055)');
    glow.addColorStop(1, 'rgba(33, 183, 238, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, horizon - 18, width, 48);
    ctx.restore();
  }

  function draw(now, staticFrame = false) {
    if (!ctx || paused) return;
    const t = now || 0;
    const dt = last ? Math.min(40, t - last) : 16;
    last = t;
    pointerX += (targetX - pointerX) * .025;
    pointerY += (targetY - pointerY) * .025;
    ctx.clearRect(0, 0, width, height);

    // A distant volumetric nebula made from soft radial light, not a heavy image or WebGL dependency.
    const nebula = ctx.createRadialGradient(width * (.52 + pointerX * .04), height * (.40 + pointerY * .03), 0, width * .52, height * .42, Math.max(width, height) * .64);
    nebula.addColorStop(0, 'rgba(8, 80, 124, .075)');
    nebula.addColorStop(.45, 'rgba(10, 42, 86, .035)');
    nebula.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = nebula;
    ctx.fillRect(0, 0, width, height);

    for (const s of stars) {
      if (!staticFrame && !reduceMotion) {
        s.y -= s.drift * dt * .012 * (0.4 + s.z);
        s.x += Math.sin(t * .00018 + s.phase) * .025;
        if (s.y < -4) { s.y = height + 4; s.x = rand(0, width); }
      }
      const x = s.x + pointerX * s.z * 12;
      const y = s.y + pointerY * s.z * 8;
      const alpha = .12 + (Math.sin(t * .001 + s.phase) + 1) * .12 * s.z;
      ctx.beginPath();
      ctx.arc(x, y, s.r * (.5 + s.z), 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(132, 222, 255,' + alpha.toFixed(3) + ')';
      ctx.fill();
    }

    // Short-range connections form a restrained, spatial intelligence mesh.
    const maxDistance = Math.min(100, width * .075);
    for (let i = 0; i < stars.length; i++) {
      const a = stars[i];
      for (let j = i + 1; j < Math.min(stars.length, i + 7); j++) {
        const b = stars[j];
        const dx = (a.x - b.x) + pointerX * (a.z - b.z) * 12;
        const dy = (a.y - b.y) + pointerY * (a.z - b.z) * 8;
        const dist = Math.hypot(dx, dy);
        if (dist < maxDistance) {
          ctx.beginPath();
          ctx.moveTo(a.x + pointerX * a.z * 12, a.y + pointerY * a.z * 8);
          ctx.lineTo(b.x + pointerX * b.z * 12, b.y + pointerY * b.z * 8);
          ctx.strokeStyle = 'rgba(69, 182, 230,' + ((1 - dist / maxDistance) * .085).toFixed(3) + ')';
          ctx.lineWidth = .6;
          ctx.stroke();
        }
      }
    }

    drawGrid(t);
    if (!reduceMotion) raf = requestAnimationFrame(draw);
  }

  function wake() {
    paused = document.hidden;
    if (!paused && !reduceMotion && !raf) raf = requestAnimationFrame((t) => { raf = 0; draw(t); });
    else if (!paused && reduceMotion) draw(performance.now(), true);
  }
  window.addEventListener('resize', resize, { passive: true });
  window.addEventListener('pointermove', (e) => {
    targetX = (e.clientX / Math.max(1, width) - .5) * 2;
    targetY = (e.clientY / Math.max(1, height) - .5) * 2;
  }, { passive: true });
  document.addEventListener('visibilitychange', () => {
    paused = document.hidden;
    if (paused && raf) { cancelAnimationFrame(raf); raf = 0; }
    else wake();
  });
  resize();
  if (!reduceMotion) raf = requestAnimationFrame(draw);
})();
