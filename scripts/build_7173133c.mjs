#!/usr/bin/env node
/**
 * GOLD1 — sess-7173133c (T56/§29) standalone GitHub Pages portal builder.
 *
 * Reads only:
 *   data/session-7173133c/verify-7173133c.json  (this session's live 2026-11-11 evidence)
 *   data/checklist.json                         (shared, read-only)
 *   data/session-7173133c/checks.json           (optional: V01–V12 results from verify_7173133c.mjs)
 * Writes only:
 *   data/session-7173133c/portal/*.html
 *
 * No-hallucination rule: every rendered figure comes from the session JSON or is
 * arithmetic over disclosed inputs in the calculator. Nothing is inferred.
 *
 * Run: node scripts/build_7173133c.mjs
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';

const ROOT = process.cwd();
const SESSION_DIR = join(ROOT, 'data', 'session-7173133c');
const PORTAL = join(SESSION_DIR, 'portal');
const readJson = async (p) => JSON.parse(await readFile(p, 'utf8'));
const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const v = await readJson(join(SESSION_DIR, 'verify-7173133c.json'));
const checklist = await readJson(join(ROOT, 'data', 'checklist.json'));
const checksPath = join(SESSION_DIR, 'checks.json');
const checks = existsSync(checksPath) ? await readJson(checksPath) : null;

await mkdir(PORTAL, { recursive: true });

const NAV = [
  ['index.html', 'Dashboard'],
  ['rows.html', 'Rows — 71+13'],
  ['gold.html', 'Gold & Calculator'],
  ['checklist.html', 'Checklist'],
  ['sources.html', 'Sources'],
  ['flagged.html', 'Flagged for Review'],
  ['checks.html', 'Verification Checks'],
];

const CSP =
  "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";

const page = (title, active, body) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="${CSP}">
<title>${esc(title)} — GOLD (verified 2026-11-11)</title>
<style>
:root{--ink:#1b1b1f;--muted:#5b5b66;--line:#e3e1da;--bg:#faf8f4;--card:#fff;--gold:#8a6d1d;--warn:#8a2020;--ok:#1d6b3f}
*{box-sizing:border-box}
body{margin:0;font:16px/1.55 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:var(--ink);background:var(--bg)}
header{background:#141210;color:#f5efe2;border-bottom:3px solid var(--gold)}
header .wrap{max-width:1080px;margin:0 auto;padding:14px 18px;display:flex;flex-wrap:wrap;gap:12px;align-items:baseline;justify-content:space-between}
.brand{font-weight:700;letter-spacing:.04em;text-decoration:none;color:#f5efe2}
.brand span{color:#e8c766}
nav a{color:#d9d2c2;text-decoration:none;margin-right:12px;font-size:14px}
nav a.active{color:#fff;border-bottom:2px solid var(--gold);font-weight:600}
main{max-width:1080px;margin:0 auto;padding:18px}
.banner{background:#fff6dd;border:2px solid var(--gold);border-radius:8px;padding:14px 16px;margin:0 0 18px}
.banner strong{color:var(--warn)}
.banner.warn{background:#fdecec;border-color:#c46a6a}
h1{font-size:1.6rem;margin:.2em 0 .4em}
h2{font-size:1.2rem;margin:1.4em 0 .5em;border-bottom:1px solid var(--line);padding-bottom:.25em}
h3{font-size:1.02rem;margin:1em 0 .4em}
.cards{display:flex;flex-wrap:wrap;gap:12px;margin:14px 0}
.card{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:12px 16px;min-width:130px}
.card .num{font-size:1.5rem;font-weight:700;color:var(--gold)}
.card .lbl{font-size:12.5px;color:var(--muted)}
.panel{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:14px 16px;margin:14px 0}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px}
.tile{display:block;background:var(--bg);border:1px solid var(--line);border-radius:8px;padding:12px;text-decoration:none;color:var(--ink)}
.tile:hover{border-color:var(--gold)}
.tile strong{display:block;margin-bottom:4px}
.tile span{font-size:13px;color:var(--muted)}
table{border-collapse:collapse;width:100%;font-size:13.5px;background:var(--card)}
th,td{border:1px solid var(--line);padding:7px 9px;text-align:left;vertical-align:top}
th{background:#f1ede3;position:sticky;top:0}
.table-scroll{overflow:auto;max-height:70vh;border:1px solid var(--line);border-radius:8px}
.tag{display:inline-block;border-radius:99px;padding:1px 9px;font-size:12px;font-weight:600}
.ok{background:#e3f4ea;color:var(--ok)}
.drift{background:#fdecec;color:var(--warn)}
.unv{background:#fff1cf;color:#7a5b00}
.muted{color:var(--muted);font-size:13.5px}
code{background:#f1ede3;padding:1px 5px;border-radius:4px;font-size:13px}
a{color:#6b4e0e}
blockquote{margin:.4em 0;padding:.5em .8em;border-left:3px solid var(--gold);background:#fffdf5;font-size:14px}
footer{max-width:1080px;margin:24px auto 0;padding:16px 18px;border-top:1px solid var(--line);font-size:13px;color:var(--muted)}
.calc{display:flex;flex-wrap:wrap;gap:10px;align-items:end}
.calc label{display:flex;flex-direction:column;font-size:13px;gap:4px}
.calc input,.calc select{padding:7px 9px;border:1px solid var(--line);border-radius:6px;font-size:15px;background:#fff}
.calc button{padding:9px 16px;background:var(--gold);color:#fff;border:0;border-radius:6px;font-weight:600;cursor:pointer}
#meltOut{font-size:1.3rem;font-weight:700;color:var(--gold)}
ul.tight{margin:.4em 0;padding-left:1.2em}
</style>
</head>
<body>
<header><div class="wrap">
  <a class="brand" href="index.html">Au <span>GOLD · verified 2026-11-11</span></a>
  <nav>${NAV.map(([h, t]) => `<a href="${h}"${h === active ? ' class="active"' : ''}>${t}</a>`).join('')}</nav>
</div></header>
<main>
${body}
</main>
<footer>
  <p><strong>No hallucinations.</strong> Every price, weight and quote on this portal was read from the official source URL shown beside it via this session's own page-fetch channel on <strong>2026-11-11</strong> (<code>sess-7173133c</code>, task T56/§29). Anything that could not be confirmed is blank and flagged — never inferred.</p>
  <p>This is an independent research project. It is not affiliated with, endorsed by, or sponsored by any retailer or institution named here. Prices are snapshots — always re-open the official product page before buying. A stamp alone does not prove purity: get independent testing before wearing or resizing.</p>
  <p>Canonical root dashboard: <a href="../../../index.html">site root</a> · Flagged register: <a href="../../../flagged.html">root flagged.html</a> · Board: <a href="../../../COORDINATION.md">COORDINATION.md</a></p>
</footer>
</body>
</html>`;

/* ------------------------------------------------------------------ index */
{
  const c = v.counts || v.meta.counts;
  const findings = v.findings;
  const body = `
<div class="banner"><strong>No hallucinations — the rule this whole portal runs on.</strong>
Every number, quote and link below was read from the official source URL printed next to it on <strong>2026-11-11</strong> through this session's own fetch channel. A value that could not be confirmed from an official source is <strong>left blank and flagged</strong> — never estimated, never inferred, never copied from a third party. When you verify anything here, come back to this rule: if it has no official link and no verbatim quote, do not trust it. We recommend looking for hallucinations after every pass — the machine gate is <a href="checks.html">V01–V12</a>.</div>

<h1>Solid-gold buying dashboard — live verification pass 2026-11-11</h1>
<p class="muted">Independent line-by-line re-verification of the 71-row canonical catalogue plus the 13 research candidates, against live official seller pages, market feeds and federal standards. Session <code>sess-7173133c</code> (T56, board §29).</p>

<div class="cards">
  <div class="card"><div class="num">${c.canonical_rows_audited}</div><div class="lbl">Canonical rows re-read live</div></div>
  <div class="card"><div class="num">${c.candidate_rows_audited}</div><div class="lbl">Research candidates re-read</div></div>
  <div class="card"><div class="num">${v.coverage.canonical_weight_published_and_confirmed + v.coverage.canonical_weight_published_range}/71</div><div class="lbl">Gram weights published (24 exact + 1 range)</div></div>
  <div class="card"><div class="num">${v.coverage.candidates_confirmed_exactly}/13</div><div class="lbl">Candidates confirmed exactly</div></div>
  <div class="card"><div class="num">${findings.length}</div><div class="lbl">New findings → <a href="flagged.html">Flagged</a></div></div>
  <div class="card"><div class="num small">${v.market.gold_api.price_usd_per_ozt.toFixed(2)}</div><div class="lbl">Gold USD/oz · ${v.market.gold_api.publisher_timestamp} · <a href="gold.html">source</a></div></div>
</div>

<section class="panel">
<h2>The key (from the official rules)</h2>
<p>A <strong>14K or 18K stamp by itself does not prove purity</strong>. The safe pattern: reputable seller + correct markings (karat + maker's mark) + price consistent with weight × karat × spot + independent testing after delivery. Walk away if verification or a return is refused.</p>
<p class="muted">Anchored live on 2026-11-11 to <a href="https://www.ecfr.gov/current/title-16/chapter-I/subchapter-B/part-23" target="_blank" rel="noopener noreferrer">16 CFR Part 23 (FTC Jewelry Guides)</a>, <a href="https://www.govinfo.gov/content/pkg/USCODE-2023-title15/html/USCODE-2023-title15-chap8.htm" target="_blank" rel="noopener noreferrer">15 U.S.C. ch. 8 (Stamping Act, §295 tolerance)</a>, and GIA's 2024/2025 Lab Notes showing how hallmarks and XRF can both be fooled — full quotes on <a href="sources.html">Sources</a>.</p>
</section>

<section class="panel">
<h2>Browse</h2>
<div class="grid">
  <a class="tile" href="rows.html"><strong>All 84 audited rows</strong><span>71 canonical + 13 candidates, every figure with its official link</span></a>
  <a class="tile" href="gold.html"><strong>Gold price &amp; calculator</strong><span>live spot, COMEX corroboration, grams × karat melt math</span></a>
  <a class="tile" href="checklist.html"><strong>12-point checklist</strong><span>the buying rules, each with official sources</span></a>
  <a class="tile" href="sources.html"><strong>Sources</strong><span>market, regulatory and seller links with verbatim quotes</span></a>
  <a class="tile" href="flagged.html"><strong>Flagged for Review (${findings.length})</strong><span>drift, unverified blanks and policy traps — with source links</span></a>
  <a class="tile" href="checks.html"><strong>V01–V12 gate</strong><span>anti-hallucination &amp; security checks run after every pass</span></a>
</div>
</section>

<section class="panel">
<h2>What changed vs the stored catalogue (2026-10-23)</h2>
<ul class="tight">
${findings
  .slice(0, 6)
  .map((f) => `<li><strong>${esc(f.id)}</strong> — ${esc(f.title)} <a href="flagged.html#${esc(f.id)}">details</a></li>`)
  .join('\n')}
</ul>
<p class="muted">All ${findings.length} findings are published on <a href="flagged.html">Flagged for Review</a> with source links; corrections to shared files are requested through the coordination board, never made silently.</p>
</section>
`;
  await writeFile(join(PORTAL, 'index.html'), page('Dashboard', 'index.html', body));
}

