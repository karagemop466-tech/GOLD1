#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const root = path.resolve(__dirname, '..');
const readJson = (relative) => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
const candidateData = readJson('research/candidates.json');
const sellerData = readJson('research/sellers.json');
const issueData = readJson('research/irregularities.json');
const market = readJson('research/policy/market.json');
const verification = readJson('research/policy/verification.json');
const rows = candidateData.candidates;
const sellers = sellerData.sellers;
const issues = issueData.irregularities;
const errors = [];
const check = (condition, message) => { if (!condition) errors.push(message); };
const isIsoDate = (value) => /^\d{4}-\d{2}-\d{2}$/.test(value || '') && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
const moneyText = (value) => `$${new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)}`;
const https = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch (_) { return false; }
};

const expected = {
  'trax-71345': { seller: 'traxnyc', price: 2500, karat: 14, weight: 2.8, category: 'Side stones' },
  'trax-70114': { seller: 'traxnyc', price: 1800, karat: 14, weight: 2, category: 'Solitaire' },
  'trax-71851': { seller: 'traxnyc', price: 2000, karat: 14, weight: 3, category: 'Solitaire' },
  'trax-70689': { seller: 'traxnyc', price: 3000, karat: 18, weight: 3.8, category: 'Side stones' },
  'trax-66233': { seller: 'traxnyc', price: 3500, karat: 18, weight: 3.2, category: 'Side stones' },
  'trax-70589': { seller: 'traxnyc', price: 3250, karat: 18, weight: 2.9, category: 'Side stones' },
  'bn-502690y14': { seller: 'blue-nile', price: 1050, karat: 14, weight: null, category: 'Solitaire' },
  'bn-501130y14': { seller: 'blue-nile', price: 1000, karat: 14, weight: null, category: 'Solitaire' },
  'bn-500000y14': { seller: 'blue-nile', price: 870, karat: 14, weight: null, category: 'Solitaire' },
  'bn-501140y': { seller: 'blue-nile', price: 1240, karat: 18, weight: null, category: 'Solitaire' },
  'be-BE1199H6-18KY': { seller: 'brilliant-earth', price: 850, karat: 18, weight: null, category: 'Solitaire' },
  'be-BE1D1009-18KY': { seller: 'brilliant-earth', price: 1950, karat: 18, weight: null, category: 'Bezel' },
  'be-BE1D1009-14KY': { seller: 'brilliant-earth', price: 1750, karat: 14, weight: null, category: 'Bezel' }
};
const sellerHosts = {
  traxnyc: 'traxnyc.com',
  'blue-nile': 'www.bluenile.com',
  'brilliant-earth': 'www.brilliantearth.com'
};
const requiredFields = ['name', 'officialItemNumber', 'category', 'style', 'karat', 'metalColor', 'priceUsd', 'priceBasis'];
const ids = new Set();

check(candidateData.schemaVersion === 1, 'Unsupported candidate schema.');
check(rows.length === Object.keys(expected).length, `Expected ${Object.keys(expected).length} rows; found ${rows.length}.`);
check(isIsoDate(candidateData.retrievedDate), 'Invalid root retrieval date.');

