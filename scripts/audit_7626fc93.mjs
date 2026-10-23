#!/usr/bin/env node
/**
 * Ninth-pass auditor — session sess-7626fc93, branch arena/7626fc93-gold1, 2026-10-23.
 *
 * What `scripts/verify.mjs` (S01–S20) and the two peer auditors (A01–A10, H01–H12) already cover is
 * not repeated here. This file checks the things only the ninth pass could get wrong: that every value
 * the reconciler wrote is inside the quote it cites, that rows which were NOT read today are labelled
 * as not read, that reads which were rejected as evidence stayed rejected, and that the site's own
 * verification wording still matches the status stored for each row.
 *
 * Groups N01–N10. Exits non-zero on any failure. Run after `node scripts/build.mjs`.
 */
import { readFile, access } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const readJson = async (p) => JSON.parse(await readFile(join(ROOT, p), 'utf8'));
const readText = async (p) => await readFile(join(ROOT, p), 'utf8'); // p is relative to the repo root

const rings = await readJson('data/rings.json');
const gold = await readJson('data/gold-price.json');
const flagged = await readJson('data/flagged.json');
const live = await readJson('data/live/latest.json');
const ledger = await readJson('data/verification-2026-10-23.json');
const reval = await readJson('data/reverification.json');
const changes = await readJson('data/session-7626fc93/changes-2026-10-23.json');
const report = await readJson('data/session-7626fc93/reconcile-report-2026-10-23.json');
const handReads = await readJson('data/session-7626fc93/hand-reads-2026-10-23.json');
const sourcesDoc = await readJson('data/sources.json');
const byId = Object.fromEntries(rings.rows.map((r) => [r.id, r]));

const results = [];
let totalAssertions = 0;
async function checkGroup(id, name, fn) {
  const failures = [];
  const assert = (cond, msg) => {
    totalAssertions++;
    if (!cond) failures.push(msg);
  };
  await fn(assert);
  results.push({ id, name, passed: failures.length === 0, failures });
}
const num = (v) => String(v).replace(/,/g, '');

/* N01: the evidence this pass rests on exists, is complete, and says what the site claims */
await checkGroup('N01', 'Ninth-pass evidence present and internally consistent', async (assert) => {
  assert(live.script_version && live.script_version.startsWith('v6'), `data/live/latest.json was written by ${live.script_version}, expected a v6 collector`);
  assert(live.fetch_ok === 61 && live.row_count === 71, `runner read ${live.fetch_ok}/${live.row_count} rows, expected 61/71`);
  assert(live.fetch_failed.length === 10, `expected 10 HTTP-403/failed rows recorded, got ${live.fetch_failed.length}`);
  const v6file = 'data/live/' + String(live.finished_at).replace(/(\d{2}):(\d{2}):(\d{2})/, '$1-$2-$3');
  const v6fileJson = v6file.endsWith('.json') ? v6file : `${v6file}.json`;
  for (const f of [v6fileJson, 'data/live/2026-10-23T20-29-52Z.json', 'data/live/2026-10-23T20-25-27Z.json']) {
    assert(existsSync(join(ROOT, f)), `evidence file ${f} is missing — a pass that cites a capture must ship it`);
  }
  {
    const v6 = await readJson(v6fileJson);
    assert(v6.finished_at === live.finished_at && v6.fetch_ok === live.fetch_ok, `${v6fileJson} is not the capture latest.json presents itself as`);
    assert(JSON.stringify(v6.rows) === JSON.stringify(live.rows), `${v6fileJson} and data/live/latest.json disagree — the dated twin must be the same bytes of evidence`);
  }
  assert(report.counts.rows === 71 && report.problems.length === 0, 'reconcile report is not the clean run this pass published');
  assert(report.rule.startsWith('No hallucinations'), 'reconcile report must state the no-hallucinations rule it enforces');
  assert(report.evidence_run.file === 'data/live/latest.json', 'reconcile report must name the capture it read');
  for (const id of ['live-collector-7626fc93-v6', 'hand-reads-7626fc93']) {
    const src = sourcesDoc.sources.find((x) => x.id === id);
    assert(src && src.status === 'retrieved' && src.verified, `source registry entry ${id} missing or not marked retrieved with a verified note`);
  }
  assert(reval.pass === 'P98-ninth' && reval.entries.length === rings.rows.length, `re-verification ledger is ${reval.pass} with ${reval.entries.length} entries`);
  assert((reval.entries || []).filter((e) => String(e.read_at).startsWith('2026-10-23T2')).length >= 60, 'fewer than 60 ledger entries carry a 2026-10-23 evening read timestamp');
});

