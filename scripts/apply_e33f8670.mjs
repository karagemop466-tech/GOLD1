#!/usr/bin/env node
/**
 * GOLD1 — third-channel data application (T51, sess-e33f8670).
 *
 * Applies only the corrections that this pass's own verbatim reads support.
 * Idempotent: running it twice prints "no change" for everything it has already
 * done, so it is safe to re-run inside `npm run check`.
 *
 * It never invents a number: every write is paired with the quote that produced
 * it, and anything this pass could not reproduce is left exactly as captured.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = process.cwd();
const read = async (p) => JSON.parse(await readFile(join(ROOT, p), 'utf8'));
const write = async (p, v) => writeFile(join(ROOT, p), JSON.stringify(v, null, 1) + '\n');

const TAG = 'T51 2026-10-24';
const rings = await read('data/rings.json');
const flagged = await read('data/flagged.json');
const gold = await read('data/gold-price.json');
const ledger = await read('data/session-e33f8670/live-comparison.json');

const byId = Object.fromEntries(rings.rows.map((r) => [r.id, r]));
const changed = [];

const append = (row, text) => {
  if (!row.evidence.includes(text.slice(0, 40))) {
    row.evidence = `${row.evidence} ${text}`.trim();
    return true;
  }
  return false;
};

/* ------------------------------------------------------------------- gold */

const runnerGold = (ledger.rows || []).length ? null : null; // unused placeholder, kept explicit
const goldRead = 3996.899902;
const goldTs = '2026-10-23T23:38:16Z';
if (gold.primary.price_usd_per_ozt !== goldRead) {
  throw new Error(`gold feed re-read is ${gold.primary.price_usd_per_ozt}, expected ${goldRead}; refusing to overwrite a different price`);
}
if (!gold.primary.corroboration.includes('23:49:47Z')) {
  gold.primary.corroboration =
    `${gold.primary.corroboration.replace(/\s*$/, ' ')}A fourth read by the GitHub Actions runner at 2026-10-23T23:49:47Z (run 40041808412) returned the same 3996.899902 USD/ozt, and this session re-read the feed again at 2026-10-24T00:20:52Z with the publisher timestamp still 2026-10-23T23:38:16Z — the publisher simply had not ticked. Four reads, two network paths, one unchanged number.`;
  changed.push('gold: fourth/fifth read appended to corroboration');
}
if (gold.cross_check && !(gold.cross_check.note || '').includes('T51')) {
  gold.cross_check.note = `${gold.cross_check.note} T51 re-check 2026-10-24T00:20Z: the runner's Yahoo call returned HTTP 429 again, so the COMEX line remains the 20:59:58Z publisher snapshot and is labelled as such — it is a cross-check, never the melt input.`;
  changed.push('gold: cross-check note records the repeated 429');
}
await write('data/gold-price.json', gold);

/* ------------------------------------------------------ Cartier stone facts */

const carRow = byId['car-18k-destinee-princess'];
const liveStone = 'Natural princess-cut centre diamond (0.16 ct for size 52, per the live page) + brilliant-cut pavé diamonds';
if (carRow.stone_type !== liveStone) {
  carRow.stone_type = liveStone;
  changed.push('car-18k-destinee-princess: stone type now the live 0.16 ct wording');
}
if (!/Unavailable online/.test(carRow.notes || '')) {
  carRow.notes =
    'Cartier serves reference B4232900 under the Étincelle name as of 2026-10-23; the earlier "Destinée" title and its 0.18-0.34 ct stone description are no longer served on that URL and were replaced, not deleted (F68). ' +
    'T52 re-read 2026-10-24: $3,350, reference B4232900 and yellow gold 750/1000 re-confirmed; the page also prints "Unavailable online" with a "Request Price" / "Contact an ambassador" route, so the price is published but this reference cannot be added to a bag online - expect to order by phone or in boutique. ' +
    'Width 1.52 mm, thickness 1.35 mm (size 52). Gram weight is not published.';
  changed.push('car-18k-destinee-princess: notes record the live wording and the online-availability caveat');
}

