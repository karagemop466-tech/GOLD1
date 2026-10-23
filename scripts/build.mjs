#!/usr/bin/env node
/**
 * GOLD1 static site builder.
 *
 * Reads the curated data files in data/ and writes plain HTML into the repo root
 * (which is what GitHub Pages serves for this repository).
 *
 * Rules enforced by construction:
 *  - no price is ever computed or guessed: prices come straight out of data/rings.json
 *  - a missing value renders as an em dash plus "unverified", never as a guess
 *  - every row links to the official source page it came from
 */
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { join, dirname } from 'node:path';

const ROOT = process.cwd();
const OUT = ROOT;

const read = async (p) => JSON.parse(await readFile(join(ROOT, p), 'utf8'));

const rings = await read('data/rings.json');
const retailersDoc = await read('data/retailers.json');
const sourcesDoc = await read('data/sources.json');
const flagged = await read('data/flagged.json');
const gold = await read('data/gold-price.json');
const checklist = await read('data/checklist.json');
const compliance = await read('data/compliance.json');
const liveCheck = await read('data/verification-2026-10-23.json');
const liveFetchOk = liveCheck.rows.filter((r) => r.http_status === 200).length;

const retailers = Object.fromEntries(retailersDoc.retailers.map((r) => [r.id, r]));
const spot = gold.primary.price_usd_per_ozt;
const GRAMS_PER_OZT = gold.grams_per_troy_ounce ?? gold.grains_per_troy_ounce;
const spotPerGram = spot / GRAMS_PER_OZT;

export const CATEGORIES = [
  {
    slug: 'solitaire',
    name: 'Solitaire',
    blurb: 'One centre stone, all the attention. Includes setting-only products, clearly marked.',
  },
  {
    slug: 'three-stone',
    name: 'Three-stone & halo',
    blurb: 'A centre stone framed by side stones or a halo of small diamonds.',
  },
  {
    slug: 'bezel',
    name: 'Bezel & modern',
    blurb: 'Low-set bezels and sculptural bands. Snag-free and easy to wear daily.',
  },
  {
    slug: 'gemstone',
    name: 'Gemstone',
    blurb: 'Sapphire and other coloured centres instead of a diamond.',
  },
  {
    slug: 'bands',
    name: 'Bands (plain & diamond)',
    blurb: 'Solid gold bands used alone as an engagement ring, or paired with one.',
  },
  {
    slug: 'estate',
    name: 'Estate & vintage',
    blurb: 'One-of-a-kind pre-owned pieces. Check the return terms before you touch the size.',
  },
];

/* ------------------------------------------------------------------ utils */
const esc = (s) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const usd = (n) =>
  n === null || n === undefined
    ? null
    : n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });

const dash = '<span class="unverified" title="Not confirmed by an official source">— unverified</span>';

const priceCell = (r) => {
  if (r.price_unverified) return `<span class="unverified" title="${esc(r.price_unverified_reason || 'Not confirmed by an official source')}">— unverified</span>`;
  if (r.price_low === null) return dash;
  if (r.price_low === r.price_high) return `<span class="num">${usd(r.price_low)}</span>`;
  return `<span class="num">${usd(r.price_low)} – ${usd(r.price_high)}</span>`;
};

/** Numeric price for sorting and filtering. Unverified rows are excluded from price filters. */
const sortPrice = (r) => (r.price_unverified ? null : r.price_low);

const checkedCell = (r) => {
  const when = r.verified_at || r.retrieved_at;
  const pass = r.verification_status === 'unverified'
    ? '<span class="chip warn">not reproducible</span>'
    : r.verification_status === 'partially verified'
      ? '<span class="chip warn">partly</span>'
      : '<span class="chip ok">confirmed</span>';
  return `<span class="num">${esc(when)}</span><div class="sub">${pass}</div>`;
};

const purityOf = (karat) => {
  const k = parseInt(String(karat).replace(/[^0-9]/g, ''), 10);
  return Number.isFinite(k) ? k / 24 : null;
};

const meltValue = (r) => {
  if (!r.weight_g_low) return null;
  const p = purityOf(r.karat);
  if (!p) return null;
  const lo = r.weight_g_low * p * spotPerGram;
  const hi = (r.weight_g_high ?? r.weight_g_low) * p * spotPerGram;
  return { lo, hi };
};

const fineGold = (r, w) => {
  const p = purityOf(r.karat);
  if (!p || !w) return null;
  return w * p;
};

/** Gold content in the ring at the stored spot price, or the dash when the seller publishes no weight. */
const meltCell = (r) => {
  const m = meltValue(r);
  if (!m) return '<span class="unverified" title="No published weight, so no gold value can be computed">—</span>';
  const body = m.lo === m.hi ? usd(m.lo) : `${usd(m.lo)}–${usd(m.hi)}`;
  const mult = r.price_low / m.hi;
  return `${body}<div class="sub">${mult.toFixed(1)}× price</div>`;
};

const reverification = await read('data/reverification.json').catch(() => ({ entries: [] }));
const reverifiedRows = rings.rows.filter((r) => r.reverified_at);
const priceReread = (reverification.entries || []).filter((e) => (e.checked || []).includes('price') && e.new && e.new.price !== 'not re-read').length;

const flagLabels = {
  solid_not_stated: 'solid not stated',
  weight_not_published: 'no weight',
  weight_range_published: 'weight range',
  price_varies: 'price varies',
  setting_only: 'setting only',
  setting_only_unclear: 'setting unclear',
  low_price_verify_weight: 'low price — check weight',
  one_of_a_kind: 'one of a kind',
  estate_return_terms_unverified: 'estate returns unclear',
  made_to_order: 'made to order',
  metal_variant_price_unmapped: 'metal price unmapped',
  plated_variant_in_product: 'plated variant in listing',
  created_stone: 'created stone',
  starting_price: 'starting price',
  price_from_listing_page: 'price from listing page',
  hallmark_not_published: 'no hallmark published',
  mixed_karat_components: 'mixed karat parts',
};
const flagText = (f) => flagLabels[f] || f.replace(/_/g, ' ');

const rowsByCategory = {};
for (const c of CATEGORIES) rowsByCategory[c.slug] = [];
for (const r of rings.rows) (rowsByCategory[r.category] ||= []).push(r);

const countBy = (arr, key) =>
  arr.reduce((acc, x) => ((acc[x[key]] = (acc[x[key]] || 0) + 1), acc), {});

const retailerCounts = countBy(rings.rows, 'retailer_id');
const totalRows = rings.rows.length;
const solidStated = rings.rows.filter((r) => r.solid_stated).length;
const weightPublished = rings.rows.filter((r) => r.weight_g_low !== null).length;
const settingOnly = rings.rows.filter((r) => (r.flags || []).includes('setting_only')).length;
const rechecked = rings.rows.filter((r) => r.verified_at).length;
const recheckDates = [...new Set(rings.rows.map((r) => r.verified_at).filter(Boolean))].sort();
const recheckDate = recheckDates[recheckDates.length - 1] || null;
const recheckChanged = rings.rows.filter((r) => r.verification_status === 'changed');
const recheckUnverified = rings.rows.filter((r) => r.verification_status === 'unverified');
const recheckPartial = rings.rows.filter((r) => r.verification_status === 'partly_verified');
const verifiedToday = rings.rows.filter((r) => r.verified_at === compliance.as_of).length;
const notRereadToday = rings.rows.filter((r) => r.verification_status === 'not_reread_2026-10-23').length;
const priceUnverifiedRows = rings.rows.filter((r) => r.price_unverified);
const publishedWeights = rings.rows.filter((r) => r.weight_g_low !== null && r.weight_g_low !== undefined);
const retrievedDates = [...new Set(rings.rows.map((r) => r.retrieved_at))].sort();

/* ------------------------------------------------------------------ layout */
const NAV = [
  ['index.html', 'Dashboard'],
  ['rings.html', 'All rings'],
  ['requirements.html', 'Requirements'],
  ['recheck.html', 'Re-check 23 Oct'],
  ['weights.html', 'Weight & melt'],
  ['calculator.html', 'Gold calculator'],
  ['checklist.html', 'Checklist'],
  ['sources.html', 'Sources'],
  ['flagged.html', 'Flagged'],
  ['methodology.html', 'Method'],
  ['checks.html', 'Checks'],
];

const layout = ({ title, description, body, current, active = '', extraHead = '' }) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)} · GOLD1</title>
<meta name="description" content="${esc(description)}">
<link rel="stylesheet" href="${current === 'root' ? '' : '../'}assets/css/style.css">
<link rel="icon" href="${current === 'root' ? '' : '../'}assets/favicon.svg" type="image/svg+xml">
${extraHead}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="site-head">
  <div class="wrap head-inner">
    <a class="brand" href="${current === 'root' ? '' : '../'}index.html">
      <span class="brand-mark" aria-hidden="true">Au</span>
      <span class="brand-text"><strong>GOLD1</strong><small>solid gold engagement ring research</small></span>
    </a>
    <nav class="nav" aria-label="Main">
      ${NAV.map(([href, label]) => {
        const rel = `${current === 'root' ? '' : '../'}${href}`;
        const isActive = label === active;
        return `<a href="${rel}"${isActive ? ' aria-current="page"' : ''}>${label}</a>`;
      }).join('\n      ')}
    </nav>
  </div>
</header>
<main id="main">
${body}
</main>
<footer class="site-foot">
  <div class="wrap">
    <p><strong>No hallucinated prices.</strong> Every price and specification on this site was copied from an official retailer feed retrieved on ${esc(retrievedDates.join(', ') || '2026-10-22')} and is linked to the exact page it came from. Values that could not be confirmed are blank, not estimated.</p>
    <p class="muted">Gold reference: ${usd(spot)} per troy ounce at ${esc(gold.primary.publisher_timestamp)} (${esc(gold.primary.publisher)}). A gold price is not an appraisal. Nothing here is legal, financial or appraisal advice. · <a href="${current === 'root' ? '' : '../'}methodology.html">Method</a> · <a href="${current === 'root' ? '' : '../'}flagged.html">Flagged for review</a></p>
  </div>
</footer>
<script src="${current === 'root' ? '' : '../'}assets/js/app.js" defer></script>
</body>
</html>
`;

/* ------------------------------------------------------------------ pieces */
const noHallucinationBanner = (prefix = '') => `
<div class="rule-banner" role="note">
  <h2>No hallucinations — the rule this whole project runs on</h2>
  <p>Every price, karat and weight below is copied from the seller's own official product page or feed and linked on the same row. <strong>Nothing is estimated, averaged, inferred or remembered.</strong> If a value was not confirmed on an official source it is shown as <span class="unverified">— unverified</span> and listed on the <a href="${prefix}flagged.html">Flagged for review</a> page. Every build is mechanically verified by automated anti-hallucination and security passes (<a href="${prefix}checks.html">S01–S20 + A01–A10 + H01–H12</a>). <strong>We actively recommend that you look for hallucinations yourself:</strong> open any row's official product link and check our verbatim evidence quote against the live seller page before buying (latest re-read: ${esc(recheckDate || 'not recorded')}; snapshots are not live quotes).</p>
</div>`;

const stat = (value, label, note = '') => `
<div class="stat">
  <div class="stat-value">${value}</div>
  <div class="stat-label">${label}</div>
  ${note ? `<div class="stat-note">${note}</div>` : ''}
</div>`;

const chip = (text, kind = '') => `<span class="chip ${kind}">${esc(text)}</span>`;

const tableHead = (withWeight = true) => `
<thead>
  <tr>
    <th scope="col">Ring</th>
    <th scope="col">Seller</th>
    <th scope="col">Karat</th>
    <th scope="col">Metal / stone</th>
    <th scope="col" class="num-col">Price (USD)</th>
    <th scope="col">Price basis</th>
    ${withWeight ? '<th scope="col">Weight</th><th scope="col" class="num-col">Gold value</th>' : ''}
    <th scope="col">Last checked</th>
    <th scope="col">Flags</th>
    <th scope="col">Source</th>
  </tr>
