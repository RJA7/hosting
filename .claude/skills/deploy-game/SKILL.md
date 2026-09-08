---
name: deploy-game
description: Bundle a game from its own repo and publish it to this GitHub Pages hosting repo. Use when the user says "deploy game", "publish game", "host this build", "add game to hosting", or names a game to put on the site. Covers Pixi and Defold WebGL builds.
---

# Deploy a game to hosting

This repo is a GitHub Pages site that hosts every game we build. Each game lives in
its own repository and is bundled with its own bundler; only the *built output* is
copied here, into `games/<slug>/`.

## Inputs to establish first

| Input | How to get it |
| --- | --- |
| Game source repo path | User says it, or ask. |
| Engine | Detect: `package.json` with `pixi.js` → pixi; `game.project` → defold. |
| Slug | Kebab-case folder name under `games/`. Default: repo/game name lowercased. Must match `[a-z0-9-]`. Reuse the existing slug when updating a game. |
| Display name / description | Ask if not obvious from the game repo README or `package.json`. |

## Step 1 — Build in the game's own repo

Run the build in the game repo, never here.

**Pixi / web bundlers** — read the game repo's `package.json` scripts and run the
build script it defines (commonly `npm run build`, sometimes `vite build`,
`webpack --mode production`, `rollup -c`). Output dir is usually `dist/` or `build/`;
confirm by listing it after the build.

**Defold** — build an HTML5 bundle:
```
bob.jar --archive --platform js-web resolve distclean build bundle --bundle-output build/webgl
```
Or bundle from the Defold editor (`Project → Bundle → HTML5 Application`).
The bundle output contains a game folder with `index.html` inside — pass *that*
folder (the one directly containing `index.html`) as `--src`.

Validate before continuing: the bundle dir must contain `index.html`, and all asset
paths inside must be **relative** (no leading `/`), because the game is served from
`https://<user>.github.io/hosting/games/<slug>/`, not from a domain root. If the
bundle references absolute paths, fix the bundler config in the game repo
(Vite: `base: './'`; webpack: `output.publicPath: './'`; Defold: HTML5 bundles are
relative by default).

## Step 2 — Copy into this repo and update the manifest

From this repo's root:

```
node scripts/deploy-game.mjs --src <abs-path-to-bundle> --slug <slug> \
  --name "Display Name" --engine pixi --description "One line."
```

The script:
1. validates the bundle has `index.html`,
2. **wipes** `games/<slug>/` and copies the bundle in (stale files never linger),
3. upserts the game's entry in `games.json` (`slug`, `name`, `engine`, `description`,
   `thumbnail`, `updated`),
4. stages `games/<slug>` + `games.json` and commits `deploy(<slug>): update build`.

Useful flags: `--dry-run` (no writes), `--push` (push immediately),
`--thumbnail games/<slug>/thumb.png` (a 16:9 image placed in the bundle; if the
bundle contains `thumb.png` it is picked up automatically).

Because step 2 **deletes** the existing `games/<slug>/` directory, confirm the slug
with the user before deploying over an existing game.

## Step 3 — Push to publish

```
git push
```

GitHub Pages rebuilds on push to `main`. Site root: `https://<user>.github.io/hosting/`.
The landing page reads `games.json` at runtime, so a new game appears with no
build step. Give the user the direct link: `.../hosting/games/<slug>/`.

## Notes

- Never hand-edit `games/<slug>/` contents — it is generated output; fix the game repo and redeploy.
- `games.json` may be hand-edited for metadata only (name, description, thumbnail).
- `.nojekyll` at the repo root keeps Pages from filtering files starting with `_`
  (Defold and some bundlers emit those). Do not delete it.
- To remove a game: `rm -rf games/<slug>`, drop its entry from `games.json`, commit, push.
