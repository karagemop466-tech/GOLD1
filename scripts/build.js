#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const site = path.join(root, 'site');
const dist = path.join(root, 'dist');

if (!fs.existsSync(site) || site === root || dist === root) throw new Error('Unsafe or missing build directory.');
const candidates = JSON.parse(fs.readFileSync(path.join(root, 'research/candidates.json'), 'utf8'));
const issues = JSON.parse(fs.readFileSync(path.join(root, 'research/irregularities.json'), 'utf8'));
const market = JSON.parse(fs.readFileSync(path.join(root, 'research/policy/market.json'), 'utf8'));

fs.rmSync(dist, { recursive: true, force: true });
fs.cpSync(site, dist, { recursive: true, dereference: true });
fs.mkdirSync(path.join(dist, 'data'), { recursive: true });
const copies = new Map([
  ['research/candidates.json', 'data/candidates.json'],
  ['research/sellers.json', 'data/sellers.json'],
  ['research/irregularities.json', 'data/irregularities.json'],
  ['research/policy/market.json', 'data/market.json'],
  ['research/policy/verification.json', 'data/verification.json']
]);
const hashes = {};
for (const [source, destination] of copies) {
  const bytes = fs.readFileSync(path.join(root, source));
  fs.writeFileSync(path.join(dist, destination), bytes);
  hashes[destination] = crypto.createHash('sha256').update(bytes).digest('hex');
}
fs.writeFileSync(path.join(dist, '.nojekyll'), '');
const flaggedCount = candidates.candidates.filter((row) => row.clearanceStatus !== 'purchase-ready').length;
const manifest = {
  schemaVersion: 1,
  generatedAt: new Date().toISOString(),
  sourceRetrievalDate: candidates.retrievedDate,
  candidateCount: candidates.candidates.length,
  flaggedCount,
  purchaseReadyCount: candidates.candidates.length - flaggedCount,
  listedWeightCount: candidates.candidates.filter((row) => Number.isFinite(row.listedWeightGrams)).length,
  irregularityGroupCount: issues.irregularities.length,
  market: {
    panel: market.source.panel,
    sourceTimestamp: market.source.sourceTimestamp,
    bidPerTroyOunce: market.source.bidPerTroyOunce,
    gramsPerTroyOunce: market.conversion.gramsPerTroyOunce,
    derivedReferencePerGram: market.source.bidPerTroyOunce / market.conversion.gramsPerTroyOunce,
    calculationScope: 'Nominal listed-weight arithmetic only; not actual raw-gold content or a valuation.'
  },
  dataSha256: hashes,
  commit: process.env.GITHUB_SHA || null,
  note: 'Build metadata only. npm test performs evidence, link, security, HTML, runtime, and output-parity audits.'
};
fs.writeFileSync(path.join(dist, 'data/manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(`Built dist/: ${manifest.candidateCount} candidates, ${manifest.flaggedCount} flagged, ${manifest.purchaseReadyCount} purchase-ready`);
console.log(`Market reference: $${manifest.market.derivedReferencePerGram.toFixed(10)}/g from ${manifest.market.sourceTimestamp}`);
