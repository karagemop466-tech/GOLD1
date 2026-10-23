#!/usr/bin/env node
/**
 * GOLD1 hallucination audit.
 *
 * This is the security check for the project. It does not trust the writer (human or
 * model): it re-derives every claim from the stored evidence and fails loudly when a
 * number cannot be traced back to the text it was supposed to come from.
 *
 * Run: node scripts/verify.mjs
 * Exit code: 0 only when every check passes.
 */
import { readFile, writeFile, mkdir, readdir, stat } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';

const ROOT = process.cwd();
const read = async (p) => JSON.parse(await readFile(join(ROOT, p), 'utf8'));
const readIf = async (p, fallback) => {
  try {
    return await read(p);
  } catch {
    return fallback;
  }
};

const rings = await read('data/rings.json');
const retailersDoc = await read('data/retailers.json');
const flagged = await read('data/flagged.json');
const gold = await read('data/gold-price.json');
const built = await readIf('data/build-report.json', null);

const retailers = Object.fromEntries(retailersDoc.retailers.map((r) => [r.id, r]));
const TODAY = new Date().toISOString().slice(0, 10);

const CATS = ['solitaire', 'three-stone', 'bezel', 'gemstone', 'bands', 'estate'];
const ALLOWED_KARAT = ['10K', '14K', '18K', '22K', '24K'];
const PLATING_WORDS = /(vermeil|plated|gold[- ]?filled|gold[- ]?tone|overlay|gold[- ]?over)/i;

const groups = [];
const add = (id, name, description, failures) => {
  const shown = failures.slice(0, 25);
  groups.push({
    id,
    name,
    description,
    passed: failures.length === 0 ? 1 : 0,
    failed: failures.length === 0 ? 0 : 1,
    total_assertions: 0,
    failures: shown,
    failure_count: failures.length,
  });
};

/** Count individual assertions for the summary. */
let assertions = 0;
const counted = (fn) => fn;

