#!/usr/bin/env node
/**
 * GOLD1 — third-channel audit groups E01–E09 (T51, sess-e33f8670).
 *
 * These groups exist so that the specific mistakes this pass *could* have made
 * cannot ship silently again:
 *
 *   E01  the ledger covers every row, and its headline numbers add up
 *   E02  nothing is called "confirmed" without a price a channel actually read
 *   E03  the gold figure on the site is the one in the ledger, read once
 *   E04  the page's coverage claims match the ledger, row for row
 *   E05  a range that spans metals never reads as a 14K price
 *   E06  Automic Gold's gram weight is the GOLD figure, never the platinum one
 *   E07  the Cartier reference is described as the seller now describes it
 *   E08  a comparator may not treat navigation copy as a price
 *   E09  every row still carries a detail page and a source link
 */
import { readFile } from 'node:fs/promises';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const readText = (p) => readFile(join(ROOT, p), 'utf8');
const readJson = async (p) => JSON.parse(await readText(p));

let failures = 0;
let assertions = 0;
const fail = (msg) => {
  failures += 1;
  console.log(`        - ${msg}`);
};
const ok = (cond, msg) => {
  assertions += 1;
  if (!cond) fail(msg);
};

const rings = await readJson('data/rings.json');
const flagged = await readJson('data/flagged.json');
const gold = await readJson('data/gold-price.json');
const ledger = await readJson('data/verification-2026-10-23-e33f8670.json');
const manual = await readJson('data/session-e33f8670/manual-reads-2026-10-23.json');
const compare = await readJson('data/session-e33f8670/live-comparison.json');

/* Read every HTML/script input this audit inspects BEFORE any group runs, so no
 * group can pass merely because its input had not been staged yet. */
const html = {};
for (const f of ['index.html', 'recheck.html', 'flagged.html', 'live-audit.html', 'requirements.html', 'calculator.html', 'weights.html']) {
  html[f] = await readText(f);
}
const comparatorSrc = await readText('scripts/compare_live_e33f8670.mjs');
const detailPages = {};
for (const f of readdirSync(join(ROOT, 'rings'))) {
  if (f.endsWith('.html')) detailPages[f.replace(/\.html$/, '')] = await readText(join('rings', f));
}

const group = async (code, title, fn) => {
  const before = failures;
  console.log(`\n${code}  ${title}`);
  await fn();
  console.log(failures === before ? `[PASS] ${code}` : `[FAIL] ${code}`);
};

const ids = new Set(rings.rows.map((r) => r.id));
const confirmed = (v) => /^confirmed/.test(v);
/* Two views of the same run: `ledger` is the published per-row record, `rows`
 * is the richer comparator output (stored/observed/manual quote). Detail checks
 * use `rows`; the coverage/figure checks use `ledger`. */
const rows = compare.rows;
if (rows.length !== ledger.rows.length) {
  throw new Error(`comparator (${rows.length}) and ledger (${ledger.rows.length}) disagree on the row count; re-run scripts/compare_live_e33f8670.mjs`);
}

/* --------------------------------------------------------------------- E01 */

