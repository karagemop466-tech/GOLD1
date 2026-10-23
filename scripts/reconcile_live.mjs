#!/usr/bin/env node
/**
 * GOLD1 reconciler for the 2026-10-23 live pass (P42).
 *
 * Inputs (evidence only, never edited by this script):
 *   data/live/latest.json              - machine re-read of 50 official product pages
 *   data/live/manual-2026-10-23.json   - hand reads for the 9 bot-walled pages
 *
 * Outputs:
 *   data/verification-2026-10-23.json  - the per-row ledger, with the quote each
 *                                        number was read from
 *   data/rings.json                    - ONLY the four evidence-backed
 *                                        corrections plus the withdrawal
 *   data/gold-price.json               - new timestamped gold reading
 *
 * Design rules:
 *  - a value is only changed when the seller's own page contradicts it AND the
 *    replacement is quoted verbatim in the ledger
 *  - a lower bound that is simply not reproduced is NOT rewritten; it is flagged
 *  - every row gets an explicit status so the site can say how fresh it is
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = process.cwd();
const read = async (p) => JSON.parse(await readFile(join(ROOT, p), 'utf8'));

const ringsDoc = await read('data/rings.json');
const live = await read('data/live/latest.json');
const manual = await read('data/live/manual-2026-10-23.json');
const gold = await read('data/gold-price.json');

const PASS_DATE = '2026-10-23';
const liveById = Object.fromEntries(live.rows.filter(Boolean).map((r) => [r.id, r]));
const manualById = Object.fromEntries(manual.reads.map((r) => [r.id, r]));

/* ------------------------------------------------------------ extraction */

function observedPrices(entry) {
  if (!entry?.extraction) return null;
  const nums = entry.extraction.jsonld_prices
    .filter((p) => ['price', 'lowPrice', 'highPrice', 'minPrice', 'maxPrice'].includes(p.key))
    .map((p) => p.value)
    .filter((n) => Number.isFinite(n) && n > 0);
  if (!nums.length) return null;
  return { min: Math.min(...nums), max: Math.max(...nums), all: [...new Set(nums)].sort((a, b) => a - b) };
}

function observedWeight(entry) {
  if (!entry?.extraction) return null;
  for (const c of entry.extraction.html_weight_context || []) {
    const m = c.excerpt.match(/"metal_weight"\s*:\s*"(\d+(?:\.\d+)?)\s*grams?"/i);
    if (m) {
      const i = c.excerpt.search(/"metal_weight"/);
      const q = c.excerpt.slice(Math.max(0, i - 70), i + 60).replace(/\s+/g, ' ').trim();
      return { value: Number(m[1]), quote: q, where: 'seller spec panel (metal_weight)' };
    }
    if (/"metal_weight"\s*:\s*null/.test(c.excerpt)) {
      return { value: null, quote: 'seller spec panel publishes "metal_weight": null', where: 'seller spec panel (metal_weight)' };
    }
  }
  for (const g of entry.extraction.gram_mentions || []) {
    const t = g.excerpt;
    let m = t.match(/(\d+(?:\.\d+)?)\s?g\s*(?:\(gold\)|for gold)/i);
    if (m) return { value: Number(m[1]), quote: t.trim(), where: 'product description ("Item Weight … gold")' };
    m = t.match(/gold[^0-9]{0,14}(\d+(?:\.\d+)?)\s?g\b/i);
    if (m) return { value: Number(m[1]), quote: t.trim(), where: 'product description ("Item Weight … gold")' };
  }
  return null;
}

/* ------------------------------------------- explicit, quoted corrections */
/**
 * Each correction names the row, the field, the old value, the new value, the
 * verbatim quote that justifies it and the URL that quote came from. Nothing is
 * applied here that is not backed by one of these.
 */
