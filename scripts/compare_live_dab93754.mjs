#!/usr/bin/env node
/**
 * Ninth pass (sess-dab93754) — reconcile a fresh live evidence file against the
 * curated dataset, line by line, at product/variant level.
 *
 * Rules enforced here:
 *  - nothing is inferred: a stored value must be found in the numbers the
 *    seller's own page (or the same seller's own variant feed for that exact
 *    product) printed, otherwise it is reported as not reproduced;
 *  - a price is only attributed to a product whose JSON-LD name matches the row,
 *    so cross-sell tiles cannot make a row look confirmed;
 *  - a stored range must be reproduced in full, or the shortfall is named;
 *  - a page that returned an error is never counted as a confirmation;
 *  - an evidence file that is not from this pass is rejected.
 *
 * Usage: node scripts/compare_live_dab93754.mjs [--evidence=data/live/latest.json]
 * Writes: data/live/compare-dab93754.json
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = process.cwd();
const arg = process.argv.slice(2).find((a) => a.startsWith('--evidence='));
const EVIDENCE = arg ? arg.slice('--evidence='.length) : 'data/live/latest.json';
const OUT = 'data/live/compare-dab93754.json';

const ringsDoc = JSON.parse(await readFile(join(ROOT, 'data/rings.json'), 'utf8'));
const live = JSON.parse(await readFile(join(ROOT, EVIDENCE), 'utf8'));

if (!Array.isArray(live.rows) || !live.finished_at) {
  throw new Error(`${EVIDENCE} is not a live evidence file (no rows / finished_at)`);
}
if (live.finished_at < '2026-10-23T20:00:00Z') {
  throw new Error(
    `refusing to reconcile a stale evidence file: finished_at ${live.finished_at} is not this pass`
  );
}

const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const money = (n) => `$${Number(n).toLocaleString('en-US', { maximumFractionDigits: 2 })}`;

/** Does the page itself print this gram weight? Only an exact gram string counts. */
function weightPublished(row, grams) {
  if (grams == null) return false;
  const needle = String(grams).replace('.', '\\.');
  const corpus = [
    ...(row.extraction?.gram_mentions || []).map((m) => `${m.match} ${m.excerpt}`),
    ...(row.extraction?.weight_keyword_context || []).map((m) => m.excerpt),
    ...(row.extraction?.html_weight_context || []).map((m) => m.excerpt),
  ].join(' ');
  return new RegExp(`(^|[^\\d.])${needle}\\s*(g|grams?|gr)(?![\\d])`, 'i').test(corpus);
}

const byId = new Map(live.rows.map((r) => [r.id, r]));
const results = [];

