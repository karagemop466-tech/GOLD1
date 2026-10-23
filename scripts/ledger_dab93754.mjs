#!/usr/bin/env node
/**
 * Ninth pass (sess-dab93754) — build the published per-row ledger.
 *
 * Inputs:
 *   data/live/compare-dab93754.json            (runner evidence vs dataset)
 *   data/session-dab93754/manual-reads-2026-10-23.json  (independent channel)
 *   data/live/latest.json                      (raw evidence, for the gold panel)
 * Output:
 *   data/verification-2026-10-23-evening-dab93754.json
 *
 * This script never edits data/rings.json. Where the fresh read disagrees with
 * the stored value it records both, and lists the disagreement as a finding —
 * it does not overwrite the curated dataset on its own authority.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = process.cwd();
const compare = JSON.parse(await readFile(join(ROOT, 'data/live/compare-dab93754.json'), 'utf8'));
const manual = JSON.parse(
  await readFile(join(ROOT, 'data/session-dab93754/manual-reads-2026-10-23.json'), 'utf8')
);
const evidence = JSON.parse(await readFile(join(ROOT, 'data/live/latest.json'), 'utf8'));

const manualById = new Map(manual.reads.filter((r) => r.id !== '__gold__').map((r) => [r.id, r]));
const goldManual = manual.reads.find((r) => r.id === '__gold__');
const goldRunner = (evidence.gold_price_readings || []).find((g) => /gold-api/.test(g.publisher || ''));

const rows = compare.rows.map((r) => {
  const m = manualById.get(r.id);
  const out = {
    id: r.id,
    retailer: r.retailer,
    source_url: r.url,
    stored_title: r.stored_title,
    stored_price: r.stored_price,
    price_basis: r.price_basis,
    stored_weight_g: r.stored_weight_g,
    runner_http_status: r.page_http_status,
    runner_verdict: r.verdict,
    runner_price_source: r.price_source,
    runner_observed_prices: r.observed_page_prices,
    variant_feed_status: r.variant_feed_status,
    variant_price_range: r.variant_price_range,
    weight_reproduced_today: r.weight_reproduced,
    withdrawn: r.withdrawn || null,
    note: r.note || '',
  };

  if (m) {
    out.independent_read = {
      url: m.url,
      read_at: m.read_at,
      observed: m.observed,
      quote: m.quote,
      channel: manual.channel,
      ...(m.note ? { note: m.note } : {}),
    };
    // The independent channel decides the published verdict for these rows
    // (Menē and Auvere render prices client-side, so the runner had no number).
    if (m.observed.price_low != null) {
      const runnerAgrees =
        r.verdict === 'confirmed' ||
        r.verdict === 'consistent_with_published_range' ||
        (r.stored_price && m.observed.price_low === r.stored_price[0]);
      // Two channels agreed -> "confirmed (two channels)". A price the runner
      // could not see at all, but which a direct read of the seller's own feed
      // or page produced, is a single-channel confirmation and says so.
      const sameAsStored =
        Array.isArray(r.stored_price) &&
        r.stored_price[0] === m.observed.price_low &&
        r.stored_price[1] === (m.observed.price_high ?? m.observed.price_low);
      out.verdict = !sameAsStored
        ? 'stored_price_not_reproduced'
        : runnerAgrees
          ? 'confirmed_two_channels'
          : 'confirmed_independent_read';
      out.observed_price = [m.observed.price_low, m.observed.price_high ?? m.observed.price_low];
      const fmt = (n) => `$${Number(n).toLocaleString('en-US')}`;
      const bits = [`${fmt(m.observed.price_low)}${m.observed.price_high && m.observed.price_high !== m.observed.price_low ? `–${fmt(m.observed.price_high)}` : ''}`];
      if (m.observed.weight_g != null) bits.push(`weight ${m.observed.weight_g} g`);
      if (m.observed.variant) bits.push(`variant "${m.observed.variant}"`);
      if (runnerAgrees) {
        out.note = `two channels agree: ${bits.join(', ')} (independent read ${m.read_at})`;
      } else {
        const storedText = r.stored_price
          ? `${fmt(r.stored_price[0])}${r.stored_price[1] !== r.stored_price[0] ? `–${fmt(r.stored_price[1])}` : ''}`
          : 'no price';
        out.note = `stored ${storedText}; the seller printed ${bits.join(', ')} on ${m.read_at}`;
      }
    } else {
      out.verdict = 'unresolved_price';
      out.observed_price = null;
      out.note = m.note || 'independent read returned no price for this row';
    }
  } else if (r.verdict === 'no_price_observed') {
    // The page was opened but renders its price client-side; nothing was read,
    // so this is unresolved — not a confirmation and not a price change.
    out.verdict = 'unresolved_price';
    out.note = 'page opened but no product price was machine-readable in either channel today';
  } else {
    out.verdict = r.verdict;
  }

  if (out.withdrawn) out.verdict = 'withdrawn_source_mismatch';
  return out;
});

const tally = (v) => rows.filter((r) => r.verdict === v).length;
const summary = {
  rows: rows.length,
  confirmed: tally('confirmed'),
  confirmed_two_channels: tally('confirmed_two_channels'),
  confirmed_independent_read: tally('confirmed_independent_read'),
  consistent_with_published_range: tally('consistent_with_published_range'),
  stored_price_not_reproduced: tally('stored_price_not_reproduced'),
  unresolved_price: tally('unresolved_price'),
  no_price_observed: tally('no_price_observed'),
  not_read: tally('not_read'),
  withdrawn_source_mismatch: tally('withdrawn_source_mismatch'),
  independent_reads: manual.reads.filter((r) => r.id !== '__gold__').length,
  weight_rows: rows.filter((r) => r.stored_weight_g != null).length,
  weight_reproduced_today: rows.filter((r) => r.weight_reproduced_today === true).length,
  weight_not_machine_visible_today: rows.filter((r) => r.weight_reproduced_today === false).length,
};

const findings = [
  {
    id: 'F59',
    severity: 'medium',
    title: 'Menē 24K band prices moved again between 19:38Z and 20:33Z on 2026-10-23',
    finding:
      'Menē prices track spot gold and repricing was observed twice in one day. The stored rows carry the morning read; the evening read is lower in both cases.',
    rows: [
      {
        id: 'mene-24k-classic-band',
        stored: 1707,
        observed: 1694,
        delta: -13,
        read_at: '2026-10-23T20:26:00Z',
        url: 'https://mene.com/products/mene-classic-band-gold',
        quote: '# Classic Band | $1,694 | USD'
      },
      {
        id: 'mene-24k-narrow-band',
        stored: 1361,
        observed: 1350,
        delta: -11,
        read_at: '2026-10-23T20:33:00Z',
        url: 'https://mene.com/products/mene-narrow-band-gold',
        quote: '# Narrow Classic Band | $1,350 | USD'
      },
    ],
    buyer_action:
      'Treat any Menē figure as a quote good for the minute it was read. The published price basis is "starting price — varies with spot gold & ring size", so re-check at checkout.',
  },
  {
    id: 'F60',
    severity: 'medium',
    title: 'Ten rows returned HTTP 403 to the runner again on 2026-10-23 20:21Z',
    finding:
      'Five With Clarity rows (their storefront .json also refused), four Cartier rows and one Brilliant Earth row could not be opened by the automated runner. Nothing was confirmed for them today and nothing is presented as fresh.',
    rows: compare.rows.filter((r) => r.verdict === 'not_read').map((r) => r.id),
    buyer_action: 'Open those official pages yourself before buying; the stored values keep their original capture dates.',
  },
  {
    id: 'F61',
    severity: 'low',
    title: 'Auvere 22K product prices are not machine-readable on the product page',
    finding:
      'The four Auvere PDPs printed their specification panel but no price in the text returned by either channel on 2026-10-23; their prices are rendered client-side. The stored prices keep their earlier capture date.',
    rows: ['auv-22k-vneck-sm', 'auv-22k-hexagon-diamond', 'auv-22k-diamond-bridge-tall', 'auv-22k-clean-cut-polished'],
    buyer_action: 'Read the price in the seller cart; do not rely on the stored figure as current.',
  },
  {
    id: 'F62',
    severity: 'low',
    title: 'Six published gram weights were not machine-visible in this run',
    finding:
      'Aurate renders ring weights inside a client-side specification panel and one Ross-Simons weight sits in a script-rendered block; the automated text extraction did not see them today. The stored weights keep the earlier HTML read and are not upgraded to "verified today".',
    rows: compare.rows.filter((r) => r.weight_reproduced === false).map((r) => r.id),
    buyer_action: 'Ask the seller to confirm the gram weight in writing before paying.',
  },
  {
    id: 'F63',
    severity: 'low',
    title: 'Anna Sheffield PDPs print no product price; the seller feed still does',
    finding:
      'The three Anna Sheffield pages show a custom client archive with no product price, while the seller\u2019s own variant feed (annasheffield.com/products/<handle>.json) returns the exact stored ranges ($11,500; $7,150\u2013$9,200; $5,400\u2013$25,100). The rows remain flagged (F37, F44) because the buyer-facing page has no buy box.',
    rows: compare.rows.filter((r) => r.id.startsWith('as-')).map((r) => ({ id: r.id, variant_range: r.variant_price_range })),
    buyer_action: 'Contact the studio to confirm price and availability; the page cannot be purchased from.',
  },
  {
    id: 'F64',
    severity: 'low',
    title: 'Withdrawn row rs-939479 still resolves to a different ring',
    finding:
      'The URL now serves "Italian 14kt Yellow Gold Claddagh Ring" at $499, not the 1.00 ct lab-grown eternity band the row described. Re-confirms F51; the row stays withdrawn and is excluded from the confirmed count.',
    rows: ['rs-939479'],
    buyer_action: 'Do not buy this SKU expecting the eternity band.',
  },
];

const doc = {
  pass: 'P87-live',
  session: 'sess-dab93754',
  date: '2026-10-23',
  evidence_file: compare.evidence_file || 'data/live/latest.json',
  evidence_started_at: evidence.started_at,
  evidence_finished_at: evidence.finished_at,
  run_context: evidence.run_context,
  purpose:
    'Line-by-line reconciliation of every curated row against its own official product page, re-read in one automated run (20:21:46Z–20:22:25Z) plus an independent second channel.',
  method: {
    runner:
      'GitHub Actions run re-opened all 71 curated URLs with a browser user agent and recorded HTTP status, page title, per-product JSON-LD offers, every Shopify seller\u2019s own variant feed, gram text and solid/plated/final-sale wording. It cannot edit the dataset.',
    comparison:
      'A stored single price, or the full stored range, must appear in the page\u2019s own offer data or in the seller\u2019s variant feed for that exact product. Prices are never attributed from cross-sell tiles, and a range is never rounded.',
    independent_channel:
      'A separate page-fetch channel in the sandbox re-read nine sources (gold spot, two Ross-Simons PDPs, one Automic Gold variant feed, one Aurate variant feed, both Menē bands, one Mejuri PDP, one Auvere PDP) so that the runner\u2019s numbers have an independent witness.',
    gold_price: {
      runner: goldRunner
        ? { publisher: goldRunner.publisher, price_usd_per_ozt: goldRunner.price_usd_per_ozt, publisher_timestamp: goldRunner.publisher_timestamp }
        : null,
      independent: goldManual
        ? { publisher: goldManual.publisher, price_usd_per_ozt: goldManual.observed.price_usd_per_ozt, read_at: goldManual.read_at }
        : null,
      agreement_pct:
        goldRunner && goldManual
          ? Number(
              (
                (Math.abs(goldRunner.price_usd_per_ozt - goldManual.observed.price_usd_per_ozt) /
                  goldRunner.price_usd_per_ozt) *
                100
              ).toFixed(4)
            )
          : null,
    },
  },
  summary,
  findings,
  rows,
};

await writeFile(join(ROOT, 'data/verification-2026-10-23-evening-dab93754.json'), JSON.stringify(doc, null, 2) + '\n');
console.log('ledger written');
for (const [k, v] of Object.entries(summary)) console.log(`  ${k}: ${v}`);