for (const row of rows) {
  const id = row.id;
  check(expected[id], `Unexpected candidate ${id}; update the audited snapshot intentionally.`);
  check(!ids.has(id), `Duplicate candidate ${id}.`);
  ids.add(id);
  if (!expected[id]) continue;
  const exp = expected[id];
  check(row.sellerId === exp.seller, `${id}: seller changed from audited record.`);
  check(row.priceUsd === exp.price, `${id}: price ${row.priceUsd} differs from direct-page audit ${exp.price}.`);
  check(row.karat === exp.karat, `${id}: karat differs from direct-page audit.`);
  check(row.listedWeightGrams === exp.weight, `${id}: listed weight differs from direct-page audit.`);
  check(row.category === exp.category, `${id}: category differs from direct-page audit.`);
  check(row.retrievedDate === candidateData.retrievedDate && isIsoDate(row.retrievedDate), `${id}: invalid retrieval date.`);
  check(https(row.officialProductUrl), `${id}: product URL is not clean HTTPS.`);
  const productUrl = new URL(row.officialProductUrl);
  check(productUrl.hostname === sellerHosts[row.sellerId], `${id}: product host does not match seller.`);
  check(!productUrl.search && !productUrl.hash, `${id}: product URL contains unexpected query/fragment.`);
  check(!/(utm_|a_aid|affiliate|aff=)/i.test(row.officialProductUrl), `${id}: tracking/affiliate parameter detected.`);
  check(Array.isArray(row.flags) && row.flags.length > 0, `${id}: review flags missing.`);
  check(Array.isArray(row.evidence) && row.evidence.length > 0, `${id}: evidence missing.`);
  const covered = new Set(row.evidence.flatMap((entry) => entry.fields));
  requiredFields.forEach((field) => check(covered.has(field), `${id}: ${field} lacks field-level evidence.`));
  for (const entry of row.evidence) {
    check(entry.sourceUrl === row.officialProductUrl, `${id}: evidence URL differs from official product URL.`);
    check(https(entry.sourceUrl), `${id}: evidence URL is not HTTPS.`);
    check(typeof entry.quote === 'string' && entry.quote.trim().length > 0, `${id}: empty evidence quote.`);
    check(Array.isArray(entry.fields) && entry.fields.length > 0, `${id}: evidence has no claimed fields.`);
  }
  const evidenceFor = (field) => row.evidence.filter((entry) => entry.fields.includes(field));
  check(evidenceFor('priceUsd').some((entry) => entry.quote.includes(moneyText(row.priceUsd))), `${id}: price not present in source excerpt.`);
  check(evidenceFor('officialItemNumber').some((entry) => entry.quote.includes(row.officialItemNumber)), `${id}: item number not present in source excerpt.`);
  check(evidenceFor('karat').some((entry) => entry.quote.includes(`${row.karat}K`)), `${id}: karat not present in source excerpt.`);
  check(row.solidGold === null || row.solidGold === 'seller-stated', `${id}: unsupported solid-gold status.`);
  if (row.solidGold === 'seller-stated') {
    check(covered.has('solidGold'), `${id}: solid-gold statement lacks evidence.`);
    check(evidenceFor('solidGold').some((entry) => entry.quote.includes(`Solid ${row.karat}K Gold`)), `${id}: explicit solid-gold wording not found in excerpt.`);
  } else {
    check(row.flags.includes('SOLID_GOLD_NOT_STATED'), `${id}: null solid-gold field lacks missing-evidence flag.`);
  }
  if (row.listedWeightGrams === null) {
    check(row.listedWeightBasis === null, `${id}: weight basis exists without a listed weight.`);
    check(row.flags.includes('LISTED_WEIGHT_MISSING'), `${id}: missing weight lacks flag.`);
  } else {
    check(Number.isFinite(row.listedWeightGrams) && row.listedWeightGrams > 0, `${id}: invalid listed weight.`);
    check(typeof row.listedWeightBasis === 'string' && /not stated|not net|whether/i.test(row.listedWeightBasis), `${id}: weight basis fails to disclose ambiguity.`);
    check(covered.has('listedWeightGrams') && covered.has('listedWeightBasis'), `${id}: weight lacks evidence.`);
    check(evidenceFor('listedWeightGrams').some((entry) => entry.quote.includes(String(row.listedWeightGrams))), `${id}: weight not present in source excerpt.`);
  }
  for (const field of ['purityStamp', 'makersMark', 'netMetalWeightGrams', 'independentVerification']) {
    if (row[field] !== null) check(covered.has(field), `${id}: nonblank ${field} requires direct evidence.`);
    else check(row.flags.includes(field === 'netMetalWeightGrams' ? 'NET_WEIGHT_UNVERIFIED' : field === 'independentVerification' ? 'INDEPENDENT_TEST_REQUIRED' : 'PHYSICAL_MARKS_UNVERIFIED'), `${id}: null ${field} lacks review flag.`);
  }
  if (row.clearanceStatus === 'purchase-ready') {
    check(row.solidGold === 'seller-stated' && row.purityStamp !== null && row.makersMark !== null && row.netMetalWeightGrams !== null && row.independentVerification !== null, `${id}: purchase-ready without all physical gates.`);
  }
  if (row.listingDocumentation.length) check(covered.has('listingDocumentation'), `${id}: documentation claim lacks evidence.`);
  for (const key of Object.keys(row)) {
    if (/(rawGold|actualGold|meltValue)/i.test(key)) check(row[key] === null, `${id}: unsupported actual/raw-gold value in ${key}.`);
  }

  // ---- freshness pin (board T50, sess-7d64f506) -------------------------
  // Every row must carry its own dated live re-read, and that re-read must
  // reproduce the stored price. A row whose page was not re-opened cannot be
  // presented as current, and a stored price the seller no longer prints
  // cannot survive this check.
  const re = row.reverification;
  check(re && typeof re === 'object', `${id}: missing live re-verification block.`);
  if (re) {
    check(isIsoDate(re.at), `${id}: re-verification date is not an ISO date.`);
    check(re.at === candidateData.retrievedDate, `${id}: re-verified ${re.at} but the register says ${candidateData.retrievedDate}.`);
    check(re.at >= '2026-10-23', `${id}: re-verification ${re.at} is stale; the register was re-read on 2026-10-23.`);
    check(typeof re.pass === 'string' && re.pass.length > 0, `${id}: re-verification pass id missing.`);
    check(https(re.readUrl), `${id}: re-verification URL is not clean HTTPS.`);
    const readUrl = new URL(re.readUrl);
    check(readUrl.hostname === sellerHosts[row.sellerId], `${id}: re-read was not performed on the seller's own host.`);
    check(!/(utm_|a_aid|affiliate|aff=)/i.test(re.readUrl), `${id}: tracking/affiliate parameter in re-read URL.`);
    check(Array.isArray(re.quotes) && re.quotes.length > 0, `${id}: re-verification has no verbatim quotes.`);
    (re.quotes || []).forEach((quote) => check(typeof quote === 'string' && quote.trim().length > 0, `${id}: empty re-verification quote.`));
    const cents = String(Math.round(row.priceUsd * 100));
    const reproduced = (re.quotes || []).some((quote) => quote.includes(moneyText(row.priceUsd)) || quote.includes(cents));
    check(reproduced, `${id}: the 2026-10-23 re-read does not reproduce the stored price ${moneyText(row.priceUsd)}.`);
    if (typeof row.listedWeightGrams === 'number') {
      const gramsText = String(row.listedWeightGrams);
      const gramsInQuotes = (re.quotes || []).some((quote) => quote.includes(gramsText));
      check(gramsInQuotes || /PDP spec table/i.test(re.note || ''), `${id}: stored weight ${gramsText} g is neither reproduced by the re-read nor disclosed as spec-table-only.`);
    }
  }
}
for (const id of Object.keys(expected)) check(ids.has(id), `Audited candidate ${id} is missing.`);