/* ------------------------------------------------------------------- rows */
{
  const rowTag = (verdict) => {
    if (/confirmed/.test(verdict)) return `<span class="tag ok">confirmed</span>`;
    if (/drift|reproducible|redirect/.test(verdict)) return `<span class="tag drift">${esc(verdict.replace(/_/g, ' '))}</span>`;
    return `<span class="tag unv">${esc(verdict.replace(/_/g, ' '))}</span>`;
  };
  const render = (rows, kind) => `
<div class="table-scroll"><table>
<thead><tr><th>ID</th><th>Seller</th><th>Stored price (USD)</th><th>Live price 2026-11-11</th><th>Price verdict</th><th>Stored wt (g)</th><th>Live weight</th><th>Verbatim quote (excerpt)</th><th>Official source</th></tr></thead>
<tbody>
${rows
  .map(
    (r) => `<tr id="${esc(r.id)}">
<td><code>${esc(r.id)}</code></td>
<td>${esc(r.retailer || r.seller)}</td>
<td>${r.stored_price == null ? '<em>blank</em>' : esc(r.stored_price)}</td>
<td>${r.live_price_current ?? r.live_price ?? '<em>blank</em>'}${r.live_price_original != null && r.live_price_original !== (r.live_price_current ?? r.live_price) ? ` <span class="muted">(orig ${esc(r.live_price_original)})</span>` : ''}</td>
<td>${rowTag(r.price_verdict)}</td>
<td>${r.stored_weight_g ?? '<em>blank</em>'}</td>
<td>${r.live_weight_g ?? '<em>blank</em>'}</td>
<td>${esc(r.quote)}</td>
<td><a href="${esc(r.source_url)}" target="_blank" rel="noopener noreferrer">official page</a></td>
</tr>`
  )
  .join('\n')}
</tbody></table></div>`;

  const body = `
<div class="banner"><strong>No hallucinations.</strong> Every cell below was read from the linked official page on <strong>2026-11-11</strong>. Blank means the seller does not publish it — never guessed. <em>Live price</em> is what the seller printed at fetch time; <em>stored price</em> is the canonical catalogue value. Where they differ, both are shown and the row is flagged.</div>
<h1>Row-by-row audit — ${v.canonical_rows.length} canonical + ${v.candidate_rows.length} candidates</h1>
<p class="muted">Weights: ${v.coverage.canonical_weight_published_and_confirmed}/71 canonical rows publish grams confirmed identical to the live page, plus 1 size-range row (au-cigar, seller's own "2.6-4g"); ${v.coverage.canonical_weight_not_published} publish none (flag F02 persists). Auvere's four size-dependent ranges stay blank because the PDP says "Approximate Fine Weight" without stating gross-vs-fine (F54).</p>
<h2>Canonical catalogue (data/rings.json — read-only here)</h2>
${render(v.canonical_rows, 'canonical')}
<h2>Research candidates (research/candidates.json)</h2>
${render(v.candidate_rows, 'candidate')}
<p class="muted">Candidate drift: ${v.coverage.candidates_drifted} of 13 (trax-71345 $2,500 → $2,600). Everything else reproduced exactly.</p>
`;
  await writeFile(join(PORTAL, 'rows.html'), page('Rows', 'rows.html', body));
}

