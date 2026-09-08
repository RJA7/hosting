#!/usr/bin/env node
/**
 * Deploy a built game bundle into this hosting repo.
 *
 * Usage:
 *   node scripts/deploy-game.mjs --src <bundle-dir> --slug <folder-name> \
 *        [--name "Display Name"] [--engine pixi|defold|other] \
 *        [--description "..."] [--thumbnail games/<slug>/thumb.png] \
 *        [--push] [--dry-run]
 *
 * Steps: validate bundle -> replace games/<slug> -> update games.json -> optional commit & push.
 */
import { existsSync, statSync, rmSync, mkdirSync, cpSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) args[key] = true;
    else { args[key] = next; i++; }
  }
  return args;
}

function fail(msg) {
  console.error('error: ' + msg);
  process.exit(1);
}

const args = parseArgs(process.argv.slice(2));
const src = args.src && resolve(String(args.src));
const slug = args.slug && String(args.slug);

if (!src || !slug) fail('--src and --slug are required');
if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) fail('--slug must be kebab-case: [a-z0-9-]');
if (!existsSync(src) || !statSync(src).isDirectory()) fail('bundle dir not found: ' + src);
if (!existsSync(join(src, 'index.html'))) fail('bundle has no index.html: ' + src);

const dest = join(ROOT, 'games', slug);
const dryRun = Boolean(args['dry-run']);

console.log(`[deploy] ${src} -> games/${slug}`);
if (!dryRun) {
  rmSync(dest, { recursive: true, force: true });
  mkdirSync(dest, { recursive: true });
  cpSync(src, dest, { recursive: true });
}

// --- manifest ---
const manifestPath = join(ROOT, 'games.json');
const manifest = existsSync(manifestPath)
  ? JSON.parse(readFileSync(manifestPath, 'utf8'))
  : { games: [] };
manifest.games = manifest.games || [];

const entry = manifest.games.find((g) => g.slug === slug) || { slug };
entry.name = args.name ? String(args.name) : entry.name || slug;
if (args.engine) entry.engine = String(args.engine);
if (args.description) entry.description = String(args.description);
if (args.thumbnail) entry.thumbnail = String(args.thumbnail);
else if (!entry.thumbnail && existsSync(join(dest, 'thumb.png'))) entry.thumbnail = `games/${slug}/thumb.png`;
entry.updated = new Date().toISOString().slice(0, 10);
if (!manifest.games.includes(entry)) manifest.games.push(entry);

if (!dryRun) writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
console.log('[manifest] ' + JSON.stringify(entry));

if (dryRun) {
  console.log('[dry-run] no files written, nothing committed');
  process.exit(0);
}

// --- git ---
const git = (...a) => execFileSync('git', a, { cwd: ROOT, stdio: 'inherit' });
git('add', '--', `games/${slug}`, 'games.json');
const staged = execFileSync('git', ['diff', '--cached', '--name-only'], { cwd: ROOT, encoding: 'utf8' }).trim();
if (!staged) {
  console.log('[git] nothing changed');
  process.exit(0);
}
git('commit', '-m', `deploy(${slug}): update build`);
if (args.push) git('push');
else console.log('[git] committed. run `git push` to publish.');
