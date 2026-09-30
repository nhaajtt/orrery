// Pure SVG builder: profile payload in, cyanotype-style drawing sheet out.
import { hash01, symbolFor, ringFor, radiusFor, svgDefs, svgSymbol } from '../lib/palette.js';

export const MAX_PLANETS = 24;

const W = 880;
const H = 440;
const CX = 588;
const CY = 208;
const A = 248; // largest semi-major axis
const TILT = 0.42;
const ROWS = 5;

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const num = (n) => Math.round(n).toLocaleString('en-US');
const compact = (n) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e4 ? `${Math.round(n / 1e3)}k` : n >= 1e3 ? `${(n / 1e3).toFixed(1)}k` : String(n));
const clip = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}...` : s);

export function renderSvg(profile) {
  const { user, repos, stats } = profile;
  const list = repos.slice(0, MAX_PLANETS);

  const rings = [];
  const ticks = [];
  const planets = [];
  list.forEach((repo, i) => {
    const ring = ringFor(i, list.length);
    const rx = A * ring;
    const ry = rx * TILT;
    const period = (18 + ring * 80) * (0.75 + hash01(`${repo.name}v`) * 0.5);
    const phase = hash01(repo.name);
    const r = radiusFor(repo, 5.5, 13) * 0.9;
    const path = `M ${CX + rx} ${CY} a ${rx} ${ry} 0 1 0 ${-2 * rx} 0 a ${rx} ${ry} 0 1 0 ${2 * rx} 0 z`;
    rings.push(`<ellipse class="ring" cx="${CX}" cy="${CY}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}"/>`);
    const label = `${repo.name}${repo.lang ? `, ${repo.lang}` : ''}${repo.stars ? `, ${num(repo.stars)} stars` : ''}`;
    planets.push(
      `<g><title>${esc(label)}</title>${svgSymbol(symbolFor(repo.lang), 0, 0, r.toFixed(1), { ink: 'var(--ink)', dash: repo.fork })}` +
        `<animateMotion dur="${period.toFixed(1)}s" begin="${(-phase * period).toFixed(1)}s" repeatCount="indefinite" path="${path}"/></g>`,
    );
  });

  // Protractor ticks on the outermost ring (every 10 degrees, longer every 30).
  const outer = A * (list.length ? ringFor(list.length - 1, list.length) : 0.94) + 14;
  for (let d = 0; d < 360; d += 10) {
    const a = (d * Math.PI) / 180;
    const len = d % 30 === 0 ? 8 : 4;
    const rx0 = outer;
    const ry0 = outer * TILT;
    const rx1 = outer + len;
    const ry1 = (outer + len) * TILT;
    ticks.push(`M ${(CX + Math.cos(a) * rx0).toFixed(1)} ${(CY + Math.sin(a) * ry0).toFixed(1)} L ${(CX + Math.cos(a) * rx1).toFixed(1)} ${(CY + Math.sin(a) * ry1).toFixed(1)}`);
  }

  // Parts list: one row per repository, same symbol as its planet.
  const rows = list.slice(0, ROWS);
  const parts = rows
    .map((repo, i) => {
      const y = 158 + i * 30;
      return (
        `<line class="rule" x1="40" y1="${y + 10}" x2="304" y2="${y + 10}"/>` +
        svgSymbol(symbolFor(repo.lang), 50, y, 6.5, { ink: 'var(--ink)', dash: repo.fork, width: 1.2 }) +
        `<text class="row" x="68" y="${y + 4}">${esc(clip(repo.name, 21))}</text>` +
        `<text class="lang" x="304" y="${y + 4}" text-anchor="end">${esc(repo.lang || 'no language')}</text>`
      );
    })
    .join('');
  const more = list.length > ROWS ? `<text class="lang" x="40" y="${158 + ROWS * 30 + 6}">and ${list.length - ROWS} more on the chart</text>` : '';
  const empty = !list.length
    ? `<text class="row" x="40" y="164">No public repositories yet.</text>`
    : '';

  const notes = ['How to read this sheet', 'Orbit: how recently a repository was pushed.', 'Size: stars and repository size.', 'Fill symbol: the main language.']
    .map((t, i) => `<text class="${i ? 'note' : 'head'}" x="40" y="${348 + i * 15}">${t}</text>`)
    .join('');

  const top = stats.langs[0];
  const cells = [
    [compact(user.publicRepos), 'public repos'],
    [compact(stats.stars), 'stars'],
    [compact(user.followers), 'followers'],
  ];
  const block = cells
    .map(([v, k], i) => {
      const x = 612 + i * 76;
      return `<text class="cv" x="${x + 10}" y="392">${esc(v)}</text><text class="ck" x="${x + 10}" y="406">${esc(k)}</text>` + (i ? `<line class="rule" x1="${x}" y1="374" x2="${x}" y2="410"/>` : '');
    })
    .join('');

  const summary = `${user.login}: ${num(user.publicRepos)} public repositories, ${num(stats.stars)} stars, ${num(user.followers)} followers${top ? `, mostly ${top.name}` : ''}.`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-labelledby="t d">
<title id="t">Orrery of ${esc(user.login)}</title>
<desc id="d">${esc(summary)} Each planet is a public repository. Newer pushes orbit closer to the sun and each language has its own fill symbol.</desc>
<style>
  :root { --paper: #0d2f6b; --ink: #eaf1ff; --dim: #a9bde6; --grid: #eaf1ff; --sun: #f2d16b; }
  @media (prefers-color-scheme: light) { :root { --paper: #f4f7fb; --ink: #0d2f6b; --dim: #4d648f; --grid: #0d2f6b; --sun: #e0ac1a; } }
  text { font-family: 'Sofia Sans Extra Condensed', 'Arial Narrow', 'Helvetica Neue', Arial, sans-serif; font-stretch: condensed; fill: var(--ink); }
  .name { font-size: 46px; font-weight: 800; letter-spacing: -0.5px; }
  .handle { font-size: 16px; fill: var(--dim); }
  .head { font-size: 13px; fill: var(--dim); }
  .row { font-size: 17px; font-weight: 600; }
  .lang { font-size: 14px; fill: var(--dim); }
  .note { font-size: 13px; fill: var(--dim); }
  .cv { font-size: 24px; font-weight: 800; }
  .ck { font-size: 12px; fill: var(--dim); }
  .grid { stroke: var(--grid); stroke-opacity: .09; stroke-width: 1; }
  .rule { stroke: var(--ink); stroke-opacity: .28; stroke-width: 1; }
  .frame { fill: none; stroke: var(--ink); stroke-opacity: .55; }
  .ring { fill: none; stroke: var(--ink); stroke-opacity: .34; stroke-width: 1; }
  .axis { stroke: var(--ink); stroke-opacity: .16; stroke-width: 1; stroke-dasharray: 2 4; }
  .tick { fill: none; stroke: var(--ink); stroke-opacity: .5; stroke-width: 1; }
  .sunline { fill: none; stroke: var(--sun); }
</style>
<defs>
${svgDefs('var(--ink)')}
<pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse"><path class="grid" d="M20 0H0V20" fill="none"/></pattern>
</defs>
<rect width="${W}" height="${H}" rx="6" fill="var(--paper)"/>
<rect width="${W}" height="${H}" rx="6" fill="url(#grid)"/>
<rect class="frame" x="10" y="10" width="${W - 20}" height="${H - 20}" stroke-width="1.4"/>
<rect class="frame" x="16" y="16" width="${W - 32}" height="${H - 32}" stroke-width="0.6"/>
<text class="name" x="40" y="72">${esc(clip(user.name, 16))}</text>
<text class="handle" x="40" y="96">@${esc(user.login)}</text>
<text class="head" x="40" y="136">Public repositories</text>
${parts}${more}${empty}
${notes}
<line class="axis" x1="${CX - A - 30}" y1="${CY}" x2="${CX + A + 30}" y2="${CY}"/>
<line class="axis" x1="${CX}" y1="${CY - A * TILT - 30}" x2="${CX}" y2="${CY + A * TILT + 30}"/>
${rings.join('\n')}
<path class="tick" d="${ticks.join(' ')}"/>
<circle class="sunline" cx="${CX}" cy="${CY}" r="26" stroke-dasharray="2 3" stroke-opacity=".7"/>
<circle class="sunline" cx="${CX}" cy="${CY}" r="17" stroke-opacity=".9"/>
<circle cx="${CX}" cy="${CY}" r="8" fill="var(--sun)"/>
${planets.join('\n')}
<rect class="frame" x="602" y="366" width="232" height="50" stroke-width="1"/>
${block}
</svg>
`;
}