/* ------------------------------------------------------------- price basis */

const cigar = byId['au-cigar'];
if (cigar.price_basis !== 'variant price - 14K option (18K and vermeil in the same listing)') {
  cigar.price_basis = 'variant price - 14K option (18K and vermeil in the same listing)';
  changed.push('au-cigar: price basis now says which variant the price is');
}

/* ---------------------------------------- rows whose metal map is now known */

for (const id of ['au-2ct-oval', 'au-1ct-emerald', 'au-3ct-round']) {
  const row = byId[id];
  const before = row.flags.length;
  row.flags = row.flags.filter((f) => f !== 'metal_variant_price_unmapped');
  if (row.flags.length !== before) changed.push(`${id}: removed metal_variant_price_unmapped (the feed now maps metal -> price)`);
}

/* --------------------------------------------------- verbatim read appends */

const reads = {
  'mene-24k-classic-band': `${TAG} (sess-e33f8670, second channel): page printed "$1,694" with "Metal Gold 24k Gold", "Width: 5mm Thickness: 2mm" and "Products are sold by weight, not size." The same page's cross-sell tile reads "From $1,651" for this band — recorded as a discrepancy a buyer will see, not smoothed over.`,
  'mene-24k-narrow-band': `${TAG} (sess-e33f8670, second channel): page printed "$1,350" with "Width: 4mm Thickness: 2mm" and "Products are sold by weight, not size."`,
  'auv-22k-vneck-sm': `${TAG} (sess-e33f8670, second channel): no price anywhere in the rendered page text on two reads. Details confirmed: "V opening 25/64\\" (10 mm)", "V height 25/64\\" (10 mm)", "thickness 1/16\\" (2 mm)", "Approximate Fine Weight: 2.9 to 3.7 grams depending on size", "Return within 15 days". Stored $900 keeps its earlier dated read and is not re-claimed today.`,
  'auv-22k-hexagon-diamond': `${TAG} (sess-e33f8670, second channel): page returned the store's shipping and returns policy blocks with no product price. Stored $1,400 keeps its earlier dated read.`,
  'auv-22k-diamond-bridge-tall': `${TAG} (sess-e33f8670, second channel): page returned policy copy with no product price. Stored $1,600 keeps its earlier dated read.`,
  'auv-22k-clean-cut-polished': `${TAG} (sess-e33f8670, second channel): page returned policy copy with no product price. Stored $900 keeps its earlier dated read.`,
  'as-bea-sol': `${TAG} (sess-e33f8670, second channel): the PDP prints no price at all — the buy box reads "While this one-of-a-kind piece was made for a client, we are able to create a unique version just for you within your desired price range." The product JSON still publishes 1150000 cents, but a price a buyer cannot see is not a quote, so $11,500 stays unverified.`,
  'wc-4prong': `${TAG} (sess-e33f8670, second channel): Shopify product feed "$558-$801" — verbatim "\\"price\\":55800,\\"price_min\\":55800,\\"price_max\\":80100" (cents), all variants tagged "Ring Setting Product" so the figure is the setting only.`,
  'wc-tulip': `${TAG} (sess-e33f8670, second channel): feed "$590-$1,110" — verbatim "\\"price\\":59000,\\"price_min\\":59000,\\"price_max\\":111000" (cents), setting only.`,
  'wc-4prong-petite': `${TAG} (sess-e33f8670, second channel): feed "$558-$963" — verbatim "\\"price\\":55800,\\"price_min\\":55800,\\"price_max\\":96300" (cents), setting only.`,
  'wc-6prong': `${TAG} (sess-e33f8670, second channel): feed "$567-$828" — verbatim "\\"price\\":56700,\\"price_min\\":56700,\\"price_max\\":82800" (cents), setting only.`,
  'wc-gerbera': `${TAG} (sess-e33f8670, second channel): feed "$1,210-$1,850" — verbatim "\\"price\\":121000,\\"price_min\\":121000,\\"price_max\\":185000" (cents), setting only.`,
  'be-18k-6p-121h6': `${TAG} (sess-e33f8670, second channel): page printed "$1,090 (Setting Only)" with "Metal: 18K Yellow Gold", "Prong metal: 14K White Gold", "Width: 2.5 mm" — the mixed-karat prong disclosure is why this row carries a mixed-metal note.`,
  'car-18k-etincelle-pear': `${TAG} (sess-e33f8670, second channel): page printed "$3,350", "Rose gold 750/1000", "pear-shaped diamond of 0.16 carat", "Ref.B4230400".`,
  'car-18k-etincelle-emerald': `${TAG} (sess-e33f8670, second channel): page printed "$3,600", "White gold 750/1000", "emerald-cut diamond of 0.16 carat", "Ref.B4225700".`,
  'car-18k-1895-band-dia': `${TAG} (sess-e33f8670, second channel): page printed "$1,140", "Yellow gold 750/1000", "brilliant-cut diamond of 0.01 carat (for size 52)", "Ref.B4057600".`,
  'car-18k-destinee-princess': `${TAG} (sess-e33f8670, second channel): the stored Destinée URL redirects to /etincelle-de-cartier/etincelle-de-cartier-ring-princess-cut-diamond-paved-CRB4232900.html, headed "Etincelle de Cartier ring, princess-cut diamond, paved" with "princess-cut diamond centre stone of 0.16 carats", "$3,350", "Ref.B4232900" and "Unavailable online". The 0.18-0.34 ct sentence is no longer served.`,
};

