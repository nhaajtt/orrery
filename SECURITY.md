# Security policy

## Reporting a vulnerability

Please report security problems privately through GitHub:
**Security tab, then "Report a vulnerability"** (private vulnerability reporting is enabled for this
repository). Do not open a public issue for something exploitable.

Include what you found, how to reproduce it and what you think the impact is. This is a small personal
project, so responses are best effort, but I read every report and will say when I have reproduced it.

## Scope

In scope:

- The serverless function in `api/gh.js` (input handling, caching, error responses).
- The GitHub Action in `action.yml` and `action/` (for example unsafe handling of inputs or output paths).
- The website in `src/` and `index.html` (for example script injection through data from the GitHub API).

Out of scope: vulnerabilities in GitHub itself, in Vercel, or in third-party dependencies that are already
tracked by Dependabot.

## What the project handles

Orrery reads only public GitHub data. It stores no user accounts and no personal data. The optional
`GITHUB_TOKEN` used for rate limits should be a token with no scopes, kept as a secret and never committed.
