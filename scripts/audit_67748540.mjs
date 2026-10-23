#!/usr/bin/env node
/**
 * GOLD1 — eleventh-pass audit groups Q01–Q08 (sess-67748540, 2026-10-23 night).
 *
 * These groups pin the properties that made this pass worth publishing, so the
 * same defect cannot silently return:
 *
 *   Q01  the fresh-pass stamp is applied to exactly the rows that were confirmed
 *   Q02  every row is accounted for: runner-read, hand-read, or unverified by design
 *   Q03  a hand-read row may never claim more than the page printed
 *   Q04  the two gold channels agree, and both carry a publisher timestamp
 *   Q05  every melt figure on the site derives from the *stored* spot
 *   Q06  the new finding F68 exists, carries sources, and is rendered with an anchor
 *   Q07  no stale pass prose ("65 findings", "50 parsed by the automated runner")
 *   Q08  security posture of the regenerated HTML (inline script/handler, secrets)
 *
 * Run: node scripts/audit_67748540.mjs
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';

const ROOT = process.cwd();
const readJson = async (p) => JSON.parse(await readFile(join(ROOT, p), 'utf8'));
const readText = async (p) => readFile(join(ROOT, p), 'utf8');

const PASS = 'P117-67748540';
const results = [];
let assertions = 0;

async function group(id, name, fn) {
  const failures = [];
  const assert = (cond, msg) => {
    assertions += 1;
    if (!cond) failures.push(msg);
  };
  try {
    await fn(assert);
  } catch (e) {
    failures.push(`threw: ${e.message}`);
  }
  results.push({ id, name, failures });
}

const rings = await readJson('data/rings.json');
const flagged = await readJson('data/flagged.json');
const gold = await readJson('data/gold-price.json');
const compliance = await readJson('data/compliance.json');
const live = await readJson('data/live/latest.json');
const hand = await readJson('data/session-67748540/hand-reads-2026-10-23.json');
const cmp = await readJson('data/session-67748540/reconcile-67748540.json');

const money = (s) => Number(String(s).replace(/[^0-9.]/g, ''));

await group('Q01', 'Fresh-pass stamp covers exactly the confirmed rows', async (assert) => {
  const stamped = rings.rows.filter((r) => r.reverified_pass === PASS);
  const confirmed = cmp.rows.filter((r) =>
    ['stored_price_reproduced', 'stored_range_reproduced_seller_feed', 'stored_variant_price_reproduced_seller_feed', 'hand_read_resolved'].includes(r.verdict)
  );
  assert(stamped.length === confirmed.length, `${stamped.length} rows carry ${PASS} but ${confirmed.length} were confirmed`);
  assert(stamped.length === 68, `expected 68 confirmed rows in this pass, found ${stamped.length}`);
  for (const c of confirmed) {
    const row = rings.rows.find((r) => r.id === c.id);
    assert(!!row, `${c.id}: confirmed but missing from the dataset`);
    assert(row.reverified_at === '2026-10-23', `${c.id}: confirmed today but reverified_at is ${row.reverified_at}`);
    assert(row.evidence.includes('P117-67748540'), `${c.id}: evidence carries no dated ${PASS} quote`);
  }
  for (const r of rings.rows.filter((x) => x.withdrawn)) {
    assert(!r.evidence.includes(PASS), `${r.id}: a withdrawn row must not carry a fresh confirmation quote`);
  }
});

await group('Q02', 'Every row is accounted for: runner, second channel, or unverified by design', async (assert) => {
  assert(live.row_count === rings.rows.length, `runner covered ${live.row_count} of ${rings.rows.length} rows`);
  const unread = live.rows.filter((r) => !r.ok).map((r) => r.id);
  const handIds = new Set(hand.reads.map((r) => r.id));
  for (const id of unread) assert(handIds.has(id), `${id}: unread by the runner and missing from the hand-read ledger`);
  // A hand read may also be an *extra* corroboration of a row the runner did
  // read. That is allowed, but then the two channels must agree — a second
  // channel that contradicts the first is a finding, not a nicety.
  for (const h of hand.reads.filter((x) => !unread.includes(x.id))) {
    const runnerRow = live.rows.find((r) => r.id === h.id);
    const feed = runnerRow.variant_feed;
    const printed = h.observed.price_usd ?? h.observed.price_min_usd;
    const runnerPrices = [
      ...(runnerRow.extraction?.jsonld_offers ?? []).flatMap((o) => (o.prices ?? []).map((p) => Number(p.value))),
      ...(feed ? [feed.price_min, feed.price_max] : []),
    ];
    const runnerSaw = [...new Set(runnerPrices)].filter((n) => Number.isFinite(n) && n > 0);
    if (runnerSaw.length === 0) {
      // The page loaded for the runner but printed no machine-readable price
      // (client-side rendering). The hand read is then the only price evidence
      // and the row must say so in its own notes/flags — never a silent fill.
      const row = rings.rows.find((r) => r.id === h.id);
      assert(
        (row.flags ?? []).some((f) => /price|js|render|feed/i.test(f)) || /not machine-readable|JS-rendered|client-side/i.test(row.notes ?? ''),
        `${h.id}: only the second channel saw a price, but the row does not disclose that`
      );
    } else {
      assert(runnerSaw.includes(printed), `${h.id}: second channel printed ${printed} but the runner saw ${JSON.stringify(runnerSaw)}`);
    }
  }
  const byDesign = rings.rows.filter((r) => r.price_unverified === true).map((r) => r.id).sort();
  assert(JSON.stringify(byDesign) === JSON.stringify(['as-bea-sol', 'bn-14k-petite-195639', 'rs-939479']), `unexpected by-design set: ${byDesign}`);
  const counts = cmp.verdict_counts;
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  assert(total === rings.rows.length, `verdict tally covers ${total} of ${rings.rows.length} rows`);
  assert(!counts.stored_price_not_reproduced && !counts.not_read, `unresolved verdicts remain: ${JSON.stringify(counts)}`);
});

await group('Q03', 'A hand read never claims more than the page printed', async (assert) => {
  for (const h of hand.reads) {
    const row = rings.rows.find((r) => r.id === h.id);
    assert(!!row, `${h.id}: hand read for an unknown row`);
    assert(typeof h.verbatim === 'string' && h.verbatim.length > 20, `${h.id}: no verbatim quote`);
    assert(/^https:\/\//.test(h.final_url), `${h.id}: final URL is not https`);
    assert(h.verdict.startsWith('stored'), `${h.id}: surprising verdict ${h.verdict}`);
    // a printed price must appear in the quote the page produced
    const printed = [];
    if (h.observed.price_usd != null) printed.push(String(h.observed.price_usd));
    if (h.observed.price_min_usd != null) printed.push(String(h.observed.price_min_usd));
    if (h.observed.price_max_usd != null) printed.push(String(h.observed.price_max_usd));
    assert(printed.length > 0, `${h.id}: no price recorded`);
    for (const p of printed) {
      const cents = String(Number(p) * 100);
      const withCommas = Number(p).toLocaleString('en-US');
      assert(
        h.verbatim.includes(withCommas) || h.verbatim.includes(`$${withCommas}`) || h.verbatim.includes(cents) || h.verbatim.includes(p),
        `${h.id}: quoted $${withCommas} is not present in the verbatim excerpt`
      );
    }
    // and the stored row must equal what the ledger says was printed
    const low = h.observed.price_usd ?? h.observed.price_min_usd;
    const high = h.observed.price_usd ?? h.observed.price_max_usd;
    assert(low === row.price_low, `${h.id}: ledger low ${low} != stored ${row.price_low}`);
    assert(high === row.price_high, `${h.id}: ledger high ${high} != stored ${row.price_high}`);
  }
});

await group('Q04', 'Both gold channels agree and carry a publisher timestamp', async (assert) => {
  const runner = live.gold_price_readings.find((g) => g.publisher === 'gold-api.com');
  const handGold = hand.gold_price.find((g) => g.publisher === 'gold-api.com');
  assert(!!runner && !!handGold, 'one of the two gold readings is missing');
  assert(runner.price_usd_per_ozt === handGold.price_usd_per_ozt, `channels disagree: ${runner.price_usd_per_ozt} vs ${handGold.price_usd_per_ozt}`);
  assert(gold.primary.price_usd_per_ozt === runner.price_usd_per_ozt, 'stored primary does not equal the runner reading');
  // Post-union (see COORDINATION §23.0): the stored primary keeps the parallel
  // session's read at 23:38:16Z, which is the same publisher timestamp this
  // session's own channel saw. The runner sampled the same unchanged value one
  // minute later. Either publisher stamp is legitimate — but both channels must
  // have produced the same number, and the stored timestamp must be one of them.
  assert(
    [runner.publisher_timestamp, handGold.publisher_timestamp].includes(gold.primary.publisher_timestamp),
    `stored publisher timestamp ${gold.primary.publisher_timestamp} matches neither channel (${runner.publisher_timestamp} / ${handGold.publisher_timestamp})`
  );
  assert(/Z$/.test(gold.primary.publisher_timestamp), 'publisher timestamp is not an explicit UTC instant');
  const comex = hand.gold_price.find((g) => /Yahoo/.test(g.publisher));
  assert(gold.cross_check.price_usd_per_ozt === comex.price_usd_per_ozt, 'stored COMEX cross-check does not equal the read value');
  assert(/Z$/.test(gold.cross_check.publisher_timestamp), 'cross-check timestamp is not an explicit UTC instant');
  assert(Array.isArray(gold.readings) && gold.readings.length >= 3, 'the reading history was truncated');
});

await group('Q05', 'Every melt figure derives from the stored spot, not an older one', async (assert) => {
  const perGram = gold.primary.price_usd_per_ozt / gold.grams_per_troy_ounce;
  const spotShown = compliance.gold_reference?.price_usd_per_ozt ?? null;
  assert(spotShown !== null, 'compliance.json does not record the spot it used');
  assert(Math.abs(spotShown - gold.primary.price_usd_per_ozt) < 1e-6, `compliance spot ${spotShown} != stored spot ${gold.primary.price_usd_per_ozt} — rerun scripts/build_compliance.mjs`);
  assert(compliance.gold_reference.publisher_timestamp === gold.primary.publisher_timestamp, 'compliance.json used a different publisher timestamp than the stored spot');
  let checked = 0;
  for (const r of rings.rows) {
    if (r.weight_g_low == null) continue;
    const cc = (compliance.rows ?? []).find((x) => x.id === r.id);
    if (!cc || cc.gold_value_usd == null) continue;
    const karat = parseInt(String(r.karat), 10) / 24;
    const expected = r.weight_g_low * karat * perGram;
    assert(Math.abs(expected - cc.gold_value_usd) < 0.02, `${r.id}: melt ${cc.gold_value_usd} != recomputed ${expected.toFixed(2)}`);
    checked += 1;
  }
  assert(checked >= 20, `only ${checked} melt figures were recomputable`);
});

await group('Q06', 'Finding F68 is real, sourced and rendered', async (assert) => {
  const f = flagged.items.find((i) => i.id === 'F68');
  assert(!!f, 'F68 missing from the registry');
  assert(f.sources.length >= 2 && f.sources.every((u) => u.startsWith('https://www.cartier.com/')), 'F68 sources must be Cartier product URLs');
  assert(f.status === 'needs review', 'F68 must be published, non-blocking');
  assert(flagged.items.filter((i) => i.id === 'F68').length === 1, 'F68 duplicated');
  const ids = flagged.items.map((i) => i.id);
  assert(new Set(ids).size === ids.length, 'duplicate finding ids in the registry');
  const html = await readText('flagged.html');
  assert(html.includes('id="F68"'), 'flagged.html has no F68 anchor');
  assert(/Etincelle/.test(html), 'flagged.html does not render the F68 wording');
});

await group('Q07', 'No stale pass prose ships', async (assert) => {
  const readme = await readText('README.md');
  const board = await readText('COORDINATION.md');
  assert(readme.includes('67 findings'), 'README does not state the current 67 findings');
  assert(!readme.includes('65 findings'), 'README still says 65 findings');
  assert(!readme.includes('66 findings'), 'README still says 66 findings');
  assert(!readme.includes('50 parsed by the automated runner'), 'README still describes the old runner tally');
  assert(readme.includes('61 parsed by the automated 23:39Z runner'), 'README missing the current runner tally');
  assert(board.includes('## 23.'), 'COORDINATION.md carries no §23 record for this pass');
  // §23 is this session's section: §22 belongs to the parallel eleventh pass
  // (sess-356f1adf, PR #70), which landed first and owns F67 (NIST dead link).
  const s22 = board.slice(board.indexOf('## 23.'));
  // Historical sections (§21 and earlier) keep their dated wording verbatim by
  // design — history is never rewritten. The *current-state* text must not still
  // advertise F67 as free, and must state the live registry size.
  assert(!/next (new )?id\W{0,4}F6[78]/i.test(s22), '§23 still advertises a used id as the next free one');
  assert(/next new id \*\*F69\*\*|next new id F69/.test(board), 'the board does not state that F69 is now the next free id');
  assert(/67 findings/.test(s22), '§23 does not state the current registry size');
});

await group('Q08', 'Regenerated HTML keeps its security posture', async (assert) => {
  const pages = ['index.html', 'rings.html', 'flagged.html', 'requirements.html', 'weights.html', 'calculator.html', 'sources.html', 'checks.html'];
  for (const p of pages) {
    assert(existsSync(join(ROOT, p)), `${p} missing`);
    const html = await readText(p);
    assert(!/<script(?![^>]*\bsrc=)/i.test(html), `${p}: inline <script> without src`);
    assert(!/\son(?:click|load|error|mouseover)\s*=/i.test(html), `${p}: inline event handler`);
    assert(!/javascript:/i.test(html), `${p}: javascript: URL`);
    for (const m of html.matchAll(/<a\b[^>]*href="https?:\/\/[^"]+"[^>]*>/gi)) {
      assert(/rel="[^"]*noopener/.test(m[0]), `${p}: external link without rel=noopener — ${m[0].slice(0, 90)}`);
    }
    assert(!/(AKIA[0-9A-Z]{16}|ghp_[A-Za-z0-9]{20,}|-----BEGIN [A-Z ]*PRIVATE KEY)/.test(html), `${p}: secret-like string`);
    assert(!/localhost|127\.0\.0\.1/.test(html), `${p}: references a local address`);
  }
});

const failed = results.filter((r) => r.failures.length);
for (const r of results) {
  console.log(`[${r.failures.length ? 'FAIL' : 'PASS'}] ${r.id} ${r.name}${r.failures.length ? ' — ' + r.failures.slice(0, 4).join('; ') : ''}`);
}
console.log(`audit_67748540: ${results.length - failed.length}/${results.length} groups passed (${assertions} assertions)`);
if (failed.length) process.exit(1);
