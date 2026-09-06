#!/usr/bin/env node
/**
 * zuc-theme — the kit's CLI.
 *
 *   zuc-theme dev   <theme-dir>   start a hot-reloading dev server on the theme
 *   zuc-theme build <theme-dir>   production build, to prove the theme compiles
 *   zuc-theme check <theme-dir>   verify the folder is a theme this kit can run
 *
 * The theme directory is the folder holding Storefront.vue and storefront/ —
 * the same folder a theme package unzips to. Two layouts work, and
 * neither is more correct than the other:
 *
 *   theme-kit/theme/          — drop it inside the kit, then just `zuc-theme dev`
 *   anywhere on disk          — `zuc-theme dev ../my-theme`
 *
 * The second exists because a theme is usually its own project with its own git
 * history, and vendoring it inside the kit would tangle the two. The first is
 * simply less to type. The path reaches Vite through ZUC_THEME_DIR, so nothing
 * inside the kit is edited either way.
 */
import { spawn } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseThemeConfig, manifestFrom } from '../tools/theme-settings.mjs';

const KIT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// A theme package is exactly these two. `cores/` is NOT one of them: it is
// shared by every theme and replaced wholesale on every store update, so it is
// not a theme developer's to edit and does not ship in their package. Requiring
// it here rejected real theme packages. The kit supplies its own copies.
const REQUIRED = ['Storefront.vue', 'storefront'];

const argv = process.argv.slice(2);

/** Value of `--name <value>`, or null. */
const flag = (name) => {
    const i = argv.indexOf(`--${name}`);
    return i === -1 ? null : argv[i + 1] ?? null;
};

// Positional arguments only: drop each `--flag` and the value that follows it.
// 🚨 Help is matched against the RAW argv, before this filter — `--help` is a
// flag by shape, so filtering first left `command` defaulting to 'dev' and the
// kit answered `zuc-theme --help` by trying to boot a dev server.
const HELP = ['-h', '--help', 'help'];
const positional = argv.filter((a, i) => !a.startsWith('--') && !argv[i - 1]?.startsWith('--'));
const [command = 'dev', themeArg] = positional;

function usage(message) {
    if (message) console.error(`\n  ${message}`);
    console.error(`
  zuc-theme <command> [theme-dir]

    dev      start a dev server against the theme (hot reload)
    build    production build, to check the theme compiles
    check    verify the folder looks like a theme
    export   assemble the uploadable package  [--out <dir>] [--slug <name>]

  [theme-dir] is the folder containing ${REQUIRED.join(', ')}.
  Omit it to use ./theme inside the kit.
`);
    process.exit(message ? 1 : 0);
}

if (argv.some((a) => HELP.includes(a))) usage();
const themeDir = themeArg ? resolve(themeArg) : resolve(KIT, 'theme');

if (!existsSync(themeDir)) {
    usage(themeArg
        ? `Theme directory does not exist: ${themeDir}`
        : `No theme found at ${themeDir}

  Either put your theme there, or point at one:
    zuc-theme ${command} ../my-theme`);
}

const missing = REQUIRED.filter((entry) => !existsSync(resolve(themeDir, entry)));
if (missing.length) {
    usage(`${themeDir}\n  is not a theme folder — missing: ${missing.join(', ')}`);
}

/**
 * On Windows, refuse to run against a theme on a different drive from the kit.
 *
 * For `dev`: Vite serves a file outside its root through /@fs/, and the served URL
 * loses the separator after the drive letter — the browser asks for "C:Users/..."
 * and gets a 404 on the page component, with nothing saying why. Allowing the path
 * does not help; the URL is already malformed by then.
 *
 * 🚨 `build` was exempt here for a long time and should not have been. It does not
 * error across drives — it QUIETLY COMPILES ALMOST NOTHING. The router reaches
 * pages through `import(`@theme/storefront/${name}.vue`)`, which Vite resolves as
 * a glob, and across drives that glob matches no files. Measured on one theme:
 * 77 chunks with every page when the theme sat on the kit's drive, 5 chunks and
 * not a single page component when the same theme sat on another. Both printed
 * "✓ built" and exited 0.
 *
 * That is the worst possible outcome for this command. `build` exists to be the
 * check you run before shipping — it is supposed to fail loudly on a typo'd import
 * or a renamed component. A build that compiles none of your pages passes
 * everything, including the broken theme it was run to catch. Refusing is the only
 * honest answer until the glob itself resolves across drives.
 */