const CORRECTIONS = [
  {
    id: 'rs-571223',
    field: 'price',
    from: [849, 849],
    to: [799, 849],
    quote:
      'Size 5 849.00 · Size 5.5 799.00 · Size 6 849.00 · Size 6.5 799.00 · Size 7 849.00 · Size 7.5 799.00 · Size 8 849.00 · Size 8.5 799.00 · Size 9 849.00',
    url: 'https://www.ross-simons.com/products/571223.json',
    why: 'Full sizes are $849 and half sizes are $799 in the seller\'s own variant feed. The row stored a single $849.',
  },
  {
    id: 'rs-943668',
    field: 'price',
    from: [1269, 1269],
    to: [1269, 1439],
    quote: 'CLEARANCE 29% Off $1,795 $1,269 ; variant feed: Size 5 1439.00, Size 6 1439.00, Size 6.5 1439.00',
    url: 'https://www.ross-simons.com/products/943668.json',
    why: 'The page shows a $1,269 sale price on the default variant, and the seller\'s variant feed lists $1,439 for other sizes.',
  },
  {
    id: 'mej-deb',
    field: 'price',
    from: [1100, 1100],
    to: [1100, 1700],
    quote: 'JSON-LD AggregateOffer: "lowPrice": 1100, "highPrice": 1700; page headline "From $1,100"',
    url: 'https://mejuri.com/products/diamond-eternity-band',
    why: 'Mejuri publishes a $1,100–$1,700 range in its own structured data; the row stored only the starting price.',
  },
  {
    id: 'mej-bde',
    field: 'price',
    from: [2900, 2900],
    to: [2900, 3500],
    quote: 'JSON-LD AggregateOffer: "lowPrice": 2900, "highPrice": 3500; page headline "From $2,900"',
    url: 'https://mejuri.com/products/bold-diamond-eternity-ring',
    why: 'Mejuri publishes a $2,900–$3,500 range in its own structured data; the row stored only the starting price.',
  },
];

const correctionsApplied = [];

