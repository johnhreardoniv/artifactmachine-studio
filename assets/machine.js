/**
 * The Machine. A particle flow that keeps nearly assembling into one of the
 * catalogue objects and dispersing the moment it becomes identifiable, with a
 * measurement layer that dimensions empty space and a HUD that reports on it.
 *
 * Canvas 2D, no dependencies. Pauses when the tab is hidden or the hero is off
 * screen; renders one still frame under prefers-reduced-motion.
 */
(() => {
  const hero = document.querySelector('.hero');
  const canvas = hero && hero.querySelector('canvas.machine');
  const overlay = hero && hero.querySelector('canvas.overlay');
  const stage = hero && hero.querySelector('.stage');
  if (!canvas || !overlay || !stage || !canvas.getContext) return;

  const ctx = canvas.getContext('2d');
  const octx = overlay.getContext('2d');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const css = getComputedStyle(document.documentElement);
  const rgb = (hex) => {
    const h = hex.trim().replace('#', '');
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(',');
  };
  const INK = rgb(css.getPropertyValue('--ink') || '#e9edf1');
  const SIGNAL = rgb(css.getPropertyValue('--signal') || '#7df0c2');
  const WARN = rgb(css.getPropertyValue('--warn') || '#f2b45a');

  // The catalogue drawings, in their shared 240 x 100 drawing space.
  const box = (x, y, w, h) => `M${x} ${y}h${w}v${h}h${-w}Z`;
  const SHAPES = [
    { id: '014', paths: ['M30 28H58V72H30Z', 'M44 34V66', 'M58 40H186L214 50L186 60H58', 'M68 40L76 60M82 40L90 60M96 40L104 60M110 40L118 60M124 40L132 60M138 40L146 60M152 40L160 60M166 40L174 60'], circles: [] },
    { id: '027', paths: [box(10, 44, 14, 12), box(24, 38, 30, 24), 'M54 50C90 10 120 90 150 50S190 20 196 50', box(196, 36, 26, 28), 'M222 40L234 44V56L222 60'], circles: [] },
    { id: '033', paths: [], circles: [[120, 50, 38], [120, 50, 29], [108, 42, 4], [132, 42, 4], [120, 62, 4]] },
    { id: '048', paths: ['M70 72L84 30H140L150 22H172V44L162 50L170 57L158 63L166 71L150 76Z', 'M84 30L96 22H124'], circles: [[104, 52, 7]] },
    { id: '052', paths: ['M60 18V82H192V68H74V18Z'], circles: [[67, 34, 3], [67, 54, 3], [110, 75, 3], [146, 75, 3], [178, 75, 3]] },
  ];

  /** Rasterise a shape's outline and return its lit pixels, centred on 0,0. */
  function sampleShape(shape) {
    const k = 3;
    const off = document.createElement('canvas');
    off.width = 240 * k;
    off.height = 100 * k;
    const o = off.getContext('2d');
    o.scale(k, k);
    o.lineWidth = 1.4;
    o.strokeStyle = '#fff';
    shape.paths.forEach((d) => o.stroke(new Path2D(d)));
    shape.circles.forEach(([cx, cy, r]) => { o.beginPath(); o.arc(cx, cy, r, 0, Math.PI * 2); o.stroke(); });
    const data = o.getImageData(0, 0, off.width, off.height).data;
    const pts = [];
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (let y = 0; y < off.height; y += 1) {
      for (let x = 0; x < off.width; x += 1) {
        if (data[(y * off.width + x) * 4 + 3] > 120) {
          const px = x / k, py = y / k;
          pts.push(px, py);
          if (px < minX) minX = px; if (px > maxX) maxX = px;
          if (py < minY) minY = py; if (py > maxY) maxY = py;
        }
      }
    }
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    for (let i = 0; i < pts.length; i += 2) { pts[i] -= cx; pts[i + 1] -= cy; }
    return { pts, w: maxX - minX, h: maxY - minY };
  }
  const samples = SHAPES.map(sampleShape);

  // ---- state ----
  let W = 0, H = 0, dpr = 1, N = 0;
  let px, py, vx, vy, tx, ty, seed;
  let cx = 0, cy = 0, S = 1;           // stage centre and shape scale
  let shapeIdx = Math.floor(Math.random() * SHAPES.length);
  let phase = 'drift', phaseStart = 0, A = 0;
  const DUR = { drift: 7000, assemble: 5200, near: 1800, disperse: 1500 };

  const cross = { x: 0, y: 0, tx: 0, ty: 0, next: 0 };
  const dim = { x1: 0, x2: 0, y: 0, born: 0, life: 4200 };

  function resize() {
    const r = hero.getBoundingClientRect();
    const s = stage.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = Math.max(1, Math.round(r.width));
    H = Math.max(1, Math.round(r.height));
    for (const [c, k] of [[canvas, ctx], [overlay, octx]]) {
      c.width = W * dpr;
      c.height = H * dpr;
      k.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    const narrow = window.innerWidth <= 980;
    cx = s.left - r.left + s.width / 2;
    cy = s.top - r.top + (narrow ? 96 : s.height * 0.42);
    S = Math.min((s.width * 0.86) / 240, (s.height * 0.62) / 100, 3.2);

    const want = Math.round(Math.min(6500, Math.max(1800, (W * H) / 210)));
    if (want !== N) {
      N = want;
      px = new Float32Array(N); py = new Float32Array(N);
      vx = new Float32Array(N); vy = new Float32Array(N);
      tx = new Float32Array(N); ty = new Float32Array(N);
      seed = new Float32Array(N);
      for (let i = 0; i < N; i += 1) {
        px[i] = Math.random() * W; py[i] = Math.random() * H;
        seed[i] = Math.random();
      }
      assignTargets();
    }
    cross.x = cross.tx = cx; cross.y = cross.ty = cy;
  }

  function assignTargets() {
    const { pts } = samples[shapeIdx];
    const n = pts.length / 2;
    for (let i = 0; i < N; i += 1) {
      const j = Math.floor(Math.random() * n) * 2;
      tx[i] = pts[j] + (Math.random() - 0.5) * 2.2;
      ty[i] = pts[j + 1] + (Math.random() - 0.5) * 2.2;
    }
  }

  function setPhase(p, now) {
    phase = p;
    phaseStart = now;
    if (p === 'assemble') assignTargets();
    if (p === 'disperse') {
      for (let i = 0; i < N; i += 1) {
        const dx = px[i] - cx, dy = py[i] - cy;
        const d = Math.hypot(dx, dy) || 1;
        const kick = 1.2 + Math.random() * 2.6;
        vx[i] += (dx / d) * kick; vy[i] += (dy / d) * kick;
      }
      run += 1;
    }
    if (p === 'drift') shapeIdx = (shapeIdx + 1 + Math.floor(Math.random() * (SHAPES.length - 1))) % SHAPES.length;
  }

  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  function step(now) {
    const el = now - phaseStart;
    if (el > DUR[phase]) {
      setPhase({ drift: 'assemble', assemble: 'near', near: 'disperse', disperse: 'drift' }[phase], now);
    }
    const p = Math.min(1, (now - phaseStart) / DUR[phase]);
    A = phase === 'assemble' ? 0.9 * ease(p) : phase === 'near' ? 0.9 : 0;

    const t = now;
    const jitter = phase === 'near' ? 0.35 : 0.08;
    for (let i = 0; i < N; i += 1) {
      const x = px[i], y = py[i];
      const ang = (Math.sin(x * 0.0021 + t * 0.00031) + Math.sin(y * 0.0026 - t * 0.00023) + Math.sin((x - y) * 0.0012 + t * 0.00017)) * 1.25;
      let ax = Math.cos(ang) * 0.035, ay = Math.sin(ang) * 0.035;
      const free = seed[i] > 0.74;
      const ai = free ? 0 : A * (0.8 + seed[i] * 0.27);
      let damp = 0.965;
      if (ai > 0) {
        const gx = cx + tx[i] * S - x, gy = cy + ty[i] * S - y;
        ax = ax * (1 - ai) + gx * 0.011 * ai + (Math.random() - 0.5) * jitter;
        ay = ay * (1 - ai) + gy * 0.011 * ai + (Math.random() - 0.5) * jitter;
        damp = 0.965 - 0.09 * ai;
      }
      vx[i] = vx[i] * damp + ax;
      vy[i] = vy[i] * damp + ay;
      let nx = x + vx[i], ny = y + vy[i];
      if (ai === 0) {
        if (nx < -20) nx = W + 20; else if (nx > W + 20) nx = -20;
        if (ny < -20) ny = H + 20; else if (ny > H + 20) ny = -20;
      }
      px[i] = nx; py[i] = ny;
    }
  }

  function draw(now) {
    // Particles leave fading trails, so the flow draws its own currents.
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = 'rgba(0,0,0,0.075)';
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'lighter';
    ctx.lineWidth = 1;
    ctx.strokeStyle = `rgba(${INK},0.13)`;
    ctx.beginPath();
    for (let i = 0; i < N; i += 1) {
      const x = px[i], y = py[i];
      ctx.moveTo(x, y);
      ctx.lineTo(x - vx[i] * 1.4 - 0.4, y - vy[i] * 1.4);
    }
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';

    // Measurement layer on its own canvas, redrawn clean every frame.
    octx.clearRect(0, 0, W, H);
    drawRuler();
    drawDimension(now);
    drawCrosshair(now);
  }

  function drawRuler() {
    octx.strokeStyle = `rgba(${INK},0.16)`;
    octx.fillStyle = `rgba(${INK},0.3)`;
    octx.font = '10px "IBM Plex Mono", ui-monospace, monospace';
    octx.beginPath();
    const y0 = H - 1;
    for (let x = 0; x < W; x += 8) {
      const major = x % 80 === 0;
      octx.moveTo(x + 0.5, y0);
      octx.lineTo(x + 0.5, y0 - (major ? 10 : 4));
      if (major && x > W * 0.5) octx.fillText(String(x), x + 3, y0 - 12);
    }
    octx.stroke();
  }

  function drawDimension(now) {
    if (now - dim.born > dim.life) {
      const span = 70 + Math.random() * 150;
      dim.x1 = cx - S * 120 + Math.random() * Math.max(10, S * 240 - span);
      dim.x2 = dim.x1 + span;
      dim.y = cy + (Math.random() < 0.5 ? -1 : 1) * (S * 50 + 34 + Math.random() * 40);
      dim.born = now;
    }
    const a = Math.min(1, (now - dim.born) / 400, (dim.born + dim.life - now) / 400);
    if (a <= 0) return;
    octx.strokeStyle = `rgba(${SIGNAL},${0.5 * a})`;
    octx.fillStyle = `rgba(${SIGNAL},${0.8 * a})`;
    octx.lineWidth = 1;
    octx.beginPath();
    octx.moveTo(dim.x1, dim.y); octx.lineTo(dim.x2, dim.y);
    octx.moveTo(dim.x1 + 0.5, dim.y - 6); octx.lineTo(dim.x1 + 0.5, dim.y + 6);
    octx.moveTo(dim.x2 + 0.5, dim.y - 6); octx.lineTo(dim.x2 + 0.5, dim.y + 6);
    octx.stroke();
    octx.font = '10px "IBM Plex Mono", ui-monospace, monospace';
    const label = `${((dim.x2 - dim.x1) * 0.0846).toFixed(2)} mm`;
    const w = octx.measureText(label).width;
    octx.fillText(label, (dim.x1 + dim.x2) / 2 - w / 2, dim.y - 8);
  }

  function drawCrosshair(now) {
    if (phase === 'near' || phase === 'assemble') {
      cross.tx = cx; cross.ty = cy;
    } else if (now > cross.next) {
      cross.tx = cx + (Math.random() - 0.5) * S * 220;
      cross.ty = cy + (Math.random() - 0.5) * S * 110;
      cross.next = now + 2400 + Math.random() * 1600;
    }
    cross.x += (cross.tx - cross.x) * 0.045;
    cross.y += (cross.ty - cross.y) * 0.045;
    const risk = phase === 'near';
    const col = risk ? WARN : SIGNAL;
    const { x, y } = cross;
    octx.strokeStyle = `rgba(${col},0.75)`;
    octx.lineWidth = 1;
    octx.beginPath();
    octx.arc(x, y, 9, 0, Math.PI * 2);
    octx.moveTo(x - 22, y); octx.lineTo(x - 13, y);
    octx.moveTo(x + 13, y); octx.lineTo(x + 22, y);
    octx.moveTo(x, y - 22); octx.lineTo(x, y - 13);
    octx.moveTo(x, y + 13); octx.lineTo(x, y + 22);
    octx.stroke();
    octx.fillStyle = `rgba(${col},0.85)`;
    octx.font = '10px "IBM Plex Mono", ui-monospace, monospace';
    const label = risk ? 'LOCK · IDENTIFICATION RISK' : phase === 'disperse' ? 'LOCK LOST' : `X ${x.toFixed(2)}  Y ${y.toFixed(2)}`;
    const lw = octx.measureText(label).width;
    const lx = x + 28 + lw > W - 8 ? x - 28 - lw : x + 28;
    octx.fillText(label, lx, y - 12);
  }

  // ---- HUD ----
  const $ = (id) => document.getElementById(id);
  const hud = { run: $('hud-run'), cand: $('hud-cand'), match: $('hud-match'), amb: $('hud-amb'), status: $('hud-status') };
  let run = 18204377;
  let match = 4;
  let lastHud = 0;
  const fmt = (n) => n.toLocaleString('en-US');

  function updateHud(now) {
    if (!hud.run || now - lastHud < 140) return;
    lastHud = now;
    const p = Math.min(1, (now - phaseStart) / DUR[phase]);
    const id = SHAPES[shapeIdx].id;
    let target, cand, amb, status, risk = false;
    if (phase === 'drift') {
      target = 3 + Math.random() * 14; cand = 'AM-0··'; amb = 0.9968 + Math.random() * 0.0008; status = 'Searching';
    } else if (phase === 'assemble') {
      target = 8 + 89 * ease(p); cand = `AM-0${Math.floor(Math.random() * 90 + 10)}`; amb = 0.9971 - 0.6 * ease(p); status = 'Forming';
    } else if (phase === 'near') {
      target = 96.6 + Math.random() * 1.8; cand = `AM-${id} (probable)`; amb = 0.0412 + Math.random() * 0.004; status = 'Identification risk'; risk = true;
    } else {
      target = 2 + Math.random() * 3; cand = 'Withdrawn'; amb = 0.9971; status = 'Dispersed · inconclusive';
    }
    match += (target - match) * 0.5;
    hud.run.textContent = `#${fmt(run)}`;
    hud.cand.textContent = cand;
    hud.match.textContent = `${match.toFixed(1)}%`;
    hud.amb.textContent = Math.max(0, amb).toFixed(4);
    hud.status.textContent = status;
    hud.status.classList.toggle('risk', risk);
  }

  // ---- loop ----
  let raf = 0, visible = true;
  function frame(now) {
    step(now);
    draw(now);
    updateHud(now);
    raf = requestAnimationFrame(frame);
  }
  function start() { if (!raf && visible && !document.hidden) raf = requestAnimationFrame(frame); }
  function stop() { cancelAnimationFrame(raf); raf = 0; }

  function stillFrame() {
    const now = performance.now();
    phase = 'near'; phaseStart = now; A = 0.9;
    assignTargets();
    for (let k = 0; k < 260; k += 1) step(now);
    ctx.clearRect(0, 0, W, H);
    for (let k = 0; k < 40; k += 1) { step(now); draw(now); }
    match = 97.1;
    lastHud = 0;
    updateHud(now + 1000);
  }

  resize();
  if (reduce) {
    stillFrame();
    window.addEventListener('resize', () => { resize(); stillFrame(); });
    return;
  }

  phaseStart = performance.now();
  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(resize, 120);
  });
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      if (visible) start(); else stop();
    }).observe(hero);
  }
  start();
})();
