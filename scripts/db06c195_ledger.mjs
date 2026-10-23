#!/usr/bin/env node
/**
 * GOLD1 — build the independent third-channel ledger (T49, sess-db06c195).
 *
 * Turns one raw `data/live/<timestamp>.json` read into a per-row, human-auditable ledger:
 * what the seller printed on this session's clock, what the dataset stores, and a verdict.
 *
 * Rules (same as the rest of the project):
 *   - a value is "match" only when the figure the seller printed equals the stored figure
 *   - a figure the seller prints that differs from the stored one is reported as "drift",
 *     never silently reconciled
 *   - a page that refused the read is "not_read"; it is never "match"
 *   - the verbatim excerpt is stored next to every verdict so a reader can re-check the page
 *
 * Run: node scripts/db06c195_ledger.mjs [--live=data/live/<file>.json]
 * Writes: data/session-db06c195/third-channel-<timestamp>.json
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const read = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'));

const arg = process.argv.find((a) => a.startsWith('--live='));
const livePath =
  arg?.slice('--live='.length) ||
  (() => {
    const files = readdirSync(join(ROOT, 'data/live')).filter((f) => /^\d{4}-\d{2}-\d{2}T.*Z\.json$/.test(f)).sort();
    return join('data/live', files[files.length - 1]);
  })();

const live = read(livePath);
const rows = read('data/rings.json').rows;
const gold = read('data/gold-price.json');
const OZT = 31.1034768;
const byId = new Map(live.rows.map((r) => [r.id, r]));

function observedPrices(l) {
  const set = new Map(); // value -> where it was seen
  const add = (v, where) => {
    const n = Number(String(v).replace(/[^0-9.]/g, ''));
    if (!Number.isFinite(n) || n <= 0) return;
    const k = Math.round(n * 100) / 100;
    if (!set.has(k)) set.set(k, where);
  };
  const ex = l.extraction || {};
  for (const p of ex.jsonld_prices || []) add(p.value, 'json-ld price');
  for (const o of ex.jsonld_offers || []) for (const p of o.prices || []) add(p.value, 'json-ld offer');
  for (const m of ex.prices || []) {
    const mm = String(m.match).replace(/,/g, '').match(/\d+(?:\.\d+)?/);
    if (mm) add(mm[0], 'visible page text');
  }
  const vf = l.variant_feed;
  if (vf) {
    for (const v of vf.variants || []) add(v.price, 'seller variant feed');
    if (vf.price_min != null) add(vf.price_min, 'seller product feed (min)');
    if (vf.price_max != null) add(vf.price_max, 'seller product feed (max)');
  }
  return [...set.entries()].sort((a, b) => a[0] - b[0]).map(([value, where]) => ({ value, where }));
}

function quoteFor(l, value) {
  const ex = l.extraction || {};
  const hit = (ex.prices || []).find((p) => {
    const mm = String(p.match).replace(/,/g, '').match(/\d+(?:\.\d+)?/);
    return mm && Math.abs(Number(mm[0]) - value) < 0.011;
  });
  if (hit) return hit.excerpt?.slice(0, 240) || hit.match;
  const v = (l.variant_feed?.variants || []).find((x) => Math.abs(Number(x.price) - value) < 0.011);
  if (v) return `variant feed: "${v.title}" = ${v.price}`;
  return null;
}

const out = {
  generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
  session: 'sess-db06c195',
  task: 'T49 — independent third-channel verification',
  channel: 'GitHub Actions runner (data/live) + Arena page-fetch channel (gold feed cross-read)',
  source_ledger: livePath,
  source_ledger_finished_at: live.finished_at,
  dataset: { generated_at: read('data/rings.json').generated_at, rows: rows.length },
  gold_readings: live.gold_price_readings,
  gold_stored: {
    price_usd_per_ozt: gold.primary.price_usd_per_ozt,
    publisher_timestamp: gold.primary.publisher_timestamp,
    source_url: gold.primary.source_url,
  },
  counts: {},
  rows: [],
};

let ok = 0,
  drift = 0,
  notRead = 0,
  noPrice = 0;

for (const r of rows) {
  const l = byId.get(r.id);
  const obs = l ? observedPrices(l) : [];
  const readable = Boolean(l && l.http_status === 200);
  const entry = {
    id: r.id,
    retailer: r.retailer,
    url: r.source_url,
    status_in_dataset: r.verification_status,
    stored_price: [r.price_low, r.price_high],
    stored_weight_g: [r.weight_g_low, r.weight_g_high],
    read: l
      ? { http_status: l.http_status, fetched_at: l.fetched_at, error: l.error || null, title: l.extraction?.h1 || null }
      : null,
    observed_prices: obs.slice(0, 12),
    verdict: null,
    quote: null,
  };

  if (!l || !readable) {
    notRead++;
    entry.verdict = 'not_read';
    entry.note =
      'The seller refused or returned nothing on this pass (HTTP ' +
      (l?.http_status ?? 'n/a') +
      '). The stored values are left exactly as they were and are NOT counted as freshly confirmed.';
    out.rows.push(entry);
    continue;
  }
  if (r.price_low == null) {
    noPrice++;
    entry.verdict = 'no_price_claimed';
    entry.note = 'The dataset claims no price for this row, so there is nothing to match.';
    out.rows.push(entry);
    continue;
  }
  const has = (v) => v == null || obs.some((o) => Math.abs(o.value - v) < 0.011);
  if (has(r.price_low) && has(r.price_high)) {
    ok++;
    entry.verdict = r.verification_status === 'partly_verified' ? 'match_at_product_level' : 'match';
    entry.quote = quoteFor(l, r.price_low);
  } else {
    drift++;
    entry.verdict = 'drift_or_unreproduced';
    entry.note =
      'The stored figure did not appear among the prices the seller printed on this read. ' +
      'It is reported for review, not corrected here.';
  }
  const grams = [];
  const harvest = (t) => {
    for (const m of String(t || '').matchAll(/(\d+(?:\.\d+)?)\s*(?:g|grams?)\b/gi)) grams.push(Number(m[1]));
  };
  for (const g of l.extraction?.gram_mentions || []) harvest(g.match || g.excerpt || g);
  for (const c of l.extraction?.weight_keyword_context || []) harvest(c.excerpt || c);
  if (l.variant_feed?.metafields) harvest(JSON.stringify(l.variant_feed.metafields));
  entry.weight_read = {
    stored: [r.weight_g_low, r.weight_g_high],
    grams_seen_on_page: [...new Set(grams)].slice(0, 12),
    verdict:
      r.weight_g_low == null
        ? 'not_published_in_dataset'
        : [r.weight_g_low, r.weight_g_high]
            .filter((v) => v != null)
            .every((v) => grams.some((g) => Math.abs(g - v) < 0.011))
          ? 'reproduced'
          : 'carried_on_quote',
  };
  out.rows.push(entry);
}

out.counts = {
  rows: rows.length,
  read_ok: live.fetch_ok,
  read_refused: notRead,
  price_matched: ok,
  price_drift_or_unreproduced: drift,
  no_price_claimed: noPrice,
  weights_reproduced_now: out.rows.filter((r) => r.weight_read?.verdict === 'reproduced').length,
  weights_carried_on_quote: out.rows.filter((r) => r.weight_read?.verdict === 'carried_on_quote').length,
};

// Melt arithmetic re-derived from the stored spot — never retyped.
out.melt_rederived = rows
  .filter((r) => r.weight_g_low && r.price_low != null)
  .map((r) => {
    const purity = Number(String(r.karat).replace(/[^0-9.]/g, '')) / 24;
    const perGram = gold.primary.price_usd_per_ozt / OZT;
    const lo = Math.round(r.weight_g_low * purity * perGram * 100) / 100;
    const hi = Math.round((r.weight_g_high ?? r.weight_g_low) * purity * perGram * 100) / 100;
    return { id: r.id, karat: r.karat, weight_g: [r.weight_g_low, r.weight_g_high], fine_gold_g: [Number((r.weight_g_low * purity).toFixed(3)), Number(((r.weight_g_high ?? r.weight_g_low) * purity).toFixed(3))], melt_usd: [lo, hi], asking_usd: [r.price_low, r.price_high] };
  });

mkdirSync(join(ROOT, 'data/session-db06c195'), { recursive: true });
const stamp = (live.finished_at || new Date().toISOString()).replace(/[:]/g, '-');
const outPath = `data/session-db06c195/third-channel-${stamp}.json`;
writeFileSync(join(ROOT, outPath), JSON.stringify(out, null, 2) + '\n');

console.log(`third-channel ledger → ${outPath}`);
console.log(JSON.stringify(out.counts, null, 1));
const bad = out.rows.filter((r) => r.verdict === 'drift_or_unreproduced');
if (bad.length) {
  console.log('drift / unreproduced:');
  for (const b of bad) console.log(' -', b.id, JSON.stringify(b.stored_price), 'observed', b.observed_prices.map((o) => o.value).slice(0, 8).join(','));
}
process.exit(drift === 0 ? 0 : 2);
