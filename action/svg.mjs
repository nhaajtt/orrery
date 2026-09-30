// Pure SVG builder: profile payload in, SVG string out.
import { hash01, langColor, ringFor, radiusFor } from '../lib/palette.js';

export const MAX_PLANETS = 24;

const W = 880;
const H = 440;
const CX = 560;
const CY = 226;

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const num = (n) => Math.round(n).toLocaleString('en-US');

export function renderSvg(profile) {
  const { user, repos, stats } = profile;
  const list = repos.slice(0, MAX_PLANETS);
  const top = stats.langs[0];
  const A = 300; // largest semi-major axis
  const TILT = 0.4;

  const rings = [];
  const planets = [];
  list.forEach((repo, i) => {
    const ring = ringFor(i, list.length);
    const rx = A * ring;
    const ry = rx * TILT;
    const period = (16 + ring * 70) * (0.75 + hash01(repo.name + 'v') * 0.5);
    const phase = hash01(repo.name);
    const r = radiusFor(repo, 11) * 0.85;
    const color = langColor(repo.lang);
    const path = `M ${CX + rx} ${CY} a ${rx} ${ry} 0 1 0 ${-2 * rx} 0 a ${rx} ${ry} 0 1 0 ${2 * rx} 0 z`;
    rings.push(`<ellipse class="ring" cx="${CX}" cy="${CY}" rx="${rx.toFixed(1)}" ry="${ry.toFixed(1)}"/>`);
    const label = `${repo.name}${repo.lang ? `, ${repo.lang}` : ''}${repo.stars ? `, ${num(repo.stars)} stars` : ''}`;
    planets.push(
      `<g opacity="${repo.fork ? 0.55 : 1}"><title>${esc(label)}</title>` +
        `<circle r="${(r * 2.6).toFixed(1)}" fill="${color}" opacity="0.16"/>` +
        `<circle r="${r.toFixed(1)}" fill="${color}"/>` +
        `<animateMotion dur="${period.toFixed(1)}s" begin="${(-phase * period).toFixed(1)}s" repeatCount="indefinite" path="${path}"/></g>`,
    );
  });

  const facts = [
    [num(user.publicRepos), 'public repos'],
    [num(stats.stars), stats.partial ? 'stars, latest 300 repos' : 'stars'],
    [num(user.followers), 'followers'],
    [top ? top.name : 'none yet', 'top language'],
  ];
  const factLines = facts
    .map(([v, k], i) => `<text class="v" x="36" y="${164 + i * 46}">${esc(v)}</text><text class="k" x="36" y="${182 + i * 46}">${esc(k)}</text>`)
    .join('');

  const summary = `${user.login}: ${num(user.publicRepos)} public repositories, ${num(stats.stars)} stars, ${num(user.followers)} followers.`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-labelledby="t d">
<title id="t">Orrery of ${esc(user.login)}</title>
<desc id="d">${esc(summary)} Each planet is a public repository; newer pushes orbit closer to the sun.</desc>
<style>
  :root { --bg: #05070f; --fg: #eef0ea; --dim: #9aa2b1; --ring: #eef0ea; --sun: #c8ff3d; --core: #c8ff3d; }
  @media (prefers-color-scheme: light) { :root { --bg: #edf0f6; --fg: #0b0f1a; --dim: #4b5363; --ring: #0b0f1a; --core: #0b0f1a; } }
  text { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; fill: var(--fg); }
  .name { font: 700 26px ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; }
  .v { font-size: 22px; font-weight: 600; }
  .k { font-size: 12px; fill: var(--dim); }
  .ring { fill: none; stroke: var(--ring); stroke-opacity: .13; stroke-width: 1; }
  .glow { fill: var(--sun); opacity: .28; }
</style>
<rect width="${W}" height="${H}" rx="16" fill="var(--bg)"/>
<text class="name" x="36" y="60">${esc(user.name)}</text>
<text class="k" x="36" y="84">@${esc(user.login)}</text>
${factLines}
${rings.join('\n')}
<circle class="glow" cx="${CX}" cy="${CY}" r="34"><animate attributeName="r" values="30;38;30" dur="5s" repeatCount="indefinite"/></circle>
<circle cx="${CX}" cy="${CY}" r="11" fill="var(--core)"/>
${planets.join('\n')}
</svg>
`;
}

