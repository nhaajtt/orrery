// Canvas 2D orrery. Each public repo is a planet: orbit = recency, size = stars and repo size, color = language.

const TAU = Math.PI * 2;

import { hash01, langColor, ringFor, radiusFor } from '../lib/palette.js';

export { hash01, langColor };

export class Orrery {
  constructor(canvas, opts = {}) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d');
    this.opts = { interactive: false, reduced: false, center: [0.5, 0.5], scale: 0.44, maxPlanets: 28, ...opts };
    this.planets = [];
    this.t = 0;
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
    this.fg = cs.getPropertyValue('--fg').trim() || '#eef0ea';
    this.accent = cs.getPropertyValue('--accent').trim() || '#c8ff3d';
    this.dark = document.documentElement.dataset.theme !== 'light';
    this.core = this.dark ? this.accent : this.fg;
  }

  setData(repos) {
    const list = repos.slice(0, this.opts.maxPlanets);
    const n = list.length;
    this.planets = list.map((r, i) => {
      const ring = ringFor(i, n);
      return {
        repo: r,
        ring,
        phase: hash01(r.name) * TAU,
        speed: (0.5 / (0.5 + ring * 1.7)) * (0.55 + hash01(r.name + 'v') * 0.5),
        radius: radiusFor(r),
        color: langColor(r.lang),
        wx: 0,
        wy: 0,
      };
    });
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
      tilt: 0.56 + this.ptr.y * 0.08,
      R: Math.min(this.w, this.h) * this.opts.scale,
      zoom: 1 + this.cam.k * 1.7,
      spin: this.ptr.x * 0.35,
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
    for (const p of this.planets) this.place(p, geo);
    const f = this.planets[this.focus];
    if (f) {
      this.cam.x += (f.wx - this.cam.x) * (this.opts.reduced ? 1 : 0.12);
      this.cam.y += (f.wy - this.cam.y) * (this.opts.reduced ? 1 : 0.12);
    }
    const { ox, oy } = this.origin(geo);

    g.lineWidth = 1;
    g.strokeStyle = this.fg;
    this.planets.forEach((p, i) => {
      const rx = geo.R * p.ring * geo.zoom;
      g.globalAlpha = i === this.focus ? 0.34 : 0.1;
      g.beginPath();
      g.ellipse(ox, oy, rx, rx * geo.tilt, 0, 0, TAU);
      g.stroke();
    });
    g.globalAlpha = 1;

    const order = this.planets.map((_, i) => i).sort((a, b) => this.planets[a].wy - this.planets[b].wy);
    let sunDone = false;
    const drawSun = () => {
      const sr = Math.max(9, geo.R * 0.075) * geo.zoom;
      const grad = g.createRadialGradient(ox, oy, 0, ox, oy, sr * 4.2);
      grad.addColorStop(0, this.dark ? 'rgba(200,255,61,0.38)' : 'rgba(200,255,61,0.7)');
      grad.addColorStop(1, 'rgba(200,255,61,0)');
      g.fillStyle = grad;
      g.beginPath();
      g.arc(ox, oy, sr * 4.2, 0, TAU);
      g.fill();
      g.fillStyle = this.core;
      g.beginPath();
      g.arc(ox, oy, sr, 0, TAU);
      g.fill();
    };
    for (const i of order) {
      const p = this.planets[i];
      if (!sunDone && p.wy >= 0) {
        drawSun();
        sunDone = true;
      }
      const sx = ox + p.wx * geo.zoom;
      const sy = oy + p.wy * geo.zoom;
      const r = p.radius * (0.8 + geo.zoom * 0.2) * (1 + (p.wy / (geo.R + 1)) * 0.25);
      g.globalAlpha = p.repo.fork ? 0.55 : 1;
      const halo = g.createRadialGradient(sx, sy, 0, sx, sy, r * 3);
      halo.addColorStop(0, p.color + '55');
      halo.addColorStop(1, p.color + '00');
      g.fillStyle = halo;
      g.beginPath();
      g.arc(sx, sy, r * 3, 0, TAU);
      g.fill();
      g.fillStyle = p.color;
      g.beginPath();
      g.arc(sx, sy, r, 0, TAU);
      g.fill();
      g.globalAlpha = 1;
      if (i === this.focus || i === this.hover) {
        g.strokeStyle = this.fg;
        g.lineWidth = 1.5;
        g.beginPath();
        g.arc(sx, sy, r + 6, 0, TAU);
        g.stroke();
      }
    }
    if (!sunDone) drawSun();

    if (this.opts.interactive && this.mouse) this.hit(ox, oy, geo);
  }

  hit(ox, oy, geo) {
    let best = -1;
    let bestD = 22;
    this.planets.forEach((p, i) => {
      const d = Math.hypot(this.mouse.x - (ox + p.wx * geo.zoom), this.mouse.y - (oy + p.wy * geo.zoom)) - p.radius;
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
