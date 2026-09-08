#!/usr/bin/env node
/**
 * One-shot deploy: build a sibling game repo and publish it to this hosting repo.
 *
 * Usage:
 *   node scripts/deploy.mjs <game> [--as <label>] [--name "Display Name"]
 *                           [--description "..."] [--no-build] [--push] [--dry-run]
 *
 *   node scripts/deploy.mjs motox              -> games/motox/
 *   node scripts/deploy.mjs motox --as v2      -> games/motox-v2/   (motox stays live)
 *
 * Game repos live in the folder above this one (GAMES_ROOT, default "..").
 * Engine, build command and bundle dir are auto-detected; override with flags.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const GAMES_ROOT = resolve(process.env.GAMES_ROOT || join(ROOT, '..'));

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { args._.push(a); continue; }
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) args[key] = true;
    else { args[key] = next; i++; }
  }
  return args;
}

const fail = (msg) => { console.error('error: ' + msg); process.exit(1); };
const kebab = (s) => String(s).trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const titleCase = (s) => String(s).replace(/[-_]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const args = parseArgs(process.argv.slice(2));
const game = args._[0];
if (!game) {
  fail('usage: node scripts/deploy.mjs <game> [--as <label>]\n' +
       '       available: ' + readdirSync(GAMES_ROOT, { withFileTypes: true })
         .filter((d) => d.isDirectory() && existsSync(join(GAMES_ROOT, d.name, '.git')))
         .map((d) => d.name).join(', '));
}

const gameDir = resolve(GAMES_ROOT, game);
if (!existsSync(gameDir) || !statSync(gameDir).isDirectory()) fail('game repo not found: ' + gameDir);
if (resolve(gameDir) === ROOT) fail('that is the hosting repo itself');

// --- slug / display name ---
const label = args.as && args.as !== true ? kebab(args.as) : null;
const baseSlug = kebab(game);
const slug = label ? `${baseSlug}-${label}` : baseSlug;
const name = args.name && args.name !== true
  ? String(args.name)
  : titleCase(baseSlug) + (label ? ' ' + label.toUpperCase() : '');

// --- engine + build detection ---
const pkgPath = join(gameDir, 'package.json');
const pkg = existsSync(pkgPath) ? JSON.parse(readFileSync(pkgPath, 'utf8')) : null;
const deps = pkg ? { ...pkg.dependencies, ...pkg.devDependencies } : {};

let engine = args.engine && args.engine !== true ? String(args.engine) : null;
if (!engine) {
  if (existsSync(join(gameDir, 'game.project'))) engine = 'defold';
  else if (deps['pixi.js']) engine = 'pixi';
  else if (pkg) engine = 'web';
  else fail('cannot detect engine in ' + gameDir + ' (no package.json, no game.project)');
}
if (engine === 'defold') {
  fail('defold builds are not automated yet — bundle HTML5 manually, then:\n' +
       `  node scripts/deploy-game.mjs --src <bundle-dir> --slug ${slug} --name "${name}" --engine defold`);
}
if (!pkg?.scripts?.build) fail('no "build" script in ' + pkgPath);

// --- build ---
// npm on Windows is a .cmd shim and needs a shell; node.exe must NOT use one
// (its path contains spaces, which the cmd parser would split).
const run = (cmd, cmdArgs, cwd, shell = false) =>
  execFileSync(cmd, cmdArgs, { cwd, stdio: 'inherit', shell });

if (!args['no-build']) {
  console.log(`[build] ${gameDir}: npm run build`);
  run('npm', ['run', 'build'], gameDir, process.platform === 'win32');
} else {
  console.log('[build] skipped (--no-build)');
}

// --- locate bundle (dir containing index.html) ---
function findBundle(dir) {
  const explicit = args.src && args.src !== true ? resolve(gameDir, String(args.src)) : null;
  if (explicit) return explicit;
  const candidates = ['dist', 'build', 'build/webgl', 'out', 'www'];
  for (const c of candidates) {
    const p = join(dir, c);
    if (existsSync(join(p, 'index.html'))) return p;
    // one level deeper (Defold/bundlers nest an app folder)
    if (existsSync(p) && statSync(p).isDirectory()) {
      for (const sub of readdirSync(p, { withFileTypes: true })) {
        if (sub.isDirectory() && existsSync(join(p, sub.name, 'index.html'))) return join(p, sub.name);
      }
    }
  }
  return null;
}

const bundle = findBundle(gameDir);
if (!bundle) fail('no bundle with index.html found under ' + gameDir + ' (pass --src <dir>)');
console.log(`[bundle] ${bundle}`);

// --- hand off to deploy-game.mjs ---
const deployArgs = [join(ROOT, 'scripts', 'deploy-game.mjs'),
  '--src', bundle, '--slug', slug, '--name', name, '--engine', engine];
const description = args.description && args.description !== true ? String(args.description) : pkg?.description;
if (description) deployArgs.push('--description', String(description));
if (args['dry-run']) deployArgs.push('--dry-run');
if (args.push) deployArgs.push('--push');

run(process.execPath, deployArgs, ROOT);

if (!args['dry-run']) {
  const base = 'https://rja7.github.io/hosting/';
  console.log(`\n[done] ${base}games/${slug}/`);
}