/* N02: the quote gate — every value the ninth pass wrote is inside its own quotation */
await checkGroup('N02', 'Every ninth-pass value is contained in the quote it cites', async (assert) => {
  const numeric = (v) => v !== null && v !== undefined;
  for (const c of changes.changes) {
    assert(/^https:\/\/(www\.)?[a-z0-9.-]+\.[a-z]{2,}/i.test(c.url), `${c.id}: source url is not an https origin`);
    assert(String(c.read_at).startsWith('2026-10-23'), `${c.id}: read_at ${c.read_at} is not today`);
    for (const [field, value] of Object.entries(c.set || {})) {
      if (!/price_low|price_high|weight_g_low|weight_g_high/.test(field) || !numeric(value)) continue;
      assert(num(c.quote).includes(num(value)), `${c.id}: writes ${field}=${value}, which does not appear in its own quote "${c.quote.slice(0, 90)}"`);
    }
    if (c.set && c.set.title) {
      assert(c.quote.toLowerCase().includes(String(c.set.title).toLowerCase().slice(0, 30)), `${c.id}: new title is not the wording the quote carries`);
    }
    const row = byId[c.row];
    assert(row, `${c.id}: row ${c.row} does not exist`);
    if (!row) continue;
    for (const [field, value] of Object.entries(c.set || {})) {
      assert(String(row[field]) === String(value), `${c.id}: ${field} was expected to land as ${value}, the data says ${row[field]}`);
      if (/price_low|price_high|weight_g_low|weight_g_high/.test(field) && numeric(value)) {
        assert(num(row.evidence).includes(num(value)), `${c.id}: ${row.id}.${field}=${value} is not traceable in the row's evidence (S02/S14)`);
      }
    }
  }
  assert(report.counts.changes_applied === changes.changes.length, `${report.counts.changes_applied} changes applied vs ${changes.changes.length} curated`);
  assert(report.counts.rejected_by_quote_gate === 0, 'the reconciler reported rejected changes; nothing should have been published');
  const ninthCorrections = (ledger.corrections || []).filter((c) => String(c.change_id || '').startsWith('P98-'));
  assert(ninthCorrections.length > 0, 'the ninth pass wrote price corrections but none are published in the ledger');
  for (const c of ninthCorrections) {
    assert(num(c.quote).includes(num(c.to[0])), `ledger correction ${c.change_id}: "${c.to[0]}" is not in the published quote`);
    assert(String(c.read_at).startsWith('2026-10-23'), `ledger correction ${c.change_id} is not dated today`);
    assert(rings.rows.some((r) => r.id === c.id), `ledger correction ${c.change_id} links to no row page (${c.id})`);
  }
});