/* ------------------------------------------------------------------ rows */
const rows = ringsDoc.rows.map((row) => {
  const entry = liveById[row.id];
  const hand = manualById[row.id];
  const prices = observedPrices(entry);
  const weight = observedWeight(entry);

  const rec = {
    id: row.id,
    retailer: row.retailer,
    title_in_data: row.title,
    source_url: row.source_url,
    stored_price: { low: row.price_low ?? null, high: row.price_high ?? null },
    stored_weight_g: row.weight_g_low ?? null,
    stored_solid_stated: row.solid_stated === true,
  };

  if (hand && hand.verdict !== 'unchanged' && hand.verdict !== 'range_widens') {
    rec.read = 'hand read 2026-10-23 (automated retrieval blocked or full variant read needed)';
    rec.http_status = entry?.http_status ?? null;
    rec.fetched_at = manual.fetched_at;
    rec.page_title = hand.observed.page_title || hand.observed.title || null;
    rec.manual_detail = hand.detail;
    rec.manual_verdict = hand.verdict;
    rec.manual_observed = hand.observed;
    rec.observed_prices = observedPrices(entry) ? { min: observedPrices(entry).min, max: observedPrices(entry).max } : null;
    rec.observed_weight = weight;
  } else if (entry?.ok) {
    rec.read = 'live 2026-10-23 (automated)';
    rec.http_status = entry.http_status;
    rec.fetched_at = entry.fetched_at;
    rec.page_title = entry.extraction.h1 || entry.extraction.title_tag;
    rec.observed_prices = prices ? { min: prices.min, max: prices.max, distinct: prices.all } : null;
    rec.observed_weight = weight;
    rec.solid_quote = (entry.extraction.solid_mentions || [])[0]?.excerpt?.trim() || null;
    rec.final_sale_quote = (entry.extraction.sale_mentions || [])[0]?.excerpt?.trim() || null;
  } else if (hand) {
    rec.read = 'hand read 2026-10-23 (automated retrieval blocked)';
    rec.http_status = entry?.http_status ?? null;
    rec.fetched_at = manual.fetched_at;
    rec.page_title = hand.observed.page_title || hand.observed.title || null;
    rec.manual_detail = hand.detail;
    rec.manual_verdict = hand.verdict;
  } else {
    rec.read = 'not re-read in this pass';
    rec.http_status = entry?.http_status ?? null;
    rec.fetched_at = null;
    rec.blocked_reason = entry
      ? 'the seller returned HTTP ' + entry.http_status + ' to the automated runner and no hand read was made'
      : 'no read attempted';
  }

  // ---- price verdict
  if (rec.manual_verdict === 'source_mismatch') {
    rec.price_verdict = 'source_mismatch';
  } else if (rec.manual_verdict === 'metadata_only') {
    rec.price_verdict = 'metadata_only_not_displayed';
  } else if (rec.manual_verdict === 'lower_bound_drift') {
    rec.price_verdict = 'lower_bound_not_reproduced';
  } else if (!prices || !entry?.ok) {
    rec.price_verdict = rec.read === 'not re-read in this pass' ? 'not_read' : 'no_structured_price';
  } else {
    const lo = row.price_low;
    const hi = row.price_high;
    if (prices.min < lo || prices.max > hi) rec.price_verdict = 'range_widens';
    else if (lo < prices.min) rec.price_verdict = 'lower_bound_not_reproduced';
    else rec.price_verdict = 'confirmed';
  }

  // ---- weight verdict
  if (weight && weight.value !== null) {
    rec.weight_verdict =
      row.weight_g_low === weight.value ? 'confirmed_on_page' : 'page_value_differs';
  } else if (rec.read.startsWith('live') && !weight && row.retailer === 'Aurate' && row.weight_g_low !== null) {
    rec.weight_verdict = 'not_reproduced_on_page';
    rec.weight_note =
      'Aurate does not print a gram weight in the static page or in its product JSON (the variant "grams" field is the 6 g shipping weight and is not the metal weight). The stored value came from the 2026-10-22 read and is not re-confirmed today.';
  } else if (rec.read.startsWith('live') && !weight) {
    rec.weight_verdict = 'no_gram_value_on_page';
  } else if (weight && weight.value === null) {
    rec.weight_verdict = 'seller_publishes_null';
  } else {
    rec.weight_verdict = 'not_read';
  }

  // ---- withdraw a row whose source URL no longer sells the described item
  if (rec.price_verdict === 'source_mismatch') {
    row.withdrawn = true;
    row.withdrawn_reason =
      'The seller now sells a different product under this URL and item number (see F51). The row is retained for the record and removed from the buy tables.';
    row.price_unverified = true;
    row.price_unverified_reason =
      `Withdrawn on ${PASS_DATE}: the seller now sells a different product under this URL and item number (F51). The last observed price describes the ring that used to be listed here, not the ring sold today, so it is published as unverified and never as a live price.`;
    row.flags = [...new Set([...(row.flags || []), 'price_unverified', 'price_not_reproducible'])];
    row.verification_status = 'withdrawn_source_mismatch';
    row.verified_at = PASS_DATE;
  } else if (rec.read === 'not re-read in this pass') {
    row.verification_status = 'not_reread_2026-10-23';
  } else if (rec.price_verdict === 'confirmed' || rec.price_verdict === 'range_widens') {
    row.verification_status = 'confirmed';
    row.verified_at = PASS_DATE;
    row.verified_by = 'sess-8dffa7e8';
  } else {
    row.verification_status = 'partly_verified';
    row.verified_at = PASS_DATE;
  }
  rec.status_in_data_after = row.verification_status;
  return rec;
});