const categoryCounts = rows.reduce((acc, row) => ({ ...acc, [row.category]: (acc[row.category] || 0) + 1 }), {});
assert.deepEqual(categoryCounts, { 'Side stones': 4, Solitaire: 7, Bezel: 2 });
check(rows.filter((row) => row.karat === 14).length === 7, 'Expected seven 14K candidates.');
check(rows.filter((row) => row.karat === 18).length === 6, 'Expected six 18K candidates.');
check(rows.filter((row) => row.solidGold === 'seller-stated').length === 6, 'Expected six explicit solid-gold statements.');
check(rows.filter((row) => row.listedWeightGrams !== null).length === 6, 'Expected six listed weights.');
check(rows.every((row) => row.clearanceStatus !== 'purchase-ready'), 'No candidate may be purchase-ready in the current evidence snapshot.');
check(!ids.has('be-BE1199H6-14KY'), 'Currency-conflicted Six-Prong 14K variant must remain excluded.');

const sellerIds = new Set(sellers.map((seller) => seller.id));
assert.deepEqual(sellerIds, new Set(['traxnyc', 'blue-nile', 'brilliant-earth']));
for (const seller of sellers) {
  check(https(seller.officialUrl), `${seller.id}: invalid official URL.`);
  for (const [section, field] of [[seller.contact, 'contact'], [seller.payment, 'payment'], [seller.returns, 'returns']]) {
    check(https(section.sourceUrl), `${seller.id}: invalid ${field} source.`);
    check(section.quote || (section.quotes && section.quotes.length), `${seller.id}: missing ${field} quote.`);
  }
  check(seller.payment.creditCardAccepted === true && seller.payment.creditCardsListed.length > 0, `${seller.id}: card acceptance evidence missing.`);
  seller.payment.creditCardsListed.forEach((card) => check(seller.payment.quote.includes(card), `${seller.id}: ${card} absent from payment quote.`));
  check(https(seller.reputation.profileUrl) && new URL(seller.reputation.profileUrl).hostname === 'www.bbb.org', `${seller.id}: invalid BBB profile.`);
  check(https(seller.reputation.complaintsUrl), `${seller.id}: invalid BBB complaints URL.`);
  check(Number.isInteger(seller.reputation.complaintsLast3Years) && Number.isInteger(seller.reputation.complaintsLast12Months), `${seller.id}: invalid complaint counts.`);
  check(seller.reputation.profileQuote && seller.reputation.complaintsQuote, `${seller.id}: reputation excerpts missing.`);
  if (seller.reputation.bbbRating) check(seller.reputation.profileQuote.includes(seller.reputation.bbbRating), `${seller.id}: BBB grade absent from direct excerpt.`);
  if (seller.reputation.bbbAccredited === false) check(/NOT BBB Accredited/i.test(seller.reputation.profileQuote), `${seller.id}: non-accreditation not supported by excerpt.`);
  check(seller.returns.quotes.length >= 3, `${seller.id}: return conditions/exclusions excerpts incomplete.`);
  check(seller.returns.clockStarts && seller.returns.exclusions && seller.returns.fees, `${seller.id}: return findings incomplete.`);
  check(seller.documentation.summary, `${seller.id}: documentation finding missing.`);
}
const trax = sellers.find((seller) => seller.id === 'traxnyc');
check(trax.reputation.bbbRating === null, 'TraxNYC BBB letter grade must remain blank.');
check(!JSON.stringify(trax.reputation).includes('D-'), 'Discarded BBB snippet grade reappeared.');
check(https(sellerData.reputationMethodology.sourceUrl), 'Invalid BBB methodology URL.');

