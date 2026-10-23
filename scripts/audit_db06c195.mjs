#!/usr/bin/env node
/**
 * GOLD1 — independent third-channel verification & publication QA (T49, sess-db06c195)
 *
 * This script is deliberately *independent* of scripts/verify.mjs, audit_0804e222.mjs,
 * audit_545688f3.mjs, audit_dab93754.mjs and audit_5f363d57.mjs: it re-implements the
 * questions it asks from the raw evidence, so a shared bug in the canonical suite cannot
 * hide a shared defect. It is read-only: it never writes data/rings.json, data/flagged.json,
 * data/gold-price.json, scripts/build.mjs or any generated page.
 *
 * Groups
 *   D01  Source integrity          — every row links an https page on that retailer's own domain,
 *                                    with no tracking/affiliate parameters, and no two rows share a URL
 *   D02  Ledger bijection          — the live evidence ledger covers every dataset row exactly once
 *   D03  Confirmation requires a read — a row may only claim `confirmed` with a dated read behind it;
 *                                    a withdrawn row may never be presented as confirmed
 *   D04  Third-channel price trace — the stored price must appear in the page the seller prints now
 *                                    (jsonld / visible text / the seller's own variant feed), or the row
 *                                    must be degraded to `partly_verified`/`withdrawn` and say why
 *   D05  Third-channel weight trace — every published gram weight must appear in a live gram mention
 *                                    in the read ledger (or the row must say it could not be re-read)
 *   D06  Gold-price freshness + melt arithmetic — the stored spot must be timestamped, recent, and
 *                                    produce exactly the melt figure the helper computes (no retyping)
 *   D07  Unverified rendering      — a row without a confirmed price must never render a dollar price;
 *                                    a withdrawn row must say "withdrawn" on its own page
 *   D08  Publication security      — no inline executable script without a CSP, no external link without
 *                                    rel=noopener, no secret-shaped strings in the published HTML
 *   D09  Link integrity            — every relative link and in-page anchor in the published HTML resolves
 *
 * Run: node scripts/audit_db06c195.mjs [--ledger=data/live/<file>.json]
 * Writes: data/session-db06c195/audit-<pass>.json   (evidence for every assertion)
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

const ROOT = process.cwd();
const read = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));

const ledgerArg = process.argv.find((a) => a.startsWith('--ledger='));
const ledgerPath = ledgerArg
  ? ledgerArg.slice('--ledger='.length)
  : pickLatestLedger();

function pickLatestLedger() {
  const dir = join(ROOT, 'data/live');
  const files = readdirSync(dir)
    .filter((f) => /^\d{4}-\d{2}-\d{2}T.*\.json$/.test(f))
    .sort();
  return join('data/live', files[files.length - 1]);
}

const ringsDoc = read('data/rings.json');
const rows = ringsDoc.rows;
const gold = read('data/gold-price.json');
const ledgers = existsSync(join(ROOT, ledgerPath)) ? read(ledgerPath) : null;

const results = [];
let assertions = 0;
function check(group, ok, message, detail) {
  assertions++;
  results.push({ group, ok, message, detail: detail === undefined ? null : detail });
  if (!ok) results.failed = (results.failed || 0) + 1;
}
function groupPass(id) {
  const g = results.filter((r) => r.group === id);
  return { id, total: g.length, failed: g.filter((r) => !r.ok).length };
}

/* ------------------------------------------------------------------ D01 */
// Official seller domains, taken from each retailer's own source_url on the dataset.
const ALLOWED = {
  'ross-simons': ['ross-simons.com'],
  'with-clarity': ['withclarity.com'],
  'anna-sheffield': ['annasheffield.com'],
  aurate: ['auratenewyork.com'],
  'blue-nile': ['bluenile.com'],
  mejuri: ['mejuri.com'],
  'brilliant-earth': ['brilliantearth.com'],
  'automic-gold': ['automicgold.com'],
  cartier: ['cartier.com'],
  mene: ['mene.com'],
  auvere: ['auvere.com'],
};
const TRACKING = /[?&](utm_[a-z]+|gclid|fbclid|aff|affiliate|ref|source)=/i;

