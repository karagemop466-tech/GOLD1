#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const errors = [];
const check = (condition, message) => { if (!condition) errors.push(message); };
const hash = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      errors.push(`Published symlink found: ${target}.`);
      return [];
    }
    return entry.isDirectory() ? walk(target) : [target];
  });
}

if (!fs.existsSync(dist)) {
  console.error('BUILD AUDIT FAILED: dist/ missing. Run npm run build.');
  process.exit(1);
}

const copies = new Map([
  ['research/candidates.json', 'data/candidates.json'],
  ['research/sellers.json', 'data/sellers.json'],
  ['research/irregularities.json', 'data/irregularities.json'],
  ['research/policy/market.json', 'data/market.json'],
  ['research/policy/verification.json', 'data/verification.json']
]);
for (const [source, destination] of copies) {
  const sourceFile = path.join(root, source);
  const outputFile = path.join(dist, destination);
  check(fs.existsSync(outputFile), `Missing ${destination}.`);
  if (fs.existsSync(outputFile)) {
    check(hash(sourceFile) === hash(outputFile), `${destination}: published bytes differ from audited source.`);
    assert.deepEqual(JSON.parse(fs.readFileSync(sourceFile, 'utf8')), JSON.parse(fs.readFileSync(outputFile, 'utf8')));
  }
}

for (const sourceFile of walk(path.join(root, 'site'))) {
  const relative = path.relative(path.join(root, 'site'), sourceFile);
  const outputFile = path.join(dist, relative);
  check(fs.existsSync(outputFile), `Published site file missing: ${relative}.`);
  if (fs.existsSync(outputFile)) check(hash(sourceFile) === hash(outputFile), `Published site file differs: ${relative}.`);
}

const manifest = JSON.parse(fs.readFileSync(path.join(dist, 'data/manifest.json'), 'utf8'));
const candidateData = JSON.parse(fs.readFileSync(path.join(dist, 'data/candidates.json'), 'utf8'));
const issueData = JSON.parse(fs.readFileSync(path.join(dist, 'data/irregularities.json'), 'utf8'));
check(manifest.candidateCount === 13 && candidateData.candidates.length === 13, 'Published candidate count mismatch.');
check(manifest.flaggedCount === 13 && manifest.purchaseReadyCount === 0, 'Published clearance totals mismatch.');
check(manifest.listedWeightCount === 6, 'Published listed-weight total mismatch.');
check(manifest.irregularityGroupCount === issueData.irregularities.length, 'Published irregularity total mismatch.');
for (const [destination, expectedHash] of Object.entries(manifest.dataSha256 || {})) {
  const file = path.join(dist, destination);
  check(fs.existsSync(file) && hash(file) === expectedHash, `Manifest hash mismatch: ${destination}.`);
}
check(fs.existsSync(path.join(dist, '.nojekyll')), '.nojekyll missing.');

const linkAudit = spawnSync(process.execPath, [path.join(root, 'scripts/audit-links.js'), 'dist'], { cwd: root, encoding: 'utf8' });
process.stdout.write(linkAudit.stdout || '');
process.stderr.write(linkAudit.stderr || '');
check(linkAudit.status === 0, 'Published internal-link audit failed.');

if (errors.length) {
  console.error(`BUILD AUDIT FAILED (${errors.length} issue${errors.length === 1 ? '' : 's'})`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}
console.log('PASS build: exact source/output data parity, manifest hashes, .nojekyll, and 13 flagged / 0 purchase-ready rows');
console.log('PASS combined publication: all reviewed site bytes and all five evidence datasets are present in dist/');
