#!/usr/bin/env node
/**
 * GOLD1 — eleventh-pass comparator (sess-67748540), 2026-10-23T23:39Z run.
 *
 * Reads the fresh runner evidence (`data/live/latest.json`) and compares it,
 * row by row, against the curated `data/rings.json`. It only *reports*; it
 * never writes to rings.json. Every observed value carries the verbatim
 * excerpt it was read from, so a human can check the transcription.
 *
 * Rules mirrored from the project board:
 *  - no inference: a value is "observed" only if the page printed it;
 *  - a Shopify seller's own /products/<handle>.js feed is an official seller
 *    feed and is reported separately from the HTML PDP observation;
 *  - a row the runner could not read is `not_read` here and must be resolved
 *    by the independent channel (fetch_page hand reads) or left flagged.
 *
 * Run: node scripts/compare_67748540.mjs
 * Out: data/session-67748540/reconcile-67748540.json
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = process.cwd();
const ledger = JSON.parse(await readFile(join(ROOT, 'data/live/latest.json'), 'utf8'));
const rings = JSON.parse(await readFile(join(ROOT, 'data/rings.json'), 'utf8'));
const hand = JSON.parse(await readFile(join(ROOT, 'data/session-67748540/hand-reads-2026-10-23.json'), 'utf8'));
const handById = new Map(hand.reads.map((r) => [r.id, r]));

const money = (s) => Number(String(s).replace(/[^0-9.]/g, ''));

function htmlPrices(row) {
  const out = [];
  for (const m of row?.extraction?.prices ?? []) {
    const n = money(m.match);
    if (Number.isFinite(n) && n > 0) out.push({ value: n, excerpt: m.excerpt, from: 'html_price_text' });
  }
  for (const o of row?.extraction?.jsonld_offers ?? []) {
    for (const p of o.prices ?? []) {
      const n = Number(p.value);
      if (Number.isFinite(n) && n > 0 && p.currency === 'USD')
        out.push({ value: n, excerpt: `JSON-LD offer "${o.name ?? ''}" ${p.key}=${n} ${p.currency}`, from: 'jsonld_offer' });
    }
  }
  return out;
}

function feedPrices(row) {
  const f = row?.variant_feed;
  if (!f || typeof f.price_min !== 'number') return [];
  return [
    {
      value: f.price_min,
      excerpt: `seller /products/${f.handle}.js price_min=${f.price_min} price_max=${f.price_max} variants=${f.variant_count}`,
      from: 'seller_variant_feed',
      max: f.price_max,
    },
  ];
}

const results = [];
for (const stored of rings.rows) {
  const live = ledger.rows.find((r) => r.id === stored.id);
  const base = {
    id: stored.id,
    retailer: stored.retailer,
    title: stored.title,
    url: stored.source_url,
    stored_price_low: stored.price_low,
    stored_price_high: stored.price_high,
    stored_karat: stored.karat,
    stored_weight_g: stored.weight_g_low,
    withdrawn: stored.withdrawn === true,
    fetched_at: live?.fetched_at ?? null,
    http_status: live?.http_status ?? null,
  };

  if (!live || !live.ok) {
    const h = handById.get(stored.id);
    results.push({
      ...base,
      verdict: h ? 'hand_read_resolved' : 'not_read',
      reason: `HTTP ${live?.http_status ?? 'no row'} in the 2026-10-23T23:39Z runner`,
      hand_read_verdict: h?.verdict ?? null,
      hand_read_url: h?.final_url ?? null,
      hand_read_verbatim: h?.verbatim ?? null,
    });
    continue;
  }

  const observed = [...htmlPrices(live), ...feedPrices(live)];
  const values = [...new Set(observed.map((o) => o.value))];
  const htmlValues = [...new Set(observed.filter((o) => o.from !== 'seller_variant_feed').map((o) => o.value))];

  const feed = live.variant_feed;
  const feedVariantMatch = (feed?.variants ?? []).filter(
    (v) => v.price === stored.price_low && (stored.price_low === stored.price_high || v.price === stored.price_high)
  );
  const feedRangeMatch =
    Number.isFinite(feed?.price_min) &&
    Number.isFinite(feed?.price_max) &&
    feed.price_min === stored.price_low &&
    (feed.price_max === stored.price_high || stored.price_low === stored.price_high);

  let verdict;
  if (stored.price_unverified === true) verdict = 'price_unverified_by_design';
  else if (htmlValues.length === 0 && values.length === 0) verdict = 'price_not_found';
  else if (htmlValues.includes(stored.price_low) && htmlValues.includes(stored.price_high))
    verdict = 'stored_price_reproduced';
  else if (feedRangeMatch) verdict = 'stored_range_reproduced_seller_feed';
  else if (feedVariantMatch.length > 0) verdict = 'stored_variant_price_reproduced_seller_feed';
  else if (values.includes(stored.price_low) && values.includes(stored.price_high))
    verdict = 'stored_price_reproduced';
  else verdict = 'stored_price_not_reproduced';

  const karatMentions = (live.extraction.karat_mentions ?? []).map((k) => k.match);
  const storedKaratForms = {
    '10K': ['10k', '10kt', '10 kt'],
    '14K': ['14k', '14kt', '14 kt'],
    '18K': ['18k', '18kt', '18 kt'],
    '22K': ['22k', '22kt'],
    '24K': ['24k', '24kt'],
  }[stored.karat] ?? [];

  results.push({
    ...base,
    verdict,
    observed_values: values,
    observed_price_excerpt: observed[0]?.excerpt ?? null,
    observed_sources: [...new Set(observed.map((o) => o.from))],
    feed_variant_match: feedVariantMatch.slice(0, 6).map((v) => ({ title: v.title, price: v.price })),
    karat_printed: storedKaratForms.some((f) => karatMentions.some((m) => m.toLowerCase() === f)),
    karat_mentions: karatMentions.slice(0, 6),
    solid_printed: (live.extraction.solid_mentions ?? []).some((s) => /solid/i.test(s.excerpt ?? '')),
    plated_printed: (live.extraction.plated_mentions ?? []).length > 0,
    weight_printed: stored.weight_g_low == null
      ? null
      : (live.extraction.gram_mentions ?? []).some((g) => String(g.match ?? '').includes(String(stored.weight_g_low))),
    text_sha256: live.extraction.text_sha256 ?? null,
  });
}

const counts = results.reduce((a, r) => ((a[r.verdict] = (a[r.verdict] ?? 0) + 1), a), {});
const out = {
  pass: 'P116-live-67748540',
  runner_pass: ledger.pass,
  runner_started_at: ledger.started_at,
  runner_finished_at: ledger.finished_at,
  compared_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
  row_count: results.length,
  verdict_counts: counts,
  price_drift: results.filter((r) => r.verdict === 'stored_price_not_reproduced'),
  unread: results.filter((r) => r.verdict === 'not_read'),
  hand_read_resolved: results.filter((r) => r.verdict === 'hand_read_resolved').length,
  rows: results,
};

await mkdir(join(ROOT, 'data/session-67748540'), { recursive: true });
await writeFile(join(ROOT, 'data/session-67748540/reconcile-67748540.json'), JSON.stringify(out, null, 1) + '\n');

console.log(`compared ${results.length} rows — ${JSON.stringify(counts)}`);
for (const r of out.price_drift) {
  console.log(`DRIFT ${r.id} stored=${r.stored_price_low}-${r.stored_price_high} observed=${JSON.stringify(r.observed_values)} :: ${(r.observed_price_excerpt ?? '').slice(0, 120)}`);
}
for (const r of out.unread) console.log(`UNREAD ${r.id} (${r.http_status})`);