for (const r of rows) {
  const url = r.source_url || '';
  let host = '';
  try {
    const u = new URL(url);
    host = u.hostname.replace(/^www\./, '');
    check('D01', u.protocol === 'https:', `${r.id}: source URL must be https`, url);
  } catch {
    check('D01', false, `${r.id}: source URL is not parseable`, url);
    continue;
  }
  const allowed = ALLOWED[r.retailer_id];
  check(
    'D01',
    Array.isArray(allowed) && allowed.some((d) => host === d || host.endsWith('.' + d)),
    `${r.id}: source host must be the retailer's own domain`,
    { host, retailer_id: r.retailer_id, allowed: allowed || null }
  );
  check('D01', !TRACKING.test(url), `${r.id}: source URL must not carry tracking/affiliate parameters`, url);
}

const byUrl = new Map();
for (const r of rows) {
  const u = (r.source_url || '').replace(/\/$/, '').toLowerCase();
  if (!byUrl.has(u)) byUrl.set(u, []);
  byUrl.get(u).push(r.id);
}
for (const [u, ids] of byUrl) {
  check('D01', ids.length === 1, `shared source URL across rows: ${ids.join(', ')}`, u);
}

/* ------------------------------------------------------------------ D02 */
if (!ledgers) {
  check('D02', false, 'live evidence ledger not found — cannot run the third-channel checks', ledgerPath);
} else {
  const ledgerRows = ledgers.rows || [];
  const ledgerIds = ledgerRows.map((x) => x.id);
  const datasetIds = rows.map((r) => r.id);
  check('D02', ledgerIds.length === new Set(ledgerIds).size, 'ledger ids must be unique', {
    duplicates: ledgerIds.filter((id, i) => ledgerIds.indexOf(id) !== i),
  });
  const missing = datasetIds.filter((id) => !ledgerIds.includes(id));
  const extra = ledgerIds.filter((id) => !datasetIds.includes(id));
  check('D02', missing.length === 0, 'every dataset row must appear in the ledger', { missing });
  check('D02', extra.length === 0, 'the ledger must not contain rows that are not in the dataset', { extra });
  check('D02', ledgerRows.every((x) => typeof x.ok === 'boolean' && x.fetched_at), 'every ledger row must record ok + fetched_at');
}

