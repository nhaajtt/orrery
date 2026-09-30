import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import './style.css';
import { fetchProfile, USER_RE } from './data.js';
import { Orrery } from './orrery.js';
import { SYMBOLS, symbolFor, svgDefs, svgSymbol } from '../lib/palette.js';

gsap.registerPlugin(ScrollTrigger);

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const desktopMQ = matchMedia('(min-width: 961px)');
const html = document.documentElement;

const DEFAULTS = { a: 'sindresorhus', b: 'torvalds' };
const state = { a: null, b: null, seq: 0, active: 0, top: [], pin: null };

/* ---------- helpers ---------- */
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const years = (iso) => (Date.now() - Date.parse(iso)) / (365.25 * 86400000);
function ago(iso) {
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86400000);
  if (days < 1) return 'today';
  if (days < 30) return `${days} d ago`;
  if (days < 365) return `${Math.floor(days / 30)} mo ago`;
  return `${Math.floor(days / 365)} y ago`;
}
const shortDate = (d) => new Date(`${d}T00:00:00Z`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const starsLabel = (...ps) => (ps.some((p) => p.stats.partial) ? 'Stars, 300 latest repos' : 'Stars earned');
const size = (kb) => (kb >= 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb} KB`);
const el = (tag, cls, text) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
};
function windowStats(p, from) {
  let events = 0, active = 0, streak = 0, run = 0;
  for (const d of p.days) {
    if (d.n === null || (from && d.d < from)) continue;
    events += d.n;
    run = d.n > 0 ? run + 1 : 0;
    if (d.n > 0) active++;
    streak = Math.max(streak, run);
  }
  return { events, active, streak };
}
const symbolSvg = (index, px = 22) => {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('width', px);
  s.setAttribute('height', px);
  s.setAttribute('viewBox', '0 0 22 22');
  s.setAttribute('aria-hidden', 'true');
  s.innerHTML = svgSymbol(index, 11, 11, 8.5, { ink: 'var(--ink)' });
  return s;
};

/* ---------- shared drawing defs (hatch patterns) ---------- */
$('[data-defs]').innerHTML = `<defs>${svgDefs('var(--ink)')}</defs>`;

/* ---------- smooth scroll (the only scroll engine) ---------- */
let lenis = null;
if (!reduced) {
  lenis = new Lenis({ lerp: 0.09, smoothWheel: true });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
}
const scrollToY = (y) => (lenis ? lenis.scrollTo(y, { duration: 1.4 }) : window.scrollTo({ top: y }));

$$('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const target = $(a.getAttribute('href'));
    if (!target) return;
    e.preventDefault();
    if (lenis) lenis.scrollTo(target, { duration: 1.4 });
    else target.scrollIntoView();
    history.replaceState(null, '', location.pathname + location.search);
  });
});

/* ---------- theme ---------- */
const themeBtn = $('[data-theme-toggle]');
function syncThemeUi() {
  const dark = html.dataset.theme !== 'light';
  $('[data-theme-label]').textContent = dark ? 'Light print' : 'Dark print';
  themeBtn.setAttribute('aria-label', dark ? 'Switch to the light print' : 'Switch to the dark print');
  $('meta[name="theme-color"]').setAttribute('content', dark ? '#0d2f6b' : '#f4f7fb');
}
themeBtn.addEventListener('click', () => {
  html.dataset.theme = html.dataset.theme === 'light' ? 'dark' : 'light';
  try {
    localStorage.setItem('orrery-theme', html.dataset.theme);
  } catch {}
  syncThemeUi();
  window.dispatchEvent(new Event('themechange'));
});
syncThemeUi();

/* ---------- canvases ---------- */
const heroOrrery = new Orrery($('[data-hero-canvas]'), { reduced, scale: 0.36, callouts: 3 });
const tip = $('[data-hover-tip]');
const systemOrrery = new Orrery($('[data-system-canvas]'), {
  reduced,
  interactive: true,
  scale: 0.36,
  dimLabel: (p) => `pushed ${ago(p.repo.pushed)}`,
  onHover: (i, pos) => {
    if (i < 0 || !pos) {
      tip.hidden = true;
      return;
    }
    tip.textContent = systemOrrery.planets[i].repo.name;
    tip.style.left = `${pos.x}px`;
    tip.style.top = `${pos.y}px`;
    tip.hidden = false;
  },
});
const duelA = new Orrery($('[data-duel-canvas="a"]'), { reduced, scale: 0.42, center: [0.5, 0.52] });
const duelB = new Orrery($('[data-duel-canvas="b"]'), { reduced, scale: 0.42, center: [0.5, 0.52] });

const placeHero = () => {
  const short = matchMedia('(max-height: 520px) and (orientation: landscape)').matches;
  heroOrrery.opts.center = short ? [0.8, 0.5] : desktopMQ.matches ? [0.72, 0.5] : [0.5, 0.3];
  // Callout labels only go where they do not run under the headline.
  heroOrrery.opts.callMinX = desktopMQ.matches && !short ? Math.min(760, innerWidth * 0.52) : 1e9;
};
placeHero();
const relayout = () => {
  placeHero();
  heroOrrery.resize();
};
desktopMQ.addEventListener('change', relayout);
addEventListener('resize', relayout);
if (!reduced) {
  window.addEventListener('pointermove', (e) => {
    const nx = (e.clientX / innerWidth - 0.5) * 2;
    const ny = (e.clientY / innerHeight - 0.5) * 2;
    heroOrrery.setPointer(nx, ny);
    duelA.setPointer(nx, ny);
    duelB.setPointer(nx, ny);
  });
}

/* ---------- status ---------- */
const statusEl = $('[data-status]');
const setStatus = (msg, tone = '') => {
  statusEl.textContent = msg;
  if (tone) statusEl.dataset.tone = tone;
  else delete statusEl.dataset.tone;
};
function errorText(err, login) {
  if (err.code === 'not_found') return `No public GitHub user named "${login}".`;
  if (err.code === 'rate_limited') {
    const when = err.reset ? ` Try again at ${new Date(err.reset * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.` : '';
    return `GitHub rate limit reached.${when}`;
  }
  if (err.code === 'network') return 'Could not reach GitHub. Check your connection.';
  return 'GitHub returned an unexpected error. Try again in a moment.';
}

/* ---------- rendering ---------- */
let scrollCtx = null;

function renderSystem(p) {
  const who = $('[data-who]');
  who.replaceChildren();
  const img = el('img');
  img.src = `${p.user.avatar}${p.user.avatar.includes('?') ? '&' : '?'}s=104`;
  img.alt = '';
  img.width = 52;
  img.height = 52;
  const text = el('div');
  text.append(el('p', 'who-name', p.user.name), el('p', 'who-meta', `@${p.user.login}, ${fmt(p.user.followers)} followers`));
  who.append(img, text);

  const own = p.repos.filter((r) => !r.fork);
  const pool = own.length ? own : p.repos;
  state.top = [...pool].sort((a, b) => b.stars - a.stars || new Date(b.pushed) - new Date(a.pushed)).slice(0, 6);
  // Every repo in the tour must exist as a planet, so add the tour repos to the most recent ones.
  const chosen = new Set(state.top.map((r) => r.name));
  const rest = p.repos.filter((r) => !chosen.has(r.name)).slice(0, 28 - state.top.length);
  systemOrrery.setData([...state.top, ...rest].sort((a, b) => new Date(b.pushed) - new Date(a.pushed)));
  const list = $('[data-repo-list]');
  list.replaceChildren();
  state.top.forEach((r, i) => {
    const li = el('li');
    const b = el('button', '', r.name);
    b.type = 'button';
    b.addEventListener('click', () => jumpTo(i));
    li.append(b);
    list.append(li);
  });
  if (state.top.length) setActive(0);
  else {
    $('[data-repo-name]').textContent = 'No public repositories yet';
    $('[data-repo-desc]').textContent = 'When this account publishes a repository it is drawn here as a planet.';
    $('[data-repo-facts]').replaceChildren();
  }
}

function setActive(i) {
  const r = state.top[i];
  if (!r) return;
  state.active = i;
  $$('[data-repo-list] button').forEach((b, k) => (k === i ? b.setAttribute('aria-current', 'true') : b.removeAttribute('aria-current')));
  $('[data-repo-name]').textContent = r.name;
  $('[data-repo-desc]').textContent = r.desc || 'No description.';
  const facts = $('[data-repo-facts]');
  facts.replaceChildren();
  const add = (k, v, sym) => {
    const d = el('div');
    const dd = el('dd');
    if (sym != null) dd.append(symbolSvg(sym, 20));
    dd.append(document.createTextNode(v));
    d.append(el('dt', '', k), dd);
    facts.append(d);
  };
  add('Language', r.lang || 'Not detected', symbolFor(r.lang));
  add('Stars', fmt(r.stars));
  add('Forks', fmt(r.forks));
  add('Last push', ago(r.pushed));
  add('Size', size(r.size));
  add('Kind', r.archived ? 'Archived' : r.fork ? 'Fork' : 'Own repo');
  systemOrrery.setFocus(systemOrrery.planets.findIndex((p) => p.repo.name === r.name));
}

function jumpTo(i) {
  if (state.pin) {
    const { start, end } = state.pin;
    scrollToY(start + ((i + 0.5) / state.top.length) * (end - start));
  } else setActive(i);
}

function renderSpectrum(p) {
  const band = $('[data-band]');
  const legend = $('[data-legend]');
  const lede = $('[data-spectrum-lede]');
  band.replaceChildren();
  legend.replaceChildren();
  const langs = p.stats.langs;
  if (!langs.length) {
    lede.textContent = `${p.user.login} has no public repositories with a detected language yet.`;
    band.style.display = 'none';
    return;
  }
  band.style.display = '';
  const top = langs[0];
  lede.textContent = `${p.user.login} leans on ${top.name}, about ${Math.round(top.share * 100)} percent. Each repo counts once by its main language, weighted by repo size.`;
  band.setAttribute('role', 'img');
  band.setAttribute('aria-label', `Language share: ${langs.map((l) => `${l.name} ${Math.round(l.share * 100)} percent`).join(', ')}`);
  const strip = el('div', 'band-strip');
  strip.style.cssText = 'display:flex;height:clamp(64px,9vw,104px)';
  for (const l of langs) {
    const idx = symbolFor(l.name === 'Other' ? null : l.name);
    const seg = el('span', `seg seg-${SYMBOLS[idx]}`);
    seg.style.flex = `${l.share} 1 0`;
    seg.style.minWidth = '4px';
    strip.append(seg);
    const li = el('li');
    li.append(symbolSvg(idx, 26), document.createTextNode(l.name), el('b', '', `${(l.share * 100).toFixed(l.share < 0.1 ? 1 : 0)}%`));
    legend.append(li);
  }
  band.append(strip);
}

function renderPulse(p) {
  const from = p.stats.windowStart;
  $('[data-pulse-lede]').textContent = from
    ? `Public events by ${p.user.login} since ${shortDate(from)}. GitHub only returns the latest 300 events, so older days stay blank. Private work never shows here.`
    : `Public events by ${p.user.login} over the last 90 days. Private work never shows here.`;
  const heat = $('[data-heat]');
  heat.replaceChildren();
  const max = Math.max(1, ...p.days.map((d) => d.n || 0));
  const lead = new Date(`${p.days[0].d}T00:00:00Z`).getUTCDay();
  for (let i = 0; i < lead; i++) {
    const b = el('i');
    b.style.visibility = 'hidden';
    heat.append(b);
  }
  for (const d of p.days) {
    const c = el('i');
    if (d.n === null) {
      c.dataset.l = 'u';
      c.title = `${d.d}: outside the window GitHub returns`;
    } else {
      if (d.n > 0) c.dataset.l = String(Math.min(4, Math.ceil((d.n / max) * 4)));
      c.title = `${d.d}: ${d.n} public ${d.n === 1 ? 'event' : 'events'}`;
    }
    heat.append(c);
  }
  const ws = windowStats(p, from);
  const stats = $('[data-stats]');
  stats.replaceChildren();
  const rows = [
    ['Public repos', p.user.publicRepos],
    [starsLabel(p), p.stats.stars],
    ['Followers', p.user.followers],
    [from ? `Events since ${shortDate(from)}` : 'Events, 90 days', ws.events],
    ['Longest streak, days', ws.streak],
    ['Active days', ws.active],
  ];
  for (const [k, v] of rows) {
    const d = el('div');
    const dd = el('dd', '', fmt(v));
    dd.dataset.count = String(v);
    d.append(dd, el('dt', '', k));
    stats.append(d);
  }
}

function renderDuel() {
  const empty = $('[data-duel-empty]');
  const board = $('[data-duel-board]');
  if (!state.b) {
    empty.hidden = false;
    board.hidden = true;
    return;
  }
  empty.hidden = true;
  board.hidden = false;
  const [A, B] = [state.a, state.b];
  for (const [key, p] of [['a', A], ['b', B]]) {
    const head = $(`[data-duel-head="${key}"]`);
    head.replaceChildren();
    const img = el('img');
    img.src = `${p.user.avatar}${p.user.avatar.includes('?') ? '&' : '?'}s=112`;
    img.alt = '';
    img.width = 56;
    img.height = 56;
    const t = el('div');
    t.append(el('strong', '', p.user.name), el('span', '', `@${p.user.login}`));
    head.append(img, t);
  }
  duelA.setData(A.repos);
  duelB.setData(B.repos);
  const common = [A.stats.windowStart, B.stats.windowStart].filter(Boolean).sort().pop() || null;
  const wa = windowStats(A, common);
  const wb = windowStats(B, common);
  const rows = [
    ['Public repos', A.user.publicRepos, B.user.publicRepos],
    [starsLabel(A, B), A.stats.stars, B.stats.stars],
    ['Followers', A.user.followers, B.user.followers],
    ['Languages', A.stats.langs.filter((l) => l.name !== 'Other').length, B.stats.langs.filter((l) => l.name !== 'Other').length],
    [common ? `Events since ${shortDate(common)}` : 'Events, 90 days', wa.events, wb.events],
    ['Longest streak, days', wa.streak, wb.streak],
    ['Account age, years', Math.floor(years(A.user.createdAt)), Math.floor(years(B.user.createdAt))],
  ];
  const wrap = $('[data-duel-rows]');
  wrap.replaceChildren();
  for (const [label, a, b] of rows) {
    const row = el('div', 'drow');
    const top = Math.max(a, b, 1);
    const mk = (v, other, cls) => {
      const win = v > other;
      const s = el('div', `side ${cls}${win ? ' win' : ''}`);
      const n = el('span', 'num');
      const val = el('span', '', fmt(v));
      val.dataset.count = String(v);
      n.append(val);
      if (win) n.append(el('span', 'ahead', 'ahead'));
      const dim = el('span', 'dim');
      dim.style.setProperty('--w', String(v / top));
      dim.append(el('i'));
      s.append(n, dim);
      return s;
    };
    row.append(mk(a, b, 'a'), el('div', 'drow-label', label), mk(b, a, 'b'));
    wrap.append(row);
  }
}

/* ---------- scroll choreography ---------- */
function buildScroll() {
  if (scrollCtx) scrollCtx.revert();
  state.pin = null;
  if (reduced) return;
  scrollCtx = gsap.context(() => {
    if (desktopMQ.matches && state.top.length > 1) {
      state.pin = ScrollTrigger.create({
        trigger: '[data-system]',
        start: 'top top',
        end: () => `+=${Math.round(innerHeight * 0.85 * state.top.length)}`,
        pin: '[data-system-pin]',
        scrub: true,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          const i = Math.min(state.top.length - 1, Math.floor(self.progress * state.top.length));
          if (i !== state.active) setActive(i);
        },
      });
    }

    const strip = $('.band-strip');
    if (strip) {
      gsap.fromTo(strip, { clipPath: 'inset(0 100% 0 0)' }, {
        clipPath: 'inset(0 0% 0 0)', duration: 1.4, ease: 'power2.out',
        scrollTrigger: { trigger: strip, start: 'top 88%', once: true },
      });
    }

    const cells = $$('[data-heat] i[data-l]');
    if (cells.length) {
      gsap.from(cells, {
        opacity: 0, duration: 0.4, ease: 'power1.out', stagger: { each: 0.01, from: 'start' },
        scrollTrigger: { trigger: '[data-heat]', start: 'top 80%', once: true },
      });
    }

    $$('[data-count]').forEach((n) => {
      const target = Number(n.dataset.count);
      const o = { v: 0 };
      n.textContent = '0';
      gsap.to(o, {
        v: target, duration: 1.4, ease: 'expo.out',
        onUpdate: () => (n.textContent = fmt(o.v)),
        scrollTrigger: { trigger: n, start: 'top 90%', once: true },
      });
    });

    $$('.side .dim').forEach((d) => {
      gsap.from(d, { scaleX: 0, duration: 1.1, ease: 'expo.out', scrollTrigger: { trigger: d, start: 'top 92%', once: true } });
    });
  });
  ScrollTrigger.refresh();
}

function renderAll() {
  const p = state.a;
  heroOrrery.setData(p.repos);
  renderSystem(p);
  renderSpectrum(p);
  renderPulse(p);
  renderDuel();
  buildScroll();
  // The one orchestrated moment: the drawing is plotted, ring by ring.
  if (reduced) heroOrrery.intro = 1;
  else {
    heroOrrery.intro = 0;
    gsap.to(heroOrrery, { intro: 1, duration: 2.8, ease: 'power1.inOut' });
  }
}

/* ---------- loading ---------- */
async function load(a, b, { scroll = false } = {}) {
  const seq = ++state.seq;
  document.body.classList.add('is-loading');
  $('[data-launch]').disabled = true;
  setStatus(b ? `Loading ${a} and ${b}` : `Loading ${a}`);
  const [ra, rb] = await Promise.allSettled([fetchProfile(a), b ? fetchProfile(b) : Promise.resolve(null)]);
  if (seq !== state.seq) return;
  document.body.classList.remove('is-loading');
  $('[data-launch]').disabled = false;

  if (ra.status === 'rejected') {
    setStatus(errorText(ra.reason, a), 'error');
    return;
  }
  state.a = ra.value;
  state.b = rb.status === 'fulfilled' ? rb.value : null;
  renderAll();

  const url = new URL(location.href);
  url.searchParams.set('u', state.a.user.login);
  if (state.b) url.searchParams.set('vs', state.b.user.login);
  else url.searchParams.delete('vs');
  history.replaceState(null, '', url);

  if (rb.status === 'rejected') setStatus(`${errorText(rb.reason, b)} Showing ${state.a.user.login} only.`, 'error');
  else setStatus(state.b ? `Showing ${state.a.user.login} against ${state.b.user.login}.` : `Showing ${state.a.user.login}.`);
  if (scroll) setTimeout(() => $('#system') && (lenis ? lenis.scrollTo('#system', { duration: 1.6 }) : $('#system').scrollIntoView()), 150);
}

const lookup = $('[data-lookup]');
lookup.addEventListener('submit', (e) => {
  e.preventDefault();
  const a = lookup.elements.a.value.trim().replace(/^@/, '');
  const b = lookup.elements.b.value.trim().replace(/^@/, '');
  if (!USER_RE.test(a)) return setStatus('Enter a valid GitHub username: letters, numbers and hyphens only.', 'error');
  if (b && !USER_RE.test(b)) return setStatus('The second username is not valid: letters, numbers and hyphens only.', 'error');
  load(a, b || null, { scroll: true });
});

$('[data-rival]').addEventListener('submit', (e) => {
  e.preventDefault();
  const b = e.currentTarget.elements.b.value.trim().replace(/^@/, '');
  if (!USER_RE.test(b)) return setStatus('The second username is not valid: letters, numbers and hyphens only.', 'error');
  lookup.elements.b.value = b;
  load(state.a.user.login, b);
});

/* ---------- boot ---------- */
const params = new URLSearchParams(location.search);
const startA = (params.get('u') || DEFAULTS.a).trim();
const startB = params.has('u') ? (params.get('vs') || '').trim() : DEFAULTS.b;
lookup.elements.a.value = startA;
lookup.elements.b.value = startB;
load(USER_RE.test(startA) ? startA : DEFAULTS.a, startB && USER_RE.test(startB) ? startB : null);

addEventListener('load', () => ScrollTrigger.refresh());
document.fonts?.ready.then(() => ScrollTrigger.refresh());
