#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const siteRoot = path.resolve(root, process.argv[2] || 'site');
const errors = [];
let linkCount = 0;

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  });
}

if (!fs.existsSync(siteRoot)) {
  console.error(`LINK AUDIT FAILED: ${siteRoot} does not exist. Run npm run build first for dist checks.`);
  process.exit(1);
}

const htmlFiles = walk(siteRoot).filter((file) => file.endsWith('.html'));
const expectedRelative = [
  'index.html', 'flagged.html', 'sellers.html', 'checklist.html', 'calculator.html', 'analysis.html', 'methodology.html',
  'catalog/index.html', 'catalog/solitaire.html', 'catalog/side-stones.html', 'catalog/bezel.html', 'catalog/14k.html', 'catalog/18k.html'
];
const relativeFiles = htmlFiles.map((file) => path.relative(siteRoot, file).split(path.sep).join('/'));
expectedRelative.forEach((relative) => {
  if (!relativeFiles.includes(relative)) errors.push(`Missing required page ${relative}.`);
});
if (relativeFiles.length !== expectedRelative.length) errors.push(`Expected ${expectedRelative.length} HTML pages, found ${relativeFiles.length}.`);

function targetFor(file, rawRef) {
  const clean = rawRef.split('#')[0].split('?')[0];
  let target = clean ? path.resolve(path.dirname(file), clean) : file;
  if (fs.existsSync(target) && fs.statSync(target).isDirectory()) target = path.join(target, 'index.html');
  else if (clean.endsWith('/')) target = path.join(target, 'index.html');
  return target;
}

for (const file of htmlFiles) {
  const text = fs.readFileSync(file, 'utf8');
  const relative = path.relative(siteRoot, file);
  const ids = new Set([...text.matchAll(/\sid="([^"]+)"/g)].map((match) => match[1]));
  const refs = [...text.matchAll(/\s(?:href|src)="([^"]+)"/g)].map((match) => match[1]);
  for (const ref of refs) {
    linkCount += 1;
    if (/^https:\/\//i.test(ref)) {
      try {
        const url = new URL(ref);
        if (url.username || url.password) errors.push(`${relative}: credentials in external URL ${ref}.`);
      } catch (_) { errors.push(`${relative}: malformed external URL ${ref}.`); }
      continue;
    }
    if (/^(?:mailto:|tel:|data:)/i.test(ref)) continue;
    if (/^(?:http:|\/\/)/i.test(ref)) {
      errors.push(`${relative}: mixed-content/protocol-relative URL ${ref}.`);
      continue;
    }
    if (ref.startsWith('#')) {
      const id = decodeURIComponent(ref.slice(1));
      if (id && !ids.has(id)) errors.push(`${relative}: missing same-page fragment ${ref}.`);
      continue;
    }
    if (ref.startsWith('/')) {
      errors.push(`${relative}: root-absolute path breaks project Pages portability: ${ref}.`);
      continue;
    }
    const target = targetFor(file, ref);
    if (!target.startsWith(`${siteRoot}${path.sep}`) && target !== siteRoot) {
      errors.push(`${relative}: path escapes published root ${ref}.`);
      continue;
    }
    if (!fs.existsSync(target)) {
      errors.push(`${relative}: broken local reference ${ref}.`);
      continue;
    }
    const hash = ref.includes('#') ? ref.split('#')[1] : '';
    if (hash && !/^(?:candidate-|issue-|seller-)/.test(hash) && target.endsWith('.html')) {
      const targetText = fs.readFileSync(target, 'utf8');
      if (!new RegExp(`\\sid=["']${hash.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}["']`).test(targetText)) errors.push(`${relative}: missing target fragment ${ref}.`);
    }
  }
  for (const match of text.matchAll(/<a\b[^>]*\bhref="https:\/\/[^"]+"[^>]*>/g)) {
    const anchor = match[0];
    if (/target="_blank"/.test(anchor) && !(/rel="[^"]*noopener[^"]*"/.test(anchor) && /rel="[^"]*noreferrer[^"]*"/.test(anchor))) {
      errors.push(`${relative}: target=_blank anchor lacks noopener/noreferrer: ${anchor}.`);
    }
  }
  for (const match of text.matchAll(/<(?:script|img)\b[^>]*\bsrc="(https:\/\/[^"]+)"[^>]*>/g)) {
    errors.push(`${relative}: third-party active/image resource is not allowed: ${match[1]}.`);
  }
}

if (process.argv[2]) {
  for (const required of ['candidates.json', 'sellers.json', 'irregularities.json', 'market.json', 'verification.json', 'manifest.json']) {
    if (!fs.existsSync(path.join(siteRoot, 'data', required))) errors.push(`Published data file missing: ${required}.`);
  }
  if (!fs.existsSync(path.join(siteRoot, '.nojekyll'))) errors.push('Published .nojekyll marker missing.');
}

if (errors.length) {
  console.error(`LINK AUDIT FAILED (${errors.length} issue${errors.length === 1 ? '' : 's'})`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}
console.log(`PASS links: ${htmlFiles.length} pages, ${linkCount} static references, all internal targets inside ${path.basename(siteRoot)}/`);
console.log('NOTE direct external product/policy sources are evidence-reviewed separately; this check does not pretend live URLs are static.');