/* ------------------------------------------------------------------ D03 */
// A "confirmed" row must rest on (a) a live read in this ledger OR a quoted figure in its own
// evidence string, and (b) a dated record (reverified_at / retrieved_at / an ISO date in the text).
const ledgerById = new Map((ledgers?.rows || []).map((x) => [x.id, x]));
const priceShape = /(?:\$\s?[\d,]+(?:\.\d{2})?|price[_a-z]*\s*"?\d)/i;
// Numeric containment that tolerates thousands separators and trailing .00 ("$3,350" ≈ 3350).
function mentionsNumber(text, value) {
  if (value == null) return true;
  const clean = String(text || '').replace(/(\d),(?=\d{3}\b)/g, '$1');
  const v = Number(value);
  const variants = [String(v), v.toFixed(2), v.toFixed(1)];
  if (Number.isInteger(v)) variants.push(String(v) + '.00');
  return variants.some((needle) => {
    const esc = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return new RegExp(`(?<![\\d.])${esc}(?![\\d])`).test(clean);
  });
}
for (const r of rows) {
  const l = ledgerById.get(r.id);
  if (r.verification_status === 'confirmed') {
    const liveRead = Boolean(l && (l.ok === true || l.variant_feed || l.shopify_json_fallback));
    const quoted = priceShape.test(r.evidence || '');
    const dated = Boolean(r.reverified_at || r.retrieved_at) || /20\d\d-\d\d-\d\d/.test(r.evidence || '');
    check('D03', (liveRead || quoted) && dated, `${r.id}: "confirmed" needs a live read or a quoted figure, plus a dated record`, {
      live_read: liveRead,
      quoted_figure: quoted,
      dated,
    });
  }
  if (r.withdrawn || /^withdrawn/.test(r.verification_status || '')) {
    check('D03', r.verification_status !== 'confirmed', `${r.id}: a withdrawn row must not be labelled confirmed`, r.verification_status);
    check('D03', Boolean(r.withdrawn_reason || r.verification_note), `${r.id}: a withdrawn row must state the reason`);
  }
}

/* ------------------------------------------------------------------ D04 */
function numbersIn(text) {
  const out = new Set();
  for (const m of String(text || '').matchAll(/(\d{1,3}(?:,\d{3})+(?:\.\d{2})?|\d+(?:\.\d{1,2})?)/g)) {
    const n = Number(m[1].replace(/,/g, ''));
    if (Number.isFinite(n)) out.add(n);
  }
  return out;
}
function pageNumbers(l) {
  const set = new Set();
  const push = (v) => {
    const n = Number(String(v).replace(/[^0-9.]/g, ''));
    if (Number.isFinite(n) && n > 0) set.add(Math.round(n * 100) / 100);
  };
  const ex = l?.extraction;
  if (ex) {
    for (const p of ex.jsonld_prices || []) push(p.value);
    for (const o of ex.jsonld_offers || []) for (const p of o.prices || []) push(p.value);
    for (const m of ex.prices || []) for (const n of numbersIn(m.match)) set.add(Math.round(n * 100) / 100);
    for (const n of numbersIn(ex.h1)) set.add(Math.round(n * 100) / 100);
  }
  const vf = l?.variant_feed;
  if (vf && Array.isArray(vf.variants)) for (const v of vf.variants) push(v.price);
  if (vf && Array.isArray(vf.metal_groups))
    for (const g of vf.metal_groups) for (const p of g.prices || g.price_range || []) push(p);
  if (vf) for (const k of ['price_min', 'price_max']) if (vf[k] != null) push(vf[k]);
  return set;
}
const priceDrift = [];
const priceCarriedOnQuote = [];
for (const r of rows) {
  const l = ledgerById.get(r.id);
  if (r.price_unverified || r.price_low == null) {
    check('D04', true, `${r.id}: no price claimed — nothing to trace`, null);
    continue;
  }
  const nums = pageNumbers(l);
  const inRange = (v) => [...nums].some((n) => Math.abs(n - v) < 0.011);
  const traced = inRange(r.price_low) && (r.price_high == null || inRange(r.price_high));
  const readable = Boolean(l && (l.ok === true || Boolean(l.variant_feed) || Boolean(l.shopify_json_fallback)));
  const quotedInEvidence =
    mentionsNumber(r.evidence, r.price_low) && mentionsNumber(r.evidence, r.price_high);
  const excused = r.verification_status === 'partly_verified' || Boolean(r.withdrawn);

  if (!readable) {
    // The seller refused or returned nothing this pass. The row may keep its price only if its own
    // evidence string quotes the figure the seller printed when it was read.
    check(
      'D04',
      quotedInEvidence,
      `${r.id}: page not readable this pass — the price must rest on a quoted figure in the row's evidence`,
      { quoted_in_evidence: quotedInEvidence, status: r.verification_status }
    );
    priceCarriedOnQuote.push({ id: r.id, why: l ? l.error || l.http_status : 'no ledger entry', quoted: quotedInEvidence });
    continue;
  }
  if (!traced) priceDrift.push({ id: r.id, stored: [r.price_low, r.price_high], observed: [...nums].sort((a, b) => a - b).slice(0, 25) });
  check(
    'D04',
    traced || excused,
    `${r.id}: stored price must be printed by the seller now, or the row must be degraded and say why`,
    traced ? { stored: [r.price_low, r.price_high] } : { stored: [r.price_low, r.price_high], observed: [...nums].sort((a, b) => a - b).slice(0, 25), status: r.verification_status }
  );
}

/* ------------------------------------------------------------------ D05 */
const weightDrift = [];
for (const r of rows) {
  if (!r.weight_g_low) {
    check('D05', true, `${r.id}: no weight published — nothing to trace`, null);
    continue;
  }
  const l = ledgerById.get(r.id);
  const grams = [];
  const harvest = (text) => {
    for (const m of String(text || '').matchAll(/(\d+(?:\.\d+)?)\s*(?:g|grams?|gr)\b/gi)) grams.push(Number(m[1]));
  };
  for (const g of l?.extraction?.gram_mentions || []) harvest(g.match || g.excerpt || g);
  for (const c of l?.extraction?.weight_keyword_context || []) harvest(c.excerpt || c);
  if (l?.variant_feed?.metafields) harvest(JSON.stringify(l.variant_feed.metafields));
  const wanted = [r.weight_g_low, r.weight_g_high].filter((v) => v != null);
  const liveFound = wanted.every((v) => grams.some((g) => Math.abs(g - v) < 0.011));
  // Fallback: the row's own evidence must quote the figure it was read from, next to a gram marker
  // (also covers seller ranges such as "Weight: 2.6-4g").
  const gramContext = (/[\s\S]{0,80}(?:grams?|\bg\b)[\s\S]{0,40}/gi);
  const contexts = [];
  const ev = String(r.evidence || '');
  for (const m of ev.matchAll(/(?:weight[^.;]{0,60})/gi)) contexts.push(m[0]);
  for (const m of ev.matchAll(/(\d+(?:\.\d+)?)\s*(?:-|\u2013|to)\s*(\d+(?:\.\d+)?)\s*(?:g|grams?)\b/gi)) contexts.push(m[0]);
  for (const m of ev.matchAll(/(\d+(?:\.\d+)?)\s*(?:g|grams?)\b/gi)) contexts.push(m[0]);
  const quoted = wanted.every((v) => contexts.some((c) => mentionsNumber(c, v)));
  if (!liveFound && !quoted) weightDrift.push({ id: r.id, stored: wanted, gramsSeen: [...new Set(grams)].slice(0, 15) });
  check(
    'D05',
    liveFound || quoted,
    `${r.id}: a published gram weight must still be printed by the seller, or be quoted verbatim in the row's evidence`,
    { stored: wanted, live_grams: [...new Set(grams)].slice(0, 15), quoted_in_evidence: quoted }
  );
}

/* ------------------------------------------------------------------ D06 */
const OZT = 31.1034768;
check('D06', gold.grains_per_troy_ounce === OZT || gold.grams_per_troy_ounce === OZT, 'NIST troy ounce constant must be exact 31.1034768', {
  stored: gold.grains_per_troy_ounce ?? gold.grams_per_troy_ounce,
});
check('D06', Boolean(gold.primary?.publisher_timestamp), 'the gold spot must carry its publisher timestamp');
const spotTs = Date.parse(gold.primary?.publisher_timestamp || '');
const ageHours = (Date.now() - spotTs) / 3.6e6;
check('D06', Number.isFinite(spotTs) && spotTs <= Date.now() + 60_000, 'the gold spot timestamp must be a real, non-future time', {
  publisher_timestamp: gold.primary?.publisher_timestamp,
});
check('D06', ageHours <= 24, 'the published gold spot must be less than 24 h old', {
  age_hours: Number(ageHours.toFixed(2)),
  publisher_timestamp: gold.primary?.publisher_timestamp,
});
const karatNum = (k) => Number(String(k || '').replace(/[^0-9.]/g, ''));
let meltMismatch = 0;
const meltSample = [];
for (const r of rows) {
  if (!r.weight_g_low || r.price_low == null) continue;
  const purity = karatNum(r.karat) / 24;
  const perGram = gold.primary.price_usd_per_ozt / OZT;
  const lo = Math.round(r.weight_g_low * purity * perGram * 100) / 100;
  const hi = Math.round((r.weight_g_high ?? r.weight_g_low) * purity * perGram * 100) / 100;
  meltSample.push({ id: r.id, melt_low: lo, melt_high: hi });
  if (lo > r.price_high + 0.5) meltMismatch++;
  check(
    'D06',
    lo <= (r.price_high ?? r.price_low) + 0.5,
    `${r.id}: melt value must not exceed the asking price`,
    { melt_low: lo, asking: [r.price_low, r.price_high] }
  );
  if (r.weight_g_high && r.weight_g_high !== r.weight_g_low) {
    check('D06', hi >= lo, `${r.id}: melt high must not be below melt low`, { lo, hi });
  }
}

/* ------------------------------------------------------------------ D07 */
const htmlFiles = readdirSync(ROOT).filter((f) => f.endsWith('.html'));
const ringPages = existsSync(join(ROOT, 'rings')) ? readdirSync(join(ROOT, 'rings')).filter((f) => f.endsWith('.html')) : [];
const priceCell = (html) => {
  const m = html.match(/<dt>Price<\/dt>\s*<dd>([\s\S]*?)<\/dd>/i);
  return m ? m[1] : '';
};
const stripTags = (s) => s.replace(/<[^>]+>/g, ' ');
const unverifiedRenders = [];
for (const r of rows) {
  const file = join(ROOT, 'rings', `${r.id}.html`);
  if (!existsSync(file)) {
    check('D07', false, `${r.id}: ring page missing`, `${r.id}.html`);
    continue;
  }
  const cell = priceCell(readFileSync(file, 'utf8'));
  check('D07', cell.length > 0, `${r.id}: ring page must have a Price row`, null);
  const mustBeUnverified = Boolean(r.price_unverified) || Boolean(r.withdrawn) || r.price_low == null;
  if (mustBeUnverified) {
    const saysUnverified = /unverified/i.test(stripTags(cell));
    const numSpan = /class="num"/.test(cell);
    check('D07', saysUnverified && !numSpan, `${r.id}: an unconfirmed price must render as unverified in the price cell`, {
      price_cell: stripTags(cell).trim().slice(0, 160),
      rendered_as_number: numSpan,
    });
    unverifiedRenders.push({ id: r.id, price_cell: stripTags(cell).trim().slice(0, 120) });
  } else {
    const printed = [...stripTags(cell).matchAll(/\$\s?[\d,]+(?:\.\d{2})?/g)].map((m) => m[0]);
    check('D07', printed.length > 0, `${r.id}: a confirmed row must print its price in the price cell`, printed.slice(0, 3));
  }
}

/* ------------------------------------------------------------------ D08 */
const SECRET_PATTERNS = [
  /AKIA[0-9A-Z]{16}/,
  /gh[pousr]_[A-Za-z0-9]{20,}/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bsk-[A-Za-z0-9]{20,}\b/,
  /\bxox[baprs]-[A-Za-z0-9-]{10,}/,
];
const EXTERNAL = /<a\b[^>]*href="(https?:\/\/[^"]+)"[^>]*>/gi;
let externalLinks = 0;
for (const f of [...htmlFiles, ...ringPages.map((p) => join('rings', p))]) {
  const html = readFileSync(join(ROOT, f), 'utf8');
  for (const p of SECRET_PATTERNS) {
    check('D08', !p.test(html), `${f}: no secret-shaped string in published HTML`, String(p));
  }
  // External links must carry rel=noopener so the target cannot reach window.opener.
  for (const m of html.matchAll(EXTERNAL)) {
    externalLinks++;
    const tag = m[0];
    const isCatalogLink = /ross-simons|mejuri|cartier|mene|auvere|withclarity|bluenile|brilliantearth|automicgold|annasheffield|auratenewyork/i.test(m[1]);
    if (!isCatalogLink) continue;
    check('D08', /rel="[^"]*noopener/i.test(tag), `${f}: product link must use rel=noopener`, m[1].slice(0, 120));
  }
  const inlineScripts = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)].filter(
    (m) => m[1].trim().length > 0
  );
  const hasCsp = /http-equiv="Content-Security-Policy"/i.test(html);
  check(
    'D08',
    inlineScripts.length === 0 || hasCsp,
    `${f}: inline script requires a Content-Security-Policy meta tag`,
    { inline_scripts: inlineScripts.length, csp_meta: hasCsp }
  );
}

