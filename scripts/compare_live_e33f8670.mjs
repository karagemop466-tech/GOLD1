#!/usr/bin/env node
/**
 * GOLD1 — third-channel comparator (T51, sess-e33f8670).
 *
 * Reads one live re-verification evidence file and compares every stored price
 * with what the seller's own page printed on that run. It writes a per-row
 * ledger; it never edits data/rings.json.
 *
 * Why this file exists: the first version of this comparator produced false
 * "price moved" verdicts because it read price-like strings out of the page's
 * navigation ("$500 & UNDER"). Navigation, cross-sell rails and "recently
 * viewed" tiles are NOT product prices, so they are excluded by construction
 * here: a price counts only if it comes from (a) the seller's JSON-LD offer
 * data, (b) the seller's own product JSON feed, or (c) an explicit verbatim
 * read. Audit group E08 pins that rule.
 *
 * Usage: node scripts/compare_live_e33f8670.mjs [data/live/<file>.json]
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const read = async (p) => JSON.parse(await readFile(join(ROOT, p), 'utf8'));

const rings = await read('data/rings.json');
const gold = await read('data/gold-price.json');

const argFile = process.argv[2];
const liveFile =
  argFile ||
  join(
    'data/live',
    readdirSync(join(ROOT, 'data/live'))
      .filter((f) => /^\d{4}-\d{2}-\d{2}T/.test(f) && f.endsWith('.json'))
      .sort()
      .pop()
  );
const live = await read(liveFile);

/* ------------------------------------------------------------------ helpers */

const KARAT = /(\d{2})\s*(?:k|kt)\b/i;

/** The stored karat of a row, as a number (14 for "14K"). */
const rowKarat = (row) => {
  const m = KARAT.exec(row.karat || '');
  return m ? Number(m[1]) : null;
};

/**
 * A metal label is only usable for a 14K comparison if it says 14K and does not
 * say a competing metal. Vermeil and plated pieces are gold *over* another
 * metal, so their price is never a 14K-solid price.
 */
const metalMatchesKarat = (label, karat) => {
  if (!label) return false;
  const l = String(label).toLowerCase();
  if (!new RegExp(`(^|[^0-9])${karat}\\s*(k|kt)\\b`).test(l)) return false;
  return !/vermeil|plated|filled|gold[- ]fill|silver|palladium|platinum|steel/.test(l);
};

/** Variant groups keyed by metal label, computed from option_names or the title. */
const metalGroups = (feed) => {
  if (!feed || !Array.isArray(feed.variants) || !feed.variants.length) return null;
  const names = Array.isArray(feed.option_names) ? feed.option_names : [];
  let metalIdx = names.findIndex((n) => /metal|rate|material/i.test(n));
  if (metalIdx < 0) metalIdx = 0; // Shopify prints "<metal> / <size>" in the title
  const groups = new Map();
  for (const v of feed.variants) {
    const opts = Array.isArray(v.options) ? v.options : String(v.title || '').split(' / ');
    const label = String(opts[metalIdx] ?? '').trim();
    const price = Number(v.price);
    if (!label || !Number.isFinite(price) || price <= 0) continue;
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label).push(price);
  }
  const out = {};
  for (const [k, arr] of groups) out[k] = { min: Math.min(...arr), max: Math.max(...arr), n: arr.length };
  return out;
};

/** JSON-LD single prices, deduped, in dollars. */
const jsonldPrices = (row) =>
  [...new Set((row.extraction?.jsonld_prices || []).map((p) => Number(p.value)).filter((n) => Number.isFinite(n) && n > 0))];

