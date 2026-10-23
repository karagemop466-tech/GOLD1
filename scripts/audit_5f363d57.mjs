#!/usr/bin/env node
/**
 * Independent semantic/provenance audit for GOLD1 (sess-5f363d57).
 *
 * The inherited suites establish that many values occur somewhere in evidence.
 * This audit checks the next layer: active/withdrawn counting, exact numeric
 * tokens, verdict-to-observation agreement, no averaged variant prices, honest
 * checklist states, current prose, and unsupported retail-value generalisations.
 *
 * It is deliberately read-only except for its isolated JSON report. It does not
 * fetch a retailer and must never be described as a live source re-read.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const OUT = 'data/session-5f363d57/repo-audit.json';
const noFail = process.argv.includes('--no-fail');
const readJson = async (p) => JSON.parse(await readFile(join(ROOT, p), 'utf8'));
const readText = async (p) => readFile(join(ROOT, p), 'utf8');

const [ringsDoc, retailersDoc, flagsDoc, gold, checklist, compliance, verification, sourcesDoc] =
  await Promise.all([
    readJson('data/rings.json'),
    readJson('data/retailers.json'),
    readJson('data/flagged.json'),
    readJson('data/gold-price.json'),
    readJson('data/checklist.json'),
    readJson('data/compliance.json'),
    readJson('data/verification-2026-10-23.json'),
    readJson('data/sources.json'),
  ]);
const [readme, complianceBuilder, siteBuilder, appJs, indexHtml, verifySource] = await Promise.all([
  readText('README.md'),
  readText('scripts/build_compliance.mjs'),
  readText('scripts/build.mjs'),
  readText('assets/js/app.js'),
  readText('index.html'),
  readText('scripts/verify.mjs'),
]);
const eveningVerification = existsSync(join(ROOT, 'data/verification-2026-10-23-evening-dab93754.json'))
  ? await readJson('data/verification-2026-10-23-evening-dab93754.json')
  : { rows: [], findings: [] };
const checklistText = JSON.stringify(checklist);

const rows = ringsDoc.rows;
const active = rows.filter((r) => !r.withdrawn);
const withdrawn = rows.filter((r) => r.withdrawn);
const retailers = Object.fromEntries(retailersDoc.retailers.map((r) => [r.id, r]));
const verById = Object.fromEntries(verification.rows.map((r) => [r.id, r]));
const eveningById = Object.fromEntries(eveningVerification.rows.map((r) => [r.id, r]));
const freshnessFlags = Object.fromEntries((eveningVerification.findings || []).map((f) => [f.id, f]));
const complianceById = Object.fromEntries(compliance.rows.map((r) => [r.id, r]));
const groups = [];
const findings = [];
let assertions = 0;

function sourceFor(r) {
  return r?.source_url ? [r.source_url] : [];
}

function fail(group, message, { id = group, severity = 'high', row = null, path = null, sources = [] } = {}) {
  const r = row ? rows.find((x) => x.id === row) : null;
  findings.push({
    id: `${group}-${String(findings.filter((f) => f.id.startsWith(group + '-')).length + 1).padStart(2, '0')}`,
    group,
    irregularity_id: id,
    severity,
    message,
    row: row || null,
    path,
    sources: [...sourceFor(r), ...sources],
  });
}

async function group(id, name, fn) {
  const before = findings.length;
  await fn((message, options) => fail(id, message, options));
  const own = findings.slice(before);
  groups.push({ id, name, passed: own.length === 0, failure_count: own.length });
}

function check(condition, failure, message, options) {
  assertions++;
  if (!condition) failure(message, options);
}

function exactNumber(text, value) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return false;
  const n = Number(value);
  const normalized = String(text || '').replace(/,/g, '');
  // Compare complete numeric tokens numerically: 7, 7.0 and 7.00 are the same
  // seller quantity; 7 must not match 70, and 1.4 must not match 11.4.
  return [...normalized.matchAll(/(?<!\d)\d+(?:\.\d+)?(?!\d)/g)]
    .some((m) => Number(m[0]) === n);
}

const round = (n, places = 2) => Number(n.toFixed(places));
const perGram = gold.primary.price_usd_per_ozt / gold.grams_per_troy_ounce;

/* R01 — exact row-level provenance, not substring coincidence. */
await group('R01', 'Exact row schema and numeric-token provenance', async (failure) => {
  const ids = new Set();
  const urls = new Set();
  for (const r of rows) {
    check(r.id && !ids.has(r.id), failure, `Duplicate or missing row id: ${r.id || '(missing)'}`, { row: r.id, path: 'data/rings.json' });
    ids.add(r.id);
    check(r.source_url && !urls.has(r.source_url), failure, `${r.id}: duplicate or missing official source URL`, { row: r.id, path: 'data/rings.json' });
    urls.add(r.source_url);
    let u = null;
    try { u = new URL(r.source_url); } catch { /* reported below */ }
    check(u?.protocol === 'https:', failure, `${r.id}: source is not HTTPS`, { row: r.id, path: 'data/rings.json' });
    check(u && retailers[r.retailer_id] && (u.hostname === retailers[r.retailer_id].domain || u.hostname.endsWith('.' + retailers[r.retailer_id].domain)), failure, `${r.id}: source host is outside the retailer domain`, { row: r.id, path: 'data/rings.json' });
    check(u && ![...u.searchParams.keys()].some((k) => /^(utm_|aff|affiliate|ref$|referral)/i.test(k)), failure, `${r.id}: tracking/affiliate parameter in evidence URL`, { row: r.id, path: 'data/rings.json' });
    check(typeof r.evidence === 'string' && r.evidence.length >= 25, failure, `${r.id}: evidence is absent or too short`, { row: r.id, path: 'data/rings.json' });
    if (!r.price_unverified) {
      check(exactNumber(r.evidence, r.price_low), failure, `${r.id}: price_low is not an exact numeric token in evidence`, { row: r.id, path: 'data/rings.json' });
      if (r.price_high !== null && r.price_high !== undefined) {
        check(exactNumber(r.evidence, r.price_high), failure, `${r.id}: price_high is not an exact numeric token in evidence`, { row: r.id, path: 'data/rings.json' });
      }
    }
    if (r.weight_g_low !== null && r.weight_g_low !== undefined) {
      check(exactNumber(r.evidence, r.weight_g_low), failure, `${r.id}: weight lower bound is not an exact numeric token in evidence`, { row: r.id, path: 'data/rings.json' });
      if (r.weight_g_high !== null && r.weight_g_high !== undefined) {
        check(exactNumber(r.evidence, r.weight_g_high), failure, `${r.id}: weight upper bound is not an exact numeric token in evidence`, { row: r.id, path: 'data/rings.json' });
      }
    }
    if (r.solid_stated) {
      check(/\bsolid\b/i.test(r.evidence) && !/(?:never|does not|doesn't|absent|not)\s+(?:use|say|state|contain)?\s*\w*\s*["“]?solid/i.test(r.evidence), failure, `${r.id}: solid_stated may be based on auditor negation rather than a seller claim`, { row: r.id, path: 'data/rings.json' });
    }
  }
});

/* R02 — the stored verdict must agree with that ledger row's own observations. */
await group('R02', 'Verification verdicts agree with observed bounds and weights', async (failure) => {
  for (const r of rows) {
    const v = verById[r.id];
    check(Boolean(v), failure, `${r.id}: no line in the 2026-10-23 verification ledger`, { row: r.id, path: 'data/verification-2026-10-23.json' });
    if (!v) continue;
    check(v.source_url === r.source_url, failure, `${r.id}: verification URL differs from row source`, { row: r.id, path: 'data/verification-2026-10-23.json' });
    if (v.price_verdict === 'confirmed' && v.observed_prices && Number.isFinite(v.observed_prices.min) && Number.isFinite(v.observed_prices.max)) {
      const observed = v.observed_prices;
      const exact = r.price_low === observed.min && r.price_high === observed.max;
      const variantEvidence = `${v.variant_quote || ''} ${v.variant_note || ''}`;
      const variantProof = v.variant_quote && exactNumber(variantEvidence, r.price_low) && exactNumber(variantEvidence, r.price_high);
      const evening = eveningById[r.id];
      const eveningRanges = [evening?.observed_price, evening?.variant_price_range].filter(Array.isArray);
      const eveningProof = evening && ['confirmed', 'confirmed_two_channels'].includes(evening.verdict) &&
        eveningRanges.some((range) => range.length === 2 && range[0] === r.price_low && range[1] === (r.price_high ?? r.price_low));
      check(exact || variantProof || eveningProof, failure, `${r.id}: verdict says confirmed, but neither the original ledger nor the preserved evening variant ledger reproduces stored $${r.price_low}–$${r.price_high}`, {
        row: r.id,
        id: 'PRICE_BOUND_NOT_REPRODUCED',
        path: 'data/verification-2026-10-23.json',
      });
    }
    if (r.weight_g_low !== null && r.weight_g_low !== undefined && v.weight_verdict !== 'confirmed_on_page') {
      const evening = eveningById[r.id];
      const priorQuote = exactNumber(r.evidence, r.weight_g_low) && exactNumber(r.evidence, r.weight_g_high ?? r.weight_g_low);
      const limitationPublished = evening?.weight_reproduced_today === false &&
        Array.isArray(freshnessFlags.F62?.rows) && freshnessFlags.F62.rows.includes(r.id);
      // A failed JavaScript-panel extraction does not erase an earlier verbatim
      // official quote. It is acceptable only when the newer ledger explicitly
      // publishes that limitation instead of calling the weight freshly read.
      const preservedWithFreshnessCaveat = priorQuote && limitationPublished;
      check(r.verification_status !== 'confirmed' || preservedWithFreshnessCaveat, failure, `${r.id}: overall row is confirmed although weight verdict is ${v.weight_verdict}, with no preserved-quote/freshness caveat`, {
        row: r.id,
        id: 'WEIGHT_NOT_REPRODUCED_BUT_ROW_CONFIRMED',
        path: 'data/verification-2026-10-23.json',
      });
    }
  }
});

/* R03 — no average, unpaired range, or source-mismatch melt math. */
await group('R03', 'Requirements math never averages or reuses unverified values', async (failure) => {
  check(!/\(lo\s*\+\s*hi\)\s*\/\s*2/.test(complianceBuilder), failure, 'Requirements builder averages low/high variant prices, contradicting the no-averaging rule', {
    id: 'AVERAGED_VARIANT_PRICE', path: 'scripts/build_compliance.mjs', sources: ['data/rings.json'],
  });
  for (const r of rows) {
    const c = complianceById[r.id];
    check(Boolean(c), failure, `${r.id}: missing requirements row`, { row: r.id, path: 'data/compliance.json' });
    if (!c) continue;
    const rangedPrice = r.price_low !== r.price_high;
    const rangedWeight = r.weight_g_low !== r.weight_g_high;
    if (r.price_unverified || r.withdrawn) {
      check(c.gold_value_usd === null && c.price_to_gold === null, failure, `${r.id}: withdrawn/unverified source still produces gold-value or price-ratio outputs`, {
        row: r.id, id: 'UNVERIFIED_VALUE_COMPUTED', path: 'data/compliance.json',
      });
    }
    if (rangedPrice) {
      check(c.price_to_gold === null, failure, `${r.id}: one scalar ratio was derived from an unmapped price range`, {
        row: r.id, id: 'UNPAIRED_PRICE_RANGE_RATIO', path: 'data/compliance.json',
      });
    }
    if (rangedWeight) {
      check(c.gold_value_usd === null && c.fine_gold_g === null, failure, `${r.id}: only the lower weight bound was used for scalar fine-gold/melt outputs`, {
        row: r.id, id: 'LOWER_BOUND_ONLY_WEIGHT_MATH', path: 'data/compliance.json',
      });
    }
    if (!rangedWeight && r.weight_g_low !== null && r.weight_g_low !== undefined && !r.withdrawn) {
      const fine = r.weight_g_low * (parseInt(r.karat, 10) / 24);
      check(c.fine_gold_g === round(fine, 3), failure, `${r.id}: fine-gold grams do not match weight × karat/24`, { row: r.id, path: 'data/compliance.json' });
      check(c.gold_value_usd === round(fine * perGram, 2), failure, `${r.id}: melt value does not match stored spot and NIST conversion`, { row: r.id, path: 'data/compliance.json' });
    }
  }
});

/* R04 — checklist states must not claim unfinished buyer work or unknown reputation. */
await group('R04', 'Requirements tiers and buyer-action labels are honest', async (failure) => {
  for (const r of rows) {
    const c = complianceById[r.id];
    const v = verById[r.id];
    if (!c) continue;
    if (c.tier === 'ready_to_inspect') {
      check(c.checks.reputation.status === 'confirmed', failure, `${r.id}: ready_to_inspect has no confirmed independent reputation result and no blocker`, {
        row: r.id, id: 'SHORTLIST_REPUTATION_OPEN', path: 'data/compliance.json', sources: [retailers[r.retailer_id]?.bbb_source].filter(Boolean),
      });
    }
    check(c.checks.documentation.status !== 'confirmed', failure, `${r.id}: documentation is marked confirmed although the buyer receipt/post-purchase archive cannot exist yet`, {
      row: r.id, id: 'DOCUMENTATION_BUYER_ACTION_MISLABELED', path: 'data/compliance.json',
    });
    if (/exchange only!|exchange for size only/i.test(v?.final_sale_quote || '')) {
      check(c.checks.returns.status === 'negative', failure, `${r.id}: final-sale/exchange-only product is marked as having a confirmed usable return policy`, {
        row: r.id, id: 'FINAL_SALE_RETURN_MISLABELED', path: 'data/compliance.json',
      });
    }
    if (r.weight_g_low !== null && v?.weight_verdict === 'not_reproduced_on_page') {
      check(c.checks.weight.status !== 'confirmed', failure, `${r.id}: weight is marked confirmed in requirements despite not_reproduced_on_page`, {
        row: r.id, id: 'WEIGHT_REQUIREMENT_OVERSTATED', path: 'data/compliance.json',
      });
    }
  }
});

/* R05 — shared summary prose must use current spot and mathematically possible counts. */
await group('R05', 'Checklist summary matches canonical spot and active/withdrawn counts', async (failure) => {
  const weighted = rows.filter((r) => r.weight_g_low !== null && r.weight_g_low !== undefined);
  const activeWeighted = active.filter((r) => r.weight_g_low !== null && r.weight_g_low !== undefined);
  const withdrawnWeighted = withdrawn.filter((r) => r.weight_g_low !== null && r.weight_g_low !== undefined);
  const weightItem = checklist.items.find((i) => i.requirement.startsWith('Weight:'));
  const spotItem = checklist.items.find((i) => i.requirement.startsWith('Price vs raw gold value:'));
  check(weightItem?.finding.includes(`${weighted.length} of ${rows.length} rows (${activeWeighted.length} active + ${withdrawnWeighted.length} withdrawn)`), failure, `Weight summary must say ${weighted.length} total = ${activeWeighted.length} active + ${withdrawnWeighted.length} withdrawn`, {
    id: 'IMPOSSIBLE_WEIGHT_COUNT', path: 'data/checklist.json', sources: ['data/rings.json'],
  });
  check(spotItem?.finding.includes(gold.primary.publisher_timestamp), failure, 'Checklist spot timestamp is stale relative to data/gold-price.json', {
    id: 'STALE_CHECKLIST_SPOT_TIMESTAMP', path: 'data/checklist.json', sources: [gold.primary.source_url],
  });
  const displayedSpot = gold.primary.price_usd_per_ozt.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
  check(spotItem?.finding.includes(displayedSpot), failure, `Checklist spot prose does not contain current ${displayedSpot}/ozt`, {
    id: 'STALE_CHECKLIST_SPOT_PRICE', path: 'data/checklist.json', sources: [gold.primary.source_url],
  });
});

/* R06 — current README cannot carry forward an older dataset as current. */
await group('R06', 'README current-state prose is synchronized', async (failure) => {
  const current = readme.split('## Current findings')[1] || '';
  for (const stale of ['8 of 59', '59 verified listings', '15 of 59', '21 of 59', '50 of 59', '0 of 59']) {
    check(!current.includes(stale), failure, `README Current findings contains stale dataset phrase “${stale}”`, {
      id: 'STALE_README_CURRENT_FINDINGS', path: 'README.md', sources: ['data/rings.json', 'data/compliance.json'],
    });
  }
  check(!readme.includes('latest full re-read recorded in this repository is **2026-10-22**'), failure, 'README freshness rule names 2026-10-22 although a 2026-10-23 full ledger exists', {
    id: 'STALE_README_FULL_REREAD_DATE', path: 'README.md', sources: ['data/verification-2026-10-23.json'],
  });
  const passSection = readme.split('## The verification passes')[1]?.split('---')[0] || '';
  for (const id of ['S18', 'S19', 'S20']) {
    check(passSection.includes(id), failure, `README verification-pass table omits ${id}`, {
      id: 'INCOMPLETE_AUDIT_DOCUMENTATION', path: 'README.md', sources: ['scripts/verify.mjs'],
    });
  }
});

/* R07 — melt math is not an appraisal or an unsupported “normal price” rule. */
await group('R07', 'No unsupported retail-price or wearability generalisations', async (failure) => {
  for (const [path, text] of [['scripts/build.mjs', siteBuilder], ['assets/js/app.js', appJs]]) {
    check(!/(?:2–6×|2-6×|2–6x|2-6x|normal retail multiple)/i.test(text), failure, `${path} presents an unsourced normal 2–6× retail/melt range`, {
      id: 'UNSUPPORTED_NORMAL_RETAIL_MULTIPLE', path,
    });
  }
  for (const phrase of ['Hardest wearing of these', 'too soft for daily-wear rings', 'The US engagement-ring standard']) {
    check(!siteBuilder.includes(phrase), failure, `Calculator karat table makes unsupported wearability/market claim: “${phrase}”`, {
      id: 'UNSUPPORTED_KARAT_GENERALISATION', path: 'scripts/build.mjs',
    });
  }
  for (const [path, text] of [['README.md', readme], ['data/checklist.json', checklistText]]) {
    check(!/(?:all five legal karat tiers|covering every legal tier)/i.test(text), failure, `${path} calls the catalog's five karats the complete legal spectrum; eCFR § 23.3(c)(1) expressly includes 9K examples`, {
      id: 'FALSE_COMPLETE_LEGAL_KARAT_SPECTRUM', path,
      sources: ['https://www.ecfr.gov/current/title-16/chapter-I/subchapter-B/part-23/section-23.3'],
    });
  }
  check(!/Karat must be a legal mark \(10\/14\/18\/22\/24\)/.test(verifySource), failure, 'S03 describes only 10/14/18/22/24 as legal marks, although the official guides give other examples including 9K', {
    id: 'FALSE_COMPLETE_LEGAL_KARAT_SPECTRUM', path: 'scripts/verify.mjs',
    sources: ['https://www.ecfr.gov/current/title-16/chapter-I/subchapter-B/part-23/section-23.3'],
  });
  for (const [path, text] of [['README.md', readme], ['data/checklist.json', checklistText], ['scripts/build.mjs', siteBuilder]]) {
    check(!/(?:may NOT legally|may not legally|Solid Gold.{0,20}barred)/i.test(text), failure, `${path} strengthens eCFR “should not” into an unqualified legal prohibition`, {
      id: 'ECFR_LEGAL_STRENGTH_OVERSTATED', path,
      sources: ['https://www.ecfr.gov/current/title-16/chapter-I/subchapter-B/part-23/section-23.3'],
    });
  }
  check(!checklistText.includes('9K/10K gold rings'), failure, 'Checklist misidentifies GIA 2025 item/pendant examples as rings', {
    id: 'GIA_EXAMPLE_IDENTITY_ERROR', path: 'data/checklist.json',
    sources: ['https://www.gia.edu/gems-gemology/summer-2025-lab-notes-gold-plated-gold'],
  });
  check(!checklistText.includes('X-rays penetrate only microns'), failure, 'Checklist asserts an X-ray-depth claim not established by its cited GIA articles', {
    id: 'UNSUPPORTED_XRF_DEPTH_CLAIM', path: 'data/checklist.json',
    sources: ['https://www.gia.edu/gems-gemology/summer-2025-lab-notes-gold-plated-gold'],
  });
  check(!/hydrostatic specific-gravity \(density\) testing catches/i.test(checklistText), failure, 'Checklist presents a specific hydrostatic test regimen as catching these cases; the cited GIA articles call for additional appropriate testing but do not establish that blanket guarantee', {
    id: 'UNSUPPORTED_TEST_GUARANTEE', path: 'data/checklist.json',
    sources: [
      'https://www.gia.edu/gems-gemology/spring-2024-lab-notes-electroformed-gold-bracelet',
      'https://www.gia.edu/gems-gemology/summer-2025-lab-notes-gold-plated-gold',
    ],
  });
});

/* R08 — active tables and headline counts must not include a withdrawn SKU silently. */
await group('R08', 'Landing headline distinguishes active listings from withdrawn records', async (failure) => {
  if (withdrawn.length) {
    check(!indexHtml.includes(`<div class="stat-value">${rows.length}</div>\n  <div class="stat-label">verified listings</div>`), failure, `Landing calls all ${rows.length} records verified listings although ${withdrawn.length} is withdrawn`, {
      id: 'WITHDRAWN_COUNTED_AS_VERIFIED', path: 'scripts/build.mjs', row: withdrawn[0].id,
    });
    check(indexHtml.includes(`${active.length} active`) && indexHtml.includes(`${withdrawn.length} withdrawn`), failure, `Landing must explicitly distinguish ${active.length} active listings and ${withdrawn.length} withdrawn record`, {
      id: 'ACTIVE_WITHDRAWN_COUNT_NOT_DISCLOSED', path: 'scripts/build.mjs', sources: ['data/rings.json'],
    });
  }
});

/* R09 — every published flag has a reviewable source and every compliance row a product link. */
await group('R09', 'Flag and requirements source coverage', async (failure) => {
  for (const f of flagsDoc.items) {
    check(f.status === 'needs review', failure, `${f.id}: flag is not needs review`, { id: 'FLAG_STATUS', path: 'data/flagged.json' });
    check(Array.isArray(f.sources) && f.sources.length > 0 && f.sources.every((s) => typeof s === 'string' && (s.startsWith('https://') || existsSync(join(ROOT, s.split('#')[0])))), failure, `${f.id}: missing or invalid review source`, {
      id: 'FLAG_SOURCE_MISSING', path: 'data/flagged.json',
    });
  }
  for (const r of rows) {
    const c = complianceById[r.id];
    check(c?.source_url === r.source_url, failure, `${r.id}: requirements table lacks the row's official product source`, { row: r.id, path: 'data/compliance.json' });
  }
});

/* R10 — registry and report references are real and security expectations stay visible. */
await group('R10', 'Source registry and audit-reference integrity', async (failure) => {
  for (const s of sourcesDoc.sources) {
    check(/^https:\/\//.test(s.url), failure, `${s.id}: registry URL is not HTTPS`, { id: 'REGISTRY_URL', path: 'data/sources.json' });
  }
  const workingNist = 'https://www.nist.gov/pml/owm/metric-si/unit-conversion/precious-metals-conversion-information';
  const retiredNist = 'https://www.nist.gov/pml/owm/metric-si/precious-metals-conversion-information';
  check(gold.unit_authority?.source_url === workingNist, failure, 'Gold unit authority still uses the NIST URL that returned a 404 on 2026-10-23', {
    id: 'BROKEN_NIST_AUTHORITY_LINK', path: 'data/gold-price.json', sources: [workingNist],
  });
  check(sourcesDoc.sources.find((s) => s.id === 'nist-handbook-130')?.url === workingNist, failure, 'Source registry still uses the retired NIST conversion URL', {
    id: 'BROKEN_NIST_AUTHORITY_LINK', path: 'data/sources.json', sources: [workingNist],
  });
  check(!checklistText.includes(retiredNist), failure, 'Checklist still links the retired NIST conversion URL', {
    id: 'BROKEN_NIST_AUTHORITY_LINK', path: 'data/checklist.json', sources: [workingNist],
  });
  check(/look for hallucinations/i.test(indexHtml), failure, 'Landing does not actively recommend a reader hallucination review', {
    id: 'READER_REVIEW_RECOMMENDATION_MISSING', path: 'scripts/build.mjs',
  });
  check(/No hallucinations/i.test(indexHtml), failure, 'Landing lacks the top no-hallucinations rule', {
    id: 'FRONT_PAGE_RULE_MISSING', path: 'scripts/build.mjs',
  });
});

const report = {
  schema_version: 1,
  session: 'sess-5f363d57',
  generated_at: new Date().toISOString(),
  status: findings.length ? 'needs review' : 'pass',
  purpose: 'Independent semantic/provenance review. This is not a live retailer fetch and does not upgrade any row freshness claim.',
  inputs: {
    rows: rows.length,
    active_rows: active.length,
    withdrawn_rows: withdrawn.length,
    verification_ledger: 'data/verification-2026-10-23.json',
    gold_publisher_timestamp: gold.primary.publisher_timestamp,
  },
  summary: {
    groups: groups.length,
    passed: groups.filter((g) => g.passed).length,
    failed: groups.filter((g) => !g.passed).length,
    assertions,
    findings: findings.length,
  },
  groups,
  findings,
  required_response: 'Review every finding against the linked official/repository source. Do not fill an unconfirmed value; blank it or preserve it only as clearly labelled historical evidence. Re-run this audit and all canonical/security suites after every correction.',
};
await mkdir(join(ROOT, 'data/session-5f363d57'), { recursive: true });
await writeFile(join(ROOT, OUT), JSON.stringify(report, null, 2) + '\n');

for (const g of groups) console.log(`[${g.passed ? 'PASS' : 'FAIL'}] ${g.id} ${g.name}${g.failure_count ? ` — ${g.failure_count} finding(s)` : ''}`);
console.log(`audit_5f363d57: ${report.summary.passed}/${groups.length} groups passed; ${assertions} assertions; ${findings.length} findings -> ${OUT}`);
if (findings.length && !noFail) process.exit(1);
