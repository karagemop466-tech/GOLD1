#!/usr/bin/env node
/**
 * Deep anti-hallucination, cross-file provenance, regulatory & HTML security audit
 * for session 0804e222 (T23 / T24).
 *
 * Complements scripts/verify.mjs (S01–S17) and npm test (/site/ suite) without
 * replacing either. Exit code is non-zero if ANY assertion fails.
 */
import { readFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const readJson = async (p) => JSON.parse(await readFile(join(ROOT, p), 'utf8'));

const rings = await readJson('data/rings.json');
const retailersDoc = await readJson('data/retailers.json');
const sourcesDoc = await readJson('data/sources.json');
const flagged = await readJson('data/flagged.json');
const gold = await readJson('data/gold-price.json');
const checklist = await readJson('data/checklist.json');
const reverification = await readJson('data/reverification.json');
const latestChecks = await readJson('data/checks/latest.json');

const results = [];
let totalAssertions = 0;

function checkGroup(id, name, fn) {
  const failures = [];
  const assert = (cond, msg) => {
    totalAssertions++;
    if (!cond) failures.push(msg);
  };
  return Promise.resolve(fn(assert)).then(() => {
    results.push({ id, name, passed: failures.length === 0, failures });
  });
}

/* A01: Zero-loss preservation of all prior session work */
await checkGroup('A01', 'Zero-loss preservation of prior sessions', async (assert) => {
  assert(rings.rows.length >= 59, `Expected >= 59 rings after integration, got ${rings.rows.length}`);
  for (const mustKeep of ['rs-571221', 'rs-571222', 'rs-571213', 'rs-999230', 'bn-14k-ccf-203284', 'mej-2mm', 'be-18k-6p-121h6', 'au-cigar']) {
    assert(rings.rows.some((r) => r.id === mustKeep), `Missing inherited row ${mustKeep}`);
  }
  for (let i = 1; i <= 36; i++) {
    if (i === 15) continue; // historical F15 gap from earlier pass
    const fid = `F${String(i).padStart(2, '0')}`;
    assert(flagged.items.some((f) => f.id === fid), `Missing inherited flag ${fid}`);
  }
  assert(existsSync(join(ROOT, 'site/index.html')), 'Standalone /site/index.html must remain intact');
  assert(existsSync(join(ROOT, 'research/candidates.json')), 'Standalone research/candidates.json must remain intact');
  assert(existsSync(join(ROOT, 'docs/index.html')), 'Archived docs/index.html must remain intact');
});

/* A02: Full karat-spectrum & millesimal provenance */
await checkGroup('A02', '10K / 14K / 18K / 24K karat & 750/1000 provenance', async (assert) => {
  for (const k of ['10K', '14K', '18K', '24K']) {
    assert(rings.rows.some((r) => r.karat === k), `Dataset missing karat tier ${k}`);
  }
  for (const r of rings.rows) {
    const num = r.karat.replace(/[^0-9]/g, '');
    const text = `${r.title} ${r.evidence}`;
    const hasK = new RegExp(`\\b${num}\\s?k`, 'i').test(text) || text.toLowerCase().includes(`${num}kt`);
    const has750 = num === '18' && /\b750\/1000\b/.test(text);
    assert(hasK || has750, `${r.id}: neither ${r.karat} nor millesimal fineness appears in title/evidence`);
  }
});

/* A03: NIST conversion & weight/melt physics */
await checkGroup('A03', 'NIST 31.1034768 g/ozt & published-weight discipline', async (assert) => {
  assert(gold.grams_per_troy_ounce === 31.1034768, 'grams_per_troy_ounce must equal exact 31.1034768');
  assert(gold.true_grains_per_troy_ounce === 480, 'true_grains_per_troy_ounce must equal exact 480');
  const weighted = rings.rows.filter((r) => r.weight_g_low !== null);
  assert(weighted.length >= 21, `Expected >= 21 weighted rings, got ${weighted.length}`);
  for (const r of rings.rows) {
    if (r.id.startsWith('mene-')) {
      assert(r.weight_g_low === null, `${r.id}: static HTML has no gram number; weight_g_low must stay null`);
    }
    if (r.weight_g_low !== null) {
      assert(!(r.flags || []).includes('weight_not_published'), `${r.id}: weighted row still carries weight_not_published`);
    }
  }
});

/* A04: Solid-gold & FTC 16 CFR § 23.3(c)(1) consistency */
await checkGroup('A04', 'Solid-gold boolean vs flags & FTC § 23.3(c)(1) rule', async (assert) => {
  for (const r of rings.rows) {
    if (r.solid_stated) {
      assert(/solid/i.test(r.evidence), `${r.id}: solid_stated=true without "solid" in evidence`);
      assert(!(r.flags || []).includes('solid_not_stated'), `${r.id}: solid_stated=true contradicts solid_not_stated flag`);
    } else {
      assert((r.flags || []).includes('solid_not_stated'), `${r.id}: solid_stated=false must carry solid_not_stated flag`);
    }
  }
  const c2 = JSON.stringify(checklist.items[1]);
  assert(c2.includes('23.3(c)(1)') && /hollow/i.test(c2), 'Checklist item 2 must cite 16 CFR § 23.3(c)(1) non-hollow rule');
});

/* A05: 100% retailer policy, contact & BBB traceability */
await checkGroup('A05', 'Retailer policy, contact, BBB & row-count parity', async (assert) => {
  assert(retailersDoc.retailers.length >= 10, `Expected >= 10 retailers, got ${retailersDoc.retailers.length}`);
  let sumRows = 0;
  for (const ret of retailersDoc.retailers) {
    const actual = rings.rows.filter((r) => r.retailer_id === ret.id).length;
    assert(ret.rows === actual, `${ret.id}: retailers.json rows=${ret.rows} != actual ${actual}`);
    sumRows += ret.rows;
    assert(ret.contact_verified === true && Boolean(ret.phone || ret.email), `${ret.id}: contact not verified`);
    assert(ret.return_policy_verified === true && Boolean(ret.return_summary), `${ret.id}: return policy not verified`);
    assert(/^https:\/\//.test(ret.return_source || ''), `${ret.id}: return_source not https`);
    assert(/^https:\/\//.test(ret.bbb_source || ''), `${ret.id}: bbb_source not https`);
    const hasRetrievedSource = sourcesDoc.sources.some(
      (s) => s.status === 'retrieved' && s.url.includes(ret.domain)
    );
    assert(hasRetrievedSource, `${ret.id}: missing retrieved entry for ${ret.domain} in sources.json`);
  }
  assert(sumRows === rings.rows.length, `Retailer row counts sum ${sumRows} != ${rings.rows.length}`);
});

/* A06: 100% bijective re-verification ledger */
await checkGroup('A06', '100% bijective re-verification ledger', async (assert) => {
  assert(
    reverification.entries.length === rings.rows.length,
    `Ledger entries (${reverification.entries.length}) != rings (${rings.rows.length})`
  );
  const byRow = new Map(reverification.entries.map((e) => [e.row, e]));
  for (const r of rings.rows) {
    assert(Boolean(r.reverified_at), `${r.id}: missing reverified_at`);
    const e = byRow.get(r.id);
    assert(Boolean(e), `${r.id}: missing ledger entry`);
    if (e) {
      assert(e.source_url === r.source_url, `${r.id}: ledger URL mismatch`);
      assert(typeof e.quote === 'string' && e.quote.length >= 20, `${r.id}: ledger quote too short`);
    }
  }
});

/* A07: GIA XRF limits, CFPB FCBA & front-page no-hallucinations banner */
await checkGroup('A07', 'GIA 2024/2025 XRF warnings, CFPB FCBA & front-page rule banner', async (assert) => {
  const indexHtml = await readFile(join(ROOT, 'index.html'), 'utf8');
  const heroIdx = indexHtml.indexOf('<main id="main">');
  const bannerIdx = indexHtml.indexOf('No hallucinations — the rule this whole project runs on');
  assert(bannerIdx > heroIdx && bannerIdx - heroIdx < 1600, 'No-hallucinations rule banner must appear in top hero summary of index.html');
  const clJson = JSON.stringify(checklist);
  assert(clJson.includes('spring-2024-lab-notes-electroformed-gold-bracelet'), 'Checklist must cite GIA 2024 electroformed Lab Note');
  assert(clJson.includes('summer-2025-lab-notes-gold-plated-gold'), 'Checklist must cite GIA 2025 Gold-Plated Gold Lab Note');
  assert(clJson.includes('consumerfinance.gov/ask-cfpb'), 'Checklist must cite official CFPB credit-card dispute guidance');
});

/* A08: HTML security, XSS, rel=noopener & secret-leak scan */
await checkGroup('A08', 'HTML security, rel=noopener, XSS & secret scan', async (assert) => {
  const htmlFiles = [];
  async function walk(dir) {
    for (const ent of await readdir(dir, { withFileTypes: true })) {
      if (ent.name.startsWith('.') || ['node_modules', 'dist', 'data', 'scripts', 'assets', 'site', 'docs', 'tools', 'research', 'tests'].includes(ent.name)) continue;
      const p = join(dir, ent.name);
      if (ent.isDirectory()) await walk(p);
      else if (ent.name.endsWith('.html')) htmlFiles.push(p);
    }
  }
  await walk(ROOT);
  const ringDetailFiles = htmlFiles.filter((p) => p.includes('/rings/'));
  assert(ringDetailFiles.length === rings.rows.length, `Expected ${rings.rows.length} ring detail HTML pages, found ${ringDetailFiles.length}`);
  assert(htmlFiles.length >= rings.rows.length + 15, `Expected >= ${rings.rows.length + 15} HTML pages, found ${htmlFiles.length}`);

  const inlineHandlerRe = /\son[a-z]+\s*=/i;
  const badProtoRe = /(?:href|src)\s*=\s*["']\s*(?:javascript:|vbscript:|data:text\/html)/i;
  const secretRe = /\b(?:ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|sk-[A-Za-z0-9]{30,}|AKIA[0-9A-Z]{16})\b/;

  for (const f of htmlFiles) {
    const html = await readFile(f, 'utf8');
    const rel = f.replace(ROOT + '/', '');
    assert(!inlineHandlerRe.test(html), `${rel}: contains inline event handler attribute`);
    assert(!badProtoRe.test(html), `${rel}: contains dangerous URI scheme`);
    assert(!secretRe.test(html), `${rel}: contains potential credential token`);
    for (const m of html.matchAll(/<a\b[^>]*target=["']_blank["'][^>]*>/gi)) {
      assert(/\brel=["'][^"']*noopener/i.test(m[0]), `${rel}: target="_blank" link missing rel="noopener": ${m[0]}`);
    }
  }
});

/* A09: Dynamic filter & calculator parity */
await checkGroup('A09', 'Dynamic karat filter & calculator parity', async (assert) => {
  const indexHtml = await readFile(join(ROOT, 'index.html'), 'utf8');
  for (const k of ['10K', '14K', '18K', '24K']) {
    assert(indexHtml.includes(`<option value="${k}">${k}</option>`), `index.html karat filter missing ${k}`);
  }
  const calcHtml = await readFile(join(ROOT, 'calculator.html'), 'utf8');
  assert(calcHtml.includes('31.1034768'), 'calculator.html must display exact 31.1034768 g/ozt divisor');
  assert(calcHtml.includes(`value="${gold.primary.price_usd_per_ozt.toFixed(2)}"`), 'calculator.html spot input mismatch');
});

/* A10: Pass-ID synchronization across index.html, checks.html & latest.json */
await checkGroup('A10', 'Pass-ID & zero-failure synchronization', async (assert) => {
  assert(latestChecks.summary.failed === 0, `latest.json reports ${latestChecks.summary.failed} failures`);
  assert(latestChecks.summary.rows === rings.rows.length, `latest.json rows=${latestChecks.summary.rows} != ${rings.rows.length}`);
  const indexHtml = await readFile(join(ROOT, 'index.html'), 'utf8');
  const checksHtml = await readFile(join(ROOT, 'checks.html'), 'utf8');
  assert(indexHtml.includes(`<strong>${latestChecks.pass}</strong>`), `index.html out of sync with ${latestChecks.pass}`);
  assert(checksHtml.includes(`<strong>${latestChecks.pass}</strong>`), `checks.html out of sync with ${latestChecks.pass}`);
});

const failedGroups = results.filter((g) => !g.passed);
for (const g of results) {
  console.log(`[${g.passed ? 'PASS' : 'FAIL'}] ${g.id} ${g.name}${g.failures.length ? ' — ' + g.failures.join('; ') : ''}`);
}
console.log(`audit_0804e222 summary: ${results.length - failedGroups.length}/${results.length} groups passed (${totalAssertions} assertions)`);

if (failedGroups.length > 0) process.exit(1);
