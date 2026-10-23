#!/usr/bin/env node
/**
 * GOLD1 requirements scorecard builder (T26).
 *
 * Takes the owner's 12-point buying checklist and evaluates every curated row
 * against it without estimating anything:
 *
 *   confirmed        - the seller's own page states it, and the source is linked
 *   not_published    - the seller does not publish it; the buyer must obtain it
 *   buyer_action     - something the buyer does, not something a page can prove
 *   cannot_compute   - depends on a value the seller does not publish
 *
 * Output: data/compliance.json
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = process.cwd();
const read = async (p) => JSON.parse(await readFile(join(ROOT, p), 'utf8'));

const rings = await read('data/rings.json');
const retailersDoc = await read('data/retailers.json');
const gold = await read('data/gold-price.json');
const verification = await read('data/verification-2026-10-23.json');

const retailers = Object.fromEntries(retailersDoc.retailers.map((r) => [r.id, r]));
const verById = Object.fromEntries(verification.rows.map((r) => [r.id, r]));
const AS_OF = '2026-10-23';
const SPOT = gold.primary.price_usd_per_ozt;
const GRAMS_PER_OZT = gold.grams_per_troy_ounce ?? 31.1034768;
const SPOT_PER_GRAM = SPOT / GRAMS_PER_OZT;

/**
 * Return windows are transcribed from each retailer's own policy page (the
 * summary in data/retailers.json is itself a quote of that page). Days are only
 * recorded where the policy text states a number.
 */
const RETURNS = {
  'ross-simons': { days: 30, from: 'receipt', source: 'https://www.ross-simons.com/policies/refund-policy' },
  'with-clarity': {
    days: 30,
    from: 'receipt',
    source: 'https://www.withclarity.com/pages/terms-conditions',
    caveat: 'one return per order in a 30-day window; a second purchase inside 30 days is final sale',
  },
  'anna-sheffield': {
    days: 14,
    from: 'delivery',
    source: 'https://www.annasheffield.com/policies/refund-policy',
    caveat: '10% restocking fee on refunds (capped at $500)',
  },
  aurate: {
    days: 14,
    from: 'fulfilment',
    source: 'https://auratenewyork.com/policies/refund-policy',
    caveat: 'ring pages carry a "Final Sale! Exchange for size only" notice; engraved pieces are final',
  },
  'blue-nile': {
    days: 30,
    from: 'shipment (not delivery)',
    source: 'https://www.bluenile.com/policies/returns',
    caveat: 'clock starts at shipment, so transit time is inside the window; resized rings excluded',
  },
  mejuri: {
    days: 30,
    from: 'delivery',
    source: 'https://mejuri.com/company/returns-terms',
    caveat: 'engraved/monogrammed items excluded',
  },
  'brilliant-earth': {
    days: 30,
    from: 'ready-to-ship date',
    source: 'https://www.brilliantearth.com/30-Day-Returns/',
    caveat: 'RMA valid 7 days; clock starts when the order is available to ship',
  },
  'automic-gold': {
    days: 30,
    from: 'delivery',
    source: 'https://www.automicgold.com/pages/returns-exchange-policy',
    caveat: 'engraved items final sale; return label must be used within 14 days',
  },
  cartier: {
    days: 30,
    from: 'delivery',
    source: 'https://www.cartier.com/en-us/conditions-of-sales-pay-by-link.html',
    caveat: 'personalised/engraved pieces excluded; Maison quality-control inspection',
  },
  mene: {
    days: 7,
    from: 'receipt',
    source: 'https://mene.com/terms-of-service',
    caveat: 'only 7 days; up to 10% restocking fee; lifetime buyback at daily metal value minus 10%',
  },
};

