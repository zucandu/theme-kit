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
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const KIT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
// A theme package is exactly these two. `cores/` is NOT one of them: it is
// shared by every theme and replaced wholesale on every store update, so it is
// not a theme developer's to edit and does not ship in their package. Requiring
// it here rejected real theme packages. The kit supplies its own copies.
const REQUIRED = ['Storefront.vue', 'storefront'];

const [command = 'dev', themeArg] = process.argv.slice(2);

function usage(message) {
    if (message) console.error(`\n  ${message}`);
    console.error(`
  zuc-theme <command> [theme-dir]

    dev      start a dev server against the theme (hot reload)
    build    production build, to check the theme compiles
    check    verify the folder looks like a theme

  [theme-dir] is the folder containing ${REQUIRED.join(', ')}.
  Omit it to use ./theme inside the kit.
`);
    process.exit(message ? 1 : 0);
}

if (['-h', '--help', 'help'].includes(command)) usage();
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
 * On Windows, refuse to start a DEV SERVER for a theme on a different drive from
 * the kit.
 *
 * Vite serves a file outside its root through /@fs/, and the served URL loses the
 * separator after the drive letter — the browser asks for "C:Users/..." and gets a
 * 404 on the page component, with nothing saying why. Allowing the path does not
 * help; the URL is already malformed by then.
 *
 * `build` is unaffected, so it is not blocked.
 */
if (process.platform === 'win32' && command === 'dev') {
    const driveOf = (p) => (p.match(/^([A-Za-z]):/) || [])[1]?.toUpperCase();
    const kitDrive = driveOf(KIT);
    const themeDrive = driveOf(themeDir);

    if (kitDrive && themeDrive && kitDrive !== themeDrive) {
        console.error();
        console.error('  The dev server cannot serve a theme from another drive.');
        console.error();
        console.error('    kit:   ' + KIT);
        console.error('    theme: ' + themeDir);
        console.error();
        console.error('  Vite serves files outside its root through /@fs/, and on Windows that URL');
        console.error('  loses the separator after the drive letter, so every page 404s.');
        console.error();
        console.error('  Move one of them so both sit on ' + kitDrive + ': — or copy the theme into');
        console.error('  ' + KIT + String.fromCharCode(92) + 'theme and run: zuc-theme dev');
        console.error();
        console.error('  `zuc-theme build` works across drives and is not affected.');
        console.error();
        process.exit(1);
    }
}

if (command === 'check') {
    console.log(`OK  ${themeDir} looks like a runnable theme.`);
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