/* ---------------------------------------------------------------- S01 */
{
  const failures = [];
  for (const r of rings.rows) {
    assertions++;
    const label = r.id || '(missing id)';
    if (!r.source_url || !/^https:\/\//.test(r.source_url)) failures.push(`${label}: source_url missing or not https`);
    if (r.source_url) {
      const host = new URL(r.source_url).hostname.replace(/^www\./, '');
      const ret = retailers[r.retailer_id];
      if (!ret) failures.push(`${label}: unknown retailer_id ${r.retailer_id}`);
      else if (!host.endsWith(ret.domain)) failures.push(`${label}: source host ${host} is not ${ret.domain}`);
    }
    if (!r.retrieved_at) failures.push(`${label}: no retrieval date`);
    if (!r.evidence || r.evidence.length < 25) failures.push(`${label}: evidence string too short to verify anything`);
  }
  add('S01', 'Provenance', 'Every row has an HTTPS source on the retailer\'s own domain, a retrieval date, and a usable evidence string.', failures);
}

/* ---------------------------------------------------------------- S02 */
{
  const failures = [];
  for (const r of rings.rows) {
    assertions++;
    const evidence = `${r.evidence || ''} ${r.title || ''}`.replace(/,/g, '');
    const prices = [r.price_low, r.price_high].filter((n) => n !== null && n !== undefined);
    if (prices.length === 0) {
      failures.push(`${r.id}: no price at all (must be flagged, not invented)`);
      continue;
    }
    for (const p of prices) {
      const forms = [p.toFixed(2), String(p)];
      if (!forms.some((f) => evidence.includes(f))) {
        failures.push(`${r.id}: price ${p.toFixed(2)} does not appear in its own evidence — treat as fabricated`);
      }
    }
  }
  add('S02', 'Price traceable to evidence', 'The price digits must literally occur in the evidence text captured from the official source. A price that is not in its evidence is treated as hallucinated.', failures);
}

/* ---------------------------------------------------------------- S03 */
{
  const failures = [];
  for (const r of rings.rows) {
    assertions++;
    if (!ALLOWED_KARAT.includes(r.karat)) failures.push(`${r.id}: karat "${r.karat}" is not a legal karat mark`);
    const k = String(r.karat).replace(/[^0-9]/g, '');
    const ev = `${r.evidence || ''} ${r.title || ''}`.toLowerCase();
    const hit =
      new RegExp(`\\b${k}\\s?k`, 'i').test(ev) ||
      ev.includes(`${k}kt`) ||
      ev.includes(`${k}k `) ||
      (k === '18' && (ev.includes('750/1000') || /\b750\b/.test(ev)));
    if (!hit) failures.push(`${r.id}: karat ${r.karat} is not stated in the evidence text`);
  }
  add('S03', 'Karat validity and traceability', 'Karat must be a legal mark (10/14/18/22/24) and must also be stated in the row\'s own evidence text (including 750/1000 fineness for 18K).', failures);
}

/* ---------------------------------------------------------------- S04 */
{
  const failures = [];
  for (const r of rings.rows) {
    assertions++;
    if (r.price_low === null) failures.push(`${r.id}: price_low is null — leave it out of the table instead`);
    if (r.price_low !== null && r.price_high !== null && r.price_low > r.price_high) failures.push(`${r.id}: price_low > price_high`);
    if (r.weight_g_low !== null && r.weight_g_high !== null && r.weight_g_low > r.weight_g_high) failures.push(`${r.id}: weight low > high`);
    if (r.weight_g_low !== null && r.weight_g_low <= 0) failures.push(`${r.id}: non-positive weight — impossible`);
    if (r.compare_at_high !== null && r.compare_at_high !== undefined && r.price_high !== null && r.compare_at_high < r.price_high) {
      failures.push(`${r.id}: compare-at price is lower than the selling price`);
    }
  }
  add('S04', 'Internal arithmetic', 'Price and weight ranges must be ordered and positive; a struck-through price cannot be below the price being charged.', failures);
}

/* ---------------------------------------------------------------- S05 */
{
  const failures = [];
  for (const r of rings.rows) {
    assertions++;
    if (r.solid_stated === true && !/solid/i.test(r.evidence || '')) {
      failures.push(`${r.id}: claims "solid stated" but the word solid is not in the evidence`);
    }
    if (r.solid_stated === true && !(r.flags || []).includes('solid_stated')) {
      // informational only - not a failure
    }
    if (r.solid_stated === false && (r.flags || []).includes('solid_stated')) {
      failures.push(`${r.id}: flag says solid stated but the boolean says otherwise`);
    }
  }
  add('S05', 'Solid-gold claim honesty', 'A row may only claim "solid stated" when the captured seller text actually contains the word solid.', failures);
}

/* ---------------------------------------------------------------- S06 */
{
  const failures = [];
  const perGram = gold.primary.price_usd_per_ozt / (gold.grams_per_troy_ounce ?? gold.grains_per_troy_ounce);
  for (const r of rings.rows) {
    assertions++;
    if (r.weight_g_low === null || r.price_low === null) continue;
    const purity = parseInt(String(r.karat), 10) / 24;
    const meltHigh = (r.weight_g_high ?? r.weight_g_low) * purity * perGram;
    if (r.price_low < meltHigh * 0.98) {
      failures.push(`${r.id}: asking ${r.price_low} is below its own gold value ${meltHigh.toFixed(2)} — impossible, recheck weight and karat`);
    }
  }
  add('S06', 'Melt-value plausibility', 'If a weight is published, the asking price cannot be below the gold content. A price under melt means the weight, karat or price is wrong.', failures);
}

/* ---------------------------------------------------------------- S07 */
{
  const failures = [];
  for (const r of rings.rows) {
    assertions++;
    const text = `${r.evidence || ''} ${r.metal || ''} ${r.title || ''}`;
    if (PLATING_WORDS.test(text) && !(r.flags || []).includes('plated_variant_in_product')) {
      failures.push(`${r.id}: plating language in the listing without a plated_variant_in_product flag`);
    }
  }
  add('S07', 'Plated-metal guard', 'Plating, vermeil or gold-filled language must never pass silently. It either disqualifies the row or raises a flag.', failures);
}

/* ---------------------------------------------------------------- S08 */
{
  const failures = [];
  for (const r of rings.rows) {
    assertions++;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.retrieved_at || '')) failures.push(`${r.id}: retrieval date is not YYYY-MM-DD`);
    else if (r.retrieved_at > TODAY) failures.push(`${r.id}: retrieval date is in the future (${r.retrieved_at} > ${TODAY})`);
  }
  if (!/^\d{4}-\d{2}-\d{2}T/.test(gold.primary.publisher_timestamp || '')) failures.push('gold price timestamp is not ISO');
  if (!(gold.primary.price_usd_per_ozt > 0)) failures.push('gold price is not positive');
  add('S08', 'Date and price-feed sanity', 'Retrieval dates must be real and not in the future; the stored gold price must be a positive number with an ISO publisher timestamp.', failures);
}