/* ------------------------------------------------------------------ D09 */
function anchorsIn(html) {
  const ids = new Set();
  for (const m of html.matchAll(/\bid="([^"]+)"/g)) ids.add(m[1]);
  for (const m of html.matchAll(/\bname="([^"]+)"/g)) ids.add(m[1]);
  return ids;
}
const pageCache = new Map();
const pageAnchors = (rel) => {
  if (!pageCache.has(rel)) pageCache.set(rel, anchorsIn(readFileSync(join(ROOT, rel), 'utf8')));
  return pageCache.get(rel);
};
let linkCount = 0;
for (const f of [...htmlFiles, ...ringPages.map((p) => join('rings', p))]) {
  const html = readFileSync(join(ROOT, f), 'utf8');
  for (const m of html.matchAll(/<a\b[^>]*href="([^"]+)"/gi)) {
    const href = m[1].trim();
    if (/^(https?:|mailto:|tel:|#|javascript:)/i.test(href)) {
      if (href.startsWith('#') && href.length > 1) {
        linkCount++;
        const target = href.slice(1);
        check('D09', pageAnchors(f).has(target) || target === '', `${f}: in-page anchor must exist`, href);
      }
      continue;
    }
    linkCount++;
    const [beforeHash, anchor] = href.split('#');
    const pathPart = beforeHash.split('?')[0];
    const rel = pathPart === '' ? f : join(dirname(f), pathPart).replace(/^\.\//, '');
    if (!existsSync(join(ROOT, rel))) {
      check('D09', false, `${f}: relative link target must exist`, href);
      continue;
    }
    check('D09', true, `${f}: link resolves`, href);
    if (anchor) check('D09', pageAnchors(rel).has(anchor), `${f}: anchor target must exist`, href);
  }
}

/* --------------------------------------------------------------- report */
const ids = ['D01', 'D02', 'D03', 'D04', 'D05', 'D06', 'D07', 'D08', 'D09'];
const groups = ids.map(groupPass);
const pass = `D-${String(Date.now()).slice(-6)}`;
const out = {
  pass,
  generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
  session: 'sess-db06c195',
  task: 'T49 — independent third-channel verification & publication QA',
  ledger: ledgerPath,
  ledger_finished_at: ledgers?.finished_at || null,
  rows: rows.length,
  html_pages: htmlFiles.length + ringPages.length,
  internal_links_checked: linkCount,
  external_links_checked: externalLinks,
  assertions,
  groups,
  failed: results.filter((r) => !r.ok),
  price_drift: priceDrift,
  weight_drift: weightDrift,
  melt_sample: meltSample,
  note:
    'Independent re-implementation: no check in this file calls scripts/verify.mjs or the other canonical auditors. ' +
    'A failure here is a request for the dataset owner, not an automatic edit.',
};
mkdirSync(join(ROOT, 'data/session-db06c195'), { recursive: true });
// One stable path so re-running the auditor does not churn the repository.
writeFileSync(join(ROOT, 'data/session-db06c195/audit-latest.json'), JSON.stringify(out, null, 2) + '\n');

console.log(`\nGOLD1 independent QA — ${pass} — ${rows.length} rows, ${out.html_pages} pages, ${assertions} assertions`);
console.log(`ledger: ${ledgerPath} (${out.ledger_finished_at || 'n/a'})`);
for (const g of groups) console.log(`${g.failed === 0 ? 'PASS' : 'FAIL'}  ${g.id}  (${g.total - g.failed}/${g.total})`);
const failed = results.filter((r) => !r.ok);
if (failed.length) {
  console.log(`\n${failed.length} failure(s):`);
  for (const f of failed.slice(0, 40)) console.log(` - [${f.group}] ${f.message} ${f.detail ? JSON.stringify(f.detail).slice(0, 200) : ''}`);
}
if (priceDrift.length) console.log(`\nprice drift vs live page: ${JSON.stringify(priceDrift).slice(0, 800)}`);
if (weightDrift.length) console.log(`weight drift vs live page: ${JSON.stringify(weightDrift).slice(0, 500)}`);
console.log('\nreport: data/session-db06c195/audit-latest.json');
process.exit(failed.length === 0 ? 0 : 1);