/* ------------------------------------------------------------------- gold */
{
  const g = v.market;
  const body = `
<div class="banner"><strong>No hallucinations.</strong> Both readings below are verbatim from the linked feeds on <strong>2026-11-11</strong>. The calculator does arithmetic only — you can re-check every input yourself.</div>
<h1>Gold price &amp; melt calculator</h1>

<section class="panel">
<h2>Live readings (2026-11-11)</h2>
<table>
<tr><th>Channel</th><th>Reading</th><th>Publisher timestamp</th><th>Verbatim quote</th><th>Source</th></tr>
<tr><td>gold-api XAU</td><td><strong>${g.gold_api.price_usd_per_ozt} USD/ozt</strong></td><td>${esc(g.gold_api.publisher_timestamp)}</td><td><code>${esc(g.gold_api.quote.slice(0, 180))}…</code></td><td><a href="${esc(g.gold_api.url)}" target="_blank" rel="noopener noreferrer">api.gold-api.com</a></td></tr>
<tr><td>COMEX GC=F (Gold Dec 26)</td><td><strong>${g.comex_gc_f.regular_market_price_usd} USD</strong> (day ${g.comex_gc_f.day_low_usd}–${g.comex_gc_f.day_high_usd}, prev close ${g.comex_gc_f.previous_close_usd})</td><td>${esc(g.comex_gc_f.regular_market_time_utc)}</td><td><code>${esc(g.comex_gc_f.quote.slice(0, 180))}…</code></td><td><a href="${esc(g.comex_gc_f.url)}" target="_blank" rel="noopener noreferrer">Yahoo Finance chart API</a></td></tr>
<tr><td>Stored canonical anchor (read-only)</td><td>${g.stored_canonical.price_usd_per_ozt} USD/ozt</td><td>${esc(g.stored_canonical.publisher_timestamp)}</td><td>Drift vs live: <strong>+${g.stored_canonical.drift_vs_2026_11_11.delta_usd} USD (+${g.stored_canonical.drift_vs_2026_11_11.delta_percent}%)</strong> — ${esc(g.stored_canonical.drift_vs_2026_11_11.note)}</td><td><a href="flagged.html#V-7173133c-09">finding V-7173133c-09</a></td></tr>
</table>
</section>

<section class="panel">
<h2>Melt calculator (arithmetic over the inputs you see)</h2>
<p class="muted">gold value (USD) = weight (g) × purity × spot (USD/ozt) ÷ 31.1034768. The divisor is the NIST-published troy ounce gram figure ("31.103 476 8", quoted on <a href="sources.html">Sources</a>). Purity uses the exact karat fraction (karat ÷ 24); NIST's chart notes a 24K mark means 99.9% pure. This ignores alloy/side stones, labor, retail markup — it is the raw gold number only.</p>
<div class="calc">
  <label>Weight (g) <input id="wIn" type="number" min="0" step="0.01" value="5.4"></label>
  <label>Karat <select id="kIn"><option>10</option><option selected>14</option><option>18</option><option>22</option><option>24</option></select></label>
  <label>Spot USD/ozt <input id="sIn" type="number" min="0" step="0.01" value="${g.gold_api.price_usd_per_ozt}"></label>
  <button type="button" id="calcBtn">Compute</button>
  <div><span id="meltOut">—</span><div class="muted" id="meltNote"></div></div>
</div>
<p class="muted">Prefilled weight 5.4 g = ag-14k-radiant-3ct's official "Item Weight Approximately 5.4g" quote (<a href="rows.html#ag-14k-radiant-3ct">row</a>); spot prefilled from the live gold-api read above.</p>
</section>

<section class="panel">
<h2>How the checklist uses this</h2>
<p>Price ÷ raw-gold-value tells you how much of the price is metal vs craft/stones — an absurd ratio (price ≪ melt, or price many× melt without disclosure) is a walk-away signal. Compare on <a href="checklist.html">Checklist item 6</a>.</p>
</section>
<script>
function calc(){
  var w=parseFloat(document.getElementById('wIn').value);
  var k=parseInt(document.getElementById('kIn').value,10);
  var s=parseFloat(document.getElementById('sIn').value);
  if(!(w>0)||!(s>0)||!(k>0)){document.getElementById('meltOut').textContent='—';return;}
  var purity=k/24;
  var melt=w*purity*s/31.1034768;
  document.getElementById('meltOut').textContent='$'+melt.toFixed(2);
  document.getElementById('meltNote').textContent=w+' g × ('+k+'/24='+purity.toFixed(4)+') × '+s+' ÷ 31.1034768';
}
document.getElementById('calcBtn').addEventListener('click', calc);
['wIn','kIn','sIn'].forEach(function(id){document.getElementById(id).addEventListener('input', calc);});
calc();
</script>
`;
  await writeFile(join(PORTAL, 'gold.html'), page('Gold & Calculator', 'gold.html', body));
}