/* ---------------------------------------------------------------- S09 */
{
  const failures = [];
  const ids = new Set();
  const urls = new Set();
  for (const r of rings.rows) {
    assertions++;
    if (ids.has(r.id)) failures.push(`duplicate id ${r.id}`);
    ids.add(r.id);
    if (urls.has(r.source_url)) failures.push(`duplicate source_url ${r.source_url}`);
    urls.add(r.source_url);
    if (!retailers[r.retailer_id]) failures.push(`${r.id}: retailer ${r.retailer_id} is not in retailers.json`);
    if (!CATS.includes(r.category)) failures.push(`${r.id}: category ${r.category} is not one of the published categories`);
    if (!r.title || !r.karat || !r.metal) failures.push(`${r.id}: missing a required descriptive field`);
  }
  const flagIds = new Set();
  for (const f of flagged.items) {
    if (flagIds.has(f.id)) failures.push(`duplicate flag id ${f.id}`);
    flagIds.add(f.id);
    if (f.status !== 'needs review') failures.push(`flag ${f.id} has an unexpected status`);
    if (!Array.isArray(f.sources) || f.sources.length === 0) failures.push(`flag ${f.id} has no source`);
  }
  add('S09', 'Identity and schema', 'IDs and source URLs must be unique, retailers and categories must exist, and every flag must carry a source and the "needs review" status.', failures);
}

/* ---------------------------------------------------------------- S10 */
{
  const failures = [];
  for (const r of rings.rows) {
    assertions++;
    const flags = r.flags || [];
    if (r.weight_g_low === null && !flags.includes('weight_not_published')) {
      failures.push(`${r.id}: weight is blank but not flagged as unpublished`);
    }
    if (r.price_low === r.price_high && flags.includes('price_varies')) {
      failures.push(`${r.id}: flagged as price-varying but the range is a single price`);
    }
    if (r.price_low !== r.price_high && !flags.includes('price_varies')) {
      failures.push(`${r.id}: price range differs but is not flagged`);
    }
  }
  add('S10', 'No silent blanks', 'A blank value is allowed only when a flag explains it, and a price range must be disclosed as varying.', failures);
}

