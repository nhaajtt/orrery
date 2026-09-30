# Orrery

Look up any GitHub username and see the public repositories drawn as an orrery on a cyanotype sheet.
Recent pushes orbit closer to the sun, size follows stars and repo size, and each language has its own
fill symbol, like the materials on a technical drawing. Add a second username to compare two profiles.

**Live site:** https://orbit-gh.vercel.app

This repository holds two things:

1. **The website** (Vite, GSAP, Lenis, canvas). Lookup, a pinned planet tour, language spectrum, activity
   pulse and a two-person duel.
2. **A GitHub Action** that renders the same idea as an animated SVG you can put in a profile README.

## Use the Action

```yaml
name: Orrery
on:
  schedule:
    - cron: "17 3 * * *"
  workflow_dispatch:

permissions:
  contents: write

jobs:
  render:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: nhaajtt/orrery@v1
        with:
          username: your-username
          output: orrery.svg
      - name: Commit if changed
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add orrery.svg
          git diff --cached --quiet || (git commit -m "Update orrery" && git push)
```

Then reference it from your README:

```markdown
![Orrery](./orrery.svg)
```

| Input | Default | Description |
|---|---|---|
| `username` | repository owner | GitHub user to draw |
| `output` | `orrery.svg` | file to write |
| `token` | `github.token` | token for the public API |

The SVG is a drawing sheet with a parts list, and it follows the viewer's light or dark preference and
animates without JavaScript.

## Run the site locally

```
npm install
npm run dev
```

Set `GITHUB_TOKEN` (a token with no scopes) to raise the API rate limit from 60 to 5000 requests an hour.
On Vercel add it as an environment variable. Never commit it.

## How it reads data

Only the GitHub public REST API is used: a user's public profile, public repositories and public events.
Private repositories and private contributions are never requested and never shown. GitHub returns at most
the latest 300 public events, so for very active accounts the activity chart covers a shorter window and
says so.

## Security

See [SECURITY.md](SECURITY.md). Dependencies are watched by Dependabot and the code is scanned by CodeQL.

## License

MIT. Orrery is an independent project and is not affiliated with GitHub.
