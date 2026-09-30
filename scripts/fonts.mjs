// Downloads the self-hosted font subsets (vietnamese, latin-ext, latin) from Google Fonts.
import { writeFile, mkdir } from 'node:fs/promises';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const URL_CSS =
  'https://fonts.googleapis.com/css2?family=Sofia+Sans:wght@300..700&family=Sofia+Sans+Extra+Condensed:wght@500..900&display=swap';
const css = await (await fetch(URL_CSS, { headers: { 'User-Agent': UA } })).text();
await mkdir('public/fonts', { recursive: true });
const re = /\/\* (\S+) \*\/\s*@font-face \{([\s\S]*?)\}/g;
let m;
while ((m = re.exec(css))) {
  const [, sub, body] = m;
  if (!['vietnamese', 'latin-ext', 'latin'].includes(sub)) continue;
  const fam = body.match(/font-family: '([^']+)'/)[1].toLowerCase().replace(/ /g, '-');
  const weight = body.match(/font-weight: ([^;]+);/)[1].replace(/ /g, '-');
  const url = body.match(/url\((\S+?)\)/)[1];
  const range = body.match(/unicode-range: (.*?);/)[1];
  const name = `${fam}-${weight}-${sub}.woff2`;
  await writeFile(`public/fonts/${name}`, Buffer.from(await (await fetch(url)).arrayBuffer()));
  console.log(`${name} | ${range}`);
}