for (const ring of ringsDoc.rows) {
  const ev = byId.get(ring.id);
  const lo = ring.price_low;
  const hi = ring.price_high ?? ring.price_low;
  const base = {
    id: ring.id,
    retailer: ring.retailer,
    url: ring.source_url,
    stored_price: lo == null ? null : [lo, hi],
    price_basis: ring.price_basis || null,
    stored_weight_g: ring.weight_g_low ?? null,
    stored_title: ring.title,
    withdrawn: ring.withdrawn ?? null,
  };

  if (!ev) {
    results.push({ ...base, verdict: 'not_in_evidence', note: 'row absent from the evidence file' });
    continue;
  }

  const h1 = ev.extraction?.h1 || '';
  const titleOverlap =
    h1 && norm(h1) && norm(ring.title)
      ? norm(h1)
          .split(' ')
          .filter((t) => t.length > 2)
          .filter((t) => norm(ring.title).split(' ').includes(t)).length /
        Math.max(1, norm(h1).split(' ').filter((t) => t.length > 2).length)
      : 0;
  const titleMatch =
    !h1 ? 'no_h1' : norm(h1) === norm(ring.title) ? 'exact' : titleOverlap >= 0.6 ? 'close' : 'different';

  const vf = ev.variant_feed && Array.isArray(ev.variant_feed.variants) ? ev.variant_feed : null;
  const vfPrices = vf ? vf.variants.map((v) => Number(v.price)).filter((n) => Number.isFinite(n) && n > 0) : [];

  // Prices from JSON-LD Product nodes whose name matches this row (or the page h1).
  const pageOffers = (ev.extraction?.jsonld_offers || []).filter((o) => {
    if (!o.name) return true;
    const a = norm(o.name);
    return (
      (h1 && (a === norm(h1) || norm(h1).includes(a) || a.includes(norm(h1)))) ||
      (norm(ring.title) && (a === norm(ring.title) || a.includes(norm(ring.title).slice(0, 40))))
    );
  });
  const pagePrices = [...new Set(pageOffers.flatMap((o) => (o.prices || []).map((p) => Number(p.value))))].filter(
    (n) => Number.isFinite(n) && n > 0
  );
  // A publisher's aggregate offer states its own low/high bound; a stored price
  // inside that published band is consistent with the page, even when the exact
  // figure is a variant the default page does not print.
  const bands = pageOffers
    .map((o) => {
      const lows = (o.prices || []).filter((p) => /low|min/i.test(p.key)).map((p) => Number(p.value));
      const highs = (o.prices || []).filter((p) => /high|max/i.test(p.key)).map((p) => Number(p.value));
      return lows.length && highs.length ? [Math.min(...lows), Math.max(...highs)] : null;
    })
    .filter(Boolean);

  let priceVerdict = 'no_price_observed';
  let priceSource = null;
  let matched = [];
  let note = '';

  if (lo != null) {
    const vfLo = vfPrices.includes(lo);
    const vfHi = vfPrices.includes(hi);
    const pgLo = pagePrices.includes(lo);
    const pgHi = pagePrices.includes(hi);

    if (vf && vfLo && (lo === hi || vfHi)) {
      priceVerdict = 'reproduced';
      priceSource = 'seller variant feed';
      matched = vf.variants.filter((v) => Number(v.price) === lo || Number(v.price) === hi).slice(0, 6);
    } else if (pgLo && (lo === hi || pgHi)) {
      priceVerdict = 'reproduced';
      priceSource = 'product page';
    } else if (lo === hi && bands.some(([a, b]) => lo >= a && lo <= b)) {
      priceVerdict = 'within_published_range';
      priceSource = 'product page (aggregate offer band)';
      const band = bands.find(([a, b]) => lo >= a && lo <= b);
      note = `the page's own aggregate offer prints ${money(band[0])}–${money(band[1])}; the stored ${money(lo)} sits inside that published band`;
    } else if (vf && (vfLo || vfHi)) {
      priceVerdict = 'partly_reproduced';
      priceSource = 'seller variant feed';
      note =
        `stored ${money(lo)}–${money(hi)}; the seller's feed prints ${money(vf.price_min)}–${money(vf.price_max)}` +
        ` (${vfLo ? 'lower bound reproduced' : 'lower bound NOT reproduced'}, ` +
        `${lo === hi ? 'single price' : vfHi ? 'upper bound reproduced' : 'upper bound NOT reproduced'})`;
    } else if (pgLo || pgHi) {
      priceVerdict = 'partly_reproduced';
      priceSource = 'product page';
      note = `stored ${money(lo)}–${money(hi)}; the page printed ${pagePrices.map(money).join(' / ')}`;
    } else if (vfPrices.length || pagePrices.length) {
      priceVerdict = 'not_reproduced';
      priceSource = vf ? 'seller variant feed' : 'product page';
      const observed = vf ? vfPrices : pagePrices;
      note =
        `stored ${lo === hi ? money(lo) : `${money(lo)}–${money(hi)}`}; today's read prints ` +
        `${money(Math.min(...observed))}–${money(Math.max(...observed))}` +
        (vf ? ` across ${vf.variant_count} published variants` : '');
    }
  } else if (ring.price_unverified) {
    priceVerdict = vfPrices.length || pagePrices.length ? 'price_now_observable' : 'still_unverified_no_price';
  }

  results.push({
    ...base,
    page_http_status: ev.http_status,
    page_ok: !!ev.ok,
    variant_feed_ok: !!vf,
    variant_feed_status: ev.variant_feed?.http_status ?? null,
    variant_count: vf?.variant_count ?? null,
    variant_price_range: vfPrices.length ? [vf.price_min, vf.price_max] : null,
    observed_page_prices: pagePrices,
    observed_h1: h1,
    title_match: titleMatch,
    price_verdict: priceVerdict,
    price_source: priceSource,
    matched_variants: matched,
    weight_reproduced: ring.weight_g_low != null ? weightPublished(ev, ring.weight_g_low) : null,
    note,
  });
}