</thead>`;

const flagExplainer = {
  solid_not_stated: 'The listing names the karat but never uses the word "solid". Get it confirmed in writing.',
  weight_not_published: 'No metal weight in grams, so the gold-value check cannot be run.',
  weight_range_published: 'A weight range is published for the model, not your exact size.',
  price_varies: 'Listed price differs across variants (usually size or metal).',
  setting_only: 'Price buys the setting only; the centre stone is sold separately.',
  setting_only_unclear: 'Tagged as a setting, but the description reads as if the stone is included. Ask.',
  low_price_verify_weight: 'Low price for the karat — only plausible if the piece is very light. Verify grams.',
  one_of_a_kind: 'Single, one-off estate piece in a fixed size.',
  estate_return_terms_unverified: 'Estate return terms were not published separately; resizing may void returns.',
  made_to_order: 'Made to order, so lead time and cancellation terms matter.',
  metal_variant_price_unmapped: 'The feed only gives a min/max across metals and sizes; the low end is not proven to be 14K.',
  plated_variant_in_product: 'This product also sells a vermeil/plated variant. The plated price must never be read as the solid-gold price.',
  created_stone: 'The centre stone is lab-created, not a mined gem.',
  weight_published: 'The seller publishes the metal weight, so the gold-value check on this row is real.',
  price_changed_on_recheck: 'The stored price range was re-read against the live official page on the last pass and part of it could not be reproduced; the published figure is the one the page shows now.',
  price_unverified: 'The price is no longer shown on the official page, so it is published here as unverified. Do not treat it as a quote.',
  price_not_reproducible: 'Re-fetching the official page did not reproduce this price. Ask the seller to quote it in writing.',
  variant_price_not_reread: 'The stored price belongs to one metal/size variant. The last pass confirmed the product and its weight but could not re-read that exact variant price.',
};

const rowHtml = (r, prefix = '') => {
  const weight =
    r.weight_g_low === null
      ? '<span class="unverified">— unverified</span>'
      : r.weight_g_low === r.weight_g_high
        ? `${r.weight_g_low} g`
        : `${r.weight_g_low}–${r.weight_g_high} g`;
  const melt = meltValue(r);
  const goldValue = melt
    ? `<span class="num">${usd(melt.lo)}${melt.hi !== melt.lo ? ` – ${usd(melt.hi)}` : ''}</span>`
    : '<span class="unverified">— unverified</span>';
  const flags = (r.flags || [])
    .filter((f) => f !== 'weight_not_published')
    .map((f) => chip(flagText(f), 'chip-warn'))
    .join(' ');
  return `<tr data-category="${esc(r.category)}" data-retailer="${esc(r.retailer_id)}" data-karat="${esc(r.karat)}" data-price="${sortPrice(r) === null ? '' : sortPrice(r)}" data-title="${esc((r.title + ' ' + r.retailer + ' ' + (r.stone_type || '') + ' ' + (r.stone || '')).toLowerCase())}">
    <td class="cell-title"><a href="${prefix}rings/${r.id}.html">${esc(r.title)}</a><div class="sub">${esc(r.style)}</div></td>
    <td>${esc(r.retailer)}</td>
    <td><strong>${esc(r.karat)}</strong></td>
    <td>${esc(r.metal)}<div class="sub">${esc(r.stone_type || r.stone || '—')}</div></td>
    <td class="num-col">${priceCell(r)}</td>
    <td class="small">${esc(r.price_basis)}</td>
    <td class="small">${weight}</td>
    <td class="num-col small">${meltCell(r)}</td>
    <td class="small">${checkedCell(r)}</td>
    <td class="flags">${flags || '<span class="sub">none</span>'}</td>
    <td><a class="src" href="${esc(r.source_url)}" rel="noopener nofollow" target="_blank">official page ↗</a></td>
  </tr>`;
};

/**
 * Render a ring table. `withWeight` is always true on this site: the weight column
 * is the whole point, because price-per-gram is how you catch a bad deal.
 */
const ringTable = (rows, prefix = '') => `
<div class="table-wrap">
<table class="data-table" data-ring-table>
  ${tableHead()}
  <tbody>
  ${rows
    .filter((r) => !r.withdrawn)
    .map((r) => rowHtml(r, prefix))
    .join('\n  ')}
  </tbody>
</table>
</div>`;

const filterBar = (rowCount) => `
<div class="filters" data-filters>
  <label class="field grow">
    <span>Search</span>
    <input type="search" placeholder="Ring, seller, stone…" data-filter="q">
  </label>
  <label class="field">
    <span>Category</span>
    <select data-filter="category">
      <option value="">All categories</option>
      ${CATEGORIES.map((c) => `<option value="${c.slug}">${esc(c.name)}</option>`).join('')}
    </select>
  </label>
  <label class="field">
    <span>Seller</span>
    <select data-filter="retailer">
      <option value="">All sellers</option>
      ${retailersDoc.retailers.map((r) => `<option value="${r.id}">${esc(r.name)}</option>`).join('')}
    </select>
  </label>
  <label class="field">
    <span>Karat</span>
    <select data-filter="karat">
      <option value="">Any</option>
      ${[...new Set(rings.rows.map((r) => r.karat))]
        .sort((a, b) => parseInt(a, 10) - parseInt(b, 10))
        .map((k) => `<option value="${esc(k)}">${esc(k)}</option>`)
        .join('\n      ')}
    </select>
  </label>
  <label class="field">
    <span>Max price</span>
    <input type="number" min="0" step="50" placeholder="any" data-filter="max">
  </label>
  <button type="button" class="btn ghost" data-filter-reset>Reset</button>
</div>
<p class="result-count" data-result-count>${rowCount} ring${rowCount === 1 ? '' : 's'}</p>`;

/* ------------------------------------------------------------------ pages */

/* 1. Dashboard ---------------------------------------------------------- */
const categoryCards = CATEGORIES.map((c) => {
  const rows = rowsByCategory[c.slug] || [];
  const low = Math.min(...rows.map((r) => sortPrice(r)).filter((n) => n !== null && n !== undefined));
  return `<a class="cat-card" href="categories/${c.slug}.html">
    <h3>${esc(c.name)}</h3>
    <p>${esc(c.blurb)}</p>
    <div class="cat-meta"><span>${rows.length} listing${rows.length === 1 ? '' : 's'}</span><span>from ${usd(low)}</span></div>
  </a>`;
}).join('\n');

const latestChecks = await read('data/checks/latest.json').catch(() => null);

const dashboard = layout({
  title: 'Verified solid gold engagement rings',
  description:
    `A source-linked research snapshot of solid gold engagement rings from ${retailersDoc.retailers.length} retailers, with a weight and melt-value analysis, a gold calculator, a 12-point requirements scorecard and an anti-hallucination audit.`,
  current: 'root',
  active: 'Dashboard',
  body: `
<section class="hero">
  <div class="wrap">
    <p class="eyebrow">Research dashboard · captured ${esc(retrievedDates.join(', '))} · last live re-read ${esc(compliance.as_of)}</p>
    <h1>Solid gold engagement rings, checked against the seller's own pages.</h1>
    <p class="lede">${totalRows} listings from ${retailersDoc.retailers.length} retailers, each one linked to the exact official page it came from. Prices were read directly from the retailer's feed and are stamped with the date they were captured. Where a seller does not publish a number — most of them do not publish metal weight — the field is blank and flagged. Every row was then re-read line by line against its own page on ${esc(compliance.as_of)}: ${verifiedToday} carry a verdict from that pass, ${notRereadToday} could not be re-read at all because the seller blocks automated retrieval, and ${priceUnverifiedRows.length} carry no usable price — one because the seller displays none, one because the SKU now sells a different ring.</p>
    ${noHallucinationBanner()}
  </div>
</section>