/* N03: the status chip must say what the data says — no row may default to "confirmed" */
await checkGroup('N03', 'Published verification wording matches the stored status (chip regression guard)', async (assert) => {
  const statuses = [...new Set(rings.rows.map((r) => r.verification_status))];
  assert(statuses.every((s) => ['confirmed', 'partly_verified', 'withdrawn_source_mismatch'].includes(s)), `unexpected verification_status values: ${statuses.join(', ')}`);
  const withdrawn = rings.rows.filter((r) => r.verification_status === 'withdrawn_source_mismatch');
  assert(withdrawn.length >= 1, 'expected at least one withdrawn row (rs-939479 / F51)');
  for (const r of withdrawn) {
    const page = await readText(`rings/${r.id}.html`);
    assert(page.includes('withdrawn'), `${r.id}: status chip does not say withdrawn`);
    assert(!page.includes('confirmed on the official page'), `${r.id}: a withdrawn row must never render as confirmed on the official page`);
  }
  for (const r of rings.rows.filter((x) => x.verification_status === 'partly_verified')) {
    const page = await readText(`rings/${r.id}.html`);
    assert(page.includes('partly verified'), `${r.id}: partly verified status is not published as such`);
    assert(!page.includes('confirmed on the official page'), `${r.id}: partly verified row renders as confirmed`);
  }
  for (const r of rings.rows.filter((x) => x.verification_status === 'confirmed')) {
    const page = await readText(`rings/${r.id}.html`);
    assert(page.includes('confirmed on the official page'), `${r.id}: confirmed row lost its status chip`);
  }
  const indexHtml = await readText('index.html');
  const checksHtml = await readText('checks.html');
  const latest = await readJson('data/checks/latest.json');
  assert(indexHtml.includes(`<strong>${latest.pass}</strong>`), `index.html does not carry the current pass id ${latest.pass}`);
  assert(checksHtml.includes(`<strong>${latest.pass}</strong>`), `checks.html does not carry the current pass id ${latest.pass}`);
  assert(/No hallucinations — the rule this whole project runs on/.test(indexHtml), 'the front-page no-hallucinations rule was dropped');
});

/* N04: the two rows that really moved are the two rows that really moved */
await checkGroup('N04', 'Menē spot-linked repricing: corrected, quoted, and disclosed', async (assert) => {
  for (const [id, expect, stale] of [['mene-24k-classic-band', 1694, 1707], ['mene-24k-narrow-band', 1350, 1361]]) {
    const r = byId[id];
    assert(r.price_low === expect && r.price_high === expect, `${id}: expected ${expect}, got ${r.price_low}-${r.price_high}`);
    assert(r.retrieved_at === '2026-10-23', `${id}: price is not stamped as retrieved today`);
    assert(num(r.evidence).includes(String(expect)), `${id}: the new price is not traceable to a quote on the row`);
    assert(r.evidence.includes(`$${stale.toLocaleString('en-US')}`) || r.evidence.includes(String(stale)), `${id}: the superseded ${stale} reading was erased instead of kept as history`);
    assert(![779, 1290, 1651, 1664].includes(r.price_low), `${id}: the new price looks like a related-product figure, not this band's`);
  }
  const f60 = flagged.items.find((f) => f.id === 'F60');
  assert(f60 && f60.status === 'needs review', 'F60 (intraday spot-linked repricing) is not published');
  assert((f60.sources || []).length >= 2 && (f60.source_citations || []).length >= 2, 'F60 must cite both Menē pages and the spot reading');
  const spotQuote = (f60.source_citations || []).find((c) => /gold-api/.test(c.url || ''));
  assert(spotQuote && num(spotQuote.quote).includes(String(gold.primary.price_usd_per_ozt)), 'F60 does not quote the spot reading it compares the price move against');
  assert(gold.primary.price_usd_per_ozt === 3997.399902 && String(gold.primary.publisher_timestamp).startsWith('2026-10-23T'), `gold-price primary reading is ${gold.primary.price_usd_per_ozt} @ ${gold.primary.publisher_timestamp}`);
});