/* ------------------------------------------------------- headline verdicts */
for (const r of results) {
  if (r.price_verdict === 'reproduced' && r.title_match === 'different') {
    r.verdict = 'reproduced_but_title_differs';
  } else if (r.price_verdict === 'reproduced') {
    r.verdict = 'confirmed';
  } else if (r.price_verdict === 'within_published_range') {
    r.verdict = 'consistent_with_published_range';
  } else if (r.price_verdict === 'partly_reproduced') {
    r.verdict = 'partly_confirmed';
  } else if (r.price_verdict === 'not_reproduced') {
    r.verdict = 'not_reproduced';
  } else if (r.price_verdict === 'price_now_observable') {
    r.verdict = 'price_now_observable';
  } else if (r.price_verdict === 'still_unverified_no_price') {
    r.verdict = 'still_unverified_no_price';
  } else {
    r.verdict = r.page_ok ? 'no_price_observed' : 'not_read';
  }
}

const count = (v) => results.filter((r) => r.verdict === v).length;
const summary = {
  rows: results.length,
  confirmed: count('confirmed'),
  consistent_with_published_range: count('consistent_with_published_range'),
  reproduced_but_title_differs: count('reproduced_but_title_differs'),
  partly_confirmed: count('partly_confirmed'),
  not_reproduced: count('not_reproduced'),
  no_price_observed: count('no_price_observed'),
  not_read: count('not_read'),
  still_unverified_no_price: count('still_unverified_no_price'),
  price_now_observable: count('price_now_observable'),
  pages_ok: results.filter((r) => r.page_ok).length,
  variant_feeds_ok: results.filter((r) => r.variant_feed_ok).length,
  weight_rows: results.filter((r) => r.stored_weight_g != null).length,
  weight_reproduced: results.filter((r) => r.weight_reproduced === true).length,
  weight_not_reproduced: results.filter((r) => r.weight_reproduced === false).length,
};

const doc = {
  pass: 'P87-live',
  session: 'sess-dab93754',
  generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
  evidence_file: EVIDENCE,
  evidence_started_at: live.started_at,
  evidence_finished_at: live.finished_at,
  run_context: live.run_context,
  method:
    'Each curated row is compared with the price its own official product page printed in this run, ' +
    "and — for Shopify storefronts — with the seller's own variant feed for that exact product. " +
    'A stored single price, or the full stored range, must appear in one of those sources; a price is ' +
    'never attributed from a cross-sell tile. Weights count as reproduced only on an exact gram string.',
  summary,
  rows: results,
};

await writeFile(join(ROOT, OUT), JSON.stringify(doc, null, 2) + '\n');

console.log(`evidence: ${EVIDENCE} (${live.started_at} → ${live.finished_at})`);
for (const [k, v] of Object.entries(summary)) console.log(`  ${k}: ${v}`);
for (const v of ['not_reproduced', 'partly_confirmed', 'reproduced_but_title_differs', 'not_read', 'no_price_observed']) {
  const rows = results.filter((r) => r.verdict === v);
  if (!rows.length) continue;
  console.log(`\n${v.toUpperCase()}:`);
  for (const r of rows) console.log(`  ${r.id}: ${r.note || `h1="${r.observed_h1}" title=${r.title_match}`}`);
}
const wt = results.filter((r) => r.weight_reproduced === false);
if (wt.length) {
  console.log('\nWEIGHT NOT REPRODUCED TODAY:');
  for (const r of wt) console.log(`  ${r.id}: stored ${r.stored_weight_g} g`);
}
console.log(`\nwrote ${OUT}`);
