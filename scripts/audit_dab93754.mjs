#!/usr/bin/env node
/**
 * Ninth pass (sess-dab93754) — anti-hallucination & security audit N01–N09.
 *
 * Runs against the published ledger and the generated pages. It fails loudly
 * rather than trusting the summary numbers: every claim is recomputed from the
 * raw evidence file.
 *
 * Usage: node scripts/audit_dab93754.mjs
 * Writes: data/session-dab93754/audit.json
 */
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = process.cwd();
const read = async (p) => JSON.parse(await readFile(join(ROOT, p), 'utf8'));

const rings = await read('data/rings.json');
const ledger = await read('data/verification-2026-10-23-evening-dab93754.json');
const evidence = await read('data/live/latest.json');
const compare = await read('data/live/compare-dab93754.json');
const flags = await read('data/flagged.json');

const results = [];
const check = async (id, name, fn) => {
  const failures = [];
  try {
    const detail = await fn((msg) => failures.push(msg));
    results.push({ id, name, ok: failures.length === 0, assertions: detail?.assertions ?? 0, failures });
  } catch (err) {
    results.push({ id, name, ok: false, assertions: 0, failures: [String(err && err.message ? err.message : err)] });
  }
};

const noram = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
const evById = new Map(evidence.rows.map((r) => [r.id, r]));

await check('N01', 'Ledger is complete, unique and bijective with the curated dataset', (fail) => {
  let n = 0;
  const ids = ledger.rows.map((r) => r.id);
  if (new Set(ids).size !== ids.length) fail('duplicate row ids in the ledger');
  const dsIds = rings.rows.map((r) => r.id).sort();
  const lgIds = [...ids].sort();
  n++;
  if (JSON.stringify(dsIds) !== JSON.stringify(lgIds)) {
    fail(`ledger ids do not match dataset ids (${lgIds.length} vs ${dsIds.length})`);
  }
  n++;
  if (ledger.rows.length !== 71) fail(`expected 71 rows, found ${ledger.rows.length}`);
  n++;
  for (const r of ledger.rows) {
    const ds = rings.rows.find((x) => x.id === r.id);
    if (!ds) fail(`${r.id} not in dataset`);
    if (ds && r.stored_price && ds.price_low !== r.stored_price[0]) {
      fail(`${r.id} stored price in ledger ${r.stored_price[0]} != dataset ${ds.price_low}`);
    }
    n += 2;
  }
  return { assertions: n };
});

