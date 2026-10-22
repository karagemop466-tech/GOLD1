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
const recheckDoc = await read('data/recheck.json').catch(() => ({ results: [], summary: {}, checked_on: null }));

const retailers = Object.fromEntries(retailersDoc.retailers.map((r) => [r.id, r]));
const spot = gold.primary.price_usd_per_ozt;
const GRAMS_PER_OZT = gold.grains_per_troy_ounce;
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
  if (r.price_low === null) return dash;
  if (r.price_low === r.price_high) return `<span class="num">${usd(r.price_low)}</span>`;
  return `<span class="num">${usd(r.price_low)} – ${usd(r.price_high)}</span>`;
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
  price_changed: 'price moved since capture',
  price_unconfirmed: 'price not re-confirmed',
  availability_unconfirmed: 'availability unconfirmed',
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
const retrievedDates = [...new Set(rings.rows.map((r) => r.retrieved_at))].sort();

/* ------------------------------------------------------------------ layout */
const NAV = [
  ['index.html', 'Dashboard'],
  ['rings.html', 'All rings'],
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
  <p>Every price, karat and weight below is copied from the seller's own product feed and linked on the same row. <strong>Nothing is estimated, averaged or remembered.</strong> If a value was not confirmed on an official source it is shown as <span class="unverified">— unverified</span> and listed on the <a href="${prefix}flagged.html">Flagged for review</a> page. Re-check against the source link before you buy: prices change without notice.</p>
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
    ${withWeight ? '<th scope="col">Weight</th>' : ''}
    <th scope="col">Re-checked</th>
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
  price_changed: 'The retailer changed the price after this row was captured. The row now shows the newer, re-read price.',
  price_unconfirmed: 'The stored price could not be re-read on this visit to the seller page, so it is presented as historical, not current.',
  availability_unconfirmed: 'The seller\'s own search no longer returns this SKU. The piece may be gone; nothing is claimed either way.',
};

const RECHECK_META = {
  matched: { label: 're-read 2026-10-22', kind: 'ok', title: 'Price on the seller page matched this row on 2026-10-22.' },
  price_changed: { label: 'price corrected', kind: 'warn', title: 'The seller price had moved; this row now shows the re-read price.' },
  title_corrected: { label: 'title corrected', kind: 'warn', title: 'The stored title was a paraphrase and was replaced with the seller\'s exact string.' },
  partial: { label: 'partly re-checked', kind: 'warn', title: 'Part of this listing was re-read; at least one value is still historical.' },
  not_indexed: { label: 'could not confirm', kind: 'bad', title: 'The seller\'s own search returned nothing for this SKU on 2026-10-22.' },
  not_rechecked: { label: 'not re-checked', kind: '', title: 'This row keeps the value captured in an earlier pass. It is not a price for today.' },
};
const recheckMeta = (r) => RECHECK_META[r.recheck_result] || RECHECK_META.not_rechecked;
const recheckChip = (r) => {
  const m = recheckMeta(r);
  return `<span class="chip ${m.kind}" title="${esc(m.title)}">${esc(m.label)}</span>`;
};
const OPENED = ['matched', 'price_changed', 'title_corrected', 'partial'];
const recheckedCount = rings.rows.filter((r) => OPENED.includes(r.recheck_result)).length;
const returnsVerified = retailersDoc.retailers.filter((r) => r.return_policy_verified && retailerCounts[r.id]);
const returnsUnverified = retailersDoc.retailers.filter((r) => !r.return_policy_verified && retailerCounts[r.id]);
const missingCount = rings.rows.filter((r) => r.recheck_result === 'not_indexed').length;

