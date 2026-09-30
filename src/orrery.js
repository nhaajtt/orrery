// Canvas 2D orrery drawn as a technical drawing: thin orbit lines, a protractor scale,
// language fill symbols, callouts and a dimension line for the focused repository.

import { hash01, symbolFor, ringFor, radiusFor, drawSymbol } from '../lib/palette.js';

export { hash01 };

const TAU = Math.PI * 2;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
const FONT = "'Sofia Sans', 'Helvetica Neue', Arial, sans-serif";

export class Orrery {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d');
    this.opts = {
      interactive: false,
      reduced: false,
      center: [0.5, 0.5],
      scale: 0.44,
      maxPlanets: 28,
      callouts: 0,
      callMinX: 0,
      dimLabel: null,
      ...opts,
    };
    this.planets = [];
    this.t = 0;
    this.intro = 1;
    this.last = 0;
    this.visible = false;
    this.raf = 0;
    this.focus = -1;
    this.hover = -1;
    this.cam = { x: 0, y: 0, k: 0, kTarget: 0 };
    this.ptr = { x: 0, y: 0, tx: 0, ty: 0 };
    this.mouse = null;
    this.w = 0;
    this.h = 0;
    this.dpr = 1;
    this.onHover = opts.onHover || null;
    this.refreshTheme();

    this.ro = new ResizeObserver(() => this.resize());
    this.ro.observe(canvas);
    this.io = new IntersectionObserver(([e]) => {
      this.visible = e.isIntersecting;
      if (this.visible) this.start();
    });
    this.io.observe(canvas);

