/* AURA · generatywna wizualizacja „pole linii”
 *
 * Jeden silnik, 7 charakterów (parametry w js/profiles.js → visual).
 * - Canvas 2D skalowany pod devicePixelRatio (maks. 2).
 * - Jedna pętla requestAnimationFrame dla wszystkich instancji, zatrzymywana,
 *   gdy karta jest w tle lub canvas jest poza ekranem.
 * - Reaguje na dźwięk przez AuraAudio.levels(): rms → amplituda, low → puls,
 *   mid → falowanie, high → drżenie i jasność, kick → uderzenia/łuki.
 * - prefers-reduced-motion: statyczna klatka, przerysowywana tylko przy zmianie profilu.
 */
(function () {
  'use strict';

  /* ---------- szum simplex 3D (S. Gustavson, wersja skrócona) ---------- */
  const grad3 = [[1,1,0],[-1,1,0],[1,-1,0],[-1,-1,0],[1,0,1],[-1,0,1],[1,0,-1],[-1,0,-1],[0,1,1],[0,-1,1],[0,1,-1],[0,-1,-1]];
  const perm = new Uint8Array(512);
  (function () {
    const p = new Uint8Array(256);
    for (let i = 0; i < 256; i++) p[i] = i;
    let s = 1337;
    for (let i = 255; i > 0; i--) { s = (s * 16807) % 2147483647; const j = s % (i + 1); const t = p[i]; p[i] = p[j]; p[j] = t; }
    for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  })();
  function noise3(x, y, z) {
    const F3 = 1 / 3, G3 = 1 / 6;
    const s = (x + y + z) * F3;
    const i = Math.floor(x + s), j = Math.floor(y + s), k = Math.floor(z + s);
    const t = (i + j + k) * G3;
    const x0 = x - (i - t), y0 = y - (j - t), z0 = z - (k - t);
    let i1, j1, k1, i2, j2, k2;
    if (x0 >= y0) {
      if (y0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
      else if (x0 >= z0) { i1 = 1; j1 = 0; k1 = 0; i2 = 1; j2 = 0; k2 = 1; }
      else { i1 = 0; j1 = 0; k1 = 1; i2 = 1; j2 = 0; k2 = 1; }
    } else {
      if (y0 < z0) { i1 = 0; j1 = 0; k1 = 1; i2 = 0; j2 = 1; k2 = 1; }
      else if (x0 < z0) { i1 = 0; j1 = 1; k1 = 0; i2 = 0; j2 = 1; k2 = 1; }
      else { i1 = 0; j1 = 1; k1 = 0; i2 = 1; j2 = 1; k2 = 0; }
    }
    const x1 = x0 - i1 + G3, y1 = y0 - j1 + G3, z1 = z0 - k1 + G3;
    const x2 = x0 - i2 + 2 * G3, y2 = y0 - j2 + 2 * G3, z2 = z0 - k2 + 2 * G3;
    const x3 = x0 - 1 + 0.5, y3 = y0 - 1 + 0.5, z3 = z0 - 1 + 0.5;
    const ii = i & 255, jj = j & 255, kk = k & 255;
    let n = 0;
    const c = (tt, gi, a, b, d) => {
      if (tt < 0) return 0;
      const g = grad3[gi % 12]; tt *= tt;
      return tt * tt * (g[0] * a + g[1] * b + g[2] * d);
    };
    n += c(0.6 - x0 * x0 - y0 * y0 - z0 * z0, perm[ii + perm[jj + perm[kk]]], x0, y0, z0);
    n += c(0.6 - x1 * x1 - y1 * y1 - z1 * z1, perm[ii + i1 + perm[jj + j1 + perm[kk + k1]]], x1, y1, z1);
    n += c(0.6 - x2 * x2 - y2 * y2 - z2 * z2, perm[ii + i2 + perm[jj + j2 + perm[kk + k2]]], x2, y2, z2);
    n += c(0.6 - x3 * x3 - y3 * y3 - z3 * z3, perm[ii + 1 + perm[jj + 1 + perm[kk + 1]]], x3, y3, z3);
    return 32 * n;
  }

  /* ---------- ustawienia trybów ---------- */
  const MODES = {
    // hz – wysokość horyzontu (0–1), cx – środek łuku, lines – liczba linii
    hero:   { hz: 0.58, cx: 0.66, arc: 0.62, lines: 46, step: 9 },
    device: { hz: 0.56, cx: 0.5,  arc: 0.5,  lines: 26, step: 6 },
    player: { hz: 0.54, cx: 0.5,  arc: 0.48, lines: 56, step: 10 },
  };
  const ENERGY = { idle: 0.38, playing: 1, paused: 0.12, off: 0.05 };
  const WHITE = [237, 234, 228];
  const KEYS = ['speed', 'amp', 'freq', 'pulse', 'flutter', 'asym', 'grid', 'rings'];

  const RM = window.AURA.reducedMotion;
  const instances = [];
  let raf = 0, last = 0;

  function Visual(canvas, opts) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cfg = Object.assign({}, MODES[(opts && opts.mode) || 'hero'], opts || {});
    this.mode = 'idle';
    this.energy = ENERGY.idle;
    this.t = Math.random() * 40;
    this.visible = true;
    this.rings = [];
    this.lastRing = 0;
    this.settle = 0; // sekundy do końca przejścia (dla reduced motion)
    const p0 = window.AURA.profiles[0];
    this.cur = Object.assign({}, p0.visual, { rgb: window.AURA.hexToRgb(p0.accent) });
    this.tgt = Object.assign({}, this.cur);
    this.resize();
    if ('ResizeObserver' in window) new ResizeObserver(() => { this.resize(); this.settle = 0.1; loop(); }).observe(canvas);
    if ('IntersectionObserver' in window) {
      new IntersectionObserver((e) => { this.visible = e[0].isIntersecting; if (this.visible) loop(); }).observe(canvas);
    }
    instances.push(this);
    loop();
  }

  Visual.prototype.resize = function () {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const r = this.canvas.getBoundingClientRect();
    this.w = Math.max(1, r.width); this.h = Math.max(1, r.height);
    this.canvas.width = Math.round(this.w * dpr);
    this.canvas.height = Math.round(this.h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  Visual.prototype.setProfile = function (p, instant) {
    this.tgt = Object.assign({}, p.visual, { rgb: window.AURA.hexToRgb(p.accent) });
    if (instant) this.cur = Object.assign({}, this.tgt, { rgb: this.tgt.rgb.slice() });
    this.settle = 1.8;
    loop();
  };

  Visual.prototype.setMode = function (m) {
    this.mode = m;
    this.settle = 1.8;
    loop();
  };

  Visual.prototype.step = function (dt) {
    const k = 1 - Math.exp(-dt / 0.4); // ~1,5 s do pełnego przejścia
    const c = this.cur, g = this.tgt;
    KEYS.forEach((key) => (c[key] += (g[key] - c[key]) * k));
    for (let i = 0; i < 3; i++) c.rgb[i] += (g.rgb[i] - c.rgb[i]) * k;
    this.energy += ((ENERGY[this.mode] || 0.2) - this.energy) * (1 - Math.exp(-dt / 0.6));
    this.settle = Math.max(0, this.settle - dt);
  };

  Visual.prototype.draw = function (dt) {
    const reduced = RM.matches;
    this.step(reduced ? 0.05 : dt);
    const ctx = this.ctx, W = this.w, H = this.h, cfg = this.cfg, c = this.cur;
    const lv = reduced ? { rms: 0, low: 0, mid: 0, high: 0, kick: 0 } : window.AuraAudio.levels();
    const E = reduced ? 0.45 : this.energy;
    const live = Math.min(1, E); // w pauzie reakcja na dźwięk gaśnie
    if (!reduced) this.t += dt * c.speed * (0.15 + 0.85 * E) * (1 + lv.mid * 0.6);
    const t = reduced ? 12.3 : this.t;
    const [r, g, b] = c.rgb.map(Math.round);

    ctx.clearRect(0, 0, W, H);
    // Wysoki hero na telefonie: horyzont w pierwszym ekranie, nie pod panelem statusu
    const hzY = cfg.mode === 'hero' && H > window.innerHeight * 1.1 ? window.innerHeight * 0.6 : H * cfg.hz;
    const cx = W * cfg.cx;

    // Poświata za horyzontem
    const glowR = Math.max(W, H) * 0.7;
    const glow = ctx.createRadialGradient(cx, hzY, 0, cx, hzY, glowR);
    glow.addColorStop(0, 'rgba(' + r + ',' + g + ',' + b + ',' + (0.05 + 0.1 * lv.rms * live + 0.04 * E) + ')');
    glow.addColorStop(1, 'rgba(' + r + ',' + g + ',' + b + ',0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // Łuk horyzontu (motyw z identyfikacji AURA)
    const R = Math.min(W * 0.75, H * 1.1) * cfg.arc * (1 + lv.low * 0.025 * c.pulse * live);
    const acy = hzY + R * 0.42;
    const a0 = Math.PI + Math.asin(Math.min(1, (R * 0.42) / R)), a1 = 2 * Math.PI - (a0 - Math.PI);
    const cap = ctx.createLinearGradient(0, acy - R, 0, hzY);
    cap.addColorStop(0, 'rgba(' + r + ',' + g + ',' + b + ',' + (0.07 + 0.08 * E) + ')');
    cap.addColorStop(1, 'rgba(11,11,12,0)');
    ctx.beginPath(); ctx.arc(cx, acy, R, a0, a1); ctx.closePath();
    ctx.fillStyle = cap; ctx.fill();
    const rimA = 0.25 + 0.35 * E + 0.4 * lv.rms * live;
    [[22, 0.025], [8, 0.07], [1.2, 1]].forEach(([lw, am]) => {
      ctx.beginPath(); ctx.arc(cx, acy, R, a0 + 0.02, a1 - 0.02);
      ctx.lineWidth = lw;
      ctx.strokeStyle = 'rgba(' + mix(r, 237, 0.4) + ',' + mix(g, 234, 0.4) + ',' + mix(b, 228, 0.4) + ',' + Math.min(0.9, rimA * am) + ')';
      ctx.stroke();
    });

    // Pulsujące łuki (deephouse)
    if (c.rings > 0.02) this.drawRings(ctx, cx, hzY, W, H, lv, E, [r, g, b], dt, reduced);

    // Siatka perspektywy (synthwave)
    if (c.grid > 0.02) {
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + (0.16 * c.grid * (0.5 + 0.5 * E)) + ')';
      ctx.beginPath();
      for (let k = -14; k <= 14; k++) {
        ctx.moveTo(cx + k * W * 0.012, hzY);
        ctx.lineTo(cx + k * W * 0.16, H * 1.05);
      }
      ctx.stroke();
    }

    // Pole linii
    const N = cfg.lines;
    const step = Math.max(cfg.step, W / 170);
    const ampBase = H * 0.075 * c.amp * (0.35 + E * (0.35 + lv.rms * 1.3 * live + lv.low * 0.6 * c.pulse * live));
    const scroll = c.grid * ((t * 0.9) % 1);
    for (let i = 0; i < N; i++) {
      const d = Math.min(1, (i + scroll) / (N - 1));
      const y0 = hzY + (H * 1.06 - hzY) * Math.pow(d, 1.75);
      const sc = 0.2 + d * 1.15;
      const center = 0.5 + c.asym * 0.2 * Math.sin(t * 0.13 + i * 0.07);
      const kickLift = c.pulse * lv.kick * live * H * 0.035 * Math.exp(-d * 2.2);
      const white = 0.15 + 0.45 * d;
      const alpha = Math.min(0.9, (0.08 + 0.62 * Math.pow(d, 0.8)) * (0.5 + 0.5 * E) * (1 + lv.high * 0.5 * live) * fadeEdge(d));
      ctx.beginPath();
      for (let x = -step; x <= W + step; x += step) {
        const nx = x / W;
        const dx = (nx - center) * 2;
        const env = Math.max(0, 1 - dx * dx * (0.55 - c.asym * 0.15));
        let n = noise3(nx * c.freq * 2.6, d * 2.2 - t * 0.12, t * 0.22);
        if (c.asym > 0.05) n += c.asym * 0.5 * noise3(nx * c.freq * 6 + 9, d * 4, t * 0.4);
        let y = y0 - (n * ampBase * sc + kickLift) * env;
        if (c.flutter > 0.02) y += Math.sin(x * 0.09 + t * 30 + i) * c.flutter * (0.4 + lv.high * 2.2 * live) * sc;
        x <= -step ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.lineWidth = d < 0.3 ? 0.8 : 1;
      ctx.strokeStyle = 'rgba(' + mix(r, WHITE[0], white) + ',' + mix(g, WHITE[1], white) + ',' + mix(b, WHITE[2], white) + ',' + alpha + ')';
      ctx.stroke();
    }

    // Ziarno (lo-fi)
    if (c.flutter > 0.05 && !reduced) {
      ctx.fillStyle = 'rgba(237,234,228,' + (0.1 * c.flutter * (0.4 + E)) + ')';
      const count = Math.round((W * H) / 9000 * c.flutter);
      for (let i = 0; i < count; i++) ctx.fillRect(Math.random() * W, Math.random() * H, 1, 1);
    }

    return !reduced || this.settle > 0;
  };

  Visual.prototype.drawRings = function (ctx, cx, hzY, W, H, lv, E, rgb, dt, reduced) {
    const c = this.cur;
    const now = this.t;
    if (!reduced) {
      if (this.rings.length && this.rings[0].p != null) this.rings = [];
      const beat = this.mode === 'playing' ? lv.kick > 0.45 : (now - this.lastRing > 2.2 / Math.max(0.2, c.speed));
      if (beat && now - this.lastRing > 0.18) { this.rings.push({ born: now }); this.lastRing = now; }
    } else if (!this.rings.length) {
      this.rings = [0.15, 0.35, 0.6, 0.85].map((p) => ({ p }));
    }
    const life = 1.6;
    this.rings = this.rings.filter((ring) => ring.p != null || now - ring.born < life);
    ctx.lineWidth = 1;
    this.rings.forEach((ring) => {
      const p = ring.p != null ? ring.p : (now - ring.born) / life;
      const rx = W * (0.08 + p * 0.7);
      ctx.beginPath();
      ctx.ellipse(cx, hzY, rx, rx * 0.22, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(' + rgb[0] + ',' + rgb[1] + ',' + rgb[2] + ',' + (0.35 * (1 - p) * c.rings * (0.4 + 0.6 * E)) + ')';
      ctx.stroke();
    });
  };

  function mix(a, b, t) { return Math.round(a + (b - a) * t); }
  function fadeEdge(d) { return d < 0.06 ? d / 0.06 : 1; }

  /* ---------- pętla ---------- */
  function frame(ts) {
    raf = 0;
    const dt = Math.min(0.05, Math.max(0.001, (ts - last) / 1000));
    last = ts;
    let busy = false;
    instances.forEach((v) => { if (v.visible && v.w > 1) busy = v.draw(dt) || busy; });
    if (busy && !document.hidden) raf = requestAnimationFrame(frame);
  }
  function loop() {
    if (raf || document.hidden) return;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { cancelAnimationFrame(raf); raf = 0; } else loop();
  });
  if (RM.addEventListener) RM.addEventListener('change', () => { instances.forEach((v) => (v.settle = 0.2)); loop(); });

  window.AuraVisual = {
    create: (canvas, opts) => new Visual(canvas, opts),
    all: instances,
  };
})();