/* -------------------------------------------------------------- checklist */
{
  const internal = { 'rings.html': 'rows.html', 'flagged.html': 'flagged.html', 'calculator.html': 'gold.html', 'prices.html': 'gold.html', 'index.html': 'index.html', 'sources.html': 'sources.html', 'current-review.html': 'rows.html', 'weights.html': 'gold.html', 'recheck.html': 'checks.html', 'requirements.html': 'checklist.html', 'methodology.html': 'sources.html', 'checks.html': 'checks.html', 'checklist.html': 'checklist.html' };
  const resolve = (url) => {
    if (/^https?:/.test(url)) return { href: url, ext: true };
    const base = url.split('#')[0];
    if (internal[base]) return { href: internal[base] + (url.includes('#') ? '#' + url.split('#')[1] : ''), ext: false };
    // fall back to the repository root three levels up, if the page exists there
    const atRoot = join(ROOT, base);
    if (base.endsWith('.html') && existsSync(atRoot)) return { href: '../../../' + base + (url.includes('#') ? '#' + url.split('#')[1] : ''), ext: false };
    return { href: null, ext: false }; // unresolvable → render as plain text, never as a broken link
  };
  const items = checklist.items
    .map((it, i) => {
      const links = (it.links || [])
        .map((l) => {
          const r = resolve(l.url);
          if (!r.href) return `${esc(l.label)} <span class="muted">(repo page not present — text only)</span>`;
          return `<a href="${esc(r.href)}"${r.ext ? ' target="_blank" rel="noopener noreferrer"' : ''}>${esc(l.label)}</a>`;
        })
        .join(' · ');
      return `<section class="panel">
<h3>${i + 1}. ${esc(it.requirement)}</h3>
<p><span class="tag ${it.status === 'verified' ? 'ok' : 'unv'}">${esc(it.status)}</span> ${esc(it.finding)}</p>
<p class="muted"><strong>How verified:</strong> ${esc(it.how)}</p>
<p class="muted"><strong>Your action:</strong> ${esc(it.buyer_action)}</p>
<p class="muted"><strong>Sources:</strong> ${links}</p>
</section>`;
    })
    .join('\n');
  const body = `
<div class="banner"><strong>No hallucinations.</strong> Each item below carries its official source links; the "finding" text comes from the shared checklist dataset, re-checked against live standards pages on 2026-11-11 (<a href="sources.html">quotes</a>).</div>
<h1>The 12-point solid-gold buying checklist</h1>
${items}
<section class="panel">
<h3>The key</h3>
<p>A stamp is a claim, not proof. Reputable seller + correct markings (karat + maker's mark) + price consistent with weight × karat × spot + independent testing after delivery — and walk away if verification or a return is refused.</p>
</section>
`;
  await writeFile(join(PORTAL, 'checklist.html'), page('Checklist', 'checklist.html', body));
}

