/**
 * Live panel viewer. Unit AM-001 (The Key), extruded into a wireframe and
 * rotated under a scan line, with dimension callouts and an attempt counter
 * that never produces a result.
 *
 * Canvas 2D, no dependencies. Pauses off screen; one still frame under
 * prefers-reduced-motion.
 */
(() => {
  const canvas = document.querySelector('canvas.key3d');
  if (!canvas || !canvas.getContext) return;
  const ctx = canvas.getContext('2d');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const css = getComputedStyle(document.documentElement);
  const rgb = (hex) => {
    const h = hex.trim().replace('#', '');
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)).join(',');
  };
  const INK = rgb(css.getPropertyValue('--ink') || '#e9edf1');
  const INK2 = rgb(css.getPropertyValue('--ink-2') || '#8e99a6');
  const SIGNAL = rgb(css.getPropertyValue('--signal') || '#7df0c2');

  // ---- model: the catalogue key, extruded ----
  const CX = 115, CY = 50, HALF_DEPTH = 6;
  const shaft = [[80, 44], [210, 44], [210, 56], [200, 56], [200, 70], [190, 70], [190, 60], [178, 60], [178, 74], [166, 74], [166, 60], [152, 60], [152, 68], [140, 68], [140, 56], [80, 56]];
  const ring = (r, n) => Array.from({ length: n }, (_, i) => [50 + r * Math.cos((i / n) * Math.PI * 2), 50 + r * Math.sin((i / n) * Math.PI * 2)]);
  const loops = [
    { pts: shaft, every: 1 },
    { pts: ring(30, 48), every: 4 },
    { pts: ring(9, 24), every: 4 },
  ];

  const verts = [];
  const edges = [];
  loops.forEach(({ pts, every }) => {
    const base = verts.length;
    const n = pts.length;
    pts.forEach(([x, y]) => verts.push([x - CX, y - CY, -HALF_DEPTH]));
    pts.forEach(([x, y]) => verts.push([x - CX, y - CY, HALF_DEPTH]));
    for (let i = 0; i < n; i += 1) {
      const j = (i + 1) % n;
      edges.push([base + i, base + j], [base + n + i, base + n + j]);
      if (i % every === 0) edges.push([base + i, base + n + i]);
    }
  });

  // Callouts: a model vertex tracked by a leader line to a fixed label slot
  // (fractions of the viewer), so labels never collide as the model turns.
  const outerStart = shaft.length * 2;
  const innerStart = outerStart + 48 * 2;
  const callouts = [
    [outerStart + 36, 'R 30.00', 0.14, 0.24],
    [innerStart + 6, 'Ø 18.00', 0.14, 0.72],
    [shaft.length + 1, 'L 130.00', 0.86, 0.24],
    [shaft.length + 12, 'BIT 4 · 14.00', 0.86, 0.72],
  ];

  // ---- readout ----
  const $ = (id) => document.getElementById(id);
  const out = { attempt: $('panel-attempt'), result: $('panel-result') };
  let attempt = 9331604;
  const fmt = (n) => n.toLocaleString('en-US');

  let W = 0, H = 0, dpr = 1, scale = 1;
  function resize() {
    const r = canvas.getBoundingClientRect();
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = Math.max(1, Math.round(r.width));
    H = Math.max(1, Math.round(r.height));
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    scale = Math.min(W / 250, H / 120) * (W < 520 ? 0.82 : 0.92);
  }

  function project(v, ry, rx) {
    const [x0, y0, z0] = v;
    const cy = Math.cos(ry), sy = Math.sin(ry);
    const x1 = x0 * cy + z0 * sy;
    const z1 = -x0 * sy + z0 * cy;
    const cx = Math.cos(rx), sx = Math.sin(rx);
    const y2 = y0 * cx - z1 * sx;
    const z2 = y0 * sx + z1 * cx;
    const f = 520 / (520 + z2 * 1.4);
    return [W / 2 + x1 * scale * f, H / 2 + y2 * scale * f];
  }

  const SWEEP = 3600, REST = 1100;
  let cycleStart = 0, lastAttempt = -1;

  function render(now) {
    const ry = reduce ? 0.62 : now * 0.00035;
    const rx = -0.42 + (reduce ? 0 : Math.sin(now * 0.00021) * 0.12);
    const P = verts.map((v) => project(v, ry, rx));

    ctx.clearRect(0, 0, W, H);

    // Wireframe
    ctx.lineWidth = 1;
    ctx.strokeStyle = `rgba(${INK},0.55)`;
    ctx.beginPath();
    edges.forEach(([a, b]) => { ctx.moveTo(P[a][0], P[a][1]); ctx.lineTo(P[b][0], P[b][1]); });
    ctx.stroke();

    // Scan line
    const c = (now - cycleStart) % (SWEEP + REST);
    const cycle = Math.floor((now - cycleStart) / (SWEEP + REST));
    const scanning = c < SWEEP;
    if (scanning) {
      const sy = H * 0.08 + (c / SWEEP) * H * 0.84;
      const grad = ctx.createLinearGradient(0, sy - 40, 0, sy);
      grad.addColorStop(0, `rgba(${SIGNAL},0)`);
      grad.addColorStop(1, `rgba(${SIGNAL},0.10)`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, sy - 40, W, 40);
      ctx.strokeStyle = `rgba(${SIGNAL},0.7)`;
      ctx.beginPath();
      ctx.moveTo(0, sy + 0.5);
      ctx.lineTo(W, sy + 0.5);
      ctx.stroke();
      ctx.fillStyle = `rgba(${SIGNAL},0.95)`;
      P.forEach(([x, y]) => { if (Math.abs(y - sy) < 5) ctx.fillRect(x - 1.5, y - 1.5, 3, 3); });
    }

    // Callouts
    ctx.font = '10px "IBM Plex Mono", ui-monospace, monospace';
    callouts.forEach(([vi, label, fx, fy]) => {
      const [x, y] = P[vi];
      const left = fx < 0.5;
      const w = ctx.measureText(label).width;
      const lx = left ? Math.max(W * fx, w + 18) : Math.min(W * fx, W - w - 18);
      const ly = H * fy;
      const elbow = left ? lx + 18 : lx - 18;
      ctx.strokeStyle = `rgba(${INK2},0.55)`;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(elbow, ly);
      ctx.lineTo(lx, ly);
      ctx.stroke();
      ctx.fillStyle = `rgba(${INK},0.9)`;
      ctx.fillRect(x - 2, y - 2, 4, 4);
      ctx.fillStyle = `rgba(${INK2},0.95)`;
      ctx.fillText(label, left ? lx - 6 - w : lx + 6, ly + 3);
    });

    // Readout: one attempt per sweep, never a result.
    if (out.attempt && cycle !== lastAttempt) {
      lastAttempt = cycle;
      if (!reduce) attempt += 1;
      out.attempt.textContent = `#${fmt(attempt)}`;
    }
    if (out.result) {
      const text = scanning && !reduce ? 'Analysing…' : 'Inconclusive';
      if (out.result.textContent !== text) out.result.textContent = text;
    }
  }

  resize();
  if (reduce) {
    render(0);
    window.addEventListener('resize', () => { resize(); render(0); });
    return;
  }

  let raf = 0, visible = false;
  const frame = (now) => { render(now); raf = requestAnimationFrame(frame); };
  const start = () => { if (!raf && visible && !document.hidden) raf = requestAnimationFrame(frame); };
  const stop = () => { cancelAnimationFrame(raf); raf = 0; };

  cycleStart = performance.now();
  let t = 0;
  window.addEventListener('resize', () => { clearTimeout(t); t = setTimeout(resize, 120); });
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) start(); else stop(); }).observe(canvas);
  } else {
    visible = true;
    start();
  }
})();