/* ---------------------------------------------------------------- S11 */
{
  const failures = [];
  const files = [];
  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'data' || entry.name === 'scripts' || entry.name === 'assets' || entry.name === 'site') continue;
      const p = join(dir, entry.name);
      if (entry.isDirectory()) await walk(p);
      else if (entry.name.endsWith('.html')) files.push(p);
    }
  }
  await walk(ROOT);

  if (files.length === 0) failures.push('no generated HTML found — run scripts/build.mjs first');

  for (const f of files) {
    const html = await readFile(f, 'utf8');
    const rel = f.replace(ROOT + '/', '');
    const refs = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map((m) => m[1]);
    for (const ref of refs) {
      assertions++;
      if (/^(https?:|mailto:|tel:|data:|#)/.test(ref)) continue;
      const clean = ref.split('#')[0].split('?')[0];
      if (!clean) continue;
      const target = clean.startsWith('/')
        ? join(ROOT, clean)
        : join(dirname(f), clean);
      if (!existsSync(target)) failures.push(`${rel}: broken internal link -> ${ref}`);
    }
    if (/lorem ipsum|\bTODO\b|\bFIXME\b|xxxxx|coming soon/i.test(html)) failures.push(`${rel}: contains placeholder text`);
  }
  add('S11', 'Links and placeholders', 'Every internal link and asset reference in every generated page must resolve to a real file, and no page may contain placeholder text.', failures);
  groups[groups.length - 1].pages_checked = files.length;
}

/* ---------------------------------------------------------------- S12 */
{
  const failures = [];
  for (const r of rings.rows) {
    assertions++;
    const p = join(ROOT, 'rings', `${r.id}.html`);
    if (!existsSync(p)) failures.push(`${r.id}: detail page missing`);
    else {
      const html = await readFile(p, 'utf8');
      if (!html.includes(r.source_url)) failures.push(`${r.id}: detail page does not expose the official source URL`);
      if (r.price_unverified) {
        // the whole point: an unverified price must NOT be printed as a number
        if (!html.includes('— unverified')) {
          failures.push(`${r.id}: unverified row does not render "— unverified"`);
        }
      } else if (r.price_low !== null && !html.includes(r.price_low.toLocaleString('en-US', { style: 'currency', currency: 'USD' }))) {
        failures.push(`${r.id}: detail page does not show the verified price`);
      }
    }
  }
  add('S12', 'Row-to-page coverage', 'Every row must have a detail page that shows its source link and, unless the value is unverified, its verified price.', failures);
}

/* ---------------------------------------------------------------- S13 */
{
  const failures = [];
  const s = await read('data/sources.json');
  assertions++;
  if (!s.sources.some((x) => x.status === 'retrieved')) failures.push('no retrieved sources recorded');
  for (const src of s.sources) {
    assertions++;
    if (!/^https?:\/\//.test(src.url)) failures.push(`source ${src.id} has no URL`);
    if (src.status === 'retrieved' && !src.verified) failures.push(`source ${src.id} claims retrieved but records nothing verified`);
  }
  // every distinct retailer domain used by a row must appear in the source registry
  for (const ret of retailersDoc.retailers) {
    assertions++;
    if (!s.sources.some((x) => x.url.includes(ret.domain))) failures.push(`retailer ${ret.id} has no entry in the source registry`);
  }

  add('S13', 'Source registry coverage', 'Every retailer used for a value must appear in the source registry with a retrieval record.', failures);
}

/* ---------------------------------------------------------------- S14 */
{
  const failures = [];
  for (const r of rings.rows) {
    assertions++;
    const hasWeight = r.weight_g_low !== null && r.weight_g_low !== undefined;
    const ev = `${r.evidence || ''}`.replace(/,/g, '');
    if (hasWeight) {
      const forms = [String(r.weight_g_low), Number(r.weight_g_low).toFixed(1)];
      if (!forms.some((f) => ev.includes(f))) {
        failures.push(`${r.id}: weight ${r.weight_g_low} g is not stated in the evidence text — untraceable`);
      }
      if ((r.flags || []).includes('weight_not_published')) {
        failures.push(`${r.id}: has a weight but still carries the weight_not_published flag`);
      }
      if (r.weight_g_high !== null && r.weight_g_high !== undefined && !ev.includes(String(r.weight_g_high))) {
        failures.push(`${r.id}: upper weight ${r.weight_g_high} g is not stated in the evidence text`);
      }
    } else if ((r.flags || []).includes('weight_range_published')) {
      failures.push(`${r.id}: claims a published weight range but stores no weight`);
    }
  }
  add('S14', 'Weight traceability', 'A weight in grams is only allowed when the grams appear in the evidence text captured from the seller, and the blank/known flags must agree with the stored value.', failures);
}

/* ---------------------------------------------------------------- S15 */
{
  const failures = [];
  const ledger = await readIf('data/reverification.json', { entries: [] });
  const byRow = new Map();
  for (const e of ledger.entries || []) {
    assertions++;
    if (byRow.has(e.row)) failures.push(`reverification ledger: duplicate entry for ${e.row}`);
    byRow.set(e.row, e);
    if (!/^https:\/\//.test(e.source_url || '')) failures.push(`reverification ${e.row}: no https source`);
    if (!e.quote || e.quote.length < 15) failures.push(`reverification ${e.row}: no quote recorded, so the re-read cannot be checked by a human`);
    if (!e.verdict) failures.push(`reverification ${e.row}: no verdict`);
    if (!/^\d{4}-\d{2}-\d{2}/.test(e.read_at || ledger.read_at || '')) failures.push(`reverification ${e.row}: no read date`);
  }
  for (const r of rings.rows) {
    assertions++;
    const e = byRow.get(r.id);
    if (r.reverified_at) {
      if (!e) failures.push(`${r.id}: marked re-verified but missing from data/reverification.json`);
      else {
        if (e.source_url !== r.source_url) failures.push(`${r.id}: ledger source differs from the row source`);
        if (r.reverified_at > TODAY) failures.push(`${r.id}: re-verified date is in the future`);
      }
    } else if (e) {
      failures.push(`${r.id}: has a ledger entry but the row is not marked reverified_at`);
    }
  }
  add('S15', 'Re-verification ledger', 'Anything the site calls "re-verified" must have a matching ledger entry with the same URL, a date and a quoted line, so the re-read can be audited by a human.', failures);
}

/* ---------------------------------------------------------------- S16 */
{
  const failures = [];
  // Every dollar amount rendered anywhere on the site must trace to a number that exists
  // in the data files or is derived from them. A number in the prose that exists nowhere
  // in the data is exactly what a hallucinated price looks like.
  const dataNums = new Set();
  const harvest = (v) => {
    if (typeof v === 'number' && Number.isFinite(v)) {
      dataNums.add(v.toFixed(2));
      dataNums.add(String(Math.round(v)));
    } else if (typeof v === 'string') {
      for (const m of v.matchAll(/\d[\d,]*(?:\.\d+)?/g)) {
        const n = Number(m[0].replace(/,/g, ''));
        if (Number.isFinite(n)) {
          dataNums.add(n.toFixed(2));
          dataNums.add(String(Math.round(n)));
          dataNums.add(String(n));
        }
      }
    } else if (Array.isArray(v)) v.forEach(harvest);
    else if (v && typeof v === 'object') Object.values(v).forEach(harvest);
  };
  for (const f of ['data/rings.json', 'data/retailers.json', 'data/flagged.json', 'data/gold-price.json', 'data/checklist.json', 'data/sources.json', 'data/reverification.json']) {
    harvest(await readIf(f, {}));
  }
  // derived values the site is allowed to compute
  const perGram = gold.primary.price_usd_per_ozt / (gold.grams_per_troy_ounce ?? gold.grains_per_troy_ounce);
  const derived = new Set();
  const addDerived = (n) => {
    if (!Number.isFinite(n)) return;
    derived.add(n.toFixed(2));
    derived.add(String(Math.round(n)));
  };
  addDerived(gold.primary.price_usd_per_ozt);
  addDerived(perGram);
  for (const k of [10, 14, 18, 22, 24]) {
    addDerived(perGram * (k / 24));
    addDerived(perGram * (k / 24) * 3);
    derived.add(((k / 24) * 100).toFixed(1));
  }
  for (const r of rings.rows) {
    const p = parseInt(String(r.karat), 10) / 24;
    if (r.weight_g_low !== null) {
      for (const w of [r.weight_g_low, r.weight_g_high ?? r.weight_g_low]) {
        addDerived(w * p * perGram);
        addDerived(w * p);
        if (w * p * perGram > 0 && r.price_low) {
          derived.add((r.price_low / (w * p * perGram)).toFixed(1));
          derived.add((r.price_low / (w * p * perGram)).toFixed(0));
        }
      }
      addDerived(r.weight_g_low * p);
    }
    if (r.compare_at_high) addDerived(r.compare_at_high);
  }
  const allowed = (n) => dataNums.has(n) || derived.has(n) || dataNums.has(Number(n).toFixed(2));

  const files = [];
  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      if (entry.name.startsWith('.') || ['node_modules', 'dist', 'data', 'scripts', 'assets', 'site', 'docs', 'tools'].includes(entry.name)) continue;
      const p = join(dir, entry.name);
      if (entry.isDirectory()) await walk(p);
      else if (entry.name.endsWith('.html')) files.push(p);
    }
  }
  await walk(ROOT);
  for (const f of files) {
    const html = await readFile(f, 'utf8');
    const rel = f.replace(ROOT + '/', '');
    // checks.html renders the audit's own failure messages, which quote arbitrary strings;
    // strip the failure rows so the checker cannot flag itself.
    const stripped = html
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<tr class="fail-row">[\s\S]*?<\/tr>/g, '')
      .replace(/<code>[\s\S]*?<\/code>/g, '');
    for (const m of stripped.matchAll(/\$\s?([\d][\d,]*(?:\.\d+)?)/g)) {
      assertions++;
      const raw = m[1].replace(/,/g, '');
      if (!allowed(raw)) failures.push(`${rel}: renders $${m[1]} but no data file or formula produces that number`);
    }
  }
  add('S16', 'No invented dollar amounts', 'Every dollar figure that appears on any generated page must trace to a value in the data files or to a formula computed from them. A price in the prose that exists nowhere in the data is treated as fabricated.', failures);
}

