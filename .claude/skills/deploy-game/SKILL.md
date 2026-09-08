---
name: deploy-game
description: Build a game from a sibling repo and publish it to this GitHub Pages hosting site. Use when the user says "deploy <game>", "deploy <game> as <label>", "publish <game>", "host this build", or "redeploy <game>". Covers Vite/Pixi web builds and Defold WebGL bundles.
---

# Deploy a game to hosting

Games live in their own repos in the folder **above** this one (`D:\Projects\<game>`).
Only built output is committed here, into `games/<slug>/`. The landing page reads
`games.json` at runtime, so publishing is a copy + commit — no build step in this repo.

Live site: https://rja7.github.io/hosting/

## The shortcut

"deploy motox" and "deploy motox as v2" both map to one command:

```
node scripts/deploy.mjs motox            # -> games/motox/
node scripts/deploy.mjs motox --as v2    # -> games/motox-v2/  (motox stays live)
```

`--as <label>` produces slug `<game>-<label>` and display name `<Game> <LABEL>`, so
versions live side by side rather than overwriting each other. Without it, the deploy
**replaces** `games/<game>/`.

`scripts/deploy.mjs <game>` does the whole flow:
1. resolves `../<game>` (override the search root with `GAMES_ROOT`),
2. detects the engine — `game.project` → defold, `pixi.js` dep → pixi, else `web`,
3. runs `npm run build` in the game repo,
4. finds the bundle (first of `dist`, `build`, `build/webgl`, `out`, `www` containing
   `index.html`, plus one nested level),
5. hands off to `scripts/deploy-game.mjs`, which wipes and refills `games/<slug>/`,
   upserts `games.json`, and commits `deploy(<slug>): update build`,
6. prints the live URL.

Flags: `--push` (push right away), `--dry-run` (no writes), `--no-build` (reuse the
existing bundle), `--src <dir>` (bundle path relative to the game repo),
`--name "…"`, `--description "…"`, `--engine <e>`.

Run with no argument to list the sibling game repos.

## Handling the user's phrasing

| User says | Command |
| --- | --- |
| "deploy motox" | `node scripts/deploy.mjs motox --push` |
| "deploy motox as v2" | `node scripts/deploy.mjs motox --as v2 --push` |
| "redeploy motox, already built" | `node scripts/deploy.mjs motox --no-build --push` |
| "deploy motox but don't push" | `node scripts/deploy.mjs motox` |

Default to `--push` — the point of deploying is to publish. Then confirm the Pages
build and report the URL:

```
gh api repos/RJA7/hosting/pages/builds/latest --jq .status     # poll until "built"
curl -s -o /dev/null -w "%{http_code}\n" https://rja7.github.io/hosting/games/<slug>/
```

Because a plain deploy **deletes** `games/<slug>/` first, confirm the slug with the
user before overwriting a game they didn't name.

## Requirements on the game repo

- A `build` script in `package.json`.
- **Relative** asset paths — games are served from `/hosting/games/<slug>/`, not a
  domain root. Vite: `base: './'`. Webpack: `output.publicPath: './'`.
  If the deployed page 404s on its JS/CSS, this is why.
- A service worker, if any, must not claim scope `/`. Scope it to the game folder or
  drop it from the hosted build.
- Optional `thumb.png` (16:9) in the bundle — picked up automatically as the card image.

## Defold

Not automated by `deploy.mjs` yet; it errors out with the manual path. Bundle HTML5
first:

```
bob.jar --archive --platform js-web resolve distclean build bundle --bundle-output build/webgl
```
(or editor: `Project → Bundle → HTML5 Application`), then pass the folder that
*directly* contains `index.html`:

```
node scripts/deploy-game.mjs --src <bundle-dir> --slug <slug> --name "Name" --engine defold
```

`.nojekyll` at the repo root is what keeps Pages from dropping Defold's `_`-prefixed
files. Do not delete it.

## Maintenance

- Never hand-edit `games/<slug>/` — generated output. Fix the game repo and redeploy.
- `games.json` may be hand-edited for metadata only (name, description, thumbnail).
- Remove a game: `rm -rf games/<slug>`, drop its `games.json` entry, commit, push.
- Every deploy commits the full bundle, so binaries accumulate in git history forever
  (Pages repos are soft-capped near 1 GB). If it becomes a problem, switch to
  Pages-from-Actions (`actions/deploy-pages`) where the site is an artifact, not a commit.