/** The seller's own og:price:amount, when the page exposes it. */
const ogPrice = (row) => {
  const raw = row.extraction?.meta?.['og:price:amount'];
  if (!raw) return null;
  const n = Number(String(raw).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
};

const fmt = (n) => (n == null ? '—' : `$${n.toLocaleString('en-US')}`);

/* -------------------------------------------------------------------- rows */

const ledger = [];
for (const row of rings.rows) {
  const ev = live.rows?.find((r) => r.id === row.id);
  const karat = rowKarat(row);
  const groups = metalGroups(ev?.variant_feed);
  const matching = groups
    ? Object.entries(groups).filter(([label]) => (karat ? metalMatchesKarat(label, karat) : false))
    : [];

  const groupLow = matching.length ? Math.min(...matching.map(([, g]) => g.min)) : null;
  const groupHigh = matching.length ? Math.max(...matching.map(([, g]) => g.max)) : null;

  const observed = new Set(jsonldPrices(ev || {}));
  if (ogPrice(ev || {}) != null) observed.add(ogPrice(ev || {}));

  const storedLow = row.price_low;
  const storedHigh = row.price_high;

  let verdict;
  let detail = '';
  if (!ev) {
    verdict = 'not_in_run';
  } else if (!ev.ok) {
    verdict = 'fetch_failed';
    detail = `HTTP ${ev.http_status}`;
  } else if (
    ev.variant_feed &&
    Number(ev.variant_feed.price_min) === storedLow &&
    Number(ev.variant_feed.price_max) === storedHigh
  ) {
    // The seller's own product feed publishes exactly the stored range. This is
    // the strongest form: both endpoints reproduce, not just the low one.
    verdict = 'confirmed_feed_range';
    detail = `feed price_min ${fmt(Number(ev.variant_feed.price_min))} / price_max ${fmt(Number(ev.variant_feed.price_max))}`;
  } else if (groupLow != null && groupLow === storedLow && (storedHigh == null || storedHigh === storedLow)) {
    // Stored value is the entry price of the karat the row claims. Higher-priced
    // options (other sizes, stone grades, other colours) are not drift.
    verdict = 'confirmed_low_end';
    detail = `${karat}K options span ${fmt(groupLow)}–${fmt(groupHigh)}; the stored figure is the ${karat}K entry price`;
  } else if (groupLow != null && groupLow === storedLow && (groupHigh === storedHigh || storedHigh == null)) {
    verdict = 'confirmed_variant_feed';
    detail = `${karat}K variants ${matching.map(([l, g]) => `${l} ${fmt(g.min)}–${fmt(g.max)}`).join(' · ')}`;
  } else if (groupLow != null && storedLow >= groupLow && storedLow <= groupHigh) {
    verdict = 'stored_inside_variant_range';
    detail = `${karat}K variants span ${fmt(groupLow)}–${fmt(groupHigh)}; stored ${fmt(storedLow)}–${fmt(storedHigh)}`;
  } else if (observed.has(storedLow) && (storedHigh == null || storedHigh === storedLow || observed.has(storedHigh))) {
    verdict = 'confirmed_jsonld';
    detail = [...observed].sort((a, b) => a - b).map(fmt).join(' / ');
  } else if (groupLow != null) {
    verdict = 'price_moved';
    detail = `${karat}K variants now ${fmt(groupLow)}–${fmt(groupHigh)}; stored ${fmt(storedLow)}–${fmt(storedHigh)}`;
  } else if (observed.size) {
    const lo = Math.min(...observed);
    const hi = Math.max(...observed);
    verdict = lo === storedLow && hi === storedHigh ? 'confirmed_jsonld' : storedLow >= lo && storedLow <= hi ? 'stored_inside_jsonld' : 'price_moved';
    detail = `page offers ${fmt(lo)}–${fmt(hi)}; stored ${fmt(storedLow)}–${fmt(storedHigh)}`;
  } else {
    verdict = 'no_machine_price';
    detail = 'the page carries no JSON-LD offer and no variant feed';
  }

  ledger.push({
    id: row.id,
    retailer: row.retailer,
    url: row.source_url,
    http_status: ev?.http_status ?? null,
    final_url: ev?.final_url ?? null,
    fetched_at: ev?.fetched_at ?? null,
    stored: { low: storedLow, high: storedHigh, karat: row.karat },
    observed: {
      jsonld: [...observed].sort((a, b) => a - b),
      og: ogPrice(ev || {}),
      variant_groups: groups,
      karat_groups: Object.fromEntries(matching),
    },
    verdict,
    detail,
  });
}

/* --------------------------------------------------- second channel merge */

/*
 * The Actions runner and this sandbox use different network paths. Ten hosts
 * answer the runner with HTTP 403 and four more render their price client-side,
 * so a row that the runner could not price is not automatically unverified: a
 * verbatim read on the other channel counts. Every such read lives in the JSON
 * file below with its quote, and is merged here rather than typed into the page.
 */
let manual = { row_reads: [], gold_reads: [] };
try {
  manual = await read('data/session-e33f8670/manual-reads-2026-10-23.json');
} catch {
  /* the ledger is still valid without the second channel; counts will show it */
}
const manualById = Object.fromEntries((manual.row_reads || []).map((m) => [m.id, m]));

for (const r of ledger) {
  const m = manualById[r.id];
  if (!m) continue;
  r.manual = {
    read_at: m.read_at,
    verdict: m.verdict,
    price_low: m.price_low,
    price_high: m.price_high,
    verbatim: m.verbatim,
    note: m.note || null,
    channel: 'fetch_page text channel',
  };
  const manualConfirms =
    ['confirmed', 'confirmed_with_rename'].includes(m.verdict) &&
    m.price_low === r.stored.low &&
    (m.price_high == null || m.price_high === r.stored.high);
  if (manualConfirms) {
    if (r.verdict === 'fetch_failed' || r.verdict === 'no_machine_price' || r.verdict === 'no_machine_price') {
      r.verdict = 'confirmed_manual_read';
      r.detail = `runner could not price this page; the second channel read ${fmt(m.price_low)} — ${m.verbatim.slice(0, 140)}`;
    } else {
      r.corroborated_by_manual_read = true;
    }
  } else if (m.verdict === 'not_reproduced' || m.verdict === 'pdp_shows_no_price') {
    r.verdict = m.verdict === 'pdp_shows_no_price' ? 'pdp_shows_no_price' : 'not_reproducible_this_pass';
    r.detail = (m.note || m.verbatim).slice(0, 220);
  }
}

/* ------------------------------------------------------------------- totals */

const tally = {};
for (const r of ledger) tally[r.verdict] = (tally[r.verdict] || 0) + 1;

const reproduced = ledger.filter((r) => /^confirmed/.test(r.verdict)).length;
const coverage = {
  pages_opened_today: ledger.filter((r) => r.http_status === 200 || r.manual).length,
  runner_read: ledger.filter((r) => r.http_status === 200).length,
  runner_forbidden: ledger.filter((r) => r.http_status === 403).length,
  second_channel_read: ledger.filter((r) => r.manual).length,
  prices_reproduced_today: reproduced,
  prices_not_reproduced: ledger.length - reproduced,
  fetch_failed_both_channels: ledger.filter((r) => !r.manual && r.http_status !== 200).length,
};

const out = {
  as_of: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
  evidence_file: liveFile,
  evidence_finished_at: live.finished_at || null,
  evidence_started_at: live.started_at || null,
  gold: gold.primary,
  rows_in_run: live.rows?.length ?? 0,
  row_count: ledger.length,
  coverage,
  tally,
  rows: ledger,
};

await mkdir(join(ROOT, 'data/session-e33f8670'), { recursive: true });
await writeFile(join(ROOT, 'data/session-e33f8670/live-comparison.json'), JSON.stringify(out, null, 1) + '\n');

/* The public-facing ledger: one row per listing, with the verdict, the channels
 * that read it, and the quote. The re-check page and audit E01-E09 read this. */
const publicLedger = {
  as_of: '2026-10-23',
  pass: 'T51-e33f8670',
  evidence_file: liveFile,
  evidence_started_at: out.evidence_started_at,
  evidence_finished_at: out.evidence_finished_at,
  gold: gold.primary,
  row_count: ledger.length,
  coverage,
  tally: out.tally,
  rows: ledger.map((r) => ({
    id: r.id,
    retailer: r.retailer,
    source_url: r.source_url,
    http_status: r.http_status,
    channel: r.manual ? (r.http_status === 200 ? 'runner + second channel' : 'second channel') : 'runner',
    verdict: r.verdict,
    price_reproduced: /^confirmed/.test(r.verdict),
    stored_price_low: r.stored.low,
    stored_price_high: r.stored.high,
    observed_jsonld: r.observed.jsonld,
    observed_variant_groups: r.observed.variant_groups,
    manual_read: r.manual || null,
    detail: r.detail,
  })),
};
await writeFile(join(ROOT, 'data/verification-2026-10-23-e33f8670.json'), JSON.stringify(publicLedger, null, 1) + '\n');

console.log(`compared ${ledger.length} stored rows against ${liveFile}`);
console.log('coverage:', JSON.stringify(coverage));
const tally2 = {};
for (const r of ledger) tally2[r.verdict] = (tally2[r.verdict] || 0) + 1;
console.log('verdicts:', JSON.stringify(tally2));
for (const r of ledger.filter((x) => !/^confirmed/.test(x.verdict))) {
  console.log(`${r.verdict.padEnd(28)} ${r.id.padEnd(26)} stored ${fmt(r.stored.low)}–${fmt(r.stored.high)} | ${r.detail}`);
}
