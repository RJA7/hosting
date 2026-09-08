# hosting

GitHub Pages site that hosts every WebGL game we build. Games are developed and
bundled in their **own separate repositories** in the folder above this one
(`D:\Projects\<game>`); only built output is committed here.

Live site: https://rja7.github.io/hosting/
Each game: https://rja7.github.io/hosting/games/<slug>/

## Layout

```
index.html                landing page; fetches games.json at runtime, renders a card grid
games.json                manifest: [{ slug, name, engine, description, thumbnail, updated }]
games/<slug>/             a game's built bundle, verbatim (generated - never hand-edit)
scripts/deploy.mjs        one-shot: build a sibling game repo + publish it here
scripts/deploy-game.mjs   lower level: copies a bundle in, upserts the manifest, commits
.nojekyll                 stops Pages from filtering files starting with "_"
.claude/skills/deploy-game/   the full deploy workflow
```

## Deploy flow

```
node scripts/deploy.mjs motox --push          # builds ../motox, publishes games/motox/
node scripts/deploy.mjs motox --as v2 --push  # publishes games/motox-v2/, motox stays live
```

Builds in the game repo, copies the bundle here, updates `games.json`, commits, pushes.
Pages redeploys; the landing page picks up the entry with no build step here.
Run `node scripts/deploy.mjs` with no argument to list available game repos.

See `.claude/skills/deploy-game/SKILL.md` for flags, Defold `bob.jar` bundling and
the relative-path requirement.

## Rules

- Bundles must use **relative** asset paths - games are served from a subdirectory,
  not a domain root (Vite `base: './'`, webpack `output.publicPath: './'`).
- Deploying wipes `games/<slug>/` before copying. Confirm the slug before overwriting.
- `--as <label>` deploys to `games/<game>-<label>/`, keeping the previous version live.
- Slugs are kebab-case and stable.
- No build step in this repo. Adding a game is a copy + commit.
