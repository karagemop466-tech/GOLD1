#!/usr/bin/env node
/**
 * Deep anti-hallucination, title-identity, 5-karat-tier, prose-parity & security audit
 * for session 545688f3 (`H01`–`H12`).
 *
 * Runs alongside `scripts/verify.mjs` (`S01`–`S20`), `scripts/audit_0804e222.mjs` (`A01`–`A10`),
 * and `npm test` (`/site/` suite). Exits non-zero if ANY assertion fails.
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
const compliance = await readJson('data/compliance.json');
const ver23 = await readJson('data/verification-2026-10-23.json');
const latestChecks = await readJson('data/checks/latest.json');

const results = [];
let totalAssertions = 0;

async function checkGroup(id, name, fn) {
  const failures = [];
  const assert = (cond, msg) => {
    totalAssertions++;
    if (!cond) failures.push(msg);
  };
  await fn(assert);
  results.push({ id, name, passed: failures.length === 0, failures });
}

/* H01: Complete 5-tier legal karat spectrum (10K / 14K / 18K / 22K / 24K) */
await checkGroup('H01', 'Complete 5-tier karat spectrum (10K / 14K / 18K / 22K / 24K)', async (assert) => {
  for (const k of ['10K', '14K', '18K', '22K', '24K']) {
    const count = rings.rows.filter((r) => !r.withdrawn && r.karat === k).length;
    assert(count >= 2, `Expected >= 2 active verified rows in ${k}, got ${count}`);
  }
  assert(rings.rows.length >= 71, `Expected >= 71 total rows, got ${rings.rows.length}`);
});

/* H02: Title-to-evidence identity guard & rs-939479 withdrawal verification */
await checkGroup('H02', 'Title-to-evidence identity guard & rs-939479 F51 withdrawal', async (assert) => {
  const rs939479 = rings.rows.find((r) => r.id === 'rs-939479');
  assert(Boolean(rs939479), 'Missing rs-939479');
  if (rs939479) {
    assert(rs939479.withdrawn === true, 'rs-939479 must stay withdrawn=true (F51)');
    assert(rs939479.price_unverified === true, 'rs-939479 must carry price_unverified=true');
  }
  assert(flagged.items.some((f) => f.id === 'F51' && /Claddagh/i.test(f.finding)), 'Flag F51 must document SKU 939479 Claddagh mismatch');
  const stop = new Set([
    'the', 'and', 'for', 'with', 'in', 'of', 'ring', 'band', 'gold', 'yellow', 'white',
    'rose', 'solid', 'variant', 'size', 'pure', '10k', '14k', '18k', '22k', '24k',
    '10kt', '14kt', '18kt', '22kt', '24kt',
  ]);
  for (const r of rings.rows) {
    if (r.withdrawn) continue;
    const cleanTitle = r.title.replace(/\(.*?\)/g, ' ').replace(/[—–\-/,.:]/g, ' ');
    const tokens = cleanTitle
      .toLowerCase()
      .split(/\s+/)
      .filter((t) => t.length >= 3 && !stop.has(t));
    const evLower = (r.evidence || '').toLowerCase();
    if (tokens.length > 0) {
      const matched = tokens.filter((t) => evLower.includes(t));
      assert(
        matched.length >= 1,
        `${r.id}: zero distinctive title tokens (${tokens.join(',')}) appear in evidence`
      );
    }
  }
});

/* H03: Non-guessing discipline on ambiguous ('Approximate Fine Weight') & JS-rendered weights */
await checkGroup('H03', 'Non-guessing discipline on Auvere 22K & Menē 24K weights', async (assert) => {
  for (const r of rings.rows) {
    if (r.retailer_id === 'auvere') {
      assert(r.karat === '22K', `${r.id}: expected 22K for Auvere row`);
      assert(
        r.weight_g_low === null && r.weight_g_high === null,
        `${r.id}: Auvere 'Approximate Fine Weight' is ambiguous and must remain null`
      );
      assert(
        (r.flags || []).includes('weight_not_published'),
        `${r.id}: Auvere null weight must carry weight_not_published flag`
      );
      assert(
        /Approximate Fine Weight/i.test(r.evidence || ''),
        `${r.id}: Auvere evidence must quote verbatim 'Approximate Fine Weight' range`
      );
    }
    if (r.retailer_id === 'mene') {
      assert(r.weight_g_low === null, `${r.id}: Menē JS-rendered weight must stay null`);
    }
  }
});