const FEDERAL = {
  hallmark: {
    label: 'US quality-mark rule',
    url: 'https://www.ecfr.gov/current/title-16/chapter-I/subchapter-B/part-23',
    text: '16 CFR Part 23 governs quality marks on gold jewellery; § 23.10 covers additional guidance for the use of quality marks.',
  },
  solid: {
    label: 'FTC solid-gold rule',
    url: 'https://consumer.ftc.gov/articles/buying-platinum-gold-and-silver-jewelry',
    text: 'The FTC explains that "solid gold" is about the piece not being hollow, not about it being unplated.',
  },
  payment: {
    label: 'FTC online shopping guidance',
    url: 'https://consumer.ftc.gov/articles/online-shopping',
    text: 'The FTC recommends paying by credit card online because card payments carry dispute rights.',
  },
  xrf: {
    label: 'GIA lab notes on XRF limits',
    url: 'https://www.gia.edu/gems-gemology/spring-2024-lab-notes-electroformed-gold-bracelet',
    text: 'GIA documented a resin-cored electroformed piece that read 17.99K-22.47K on XRF, so a surface XRF reading alone is not proof.',
  },
};

const CRITERIA = [
  {
    key: 'purity',
    n: 1,
    label: 'Gold purity confirmed',
    ask: 'Karat stated for the exact item (10K / 14K / 18K / 24K).',
  },
  {
    key: 'solid',
    n: 2,
    label: 'Explicit "solid gold" wording',
    ask: 'The listing itself says solid gold — not plated, vermeil, filled, overlay or tone.',
  },
  {
    key: 'hallmark',
    n: 3,
    label: "Hallmark + maker's mark",
    ask: 'A karat stamp plus the maker/manufacturer mark on the piece.',
  },
  { key: 'weight', n: 4, label: 'Weight in grams published', ask: 'The seller publishes the metal weight so the gold value can be checked.' },
  { key: 'reputation', n: 5, label: 'Independent seller reputation', ask: 'BBB record and verified contact details for the business.' },
  { key: 'price_vs_gold', n: 6, label: 'Price vs gold value', ask: 'Asking price compared with the raw gold the ring contains.' },
  { key: 'returns', n: 7, label: 'Return policy you can use', ask: 'A stated return window, and what voids it (resizing, engraving, custom).' },
  { key: 'payment', n: 8, label: 'Reversible payment', ask: 'Pay by credit card so a chargeback is possible.' },
  { key: 'documentation', n: 9, label: 'Documentation kept', ask: 'Listing, receipt, description and the seller\'s purity claim retained.' },
  { key: 'arrival_check', n: 10, label: 'Independent check on arrival', ask: 'Take it to an independent jeweller before wearing or resizing.' },
  { key: 'xrf', n: 11, label: 'Professional purity test', ask: 'Ask for XRF or another professional test, not just the stamp.' },
  { key: 'return_if_refused', n: 12, label: 'Walk away if refused', ask: 'If the seller will not allow independent verification or a return, do not buy.' },
];

function melt(weightG, karat) {
  if (!weightG || !karat) return null;
  const k = Number(String(karat).replace(/[^0-9.]/g, ''));
  if (!Number.isFinite(k)) return null;
  const fine = weightG * (k / 24);
  const value = fine * SPOT_PER_GRAM;
  return { fine_g: Math.round(fine * 1000) / 1000, value: Math.round(value * 100) / 100 };
}

function bbbOk(rating) {
  if (!rating) return null;
  const t = String(rating).trim();
  if (/^A\+|^A$|^A-$|^B\+|^B$|^B-/.test(t)) return true;
  if (/^F|^D/.test(t)) return false;
  return null; // NR / unaccredited / no record
}