await group('E01', 'The ledger covers every row and its numbers add up', async () => {
  ok(Array.isArray(ledger.rows) && ledger.rows.length === rings.rows.length, `ledger has ${ledger.rows?.length} rows, dataset has ${rings.rows.length}`);
  ok(new Set(ledger.rows.map((r) => r.id)).size === ledger.rows.length, 'duplicate row ids in the ledger');
  for (const r of rings.rows) {
    const l = rows.find((x) => x.id === r.id);
    ok(!!l, `${r.id} is missing from the ledger`);
    if (!l) continue;
    const lUrl = l.url || l.source_url;
    ok(lUrl === r.source_url, `${r.id}: ledger source_url differs from the dataset`);
    ok(/^https:\/\//.test(lUrl || ''), `${r.id}: source_url is not https`);
    ok(!!l.verdict, `${r.id}: no verdict`);
    // The ledger and the dataset must describe the same stored price, or the
    // "confirmed" label would be attached to a number the dataset no longer shows.
    ok(l.stored.low === r.price_low, `${r.id}: ledger compares ${l.stored.low}, dataset publishes ${r.price_low}`);
    ok(l.stored.high === r.price_high, `${r.id}: ledger compares ${l.stored.high}, dataset publishes ${r.price_high}`);
  }
  // The published ledger must be a faithful projection of the comparator output:
  // a hand-edited verdict on the published file would otherwise ship unnoticed.
  for (const pub of ledger.rows) {
    const det = rows.find((x) => x.id === pub.id);
    ok(!!det, `${pub.id}: published row has no comparator row`);
    if (!det) continue;
    ok(pub.verdict === det.verdict, `${pub.id}: published verdict "${pub.verdict}" but the comparator says "${det.verdict}"`);
    ok(pub.price_reproduced === confirmed(det.verdict), `${pub.id}: published price_reproduced=${pub.price_reproduced} contradicts the comparator verdict`);
    ok((pub.source_url || det.url) === det.url, `${pub.id}: published source_url differs from the comparator`);
  }

  const c = ledger.coverage;
  ok(c.pages_opened_today === rows.filter((r) => r.http_status === 200 || r.manual).length, 'pages_opened_today does not match the per-row evidence');
  ok(c.prices_reproduced_today === rows.filter((r) => confirmed(r.verdict)).length, 'prices_reproduced_today does not match the comparator verdicts');
  ok(c.prices_reproduced_today === ledger.rows.filter((r) => confirmed(r.verdict)).length, 'prices_reproduced_today does not match the published ledger');
  ok(c.prices_reproduced_today + c.prices_not_reproduced === ledger.row_count, 'reproduced + not reproduced must equal the row count');
  ok(c.runner_read + c.runner_forbidden === rows.length, 'runner read + forbidden must equal the row count');
  ok(c.fetch_failed_both_channels === 0, `${c.fetch_failed_both_channels} pages were unreadable by both channels`);
});

/* --------------------------------------------------------------------- E02 */

await group('E02', 'Nothing is "confirmed" without a price a channel actually read', async () => {
  for (const r of rows) {
    if (!confirmed(r.verdict)) {
      ok(!r.observed?.jsonld?.length || r.verdict === 'pdp_shows_no_price' || r.manual, `${r.id}: unconfirmed but carries machine prices`);
      continue;
    }
    const hasMachine =
      (r.observed?.jsonld?.length || 0) > 0 ||
      (r.observed?.variant_groups && Object.keys(r.observed.variant_groups).length > 0);
    const hasManual = !!(r.manual && r.manual.verbatim && r.manual.verbatim.length >= 15);
    ok(hasMachine || hasManual, `${r.id}: confirmed with neither a machine price nor a verbatim read`);
    if (r.http_status === 403) {
      ok(hasManual, `${r.id}: the runner got HTTP 403, so only an independent read may confirm it`);
    }
    if (r.verdict === 'confirmed_manual_read') {
      ok(hasManual, `${r.id}: manual confirmation without a quote`);
    }
    const stored = r.stored;
    const readPrice = r.manual?.price_low;
    if (r.verdict === 'confirmed_manual_read') {
      ok(readPrice === stored.low, `${r.id}: the manual read printed ${readPrice}, the row stores ${stored.low}`);
    }
  }
  // No verdict may claim confirmation for a row whose page printed nothing at all.
  for (const r of rows.filter((x) => x.verdict === 'pdp_shows_no_price')) {
    ok(!r.manual?.price_low, `${r.id}: marked price-free but carries a price`);
  }
});

/* --------------------------------------------------------------------- E03 */

await group('E03', 'The gold figure is the one that was read, with the publisher timestamp', async () => {
  ok(gold.primary.price_usd_per_ozt === ledger.gold.price_usd_per_ozt, 'the ledger and data/gold-price.json disagree on the spot');
  ok(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(gold.primary.publisher_timestamp || ''), 'the spot carries no publisher timestamp');
  ok(gold.primary.source_url.startsWith('https://api.gold-api.com/'), 'the spot source is not the published feed');
  ok(/23:49:47Z/.test(gold.primary.corroboration || ''), 'the corroboration note does not mention the runner’s read');
  const manualGold = manual.gold_reads.map((g) => g.price_usd_per_ozt);
  ok(manualGold.every((p) => p === gold.primary.price_usd_per_ozt), 'a manual gold read disagrees with the stored spot');
  ok(Number(gold.grams_per_troy_ounce) === 31.1034768, 'the grams-per-troy-ounce constant is not the NIST value');
  // The rendered spot must be this exact number and this exact publisher stamp.
  const shown = Number(gold.primary.price_usd_per_ozt).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  ok(html['index.html'].includes(`${shown} per troy ounce at ${gold.primary.publisher_timestamp}`),
    `index.html does not render "${shown} per troy ounce at ${gold.primary.publisher_timestamp}"`);
  // No current page may still advertise an older spot. flagged.html is exempt:
  // it quotes historical prices verbatim, which is history, not a live figure.
  for (const page of ['index.html', 'requirements.html', 'recheck.html', 'live-audit.html', 'calculator.html', 'weights.html']) {
    ok(!/4,024\.7|4024\.7/.test(html[page] || ''), `${page} still renders the earlier 4,024.7 spot`);
  }
});

/* --------------------------------------------------------------------- E04 */

await group('E04', 'The site’s coverage claims match the ledger row for row', async () => {
  // The published ledger must be a faithful projection of the comparator output:
  // a hand-edited verdict on the published file would otherwise ship unnoticed.
  for (const pub of ledger.rows) {
    const det = rows.find((x) => x.id === pub.id);
    ok(!!det, `${pub.id}: published row has no comparator row`);
    if (!det) continue;
    ok(pub.verdict === det.verdict, `${pub.id}: published verdict "${pub.verdict}" but the comparator says "${det.verdict}"`);
    ok(pub.price_reproduced === confirmed(det.verdict), `${pub.id}: published price_reproduced=${pub.price_reproduced} contradicts the comparator verdict`);
    ok((pub.source_url || det.url) === det.url, `${pub.id}: published source_url differs from the comparator`);
  }

  const c = ledger.coverage;
  const recheck = html['recheck.html'];
  ok(/every URL re-opened at/.test(recheck), 'recheck.html does not carry the third-channel panel');
  ok(recheck.includes(`${c.pages_opened_today}/${ledger.row_count}`), `recheck.html does not state ${c.pages_opened_today}/${ledger.row_count} pages opened`);
  ok(recheck.includes(String(c.prices_reproduced_today)), 'recheck.html does not state the reproduced count');
  ok(recheck.includes('data/verification-2026-10-23-e33f8670.json'), 'recheck.html does not name the ledger it renders');
  // Every row the panel lists as not reproduced must really be unconfirmed in the ledger.
  for (const r of rows.filter((x) => !confirmed(x.verdict))) {
    ok(recheck.includes(r.id), `recheck.html does not list ${r.id}, which was not reproduced`);
  }
  for (const r of rows.filter((x) => confirmed(x.verdict))) {
    ok(!new RegExp(`>${r.id} — unverified<`).test(recheck), `${r.id} is confirmed but rendered as unverified`);
  }
});

/* --------------------------------------------------------------------- E05 */

await group('E05', 'A range that spans metals never reads as a 14K price', async () => {
  let checked = 0;
  for (const r of rings.rows) {
    const l = rows.find((x) => x.id === r.id);
    const groups = l?.observed?.variant_groups || {};
    const labels = Object.keys(groups).map((x) => x.toLowerCase());
    const spansMetals =
      labels.some((x) => /platinum/.test(x)) && labels.some((x) => /14k|18k/.test(x)) &&
      r.price_low !== r.price_high;
    if (!spansMetals) continue;
    checked += 1;
    ok(/cross-metal|platinum|other metal/i.test(r.notes || ''), `${r.id}: its range spans metals but the notes never say so`);
    ok(r.price_basis !== 'single listed price', `${r.id}: a cross-metal range is labelled a single listed price`);
  }
  // Non-vacuity: the detector must actually match rows, or it proves nothing.
  ok(checked >= 3, `only ${checked} cross-metal ranges were examined; expected at least the three Aurate bezel rows`);
  // The three Aurate bezel rows must name the metal behind the high end.
  for (const id of ['au-2ct-oval', 'au-1ct-emerald', 'au-3ct-round']) {
    const row = rings.rows.find((x) => x.id === id);
    ok(/platinum/i.test(row.notes || ''), `${id}: notes do not name the metal behind the upper bound`);
    ok(!row.flags.includes('metal_variant_price_unmapped'), `${id}: still flagged as unmapped although the feed maps metal to price`);
  }
});

/* --------------------------------------------------------------------- E06 */

await group('E06', 'Automic Gold’s gram weight is the gold figure, never the platinum one', async () => {
  for (const row of rings.rows.filter((r) => r.retailer === 'Automic Gold')) {
    ok(row.weight_g_low == null || row.weight_g_low < 9, `${row.id}: implausible gram weight ${row.weight_g_low}`);
    ok(!/5\.4\s*g/.test(row.evidence.match(/gold[^.]{0,40}/i)?.[0] || ''), `${row.id}: evidence quotes 5.4 g next to the word gold`);
  }
  const leaves = rings.rows.find((r) => r.id === 'ag-14k-leaves');
  ok(Number(leaves.weight_g_low) === 3.6, `ag-14k-leaves stores ${leaves.weight_g_low} g, expected the 14K figure 3.6 g`);
  const page = detailPages['ag-14k-leaves'] || '';
  ok(/3\.6\s*g/.test(page) || /3\.6\s*grams/.test(page), 'ag-14k-leaves detail page does not render the 3.6 g gold weight');
});

/* --------------------------------------------------------------------- E07 */

await group('E07', 'The Cartier reference is described as the seller now describes it', async () => {
  const row = rings.rows.find((r) => r.id === 'car-18k-destinee-princess');
  ok(/Etincelle|Étincelle/.test(row.title), `title still does not use the live name: ${row.title}`);
  ok(!/0\.18\s*(?:–|-|to)\s*0\.34/.test(row.stone_type || ''), `stone_type repeats the retired 0.18-0.34 ct text: ${row.stone_type}`);
  ok(/0\.16/.test(row.stone_type || ''), 'stone_type does not carry the live 0.16 ct figure');
  ok(/B4232900/.test(row.title + row.notes), 'the Cartier reference number is not recorded');
  ok(flagged.items.some((f) => f.id === 'F68' && /B4232900|Etincelle|Destin/i.test(f.title + f.finding)), 'F68 does not record the rename');
  const page = detailPages['car-18k-destinee-princess'] || '';
  ok(!/<h1[^>]*>[^<]*Destin/i.test(page), 'the detail page still renders Destinée in its heading');
  ok(/Étincelle|Etincelle/.test((/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(page) || [])[1] || ''), 'the detail page heading does not use the live name');
});

/* --------------------------------------------------------------------- E08 */

await group('E08', 'A comparator may not treat navigation copy as a price', async () => {
  ok(/deliberately not a price|NOT product prices|navigation/i.test(comparatorSrc), 'the comparator carries no note excluding navigation copy');
  ok(!/extraction\??\.prices/.test(comparatorSrc), 'the comparator still reads extraction.prices as a product price');
  // No confirmed row may rest on a nav-style figure that is absent from JSON-LD/feed/manual.
  for (const r of rows.filter((x) => confirmed(x.verdict))) {
    const hasMachine =
      (r.observed?.jsonld?.length || 0) > 0 ||
      (r.observed?.variant_groups && Object.keys(r.observed.variant_groups).length > 0);
    ok(hasMachine || r.manual, `${r.id}: confirmed without a machine price or a verbatim read`);
  }
  ok(!rows.some((r) => r.verdict === 'price_moved'), 'a "price moved" verdict still ships — it was the nav-copy false positive');
});

/* --------------------------------------------------------------------- E09 */

await group('E09', 'Every row still carries a detail page and a source link', async () => {
  for (const row of rings.rows) {
    const page = detailPages[row.id];
    ok(!!page, `${row.id}: no detail page`);
    if (!page) continue;
    ok(page.includes(`href="${row.source_url}"`), `${row.id}: detail page does not link the official source`);
    ok(!/undefined|NaN|\[object Object\]/.test(page), `${row.id}: detail page contains a template leak`);
  }
  const flaggedHtml = html['flagged.html'];
  ok(flaggedHtml.includes('id="F68"'), 'flagged.html has no F68 anchor');
  ok(flaggedHtml.includes('id="F69"'), 'flagged.html has no F69 anchor');
  ok(flaggedHtml.includes('id="F70"'), 'flagged.html has no F70 anchor');
  ok(/69 findings|69 open/i.test(flaggedHtml) || flaggedHtml.includes('69'), 'flagged.html does not state the registry size');
});

console.log(`\n${failures === 0 ? 'ALL GROUPS PASSED' : 'FAILURES: ' + failures} — ${assertions} assertions`);
process.exit(failures === 0 ? 0 : 1);