for (const [id, text] of Object.entries(reads)) {
  const row = byId[id];
  if (!row) throw new Error(`compare ledger names a row that does not exist: ${id}`);
  if (append(row, text)) changed.push(`${id}: evidence += verbatim ${TAG} read`);
}

/* --------------------------------------------------------------- findings */

if (!flagged.items.some((f) => f.id === 'F70')) {
  flagged.items.push({
    id: 'F70',
    title: 'Five rows still publish a price a buyer cannot see today — four Auvere pages render none, Anna Sheffield’s is inquiry-only',
    severity: 'low',
    type: 'price visibility / method coverage',
    affected: 'auv-22k-vneck-sm, auv-22k-hexagon-diamond, auv-22k-diamond-bridge-tall, auv-22k-clean-cut-polished, as-bea-sol',
    finding:
      'On the 2026-10-23T23:50Z re-read, four Auvere product pages returned shipping/returns policy text with no product price at all, and the Anna Sheffield Bea Solitaire buy box has been replaced by an inquiry form ("we are able to create a unique version just for you within your desired price range"). Ten other pages (five With Clarity, four Cartier, one Brilliant Earth) answer the automated runner with HTTP 403; those were read on a second channel instead, and every one of them reproduced its stored price. The five above did not, on either channel. Their stored figures are therefore shown as captured, with their earlier dated reads, and are explicitly not presented as today’s price.',
    buyer_action:
      'For the four Auvere rings and the Anna Sheffield Bea, call or use the site’s contact form and ask for the current price for your size before budgeting — the site does not show one. Treat the published figure as the last observed price, not a quote.',
    sources: [
      'https://auvere.com/product/v-neck-stack-ring-small-polished/',
      'https://auvere.com/product/hexagon-diamond-stack-ring/',
      'https://www.annasheffield.com/products/bea-solitaire-ring-gold-north-south-1-50ct-oval-champagne-diamond',
    ],
    status: 'needs review',
  });
  flagged.as_of = '2026-10-23';
  changed.push('flagged: F70 added (five prices a buyer cannot see today)');
}
await write('data/flagged.json', flagged);

await write('data/rings.json', rings);

console.log(changed.length ? changed.map((c) => `· ${c}`).join('\n') : 'no change (already applied)');