const rowHtml = (r, prefix = '') => {
  const weight =
    r.weight_g_low === null
      ? '<span class="unverified">— unverified</span>'
      : r.weight_g_low === r.weight_g_high
        ? `${r.weight_g_low} g`
        : `${r.weight_g_low}–${r.weight_g_high} g`;
  const flags = (r.flags || [])
    .filter((f) => f !== 'weight_not_published')
    .map((f) => chip(flagText(f), 'chip-warn'))
    .join(' ');
  return `<tr data-category="${esc(r.category)}" data-retailer="${esc(r.retailer_id)}" data-karat="${esc(r.karat)}" data-price="${r.price_low}" data-title="${esc((r.title + ' ' + r.retailer + ' ' + (r.stone_type || '') + ' ' + (r.stone || '')).toLowerCase())}">
    <td class="cell-title"><a href="${prefix}rings/${r.id}.html">${esc(r.title)}</a><div class="sub">${esc(r.style)}</div></td>
    <td>${esc(r.retailer)}</td>
    <td><strong>${esc(r.karat)}</strong></td>
    <td>${esc(r.metal)}<div class="sub">${esc(r.stone_type || r.stone || '—')}</div></td>
    <td class="num-col">${priceCell(r)}</td>
    <td class="small">${esc(r.price_basis)}</td>
    <td class="small">${weight}${r.weight_evidence ? `<div class="sub">published by seller</div>` : ''}</td>
    <td class="small">${recheckChip(r)}</td>
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
  ${rows.map((r) => rowHtml(r, prefix)).join('\n  ')}
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
      <option value="14K">14K</option>
      <option value="18K">18K</option>
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
  const low = Math.min(...rows.map((r) => r.price_low).filter((n) => n !== null));
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
    'A verified, source-linked list of solid gold engagement rings from four US retailers, with a gold-value calculator and a hallucination audit.',
  current: 'root',
  active: 'Dashboard',
  body: `
<section class="hero">
  <div class="wrap">
    <p class="eyebrow">Research dashboard · data downloaded ${esc(retrievedDates.join(', '))}</p>
    <h1>Solid gold engagement rings, checked against the seller's own pages.</h1>
    <p class="lede">${totalRows} listings from ${retailersDoc.retailers.length} retailers, each one linked to the exact official page it came from. Prices are stamped with the date they were read, and every row now says whether it was re-read today or is historical. ${recheckedCount} of ${totalRows} were re-opened in the latest pass (${esc(recheckDoc.pass || 'P12')}, ${esc(recheckDoc.checked_on || '')}) and ${missingCount} more were searched for and not found; the rest are labelled <strong>not re-checked</strong> rather than quietly presented as current. Where the seller does not publish a number — most of them still do not publish metal weight — the field is blank and flagged.</p>
    ${noHallucinationBanner()}
  </div>
</section>

<section class="wrap section">
  <div class="stats">
    ${stat(`${totalRows}`, 'verified listings', 'price + karat from the official feed')}
    ${stat(`${retailersDoc.retailers.length}`, 'retailers', retailersDoc.retailers.filter((r) => retailerCounts[r.id]).map((r) => r.name).join(', '))}
    ${stat(`${CATEGORIES.length}`, 'style categories', 'solitaire through estate')}
    ${stat(`${weightPublished}/${totalRows}`, 'publish metal weight', 'the number you need for a value check')}
    ${stat(`${recheckedCount}/${totalRows}`, 're-read this pass', `prices compared with the seller page on ${esc(recheckDoc.checked_on || '2026-10-22')}`)}
    ${stat(`${solidStated}/${totalRows}`, 'say "solid gold"', 'karat is stated; the word solid is not')}
    ${stat(`${flagged.items.length}`, 'flagged findings', 'published, not hidden')}
  </div>
</section>

<section class="wrap section">
  <div class="callout ${solidStated === 0 ? 'warn' : ''}">
    <h2>Headline finding: karat is everywhere, the word “solid” is rare</h2>
    <p>Every one of the ${totalRows} listings states a karat. <strong>${solidStated === 0 ? 'None' : solidStated}</strong> of them ${solidStated === 1 ? 'states' : 'state'} “solid gold” in the product text — the rest name a karat and nothing more. That does not make them plated (none of the ${totalRows} carries plating language), but the explicit confirmation your checklist asks for is still missing at checkout. See <a href="flagged.html">Flagged for review</a> (F01) for the exact wording to request from each seller.</p>
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
      <div><span class="k">Per gram</span> <strong>${usd(spotPerGram)}</strong></div>
      <div><span class="k">14K gold per gram</span> <strong>${usd(spotPerGram * (14 / 24))}</strong></div>
      <div><span class="k">18K gold per gram</span> <strong>${usd(spotPerGram * (18 / 24))}</strong></div>
      <p class="sub">Cross-check: COMEX front-month futures ${usd(gold.cross_check.price_usd_per_ozt)}/ozt at the same session. <a href="calculator.html">Open the calculator →</a></p>
    </div>
  </div>
</section>

<section class="wrap section" id="latest-pass">
  <h2>What the latest pass changed</h2>
  <div class="callout">
    <p><strong>${esc(recheckDoc.pass || 'P12')} · ${esc(recheckDoc.checked_on || '2026-10-22')}.</strong>
    ${recheckedCount} listings were re-opened on the retailer's own page or feed, and ${missingCount} more were looked for and not returned by the seller's own search. Six metal weights that the sellers do publish were added (Ross-Simons prints a “Gold Weight” figure that earlier passes missed), one price that had moved was corrected, and one paraphrased title was replaced with the seller's exact string.</p>
    <ul class="ticks">
      <li><strong>Weight coverage is now ${weightPublished} of ${totalRows}</strong>, not 1 of ${totalRows} as earlier passes reported. See <a href="flagged.html#F02">F02</a>.</li>
      <li><strong>The two cheapest rings are explained, not suspicious.</strong> $149 is 0.5 g of 14K and $179 is 0.5 g of 18K. See <a href="flagged.html#F06">F06</a>.</li>
      <li><strong>A price had moved:</strong> Ross-Simons 571223 was stored at $799–$849 and is $849 for every size on re-read. See <a href="flagged.html#F31">F31</a>.</li>
      <li><strong>${recheckDoc.summary?.rows_not_rechecked ?? 0} rows were not re-opened</strong> and are labelled as historical. See <a href="flagged.html#F32">F32</a>.</li>
    </ul>
    <p><a class="btn" href="checks.html#recheck-log">See every re-read, line by line →</a></p>
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
        <li><strong>Karat is stated on every listing.</strong> All ${totalRows} rows name 14K or 18K in the official feed.</li>
        <li><strong>${returnsVerified.length} of ${returnsVerified.length + returnsUnverified.length} return policies are confirmed from the retailer's own page.</strong> Ross-Simons allows 30 days from receipt and excludes pieces resized by another jeweller; Aurate allows 14 days from fulfilment; With Clarity 30 calendar days; Anna Sheffield two weeks. ${returnsUnverified.length ? `${esc(returnsUnverified.map((r) => r.name).join(', '))} ${returnsUnverified.length === 1 ? 'is' : 'are'} left blank because the policy was not confirmed on the page read.` : ''}</li>
        <li><strong>Plated metal was excluded, not ranked.</strong> Set &amp; Stones' engagement results were gold-filled and were rejected.</li>
      </ul>
    </div>
    <div>
      <h2>What still needs you</h2>
      <ul class="crosses">
        <li><strong>Weight is still mostly missing.</strong> ${totalRows - weightPublished} of ${totalRows} listings do not publish grams, so the price-versus-gold-value check cannot be finished for them. The ${weightPublished} that do are visible in the Weight column.</li>
        <li><strong>Hallmarks cannot be seen online.</strong> Ask for a photo of the inside of the band, then have a jeweller test it on arrival.</li>
        <li><strong>“Setting only” prices are not ring prices.</strong> ${settingOnly} listed products exclude the centre stone.</li>
      </ul>
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
  <h1>All ${totalRows} verified listings</h1>
  <p class="lede">Sorted as captured. Use the filters to narrow by style, seller, karat or budget. Every row links to the official page it came from and to a detail page showing the exact evidence text.</p>
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
    <dt>Flags</dt><dd>Problems found while verifying. The full explanation of each is on <a href="flagged.html">Flagged for review</a>.</dd>
    <dt>Source</dt><dd>The official product page. Check it yourself before paying.</dd>
  </dl>
</section>`,
});

/* 3. Category pages ----------------------------------------------------- */
for (const c of CATEGORIES) {
  const rows = rowsByCategory[c.slug] || [];
  const low = Math.min(...rows.map((r) => r.price_low).filter((n) => n !== null));
  const high = Math.max(...rows.map((r) => r.price_high).filter((n) => n !== null));
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
    description: `${r.title} at ${r.retailer}: ${usd(r.price_low)}. Verified price, karat and source.`,
    current: 'nested',
    body: `
<section class="wrap section">
  <p class="crumb"><a href="../index.html">Dashboard</a> / <a href="../rings.html">All rings</a> / ${esc(r.retailer)}</p>
  <h1>${esc(r.title)}</h1>
  <p class="lede">${esc(r.style)} · ${esc(r.retailer)} · listed ${usd(r.price_low)}${r.price_low !== r.price_high ? ` – ${usd(r.price_high)}` : ''}</p>
  ${noHallucinationBanner('../')}

  <div class="detail-grid">
    <div class="card">
      <h2>What the seller states</h2>
      <dl class="kv">
        <dt>Karat</dt><dd><strong>${esc(r.karat)}</strong> ${r.solid_stated ? '<span class="chip ok">solid stated</span>' : '<span class="chip warn">“solid” not stated</span>'}</dd>
        <dt>Metal</dt><dd>${esc(r.metal)}</dd>
        <dt>Stone</dt><dd>${esc(r.stone)}${r.stone_type ? `<div class="sub">${esc(r.stone_type)}</div>` : ''}</dd>
        <dt>Price</dt><dd>${priceCell(r)} <div class="sub">${esc(r.price_basis)}</div></dd>
        <dt>Metal weight</dt><dd>${r.weight_g_low === null ? dash : `${r.weight_g_low}${r.weight_g_high && r.weight_g_high !== r.weight_g_low ? '–' + r.weight_g_high : ''} g <span class="sub">as published by the seller</span>`}</dd>
        ${r.weight_evidence ? `<dt>Weight, as written</dt><dd class="small">${esc(r.weight_evidence)}${r.weight_source_url ? ` <a href="${esc(r.weight_source_url)}" target="_blank" rel="noopener nofollow">source ↗</a>` : ''}</dd>` : ''}
        <dt>Retrieved</dt><dd>${esc(r.retrieved_at)}${r.inherited ? ' <span class="chip info">carried over from the first research pass</span>' : ''}</dd>
        <dt>Re-checked</dt><dd>${recheckChip(r)}${r.recheck_method ? `<div class="sub">${esc(r.recheck_method)}${r.recheck_url ? ` · <a href="${esc(r.recheck_url)}" target="_blank" rel="noopener nofollow">what was opened ↗</a>` : ''}</div>` : ''}${r.recheck_result === 'not_rechecked' ? '<div class="sub">This price is from an earlier pass. It is not a price for today.</div>' : ''}${r.price_unconfirmed ? '<div class="sub"><strong>Price not re-confirmed:</strong> the stored figure is historical.</div>' : ''}</dd>
        <dt>Read from</dt><dd>${esc(r.source_type || 'official product page')}</dd>
      </dl>
      <p><a class="btn" href="${esc(r.source_url)}" target="_blank" rel="noopener nofollow">Open the official product page ↗</a></p>
      <p class="sub">If the price on that page differs from the price here, the page wins. This site records what the feed said on ${esc(r.retrieved_at)}.</p>
    </div>

    <div class="card">
      <h2>Evidence captured</h2>
      <p class="quote">${esc(r.evidence)}</p>
      <p class="sub">Copied from the official product feed for this exact product. It is the only basis for the numbers above.</p>
      <h3>Gold value check</h3>
      ${
        melt
          ? `<p>At ${usd(spot)}/ozt, the published ${r.weight_g_low}${r.weight_g_high && r.weight_g_high !== r.weight_g_low ? '–' + r.weight_g_high : ''} g of ${r.karat} contains <strong>${Math.abs(melt.hi - melt.lo) < 0.01 ? usd(melt.lo) : `${usd(melt.lo)} – ${usd(melt.hi)}`}</strong> of gold. The listed price is <strong>${(r.price_low / melt.hi).toFixed(1)}×</strong> the top of that range.</p>
             <p class="sub">Weight source: the seller's own page${r.weight_evidence ? ` — “${esc(r.weight_evidence)}”` : ''}. Gold price: ${esc(gold.primary.publisher)} at ${esc(gold.primary.publisher_timestamp)}.</p>
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
      </dl>
      <p class="sub">${ret.return_policy_verified ? `Source: <a href="${esc(ret.return_source)}" target="_blank" rel="noopener nofollow">official refund policy ↗</a>` : `Policy page: <a href="${esc(ret.return_source)}" target="_blank" rel="noopener nofollow">link ↗</a> — terms not reviewed in this pass, so left blank.`}</p>
      <h3>Before you pay</h3>
      <ol class="steps">
        <li>Ask the seller to confirm in writing: solid ${esc(r.karat)} gold, not plated, not vermeil, not gold-filled.</li>
        <li>Ask for the metal weight in grams for your exact size, and a close-up photo of the stamp inside the band.</li>
        <li>Pay by credit card. Keep the listing, the chat and the receipt.</li>
        <li>On arrival, have an independent jeweller check weight and purity (XRF preferred) before wearing or resizing.</li>
      </ol>
    </div>
  </div>
</section>`,
  });
  await writeFile(join(OUT, 'rings', `${r.id}.html`), html);
}

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
  <p>The Aurate Modern Cigar Band is the only listing here that publishes a weight: 2.6–4 g at 14K, listed at ${usd(1308)}. That is ${usd(2.6 * (14 / 24) * spotPerGram)}–${usd(4 * (14 / 24) * spotPerGram)} of gold, or about ${(1308 / (4 * (14 / 24) * spotPerGram)).toFixed(1)}× the top of the metal range. For a wide designer band that is a normal retail multiple, and it is checkable — which is the point.</p>
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
  <p>The retailers in scope publish machine-readable product feeds at <code>/products.json</code> and <code>/search/suggest.json</code>. Those endpoints are the seller's own catalogue — the same data their product page renders — which makes them the strongest available primary source short of a signed quote. Prices, titles, metal descriptions and variant ranges were read from those feeds on ${esc(retrievedDates.join(', '))}. Policy text was read from the retailers' own <code>/policies/refund-policy</code> pages. The gold price was read from a market-data publisher and cross-checked against COMEX futures.</p>
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
    <li><strong>Weight is traceable too.</strong> A published weight must appear, digit for digit, in the weight evidence copied from the seller page. A weight that is not in the evidence fails the run.</li>
    <li><strong>The re-check log is honest.</strong> Every row must carry a re-check status; a row may only claim it was re-read on a dated pass, and a row that was not re-read may not present its price as current.</li>
  </ol>

  <h2>3b. Re-reading, not re-asserting</h2>
  <p>Each review pass re-opens a subset of the listings on the retailer's own page and compares what is there with what the row stores. The result of every comparison is written to <code>data/recheck.json</code> and printed on <a href="checks.html#recheck-log">Checks</a>: the price before, the price read, the weight read, the URL that was opened and the date. A row that was not re-opened keeps its earlier value and is labelled <strong>not re-checked</strong> — it is never silently refreshed and never presented as today's price.</p>

  <h2>4. Limits you should know</h2>
  <ul class="crosses">
    <li><strong>Prices move.</strong> The numbers are a snapshot from ${esc(retrievedDates.join(', '))}. The retailer page always wins.</li>
    <li><strong>Weight is mostly missing.</strong> ${weightPublished} of ${totalRows} listings publish grams. The value comparison cannot be completed for the rest, and this site refuses to fill that gap with an estimate.</li>
    <li><strong>Hallmarks are physical.</strong> No stamp can be verified from a web page. A photo of the stamp is evidence of what is written, not proof of what the metal is. XRF or an assay by an independent jeweller is the only real test.</li>
    <li><strong>Reputation is not scored here.</strong> Seller verification in this pass means: official store identity plus a verifiable phone or support email. It is not a rating and it is not an endorsement.</li>
    <li><strong>${retailersDoc.retailers.length} US retailers.</strong> This is a curated sample, not the whole market. Coverage is stated so you can judge the gap.</li>
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
    <thead><tr><th>Pass</th><th>Run at</th><th class="num-col">Checks</th><th class="num-col">Failed</th><th>Result</th></tr></thead>
    <tbody>
      ${(await read('data/checks/history.json').catch(() => ({ runs: [] }))).runs
        .map(
          (h) => `<tr><td>${esc(h.pass)}</td><td>${esc(h.generated_at)}</td><td class="num-col">${h.total}</td><td class="num-col">${h.failed}</td><td>${h.failed === 0 ? '<span class="chip ok">pass</span>' : '<span class="chip bad">fail</span>'}</td></tr>`,
        )
        .join('') || '<tr><td colspan="5" class="muted">No history yet.</td></tr>'}
    </tbody>
  </table>
  </div>`;
}

function recheckLogTable() {
  const rs = recheckDoc.results || [];
  if (!rs.length) return '<h2 id="recheck-log">Re-check log</h2><p class="muted">No re-check log recorded yet.</p>';
  const fmt = (n) => (n === null || n === undefined ? '—' : usd(n));
  return `
  <h2 id="recheck-log">Re-check log — ${esc(recheckDoc.pass)} · ${esc(recheckDoc.checked_on)}</h2>
  <p>One line per listing re-opened in the latest pass. <strong>Before</strong> is what the row stored; <strong>read</strong> is what the retailer's page showed when it was opened. A dash means the page did not publish that number — it never means zero, and it is never filled in.</p>
  <div class="table-wrap">
  <table class="data-table compact">
    <thead><tr><th>Listing</th><th>What was opened</th><th class="num-col">Price before</th><th class="num-col">Price read</th><th class="num-col">Weight read</th><th>Result</th></tr></thead>
    <tbody>
      ${rs.map((x) => `<tr>
        <td><a href="rings/${esc(x.ring_id)}.html">${esc(x.title)}</a><div class="sub">${esc(x.retailer)} · ${esc(x.ring_id)}</div></td>
        <td class="small"><a href="${esc(x.url)}" target="_blank" rel="noopener nofollow">${esc(x.method)} ↗</a></td>
        <td class="num-col small">${x.price_before && x.price_before[0] !== null ? `${fmt(x.price_before[0])}${x.price_before[1] !== x.price_before[0] ? ' – ' + fmt(x.price_before[1]) : ''}` : '—'}</td>
        <td class="num-col small">${x.price_read ? `${fmt(x.price_read[0])}${x.price_read[1] !== x.price_read[0] ? ' – ' + fmt(x.price_read[1]) : ''}` : '—'}</td>
        <td class="num-col small">${x.weight_read_g ? `${x.weight_read_g[0]}${x.weight_read_g[1] !== x.weight_read_g[0] ? '–' + x.weight_read_g[1] : ''} g` : '—'}</td>
        <td class="small">${(RECHECK_META[x.result] || RECHECK_META.not_rechecked).kind === 'ok' ? '<span class="chip ok">matched</span>' : (RECHECK_META[x.result] || RECHECK_META.not_rechecked).kind === 'bad' ? '<span class="chip bad">could not confirm</span>' : '<span class="chip warn">changed / partial</span>'}<div class="sub">${esc(x.note)}</div></td>
      </tr>`).join('')}
    </tbody>
  </table>
  </div>
  <p class="sub">${recheckDoc.summary.rows_total} rows in total · ${recheckDoc.summary.rows_rechecked} re-opened · ${recheckDoc.summary.rows_not_indexed} not returned by the seller's search · ${recheckDoc.summary.rows_not_rechecked} not re-opened and therefore labelled historical.</p>`;
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
  ${recheckLogTable()}
  <h2>Run it yourself</h2>
  <p><code>node scripts/verify.mjs</code> — no dependencies, no network. The output is written to <code>data/checks/latest.json</code> and summarised above.</p>
</section>`,
});

/* --------------------------------------------------------------- writes */
await writeFile(join(OUT, 'index.html'), dashboard);
await writeFile(join(OUT, 'rings.html'), ringsPage);
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

console.log(`built: index, rings, ${CATEGORIES.length} categories, ${rings.rows.length} ring pages, calculator, checklist, sources, flagged, methodology, checks`);