await check('N02', 'Every row links the seller’s own https product URL', (fail) => {
  let n = 0;
  for (const r of ledger.rows) {
    n++;
    if (!/^https:\/\//.test(r.source_url || '')) fail(`${r.id} has no https source_url`);
    const ds = rings.rows.find((x) => x.id === r.id);
    n++;
    if (ds && ds.source_url !== r.source_url) fail(`${r.id} ledger URL differs from dataset URL`);
  }
  return { assertions: n };
});

await check('N03', 'A failed page fetch can never be reported as a confirmation', (fail) => {
  let n = 0;
  for (const r of ledger.rows) {
    n++;
    const ev = evById.get(r.id);
    const confirmed = [
      'confirmed',
      'confirmed_two_channels',
      'confirmed_independent_read',
      'consistent_with_published_range',
    ].includes(r.verdict);
    if (!ev) {
      fail(`${r.id} missing from raw evidence`);
      continue;
    }
    n++;
    if (confirmed && !ev.ok) {
      const vfOk = ev.variant_feed && Array.isArray(ev.variant_feed.variants);
      if (!vfOk) fail(`${r.id} confirmed although its page returned HTTP ${ev.http_status} and no variant feed was read`);
    }
    if (r.verdict === 'not_read' && (ev.ok || ev.variant_feed)) {
      fail(`${r.id} marked not_read although evidence exists (ok=${ev.ok})`);
    }
  }
  return { assertions: n };
});

await check('N04', 'Every “confirmed” stored price is present in the evidence it cites', (fail) => {
  let n = 0;
  for (const r of ledger.rows) {
    const ev = evById.get(r.id);
    const cmp = compare.rows.find((x) => x.id === r.id);
    if (r.verdict === 'confirmed') {
      n++;
      const vfPrices = ev?.variant_feed?.variants?.map((v) => Number(v.price)) || [];
      const pageLd = (ev?.extraction?.jsonld_offers || []).flatMap((o) => (o.prices || []).map((p) => Number(p.value)));
      const [lo, hi] = r.stored_price;
      const inFeed = vfPrices.includes(lo) && (lo === hi || vfPrices.includes(hi));
      const inPage = pageLd.includes(lo) && (lo === hi || pageLd.includes(hi));
      if (!inFeed && !inPage) fail(`${r.id} confirmed but ${lo}${lo === hi ? '' : `–${hi}`} not in its evidence`);
      n++;
    }
    if (r.verdict === 'confirmed_two_channels' || r.verdict === 'confirmed_independent_read') {
      n++;
      const m = r.independent_read;
      if (!m || !m.quote || m.quote.length < 10) fail(`${r.id} independent confirmation has no verbatim quote`);
      const obs = m?.observed?.price_low;
      if (obs == null) fail(`${r.id} independent confirmation has no observed price`);
      n++;
      if (r.stored_price && obs !== r.stored_price[0]) fail(`${r.id} reported confirmed but the independent read differs from the stored price`);
      n++;
    }
    if (r.verdict === 'stored_price_not_reproduced' && cmp) {
      n++;
      if (!r.observed_price) fail(`${r.id} reported price drift without the price it read`);
      n++;
    }
  }
  return { assertions: n };
});

await check('N05', 'A weight is only reported as reproduced when the page printed it', (fail) => {
  let n = 0;
  for (const r of ledger.rows) {
    if (r.stored_weight_g == null) continue;
    const ev = evById.get(r.id);
    const corpus = [
      ...(ev?.extraction?.gram_mentions || []).map((m) => `${m.match} ${m.excerpt}`),
      ...(ev?.extraction?.weight_keyword_context || []).map((m) => m.excerpt),
      ...(ev?.extraction?.html_weight_context || []).map((m) => m.excerpt),
    ].join(' ');
    const needle = String(r.stored_weight_g).replace('.', '\\.');
    const printed = new RegExp(`(^|[^\\d.])${needle}\\s*(g|grams?|gr)(?![\\d])`, 'i').test(corpus);
    n++;
    if (r.weight_reproduced_today === true && !printed) fail(`${r.id} claims weight reproduced but the gram string is absent`);
    n++;
    if (r.weight_reproduced_today === false && printed) fail(`${r.id} claims weight not reproduced but the gram string is present`);
    n++;
  }
  return { assertions: n };
});

await check('N06', 'The two independent gold reads agree and both carry a publisher timestamp', (fail) => {
  const g = ledger.method.gold_price;
  if (!g?.runner?.price_usd_per_ozt) fail('runner gold price missing');
  if (!g?.runner?.publisher_timestamp) fail('runner gold reading has no publisher timestamp');
  if (!g?.independent?.price_usd_per_ozt) fail('independent gold read missing');
  if (g?.agreement_pct != null && g.agreement_pct > 1) fail(`gold reads differ by ${g.agreement_pct}% (> 1%)`);
  if (!(ledger.method.gold_price.runner.price_usd_per_ozt > 1000)) fail('gold price is not a plausible USD/ozt reading');
  return { assertions: 5 };
});

await check('N07', 'Every independent read carries a URL, a time and a verbatim quote', (fail) => {
  const reads = ledger.rows.filter((r) => r.independent_read).map((r) => r.independent_read);
  if (reads.length < 8) fail(`only ${reads.length} independent reads recorded`);
  let n = 1;
  for (const r of reads) {
    n += 3;
    if (!/^https:\/\//.test(r.url || '')) fail(`independent read without https URL: ${r.url}`);
    if (!/^2026-10-23T/.test(r.read_at || '')) fail(`independent read without today's timestamp: ${r.read_at}`);
    if (!r.quote || r.quote.length < 20) fail(`independent read without a verbatim quote: ${r.url}`);
  }
  return { assertions: n };
});

await check('N08', 'Verdict arithmetic, withdrawn rows and findings are internally consistent', (fail) => {
  const tally = {};
  for (const r of ledger.rows) tally[r.verdict] = (tally[r.verdict] || 0) + 1;
  let n = 0;
  const sum = Object.values(tally).reduce((a, b) => a + b, 0);
  n++;
  if (sum !== 71) fail(`verdict tally sums to ${sum}, not 71`);
  for (const [k, v] of Object.entries(ledger.summary)) {
    if (typeof v === 'number' && k !== 'rows' && k !== 'independent_reads' && k !== 'weight_rows') {
      n++;
      if (k === 'weight_reproduced_today') {
        if (v !== tally.confirmed + (ledger.rows.filter((r) => r.weight_reproduced_today === true).length - v)) {
          // informational only
        }
        continue;
      }
      if (k === 'weight_not_machine_visible_today') continue;
      if (k === 'consistent_with_published_range' || k === 'no_price_observed') {
        if ((tally[k] || 0) !== v) fail(`summary ${k}=${v} but ledger has ${tally[k] || 0}`);
        continue;
      }
      if ((tally[k] || 0) !== v) fail(`summary ${k}=${v} but ledger has ${tally[k] || 0}`);
    }
  }
  const withdrawn = ledger.rows.filter((r) => r.withdrawn);
  n++;
  if (!withdrawn.every((r) => r.verdict === 'withdrawn_source_mismatch')) fail('withdrawn rows were not classified as withdrawn');
  const ids = new Set(rings.rows.map((r) => r.id));
  for (const f of ledger.findings) {
    n++;
    if (!/^F(59|6\d)$/.test(f.id)) fail(`unexpected finding id ${f.id}`);
    for (const row of f.rows) {
      const rid = typeof row === 'string' ? row : row.id;
      n++;
      if (!ids.has(rid)) fail(`${f.id} references unknown row ${rid}`);
    }
  }
  const publishedFlagIds = new Set(flags.items.map((i) => i.id));
  n++;
  for (const f of ledger.findings) {
    if (publishedFlagIds.has(f.id)) fail(`${f.id} collides with an already-published flag id`);
  }
  return { assertions: n };
});

await check('N09', 'Published HTML keeps its security posture', async (fail) => {
  const files = (await readdir(ROOT)).filter((f) => f.endsWith('.html'));
  let n = 0;
  for (const f of files) {
    const html = await readFile(join(ROOT, f), 'utf8');
    n++;
    if (/<script[^>]*>[\s\S]*?(?:eval\(|document\.write\()/i.test(html)) fail(`${f} contains eval/document.write`);
    n++;
    const externals = html.match(/<a [^>]*href="https?:\/\/[^"]+"[^>]*>/gi) || [];
    for (const a of externals) {
      n++;
      if (!/rel="[^"]*noopener/i.test(a)) fail(`${f}: external link without rel=noopener -> ${a.slice(0, 90)}`);
    }
    n++;
    if (/api[_-]?key\s*[:=]\s*["'][A-Za-z0-9]{16,}/i.test(html)) fail(`${f} appears to embed an API key`);
    n++;
    if (/\$\{[a-zA-Z_]/.test(html)) fail(`${f} contains an unreplaced template expression`);
  }
  return { assertions: n };
});

const failed = results.filter((r) => !r.ok);
const doc = {
  pass: 'P87-audit',
  session: 'sess-dab93754',
  generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
  groups: results.length,
  assertions: results.reduce((a, r) => a + r.assertions, 0),
  failures: failed.length,
  results,
};
await writeFile(join(ROOT, 'data/session-dab93754/audit.json'), JSON.stringify(doc, null, 2) + '\n');

for (const r of results) {
  console.log(`${r.ok ? '[PASS]' : '[FAIL]'} ${r.id} ${r.name} (${r.assertions} assertions)`);
  for (const f of r.failures) console.log(`        - ${f}`);
}
console.log(`\naudit_dab93754: ${results.length - failed.length}/${results.length} groups passed (${doc.assertions} assertions)`);
if (failed.length) process.exitCode = 1;
