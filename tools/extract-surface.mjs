/**
 * Extract the exact member surface the storefront theme uses on each `@/` module.
 *
 * The shim only has to be honest about what the theme actually touches. Mirroring
 * every export of every core store would be both more work and a bigger lie
 * surface, so this derives the contract from the theme's own call sites.
 *
 * Usage: node tools/extract-surface.mjs <path-to-themes/default>
 */
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const THEME = process.argv[2];
if (!THEME) { console.error('usage: node tools/extract-surface.mjs <themes/default dir>'); process.exit(1); }

async function walk(dir, out = []) {
    for (const e of await readdir(dir, { withFileTypes: true })) {
        const p = join(dir, e.name);
        if (e.isDirectory()) await walk(p, out);
        else if (/\.(vue|js)$/.test(e.name)) out.push(p);
    }
    return out;
}

/** module path -> Set(members) ; plus which local identifier each factory got bound to */
const surface = new Map();
const add = (mod, member) => {
    if (!surface.has(mod)) surface.set(mod, new Set());
    if (member) surface.get(mod).add(member);
};

const files = await walk(join(THEME, 'storefront'));

// cores/ ships with the theme (alias @theme), so its call sites count too.
try { (await walk(join(THEME, 'cores'))).forEach(f => files.push(f)); } catch { /* no cores dir */ }

// Storefront.vue sits at the ROOT of themes/<name>/, not inside storefront/, and it is the
// single biggest consumer of the shim: it is the layout shell every page mounts inside, and it
// alone calls fetchSettings() and fetchWishlistIds(). Scanning only storefront/ silently drops
// those from the contract, and the shim then looks complete while the very first render fails.
// Admin.vue is the sibling we must NOT pick up — storefront only, no admin surface.
for (const e of await readdir(THEME, { withFileTypes: true })) {
    if (e.isFile() && /.vue$/.test(e.name) && e.name !== 'Admin.vue') files.push(join(THEME, e.name));
}

for (const file of files) {
    const src = await readFile(file, 'utf8');

    // 1. every `import { a, b } from '@/x'`
    for (const m of src.matchAll(/import\s+([^;]+?)\s+from\s+['"](@\/[^'"]+)['"]/g)) {
        const [, clause, mod] = m;
        add(mod, null);
        const names = clause.replace(/[{}]/g, '').split(',').map(s => s.trim().split(/\s+as\s+/)[0]).filter(Boolean);
        for (const name of names) {
            // 2. for each imported factory, find `const local = name(...)` then harvest `local.member`
            for (const b of src.matchAll(new RegExp(String.raw`(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*${name}\s*\(`, 'g'))) {
                const local = b[1];
                for (const u of src.matchAll(new RegExp(String.raw`\b${local}\.([A-Za-z_$][\w$]*)`, 'g'))) add(mod, u[1]);
            }
            // 3. destructured factory result: `const { a, b } = useHelpers()`
            for (const b of src.matchAll(new RegExp(String.raw`(?:const|let)\s*\{([^}]+)\}\s*=\s*${name}\s*\(`, 'g'))) {
                b[1].split(',').map(s => s.trim().split(':')[0].trim()).filter(Boolean).forEach(k => add(mod, k));
            }
            // 4. bare use of the import itself (e.g. storefrontApi.get)
            for (const u of src.matchAll(new RegExp(String.raw`\b${name}\.([A-Za-z_$][\w$]*)`, 'g'))) add(mod, u[1]);
        }
    }
}

const report = {};
for (const [mod, members] of [...surface].sort()) report[mod] = [...members].sort();

await writeFile(join(ROOT, 'contract.json'), JSON.stringify(report, null, 2) + '\n', 'utf8');

let total = 0;
for (const [mod, members] of Object.entries(report)) {
    total += members.length;
    console.log(`${mod}  (${members.length})`);
    console.log(`   ${members.join(', ') || '— factory only'}`);
}
console.log(`\n${Object.keys(report).length} modules, ${total} members -> contract.json`);
