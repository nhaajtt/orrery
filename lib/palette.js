// Drawing vocabulary shared by the website canvas, the SVG action and the DOM legends.
// Languages are not colors: like materials on a technical drawing, each one is a fill symbol.

export const SYMBOLS = ['solid', 'ring', 'hatch-up', 'hatch-down', 'cross', 'lines', 'bars', 'dots', 'half', 'target'];

const FIXED = {
  TypeScript: 0, C: 1, JavaScript: 2, Rust: 3, HTML: 4, Shell: 5, CSS: 6, Python: 7, Go: 8, 'C++': 9,
  Astro: 3, Java: 4, Ruby: 5, PHP: 6, Swift: 7, Kotlin: 8, Vue: 2, 'Jupyter Notebook': 7, Dockerfile: 5,
  Assembly: 9, SCSS: 6, Other: 1,
};

export function hash01(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967295;
}

// Stable symbol index for a language. Repos with no detected language are drawn as plain rings.
export function symbolFor(lang) {
  if (!lang) return 1;
  if (lang in FIXED) return FIXED[lang];
  return Math.floor(hash01(lang) * SYMBOLS.length);
}

// One shared rule for where a repo sits: newer pushes orbit closer to the sun.
export function ringFor(index, count) {
  return count === 1 ? 0.5 : 0.2 + 0.74 * Math.pow(index / (count - 1), 0.9);
}

// Size grows with stars and repo size.
export function radiusFor(repo, min = 6, max = 18) {
  return Math.min(max, min + Math.sqrt(repo.stars) * 0.9 + Math.log2(repo.size + 2) * 0.45);
}

/* ---------- SVG ---------- */

// <defs> with the hatch patterns; ink is a CSS color or var(). Include once per SVG.
export function svgDefs(ink = 'currentColor', prefix = 'sy') {
  const line = (rot, gap = 3.2) =>
    `patternUnits="userSpaceOnUse" width="${gap}" height="${gap}" patternTransform="rotate(${rot})"`;
  return (
    `<pattern id="${prefix}-hatch-up" ${line(45)}><line x1="0" y1="0" x2="0" y2="3.2" stroke="${ink}" stroke-width="1"/></pattern>` +
    `<pattern id="${prefix}-hatch-down" ${line(-45)}><line x1="0" y1="0" x2="0" y2="3.2" stroke="${ink}" stroke-width="1"/></pattern>` +
    `<pattern id="${prefix}-cross" ${line(45)}><path d="M0 0V3.2M0 0H3.2" stroke="${ink}" stroke-width="0.9" fill="none"/></pattern>` +
    `<pattern id="${prefix}-lines" ${line(0, 3.4)}><line x1="0" y1="0" x2="0" y2="3.4" stroke="${ink}" stroke-width="1"/></pattern>` +
    `<pattern id="${prefix}-bars" ${line(90, 3.4)}><line x1="0" y1="0" x2="0" y2="3.4" stroke="${ink}" stroke-width="1"/></pattern>` +
    `<pattern id="${prefix}-dots" patternUnits="userSpaceOnUse" width="3.6" height="3.6"><circle cx="1.8" cy="1.8" r="0.8" fill="${ink}"/></pattern>` +
    `<pattern id="${prefix}-target" patternUnits="userSpaceOnUse" width="8" height="8"><circle cx="4" cy="4" r="2.6" fill="none" stroke="${ink}" stroke-width="0.9"/><circle cx="4" cy="4" r="0.8" fill="${ink}"/></pattern>` +
    `<linearGradient id="${prefix}-half" x1="0" x2="1" y1="0" y2="0"><stop offset="0.5" stop-color="${ink}"/><stop offset="0.5" stop-color="var(--paper, transparent)"/></linearGradient>`
  );
}

// A symbol circle centered on (cx, cy). Returns SVG markup; needs svgDefs() in the same SVG.
export function svgSymbol(index, cx, cy, r, { ink = 'currentColor', prefix = 'sy', width = 1.4, dash = false } = {}) {
  const kind = SYMBOLS[index];
  const stroke = `stroke="${ink}" stroke-width="${width}"${dash ? ' stroke-dasharray="3 2.5"' : ''}`;
  const base = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="var(--paper, transparent)" ${stroke}/>`;
  const fill = (name) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${prefix}-${name})" ${stroke}/>`;
  switch (kind) {
    case 'solid':
      return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${ink}" ${stroke}/>`;
    case 'ring':
      return base;
    case 'half':
      return base + `<path d="M ${cx} ${cy - r} A ${r} ${r} 0 0 0 ${cx} ${cy + r} Z" fill="${ink}"/>`;
    case 'target':
      return base + `<circle cx="${cx}" cy="${cy}" r="${(r * 0.55).toFixed(2)}" fill="none" ${stroke}/>` + `<circle cx="${cx}" cy="${cy}" r="${Math.max(1, r * 0.2).toFixed(2)}" fill="${ink}"/>`;
    default:
      return base + fill(kind);
  }
}

/* ---------- Canvas ---------- */

// Draws the same symbols on a 2D canvas context.
export function drawSymbol(g, index, x, y, r, ink, paper, dashed = false) {
  const kind = SYMBOLS[index];
  g.save();
  g.lineWidth = 1.3;
  g.strokeStyle = ink;
  g.fillStyle = paper;
  if (dashed) g.setLineDash([3, 2.5]);
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  if (kind === 'solid') {
    g.fillStyle = ink;
    g.fill();
  }
  g.save();
  g.clip();
  g.lineWidth = 1;
  g.setLineDash([]);
  const strokeLines = (angle, gap) => {
    g.save();
    g.translate(x, y);
    g.rotate(angle);
    g.beginPath();
    for (let o = -r; o <= r; o += gap) {
      g.moveTo(o, -r);
      g.lineTo(o, r);
    }
    g.stroke();
    g.restore();
  };
  if (kind === 'hatch-up') strokeLines(Math.PI / 4, 3.2);
  else if (kind === 'hatch-down') strokeLines(-Math.PI / 4, 3.2);
  else if (kind === 'cross') {
    strokeLines(Math.PI / 4, 3.4);
    strokeLines(-Math.PI / 4, 3.4);
  } else if (kind === 'lines') strokeLines(Math.PI / 2, 3.4);
  else if (kind === 'bars') strokeLines(0, 3.4);
  else if (kind === 'dots') {
    g.fillStyle = ink;
    for (let dx = -r; dx <= r; dx += 3.6) for (let dy = -r; dy <= r; dy += 3.6) {
      g.beginPath();
      g.arc(x + dx, y + dy, 0.8, 0, Math.PI * 2);
      g.fill();
    }
  } else if (kind === 'half') {
    g.fillStyle = ink;
    g.beginPath();
    g.moveTo(x, y - r);
    g.arc(x, y, r, -Math.PI / 2, Math.PI / 2, true);
    g.closePath();
    g.fill();
  } else if (kind === 'target') {
    g.beginPath();
    g.arc(x, y, r * 0.55, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = ink;
    g.beginPath();
    g.arc(x, y, Math.max(1, r * 0.2), 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.stroke();
  g.restore();
}
