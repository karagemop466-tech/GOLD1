#!/usr/bin/env node
/**
 * GOLD1 — sess-7173133c (T56/§29) anti-hallucination & security gate: V01–V12.
 *
 * Validates:
 *   data/session-7173133c/verify-7173133c.json  (evidence ledger)
 *   data/session-7173133c/portal/*.html         (published dashboard)
 * and writes data/session-7173133c/checks.json (read back by the builder for checks.html).
 *
 * Run: node scripts/verify_7173133c.mjs   (exit 0 = all gates pass)
 */
import { readFile, writeFile, readdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const SESSION_DIR = join(ROOT, 'data', 'session-7173133c');
const PORTAL = join(SESSION_DIR, 'portal');
const readJson = async (p) => JSON.parse(await readFile(p, 'utf8'));
const readText = async (p) => readFile(p, 'utf8');

const v = await readJson(join(SESSION_DIR, 'verify-7173133c.json'));
const results = [];
let run = 0;
try {
  const prev = await readJson(join(SESSION_DIR, 'checks.json'));
  run = (prev.run || 0) + 1;
} catch {
  run = 1;
}

async function gate(id, name, fn) {
  const failures = [];
  const assert = (cond, msg) => {
    if (!cond) failures.push(msg);
  };
  try {
    await fn(assert);
  } catch (e) {
    failures.push(`threw: ${e.message}`);
  }
  results.push({ id, name, pass: failures.length === 0, failures });
}

const portalFiles = existsSync(PORTAL) ? (await readdir(PORTAL)).filter((f) => f.endsWith('.html')).sort() : [];
const portalHtml = new Map();
for (const f of portalFiles) portalHtml.set(f, await readText(join(PORTAL, f)));

const ALLOWED_PRICE_VERDICT = /^(confirmed|confirmed_original_live_promo|confirmed_redirect_already_f68|drift_|stored_price_unverified_now_reproducible|drift_up_\d+|drift_stored_)/;
const ALLOWED_WEIGHT_VERDICT = /^(confirmed|confirmed_range|confirmed_size9_1_7mm|not_published|range_labelled_approximate_fine_weight_kept_null_f54)$/;

/* V01 — no-hallucination banner in the top summary */
await gate('V01', 'No-hallucination banner in top summary', (assert) => {
  const idx = portalHtml.get('index.html');
  assert(!!idx, 'portal/index.html missing — run scripts/build_7173133c.mjs');
  if (!idx) return;
  const mainAt = idx.indexOf('<main>');
  const bannerAt = idx.indexOf('No hallucinations');
  assert(mainAt !== -1 && bannerAt !== -1, 'index.html lacks <main> or the No-hallucinations rule');
  assert(bannerAt > mainAt && bannerAt - mainAt < 900, 'No-hallucinations rule must sit at the very top of <main>');
  assert(/No hallucinations/.test(idx.slice(mainAt, mainAt + 700)), 'banner must be the first content in <main>');
});

/* V02 — every canonical + candidate row has an official https source URL */
await gate('V02', 'Every row has an official https source URL', (assert) => {
  assert(v.canonical_rows.length === 71, `expected 71 canonical rows, found ${v.canonical_rows.length}`);
  assert(v.candidate_rows.length === 13, `expected 13 candidate rows, found ${v.candidate_rows.length}`);
  for (const r of [...v.canonical_rows, ...v.candidate_rows]) {
    assert(/^https:\/\//.test(r.source_url || ''), `${r.id}: missing/invalid source_url`);
    assert(typeof r.quote === 'string' && r.quote.length > 15, `${r.id}: missing verbatim quote`);
  }
});

/* V03 — every price verdict is in the allowed (explicit) set; drifts are findings */
await gate('V03', 'Price verdicts explicit; drift disclosed as findings', (assert) => {
  for (const r of [...v.canonical_rows, ...v.candidate_rows]) {
    assert(ALLOWED_PRICE_VERDICT.test(r.price_verdict || ''), `${r.id}: unexpected price_verdict "${r.price_verdict}"`);
  }
  const driftRows = [...v.canonical_rows, ...v.candidate_rows].filter((r) => /^drift|_now_reproducible/.test(r.price_verdict));
  const findingIds = new Set(v.findings.map((f) => f.id));
  assert(findingIds.size === v.findings.length, 'finding ids must be unique');
  assert(v.findings.length >= 1, 'at least one finding expected from a live pass');
  assert(driftRows.length >= 1, 'drift rows must exist to justify findings');
  for (const f of v.findings) {
    assert(/^V-7173133c-\d{2}$/.test(f.id), `finding id malformed: ${f.id}`);
    assert(['high', 'medium', 'low'].includes(f.severity), `${f.id}: bad severity`);
    assert(/^https:\/\//.test(f.source_url || ''), `${f.id}: missing source_url`);
    assert(typeof f.detail === 'string' && f.detail.length > 30, `${f.id}: detail too short`);
  }
});

/* V04 — no weight invented */
await gate('V04', 'No weight invented; blanks stay blank', (assert) => {
  for (const r of [...v.canonical_rows, ...v.candidate_rows]) {
    assert(ALLOWED_WEIGHT_VERDICT.test(r.weight_verdict || ''), `${r.id}: unexpected weight_verdict "${r.weight_verdict}"`);
    if (r.weight_verdict === 'not_published') {
      assert(r.stored_weight_g == null, `${r.id}: not_published but stored_weight_g=${r.stored_weight_g}`);
      assert(r.live_weight_g == null, `${r.id}: not_published but live_weight_g=${r.live_weight_g}`);
    }
    if (r.weight_verdict === 'confirmed_range') {
      assert(String(r.stored_weight_g) === String(r.live_weight_g), `${r.id}: range must match stored exactly (got ${r.stored_weight_g} vs ${r.live_weight_g})`);
      assert(/^\d+(\.\d+)?-\d+(\.\d+)?$/.test(String(r.stored_weight_g)), `${r.id}: range must be the seller's own "low-high" string`);
    } else if (/^confirmed/.test(r.weight_verdict)) {
      assert(r.stored_weight_g != null && r.live_weight_g != null, `${r.id}: confirmed weight missing a side`);
      assert(Number(r.stored_weight_g) === Number(r.live_weight_g), `${r.id}: stored weight ${r.stored_weight_g} != live ${r.live_weight_g}`);
    }
    if (r.weight_verdict.startsWith('range_labelled')) {
      assert(r.stored_weight_g == null, `${r.id}: ambiguous "Approximate Fine Weight" must keep stored weight null`);
    }
  }
  const pub = v.canonical_rows.filter((r) => /^confirmed/.test(r.weight_verdict)).length;
  assert(pub === v.coverage.canonical_weight_published_and_confirmed + (v.coverage.canonical_weight_published_range || 0), `coverage says ${v.coverage.canonical_weight_published_and_confirmed}+${v.coverage.canonical_weight_published_range || 0} published weights, ledger has ${pub}`);
});

/* V05 — market anchors carry publisher timestamps + quotes */
await gate('V05', 'Market anchors carry publisher timestamps and quotes', (assert) => {
  const g = v.market;
  assert(typeof g.gold_api.price_usd_per_ozt === 'number' && g.gold_api.price_usd_per_ozt > 0, 'gold-api price missing');
  assert(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(g.gold_api.publisher_timestamp || ''), 'gold-api publisher_timestamp missing/invalid');
  assert(g.gold_api.quote.includes(String(g.gold_api.price_usd_per_ozt)), 'gold-api quote must contain the printed price');
  assert(typeof g.comex_gc_f.regular_market_price_usd === 'number' && g.comex_gc_f.regular_market_price_usd > 0, 'COMEX price missing');
  assert(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(g.comex_gc_f.regular_market_time_utc || ''), 'COMEX timestamp missing/invalid');
  assert(g.comex_gc_f.quote.includes(String(g.comex_gc_f.regular_market_price_usd)), 'COMEX quote must contain the printed price');
  assert(typeof g.stored_canonical.price_usd_per_ozt === 'number', 'stored anchor missing');
});

/* V06 — drift disclosed with both numbers, never silently written */
await gate('V06', 'Drift disclosed with both numbers', (assert) => {
  const drifts = [...v.canonical_rows, ...v.candidate_rows].filter((r) => /^drift_/.test(r.price_verdict));
  for (const r of drifts) {
    const orig = r.live_price_original ?? r.live_price;
    assert(orig != null && r.stored_price != null, `${r.id}: drift row needs both numbers`);
    assert(Number(orig) !== Number(r.stored_price), `${r.id}: verdict says drift but numbers match`);
  }
  const v9 = v.findings.find((f) => f.id === 'V-7173133c-09');
  assert(!!v9, 'market-staleness finding V-7173133c-09 must exist');
  if (v9) {
    assert(v9.detail.includes('3996.899902') && v9.detail.includes('4060.899902'), 'V-7173133c-09 must quote both stored and live spot');
  }
  const note = JSON.stringify(v).match(/REQUESTED|requested in COORDINATION\.md §5|handoff|Handoff/gi);
  assert(!!note, 'ledger must state that corrections are handed off, not applied');
});

/* V07 — checklist page carries all 12 items + The key */
await gate('V07', 'Checklist page has 12 items and The key', (assert) => {
  const html = portalHtml.get('checklist.html');
  assert(!!html, 'portal/checklist.html missing');
  if (!html) return;
  const h3s = [...html.matchAll(/<h3>\d+\./g)];
  assert(h3s.length === 12, `expected 12 numbered checklist items, found ${h3s.length}`);
  assert(/The key/.test(html), 'checklist page must include The key principle');
  assert(/stamp by itself does not prove purity/i.test(html) || /stamp is a claim, not proof/i.test(html), 'key must state the stamp-does-not-prove-purity rule');
  assert(/https:\/\/www\.ecfr\.gov\/current\/title-16/.test(html), 'checklist must link eCFR 16 CFR Part 23');
});

/* V08 — flagged page lists every finding with a source link */
await gate('V08', 'Flagged page lists every finding with a source link', (assert) => {
  const html = portalHtml.get('flagged.html');
  assert(!!html, 'portal/flagged.html missing');
  if (!html) return;
  for (const f of v.findings) {
    assert(html.includes(`id="${f.id}"`), `flagged.html missing anchor ${f.id}`);
    assert(html.includes(f.source_url), `flagged.html missing source link for ${f.id}`);
  }
  assert(html.includes('COORDINATION.md'), 'flagged page must point at the coordination handoff');
});

/* V09 — links & placeholders */
await gate('V09', 'Internal links resolve; no placeholder text', (assert) => {
  assert(portalFiles.length >= 7, `expected >=7 portal pages, found ${portalFiles.length}`);
  for (const [name, html] of portalHtml) {
    const refs = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map((m) => m[1]);
    for (const ref of refs) {
      if (/^(https?:|mailto:|tel:|data:|#)/.test(ref)) continue;
      const clean = ref.split('#')[0].split('?')[0];
      if (!clean) continue;
      // portal lives at data/session-7173133c/portal/ → resolve relative to that dir
      const target = clean.startsWith('/')
        ? join(ROOT, clean)
        : join(PORTAL, clean);
      // ../../../ links out of the portal to repo root are allowed only if they resolve
      const resolved = existsSync(target);
      assert(resolved, `${name}: broken internal link -> ${ref}`);
    }
    assert(!/lorem ipsum|\bTODO\b|\bFIXME\b|xxxxx|coming soon/i.test(html), `${name}: placeholder text`);
  }
});

/* V10 — security: handlers, dangerous URIs, secrets, CSP */
await gate('V10', 'Security: handlers, URIs, secrets, CSP', async (assert) => {
  const inlineHandler = /\son[a-z]+="/i;
  const badProto = /(?:href|src)\s*=\s*["']\s*(?:javascript:|vbscript:|data:text\/html)/i;
  const secretRe = /\b(?:ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|sk-[A-Za-z0-9]{30,}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]{20,})\b/;
  for (const [name, html] of portalHtml) {
    assert(!inlineHandler.test(html), `${name}: inline event handler`);
    assert(!badProto.test(html), `${name}: dangerous URI scheme`);
    assert(!secretRe.test(html), `${name}: leaked credential pattern`);
    assert(/http-equiv="Content-Security-Policy"/.test(html), `${name}: CSP meta missing`);
    assert(/frame-ancestors 'none'/.test(html), `${name}: CSP must deny framing`);
  }
  for (const meta of ['COORDINATION.md']) {
    if (existsSync(join(ROOT, meta))) {
      const txt = await readText(join(ROOT, meta)).catch(() => '');
      assert(!secretRe.test(txt), `${meta}: leaked credential pattern`);
    }
  }
});

/* V11 — every target=_blank carries rel="noopener noreferrer" */
await gate('V11', 'noopener noreferrer on every external link', (assert) => {
  for (const [name, html] of portalHtml) {
    for (const m of html.matchAll(/<a\b[^>]*target="_blank"[^>]*>/gi)) {
      assert(/rel="noopener noreferrer"/.test(m[0]), `${name}: target=_blank without rel="noopener noreferrer": ${m[0].slice(0, 120)}`);
    }
  }
});

/* V12 — provenance & dates everywhere; checks.json self-consistent after write */
await gate('V12', 'Provenance, dates and session id on every page', (assert) => {
  for (const [name, html] of portalHtml) {
    assert(html.includes('2026-11-11'), `${name}: missing verification date 2026-11-11`);
    assert(html.includes('sess-7173133c') || name === 'checks.html', `${name}: missing session id`);
    assert(/No hallucinations/.test(html), `${name}: missing no-hallucinations rule`);
  }
  assert(v.meta.review_date === '2026-11-11', 'ledger review_date must be 2026-11-11');
  assert(v.meta.session === 'sess-7173133c', 'ledger session id mismatch');
});

const failureCount = results.reduce((n, r) => n + (r.pass ? 0 : 1), 0);
const checks = {
  run,
  generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
  session: 'sess-7173133c',
  task: 'T56',
  results,
  failure_count: failureCount,
};
await writeFile(join(SESSION_DIR, 'checks.json'), `${JSON.stringify(checks, null, 2)}\n`);

for (const r of results) {
  console.log(`[${r.pass ? 'PASS' : 'FAIL'}] ${r.id} ${r.name}${r.failures.length ? ' — ' + r.failures.join('; ') : ''}`);
}
console.log(`verify_7173133c: ${results.length - failureCount}/${results.length} gates passed (run #${run})`);
if (failureCount > 0) process.exit(1);