for (const issue of issues) {
  check(issue.id && issue.title && issue.finding && issue.action && issue.severity && issue.status, `${issue.id || 'issue'}: incomplete irregularity record.`);
  check(issue.sourceBasis || https(issue.sourceUrl), `${issue.id}: irregularity lacks direct source or documented absence basis.`);
  (issue.affectedCandidateIds || []).forEach((id) => check(ids.has(id), `${issue.id}: unknown affected candidate ${id}.`));
  if (issue.status === 'excluded') check(https(issue.sourceUrl) && issue.quote, `${issue.id}: exclusion requires direct source and quote.`);
}
check(issues.some((issue) => issue.id === 'be-14k-six-prong-currency-conflict' && issue.status === 'excluded'), 'Currency-conflict exclusion missing.');
check(issues.some((issue) => issue.id === 'trax-bbb-search-conflict'), 'BBB source conflict record missing.');

// ---- 2026-10-23 findings must stay published ----------------------------
// Findings are never silently dropped: each one below was raised by a direct
// read on 2026-10-23 (board T50) and is pinned here so a future edit has to
// remove it deliberately, with the audit failing until the record is updated.
const pinnedFindings = [
  'market-reference-snapshot-age',
  'blue-nile-item-195639-repurposed',
  'compare-at-price-not-market-value',
  'shopify-weight-field-is-parcel-weight',
  'secondary-dashboards-are-dated-snapshots',
  'legacy-generator-wrote-to-repo-root'
];
pinnedFindings.forEach((issueId) => check(issues.some((issue) => issue.id === issueId), `2026-10-23 finding ${issueId} is no longer published.`));
check(issues.every((issue) => issue.status === 'open' || issue.status === 'excluded' || issue.status === 'resolved-with-record'), 'Unknown irregularity status value.');