/* N05: rows this pass could not read are labelled as not read, not quietly re-stamped */
await checkGroup('N05', 'Unread rows stay labelled unread', async (assert) => {
  const unread = rings.rows.filter((r) => r.not_read_on_ninth_pass);
  assert(unread.length === 6, `expected 6 rows marked not_read_on_ninth_pass, got ${unread.length}: ${unread.map((r) => r.id).join(', ')}`);
  for (const r of unread) {
    assert(r.reverified_pass !== 'P98-ninth', `${r.id}: marked as not read but stamped ${r.reverified_pass}`);
    assert(/not reachable|HTTP 403/.test(r.ninth_pass_note || ''), `${r.id}: ninth_pass_note does not say why it was not read`);
    const lr = ledger.rows.find((x) => x.id === r.id);
    assert(lr && lr.ninth_pass_price_verdict === 'not_read_this_pass', `${r.id}: ledger verdict is ${lr && lr.ninth_pass_price_verdict}, expected not_read_this_pass`);
    const decl = (handReads.reads || []).find((x) => x.row === 'not_read_on_this_channel');
    const listed = (decl?.rows || []).includes(r.id);
    assert(listed, `${r.id}: not read on either channel, but not declared in hand-reads-2026-10-23.json`);
  }
  // the four rows rescued by a hand read must show both channels
  // rows the runner could not reach but this session read by hand must say which channel carried them
  for (const id of ['wc-tulip', 'be-18k-6p-121h6', 'car-18k-etincelle-emerald', 'car-18k-destinee-princess']) {
    const r = byId[id];
    assert(/sandbox fetch channel/.test(r.read_channel || ''), `${id}: rescued by a hand read but read_channel says "${r.read_channel}"`);
    assert(r.reverified_pass === 'P98-ninth', `${id}: should carry the ninth-pass stamp`);
    const lr = ledger.rows.find((x) => x.id === id);
    assert(/sandbox fetch/.test(String(lr.ninth_pass_read)), `${id}: ledger names ${lr.ninth_pass_read}, not this session's own channel`);
    assert(/403/.test(String(lr.ninth_pass_http_status)), `${id}: ledger should still record that the runner was refused`);
  }
  assert(report.counts.verdict_not_read === 6, `${report.counts.verdict_not_read} rows reported as not read, expected 6`);
  assert(report.counts.via_hand_read === 6 && report.counts.via_runner === 61, `read census ${report.counts.via_runner} runner / ${report.counts.via_hand_read} hand, expected 61/6`);
});

/* N06: weight discipline — re-confirmations, non-confirmations, and the ranges left unadopted */
await checkGroup('N06', 'Published weights: 21 re-confirmed, 4 browser-blocked, Auvere ranges untouched', async (assert) => {
  assert(report.counts.weights_reconfirmed === 21, `expected 21 weights re-confirmed today, report says ${report.counts.weights_reconfirmed}`);
  assert(rings.rows.filter((r) => r.weight_g_low !== null).length === 25, 'the published-weight census moved; that needs a flag, not a silent change');
  for (const o of report.counts.weights_not_reconfirmed) {
    const r = byId[o.row];
    assert(r.retailer_id === 'aurate', `${o.row}: weight not re-confirmed at a non-Aurate retailer — investigate before publishing`);
    assert(r.weight_verdict_2026_10_23 === 'not_reconfirmable_without_a_browser', `${o.row}: verdict is ${r.weight_verdict_2026_10_23}`);
    assert(/2026-10-22/.test(r.notes || '') || /2026-10-22/.test(r.evidence), `${o.row}: the 2026-10-22 origin of this figure is not stated on the row`);
    assert(r.weight_g_low === o.stored_weight, `${o.row}: weight changed even though it could not be re-read`);
  }
  const f61 = flagged.items.find((f) => f.id === 'F61');
  assert(f61 && f61.affected.replace(/\s/g, '').split(',').length === 4, 'F61 must name exactly the four Aurate rows');
  for (const id of ['auv-22k-vneck-sm', 'auv-22k-clean-cut-polished', 'auv-22k-diamond-bridge-tall', 'auv-22k-hexagon-diamond']) {
    const r = byId[id];
    assert(r.weight_g_low === null && r.weight_g_high === null, `${id}: an Auvere weight was filled in from a size-dependent range`);
    assert((r.flags || []).includes('weight_not_published'), `${id}: Auvere weight blank without the flag`);
    assert(/Approximate Fine Weight/.test(r.evidence), `${id}: the seller's own range sentence is not quoted on the row`);
  }
  const vneck = byId['auv-22k-vneck-sm'];
  assert(/2\.9 to 3\.7 grams/.test(vneck.evidence), 'Auvere Small V Neck: the range the page prints is not quoted');
  assert(/2\.8 g/.test(vneck.notes || ''), 'Auvere Small V Neck: the conflicting single figure in the seller description is not recorded');
  assert(flagged.items.find((f) => f.id === 'F54' && /2\.8 g/.test(f.finding) && /2\.7 grams/.test(f.finding)), 'F54 must document both conflicting Auvere statements');
  assert(flagged.items.find((f) => f.id === 'F54' && f.temp_key === 'auvere-22k-fine-weight-ambiguity'), 'F54 lost the temp_key the peer auditor pins');
});