/* apply the four price corrections */
for (const c of CORRECTIONS) {
  const row = ringsDoc.rows.find((r) => r.id === c.id);
  if (!row) continue;
  const before = [row.price_low, row.price_high];
  const already = before[0] === c.to[0] && before[1] === c.to[1];
  if (!already && (before[0] !== c.from[0] || before[1] !== c.from[1])) {
    throw new Error(`refusing to correct ${c.id}: stored price ${before} is neither the old ${c.from} nor the new ${c.to}`);
  }
  row.price_low = c.to[0];
  row.price_high = c.to[1];
  row.price_basis =
    c.to[0] === c.to[1]
      ? 'single listed price'
      : 'published variant range - the seller lists different prices for different options';
  if (!String(row.evidence).includes(`Re-checked ${PASS_DATE}: ${c.quote}`)) {
    row.evidence = `${row.evidence} | Re-checked ${PASS_DATE}: ${c.quote}.`;
  }
  row.reverified_at = PASS_DATE;
  row.reverified_pass = 'P42';
  // A published range means the price moves across variants/sizes. The audit
  // suite requires that to be disclosed on the row rather than left implicit.
  row.flags = [...new Set([...(row.flags || []), 'price_varies'])];
  row.price_basis =
    'published variant range - the seller lists different prices for different options';
  const rec = rows.find((r) => r.id === c.id);
  correctionsApplied.push({ ...c, record: rec ? rec.price_verdict : null });
}

/* ------------------------------- variant-level readings that resolve a
   product-level ambiguity. Each one quotes the variant line from the seller's
   own page, so the stored value is confirmed for the specific variant the row
   describes rather than for the product's default variant. */
const VARIANT_READS = {
  'ag-14k-leaves': {
    verdict: 'confirmed',
    quote:
      'variant "Clear Lab Diamond" price 219400 ; variant "Salt and Pepper Diamond" price 274400 (Automic Gold publishes 2,194.00 for the clear lab diamond and 2,744.00 for the salt-and-pepper stone)',
    note: 'The product-level JSON-LD reports 2,744 because it picks the salt-and-pepper variant. The row describes the Clear Lab Diamond variant, whose own price line is 2,194.00.',
  },
  'ag-14k-cluster': {
    verdict: 'confirmed',
    quote:
      'variant "Lab Diamond" price 163600 ; variant "Natural Diamond" price 286200',
    note: 'The product-level JSON-LD reports 2,862 because it picks the natural-diamond variant. The row describes the Lab Diamond variant, whose own price line is 1,636.00.',
  },
  'au-cigar': {
    verdict: 'variant_price_not_reproducible',
    quote:
      'og:price:amount 118 ; the product-level feed exposes only the cheapest variant (vermeil 118.00). The 14K yellow gold variant price is not readable from the product-level feed.',
    note: 'F39 stands. The stored 14K price of 1,308.00 was captured from the variant feed on 2026-10-22 and cannot be re-read today.',
  },
  'as-hazeline': {
    verdict: 'metadata_only_not_displayed',
    quote: 'og:price:amount 7,150.00 (seller metadata); stored range 7,150-9,200',
    note: 'The seller metadata still publishes the 7,150.00 starting price, matching the stored lower bound. The full 7,150-9,200 range was not re-read today.',
  },
  'as-bea-3stone': {
    verdict: 'metadata_only_not_displayed',
    quote: 'og:price:amount 5,400.00 (seller metadata); stored range 5,400-25,100',
    note: 'The seller metadata still publishes the 5,400.00 starting price, matching the stored lower bound. The full 5,400-25,100 range was not re-read today.',
  },
};

for (const rec of rows) {
  const v = VARIANT_READS[rec.id];
  if (!v) continue;
  rec.price_verdict = v.verdict;
  rec.variant_quote = v.quote;
  rec.variant_note = v.note;
  const row = ringsDoc.rows.find((r) => r.id === rec.id);
  if (v.verdict === 'confirmed') {
    row.verification_status = 'confirmed';
    row.verified_at = PASS_DATE;
    row.verified_by = 'sess-8dffa7e8';
  } else if (v.verdict === 'variant_price_not_reproducible') {
    row.verification_status = 'partly_verified';
    row.verified_at = PASS_DATE;
  } else {
    row.verification_status = 'partly_verified';
    row.verified_at = PASS_DATE;
  }
  rec.status_in_data_after = row.verification_status;
}