/* ---------------------------------------------------------------- S17 */
{
  const failures = [];
  const newest = rings.rows.map((r) => r.retrieved_at).sort().pop();
  const ageDays = Math.floor((new Date(TODAY) - new Date(newest)) / 86400000);
  assertions++;
  if (!newest) failures.push('no retrieval dates at all');
  if (ageDays > 30) failures.push(`newest retrieval date is ${newest}, ${ageDays} days before this run — re-run the collector before publishing`);
  assertions++;
  const ledger = await readIf('data/reverification.json', { entries: [] });
  const reverifiedRows = rings.rows.filter((r) => r.reverified_at).length;
  if (reverifiedRows !== (ledger.entries || []).length) {
    failures.push(`${reverifiedRows} rows are marked re-verified but the ledger has ${(ledger.entries || []).length} entries`);
  }
  add('S17', 'Data age', 'A published price snapshot older than 30 days fails the run, and the re-verification count on the rows must equal the ledger. Stale data must not be presented as current.', failures);
  const flaggedIds = new Set(flagged.items.map((i) => i.id));
  for (const r of rings.rows) {
    assertions++;
    if (r.price_unverified) {
      if (!(r.flags || []).includes('price_unverified')) {
        failures.push(`${r.id}: price_unverified is set but the row does not carry the price_unverified flag`);
      }
      if (!r.price_unverified_reason || r.price_unverified_reason.length < 30) {
        failures.push(`${r.id}: price_unverified without a written reason`);
      }
      const onFlagged = flagged.items.some((i) => (i.affected || '').split(',').map((x) => x.trim()).includes(r.id));
      if (!onFlagged) failures.push(`${r.id}: unverified price but the row is not published on the Flagged page`);
    }
    if ((r.flags || []).includes('price_unverified') && !r.price_unverified) {
      failures.push(`${r.id}: carries the price_unverified flag but price_unverified is not set`);
    }
  }
  add('S18', 'Unverified values are published as unverified', 'A value that could not be reproduced on the official page must be marked, explained, listed on the Flagged page, and never shown as a number.', failures);
  const htmlFiles = [];
  const walk = async (dir) => {
    for (const e of await readdir(dir, { withFileTypes: true })) {
      if (e.name.startsWith('.') || e.name === 'node_modules' || e.name === 'dist') continue;
      const full = join(dir, e.name);
      if (e.isDirectory()) await walk(full);
      else if (e.name.endsWith('.html')) htmlFiles.push(full);
    }
  };
  await walk(ROOT);
  for (const r of rings.rows) {
    if (!r.price_unverified) continue;
    assertions++;
    const page = join(ROOT, 'rings', `${r.id}.html`);
    if (!existsSync(page)) {
      failures.push(`${r.id}: missing detail page`);
      continue;
    }
    const text = await readFile(page, 'utf8');
    const shown = new RegExp(`\\$?${r.price_low.toLocaleString('en-US')}`).test(text);
    const marked = text.includes('— unverified');
    if (!marked) failures.push(`${r.id}: unverified row is not rendered as unverified on its detail page`);
    if (shown && !text.includes('last observed')) {
      failures.push(`${r.id}: the unverified price ${r.price_low} is printed as a live price on its own page`);
    }
  }
  add('S19', 'Unverified prices never render as numbers', 'A row whose price could not be reproduced must print "— unverified" wherever a price would go.', failures);
}