if (process.platform === 'win32' && ['dev', 'build'].includes(command)) {
    const driveOf = (p) => (p.match(/^([A-Za-z]):/) || [])[1]?.toUpperCase();
    const kitDrive = driveOf(KIT);
    const themeDrive = driveOf(themeDir);

    if (kitDrive && themeDrive && kitDrive !== themeDrive) {
        console.error();
        console.error('  The kit cannot ' + command + ' a theme from another drive.');
        console.error();
        console.error('    kit:   ' + KIT);
        console.error('    theme: ' + themeDir);
        console.error();

        if (command === 'dev') {
            console.error('  Vite serves files outside its root through /@fs/, and on Windows that URL');
            console.error('  loses the separator after the drive letter, so every page 404s.');
        } else {
            console.error('  Pages are reached through a globbed dynamic import, and across drives');
            console.error('  that glob matches nothing. The build then SUCCEEDS having compiled no');
            console.error('  page at all — so it would pass a theme it exists to catch.');
        }

        console.error();
        console.error('  Move one of them so both sit on ' + kitDrive + ': — or copy the theme into');
        console.error('  ' + KIT + String.fromCharCode(92) + 'theme and run: zuc-theme ' + command);
        console.error();
        process.exit(1);
    }
}

const IMAGE = /\.(png|jpe?g|webp|gif)$/i;

function countScreenshots(dir) {
    try {
        return readdirSync(dir).filter((f) => IMAGE.test(f)).length;
    } catch {
        return 0;
    }
}

/** Every `zucConfig.theme_<name>` a theme's own files read. */
function referencedSlugs() {
    const found = new Set();

    const walk = (dir) => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
            const full = resolve(dir, entry.name);
            if (entry.isDirectory()) {
                walk(full);
            } else if (/\.(vue|js|mjs|ts)$/.test(entry.name)) {
                for (const m of readFileSync(full, 'utf8').matchAll(/zucConfig\.theme_([a-z0-9_]+)/g)) {
                    found.add(m[1]);
                }
            }
        }
    };

    try {
        walk(themeDir);
    } catch { /* an unreadable file is not worth failing an export over */ }

    return found;
}

/**
 * Things worth saying out loud, none of them fatal.
 *
 * 🚨 The slug check is the one that cannot be found any other way. A store names
 * a theme from its marketplace listing, not from anything inside the package —
 * the archive's own top folder is stripped and discarded. So a theme whose files
 * read `zucConfig.theme_obsidian` only works on a store that installed it under
 * exactly that name. Get it wrong and every setting reads `undefined`: no error,
 * no warning, just a theme quietly using its own fallbacks forever.
 */
function exportWarnings(slug, declared, shotsDir) {
    const out = [];

    if (!declared) {
        out.push('No theme_config in theme-kit.config.json, so this package declares no settings.');
        out.push('  Add one and a store admin can configure the theme; leave it out and nothing is lost.');
    }

    if (countScreenshots(shotsDir) === 0) {
        out.push(`No screenshots. Drop PNGs into ${shotsDir} — a listing with no image is a hard sell.`);
    }

    const referenced = [...referencedSlugs()].filter((name) => name !== slug);
    if (referenced.length) {
        out.push(`Theme files read zucConfig.theme_${referenced.join(', theme_')} but you are exporting as "${slug}".`);
        out.push('  A store keys these by the name it installs the theme under. If they disagree,');
        out.push('  every setting reads undefined and nothing reports it. Use --slug to match.');
    }

    return out;
}

/**
 * Read the theme's `theme_config`, if it declares one.
 *
 * Returns null when there is no config file or no `theme_config` in it — a theme
 * with no settings is the ordinary case, not a fault.
 */
function readThemeConfig() {
    const configPath = resolve(themeDir, 'theme-kit.config.json');
    if (!existsSync(configPath)) return null;

    let raw;
    try {
        raw = JSON.parse(readFileSync(configPath, 'utf8'));
    } catch (e) {
        console.error();
        console.error('  theme-kit.config.json is not valid JSON:');
        console.error('  ' + e.message);
        console.error();
        process.exit(1);
    }

    if (raw.theme_config === undefined) return null;

    try {
        return { slug: raw.slug, settings: parseThemeConfig(raw.theme_config) };
    } catch (e) {
        console.error();
        console.error('  theme_config is not valid, and a store would refuse this package:');
        console.error('  ' + e.message);
        console.error();
        process.exit(1);
    }
}

