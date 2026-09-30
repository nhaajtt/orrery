// Letter splitting, pointer lean and hover scramble. Callers skip all of it under reduced motion.

export function splitLetters(el, { markWord } = {}) {
  const text = el.textContent.trim();
  el.setAttribute('aria-label', text);
  el.textContent = '';
  const letters = [];
  for (const word of text.split(/\s+/)) {
    const w = document.createElement('span');
    w.className = 'w';
    w.setAttribute('aria-hidden', 'true');
    if (markWord && word.replace(/[^\w]/g, '').toLowerCase() === markWord) w.classList.add('mark');
    for (const ch of word) {
      const s = document.createElement('span');
      s.className = 'ch';
      s.textContent = ch;
      w.append(s);
      letters.push(s);
    }
    el.append(w, document.createTextNode(' '));
  }
  return letters;
}

// Letters near the pointer tilt toward it and get heavier.
export function initLean(letters, area, { radius = 240 } = {}) {
  let rects = [];
  let px = -9999;
  let py = -9999;
  let raf = 0;

  const measure = () => {
    rects = letters.map((l) => {
      const r = l.getBoundingClientRect();
      return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
    });
  };
  const paint = () => {
    raf = 0;
    letters.forEach((l, i) => {
      const { cx, cy } = rects[i];
      const dx = px - cx;
      const dy = py - cy;
      const k = Math.max(0, 1 - Math.hypot(dx, dy) / radius);
      l.style.setProperty('--r', `${((-dx / radius) * k * 16).toFixed(2)}deg`);
      l.style.setProperty('--w', String(Math.round(560 + 240 * k)));
    });
  };
  const queue = () => {
    if (!raf) raf = requestAnimationFrame(paint);
  };
  const move = (e) => {
    px = e.clientX;
    py = e.clientY;
    queue();
  };
  const leave = () => {
    px = py = -9999;
    queue();
  };

  measure();
  area.addEventListener('pointermove', move);
  area.addEventListener('pointerleave', leave);
  window.addEventListener('resize', measure);
  window.addEventListener('scroll', measure, { passive: true });
  return () => {
    area.removeEventListener('pointermove', move);
    area.removeEventListener('pointerleave', leave);
    window.removeEventListener('resize', measure);
    window.removeEventListener('scroll', measure);
    cancelAnimationFrame(raf);
  };
}

const GLYPHS = 'abcdefghijklmnopqrstuvwxyz0123456789';

export function initScramble(links) {
  const cleanups = [];
  for (const a of links) {
    const label = a.textContent;
    a.setAttribute('aria-label', label);
    let timer = 0;
    const run = () => {
      cancelAnimationFrame(timer);
      const start = performance.now();
      const dur = 380;
      const step = (now) => {
        const p = Math.min(1, (now - start) / dur);
        const fixed = Math.floor(p * label.length);
        a.textContent = label
          .split('')
          .map((c, i) => (i < fixed || c === ' ' ? c : GLYPHS[Math.floor(Math.random() * GLYPHS.length)]))
          .join('');
        if (p < 1) timer = requestAnimationFrame(step);
        else a.textContent = label;
      };
      timer = requestAnimationFrame(step);
    };
    a.addEventListener('mouseenter', run);
    a.addEventListener('focus', run);
    cleanups.push(() => {
      cancelAnimationFrame(timer);
      a.removeEventListener('mouseenter', run);
      a.removeEventListener('focus', run);
      a.textContent = label;
    });
  }
  return () => cleanups.forEach((fn) => fn());
}