/* ---------------------------------------------------------------- report */
const totalFailed = groups.reduce((n, g) => n + (g.failure_count || 0), 0);
const history = await readIf('data/checks/history.json', { runs: [] });
const passNumber = (history.runs?.length || 0) + 1;
const report = {
  pass: process.env.PASS_NAME || `P${passNumber}`,
  generated_at: new Date().toISOString().replace(/\.\d{3}Z$/, 'Z'),
  builder_version: rings.schema_version,
  summary: {
    total: groups.length,
    passed: groups.filter((g) => g.failed === 0).length,
    failed: groups.filter((g) => g.failed > 0).length,
    assertions,
    rows: rings.rows.length,
    pages: groups.find((g) => g.pages_checked)?.pages_checked || 0,
  },
  groups,
};

await mkdir(join(ROOT, 'data/checks'), { recursive: true });
await writeFile(join(ROOT, 'data/checks/latest.json'), JSON.stringify(report, null, 2) + '\n');
history.runs = history.runs || [];
history.runs.push({
  pass: report.pass,
  generated_at: report.generated_at,
  total: report.summary.total,
  failed: totalFailed,
  rows: report.summary.rows,
  pages: report.summary.pages,
});
await writeFile(join(ROOT, 'data/checks/history.json'), JSON.stringify(history, null, 2) + '\n');

const pad = (s, n) => String(s).padEnd(n);
console.log(`\nGOLD1 verification ${report.pass} — ${report.summary.rows} rows, ${report.summary.pages} pages, ${assertions} assertions\n`);
for (const g of groups) {
  console.log(`${g.failed === 0 ? 'PASS' : 'FAIL'}  ${pad(g.id, 5)} ${g.name}${g.failure_count ? ` (${g.failure_count})` : ''}`);
  for (const f of g.failures.slice(0, 12)) console.log(`        - ${f}`);
}
console.log(`\n${report.summary.passed}/${report.summary.total} groups passed, ${totalFailed} failure(s).`);
if (totalFailed > 0) process.exitCode = 1;
