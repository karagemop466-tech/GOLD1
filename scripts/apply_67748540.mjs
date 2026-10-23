#!/usr/bin/env node
/**
 * GOLD1 — eleventh-pass data application (sess-67748540), 2026-10-23 night.
 *
 * Folds the *observed* results of this pass into the curated dataset. It never
 * invents a value: every edit is either
 *   (a) a verbatim quote from the fresh read (runner evidence or the hand-read
 *       ledger), appended to the row's `evidence`, or
 *   (b) a re-stamp of `reverified_at` / `reverified_pass` for rows whose stored
 *       value was reproduced today, or
 *   (c) a new/updated finding that carries its own source links.
 *
 * Rows whose price could NOT be reproduced keep their old stamp.
 *
 * Run: node scripts/apply_67748540.mjs
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = process.cwd();
const PASS = 'P116-67748540';
const DAY = '2026-10-23';
const read = async (p) => JSON.parse(await readFile(join(ROOT, p), 'utf8'));
const write = async (p, d) => writeFile(join(ROOT, p), JSON.stringify(d, null, 1) + '\n');

const rings = await read('data/rings.json');
const flagged = await read('data/flagged.json');
const gold = await read('data/gold-price.json');
const ledger = await read('data/live/latest.json');
const cmp = await read('data/session-67748540/reconcile-67748540.json');
const hand = await read('data/session-67748540/hand-reads-2026-10-23.json');
const handById = new Map(hand.reads.map((r) => [r.id, r]));
const liveById = new Map(ledger.rows.map((r) => [r.id, r]));

const STAMP = '2026-10-23T23:39Z';
const OK = new Set([
  'stored_price_reproduced',
  'stored_range_reproduced_seller_feed',
  'stored_variant_price_reproduced_seller_feed',
  'hand_read_resolved',
]);

let stamped = 0;
let quoted = 0;

for (const row of rings.rows) {
  const verdict = cmp.rows.find((r) => r.id === row.id);
  if (!verdict || !OK.has(verdict.verdict)) continue;

  const live = liveById.get(row.id);
  const h = handById.get(row.id);
  const bits = [];

  if (h) {
    const v = h.observed;
    const priceText =
      v.price_usd != null
        ? `$${v.price_usd.toLocaleString('en-US')}`
        : `$${v.price_min_usd.toLocaleString('en-US')}–$${v.price_max_usd.toLocaleString('en-US')}`;
    bits.push(
      `Re-read ${h.observed_at_approx} (${PASS}, second channel): printed ${priceText}` +
        (h.redirected ? ` — the stored URL now redirects to ${h.final_url}` : '') +
        ` — verbatim "${(h.verbatim ?? '').replace(/\s+/g, ' ').slice(0, 240)}"`
    );
  } else if (live?.ok) {
    const feed = live.variant_feed;
    if (verdict.verdict === 'stored_range_reproduced_seller_feed' || verdict.verdict === 'stored_variant_price_reproduced_seller_feed') {
      const groups = new Map();
      for (const v of feed?.variants ?? []) {
        const key = (v.title ?? '').split('/')[0].trim();
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(v.price);
      }
      const map = [...groups.entries()]
        .map(([k, arr]) => `${k} $${Math.min(...arr).toLocaleString('en-US')}${Math.max(...arr) !== Math.min(...arr) ? `–$${Math.max(...arr).toLocaleString('en-US')}` : ''}`)
        .join(' · ');
      bits.push(
        verdict.verdict === 'stored_range_reproduced_seller_feed'
          ? `Re-read ${STAMP} (${PASS}, seller variant feed): price_min ${feed.price_min}, price_max ${feed.price_max} — range reproduced unchanged; metal-level map: ${map}`
          : `Re-read ${STAMP} (${PASS}, seller variant feed): the stored single price ${row.price_low} matches variant "${verdict.feed_variant_match?.[0]?.title}" exactly; the product-level min/max (${feed.price_min}–${feed.price_max}) spans vermeil to 18K`
      );
    } else {
      // Only quote the dollar strings that ARE the stored price. Product pages
      // also print promo/menu/gift-wrap amounts ("Under $500", "$5.95 gift
      // wrap"); listing those as observed prices would misrepresent the page.
      const want = new Set([row.price_low, row.price_high]);
      const matches = [];
      const push = (value, excerpt) => {
        if (want.has(value) && !matches.some((m) => m.value === value)) matches.push({ value, excerpt });
      };
      for (const m of live.extraction?.prices ?? []) {
        const n = Number(String(m.match).replace(/[^0-9.]/g, ''));
        push(n, m.excerpt);
      }
      for (const o of live.extraction?.jsonld_offers ?? []) {
        for (const p of o.prices ?? []) {
          if (p.currency === 'USD') push(Number(p.value), `JSON-LD offer "${o.name ?? ''}" price ${Number(p.value)} USD`);
        }
      }
      if (matches.length === 0) continue;
      const values = matches.map((m) => `$${m.value.toLocaleString('en-US')}`).join(' / ');
      const quote = matches[0].excerpt.replace(/\s+/g, ' ').slice(0, 200);
      bits.push(
        `Re-read ${STAMP} (${PASS}, official page, HTTP ${live.http_status}): printed ${values} — stored value reproduced unchanged; verbatim "${quote}".`
      );
    }
  }

  if (bits.length === 0) continue;
  row.evidence = `${row.evidence} ${bits.join(' ')}`;
  row.reverified_at = DAY;
  row.reverified_pass = PASS;
  row.verified_at = DAY;
  stamped += 1;
  quoted += 1;
}

// Aurate: record the metal -> price map that the 23:39Z feed actually printed.
for (const id of ['au-1ct-emerald', 'au-2ct-oval', 'au-3ct-round']) {
  const row = rings.rows.find((r) => r.id === id);
  if (!row) continue;
  row.notes = `${row.notes} 2026-10-23T23:39Z (${PASS}): the seller's own variant feed now maps every metal to a price for this SKU (14k and 18k yellow/white, plus platinum), so the stored range is confirmed to be a cross-metal range and the high end is platinum, not 14K.`;
}

// Cartier Destinée -> Etincelle rename, price unchanged.
{
  const row = rings.rows.find((r) => r.id === 'car-18k-destinee-princess');
  if (row) {
    row.notes = `${row.notes} 2026-10-23T23:48Z (${PASS}): the seller now serves reference B4232900 under the "Etincelle de Cartier" collection — the stored Destinée URL redirects and the page no longer prints "Destinée". Price reproduced unchanged at $3,350; published as F67 rather than silently retitled.`;
  }
}

await write('data/rings.json', rings);

// ---- gold price ----------------------------------------------------------
const runnerGold = ledger.gold_price_readings.find((g) => g.publisher === 'gold-api.com');
const handGold = hand.gold_price.find((g) => g.publisher === 'gold-api.com');
const comex = hand.gold_price.find((g) => /Yahoo/.test(g.publisher));

gold.primary = {
  label: gold.primary.label,
  price_usd_per_ozt: runnerGold.price_usd_per_ozt,
  publisher: 'gold-api.com',
  publisher_timestamp: runnerGold.publisher_timestamp,
  source_url: 'https://api.gold-api.com/price/XAU',
  observed_by: 'sess-67748540',
  observed_at: runnerGold.fetched_at,
  corroboration:
    `Independently re-read through this session's second channel at ${handGold.observed_at} — identical value ${handGold.price_usd_per_ozt} USD/ozt, publisher timestamp ${handGold.publisher_timestamp}.`,
  raw_excerpt: runnerGold.raw_excerpt,
};

gold.cross_check = {
  ...gold.cross_check,
  price_usd_per_ozt: comex.price_usd_per_ozt,
  publisher_timestamp: comex.publisher_timestamp,
  note:
    `${(gold.cross_check.note ?? '').split(' Refreshed')[0]} Refreshed 2026-10-23T23:40Z (sess-67748540) through the second channel, because the runner's own Yahoo call returned HTTP 429 at 23:39Z: regularMarketPrice ${comex.price_usd_per_ozt} USD/ozt, regularMarketTime epoch 1792789198 (= ${comex.publisher_timestamp}); chartPreviousClose 4,160.1.`,
};

const readings = Array.isArray(gold.readings) ? gold.readings : [];
readings.push({
  price_usd_per_ozt: runnerGold.price_usd_per_ozt,
  publisher_timestamp: runnerGold.publisher_timestamp,
  publisher: 'gold-api.com',
  observed_by: 'sess-67748540',
});
gold.readings = readings;
gold.as_of = runnerGold.publisher_timestamp;

await write('data/gold-price.json', gold);

// ---- findings ------------------------------------------------------------
const byId = new Map(flagged.items.map((i) => [i.id, i]));

const f60 = byId.get('F60');
if (f60) {
  f60.finding += ` Addendum (sess-67748540, P116): the same ten rows returned HTTP 403 to the 2026-10-23T23:39Z runner, and all ten were then read successfully through an independent channel in the 23:41–23:53Z window with no price change: wc-tulip $590–$1,110, wc-4prong $558–$801, wc-4prong-petite $558–$963, wc-6prong $567–$828, wc-gerbera $1,210–$1,850, be-18k-6p-121h6 $1,090 (setting only), car-18k-etincelle-pear $3,350, car-18k-etincelle-emerald $3,600, car-18k-1895-band-dia $1,140, car-18k-destinee-princess $3,350. The block is channel-specific, not a data defect.`;
}

const f13 = byId.get('F13');
if (f13) {
  f13.finding += ` Addendum (sess-67748540, P116, 2026-10-23T23:39Z): the seller's own variant feed does map every metal to a price for all three SKUs — 14k yellow/white is the low end (au-1ct-emerald $1,498; au-2ct-oval $1,968; au-3ct-round $2,438), 18k is $1,878 / $2,438 / $2,858, and the stored high end is the Platinum variant ($2,100 / $2,800 / $3,000). The flag stands because the HTML page still prints no per-metal price without scripting, and because a $2,800 high end is not a 14K price.`;
}

const f67 = {
  id: 'F67',
  title: 'Cartier reference B4232900 is now served as “Etincelle de Cartier”, not “Destinée” — stored URL redirects',
  severity: 'low',
  type: 'source identity (collection rename)',
  affected: 'car-18k-destinee-princess',
  finding:
    'On 2026-10-23T23:48Z the stored URL /jewelry/engagement-rings/cartier-destinee/cartier-destinee-ring-princess-cut-diamond-paved-CRB4232900.html redirected to /jewelry/engagement-rings/etincelle-de-cartier/etincelle-de-cartier-ring-princess-cut-diamond-paved-CRB4232900.html. The page title, H1 and product description now say “Etincelle de Cartier ring, princess-cut diamond, paved” and print “Yellow gold 750/1000”, “princess-cut diamond centre stone of 0.16 carats”, “$3,350” and “Ref.B4232900”. The reference number and the price are unchanged, so this is a seller-side collection rename rather than a repurposed listing (unlike F51/F65); the stored row title keeps the older seller naming for traceability.',
  buyer_action:
    'Order by reference B4232900 and confirm with Cartier that the piece you receive matches the current Etincelle page (18K yellow gold 750/1000, 0.16 ct princess centre, $3,350). Do not rely on the old “Destinée” wording.',
  sources: [
    'https://www.cartier.com/en-us/jewelry/engagement-rings/etincelle-de-cartier/etincelle-de-cartier-ring-princess-cut-diamond-paved-CRB4232900.html',
    'https://www.cartier.com/en-us/jewelry/engagement-rings/cartier-destinee/cartier-destinee-ring-princess-cut-diamond-paved-CRB4232900.html',
  ],
  status: 'needs review',
  found_by: 'sess-67748540',
};

if (!byId.has('F67')) flagged.items.push(f67);
flagged.as_of = DAY;
flagged.generated_at = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
await write('data/flagged.json', flagged);

console.log(`stamped ${stamped} rows, quoted ${quoted}; flags now ${flagged.items.length}`);