/* ---------------------------------------------------------------- sources */
{
  const std = v.standards
    .map(
      (s) => `<tr><td>${esc(s.id)}</td><td><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title)}</a></td><td>${esc(s.fetched)}</td><td><blockquote>${esc(s.quote)}</blockquote></td><td><span class="tag ok">${esc(s.verdict)}</span></td></tr>`
    )
    .join('\n');
  const body = `
<div class="banner"><strong>No hallucinations.</strong> Every quote below is verbatim from the linked official page, fetched <strong>2026-11-11</strong> through this session's own channel.</div>
<h1>Sources &amp; verbatim quotes</h1>

<section class="panel">
<h2>Market channels</h2>
<ul class="tight">
<li><a href="${esc(v.market.gold_api.url)}" target="_blank" rel="noopener noreferrer">https://api.gold-api.com/price/XAU</a> — ${v.market.gold_api.price_usd_per_ozt} USD/ozt @ ${esc(v.market.gold_api.publisher_timestamp)} (quote on <a href="gold.html">Gold</a>).</li>
<li><a href="${esc(v.market.comex_gc_f.url)}" target="_blank" rel="noopener noreferrer">Yahoo Finance chart API GC=F</a> — ${v.market.comex_gc_f.regular_market_price_usd} USD @ ${esc(v.market.comex_gc_f.regular_market_time_utc)} (COMEX, contract Gold Dec 26).</li>
</ul>
</section>

<section class="panel">
<h2>Regulatory &amp; gemological standards</h2>
<div class="table-scroll"><table>
<tr><th>ID</th><th>Source</th><th>Fetched</th><th>Verbatim quote</th><th>Verdict</th></tr>
${std}
</table></div>
</section>

<section class="panel">
<h2>Seller pages</h2>
<p class="muted">Every seller URL lives on the row it supports — see the <a href="rows.html">rows table</a> (each row links its own official product page). Canonical source inventory: <code>data/sources.json</code> in the repository.</p>
</section>
`;
  await writeFile(join(PORTAL, 'sources.html'), page('Sources', 'sources.html', body));
}