/* --------------------------------------------------------- gold reading */
const newReading = live.gold_price_readings.find((g) => g.publisher === 'gold-api.com' && g.price_usd_per_ozt);
if (newReading) {
  const already = (gold.readings || []).some((r) => r.publisher_timestamp === newReading.publisher_timestamp);
  if (!already) {
    gold.readings = gold.readings || [];
    gold.readings.unshift({
      label: 'Gold spot, USD per troy ounce',
      price_usd_per_ozt: newReading.price_usd_per_ozt,
      publisher: 'gold-api.com',
      publisher_timestamp: newReading.publisher_timestamp,
      source_url: newReading.url,
      observed_by: 'sess-8dffa7e8',
      observed_at: newReading.fetched_at,
    });
    gold.primary = gold.readings[0];
    gold.as_of = newReading.publisher_timestamp;
  }
}

/* ---------------------------------------------------------------- write */
const summary = {
  confirmed: rows.filter((r) => r.price_verdict === 'confirmed').length,
  range_widens: rows.filter((r) => r.price_verdict === 'range_widens').length,
  lower_bound_not_reproduced: rows.filter((r) => r.price_verdict === 'lower_bound_not_reproduced').length,
  source_mismatch: rows.filter((r) => r.price_verdict === 'source_mismatch').length,
  metadata_only: rows.filter((r) => r.price_verdict === 'metadata_only_not_displayed').length,
  not_read: rows.filter((r) => r.price_verdict === 'not_read').length,
  variant_price_not_reproducible: rows.filter((r) => r.price_verdict === 'variant_price_not_reproducible').length,
};

const ledger = {
  pass: 'P42',
  date: PASS_DATE,
  purpose:
    'Line-by-line re-read of every curated row at its own official product URL. Each row records the page it was read from, the values the seller printed, the verdict, and the verbatim quote the verdict rests on.',
  method: {
    automated: `${live.fetch_ok} of ${live.row_count} official product pages were retrieved and parsed by scripts/live_reverify.mjs on a GitHub Actions runner (full internet access).`,
    manual: `${manual.reads.length} rows were read by hand where the automated runner was blocked, or where the full variant set mattered.`,
    not_read: rows.filter((r) => r.price_verdict === 'not_read').length,
  variant_price_not_reproducible: rows.filter((r) => r.price_verdict === 'variant_price_not_reproducible').length,
    gold_price: live.gold_price_readings.map((g) => ({
      publisher: g.publisher,
      price_usd_per_ozt: g.price_usd_per_ozt,
      publisher_timestamp: g.publisher_timestamp,
      http_status: g.http_status,
    })),
  },
  summary,
  corrections: correctionsApplied.map((c) => ({
    id: c.id,
    field: c.field,
    from: c.from,
    to: c.to,
    quote: c.quote,
    url: c.url,
    why: c.why,
  })),
  rows,
};

await writeFile(join(ROOT, 'data/rings.json'), JSON.stringify(ringsDoc, null, 1));
await writeFile(join(ROOT, 'data/gold-price.json'), JSON.stringify(gold, null, 1));
await writeFile(join(ROOT, `data/verification-${PASS_DATE}.json`), JSON.stringify(ledger, null, 1));

console.log(`P42 reconciliation written: data/verification-${PASS_DATE}.json`);
console.log('  verdicts:', JSON.stringify(summary));
console.log('  corrections applied:', correctionsApplied.map((c) => `${c.id} ${c.from}->${c.to}`).join(', ') || 'none');
console.log('  gold spot:', gold.primary.price_usd_per_ozt, 'USD/ozt at', gold.primary.publisher_timestamp);