/* H04: Multi-karat published weight breadth & parcel-weight anti-trap */
await checkGroup('H04', 'Published gram weights across 10K/14K/18K & Shopify parcel guard', async (assert) => {
  const totalWeighted = rings.rows.filter((r) => r.weight_g_low !== null);
  const weighted = rings.rows.filter((r) => !r.withdrawn && r.weight_g_low !== null);
  assert(totalWeighted.length >= 25, `Expected >= 25 total weighted rings, got ${totalWeighted.length}`);
  assert(weighted.length >= 24, `Expected >= 24 active weighted rings, got ${weighted.length}`);
  for (const k of ['10K', '14K', '18K']) {
    const kWeighted = weighted.filter((r) => r.karat === k).length;
    assert(kWeighted >= 2, `Expected >= 2 active weighted rings in ${k}, got ${kWeighted}`);
  }
  for (const r of weighted) {
    assert(
      r.weight_g_low > 0 && r.weight_g_low <= 30 && r.weight_g_low !== 113 && r.weight_g_low !== 227,
      `${r.id}: implausible or parcel-shipping weight ${r.weight_g_low} g`
    );
  }
});

/* H05: 11-retailer policy, contact, BBB, compliance & ver23 parity */
await checkGroup('H05', '11-retailer policy, contact, BBB, compliance & ver23 parity', async (assert) => {
  assert(retailersDoc.retailers.length === 11, `Expected 11 retailers, got ${retailersDoc.retailers.length}`);
  assert(compliance.rows.length === rings.rows.length, `compliance.rows (${compliance.rows.length}) != rings (${rings.rows.length})`);
  assert(ver23.rows.length === rings.rows.length, `ver23.rows (${ver23.rows.length}) != rings (${rings.rows.length})`);
  assert(ver23.summary.not_read === 0, `Expected 0 unread rows on 2026-10-23 after seventh-pass fetches, got ${ver23.summary.not_read}`);
  const auvere = retailersDoc.retailers.find((r) => r.id === 'auvere');
  assert(Boolean(auvere), 'Missing auvere in data/retailers.json');
  if (auvere) {
    assert(auvere.bbb_rating === 'A+', `Expected Auvere BBB A+, got ${auvere.bbb_rating}`);
    assert(/15 days/i.test(auvere.return_summary), 'Auvere return_summary must disclose 15-day window');
  }
  let sum = 0;
  for (const ret of retailersDoc.retailers) {
    const actual = rings.rows.filter((r) => r.retailer_id === ret.id).length;
    assert(ret.rows === actual, `${ret.id}: retailers.json rows=${ret.rows} != ${actual}`);
    sum += ret.rows;
    assert(ret.contact_verified && (ret.phone || ret.email), `${ret.id}: unverified contact`);
    assert(ret.return_policy_verified && /^https:\/\//.test(ret.return_source), `${ret.id}: unverified return source`);
    assert(/^https:\/\//.test(ret.bbb_source), `${ret.id}: missing https bbb_source`);
    assert(
      sourcesDoc.sources.some((s) => s.status === 'retrieved' && s.url.includes(ret.domain)),
      `${ret.id}: domain ${ret.domain} missing from retrieved sources.json`
    );
  }
  assert(sum === rings.rows.length, `Sum of retailer rows (${sum}) != total rows (${rings.rows.length})`);
});

/* H06: Unverified spec purge & mandatory Flagged-for-Review disclosures */
await checkGroup('H06', 'Unverified Mejuri thickness purge & new Flagged disclosures', async (assert) => {
  const dlr = rings.rows.find((r) => r.id === 'mej-10k-dlr');
  const sig = rings.rows.find((r) => r.id === 'mej-10k-sig');
  assert(!/1\.45\s*mm/i.test(dlr?.evidence || ''), 'mej-10k-dlr still contains unverified 1.45 mm thickness');
  assert(!/1\.2\s*mm/i.test(sig?.evidence || ''), 'mej-10k-sig still contains unverified 1.2 mm thickness');
  for (const key of [
    'F_SOURCE_SKU_REPURPOSED',
    'auvere-22k-fine-weight-ambiguity',
    'auvere-15day-vs-30day-returns',
    'mejuri-gallery-alt-metal-mismatch',
    'ross-simons-gold-over-sterling-search-traps',
    'spot-repricing-2026-10-23',
  ]) {
    assert(
      flagged.items.some((f) => f.temp_key === key),
      `Missing mandatory audit flag temp_key="${key}" in data/flagged.json`
    );
  }
  for (const f of flagged.items) {
    assert(Boolean(f.type && f.buyer_action), `Flag ${f.id} missing type or buyer_action`);
  }
});

/* H07: Federal statutory, metrological & gemological primary-source anchors */
await checkGroup('H07', '16 CFR Part 23, 15 U.S.C. §§ 295/297, NIST, CFPB & GIA anchors', async (assert) => {
  const srcBlob = JSON.stringify(sourcesDoc);
  const clBlob = JSON.stringify(checklist);
  assert(srcBlob.includes('law.cornell.edu/uscode/text/15/295'), 'sources.json missing 15 U.S.C. § 295 link');
  assert(clBlob.includes('law.cornell.edu/uscode/text/15/297'), 'checklist.json missing 15 U.S.C. § 297 link');
  assert(clBlob.includes('23.3(c)(1)'), 'checklist.json missing 16 CFR § 23.3(c)(1)');
  assert(clBlob.includes('31.1034768'), 'checklist.json missing exact NIST 31.1034768 g/ozt');
  assert(clBlob.includes('spring-2024-lab-notes-electroformed-gold-bracelet'), 'checklist.json missing GIA 2024 Lab Note');
  assert(clBlob.includes('summer-2025-lab-notes-gold-plated-gold'), 'checklist.json missing GIA 2025 Lab Note');
});

/* H08: 2026-10-23 live market spot & dynamic repricing freshness */
await checkGroup('H08', '2026-10-23 live gold spot & Menē/Blue Nile price freshness', async (assert) => {
  assert(
    (gold.primary.publisher_timestamp || '').startsWith('2026-10-23T'),
    `Expected 2026-10-23 gold timestamp, got ${gold.primary.publisher_timestamp}`
  );
  assert(/^https:\/\//.test(gold.primary.source_url || ''), 'gold.primary.source_url missing');
  assert(gold.grams_per_troy_ounce === 31.1034768, 'Exact NIST grams_per_troy_ounce broken');
  assert(gold.true_grains_per_troy_ounce === 480, 'Exact troy grains_per_troy_ounce broken');
  const mc = rings.rows.find((r) => r.id === 'mene-24k-classic-band');
  const mn = rings.rows.find((r) => r.id === 'mene-24k-narrow-band');
  const bn = rings.rows.find((r) => r.id === 'bn-14k-petite-195639');
  /*
   * Amended by sess-7626fc93 (ninth pass, 2026-10-23). These two lines used to assert the literal
   * prices Menē displayed when the check was written (1707 / 1361). Menē prices pure-gold bands off
   * live spot and repriced intraday to 1,694 / 1,350 on 2026-10-23, so the row was correct and the
   * test was wrong - which is the failure mode of a hardcoded price in an auditor: on the day the
   * source moves, the test starts defending a stale figure. The intent is kept and tightened: the
   * row must equal the figure that the verification ledger's quoted price correction says the
   * official page shows, the quote must contain that figure, and the read must be from today. With
   * no quoted correction on file the previous literal still applies, so reverting the data without
   * a quote cannot pass this check.
   */
  const quotedPrice = (id, fallback) => {
    const c = (ver23.corrections || []).find((x) => x.row === id && x.field === 'price' && x.quote && Number(x.to?.[0]) > 0);
    if (!c) return { expect: fallback, ok: fallback !== null, note: `no quoted price correction on file for ${id}, so the audited literal ${fallback} still applies` };
    const inQuote = String(c.quote).replace(/,/g, '').includes(String(c.to[0]));
    return { expect: Number(c.to[0]), ok: inQuote && String(c.read_at || '').startsWith('2026-10-23'), note: `correction ${c.change_id || c.id} quotes "${String(c.quote).slice(0, 70)}"` };
  };
  for (const [id, fallback] of [['mene-24k-classic-band', 1707], ['mene-24k-narrow-band', 1361]]) {
    const row = rings.rows.find((r) => r.id === id);
    const q = quotedPrice(id, fallback);
    assert(row?.price_low === q.expect, `${id}: stored price ${row?.price_low} is not the figure the ledger says the official page quoted (${q.note})`);
    assert(q.ok, `${id}: the price correction behind this row is not quote-backed or not dated 2026-10-23 (${q.note})`);
  }
  assert(bn?.price_low === 1000, `Expected bn-14k-petite-195639=1000, got ${bn?.price_low}`);
});

/* H09: Prose-to-JSON synchronization across README.md & COORDINATION.md §13 */
await checkGroup('H09', 'Prose-to-JSON synchronization in README.md & COORDINATION.md', async (assert) => {
  const readme = await readFile(join(ROOT, 'README.md'), 'utf8');
  const coord = await readFile(join(ROOT, 'COORDINATION.md'), 'utf8');
  const kc = rings.rows.reduce((a, r) => ((a[r.karat] = (a[r.karat] || 0) + 1), a), {});
  assert(
    readme.includes(`${rings.rows.length} listings`) || readme.includes(`${rings.rows.length} verified listings`),
    `README.md missing exact "${rings.rows.length}" total listing count`
  );
  for (const k of ['10K', '14K', '18K', '22K', '24K']) {
    assert(
      readme.includes(`${k} (${kc[k]})`),
      `README.md missing exact karat count "${k} (${kc[k]})"`
    );
  }
  assert(
    readme.includes(`${retailersDoc.retailers.length} retailers`),
    `README.md missing "${retailersDoc.retailers.length} retailers"`
  );
  for (const bad of [
    '(`10K`, `$129`',
    '(`14K`, `$569`',
    'Ring, `$298`)',
    'Ring, `$398`)',
    '(`$479`, `1.62 g`)',
    '(`$750`, `1.4 g`)',
    '(`$1,550`, `3.7 g`)',
    '(`$1,650`, `3.7 g`)',
    '(`$1,390`)',
    '(`$4,150`)',
    '(`$860`)',
    '(`$1,590`)',
  ]) {
    assert(!coord.includes(bad), `COORDINATION.md still contains uncorrected hallucinated price string: ${bad}`);
  }
});

/* H10: Front-page No-Hallucinations rule & active reader audit recommendation */
await checkGroup('H10', 'Front-page No-Hallucinations rule & look-for-hallucinations notice', async (assert) => {
  const indexHtml = await readFile(join(ROOT, 'index.html'), 'utf8');
  const mainPos = indexHtml.indexOf('<main id="main">');
  const rulePos = indexHtml.indexOf('No hallucinations — the rule this whole project runs on');
  assert(rulePos > mainPos && rulePos - mainPos < 1600, 'No-hallucinations banner missing from top of index.html');
  assert(
    /look for hallucinations/i.test(indexHtml),
    'index.html must explicitly recommend looking for hallucinations against official links'
  );
  assert(indexHtml.includes('<option value="22K">22K</option>'), 'index.html karat filter missing 22K');
});

/* H11: HTML/JSON/Markdown security, XSS, rel=noopener & credential-leak scan */
await checkGroup('H11', 'HTML/JSON/MD security, XSS, rel=noopener & secret scan', async (assert) => {
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
  const inlineHandlerRe = /\son[a-z]+\s*=/i;
  const badProtoRe = /(?:href|src)\s*=\s*["']\s*(?:javascript:|vbscript:|data:text\/html)/i;
  const secretRe = /\b(?:ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|sk-[A-Za-z0-9]{30,}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,})\b/;

  for (const f of htmlFiles) {
    const html = await readFile(f, 'utf8');
    const rel = f.replace(ROOT + '/', '');
    assert(!inlineHandlerRe.test(html), `${rel}: inline event handler`);
    assert(!badProtoRe.test(html), `${rel}: dangerous URI scheme`);
    assert(!secretRe.test(html), `${rel}: leaked credential pattern`);
    for (const m of html.matchAll(/<a\b[^>]*target=["']_blank["'][^>]*>/gi)) {
      assert(/\brel=["'][^"']*noopener/i.test(m[0]), `${rel}: target="_blank" missing rel="noopener"`);
    }
  }
  for (const metaFile of ['README.md', 'COORDINATION.md']) {
    const txt = await readFile(join(ROOT, metaFile), 'utf8');
    assert(!secretRe.test(txt), `${metaFile}: leaked credential pattern`);
  }
});

/* H12: Zero-loss peer preservation & pass-ID synchronization */
await checkGroup('H12', 'Zero-loss peer preservation & pass-ID synchronization', async (assert) => {
  assert(latestChecks.summary.failed === 0, `latest.json has ${latestChecks.summary.failed} failed checks`);
  assert(latestChecks.summary.rows === rings.rows.length, `latest.json rows=${latestChecks.summary.rows} != ${rings.rows.length}`);
  const indexHtml = await readFile(join(ROOT, 'index.html'), 'utf8');
  const checksHtml = await readFile(join(ROOT, 'checks.html'), 'utf8');
  assert(indexHtml.includes(`<strong>${latestChecks.pass}</strong>`), `index.html pass out of sync with ${latestChecks.pass}`);
  assert(checksHtml.includes(`<strong>${latestChecks.pass}</strong>`), `checks.html pass out of sync with ${latestChecks.pass}`);
  for (const reqPath of [
    'site/index.html',
    'docs/index.html',
    'research/candidates.json',
    'requirements.html',
    'recheck.html',
    'data/compliance.json',
    'data/verification-2026-10-23.json',
    'data/session-0804e222/new-rings.json',
    'data/session-545688f3/new-rings.json',
    'data/session-545688f3/retailer-auvere.json',
    'data/session-545688f3/repo-audit.json',
  ]) {
    assert(existsSync(join(ROOT, reqPath)), `Missing preserved deliverable ${reqPath}`);
  }
});

const failedGroups = results.filter((g) => !g.passed);
for (const g of results) {
  console.log(`[${g.passed ? 'PASS' : 'FAIL'}] ${g.id} ${g.name}${g.failures.length ? ' — ' + g.failures.join('; ') : ''}`);
}
console.log(`audit_545688f3 summary: ${results.length - failedGroups.length}/${results.length} groups passed (${totalAssertions} assertions)`);

if (failedGroups.length > 0) process.exit(1);
