#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const errors = [];

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      errors.push(`Symbolic link is not allowed in published/research files: ${path.relative(root, target)}.`);
      return [];
    }
    return entry.isDirectory() ? walk(target) : [target];
  });
}

const siteFiles = walk(path.join(root, 'site'));
const researchFiles = walk(path.join(root, 'research'));
const htmlFiles = siteFiles.filter((file) => file.endsWith('.html'));
const requiredCsp = [
  "default-src 'self'", "script-src 'self'", "style-src 'self'", "connect-src 'self'",
  "img-src 'self' data:", "object-src 'none'", "base-uri 'none'", "form-action 'none'"
];

for (const file of htmlFiles) {
  const text = fs.readFileSync(file, 'utf8');
  const relative = path.relative(root, file);
  const csp = text.match(/<meta\s+http-equiv="Content-Security-Policy"\s+content="([^"]+)">/i)?.[1];
  if (!csp) errors.push(`${relative}: CSP meta missing.`);
  else {
    requiredCsp.forEach((directive) => { if (!csp.includes(directive)) errors.push(`${relative}: CSP lacks ${directive}.`); });
    if (/unsafe-inline|unsafe-eval|https:\/\//.test(csp)) errors.push(`${relative}: CSP permits inline/eval or third-party origins.`);
  }
  if (!/<meta\s+name="referrer"\s+content="no-referrer">/.test(text)) errors.push(`${relative}: no-referrer policy missing.`);
  if (/\son[a-z]+\s*=/i.test(text)) errors.push(`${relative}: inline event handler detected.`);
  if (/\sstyle\s*=/i.test(text)) errors.push(`${relative}: inline style attribute detected.`);
  if (/<style\b/i.test(text)) errors.push(`${relative}: inline style block detected.`);
  for (const match of text.matchAll(/<script\b([^>]*)>/gi)) {
    if (!/\bsrc="\.\.?\/assets\/app\.js"/.test(match[1])) errors.push(`${relative}: inline or unexpected script detected.`);
    if (/async/.test(match[1]) || !/defer/.test(match[1])) errors.push(`${relative}: app script must be deferred.`);
  }
  for (const match of text.matchAll(/<link\b[^>]*rel="stylesheet"[^>]*>/gi)) {
    if (!/href="\.\.?\/assets\/styles\.css"/.test(match[0])) errors.push(`${relative}: third-party/unexpected stylesheet detected.`);
  }
}

const app = fs.readFileSync(path.join(root, 'site/assets/app.js'), 'utf8');
const forbiddenBrowserPatterns = [
  /\.innerHTML\s*=/, /\.outerHTML\s*=/, /insertAdjacentHTML/, /document\.write\s*\(/,
  /\beval\s*\(/, /new\s+Function\b/, /localStorage/, /sessionStorage/, /indexedDB/,
  /document\.cookie/, /WebSocket\s*\(/, /XMLHttpRequest/, /\.style\./
];
forbiddenBrowserPatterns.forEach((pattern) => {
  if (pattern.test(app)) errors.push(`app.js: forbidden dynamic/security-sensitive pattern ${pattern}.`);
});
if (!/fetch\(`\$\{root\}\/data\/\$\{path\}`/.test(app)) errors.push('app.js: data fetch is not restricted to the local root/data path.');
if (!/url\.protocol === 'https:'/.test(app) || !/!url\.username && !url\.password/.test(app)) errors.push('app.js: HTTPS/credential URL guard missing.');
if (!/a\.rel = 'noopener noreferrer'/.test(app)) errors.push('app.js: external-link rel protection missing.');
if (!/\.textContent = String\(text\)/.test(app)) errors.push('app.js: safe text-only element helper missing.');
if (/fetch\(['"]https?:/i.test(app)) errors.push('app.js: third-party runtime fetch detected.');

const css = fs.readFileSync(path.join(root, 'site/assets/styles.css'), 'utf8');
if (/@import|url\(\s*['"]?https?:/i.test(css)) errors.push('styles.css: external import/resource detected.');

const secretPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /gh[pousr]_[A-Za-z0-9]{20,}/,
  /AKIA[0-9A-Z]{16}/,
  /sk-[A-Za-z0-9]{20,}/,
  /xox[baprs]-[A-Za-z0-9-]{20,}/
];
for (const file of [...siteFiles, ...researchFiles]) {
  if (!/\.(?:html|js|css|json|md)$/i.test(file)) continue;
  const text = fs.readFileSync(file, 'utf8');
  const relative = path.relative(root, file);
  if (/http:\/\//i.test(text)) errors.push(`${relative}: insecure HTTP reference detected.`);
  secretPatterns.forEach((pattern) => { if (pattern.test(text)) errors.push(`${relative}: possible credential/private key detected.`); });
  for (const match of text.matchAll(/https:\/\/[^\s\])}"'<>]+/g)) {
    try {
      const url = new URL(match[0]);
      if (url.username || url.password) errors.push(`${relative}: credential-bearing URL detected.`);
      if (/(?:utm_|a_aid|affiliate|aff=)/i.test(url.search)) errors.push(`${relative}: tracking/affiliate URL detected.`);
    } catch (_) { /* Text punctuation can delimit URLs; HTML/link audits validate actual attributes. */ }
  }
}

const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
if (pkg.dependencies && Object.keys(pkg.dependencies).length) errors.push('Runtime production dependencies are not expected for this static site.');
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
for (const [name, record] of Object.entries(lock.packages || {})) {
  if (record.resolved && !record.resolved.startsWith('https://registry.npmjs.org/')) errors.push(`Unexpected package registry/source for ${name || 'root'}.`);
}

if (errors.length) {
  console.error(`SECURITY AUDIT FAILED (${errors.length} issue${errors.length === 1 ? '' : 's'})`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}
console.log(`PASS security: ${htmlFiles.length} restrictive CSP documents; no inline handlers/styles/scripts or third-party runtime resources`);
console.log('PASS rendering: safe textContent DOM construction, local-only fetch, HTTPS URL guard, protected external links');
console.log('PASS secrets/supply chain: no detected credentials, insecure URLs, affiliate parameters, production dependencies, or unexpected registries');