/* ---------------------------------------------------------------- flagged */
{
  const body = `
<div class="banner warn"><strong>No hallucinations.</strong> Nothing on this page was corrected in the shared datasets — every finding is a REQUEST to the owning session, logged in COORDINATION.md §5. Unverified values stay blank.</div>
<h1>Flagged for Review — 2026-11-11 pass</h1>
<p class="muted">${v.findings.length} new findings from this session's live re-read, plus the canonical register (F01–F68) on the <a href="../../../flagged.html">root flagged page</a>.</p>
${v.findings
  .map(
    (f) => `<section class="panel" id="${esc(f.id)}">
<h3><span class="tag ${f.severity === 'high' ? 'drift' : 'unv'}">${esc(f.severity)}</span> ${esc(f.id)} — ${esc(f.title)}</h3>
<p>${esc(f.detail)}</p>
<p class="muted">Affected: ${(f.affected || []).map(esc).join(', ') || '—'} · Source: <a href="${esc(f.source_url)}" target="_blank" rel="noopener noreferrer">${esc(f.source_url)}</a></p>
</section>`
  )
  .join('\n')}
<section class="panel">
<h3>Carried-over limits (still true)</h3>
<ul class="tight">
<li>${v.limits.map(esc).join('</li><li>')}</li>
</ul>
</section>
`;
  await writeFile(join(PORTAL, 'flagged.html'), page('Flagged for Review', 'flagged.html', body));
}