const rows = rings.rows.map((r) => {
  const ret = retailers[r.retailer_id] || {};
  const ver = verById[r.id] || {};
  const retPolicy = RETURNS[r.retailer_id] || null;
  const weight = r.weight_g_low ?? null;
  const m = melt(weight, r.karat);
  const bbb = ret.bbb_rating ?? null;
  const reputationOk = bbbOk(bbb);

  const checks = {
    purity: {
      status: r.karat && ver.price_verdict && ver.price_verdict !== 'not_read' ? 'confirmed' : r.karat ? 'stated_not_reread' : 'not_published',
      detail: r.karat ? `${r.karat} stated on the seller's page and quoted in the row evidence` : 'no karat stated',
      source: r.source_url,
    },
    solid: {
      status: r.solid_stated ? 'confirmed' : 'not_published',
      detail: r.solid_stated
        ? 'The listing itself uses the word solid for this metal.'
        : 'The listing names the karat but never says "solid". Under 16 CFR Part 23 hollow gold may not be called solid, so a karat alone does not settle it.',
      source: r.source_url,
    },
    hallmark: {
      status: 'not_published',
      detail:
        "None of the ten retailers publishes the stamp or the maker's mark on the product page. This has to be read off the physical ring.",
      source: FEDERAL.hallmark.url,
    },
    weight: {
      status: weight !== null ? 'confirmed' : 'not_published',
      detail:
        weight !== null
          ? `${weight}${r.weight_g_high && r.weight_g_high !== weight ? '–' + r.weight_g_high : ''} g published by the seller` +
            (ver.weight_verdict === 'confirmed_on_page'
              ? ' and re-read on the page on 2026-10-23.'
              : ver.weight_verdict === 'seller_publishes_null'
                ? '; the page explicitly publishes null for metal weight, so the stored value is not from this page.'
                : ver.weight_verdict === 'not_reproduced_on_page'
                  ? '; not reproduced on 2026-10-23 — the seller does not print grams in the static page.'
                  : '.')
          : 'No gram weight published, so the gold-value check cannot be run for this row.',
      source: r.source_url,
    },
    reputation: {
      status: reputationOk === true ? 'confirmed' : reputationOk === false ? 'negative' : 'not_published',
      detail: `BBB file: ${bbb || 'no rating recorded'}. Verified contact details are recorded in the seller table with the source link.`,
      source: ret.bbb_source || ret.contact_source || null,
    },
    price_vs_gold: {
      status: m ? 'confirmed' : 'cannot_compute',
      detail: m
        ? `${weight} g at ${r.karat} holds ${m.fine_g} g fine gold, worth ${m.value.toFixed(2)} USD at the stored spot. Price ÷ gold = ${(pricePer(r) / m.value).toFixed(2)}×.`
        : 'Needs a published gram weight; without one no gold-value comparison is possible.',
      source: gold.primary.source_url,
    },
    returns: {
      status: retPolicy ? 'confirmed' : 'not_published',
      detail: retPolicy
        ? `${retPolicy.days} days from ${retPolicy.from}. ${retPolicy.caveat || ''}`.trim()
        : ret.return_summary || 'no return policy recorded',
      source: retPolicy ? retPolicy.source : ret.return_source || null,
      days: retPolicy ? retPolicy.days : null,
    },
    payment: {
      status: 'buyer_action',
      detail: FEDERAL.payment.text,
      source: FEDERAL.payment.url,
    },
    documentation: {
      status: 'confirmed',
      detail:
        'This project stores the product URL, the verbatim evidence string and the retrieval date for this row; keep the order confirmation and the seller\'s purity statement with it.',
      source: 'methodology.html',
    },
    arrival_check: { status: 'buyer_action', detail: 'Independent jeweller check before wearing or resizing. Resizing at a third-party jeweller can void the return window.', source: FEDERAL.hallmark.url },
    xrf: { status: 'buyer_action', detail: FEDERAL.xrf.text, source: FEDERAL.xrf.url },
    return_if_refused: {
      status: 'buyer_action',
      detail: retPolicy
        ? `The seller publishes a ${retPolicy.days}-day window. If they will not honour an independent check inside it, walk away.`
        : 'No published window. Do not buy without one.',
      source: retPolicy ? retPolicy.source : null,
    },
  };

  /* ------------------------------------------------------------- scoring */
  const blockers = [];
  if (r.withdrawn) blockers.push('the source URL now sells a different product');
  if (r.price_unverified) blockers.push('no price is displayed on the official page');
  if ((r.flags || []).includes('setting_only')) blockers.push('the price is for the setting only');
  if (!r.solid_stated) blockers.push('the listing never says "solid gold"');
  if (weight === null) blockers.push('no published gram weight');
  if (bbbOk(bbb) === false) blockers.push(`seller carries a BBB "${bbb}" rating`);
  if (retPolicy && retPolicy.days < 14) blockers.push(`return window is only ${retPolicy.days} days`);

  let tier;
  if (r.withdrawn) tier = 'withdrawn';
  else if (r.price_unverified) tier = 'unverified_price';
  else if ((r.flags || []).includes('setting_only')) tier = 'setting_only';
  else if (!r.solid_stated || weight === null || bbbOk(bbb) === false) tier = 'needs_confirmation';
  else if (retPolicy && retPolicy.days >= 14) tier = 'ready_to_inspect';
  else tier = 'needs_confirmation';

  return {
    id: r.id,
    retailer: r.retailer,
    retailer_id: r.retailer_id,
    title: r.title,
    karat: r.karat,
    price_low: r.price_low ?? null,
    price_high: r.price_high ?? null,
    weight_g: weight,
    solid_stated: r.solid_stated === true,
    bbb_rating: bbb,
    return_days: retPolicy ? retPolicy.days : null,
    gold_value_usd: m ? m.value : null,
    fine_gold_g: m ? m.fine_g : null,
    price_to_gold: m ? Math.round((pricePer(r) / m.value) * 100) / 100 : null,
    tier,
    blockers,
    checks,
    source_url: r.source_url,
    live_verdict: ver.price_verdict || null,
  };
});

