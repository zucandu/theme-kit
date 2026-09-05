#!/usr/bin/env node
/**
 * zuc-theme — the kit's CLI.
 *
 *   zuc-theme dev   <theme-dir>   start a hot-reloading dev server on the theme
 *   zuc-theme build <theme-dir>   production build, to prove the theme compiles
 *   zuc-theme check <theme-dir>   verify the folder is a theme this kit can run
 *
 * The theme directory is the folder holding Storefront.vue, storefront/ and
 * cores/ — the same folder a theme package unzips to. Two layouts work, and
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
const REQUIRED = ['Storefront.vue', 'storefront', 'cores'];

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