/* ----------------------------------------------------------------- checks */
{
  const groups = [
    ['V01', 'No-hallucination banner in top summary', 'index.html must open with the No-hallucinations rule above all content.'],
    ['V02', 'Every canonical row has an official https source URL', 'All 71 rows in data/session-7173133c/verify-7173133c.json carry source_url.'],
    ['V03', 'Every canonical price is live-confirmed or explicitly drift-flagged', 'price_verdict ∈ allowed set; drift rows appear in findings.'],
    ['V04', 'No weight invented', 'weight_verdict confirmed* or not_published/labelled; published weights equal stored weights; blank stays blank.'],
    ['V05', 'Market anchors carry publisher timestamps', 'gold-api and COMEX readings both have publisher timestamps and verbatim quotes.'],
    ['V06', 'Drift is disclosed, never silently written', 'Stored-vs-live mismatches appear in findings[] with both numbers.'],
    ['V07', 'Checklist page carries all 12 items + The key', 'checklist.html renders 12 sections and the key principle.'],
    ['V08', 'Flagged page lists every finding with a source link', 'flagged.html anchors V-7173133c-01..N, each with source_url.'],
    ['V09', 'Links & placeholders', 'No broken internal hrefs in portal HTML; no placeholder markers of any kind.'],
    ['V10', 'Security: inline handlers, dangerous URIs, secrets, CSP', 'No on*= handlers, no javascript:/vbscript:/data:text-html hrefs, no credential patterns, CSP meta present on every page.'],
    ['V11', 'noopener noreferrer on every target=_blank', 'Every external link carries rel="noopener noreferrer".'],
    ['V12', 'Provenance & dates everywhere', 'Portal pages carry the 2026-11-11 date, session id, and per-row fetch quotes; checks.json failure_count === 0 after run.'],
  ];
  const resultsHtml = checks
    ? `<div class="table-scroll"><table><tr><th>Gate</th><th>Name</th><th>Result</th></tr>${(checks.results || [])
        .map((r) => `<tr id="${esc(r.id)}"><td>${esc(r.id)}</td><td>${esc(r.name)}</td><td><span class="tag ${r.pass ? 'ok' : 'drift'}">${r.pass ? 'PASS' : 'FAIL'}</span>${r.failures?.length ? ` — ${esc(r.failures.join('; '))}` : ''}</td></tr>`)
        .join('')}</table></div>
<p class="muted">Run #${checks.run ?? '?'} at ${esc(checks.generated_at || '—')} · failure count <strong>${checks.failure_count}</strong> · written by <code>scripts/verify_7173133c.mjs</code>.</p>`
    : `<p class="muted">No run recorded yet. Run <code>node scripts/verify_7173133c.mjs</code> (it writes <code>data/session-7173133c/checks.json</code>), then re-run this builder to render results.</p>`;
  const body = `
<div class="banner"><strong>No hallucinations.</strong> These gates are the machine half of the rule; the human half is re-reading every quote on <a href="sources.html">Sources</a>. Security and anti-hallucination checks run after every review pass.</div>
<h1>Verification checks — V01–V12</h1>
<section class="panel">
<h2>Gate definitions</h2>
<div class="table-scroll"><table>
<tr><th>ID</th><th>Name</th><th>What it enforces</th></tr>
${groups.map(([id, name, desc]) => `<tr><td>${id}</td><td>${esc(name)}</td><td>${esc(desc)}</td></tr>`).join('\n')}
</table></div>
</section>
<section class="panel">
<h2>Last run</h2>
${resultsHtml}
</section>
<section class="panel">
<h2>Companion repository gate</h2>
<p class="muted">The repo-wide CI (<code>.github/workflows/integrity.yml</code>) runs <code>npm ci --ignore-scripts &amp;&amp; npm run check &amp;&amp; npm test &amp;&amp; npm audit --audit-level=high</code> on every PR and push to main; this portal's verifier and tests are exercised in this session's PR run and by <code>tests/verify-7173133c.test.mjs</code>.</p>
</section>
`;
  await writeFile(join(PORTAL, 'checks.html'), page('Verification Checks', 'checks.html', body));
}

console.log(`build_7173133c: wrote 7 pages to data/session-7173133c/portal/ (canonical=${v.canonical_rows.length}, candidates=${v.candidate_rows.length}, findings=${v.findings.length}, checks=${checks ? 'rendered' : 'pending'})`);
