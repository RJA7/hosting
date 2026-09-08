# hosting

GitHub Pages site that hosts every WebGL game we build. Games are developed and
bundled in their **own separate repositories**; only built output is committed here.

Live site: `https://<user>.github.io/hosting/`
Each game: `https://<user>.github.io/hosting/games/<slug>/`

## Layout

```
index.html          landing page; fetches games.json at runtime and renders a card grid
games.json          manifest: [{ slug, name, engine, description, thumbnail, updated }]
games/<slug>/       a game's built bundle, verbatim (generated — never hand-edit)
scripts/deploy-game.mjs   copies a bundle in, upserts the manifest, commits
.nojekyll           stops Pages from filtering files starting with "_"
.claude/skills/deploy-game/  the full deploy workflow
```

## Deploy flow

1. Build the game in its own repo with its own bundler (Pixi → `npm run build`; Defold → HTML5 bundle).
2. From this repo: `node scripts/deploy-game.mjs --src <bundle-dir> --slug <slug> --name "Name" --engine pixi`
3. `git push` — Pages redeploys, landing page picks up the new entry automatically.

See `.claude/skills/deploy-game/SKILL.md` for the full procedure, including
Defold `bob.jar` bundling and the relative-path requirement.

## Rules

- Bundles must use **relative** asset paths — games are served from a subdirectory,
  not a domain root (Vite `base: './'`, webpack `output.publicPath: './'`).
- Deploying wipes `games/<slug>/` before copying. Confirm the slug before overwriting.
- Slugs are kebab-case, stable, and match the game name.
- No build step in this repo. Nothing to compile; adding a game is a copy + commit.