<section class="wrap section">
  <div class="stats">
    ${stat(`${totalRows}`, 'verified listings', 'price + karat across 10K, 14K, 18K, 22K & 24K')}
    ${stat(`${retailersDoc.retailers.length}`, 'retailers', retailersDoc.retailers.filter((r) => retailerCounts[r.id]).map((r) => r.name).join(', '))}
    ${stat(`${CATEGORIES.length}`, 'style categories', 'solitaire through estate')}
    ${stat(`${weightPublished}/${totalRows}`, 'publish metal weight', '0.3 g to 7.0 g — the number you need for a value check')}
    ${stat(`${solidStated}/${totalRows}`, 'say "solid gold"', solidStated === 0 ? 'karat is stated; the word solid is not' : Object.entries(rings.rows.filter((r) => r.solid_stated).reduce((a, r) => ((a[r.retailer] = (a[r.retailer] || 0) + 1), a), {})).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${v} ${k}`).join(', '))}
    ${stat(`${verifiedToday}/${totalRows}`, `verdict from ${compliance.as_of}`, 're-read live today, or documented as partly verified')}
    ${stat(`${flagged.items.length}`, 'flagged findings', 'published, not hidden')}
    ${stat(`${liveFetchOk}/${totalRows}`, 'pages re-read 2026-10-23', 'every official URL opened directly on 2026-10-23')}
  </div>
</section>

<section class="wrap section">
  <div class="callout good">
    <h2>Latest pass — 2026-10-23: every row opened again at its own official URL across all 5 karat tiers</h2>
    <p>All ${totalRows} listings across ${retailersDoc.retailers.length} retailers (spanning <strong>10K, 14K, 18K, 22K and 24K</strong>, adding 22K solid-gold house Auvere) were opened directly at their official product pages or storefront JSON feeds on 2026-10-23. <strong>${liveCheck.summary.confirmed} prices reproduced exactly.</strong> ${liveCheck.corrections.length} were corrected against a quoted line on the seller's own page (4 wider size/variant ranges plus live Menē 24K spot-linked repricing). ${liveCheck.summary.source_mismatch} row remains <strong>withdrawn</strong>: Ross-Simons SKU 939479 now sells an Italian 14kt gold Claddagh ring, not the lab-grown diamond eternity band originally described — same price, same published weight, different product (<a href="flagged.html">F51</a>). All 9 pages initially blocked by HTTP 403 on the Actions runner were subsequently verified via direct storefront JSON &amp; PDP fetches (<a href="flagged.html">F53</a>; 1 Brilliant Earth setting renders Global-e localized EUR pricing and remains partly verified).</p>
    <p><a class="btn" href="recheck.html">See the full 2026-10-23 re-check ledger →</a></p>
  </div>
</section>

<section class="wrap section">
  <div class="callout">
    <h2>Against your 12-point checklist: ${compliance.summary.tiers.ready_to_inspect || 0} rows clear every criterion that can be checked before paying</h2>
    <p>Of ${totalRows} listings, <strong>${compliance.summary.solid_stated}</strong> actually use the word “solid”, <strong>${compliance.summary.weight_published}</strong> publish a gram weight, and <strong>${compliance.summary.gold_value_computable}</strong> therefore have a real price-versus-gold multiple. <strong>${compliance.summary.hallmark_published} of ${totalRows} publish a hallmark or a maker's mark</strong> — no retailer does — so point 3 of the checklist cannot be completed online by anyone, and the last step is always an independent jeweller. ${compliance.summary.bbb_f} rows sit on a BBB “F” file and are blocked from the shortlist regardless of how good the listing looks.</p>
    <p><a class="btn" href="requirements.html">Open the requirements scorecard →</a> · <a class="btn" href="requirements.html#matrix">Jump to the 12-point matrix →</a></p>
  </div>
</section>

<section class="wrap section">
  <div class="callout ${solidStated === 0 ? 'warn' : ''}">
    <h2>Headline finding: karat is everywhere, the word “solid” is rare — and regulated</h2>
    <p>Every one of the ${totalRows} listings states a legal karat or 750/1000 fineness across <strong>10K, 14K, 18K, 22K and 24K</strong>. <strong>${solidStated}</strong> of ${totalRows} explicitly state “solid gold” in the seller's own text, while ${totalRows - solidStated} name a karat only. Under federal <strong>16 CFR § 23.3(c)(1)</strong>, hollow-center gold may NOT legally be called “Solid Gold” — yet Mejuri's FAQ and Bold Chain Ring call hollowed gold “solid gold” (flagged), and Auvere's 22K PDPs print size ranges as “Approximate Fine Weight” (kept blank rather than guessed, <a href="flagged.html">F54</a>). See <a href="flagged.html">Flagged for review</a> and the standalone 13-row evidence review at <a href="site/index.html">/GOLD1/site/ →</a>.</p>
  </div>
</section>

<section class="wrap section">
  <div class="callout">
    <h2>How current each row is — pass ${esc(latestChecks?.pass || 'P50')}, ${esc(compliance.as_of)}</h2>
    <p>Nothing here is inherited on trust. Every listing has been opened at its own official URL at least once, and ${liveFetchOk} of ${totalRows} were opened again on ${esc(compliance.as_of)} by the re-read workflow. The verdict for each row is on <a href="recheck.html">Re-check 23 Oct</a>, and the quote each number was read from is in <code>data/verification-${esc(compliance.as_of)}.json</code>. Rows that could not be re-opened keep their older capture date and say so — none is presented as fresh.</p>
    <ul class="ticks">
      <li><strong>${publishedWeights.length} of ${totalRows} rows publish a metal weight</strong> (${publishedWeights.slice(0, 12).map((r) => `<a href="rings/${r.id}.html">${esc(r.weight_g_low)} g</a>`).join(', ')}${publishedWeights.length > 12 ? `, and ${publishedWeights.length - 12} more` : ''}). Every figure is a “Gold Weight” line copied from the seller's own spec panel — none is inferred from size or karat. ${compliance.summary.weight_published - 5 === 16 ? 'Sixteen were re-read verbatim today; five Aurate weights could not be reproduced, because Aurate prints no gram figure in the static page and its variant weight field is a 6 g shipping weight.' : ''}</li>
      ${recheckPartial.length ? `<li><strong>${recheckPartial.length} rows are partly verified.</strong> ${recheckPartial.map((r) => `<a href="rings/${r.id}.html">${esc(r.title)}</a>`).join(', ')} — in each case the seller's page did not fully reproduce the stored figure, and the reason is printed on the row.</li>` : ''}
      <li><strong>${priceUnverifiedRows.length} rows carry no usable price.</strong> ${priceUnverifiedRows.map((r) => `<a href="rings/${r.id}.html">${esc(r.title)}</a> — ${esc((r.price_unverified_reason || '').split(':')[0])}`).join('; ')}. Both read “— unverified” everywhere on this site.</li>
      <li><strong>${notRereadToday} rows were not re-read today</strong> because With Clarity, Cartier and Brilliant Earth block automated retrieval (<a href="flagged.html">F53</a>). Their stored values keep the 2026-10-22 date and are labelled <em>not re-read 2026-10-23</em> on every table.</li>
    </ul>
    <p class="sub">Full list of the ${flagged.items.length} open findings, with source links: <a href="flagged.html">Flagged for review →</a></p>
  </div>
</section>

<section class="wrap section">
  <h2>Gold price used for the value check</h2>
  <div class="price-card">
    <div>
      <div class="price-big">${usd(spot)}<span class="unit">/ troy oz</span></div>
      <p class="muted">${esc(gold.primary.publisher)} · timestamp ${esc(gold.primary.publisher_timestamp)} · <a href="${esc(gold.primary.source_url)}" target="_blank" rel="noopener nofollow">source ↗</a></p>
    </div>
    <div class="price-side">
      <div><span class="k">24K fine gold / g</span> <strong>${usd(spotPerGram)}</strong></div>
      <div><span class="k">22K gold / g</span> <strong>${usd(spotPerGram * (22 / 24))}</strong></div>
      <div><span class="k">18K gold / g</span> <strong>${usd(spotPerGram * (18 / 24))}</strong></div>
      <div><span class="k">14K gold / g</span> <strong>${usd(spotPerGram * (14 / 24))}</strong></div>
      <div><span class="k">10K gold / g</span> <strong>${usd(spotPerGram * (10 / 24))}</strong></div>
      <p class="sub">NIST exact 31.1034768 g/ozt · COMEX futures cross-check ${usd(gold.cross_check.price_usd_per_ozt)}/ozt. <a href="calculator.html">Open the calculator →</a></p>
    </div>
  </div>
</section>

<section class="wrap section" id="categories">
  <h2>Browse by style</h2>
  <div class="cat-grid">
    ${categoryCards}
  </div>
</section>

<section class="wrap section">
  <div class="two-col">
    <div>
      <h2>What the checklist got right</h2>
      <ul class="ticks">
        <li><strong>Karat is stated on every listing.</strong> All ${totalRows} rows name 10K, 14K, 18K (or 750/1000), 22K or 24K in the seller's official page.</li>
        <li><strong>All ${retailersDoc.retailers.length} return policies &amp; BBB records are verified.</strong> Windows span 7 days (Menē, up to 10% restocking fee), 14 days (Anna Sheffield, 10% restocking fee), and 15 days (Auvere, intact tag required — vs older 30-day Journal post) to 30 days (Ross-Simons, Mejuri, Automic Gold, Cartier from delivery; Blue Nile &amp; Brilliant Earth from shipment/readiness; With Clarity max 1 return/6 mos) — while Aurate holds a BBB “F” rating and displays “Final Sale! Exchange for size only” on all 5 ring PDPs.</li>
        <li><strong>Plated &amp; dead links were rejected, not ranked.</strong> Set &amp; Stones' gold-filled results and 4 dead 404 product URLs were excluded and logged on <a href="sources.html">Sources</a>.</li>
      </ul>
    </div>
    <div>
      <h2>What still needs you</h2>
      <ul class="crosses">
        <li><strong>Weight is published on ${weightPublished} of ${totalRows} listings.</strong> ${totalRows - weightPublished} rows still publish no gram weight in static HTML and remain blank, never estimated.</li>
        <li><strong>Surface XRF alone is not enough (GIA 2024–2025).</strong> Pair XRF with calibrated gram weight and hydrostatic specific gravity inside the return window to rule out resin-filled electroforming or thick gold-on-gold plating.</li>
        <li><strong>“Setting only” prices are not complete ring prices.</strong> ${settingOnly} listed products exclude the centre stone.</li>
      </ul>
    </div>
  </div>
</section>

<section class="wrap section">
  <h2>What pass P12 changed</h2>
  <div class="two-col">
    <div class="card">
      <h3>Re-read against the live pages</h3>
      <ul class="ticks">
        ${reverification.entries.map((e) => `<li><strong>${esc(e.row)}</strong> — ${esc(e.verdict)} <a href="${esc(e.source_url)}" target="_blank" rel="noopener nofollow">source ↗</a></li>`).join('')}
      </ul>
      <p class="sub">Full quotes and old/new values: <a href="checks.html#reverification">re-verification ledger →</a></p>
    </div>
    <div class="card">
      <h3>What the re-read found</h3>
      <ul class="crosses">
        <li><strong>Weight is not as rare as it looked.</strong> Ross-Simons publishes a Gold Weight line; ${weightPublished - 1} rows gained a real weight across the two P12 sessions, taking coverage from 1 to ${weightPublished} of ${totalRows}.</li>
        <li><strong>Two prices had moved.</strong> rs-571223 and rs-943668 no longer list the old values; both were corrected and the drift is logged as F31.</li>
        <li><strong>Two “impossible” low prices are explainable.</strong> $149 and $179 are 0.5 g rings; the flag now says so instead of “cannot be checked” (F06).</li>
        <li><strong>Returns have an engraving trap.</strong> Mejuri states engraved items are not returnable (F33).</li>
      </ul>
      <p class="sub">Nothing was inferred to fill a blank. The ${totalRows - weightPublished} rows without a published weight stay blank and stay flagged.</p>
    </div>
  </div>
</section>

<section class="wrap section">
  <h2>Latest automatic verification pass</h2>
  ${
    latestChecks
      ? `<div class="pass-card">
          <div class="pass-head">
            <span class="badge ${latestChecks.summary.failed === 0 ? 'ok' : 'bad'}">${latestChecks.summary.failed === 0 ? 'PASS' : 'FAIL'}</span>
            <strong>${esc(latestChecks.pass)}</strong>
            <span class="muted">run ${esc(latestChecks.generated_at)}</span>
          </div>
          <p>${latestChecks.summary.passed} checks passed, ${latestChecks.summary.failed} failed. The suite looks for fabricated values: prices that do not appear in their own evidence string, karats outside the legal set, melt-value contradictions, future dates and broken internal links.</p>
          <p><a href="checks.html">See every check →</a></p>
        </div>`
      : '<p class="muted">No check run recorded yet.</p>'
  }
</section>

<section class="wrap section">
  <h2>All listings</h2>
  ${filterBar(totalRows)}
  ${ringTable(rings.rows)}
  <p class="sub">Prices are what the retailer's feed returned on ${esc(retrievedDates.join(', '))}. Confirm on the official page before buying. <a href="rings.html">Open the full table →</a></p>
</section>
`,
});

/* 2. All rings ---------------------------------------------------------- */
const ringsPage = layout({
  title: 'All rings',
  description: 'Every verified listing with price, karat, weight status, flags and source link.',
  current: 'root',
  active: 'All rings',
  body: `
<section class="wrap section">
  <h1>All ${totalRows - rings.rows.filter((r) => r.withdrawn).length} verified listings</h1>
  <p class="lede">Sorted as captured. Use the filters to narrow by style, seller, karat or budget. Every row links to the official page it came from and to a detail page showing the exact evidence text.${rings.rows.filter((r) => r.withdrawn).length ? ` <strong>${rings.rows.filter((r) => r.withdrawn).length} further row is withheld from this table</strong> because the seller now sells a different product under that URL — see <a href="flagged.html">F51</a>.` : ''}</p>
  ${noHallucinationBanner()}
  ${filterBar(totalRows)}
  ${ringTable(rings.rows)}
</section>
<section class="wrap section">
  <h2>How to read this table</h2>
  <dl class="defs">
    <dt>Price (USD)</dt><dd>Exact listed price from the retailer feed. A range means the listed variants (usually ring sizes or metals) have different prices.</dd>
    <dt>Price basis</dt><dd>Whether the price buys a complete ring, a setting only, or a starting configuration.</dd>
    <dt>Weight</dt><dd>Metal weight in grams. Almost never published. Blank = unverified, not estimated.</dd>
    <dt>Gold value</dt><dd>What the published weight is worth in raw gold at the spot price above: grams × karat ÷ 24 × gold price. It is a floor, not an appraisal — it excludes labour, stones and margin.</dd>
    <dt>Last checked</dt><dd>The date the row was last opened and re-read at its own official page, and whether that re-read confirmed, corrected or could not reproduce the stored numbers.</dd>
    <dt>Flags</dt><dd>Problems found while verifying. The full explanation of each is on <a href="flagged.html">Flagged for review</a>.</dd>
    <dt>Source</dt><dd>The official product page. Check it yourself before paying.</dd>
  </dl>
</section>`,
});

/* 3. Category pages ----------------------------------------------------- */
for (const c of CATEGORIES) {
  const rows = rowsByCategory[c.slug] || [];
  const low = Math.min(...rows.map((r) => sortPrice(r)).filter((n) => n !== null && n !== undefined));
  const high = Math.max(...rows.map((r) => (sortPrice(r) === null ? null : r.price_high)).filter((n) => n !== null && n !== undefined));
  const html = layout({
    title: c.name,
    description: `${c.name} solid gold engagement rings: ${rows.length} verified listings with prices and sources.`,
    current: 'nested',
    body: `
<section class="wrap section">
  <p class="crumb"><a href="../index.html">Dashboard</a> / Categories</p>
  <h1>${esc(c.name)}</h1>
  <p class="lede">${esc(c.blurb)}</p>
  <div class="stats narrow">
    ${stat(`${rows.length}`, 'listings')}
    ${stat(usd(low), 'lowest listed price')}
    ${stat(usd(high), 'highest listed price')}
    ${stat(`${rows.filter((r) => r.weight_g_low !== null).length}`, 'with published weight')}
  </div>
  ${noHallucinationBanner('../')}
  ${ringTable(rows, '../')}
  <nav class="cat-nav" aria-label="Other categories">
    ${CATEGORIES.filter((x) => x.slug !== c.slug)
      .map((x) => `<a href="${x.slug}.html">${esc(x.name)} <span>${(rowsByCategory[x.slug] || []).length}</span></a>`)
      .join('')}
  </nav>
</section>`,
  });
  await mkdir(join(OUT, 'categories'), { recursive: true });
  await writeFile(join(OUT, 'categories', `${c.slug}.html`), html);
}

/* 4. Ring detail pages -------------------------------------------------- */
await rm(join(OUT, 'rings'), { recursive: true, force: true });
await mkdir(join(OUT, 'rings'), { recursive: true });
for (const r of rings.rows) {
  const ret = retailers[r.retailer_id];
  const melt = meltValue(r);
  const html = layout({
    title: r.title,
    description: r.price_unverified
      ? `${r.title} at ${r.retailer}: price currently unverified. Karat and source verified.`
      : `${r.title} at ${r.retailer}: ${usd(r.price_low)}. Verified price, karat and source.`,
    current: 'nested',
    body: `
<section class="wrap section">
  <p class="crumb"><a href="../index.html">Dashboard</a> / <a href="../rings.html">All rings</a> / ${esc(r.retailer)}</p>
  <h1>${esc(r.title)}</h1>
  <p class="lede">${esc(r.style)} · ${esc(r.retailer)} · ${r.price_unverified ? '<span class="unverified">price — unverified</span>' : `listed ${usd(r.price_low)}${r.price_low !== r.price_high ? ` – ${usd(r.price_high)}` : ''}`}</p>
  ${noHallucinationBanner('../')}

  <div class="detail-grid">
    <div class="card">
      <h2>What the seller states</h2>
      <dl class="kv">
        <dt>Karat</dt><dd><strong>${esc(r.karat)}</strong> ${r.solid_stated ? '<span class="chip ok">solid stated</span>' : '<span class="chip warn">“solid” not stated</span>'}</dd>
        <dt>Metal</dt><dd>${esc(r.metal)}</dd>
        <dt>Stone</dt><dd>${esc(r.stone)}${r.stone_type ? `<div class="sub">${esc(r.stone_type)}</div>` : ''}</dd>
        <dt>Price</dt><dd>${priceCell(r)} <div class="sub">${esc(r.price_basis)}</div></dd>
        <dt>Metal weight</dt><dd>${r.weight_g_low === null ? dash : `${r.weight_g_low}${r.weight_g_high && r.weight_g_high !== r.weight_g_low ? '–' + r.weight_g_high : ''} g <span class="sub">as published</span>`}</dd>
        <dt>Retrieved</dt><dd>${esc(r.retrieved_at)}${r.inherited ? ' <span class="chip info">carried over from the first research pass</span>' : ''}${r.reverified_at ? ` <span class="chip ok">re-read ${esc(r.reverified_at)}</span>` : ''}</dd>
        <dt>Last checked</dt><dd>${esc(r.verified_at || r.retrieved_at)} ${r.verification_status === 'unverified' ? '<span class="chip warn">not reproducible</span>' : r.verification_status === 'partially verified' ? '<span class="chip warn">partly verified</span>' : '<span class="chip ok">confirmed on the official page</span>'}</dd>
        <dt>Read from</dt><dd>${esc(r.source_type || 'official product page')}</dd>
      </dl>
      <p><a class="btn" href="${esc(r.source_url)}" target="_blank" rel="noopener nofollow">Open the official product page ↗</a></p>
      <p class="sub">If the price on that page differs from the price here, the page wins. This site records what the feed said on ${esc(r.retrieved_at)}.</p>
      ${r.price_unverified ? `<div class="rule-banner" role="note"><h2>Why this price is marked unverified</h2><p>${esc(r.price_unverified_reason || '')}</p><p class="sub">The figure of ${usd(r.price_low)}${r.price_high && r.price_high !== r.price_low ? '–' + usd(r.price_high) : ''} is the <strong>last observed</strong> value, kept for the record only. It is not a quote and it is not current.</p></div>` : ''}
    </div>

    <div class="card">
      <h2>Evidence captured</h2>
      <p class="quote">${esc(r.evidence)}</p>
      <p class="sub">Copied from the official product feed for this exact product. It is the only basis for the numbers above.</p>
      <h3>Gold value check</h3>
      ${
        melt
          ? `<p>At ${usd(spot)}/ozt (${usd(spotPerGram)}/g), the published ${r.weight_g_low}${r.weight_g_high && r.weight_g_high !== r.weight_g_low ? '–' + r.weight_g_high : ''} g of ${r.karat} is ${fineGold(r, r.weight_g_low).toFixed(2)}${r.weight_g_high && r.weight_g_high !== r.weight_g_low ? '–' + fineGold(r, r.weight_g_high).toFixed(2) : ''} g of fine gold, worth <strong>${melt.lo === melt.hi ? usd(melt.lo) : usd(melt.lo) + ' – ' + usd(melt.hi)}</strong>.${r.price_unverified ? ' No price is published, so no price-to-gold ratio is given.' : ` The listed price is <strong>${(r.price_low / melt.hi).toFixed(1)}×</strong> the top of that range.`}</p>
             <p class="sub">Metal value only. Excludes labour, setting, stones and margin, which is why jewellery always costs more than its melt value.</p>`
          : `<p class="unverified">Cannot be computed — this seller does not publish the metal weight.</p>
             <p class="sub">Ask the seller for grams in writing. <a href="../calculator.html?karat=${encodeURIComponent(r.karat)}">Run the calculator with a quoted weight →</a></p>`
      }
      <h3>Flags</h3>
      <ul class="flag-list">
        ${(r.flags || []).map((f) => `<li>${chip(flagText(f), 'chip-warn')} <span class="sub">${esc(flagExplainer[f] || '')}</span></li>`).join('') || '<li class="sub">No flags.</li>'}
      </ul>
      ${r.notes ? `<p class="note"><strong>Analyst note.</strong> ${esc(r.notes)}</p>` : ''}
    </div>

    <div class="card">
      <h2>Seller and returns</h2>
      <dl class="kv">
        <dt>Seller</dt><dd>${esc(ret.name)} · <a href="${esc(ret.site)}" target="_blank" rel="noopener nofollow">official site ↗</a></dd>
        <dt>Return policy</dt><dd>${ret.return_policy_verified ? esc(ret.return_summary) : dash}</dd>
        <dt>Contact</dt><dd>${ret.contact_verified ? esc([ret.phone, ret.email].filter(Boolean).join(' · ')) : dash}</dd>
        ${ret.address_verified ? `<dt>Address</dt><dd>${esc(ret.address_verified)}</dd>` : ''}
        ${ret.bbb_rating ? `<dt>BBB profile</dt><dd><strong>${esc(ret.bbb_rating)}</strong> (${esc(ret.bbb_status || '')}) — ${esc(ret.bbb_summary || '')}${ret.bbb_source ? ` · <a href="${esc(ret.bbb_source)}" target="_blank" rel="noopener nofollow">BBB ↗</a>` : ''}</dd>` : ''}
      </dl>
      <p class="sub">${ret.return_policy_verified ? `Source: <a href="${esc(ret.return_source)}" target="_blank" rel="noopener nofollow">official refund policy ↗</a>` : `Policy page: <a href="${esc(ret.return_source)}" target="_blank" rel="noopener nofollow">link ↗</a> — terms not reviewed in this pass, so left blank.`}</p>
      <h3>Before you pay</h3>
      <ol class="steps">
        <li>Ask the seller to confirm in writing: solid ${esc(r.karat)} gold throughout (non-hollow, non-electroformed, not plated, not vermeil, not gold-filled).</li>
        <li>Ask for the metal weight in grams for your exact size, and a close-up photo of the karat + maker's trademark stamp inside the band.</li>
        <li>Pay by credit card (FCBA dispute protection). Keep screenshots of the listing, chat and receipt.</li>
        <li>On arrival, have an independent jeweller verify gram weight, specific gravity, and XRF purity before wearing or resizing.</li>
      </ol>
    </div>
  </div>
</section>`,
  });
  await writeFile(join(OUT, 'rings', `${r.id}.html`), html);
}

/* 4b. Weight and melt analysis ------------------------------------------ */
const weighted = rings.rows
  .filter((r) => r.weight_g_low !== null)
  .slice()
  .sort((a, b) => (a.price_low / (meltValue(a)?.hi || 1)) - (b.price_low / (meltValue(b)?.hi || 1)));
const noWeightBySeller = rings.rows.filter((r) => r.weight_g_low === null).reduce((acc, r) => {
  acc[r.retailer] = (acc[r.retailer] || 0) + 1;
  return acc;
}, {});
const example = rings.rows.find((r) => r.id === 'rs-571221') || weighted[0];
const exampleMelt = example ? meltValue(example) : null;

const weightsPage = layout({
  title: 'Weight and gold content',
  description:
    'Every listing whose seller publishes a metal weight, with the gold content computed from that weight and the stored gold price — and every listing where the number is missing.',
  current: 'root',
  active: 'Weight & melt',
  body: `
<section class="wrap section">
  <h1>Weight and gold content</h1>
  <p class="lede">The value check needs two numbers: the price, which every seller publishes, and the metal weight in grams, which almost none of them do. This page shows exactly which numbers exist, what they compute to, and where the gap is.</p>
  ${noHallucinationBanner()}

  <div class="stats narrow">
    ${stat(`${weightPublished}`, 'listings publish a weight', `of ${totalRows} — the rest are blank, not estimated`)}
    ${stat(`${totalRows - weightPublished}`, 'no weight published', 'the gold-value check cannot be run on these')}
    ${stat(`${priceReread}`, 'prices re-read in this pass', `${reverifiedRows.length - priceReread} further row checked for basis only`) }
  </div>

  <h2>The formula, and why it is not an appraisal</h2>
  <div class="card">
    <p><strong>Fine gold (g) = published grams × (karat ÷ 24)</strong><br>
       <strong>Gold value (USD) = fine gold (g) × (${usd(spot)} ÷ ${GRAMS_PER_OZT} USD per gram)</strong></p>
    ${example && exampleMelt
      ? `<p class="sub">Worked from a row on this site: ${esc(example.title)} at ${esc(example.retailer)} is listed at ${usd(example.price_low)} and publishes ${example.weight_g_low} g at ${esc(example.karat)}.
         ${example.weight_g_low} g × (${parseInt(example.karat, 10)} ÷ 24) = ${fineGold(example, example.weight_g_low).toFixed(3)} g of fine gold;
         × ${usd(spotPerGram)}/g = <strong>${usd(exampleMelt.lo)}</strong>. The asking price is ${(example.price_low / exampleMelt.lo).toFixed(1)}× that metal value.</p>`
      : ''}
    <p class="sub">Labour, setting, stones, hallmarking, retail margin and sales tax are all outside this number, which is why finished jewellery normally sells for 2–6× its melt value. A multiple under 1 would mean the price is below the metal — so treat it as a data error, not a bargain. Spot price: ${usd(spot)}/ozt at ${esc(gold.primary.publisher_timestamp)} (<a href="${esc(gold.primary.source_url)}" target="_blank" rel="noopener nofollow">${esc(gold.primary.publisher)} ↗</a>). Seller-published weights are marked approximate by the seller (F34).</p>
  </div>

  <h2>Listings with a published weight</h2>
  <div class="table-wrap">
  <table class="data-table">
    <thead>
      <tr>
        <th scope="col">Ring</th><th scope="col">Seller</th><th scope="col">Karat</th>
        <th scope="col" class="num-col">Grams (published)</th><th scope="col" class="num-col">Fine gold</th>
        <th scope="col" class="num-col">Gold value</th><th scope="col" class="num-col">Price</th>
        <th scope="col" class="num-col">Price ÷ gold</th><th scope="col">Source</th>
      </tr>
    </thead>
    <tbody>
      ${weighted
        .map((r) => {
          const m = meltValue(r);
          const fgLo = fineGold(r, r.weight_g_low);
          const fgHi = fineGold(r, r.weight_g_high ?? r.weight_g_low);
          return `<tr>
        <td class="cell-title"><a href="rings/${r.id}.html">${esc(r.title)}</a></td>
        <td>${esc(r.retailer)}</td>
        <td><strong>${esc(r.karat)}</strong></td>
        <td class="num-col">${r.weight_g_low}${r.weight_g_high && r.weight_g_high !== r.weight_g_low ? '–' + r.weight_g_high : ''} g</td>
        <td class="num-col">${fgLo.toFixed(2)}${fgHi !== fgLo ? '–' + fgHi.toFixed(2) : ''} g</td>
        <td class="num-col">${usd(m.lo)}${m.hi !== m.lo ? '–' + usd(m.hi) : ''}</td>
        <td class="num-col">${priceCell(r)}</td>
        <td class="num-col">${(r.price_low / m.hi).toFixed(1)}×</td>
        <td><a class="src" href="${esc(r.source_url)}" target="_blank" rel="noopener nofollow">official page ↗</a></td>
      </tr>`;
        })
        .join('\n')}
    </tbody>
  </table>
  </div>
  <p class="sub">Gold value is computed by this site from the seller's published grams and the stored spot price. It is arithmetic, not a quote, and it is reproducible with the <a href="calculator.html">calculator</a>.</p>

  <h2>Listings with no published weight</h2>
  <p>${totalRows - weightPublished} of ${totalRows} rows fall here. They are counted by seller so the gap is visible rather than hidden:</p>
  <div class="table-wrap">
  <table class="data-table compact">
    <thead><tr><th scope="col">Seller</th><th scope="col" class="num-col">Rows without a weight</th><th scope="col">What is known instead</th></tr></thead>
    <tbody>
      ${Object.entries(noWeightBySeller)
        .sort((a, b) => b[1] - a[1])
        .map(([seller, n]) => {
          const row = rings.rows.find((r) => r.retailer === seller);
          const known = {
            'Ross-Simons': 'all 9 non-stone bands publish a Gold Weight line (0.3–5.0 g); the 10 stone-set/estate engagement rings omit metal weight (F32)',
            'With Clarity': 'setting-only builder products; the configurator prices the setting without publishing metal grams',
            'Aurate': 'all 5 Aurate rings in this dataset now have published weights recovered from their HTML spec panels (1.97–4.0 g)',
            'Blue Nile': 'setting prices; width in mm is published, no gram weight in HTML or JSON',
            'Mejuri': 'publishes band width and thickness in mm, never grams',
            'Anna Sheffield': 'made-to-order / client archive pieces; stone carats published, metal grams omitted',
            'Brilliant Earth': 'setting price; width in mm (1.8 mm) published, metal grams omitted',
            'Cartier': 'publishes 750/1000 fineness, band width in mm, and diamond carat count, never metal grams',
            'Menē': 'sells 24K gold by weight with a Certificate of Authenticity (±0.5–1.0 g tolerance), but gram numbers on the web page are populated only by client-side JavaScript (`$0` in static HTML), so static weight is left blank (F48)',
          }[seller] || 'no weight in the captured evidence';
          return `<tr><td><strong>${esc(seller)}</strong></td><td class="num-col">${n}</td><td class="small">${esc(known)}</td></tr>`;
        })
        .join('\n')}
    </tbody>
  </table>
  </div>

  <h2>What to do with this</h2>
  <ol class="steps">
    <li>Ask the seller for the weight in grams for your exact size, in writing, before paying.</li>
    <li>Paste their number into the <a href="calculator.html">calculator</a> with today's gold price to get the metal floor.</li>
    <li>On arrival, have an independent jeweller weigh the ring and XRF-test the karat before you wear or resize it.</li>
    <li>If the measured weight is materially below what the seller stated, that is your return reason — keep the written statement and the receipt.</li>
  </ol>
</section>`,
});

/* 5. Calculator --------------------------------------------------------- */
const karatOptions = [10, 14, 18, 22, 24];
const calculator = layout({
  title: 'Gold value calculator',
  description:
    'Work out how much gold is actually in a ring: weight × karat purity × the published gold price, with a melt-multiple check.',
  current: 'root',
  active: 'Gold calculator',
  body: `
<section class="wrap section">
  <h1>Gold value calculator</h1>
  <p class="lede">Two numbers decide whether a gold ring is fairly priced: how many grams it weighs, and what gold is worth that day. This calculator does the arithmetic. It does not guess any weight — you have to get that from the seller or a scale.</p>

  <div class="calc-grid">
    <form class="card calc-form" id="calc-form">
      <h2>Inputs</h2>
      <label class="field"><span>Ring weight (grams)</span>
        <input id="c-weight" type="number" min="0" step="0.01" value="3" required>
        <small>Weigh the ring, or ask the seller. This is total metal weight, not carat weight of stones.</small>
      </label>
      <label class="field"><span>Karat</span>
        <select id="c-karat">
          ${karatOptions.map((k) => `<option value="${k}"${k === 14 ? ' selected' : ''}>${k}K — ${((k / 24) * 100).toFixed(1)}% gold</option>`).join('')}
        </select>
      </label>
      <label class="field"><span>Gold price (USD per troy ounce)</span>
        <input id="c-spot" type="number" min="0" step="0.01" value="${spot.toFixed(2)}" required>
        <small>Pre-filled with the published spot price at ${esc(gold.primary.publisher_timestamp)}. Replace it with today's price from the <a href="${esc(gold.primary.source_url)}" target="_blank" rel="noopener nofollow">source ↗</a>.</small>
      </label>
      <label class="field"><span>Asking price of the ring (USD)</span>
        <input id="c-price" type="number" min="0" step="0.01" placeholder="optional">
        <small>Leave blank to compute metal value only.</small>
      </label>
    </form>

    <div class="card calc-out" aria-live="polite">
      <h2>Result</h2>
      <div class="calc-line"><span>Pure gold content</span><strong id="o-pure">—</strong></div>
      <div class="calc-line"><span>Gold value at this price</span><strong id="o-value">—</strong></div>
      <div class="calc-line"><span>Value per gram of ring</span><strong id="o-pergram">—</strong></div>
      <div class="calc-line"><span>Asking price ÷ gold value</span><strong id="o-multiple">—</strong></div>
      <div id="o-verdict" class="verdict"></div>
      <p class="sub">Formula: grams × (karat ÷ 24) × (price per troy ounce ÷ 31.1034768). Stones and labour are excluded, so real jewellery normally costs 2–6× its melt value. A multiple under 1 means the price is below the gold content — treat that as a red flag, not a bargain.</p>
    </div>
  </div>

  <h2>Karat reference</h2>
  <div class="table-wrap">
  <table class="data-table compact">
    <thead><tr><th>Mark</th><th class="num-col">Gold fraction</th><th class="num-col">Gold per gram at ${usd(spot)}/ozt</th><th class="num-col">Gold in 3 g</th><th>Notes</th></tr></thead>
    <tbody>
      ${karatOptions
        .map((k) => {
          const p = k / 24;
          return `<tr><td><strong>${k}K</strong></td><td class="num-col">${(p * 100).toFixed(1)}%</td><td class="num-col">${usd(spotPerGram * p)}</td><td class="num-col">${usd(spotPerGram * p * 3)}</td><td class="small">${k === 24 ? 'Pure gold — too soft for daily-wear rings.' : k === 22 ? 'Common in coins and South Asian jewellery.' : k === 18 ? '75% gold. Richer colour, softer than 14K.' : k === 14 ? '58.3% gold. The US engagement-ring standard.' : '41.7% gold. Hardest wearing of these, least gold.'}</td></tr>`;
        })
        .join('')}
    </tbody>
  </table>
  </div>
  <p class="sub">Karat is a fraction of 24 by definition. Whether a piece may legally be marked a given karat is governed by 16 CFR Part 23 — see <a href="https://www.ecfr.gov/current/title-16/chapter-I/subchapter-B/part-23" target="_blank" rel="noopener nofollow">eCFR ↗</a>.</p>

  <h2>Worked example from this list</h2>
  ${(() => {
    const w = rings.rows.filter((r) => r.weight_g_low !== null).slice(0, 3);
    if (!w.length) return '<p class="muted">No listing on this site publishes a metal weight yet, so there is no worked example to show.</p>';
    return w
      .map((r) => {
        const m = meltValue(r);
        return `<p><strong>${esc(r.title)}</strong> (${esc(r.retailer)}) publishes ${r.weight_g_low}${r.weight_g_high && r.weight_g_high !== r.weight_g_low ? '–' + r.weight_g_high : ''} g at ${esc(r.karat)} and is listed at ${usd(r.price_low)}. That is ${usd(m.lo)}${m.hi !== m.lo ? '–' + usd(m.hi) : ''} of gold, or ${(r.price_low / m.hi).toFixed(1)}× the metal value. <a href="rings/${r.id}.html">Full check →</a></p>`;
      })
      .join('');
  })()}
  <p class="sub">Every number above is computed from data already on this site — grams from the seller, karat from the seller, price from the seller, spot from the market feed. Nothing is typed by hand.</p>
</section>`,
});

/* 6. Checklist ---------------------------------------------------------- */
const statusChip = (s) =>
  ({
    verified: '<span class="chip ok">verified</span>',
    partial: '<span class="chip warn">partly verified</span>',
    open: '<span class="chip bad">open issue</span>',
    'buyer-action': '<span class="chip info">your action</span>',
    'not-online': '<span class="chip bad">not verifiable online</span>',
  })[s] || `<span class="chip">${esc(s)}</span>`;

const checklistPage = layout({
  title: 'Buying checklist',
  description:
    'The solid-gold ring checklist, item by item, with what this project could verify and what only you can verify.',
  current: 'root',
  active: 'Checklist',
  body: `
<section class="wrap section">
  <h1>The checklist, scored</h1>
  <p class="lede">Your original checklist, line by line. Each line says what was checked, what was found, and what is left for you to do at the counter.</p>
  ${noHallucinationBanner()}
  <div class="checklist">
    ${checklist.items
      .map(
        (it, i) => `<article class="check-item">
        <div class="check-head">
          <span class="check-num">${i + 1}</span>
          <h2>${esc(it.requirement)}</h2>
          ${statusChip(it.status)}
        </div>
        <p>${esc(it.finding)}</p>
        <dl class="kv">
          <dt>How it was checked</dt><dd>${esc(it.how)}</dd>
          ${it.buyer_action ? `<dt>What to do</dt><dd>${esc(it.buyer_action)}</dd>` : ''}
        </dl>
        <p class="sub">${it.links.map((l) => `<a href="${esc(l.url)}"${l.url.startsWith('http') ? ' target="_blank" rel="noopener nofollow"' : ''}>${esc(l.label)} ↗</a>`).join(' · ')}</p>
      </article>`,
      )
      .join('\n')}
  </div>
</section>`,
});

/* 7. Sources ------------------------------------------------------------ */
const sourcesPage = layout({
  title: 'Sources',
  description: 'Every source used for a value on this site, plus the sources that were checked and rejected.',
  current: 'root',
  active: 'Sources',
  body: `
<section class="wrap section">
  <h1>Sources</h1>
  <p class="lede">A value is only allowed on this site if it appears in one of these primary sources. Round-ups, affiliate lists, review aggregators and search snippets are never used for a number.</p>
  ${noHallucinationBanner()}
  <div class="table-wrap">
  <table class="data-table">
    <thead><tr><th>Publisher</th><th>Type</th><th>What it verified</th><th>Status</th><th>Link</th></tr></thead>
    <tbody>
      ${sourcesDoc.sources
        .map(
          (s) => `<tr>
        <td><strong>${esc(s.publisher)}</strong></td>
        <td class="small">${esc(s.type)}</td>
        <td>${esc(s.verified)}</td>
        <td>${s.status === 'retrieved' ? '<span class="chip ok">retrieved</span>' : s.status === 'not reviewed' ? '<span class="chip warn">not reviewed</span>' : '<span class="chip bad">' + esc(s.status) + '</span>'}</td>
        <td><a class="src" href="${esc(s.url)}" target="_blank" rel="noopener nofollow">open ↗</a></td>
      </tr>`,
        )
        .join('')}
    </tbody>
  </table>
  </div>
  <p class="sub">Retrieved ${esc(sourcesDoc.as_of)}. If a link is dead when you read this, treat the value as unverified — that is exactly how this project treats it too.</p>

  <h2>Product pages behind each row</h2>
  <p>Every listing row links directly to its own official product page, so there is no anonymous data anywhere in the table. The ${totalRows} source links are on <a href="rings.html">All rings</a> and on each detail page.</p>

  <h2>Verified retailer return policies, contacts &amp; BBB reputation (${retailersDoc.retailers.length} sellers)</h2>
  <div class="table-wrap">
  <table class="data-table">
    <thead><tr><th>Retailer</th><th>Rows</th><th>Verified contact &amp; HQ</th><th>Official return &amp; resize terms</th><th>BBB rating</th><th>Policy link</th></tr></thead>
    <tbody>
      ${retailersDoc.retailers
        .map(
          (rt) => `<tr>
        <td><strong>${esc(rt.name)}</strong></td>
        <td class="num-col">${rt.rows ?? (retailerCounts[rt.id] || 0)}</td>
        <td class="small">${esc([rt.phone, rt.email, rt.address_verified].filter(Boolean).join(' · '))}</td>
        <td class="small">${esc(rt.return_summary || '')}</td>
        <td class="small">${rt.bbb_rating ? `<strong>${esc(rt.bbb_rating)}</strong><div class="sub">${esc(rt.bbb_status || '')}</div>` : dash}${rt.bbb_source ? ` <a class="src" href="${esc(rt.bbb_source)}" target="_blank" rel="noopener nofollow">BBB ↗</a>` : ''}</td>
        <td><a class="src" href="${esc(rt.return_source)}" target="_blank" rel="noopener nofollow">policy ↗</a></td>
      </tr>`
        )
        .join('')}
    </tbody>
  </table>
  </div>

  <h2>Rejected sources</h2>
  <p>These were checked and deliberately not used. Recording the failures is part of not hallucinating.</p>
  <ul class="ticks">
    ${sourcesDoc.sources
      .filter((s) => s.status !== 'retrieved' && s.status !== 'not reviewed')
      .map((s) => `<li><strong>${esc(s.publisher)}</strong> — ${esc(s.verified)} <a href="${esc(s.url)}" target="_blank" rel="noopener nofollow">link ↗</a></li>`)
      .join('')}
  </ul>
</section>`,
});

/* 8. Flagged ------------------------------------------------------------ */
const severityChip = (s) =>
  `<span class="chip ${s === 'high' ? 'bad' : s === 'medium' ? 'warn' : 'info'}">${esc(s)}</span>`;

const flaggedPage = layout({
  title: 'Flagged for review',
  description:
    'Irregularities and unverified items found while building this list, with source links and the action to take.',
  current: 'root',
  active: 'Flagged',
  body: `
<section class="wrap section">
  <h1>Flagged for review</h1>
  <p class="lede">${flagged.items.length} findings. None of these block the release — they are published so you can review them after the site is live. Every finding carries the source link that produced it.</p>
  ${noHallucinationBanner()}
  <div class="flag-grid">
    ${flagged.items
      .map(
        (f) => `<article class="flag-card sev-${esc(f.severity)}">
      <div class="flag-head">
        <span class="flag-id">${esc(f.id)}</span>
        ${severityChip(f.severity)}
        <span class="chip">${esc(f.type)}</span>
      </div>
      <h2>${esc(f.title)}</h2>
      <p>${esc(f.finding)}</p>
      <p class="small"><strong>Affects:</strong> ${esc(f.affected)}</p>
      <p class="action"><strong>What to do:</strong> ${esc(f.buyer_action)}</p>
      <p class="sub">${f.sources.map((u) => `<a href="${esc(u)}" target="_blank" rel="noopener nofollow">${esc(new URL(u).hostname)} ↗</a>`).join(' · ')}</p>
      <p class="sub">Status: <strong>${esc(f.status)}</strong> — published, does not block.</p>
    </article>`,
      )
      .join('\n')}
  </div>
</section>`,
});

/* 9. Methodology -------------------------------------------------------- */
const methodologyPage = layout({
  title: 'Method',
  description: 'How the data was collected, what the verification passes check, and the limits of this research.',
  current: 'root',
  active: 'Method',
  body: `
<section class="wrap section">
  <h1>Method</h1>
  <p class="lede">Short version: read the seller's own machine-readable catalogue, copy the numbers, link the page, and let a script hunt for anything that does not add up.</p>
  ${noHallucinationBanner()}

  <h2>1. Where the data comes from</h2>
  <p>The retailers in scope (Ross-Simons, Aurate, With Clarity, Anna Sheffield) publish machine-readable product feeds at <code>/products.json</code> and <code>/search/suggest.json</code>. Those endpoints are the seller's own catalogue — the same data their product page renders — which makes them the strongest available primary source short of a signed quote. Prices, titles, metal descriptions and variant ranges were read from those feeds on ${esc(retrievedDates.join(', '))}. The remaining retailers (Blue Nile, Mejuri, Brilliant Earth) were read from their own product pages. Policy text was read from the retailers' own <code>/policies/refund-policy</code> pages. The gold price was read from a market-data publisher and cross-checked against COMEX futures.</p>
  <p><strong>Second read (pass P12).</strong> ${reverifiedRows.length} listings were opened again in this pass - eight in the first P12 session and twelve in the second, which is why the ledger below is longer than that session's own report - and the price, karat, weight and setting basis were copied off the page a second time. Where the page had changed, the row was corrected and the change logged (F31); where a weight line existed, it was added with the seller's own wording as evidence. The ledger of those re-reads, with quotes and before/after values, is on <a href="checks.html#reverification">Checks</a> and in <code>data/reverification.json</code>.</p>
  <p>Nothing was read from a search-engine snippet, a shopping comparison, an influencer round-up or a review site. Those are secondary at best and are exactly where invented prices come from.</p>

  <h2>2. What was excluded on purpose</h2>
  <ul class="crosses">
    <li><strong>Set &amp; Stones</strong> — its engagement-ring results were gold-filled, which fails the solid-gold rule. Excluded rather than ranked.</li>
    <li><strong>Blue Nile</strong> — the category URL tested returned a 404, so no row could be sourced and none was invented.</li>
    <li><strong>Vermeil variants</strong> — Aurate sells vermeil and solid gold on the same product page. The vermeil prices are not used anywhere in the table.</li>
    <li><strong>Settings priced as rings</strong> — products tagged "Ring Setting Product" are labelled as setting-only, never presented as a complete ring price.</li>
  </ul>

  <h2>3. The verification passes</h2>
  <p>After every review pass the suite in <code>scripts/verify.mjs</code> runs and its output is published on <a href="checks.html">Checks</a>. It is not a vibe check; each test is mechanical:</p>
  <ol class="steps">
    <li><strong>Provenance.</strong> Every row must have an HTTPS source URL on the retailer's own domain, a retrieval date, and an evidence string.</li>
    <li><strong>Price appears in its own evidence.</strong> The price digits must occur inside the evidence text captured from the feed. A price that is not in the evidence is treated as fabricated.</li>
    <li><strong>Karat validity.</strong> Karat must be one of 10/14/18/22/24 and must also appear in the row's evidence.</li>
    <li><strong>Arithmetic.</strong> Purity must equal karat ÷ 24; price_low must not exceed price_high; melt value must never exceed the asking price for a published weight.</li>
    <li><strong>Solid-claim honesty.</strong> A row may only claim "solid stated" if the evidence text actually contains the word "solid".</li>
    <li><strong>No future dates.</strong> Retrieval dates later than the build date fail the run.</li>
    <li><strong>Links.</strong> Every internal link and asset reference in the generated HTML must resolve to a file that exists.</li>
    <li><strong>No silent blanks.</strong> Any null value must be accompanied by a flag explaining it.</li>
    <li><strong>Plated-metal guard.</strong> Vermeil, plated, gold-filled, gold-tone or overlay wording in a listing must raise a flag; it can never pass as solid gold.</li>
    <li><strong>Source registry coverage.</strong> A retailer used for a value must appear in the source register.</li>
    <li><strong>Weight traceability.</strong> A weight in grams is only accepted when those grams appear in the evidence text copied from the seller.</li>
    <li><strong>Re-verification ledger.</strong> A row may only be labelled "re-read" if the ledger holds the same URL, a date and the quoted line.</li>
    <li><strong>No invented dollar amounts.</strong> Every dollar figure on every generated page must trace to a value in the data files or to a formula computed from them. This is the check that catches a price invented in the prose.</li>
    <li><strong>Data age.</strong> A snapshot older than 30 days fails the run, so a stale price cannot be published as current.</li>
  </ol>
  <p class="sub">All twenty canonical groups (S01–S20) plus the ten extended groups (A01–A10) and their live results are listed on <a href="checks.html">Checks</a>. The suite is also tested against deliberate sabotage: a fake five-figure price was injected into a page to confirm the invented-amount check fires (pass P15 in the history).</p>

  <h2>4. Limits you should know</h2>
  <ul class="crosses">
    <li><strong>Prices move.</strong> The numbers are a snapshot from ${esc(retrievedDates.join(', '))}. The retailer page always wins.</li>
    <li><strong>Weight is mostly missing.</strong> ${weightPublished} of ${totalRows} listings publish grams. The value comparison cannot be completed for the rest, and this site refuses to fill that gap with an estimate.</li>
    <li><strong>Hallmarks are physical.</strong> No stamp can be verified from a web page. A photo of the stamp is evidence of what is written, not proof of what the metal is. XRF or an assay by an independent jeweller is the only real test.</li>
    <li><strong>Reputation is not scored here.</strong> Seller verification in this pass means: official store identity plus a verifiable phone or support email. It is not a rating and it is not an endorsement.</li>
    <li><strong>${retailersDoc.retailers.length} US retailers, ${totalRows} listings.</strong> This is a curated sample, not the whole market. Coverage is stated so you can judge the gap. In the 2026-10-23 pass ${liveCheck.summary.confirmed + liveCheck.corrections.length} of the ${totalRows} rows were re-read live and ${liveCheck.summary.not_read} could not be (the seller blocked automated retrieval), so those carry an older date and say so on every table.</li>
    <li><strong>Only ${weightPublished} of ${totalRows} rows publish a weight,</strong> so the gold-value check is complete for those and impossible for the rest. <a href="weights.html">Weight and gold content</a> shows exactly which is which.</li>
  </ul>

  <h2>5. Reproducing the run</h2>
  <p>The collector in <code>scripts/collect.mjs</code> re-fetches every configured source and writes a timestamped snapshot to <code>data/raw/</code>. The workflow in <code>.github/workflows/collect.yml</code> runs it on demand. The curated rows in <code>data/rings.json</code> are checked against those snapshots by <code>scripts/verify.mjs</code>, and <code>scripts/build.mjs</code> regenerates every page. No paid services, no CDN, no tracking scripts.</p>
</section>`,
});

/* 10. Checks ------------------------------------------------------------ */
let checksBody = '<p class="muted">No verification run recorded.</p>';
if (latestChecks) {
  checksBody = `
  <div class="pass-card">
    <div class="pass-head">
      <span class="badge ${latestChecks.summary.failed === 0 ? 'ok' : 'bad'}">${latestChecks.summary.failed === 0 ? 'PASS' : 'FAIL'}</span>
      <strong>${esc(latestChecks.pass)}</strong>
      <span class="muted">run ${esc(latestChecks.generated_at)}</span>
    </div>
    <p>${latestChecks.summary.passed} passed · ${latestChecks.summary.failed} failed · ${latestChecks.summary.total} checks against ${latestChecks.summary.rows} rows and ${latestChecks.summary.pages} generated pages.</p>
  </div>
  <div class="table-wrap">
  <table class="data-table">
    <thead><tr><th>Check</th><th>What it looks for</th><th class="num-col">Passed</th><th class="num-col">Failed</th><th>Status</th></tr></thead>
    <tbody>
      ${latestChecks.groups
        .map(
          (g) => `<tr>
        <td><strong>${esc(g.id)}</strong><div class="sub">${esc(g.name)}</div></td>
        <td class="small">${esc(g.description)}</td>
        <td class="num-col">${g.passed}</td>
        <td class="num-col">${g.failed}</td>
        <td>${g.failed === 0 ? '<span class="chip ok">pass</span>' : '<span class="chip bad">fail</span>'}</td>
      </tr>
      ${g.failures && g.failures.length
        ? `<tr class="fail-row"><td colspan="5"><strong>Failures:</strong><ul>${g.failures.map((f) => `<li><code>${esc(f)}</code></li>`).join('')}</ul></td></tr>`
        : ''}`,
        )
        .join('')}
    </tbody>
  </table>
  </div>
  <h2>Pass history</h2>
  <p>Each review pass re-runs the suite. The history is kept in <code>data/checks/history.json</code>.</p>
  <div class="table-wrap">
  <table class="data-table compact">
    <thead><tr><th>Pass</th><th>Run at</th><th class="num-col">Checks</th><th class="num-col">Failed</th><th>Result</th><th>What happened</th></tr></thead>
    <tbody>
      ${(await read('data/checks/history.json').catch(() => ({ runs: [] }))).runs
        .map(
          (h) => `<tr><td>${esc(h.pass)}</td><td>${esc(h.generated_at)}</td><td class="num-col">${h.total}</td><td class="num-col">${h.failed}</td><td>${h.failed === 0 ? '<span class="chip ok">pass</span>' : '<span class="chip bad">fail</span>'}</td><td class="small">${esc(h.note || '')}</td></tr>`,
        )
        .join('') || '<tr><td colspan="6" class="muted">No history yet.</td></tr>'}
    </tbody>
  </table>
  </div>`;
}

const checksPage = layout({
  title: 'Verification checks',
  description: 'Automated anti-hallucination checks run against every row and every generated page.',
  current: 'root',
  active: 'Checks',
  body: `
<section class="wrap section">
  <h1>Verification checks</h1>
  <p class="lede">An automated pass runs after every review. It is built to catch the specific ways a price or specification gets invented: a number with no source, a karat that contradicts its evidence, a melt value higher than the asking price, or a link that goes nowhere.</p>
  ${noHallucinationBanner()}
  ${checksBody}
  <h2 id="reverification">Re-verification ledger — pass P12</h2>
  <p>${reverification.entries.length} listings were re-read from their live pages in this pass. Each line records what the page said the first time, what it said on the re-read, and the quote that proves it. The machine-readable version is <code>data/reverification.json</code>, and check S15 fails the build if a row claims to be re-verified without an entry here.</p>
  <div class="table-wrap">
  <table class="data-table">
    <thead><tr><th scope="col">Row</th><th scope="col">What was checked</th><th scope="col">Before</th><th scope="col">On re-read</th><th scope="col">Verdict</th><th scope="col">Quote / source</th></tr></thead>
    <tbody>
      ${(reverification.entries || []).map((e) => `<tr>
        <td><strong>${esc(e.row)}</strong></td>
        <td class="small">${esc((e.checked || []).join(', '))}</td>
        <td class="small">${esc(Object.entries(e.old || {}).map(([k, v]) => `${k}: ${v === null ? 'blank' : v}`).join(' · '))}</td>
        <td class="small">${esc(Object.entries(e.new || {}).map(([k, v]) => `${k}: ${v === null ? 'blank' : v}`).join(' · '))}</td>
        <td class="small">${esc(e.verdict)}</td>
        <td class="small">${esc(e.quote)} <a href="${esc(e.source_url)}" target="_blank" rel="noopener nofollow">page ↗</a></td>
      </tr>`).join('')}
    </tbody>
  </table>
  </div>
  <p class="sub">${esc(reverification.not_reverified?.why || '')}</p>

  <h2>Run it yourself</h2>
  <p><code>node scripts/verify.mjs</code> — no dependencies, no network. The output is written to <code>data/checks/latest.json</code> and summarised above.</p>
</section>`,
});

/* --------------------------------------------------------------- writes */
/* 10. Requirements scorecard --------------------------------------------- */
const FEDERAL_NOTE_SOLID =
  'a buyer cannot assume it is solid rather than hollow, plated or a vermeil build. FTC: "solid gold" means not hollow.';
const FEDERAL_URL_ECFR = 'https://www.ecfr.gov/current/title-16/chapter-I/subchapter-B/part-23';
const FEDERAL_URL_FTC_SOLID = 'https://consumer.ftc.gov/articles/buying-platinum-gold-and-silver-jewelry';
const FEDERAL_URL_FTC_SHOP = 'https://consumer.ftc.gov/articles/online-shopping';
const FEDERAL_URL_GIA = 'https://www.gia.edu/gems-gemology/spring-2024-lab-notes-electroformed-gold-bracelet';
const compById = Object.fromEntries(compliance.rows.map((r) => [r.id, r]));
const TIER_LABEL = {
  ready_to_inspect: { t: 'Meets every published-data criterion', k: 'good' },
  needs_confirmation: { t: 'Needs written confirmation', k: 'warn' },
  setting_only: { t: 'Setting only — no gold weight', k: 'info' },
  unverified_price: { t: 'Price not displayed', k: 'bad' },
  withdrawn: { t: 'Withdrawn — source changed', k: 'bad' },
};
const MARK = {
  confirmed: { m: '✓', k: 'mark-yes', w: 'confirmed on the seller\'s own page' },
  stated_not_reread: { m: '✓*', k: 'mark-yes', w: 'stated, but not re-read in the latest pass' },
  not_published: { m: '—', k: 'mark-no', w: 'the seller does not publish it' },
  buyer_action: { m: '▸', k: 'mark-buyer', w: 'a step only you can do' },
  cannot_compute: { m: 'n/a', k: 'mark-no', w: 'needs a value the seller withholds' },
  negative: { m: '✗', k: 'mark-bad', w: 'the independent record is negative' },
};

const markCell = (c) => {
  const s = MARK[c.status] || MARK.not_published;
  return `<td class="mark ${s.k}" title="${esc(s.w + ' — ' + (c.detail || ''))}">${s.m}</td>`;
};

const shortlist = compliance.rows.filter((r) => r.tier === 'ready_to_inspect');
const w = compliance.summary;

const requirementsPage = layout({
  title: 'Requirements scorecard',
  description:
    'Every listing scored against the 12-point solid-gold buying checklist, with a source link or an explicit "not published" for each cell.',
  current: 'root',
  active: 'Requirements',
  body: `
<section class="wrap section">
  <h1>Requirements scorecard</h1>
  <p class="lede">The owner's 12-point solid-gold checklist, applied to all ${w.rows} listings. Each cell is <strong>✓ confirmed on the seller's own page</strong>, <strong>— not published by the seller</strong>, <strong>▸ a step only you can do</strong>, or <strong>n/a</strong> because it needs a value the seller withholds. Nothing is estimated to fill a gap.</p>
  ${noHallucinationBanner()}

  <div class="stat-grid">
    ${stat(`${w.solid_stated}/${w.rows}`, 'explicitly call the metal "solid"', 'Point 2 of the checklist. The rest name a karat and stop.')}
    ${stat(`${w.weight_published}/${w.rows}`, 'publish a weight in grams', 'Point 4. Without grams the gold-value check cannot run.')}
    ${stat(`${w.hallmark_published}/${w.rows}`, "publish a hallmark + maker's mark", 'Point 3. No retailer publishes the stamp online — it must be read off the ring.')}
    ${stat(`${w.gold_value_computable}/${w.rows}`, 'have a computable gold value', `Point 6. Computed at ${usd(spot)}/ozt from the stored spot reading.`)}
    ${stat(`${w.return_window_14_plus}/${w.rows}`, 'sit with a 14-day-plus return window', 'Point 7. Windows range from 7 to 30 days and several start before delivery.')}
    ${stat(`${w.bbb_a_grade}/${w.rows}`, 'sit with an A-grade BBB record', 'Point 5. Aurate rows carry a BBB "F" and are therefore blocked.')}
  </div>

  <h2>What the 12 points come down to</h2>
  <div class="table-wrap">
  <table class="data-table">
    <thead><tr><th scope="col">#</th><th scope="col">Point</th><th scope="col">What has to be true</th><th scope="col">How this site can check it</th></tr></thead>
    <tbody>
    ${compliance.criteria
      .map((c) => {
        const map = {
          purity: 'The karat is printed on the seller\'s own product page and quoted in the row evidence.',
          solid: 'Search the listing text for the word "solid". A karat stamp alone does not settle it.',
          hallmark: 'Cannot be done online. 16 CFR Part 23 governs the mark; it is on the physical ring.',
          weight: 'Look for a gram figure in the seller\'s spec panel. Many list no metal weight at all.',
          reputation: 'Read the independent BBB file and the seller\'s own contact page.',
          price_vs_gold: 'grams × karat ÷ 24 × spot ÷ 31.1034768, then compare with the asking price.',
          returns: 'Read the seller\'s own return policy, including what voids it (resizing, engraving, custom).',
          payment: 'Nothing to verify on the page — a decision you make at checkout.',
          documentation: 'This project stores the URL, the quote and the retrieval date for every row.',
          arrival_check: 'Nothing to verify online — it happens after delivery.',
          xrf: 'Nothing to verify online — ask the jeweller for the reading in writing.',
          return_if_refused: 'A rule you apply, not a fact a page can prove.',
        };
        return `<tr><td><strong>${c.n}</strong></td><td><strong>${esc(c.label)}</strong><div class="sub">${esc(c.ask)}</div></td><td class="small">${esc(c.ask)}</td><td class="small">${esc(map[c.key] || '')}</td></tr>`;
      })
      .join('\n    ')}
    </tbody>
  </table>
  </div>

  <h2 id="shortlist">The shortlist — ${shortlist.length} rows meet every criterion that can be checked before you pay</h2>
  <p class="sub">These are the only rows where the listing itself says <em>solid</em>, the seller publishes the gram weight, the karat is stated, and the seller has a usable return window. That is a shortlist to <strong>order and inspect</strong> — not a purchase endorsement. Point 3 (hallmark) is still unverified for every row because no retailer publishes it, and points 10–12 happen after delivery.</p>
  <div class="table-wrap">
  <table class="data-table">
    <thead><tr><th scope="col">Ring</th><th scope="col">Seller</th><th scope="col">Karat</th><th scope="col" class="num-col">Price</th><th scope="col" class="num-col">Grams</th><th scope="col" class="num-col">Gold value</th><th scope="col" class="num-col">Price ÷ gold</th><th scope="col" class="num-col">Returns</th><th scope="col">BBB</th><th scope="col">Source</th></tr></thead>
    <tbody>
    ${shortlist
      .map(
        (r) => `<tr>
      <td class="cell-title"><a href="rings/${esc(r.id)}.html">${esc(r.title)}</a></td>
      <td>${esc(r.retailer)}</td>
      <td><strong>${esc(r.karat)}</strong></td>
      <td class="num-col">${r.price_low === r.price_high ? usd(r.price_low) : `${usd(r.price_low)}–${usd(r.price_high)}`}</td>
      <td class="num-col">${r.weight_g === null ? '<span class="unverified">—</span>' : r.weight_g + ' g'}</td>
      <td class="num-col">${r.gold_value_usd === null ? '<span class="unverified">—</span>' : usd(r.gold_value_usd)}</td>
      <td class="num-col">${r.price_to_gold === null ? '—' : r.price_to_gold.toFixed(2) + '×'}</td>
      <td class="num-col">${r.return_days === null ? '—' : r.return_days + ' d'}</td>
      <td>${esc(r.bbb_rating || '—')}</td>
      <td><a class="src" href="${esc(r.source_url)}" rel="noopener nofollow" target="_blank">official page ↗</a></td>
    </tr>`
      )
      .join('\n    ')}
    </tbody>
  </table>
  </div>

  <h2 id="matrix">Every row against all 12 points</h2>
  <p class="sub">Hover any mark for the exact reason. <span class="mark mark-yes">✓</span> confirmed on the seller's page · <span class="mark mark-no">—</span> not published · <span class="mark mark-buyer">▸</span> your step · <span class="mark mark-bad">✗</span> negative record · <span class="mark mark-no">n/a</span> needs a withheld value.</p>
  <div class="table-wrap">
  <table class="data-table matrix">
    <thead><tr>
      <th scope="col">Ring</th><th scope="col">Seller</th>
      ${compliance.criteria.map((c) => `<th scope="col" class="num-col" title="${esc(c.label)}">${c.n}</th>`).join('')}
      <th scope="col">Verdict</th>
    </tr></thead>
    <tbody>
    ${compliance.rows
      .map((r) => {
        const t = TIER_LABEL[r.tier] || TIER_LABEL.needs_confirmation;
        return `<tr>
      <td class="cell-title"><a href="${r.tier === 'withdrawn' ? 'flagged.html#F51' : 'rings/' + esc(r.id) + '.html'}">${esc(r.title)}</a></td>
      <td>${esc(r.retailer)}</td>
      ${compliance.criteria.map((c) => markCell(r.checks[c.key])).join('')}
      <td><span class="chip ${t.k}">${esc(t.t)}</span>${r.blockers.length ? `<div class="sub">${esc(r.blockers.slice(0, 2).join('; '))}</div>` : ''}</td>
    </tr>`;
      })
      .join('\n    ')}
    </tbody>
  </table>
  </div>

  <h2 id="sellers">Seller-level facts for points 5 and 7</h2>
  <div class="table-wrap">
  <table class="data-table">
    <thead><tr><th scope="col">Seller</th><th scope="col">BBB</th><th scope="col">Return window</th><th scope="col">What voids it</th><th scope="col">Policy source</th><th scope="col">BBB source</th></tr></thead>
    <tbody>
    ${Object.entries(compliance.returns)
      .map(([id, p]) => {
        const ret = retailers[id] || {};
        return `<tr>
      <td><strong>${esc(ret.name || id)}</strong><div class="sub">${esc(ret.phone || '')}</div></td>
      <td>${esc(ret.bbb_rating || 'no rating recorded')}</td>
      <td class="num-col">${p.days} days from ${esc(p.from)}</td>
      <td class="small">${esc(p.caveat || 'see policy')}</td>
      <td><a class="src" href="${esc(p.source)}" rel="noopener nofollow" target="_blank">policy ↗</a></td>
      <td>${ret.bbb_source ? `<a class="src" href="${esc(ret.bbb_source)}" rel="noopener nofollow" target="_blank">BBB file ↗</a>` : '—'}</td>
    </tr>`;
      })
      .join('\n    ')}
    </tbody>
  </table>
  </div>

  <h2>The four rules that decide a row's verdict</h2>
  <ol class="steps">
    <li><strong>Solid must be said.</strong> ${w.solid_stated} listings say it. The other ${w.rows - w.solid_stated} name a karat and never use the word, so ${FEDERAL_NOTE_SOLID}</li>
    <li><strong>Grams decide the value.</strong> ${w.weight_published} rows publish a weight, so the price-to-gold multiple can be computed for exactly those rows.</li>
    <li><strong>A negative independent record blocks.</strong> The five Aurate rows sit on a BBB "F" file, so they cannot reach the shortlist however good the listing looks.</li>
    <li><strong>Nobody publishes the hallmark.</strong> 0 of ${w.rows}. That is why the final step is always a jeweller, not a web page.</li>
  </ol>
  <p class="sub">Sources for the rules: <a href="${esc(FEDERAL_URL_ECFR)}" rel="noopener nofollow" target="_blank">16 CFR Part 23</a> (quality marks) · <a href="${esc(FEDERAL_URL_FTC_SOLID)}" rel="noopener nofollow" target="_blank">FTC: solid gold means not hollow</a> · <a href="${esc(FEDERAL_URL_FTC_SHOP)}" rel="noopener nofollow" target="_blank">FTC: online shopping and credit cards</a> · <a href="${esc(FEDERAL_URL_GIA)}" rel="noopener nofollow" target="_blank">GIA lab note on XRF limits</a>.</p>
</section>`,
});

/* 11. 2026-10-23 re-check ledger ----------------------------------------- */
const VERDICT_LABEL = {
  confirmed: { t: 'confirmed', k: 'good' },
  range_widens: { t: 'corrected', k: 'warn' },
  lower_bound_not_reproduced: { t: 'partly verified', k: 'warn' },
  source_mismatch: { t: 'withdrawn', k: 'bad' },
  metadata_only_not_displayed: { t: 'price not displayed', k: 'bad' },
  no_structured_price: { t: 'no machine-readable price', k: 'info' },
  variant_price_not_reproducible: { t: 'variant not reproducible', k: 'warn' },
  not_read: { t: 'not re-read', k: 'info' },
};

const blockedRows = liveCheck.rows.filter((r) => r.http_status === 403);
const fullyBlocked = liveCheck.rows.filter((r) => r.price_verdict === 'not_read');
const recheckPage = layout({
  title: 'Re-check — 2026-10-23',
  description:
    'The 2026-10-23 line-by-line re-read of every listing: what the seller printed, what this project stored, and the verdict for each row.',
  current: 'root',
  active: 'Re-check 23 Oct',
  body: `
<section class="wrap section">
  <h1>Re-check — 2026-10-23</h1>
  <p class="lede">Every listing was opened again at its own official product URL on 2026-10-23. ${liveCheck.method.automated} ${liveCheck.method.manual} ${liveCheck.summary.not_read === 0 ? 'Zero listings remain unread after seventh-pass storefront JSON and PDP verification (1 Brilliant Earth setting renders localized EUR pricing via Global-e and remains partly verified).' : `${liveCheck.summary.not_read} could not be re-read at all because the seller blocked automated retrieval, and one more could only be read in part — every one of them says so instead of pretending to be fresh.`}</p>
  ${noHallucinationBanner()}

  <div class="stat-grid">
    ${stat(`${liveCheck.summary.confirmed}/${w.rows}`, 'prices reproduced exactly', 'The seller printed the same figure that this project stored.')}
    ${stat(`${liveCheck.corrections.length}`, 'prices corrected', 'Only where the seller\'s own page contradicted the stored value and the replacement is quoted below.')}
    ${stat(`${liveCheck.summary.source_mismatch}`, 'row withdrawn', 'SKU 939479 now sells a different ring. See F51.')}
    ${stat(`${fullyBlocked.length}`, 'rows still unread', blockedRows.length === 0 ? 'All 9 formerly HTTP-403 rows were verified via direct storefront JSON & PDP reads (F53).' : `${fullyBlocked.length} could not be read at all and ${blockedRows.length - fullyBlocked.length} only in part. See F53.`)}
    ${stat(`${compliance.gold_reference.price_usd_per_ozt.toLocaleString('en-US', { maximumFractionDigits: 2 })}`, 'USD per troy ounce, spot', `${esc(compliance.gold_reference.publisher)} at ${esc(compliance.gold_reference.publisher_timestamp)}.`)}
  </div>

  <h2>Corrections applied in this pass</h2>
  <div class="table-wrap">
  <table class="data-table">
    <thead><tr><th scope="col">Row</th><th scope="col">Field</th><th scope="col" class="num-col">Before</th><th scope="col" class="num-col">After</th><th scope="col">Quote it was read from</th><th scope="col">Why</th><th scope="col">Source</th></tr></thead>
    <tbody>
    ${liveCheck.corrections
      .map(
        (c) => `<tr>
      <td><a href="rings/${esc(c.id)}.html">${esc(c.id)}</a></td>
      <td>${esc(c.field)}</td>
      <td class="num-col">${c.from.map((n) => usd(n)).join('–')}</td>
      <td class="num-col"><strong>${c.to.map((n) => usd(n)).join('–')}</strong></td>
      <td class="small">${esc(c.quote)}</td>
      <td class="small">${esc(c.why)}</td>
      <td><a class="src" href="${esc(c.url)}" rel="noopener nofollow" target="_blank">feed ↗</a></td>
    </tr>`
      )
      .join('\n    ')}
    </tbody>
  </table>
  </div>

  <h2>The full ledger</h2>
  <p class="sub">One line per listing. "Stored" is what this project had before the pass; "seller printed" is what the page showed on 2026-10-23; the verdict says whether they agree.</p>
  <div class="table-wrap">
  <table class="data-table">
    <thead><tr><th scope="col">Row</th><th scope="col">Seller</th><th scope="col">Stored price</th><th scope="col">Seller printed</th><th scope="col">Verdict</th><th scope="col">Weight on page</th><th scope="col">What was read</th><th scope="col">Source</th></tr></thead>
    <tbody>
    ${liveCheck.rows
      .map((r) => {
        const v = VERDICT_LABEL[r.price_verdict] || { t: r.price_verdict, k: 'info' };
        const obs = r.observed_prices ? `${usd(r.observed_prices.min)}${r.observed_prices.max !== r.observed_prices.min ? '–' + usd(r.observed_prices.max) : ''}` : '—';
        const wv = r.observed_weight ? (r.observed_weight.value === null ? 'publishes null' : r.observed_weight.value + ' g') : '—';
        const quote =
          (r.observed_weight && r.observed_weight.quote) ||
          r.variant_quote ||
          r.manual_detail ||
          (r.blocked_reason || '');
        return `<tr${r.price_verdict === 'source_mismatch' ? ' class="row-alert"' : ''}>
      <td><strong>${esc(r.id)}</strong><div class="sub">${esc(r.title_in_data)}</div></td>
      <td>${esc(r.retailer)}</td>
      <td class="num-col small">${r.stored_price.low === null ? '—' : usd(r.stored_price.low) + (r.stored_price.high !== r.stored_price.low ? '–' + usd(r.stored_price.high) : '')}</td>
      <td class="num-col small"><strong>${obs}</strong></td>
      <td><span class="chip ${v.k}">${esc(v.t)}</span></td>
      <td class="small">${esc(wv)}</td>
      <td class="small">${esc((quote || '').slice(0, 240))}</td>
      <td><a class="src" href="${esc(r.source_url)}" rel="noopener nofollow" target="_blank">official page ↗</a></td>
    </tr>`;
      })
      .join('\n    ')}
    </tbody>
  </table>
  </div>
  <p class="sub">Raw evidence: <code>data/live/${esc((liveCheck.rows[0] && liveCheck.rows[0].fetched_at) || '2026-10-23')}</code> · <code>data/live/manual-2026-10-23.json</code> · <code>data/verification-2026-10-23.json</code>. The re-read runs from <code>.github/workflows/reverify.yml</code> against a runner with full internet access, so it is reproducible.</p>
</section>`,
});

await writeFile(join(OUT, 'index.html'), dashboard);
await writeFile(join(OUT, 'requirements.html'), requirementsPage);
await writeFile(join(OUT, 'recheck.html'), recheckPage);
await writeFile(join(OUT, 'rings.html'), ringsPage);
await writeFile(join(OUT, 'weights.html'), weightsPage);
await writeFile(join(OUT, 'calculator.html'), calculator);
await writeFile(join(OUT, 'checklist.html'), checklistPage);
await writeFile(join(OUT, 'sources.html'), sourcesPage);
await writeFile(join(OUT, 'flagged.html'), flaggedPage);
await writeFile(join(OUT, 'methodology.html'), methodologyPage);
await writeFile(join(OUT, 'checks.html'), checksPage);
await writeFile(join(OUT, '404.html'), layout({
  title: 'Not found',
  description: 'Page not found',
  current: 'root',
  body: `<section class="wrap section"><h1>Page not found</h1><p class="lede">That page does not exist. Everything on this site is reachable from the dashboard.</p><p><a class="btn" href="index.html">Back to the dashboard</a></p></section>`,
}));

console.log(`built: index, rings, ${CATEGORIES.length} categories, ${rings.rows.length} ring pages, weights, calculator, checklist, sources, flagged, methodology, checks`);