    if (this.opts.interactive) {
      this._move = (e) => {
        const r = canvas.getBoundingClientRect();
        this.mouse = { x: e.clientX - r.left, y: e.clientY - r.top };
        if (this.opts.reduced) this.draw();
      };
      this._leave = () => {
        this.mouse = null;
        this.setHover(-1);
      };
      canvas.addEventListener('pointermove', this._move);
      canvas.addEventListener('pointerleave', this._leave);
    }
    this._theme = () => {
      this.refreshTheme();
      if (this.opts.reduced) this.draw();
    };
    window.addEventListener('themechange', this._theme);
    this._vis = () => (document.hidden ? this.stop() : this.start());
    document.addEventListener('visibilitychange', this._vis);
  }

  refreshTheme() {
    const cs = getComputedStyle(document.documentElement);
    const v = (n, d) => cs.getPropertyValue(n).trim() || d;
    this.ink = v('--ink', '#eaf1ff');
    this.paper = v('--paper', '#0d2f6b');
    this.sun = v('--sun', '#f2d16b');
  }

  setData(repos) {
    const list = repos.slice(0, this.opts.maxPlanets);
    const n = list.length;
    this.planets = list.map((r, i) => ({
      repo: r,
      ring: ringFor(i, n),
      phase: hash01(r.name) * TAU,
      speed: (0.4 / (0.5 + ringFor(i, n) * 1.7)) * (0.55 + hash01(`${r.name}v`) * 0.5),
      radius: radiusFor(r, 6, 17),
      symbol: symbolFor(r.lang),
      wx: 0,
      wy: 0,
    }));
    this.focus = -1;
    this.cam.kTarget = 0;
    this.setHover(-1);
    if (this.opts.reduced) this.draw();
  }

  setFocus(i) {
    this.focus = i;
    this.cam.kTarget = i >= 0 ? 1 : 0;
    if (this.opts.reduced) {
      this.cam.k = this.cam.kTarget;
      this.draw();
    }
  }

  setPointer(nx, ny) {
    this.ptr.tx = nx;
    this.ptr.ty = ny;
  }

  setHover(i) {
    if (i === this.hover) return;
    this.hover = i;
    if (this.onHover) this.onHover(i, i >= 0 ? this.screenPos(i) : null);
  }

  resize() {
    const r = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = Math.max(1, Math.round(r.width));
    this.h = Math.max(1, Math.round(r.height));
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.draw();
  }

  start() {
    if (this.opts.reduced || this.raf || !this.visible || document.hidden) return;
    this.last = performance.now();
    const loop = (now) => {
      this.raf = 0;
      if (!this.visible || document.hidden) return;
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.t += dt;
      this.draw();
      this.raf = requestAnimationFrame(loop);
    };
    this.raf = requestAnimationFrame(loop);
  }

  stop() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  geometry() {
    return {
      tilt: 0.5 + this.ptr.y * 0.05,
      R: Math.min(this.w, this.h * 1.7) * this.opts.scale,
      zoom: 1 + this.cam.k * 1.7,
      spin: this.ptr.x * 0.25,
    };
  }

  place(p, geo) {
    const a = p.phase + this.t * p.speed + geo.spin;
    p.wx = Math.cos(a) * geo.R * p.ring;
    p.wy = Math.sin(a) * geo.R * p.ring * geo.tilt;
  }

  origin(geo) {
    return {
      ox: this.w * this.opts.center[0] - this.cam.x * this.cam.k * geo.zoom,
      oy: this.h * this.opts.center[1] - this.cam.y * this.cam.k * geo.zoom,
    };
  }

  screenPos(i) {
    const p = this.planets[i];
    if (!p) return null;
    const geo = this.geometry();
    this.place(p, geo);
    const { ox, oy } = this.origin(geo);
    return { x: ox + p.wx * geo.zoom, y: oy + p.wy * geo.zoom };
  }

  draw() {
    const g = this.g;
    const { w, h } = this;
    g.clearRect(0, 0, w, h);
    this.ptr.x += (this.ptr.tx - this.ptr.x) * 0.06;
    this.ptr.y += (this.ptr.ty - this.ptr.y) * 0.06;
    this.cam.k += (this.cam.kTarget - this.cam.k) * (this.opts.reduced ? 1 : 0.07);

    const geo = this.geometry();
    const n = this.planets.length;
    for (const p of this.planets) this.place(p, geo);
    const f = this.planets[this.focus];
    if (f) {
      const s = this.opts.reduced ? 1 : 0.12;
      this.cam.x += (f.wx - this.cam.x) * s;
      this.cam.y += (f.wy - this.cam.y) * s;
    }
    const { ox, oy } = this.origin(geo);
    const ink = this.ink;

    // axes
    g.save();
    g.strokeStyle = ink;
    g.globalAlpha = 0.16 * this.intro;
    g.setLineDash([2, 5]);
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(0, oy);
    g.lineTo(w, oy);
    g.moveTo(ox, 0);
    g.lineTo(ox, h);
    g.stroke();
    g.restore();

    // rings, drawn in one after another during the intro
    const span = n + 2;
    g.lineWidth = 1;
    g.strokeStyle = ink;
    this.planets.forEach((p, i) => {
      const prog = clamp01(this.intro * span - i * 0.9);
      if (prog <= 0) return;
      const rx = geo.R * p.ring * geo.zoom;
      g.globalAlpha = i === this.focus ? 0.85 : 0.34;
      g.beginPath();
      g.ellipse(ox, oy, rx, rx * geo.tilt, 0, -Math.PI / 2, -Math.PI / 2 + TAU * prog);
      g.stroke();
    });

    // protractor scale on the outermost ring
    if (n) {
      const outer = (geo.R * this.planets[n - 1].ring + 16) * geo.zoom;
      g.globalAlpha = 0.5 * clamp01(this.intro * 1.4 - 0.2);
      g.beginPath();
      for (let d = 0; d < 360; d += 10) {
        const a = (d * Math.PI) / 180;
        const len = d % 30 === 0 ? 9 : 4.5;
        g.moveTo(ox + Math.cos(a) * outer, oy + Math.sin(a) * outer * geo.tilt);
        g.lineTo(ox + Math.cos(a) * (outer + len), oy + Math.sin(a) * (outer + len) * geo.tilt);
      }
      g.stroke();
    }
    g.globalAlpha = 1;

    // sun
    const drawSun = () => {
      const sr = Math.max(8, geo.R * 0.05) * geo.zoom;
      const pulse = 1 + Math.sin(this.t * 1.4) * 0.03;
      g.save();
      g.globalAlpha = this.intro;
      g.strokeStyle = this.sun;
      g.lineWidth = 1;
      g.setLineDash([2, 3]);
      g.beginPath();
      g.arc(ox, oy, sr * 3.1 * pulse, 0, TAU);
      g.stroke();
      g.setLineDash([]);
      g.beginPath();
      g.arc(ox, oy, sr * 2 * pulse, 0, TAU);
      g.stroke();
      g.fillStyle = this.sun;
      g.beginPath();
      g.arc(ox, oy, sr, 0, TAU);
      g.fill();
      g.restore();
    };

    const order = this.planets.map((_, i) => i).sort((a, b) => this.planets[a].wy - this.planets[b].wy);
    let sunDone = false;
    const pos = new Array(n);
    for (const i of order) {
      const p = this.planets[i];
      if (!sunDone && p.wy >= 0) {
        drawSun();
        sunDone = true;
      }
      const pop = clamp01(this.intro * span - i * 0.9 - 1.2);
      const sx = ox + p.wx * geo.zoom;
      const sy = oy + p.wy * geo.zoom;
      const r = p.radius * (0.85 + geo.zoom * 0.15) * pop;
      pos[i] = { sx, sy, r };
      if (r > 0.5) drawSymbol(g, p.symbol, sx, sy, r, ink, this.paper, p.repo.fork);
      if ((i === this.focus || i === this.hover) && r > 0.5) {
        g.save();
        g.strokeStyle = this.sun;
        g.lineWidth = 1.5;
        g.beginPath();
        g.arc(sx, sy, r + 5, 0, TAU);
        g.stroke();
        g.restore();
      }
    }
    if (!sunDone) drawSun();

    // callouts: leader line and repository name for the first few planets
    if (this.opts.callouts && this.intro > 0.9) {
      g.save();
      g.font = `600 13px ${FONT}`;
      g.textBaseline = 'middle';
      // the biggest planets that are currently clear of the headline
      const picks = this.planets
        .map((p, i) => i)
        .filter((i) => pos[i] && this.planets[i].ring > 0.55 && pos[i].sx > this.opts.callMinX + 30 && pos[i].sx < w - 150)
        .sort((a, b) => this.planets[b].radius - this.planets[a].radius)
        .slice(0, this.opts.callouts);
      for (const i of picks) {
        const { sx, sy, r } = pos[i];
        const dx = sx - ox;
        const dy = sy - oy;
        const len = Math.hypot(dx, dy) || 1;
        const ux = dx / len;
        const uy = dy / len;
        const x1 = sx + ux * (r + 3);
        const y1 = sy + uy * (r + 3);
        const x2 = x1 + ux * 22;
        const y2 = y1 + uy * 22;
        const right = ux >= 0;
        const x3 = x2 + (right ? 16 : -16);
        const label = this.planets[i].repo.name;
        const tw = g.measureText(label).width;
        g.strokeStyle = ink;
        g.globalAlpha = 0.7;
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(x1, y1);
        g.lineTo(x2, y2);
        g.lineTo(x3, y2);
        g.stroke();
        g.globalAlpha = 0.9;
        g.fillStyle = this.paper;
        g.fillRect(right ? x3 + 2 : x3 - tw - 10, y2 - 9, tw + 8, 18);
        g.globalAlpha = 1;
        g.fillStyle = ink;
        g.textAlign = right ? 'left' : 'right';
        g.fillText(label, x3 + (right ? 5 : -5), y2 - 1);
      }
      g.restore();
    }

    // dimension line from the sun to the focused planet
    if (f && this.cam.k > 0.6) {
      const { sx, sy } = pos[this.focus];
      const dx = sx - ox;
      const dy = sy - oy;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len;
      const ny = dx / len;
      g.save();
      g.strokeStyle = this.sun;
      g.fillStyle = this.sun;
      g.lineWidth = 1;
      g.globalAlpha = clamp01((this.cam.k - 0.6) * 2.5);
      g.beginPath();
      g.moveTo(ox, oy);
      g.lineTo(sx, sy);
      for (const [x, y] of [[ox, oy], [sx, sy]]) {
        g.moveTo(x + nx * 7, y + ny * 7);
        g.lineTo(x - nx * 7, y - ny * 7);
      }
      g.stroke();
      const label = this.opts.dimLabel ? this.opts.dimLabel(f) : '';
      if (label) {
        g.font = `600 13px ${FONT}`;
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        const mx = (ox + sx) / 2 + nx * 14;
        const my = (oy + sy) / 2 + ny * 14;
        const tw = g.measureText(label).width + 12;
        g.fillStyle = this.paper;
        g.globalAlpha *= 0.92;
        g.fillRect(mx - tw / 2, my - 10, tw, 20);
        g.globalAlpha = clamp01((this.cam.k - 0.6) * 2.5);
        g.fillStyle = this.sun;
        g.fillText(label, mx, my);
      }
      g.restore();
    }

    if (this.opts.interactive && this.mouse) this.hit(pos);
  }

  hit(pos) {
    let best = -1;
    let bestD = 22;
    pos.forEach((p, i) => {
      if (!p) return;
      const d = Math.hypot(this.mouse.x - p.sx, this.mouse.y - p.sy) - p.r;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    });
    this.setHover(best);
  }

  destroy() {
    this.stop();
    this.ro.disconnect();
    this.io.disconnect();
    window.removeEventListener('themechange', this._theme);
    document.removeEventListener('visibilitychange', this._vis);
    if (this._move) {
      this.canvas.removeEventListener('pointermove', this._move);
      this.canvas.removeEventListener('pointerleave', this._leave);
    }
  }
}
