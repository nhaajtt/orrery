#!/usr/bin/env node
// Renders a GitHub profile as an animated SVG solar system.
//
//   node action/render.mjs <username> [output.svg]
//
// In a workflow the values come from INPUT_USERNAME, INPUT_OUTPUT and INPUT_TOKEN.
// Only public data is read, through the GitHub REST API.

import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { loadProfile, USER_RE, GhError } from '../lib/gh.js';
import { renderSvg, MAX_PLANETS } from './svg.mjs';

async function main() {
  const login = (process.env.INPUT_USERNAME || process.argv[2] || '').trim().replace(/^@/, '');
  const out = process.env.INPUT_OUTPUT || process.argv[3] || 'orrery.svg';
  const token = process.env.INPUT_TOKEN || process.env.GITHUB_TOKEN || undefined;

  if (!USER_RE.test(login)) {
    console.error(`::error::"${login}" is not a valid GitHub username.`);
    process.exit(1);
  }
  let profile;
  try {
    profile = await loadProfile(login, { token });
  } catch (err) {
    const msg =
      err instanceof GhError
        ? { not_found: `No public GitHub user named "${login}".`, rate_limited: 'GitHub rate limit reached. Pass a token input.', network: 'Could not reach GitHub.' }[err.code] || `GitHub error: ${err.code}`
        : String(err);
    console.error(`::error::${msg}`);
    process.exit(1);
  }

  mkdirSync(dirname(out) || '.', { recursive: true });
  writeFileSync(out, renderSvg(profile));
  console.log(`Wrote ${out}: ${Math.min(profile.repos.length, MAX_PLANETS)} planets for ${login}.`);
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `path=${out}\nplanets=${Math.min(profile.repos.length, MAX_PLANETS)}\n`);
  }
}

await main();