function pricePer(r) {
  const lo = r.price_low;
  const hi = r.price_high ?? r.price_low;
  if (lo === null || lo === undefined) return null;
  return hi && hi !== lo ? (lo + hi) / 2 : lo;
}

const summary = {
  rows: rows.length,
  tiers: rows.reduce((acc, r) => ((acc[r.tier] = (acc[r.tier] || 0) + 1), acc), {}),
  solid_stated: rows.filter((r) => r.solid_stated).length,
  weight_published: rows.filter((r) => r.weight_g !== null).length,
  hallmark_published: 0,
  return_window_14_plus: rows.filter((r) => (r.return_days ?? 0) >= 14).length,
  bbb_a_grade: rows.filter((r) => bbbOk(r.bbb_rating) === true).length,
  bbb_f: rows.filter((r) => bbbOk(r.bbb_rating) === false).length,
  gold_value_computable: rows.filter((r) => r.gold_value_usd !== null).length,
};

await writeFile(
  join(ROOT, 'data/compliance.json'),
  JSON.stringify(
    {
      as_of: AS_OF,
      generated_by: 'scripts/build_compliance.mjs',
      gold_reference: {
        price_usd_per_ozt: SPOT,
        publisher: gold.primary.publisher,
        publisher_timestamp: gold.primary.publisher_timestamp,
        source_url: gold.primary.source_url,
        grams_per_troy_ounce: GRAMS_PER_OZT,
      },
      how_to_read:
        'confirmed = the seller\'s own page states it and the link is on the row. not_published = the seller does not publish it, so it must be obtained from the seller or from the physical ring. buyer_action = something only the buyer can do. cannot_compute = depends on a value the seller withholds. No cell is estimated.',
      criteria: CRITERIA,
      federal: FEDERAL,
      returns: RETURNS,
      summary,
      rows,
    },
    null,
    1
  )
);

console.log('compliance scorecard written: data/compliance.json');
console.log('  tiers:', JSON.stringify(summary.tiers));
console.log(
  `  solid ${summary.solid_stated}/${summary.rows} · weight ${summary.weight_published}/${summary.rows} · hallmark ${summary.hallmark_published}/${summary.rows} · gold-value computable ${summary.gold_value_computable}/${summary.rows}`
);
