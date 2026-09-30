// Shared by the website canvas (src/orrery.js) and the SVG renderer (action/render.mjs).

const LANG = {
  JavaScript: '#e5c95a', TypeScript: '#5aa9e6', Python: '#7ad9b5', HTML: '#e8825a', CSS: '#a08ae6',
  Shell: '#9ad35a', C: '#8c98ad', 'C++': '#e57a8a', Go: '#5ad1d9', Rust: '#f0965a', Java: '#d98a5a',
  Ruby: '#e5626f', PHP: '#8f9be0', Swift: '#f0a35a', Kotlin: '#b48ae6', 'Jupyter Notebook': '#f0965a',
  Vue: '#6fd39a', SCSS: '#d97aa8', Dockerfile: '#5aa9e6', Assembly: '#c6a15a', Other: '#7d8597',
};
const FALLBACK = ['#e5c95a', '#5aa9e6', '#e57a8a', '#7ad9b5', '#b48ae6', '#f0965a', '#9ad35a', '#5ad1d9'];

export function hash01(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) / 4294967295;
}

export function langColor(lang) {
  if (!lang) return '#7d8597';
  return LANG[lang] || FALLBACK[Math.floor(hash01(lang) * FALLBACK.length)];
}

// One shared rule for where a repo sits: newer pushes orbit closer to the sun.
export function ringFor(index, count) {
  return count === 1 ? 0.5 : 0.2 + 0.74 * Math.pow(index / (count - 1), 0.9);
}

// Size grows with stars and repo size.
export function radiusFor(repo, max = 16) {
  return Math.min(max, 3.5 + Math.sqrt(repo.stars) * 0.9 + Math.log2(repo.size + 2) * 0.55);
}