// ---- published copy parity ----------------------------------------------
// site/data/** is what GitHub Pages actually serves at /site/. It must be
// byte-identical to the audited research/** source, or the published dashboard
// would show numbers this audit never checked.
const crypto = require('node:crypto');
const sha = (relative) => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, relative))).digest('hex');
for (const [source, published] of [
  ['research/candidates.json', 'site/data/candidates.json'],
  ['research/sellers.json', 'site/data/sellers.json'],
  ['research/irregularities.json', 'site/data/irregularities.json'],
  ['research/policy/market.json', 'site/data/market.json'],
  ['research/policy/verification.json', 'site/data/verification.json']
]) {
  check(fs.existsSync(path.join(root, published)), `Published copy ${published} is missing.`);
  if (fs.existsSync(path.join(root, published))) {
    check(sha(source) === sha(published), `Published ${published} differs from its audited source ${source}.`);
  }
}

// ---- the legacy generator must not be able to overwrite the dashboard ----
const legacyGenerator = fs.readFileSync(path.join(root, 'tools/build_site.py'), 'utf8');
check(!/^OUT = ROOT\s*$/m.test(legacyGenerator), 'tools/build_site.py still writes generated pages to the repository root.');
check(/allow-regenerate/.test(legacyGenerator), 'tools/build_site.py lost its explicit regeneration guard.');

const rate = market.source.bidPerTroyOunce / market.conversion.gramsPerTroyOunce;
check(https(market.source.url) && new URL(market.source.url).hostname === 'www.kitco.com', 'Invalid Kitco source.');
check(market.source.sourceTimestamp === 'Oct 22, 2026 - 19:11 NY Time', 'Kitco panel timestamp differs from audited snapshot.');
check(market.source.bidPerTroyOunce === 4025 && market.source.askPerTroyOunce === 4027, 'Kitco bid/ask differs from audited snapshot.');
check(Math.abs(rate - market.source.displayedBidPerGram) <= 0.0051, 'Kitco gram cross-check failed.');
check(market.conversion.gramsPerTroyOunce === 31.1034768, 'Troy-ounce conversion changed.');
check(market.source.quotes.some((quote) => quote.includes('4,025.00')), 'Kitco bid absent from source excerpt.');
check(market.source.quotes.some((quote) => quote.includes('Estimated metal value only')), 'Kitco metal-value limitation missing.');
check(https(market.benchmarkMethodology.url), 'Invalid LBMA methodology URL.');
check(!Object.hasOwn(market.benchmarkMethodology, 'numericPrice'), 'LBMA methodology must not contain a substituted numeric price.');

