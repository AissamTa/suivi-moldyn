#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════
   scripts/version.mjs — Change la version partout, d'un coup

     npm run version 8.2.0

   Met à jour www/js/config.js et package.json, et rappelle la suite.
   Les deux DOIVENT rester identiques : les workflows refusent de
   publier sinon.
   ═══════════════════════════════════════════════════════════════ */

import { readFileSync, writeFileSync } from 'node:fs';

const version = process.argv[2];

if (!version || !/^\d+\.\d+\.\d+$/.test(version)) {
  console.error('Usage : npm run version 8.2.0   (format MAJEUR.MINEUR.CORRECTIF)');
  process.exit(1);
}

// ── config.js ──────────────────────────────────────────────────
const cfgPath = 'www/js/config.js';
let cfg = readFileSync(cfgPath, 'utf8');
const avant = cfg.match(/VERSION:\s*'([^']+)'/);
if (!avant) {
  console.error(`VERSION introuvable dans ${cfgPath}`);
  process.exit(1);
}
cfg = cfg.replace(/VERSION:\s*'[^']+'/, `VERSION: '${version}'`);
writeFileSync(cfgPath, cfg);

// ── package.json ───────────────────────────────────────────────
const pkgPath = 'package.json';
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
pkg.version = version;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

console.log(`  ${avant[1]}  →  ${version}`);
console.log(`  ✓ ${cfgPath}`);
console.log(`  ✓ ${pkgPath}`);
console.log('');
console.log('  Ensuite :');
console.log(`    git commit -am "v${version}"`);
console.log('    git push                       → publie le site');
console.log(`    git tag v${version} && git push origin v${version}   → compile l'APK et publie la release`);