/* N07: the inferences this pass refused to make */
await checkGroup('N07', 'Rejected evidence stayed out of the data', async (assert) => {
  assert(report.rejected_reads.nav_label_solid_mentions.includes('as-bea-sol'), 'the report must record the rejected nav-label reads');
  for (const id of ['as-bea-sol', 'as-hazeline', 'as-bea-3stone']) {
    const r = byId[id];
    assert(r.solid_stated === false, `${id}: a "SOLID GOLD" navigation label was promoted into a product claim`);
    assert((r.flags || []).includes('solid_not_stated'), `${id}: solid_not_stated flag dropped`);
  }
  for (const r of rings.rows) {
    assert(r.weight_g_low !== 113 && r.weight_g_high !== 113, `${r.id}: the 113 g parcel weight leaked into a metal-weight field`);
  }
  // a product-level "from" price must not have replaced a karat-specific price
  for (const id of ['ag-14k-leaves', 'ag-14k-cluster']) {
    const r = byId[id];
    assert(r.price_low === 2194 || r.price_low === 1636, `${id}: the option price was overwritten by a product-level figure`);
    assert(/= \$/.test(r.evidence), `${id}: the option combination this price belongs to is not quoted on the row`);
  }
  const rs = byId['rs-989853'];
  assert(rs.price_low === 469 && rs.price_high === 469, 'rs-989853: the unavailable size-8.5 price was adopted into a range');
  assert(!rs.flags.includes('price_varies'), 'rs-989853: price_varies added for a price no buyer can currently get');
  assert(/435/.test(rs.notes || '') && /Currently Unavailable/.test(rs.notes || ''), 'rs-989853: the $435 unavailable size is not documented in the note');
  const au = byId['au-2ct-oval'];
  assert(au.price_low === 1968 && au.price_high === 1968, 'au-2ct-oval: the 14K price still spans metals');
  assert(/18k/i.test(au.notes) && /2,438/.test(au.notes) && /2,800/.test(au.notes), 'au-2ct-oval: the other metals are not recorded in the note');
  assert(!au.flags.includes('price_varies') && !au.flags.includes('metal_variant_price_unmapped'), 'au-2ct-oval: stale flags left on a row that is now mapped at variant level');
});

/* N08: the melt maths still follows the new spot reading */
await checkGroup('N08', 'Spot, melt floor and calculator inputs follow the new reading', async (assert) => {
  assert(gold.grams_per_troy_ounce === 31.1034768, 'NIST grams per troy ounce must stay exact');
  assert(gold.true_grains_per_troy_ounce === 480, 'grains per troy ounce must stay exact');
  assert((gold.readings || []).length >= 3, 'the reading history shrank — a re-priced value needs the readings that led to it');
  const hand = gold.readings.find((x) => /hand read/.test(x.observed_by || ''));
  assert(hand && hand.price_usd_per_ozt === 3998.100098, 'this session\'s own spot read is not recorded alongside the runner read');
  assert(gold.cross_check && gold.cross_check.price_usd_per_ozt === 4010.2, 'the COMEX cross-check the runner read today is not published');
  assert(/runner/.test(gold.cross_check.note || '') , 'the COMEX entry must say which channel read it');
  const perGram = gold.primary.price_usd_per_ozt / 31.1034768;
  for (const r of rings.rows.filter((x) => x.weight_g_low !== null)) {
    const k = parseInt(r.karat, 10);
    const melt = r.weight_g_high * (k / 24) * perGram;
    assert(r.price_low >= melt * 0.98, `${r.id}: price ${r.price_low} is under the melt value ${melt.toFixed(2)} of its published weight`);
  }
  const calc = await readText('calculator.html');
  assert(calc.includes(perGram.toFixed(2)) || calc.includes(String(gold.primary.price_usd_per_ozt)), 'calculator page does not carry the new spot');
  const compliance = await readJson('data/compliance.json');
  assert(compliance.gold_reference.price_usd_per_ozt === gold.primary.price_usd_per_ozt, 'the compliance scorecard still scores against yesterday spot');
  assert(String(compliance.gold_reference.publisher_timestamp) === String(gold.primary.publisher_timestamp), 'the scorecard spot timestamp is out of sync with data/gold-price.json');
  assert((gold.readings || []).some((x) => x.price_usd_per_ozt === 3998.5), "the runner's 20:29Z gold-api reading (3998.5) must be kept alongside the newest one");
  assert(gold.cross_check.attempts && gold.cross_check.attempts.length >= 2, 'the COMEX cross-check must show that later attempts were rate-limited, not hidden');
});