// ---- independent spot reading published beside the audited snapshot ------
// (board T50, sess-7d64f506). The Kitco panel stays the calculator reference so
// the arithmetic remains reproducible; a second, dated publisher reading is
// published next to it so the gap is visible instead of hidden.
const live = market.liveFeed;
check(live && typeof live === 'object', 'Missing liveFeed: a dated second gold reading must be published beside the calculator snapshot.');
if (live) {
  check(https(live.url), 'Invalid liveFeed source URL.');
  check(typeof live.sourceTimestamp === 'string' && live.sourceTimestamp.length > 0, 'liveFeed has no publisher timestamp.');
  check(Number.isFinite(live.spotPerTroyOunce) && live.spotPerTroyOunce > 0, 'liveFeed spot price missing.');
  check(typeof live.quote === 'string' && live.quote.includes(String(live.spotPerTroyOunce)), 'liveFeed quote does not contain the stored spot figure.');
  check(live.quote.includes(live.sourceTimestamp), 'liveFeed quote does not contain its own publisher timestamp.');
  const liveRate = live.spotPerTroyOunce / market.conversion.gramsPerTroyOunce;
  check(Math.abs(liveRate - live.derivedPerGram) < 1e-9, 'liveFeed derived per-gram value is not spot / 31.1034768.');
  check(typeof live.snapshotWarning === 'string' && live.snapshotWarning.length > 0, 'liveFeed must state that it is not a dealer quote or appraisal.');
  check(live.sourceTimestamp > market.source.sourceTimestamp.slice(0, 3) || /\d{4}-\d{2}-\d{2}T/.test(live.sourceTimestamp), 'liveFeed timestamp is not machine-comparable.');
  check(typeof market.freshnessNote === 'string' && market.freshnessNote.includes(String(live.spotPerTroyOunce)), 'freshnessNote must name both readings.');
}
for (const row of rows) {
  if (row.listedWeightGrams === null) continue;
  const fine = row.listedWeightGrams * row.karat / 24;
  const reference = fine * rate;
  check(Number.isFinite(fine) && fine > 0 && Number.isFinite(reference) && reference > 0, `${row.id}: nominal math failed.`);
  check(row.netMetalWeightGrams === null, `${row.id}: nominal math must not populate actual net weight.`);
}

const gateIds = new Set();
check(verification.gates.length === 9, 'Expected nine sourced verification gates.');
for (const gate of verification.gates) {
  check(!gateIds.has(gate.id), `Duplicate gate ${gate.id}.`);
  gateIds.add(gate.id);
  check(gate.title && gate.passWhen, `${gate.id}: incomplete gate.`);
  if (gate.sourceId) {
    const source = verification.sources[gate.sourceId];
    check(source && https(source.url), `${gate.id}: missing/invalid source.`);
    check(source && (source.quotes?.[gate.sourceQuoteKey] || source[gate.sourceQuoteKey]), `${gate.id}: source quote key missing.`);
  } else check(gate.basis, `${gate.id}: project rule lacks explicit basis.`);
}
check(verification.gates.some((gate) => gate.id === 'independent-verification'), 'Independent-verification gate missing.');

const researchReadme = fs.readFileSync(path.join(root, 'research/README.md'), 'utf8');
check(researchReadme.includes('13 active candidate rows'), 'Research narrative candidate count is stale.');
check(researchReadme.includes('0 rows are purchase-ready'), 'Research narrative clearance state is stale.');
const policyReadme = fs.readFileSync(path.join(root, 'research/policy/README.md'), 'utf8');
check(policyReadme.includes('$4,025.00 per troy ounce'), 'Policy narrative Kitco bid is stale.');
check(policyReadme.includes('$129.41 per gram'), 'Policy narrative gram reference is stale.');

if (errors.length) {
  console.error(`EVIDENCE AUDIT FAILED (${errors.length} issue${errors.length === 1 ? '' : 's'})`);
  errors.forEach((error) => console.error(`- ${error}`));
  process.exit(1);
}
console.log('PASS evidence: 13/13 audited rows, exact prices, field-level official excerpts, valid blanks and flags');
console.log('PASS sellers: 3 contact/payment/return/documentation/reputation records and direct source scopes');
console.log(`PASS market: $4,025.00 / 31.1034768 = $${rate.toFixed(10)}/g, rounds to $${rate.toFixed(2)}/g`);
console.log(`PASS freshness: ${rows.length}/${rows.length} rows carry a dated ${candidateData.retrievedDate} live re-read that reproduces the stored price`);
console.log(`PASS policy: ${verification.gates.length} gates, ${issues.length} irregularity groups, 0 purchase-ready candidates`);
console.log('NOTE structural audit complements—not replaces—direct source re-fetch and human/manual review.');