if (command === 'check') {
    const declared = readThemeConfig();
    console.log(`OK  ${themeDir} looks like a runnable theme.`);
    if (declared) console.log(`OK  theme_config declares ${declared.settings.length} setting(s).`);
    process.exit(0);
}

/**
 * Assemble the folder a store installs from.
 *
 * 🚨 The shape you develop in is NOT the shape you ship. You work in a folder
 * whose root holds Storefront.vue and storefront/; a package nests exactly those
 * two under `files/`, and an installer looks for `files/Storefront.vue` after
 * stripping the archive's own top-level folder. Zipping the theme folder
 * directly produces something that unpacks one level too high and is rejected
 * after upload — which is the whole reason this command exists rather than a
 * line in the README telling you to zip it yourself.
 *
 * Only those two entries are copied. Everything else beside them is yours and
 * local: theme-kit.config.json, locales/, a README, a .git — none of it belongs
 * in a package, and `files/` is not a dumping ground for the folder's contents.
 */
if (command === 'export') {
    const slug = flag('slug') || readThemeConfig()?.slug || basename(themeDir);
    const outRoot = resolve(flag('out') || resolve(KIT, 'packages'));
    const dest = resolve(outRoot, slug);

    const declared = readThemeConfig();

    // `files/` is generated, so it is replaced outright — a file you deleted from
    // the theme must not survive in the package. `screenshots/` is NOT: those are
    // put there by hand and there is nowhere else they live, so wiping them on
    // every export would quietly throw away the only copy.
    mkdirSync(dest, { recursive: true });
    rmSync(resolve(dest, 'files'), { recursive: true, force: true });
    mkdirSync(resolve(dest, 'files'), { recursive: true });

    for (const entry of REQUIRED) {
        cpSync(resolve(themeDir, entry), resolve(dest, 'files', entry), { recursive: true });
    }

    const shots = resolve(dest, 'screenshots');
    mkdirSync(shots, { recursive: true });
    if (existsSync(resolve(themeDir, 'screenshots'))) {
        cpSync(resolve(themeDir, 'screenshots'), shots, { recursive: true });
    }

    if (declared) {
        mkdirSync(resolve(dest, 'config'), { recursive: true });
        writeFileSync(
            resolve(dest, 'config', 'settings.json'),
            JSON.stringify(manifestFrom(declared.settings), null, 2) + String.fromCharCode(10),
            'utf8'
        );
    }

    console.log();
    console.log(`  ${dest}`);
    console.log(`    files/            ${REQUIRED.join(', ')}`);
    console.log(`    screenshots/      ${countScreenshots(shots)} image(s)`);
    console.log(declared
        ? `    config/settings.json  ${declared.settings.length} setting(s)`
        : '    config/           — not written, no theme_config declared');
    console.log();

    for (const warning of exportWarnings(slug, declared, shots)) console.log('  ! ' + warning);
    console.log();
    process.exit(0);
}

if (!['dev', 'build'].includes(command)) usage(`Unknown command: ${command}`);

// Resolve Vite's own JS entry and run it with the current Node binary.
// Spawning `npx vite` looks tidier but breaks on Windows: Node refuses to spawn
// a .cmd shim without a shell (EINVAL), and turning the shell on to work around
// that would put the theme path — which routinely contains spaces — through shell
// quoting. This has neither problem and skips npx's resolution step.
const viteBin = resolve(KIT, 'node_modules', 'vite', 'bin', 'vite.js');

if (!existsSync(viteBin)) {
    console.error();
    console.error('  Vite is not installed in the kit. Run npm install in:');
    console.error('  ' + KIT);
    process.exit(1);
}

const args = command === 'dev' ? [viteBin] : [viteBin, 'build'];

const child = spawn(process.execPath, args, {
    cwd: KIT,
    stdio: 'inherit',
    env: { ...process.env, ZUC_THEME_DIR: themeDir },
});

child.on('exit', (code) => process.exit(code ?? 0));