/* N09: per-row freshness provenance, published and parseable */
await checkGroup('N09', 'Every row says when and how it was last read', async (assert) => {
  let stamped = 0;
  for (const r of rings.rows) {
    if (r.not_read_on_ninth_pass) {
      assert(!r.last_read_at || r.reverified_pass !== 'P98-ninth', `${r.id}: not read today but carries a ninth-pass read stamp`);
      continue;
    }
    stamped++;
    assert(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(r.last_read_at || ''), `${r.id}: last_read_at "${r.last_read_at}" is not a full ISO-8601 UTC stamp`);
    assert(String(r.last_read_at).startsWith('2026-10-23'), `${r.id}: last read stamped ${r.last_read_at}, not today`);
    assert(/official/.test(r.read_channel || ''), `${r.id}: read_channel does not name an official channel`);
    assert(r.reverified_pass === 'P98-ninth' && r.verified_at === '2026-10-23', `${r.id}: freshness fields are incomplete`);
    assert(['match', 'match_page_text_price', 'match_within_karat_band', 'within_product_variant_range', 'differs', 'low_matches_high_differs', 'no_machine_readable_price'].includes(r.price_verdict_2026_10_23), `${r.id}: unknown price verdict ${r.price_verdict_2026_10_23}`);
    if (r.weight_g_low !== null) {
      assert(['reconfirmed', 'not_reconfirmable_without_a_browser', 'not_reconfirmed_this_pass'].includes(r.weight_verdict_2026_10_23), `${r.id}: weight verdict ${r.weight_verdict_2026_10_23} is not one of the three honest answers`);
    }
    const page = await readText(`rings/${r.id}.html`);
    assert(page.includes(r.last_read_at), `${r.id}: the row page does not print its read timestamp`);
  }
  assert(stamped === 65, `expected 65 stamped rows, got ${stamped}`);
  const recheck = await readText('recheck.html');
  assert(recheck.includes('Ninth pass'), 'the re-check page does not render the ninth pass');
  assert((ledger.ninth_pass_changes || []).length === changes.changes.length, 'not every curated change is published on the re-check page');
  for (const c of ledger.ninth_pass_changes || []) {
    assert(recheck.includes(c.change_id), `${c.change_id}: change id missing from recheck.html`);
    assert(/“[^”]*”/.test(recheck), 'the changes table must print the quote in quotation marks');
  }
});

/* N10: prose and security hygiene on everything this pass added */
await checkGroup('N10', 'New prose is quote-backed; new files carry no leak or unsafe markup', async (assert) => {
  const money = /(?:US)?D?\$[\d,]+(?:\.\d{1,2})?|\b\d{1,5}(?:\.\d{1,2})?\s(?:USD|g\b|grams?)/gi;
  // A figure in flag prose is allowed if it is quoted in that flag's own citations, or it is a value
  // the dataset or the gold readings actually carry, or it occurs in today's raw capture. Anything
  // else is a number somebody typed in rather than read.
  const known = new Set();
  for (const r of rings.rows) {
    for (const k of ['price_low', 'price_high', 'compare_at_high', 'weight_g_low', 'weight_g_high', 'price_low_usd', 'price_high_usd']) {
      if (r[k] === null || r[k] === undefined) continue;
      known.add(num(String(r[k])));
      known.add(num(String(r[k]).replace(/\.0+$/, '')));
    }
  }
  for (const g of gold.readings || []) known.add(num(String(g.price_usd_per_ozt)));
  if (gold.cross_check) known.add(num(String(gold.cross_check.price_usd_per_ozt)));
  for (const c of ledger.corrections || []) for (const v of [...(c.from || []), ...(c.to || [])]) known.add(num(String(v)));
  const liveBlob = num(JSON.stringify(live));
  for (const item of changes.flags) {
    const f = flagged.items.find((x) => x.id === item.id);
    assert(f, `flag ${item.id} was not published`);
    if (!f) continue;
    const citations = (f.source_citations || []).map((c) => `${c.quote || ''} ${c.title || ''}`).join(' ');
    const prose = `${f.title} ${f.finding} ${f.resolution || ''}`;
    for (const m of prose.match(money) || []) {
      const value = m.replace(/[^0-9.]/g, '');
      if (!value) continue;
      const v = num(value).replace(/\.0+$/, '');
      const inCitation = num(citations).includes(v);
      const inData = known.has(v);
      const inCapture = liveBlob.includes(v);
      assert(inCitation || inData || inCapture, `flag ${f.id}: "${m}" appears in the prose but in no quote, no dataset value and not in today's raw capture`);
    }
    assert((f.sources || []).every((u) => /^https:\/\//.test(u)), `flag ${f.id}: a source is not an https URL`);
    assert(f.buyer_action && f.type, `flag ${f.id}: missing type or buyer_action (peer auditor H06 pins these)`);
  }
  const files = ['scripts/reconcile_7626fc93.mjs', 'scripts/audit_7626fc93.mjs', 'scripts/live_reverify.mjs', 'data/session-7626fc93/hand-reads-2026-10-23.json', 'data/session-7626fc93/changes-2026-10-23.json'];
  for (const p of files) {
    const src = await readText(p);
    // built by concatenation so this auditor does not match its own scan
    const banned = ['ev' + 'al(', 'new ' + 'Function(', 'child_' + 'process', 'exec' + 'Sync(', 'spawn' + 'Sync('];
    for (const b of banned) assert(!src.includes(b), `${p}: contains the unsafe primitive ${b}`);
    assert(!/(ghp_[A-Za-z0-9]{20,}|xox[baprs]-|AKIA[0-9A-Z]{16}|-----BEGIN (RSA |)PRIVATE KEY)/.test(src), `${p}: looks like it contains a credential`);
    assert(!/localhost|127\.0\.0\.1/.test(src) || p.startsWith('scripts/'), `${p}: points at localhost from a page`);
  }
  const pages = ['recheck.html', 'flagged.html', 'index.html'];
  for (const p of pages) {
    const html = await readText(p);
    assert(!/<a[^>]+href="http:/.test(html), `${p}: an http:// link slipped in`);
    for (const a of html.match(/<a [^>]*target="_blank"[^>]*>/g) || []) assert(/rel="[^"]*noopener/.test(a), `${p}: a blank target link lost rel="noopener": ${a.slice(0, 90)}`);
    assert(!/\{\{|\$\{undefined\}|undefined g|null g\b/.test(html), `${p}: a template or unset value leaked into the page`);
  }
  assert(/verify it yourself|Check it yourself|verify for hallucinations|look for hallucinations/i.test(await readText('recheck.html')), 'the re-check page must invite readers to look for hallucinations');
  await access(join(ROOT, 'data/session-7626fc93/prepass-rings-2026-10-23.json'));
  assert(existsSync(join(ROOT, 'data/session-7626fc93/prepass-rings-2026-10-23.json')), 'the pre-pass snapshot is missing, so a re-run could rewrite the before/after column');
});

/* ------------------------------------------------------------------ report */
const failures = results.reduce((n, r) => n + r.failures.length, 0);
for (const r of results) {
  console.log(`${r.passed ? '[PASS]' : '[FAIL]'} ${r.id} ${r.name}${r.passed ? '' : ` — ${r.failures.slice(0, 8).join('; ')}`}`);
}
console.log(`audit_7626fc93 summary: ${results.filter((r) => r.passed).length}/${results.length} groups passed (${totalAssertions} assertions)`);
if (failures) process.exit(1);
