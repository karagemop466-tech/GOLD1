#!/usr/bin/env node
/**
 * GOLD1 live re-verification (sixth pass, 2026-10-23).
 *
 * Re-opens every curated row's own official product page and records **exactly
 * what the page printed** for price, karat, published weight and any
 * plated/vermeil/final-sale wording.
 *
 * This script verifies; it never writes to data/rings.json. It produces an
 * evidence file that a human (or the next script) reconciles against the
 * curated rows.
 *
 * Hard rules:
 *  - every recorded value is accompanied by the verbatim excerpt it came from
 *  - a field that cannot be found is recorded as `not_found`, never guessed
 *  - no averaging, no "probably", no interpolation between variants
 *
 * Run: node scripts/live_reverify.mjs [--only=id,id] [--concurrency=4]
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const ROOT = process.cwd();
const OUT_DIR = join(ROOT, 'data/live');
const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';

const args = process.argv.slice(2);
const onlyArg = args.find((a) => a.startsWith('--only='));
const only = onlyArg ? new Set(onlyArg.slice(7).split(',').map((s) => s.trim())) : null;
const concArg = args.find((a) => a.startsWith('--concurrency='));
const CONCURRENCY = (() => {
  const raw = concArg ? Number(concArg.split('=')[1].replace(/["']/g, '')) : 4;
  return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 4;
})();
const TIMEOUT_MS = 45000;
const ATTEMPTS = 3;

const ringsDoc = JSON.parse(await readFile(join(ROOT, 'data/rings.json'), 'utf8'));

function nowIso() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function decodeEntities(s) {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&rsquo;/g, '\u2019')
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)));
}

function toText(html) {
  return decodeEntities(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<svg[\s\S]*?<\/svg>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchPage(url) {
  let lastErr = '';
  for (let i = 0; i < ATTEMPTS; i++) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        headers: {
          'user-agent': UA,
          accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'accept-language': 'en-US,en;q=0.9',
        },
        redirect: 'follow',
        signal: controller.signal,
      });
      const text = await res.text();
      clearTimeout(t);
      if (res.status === 429 || res.status >= 500) {
        lastErr = `HTTP ${res.status}`;
        await new Promise((r) => setTimeout(r, 3000 * (i + 1)));
        continue;
      }
      return { status: res.status, finalUrl: res.url, text, error: null };
    } catch (err) {
      clearTimeout(t);
      lastErr = String(err && err.message ? err.message : err);
      await new Promise((r) => setTimeout(r, 2000 * (i + 1)));
    }
  }
  return { status: 0, finalUrl: url, text: '', error: lastErr || 'fetch failed' };
}

/** JSON-LD Product nodes the seller publishes itself. */
function jsonLdProducts(html) {
  const out = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html))) {
    let parsed;
    try {
      parsed = JSON.parse(m[1].trim());
    } catch {
      continue;
    }
    const stack = Array.isArray(parsed) ? [...parsed] : [parsed];
    while (stack.length) {
      const node = stack.pop();
      if (!node || typeof node !== 'object') continue;
      if (Array.isArray(node)) {
        stack.push(...node);
        continue;
      }
      if (node['@graph']) stack.push(...[].concat(node['@graph']));
      const type = [].concat(node['@type'] || []).join(',');
      if (/Product/i.test(type)) out.push(node);
      for (const k of ['offers', 'mainEntity', 'itemListElement']) {
        if (node[k]) stack.push(...[].concat(node[k]));
      }
    }
  }
  return out;
}

function offerPrices(node) {
  const offers = [].concat(node?.offers || []).filter(Boolean);
  const prices = [];
  for (const o of offers) {
    for (const key of ['price', 'lowPrice', 'highPrice']) {
      const v = o[key];
      if (v !== undefined && v !== null && String(v).trim() !== '') {
        const n = Number(String(v).replace(/[^0-9.]/g, ''));
        if (Number.isFinite(n) && n > 0) prices.push({ key, value: n, currency: o.priceCurrency || null });
      }
    }
    if (o.priceSpecification) {
      for (const key of ['price', 'minPrice', 'maxPrice']) {
        const v = o.priceSpecification[key];
        if (v !== undefined && v !== null) {
          const n = Number(String(v).replace(/[^0-9.]/g, ''));
          if (Number.isFinite(n) && n > 0) prices.push({ key, value: n, currency: o.priceCurrency || null });
        }
      }
    }
  }
  return prices;
}

/** All occurrences of a regex in text, with a verbatim window around each. */
function occurrences(text, re, limit = 8, window = 90) {
  const out = [];
  let m;
  const rx = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
  while ((m = rx.exec(text)) && out.length < limit) {
    const start = Math.max(0, m.index - window);
    const end = Math.min(text.length, m.index + m[0].length + window);
    out.push({ match: m[0], excerpt: text.slice(start, end).trim() });
  }
  return out;
}

function moneyExcerpts(text, limit = 12) {
  return occurrences(text, /\$\s?\d{1,3}(?:,\d{3})+(?:\.\d{2})?|\$\s?\d+(?:\.\d{2})?/, limit, 70);
}

function extract(html, row) {
  const text = toText(html);
  const ld = jsonLdProducts(html);
  const ldPrices = ld.flatMap((n) => offerPrices(n));
  const ldTitles = ld.map((n) => n.name).filter(Boolean);
  const meta = {};
  for (const key of ['og:title', 'og:price:amount', 'product:price:amount', 'og:price:currency']) {
    const re = new RegExp(`<meta[^>]+(?:property|name)=["']${key.replace(/[.:]/g, '\\$&')}["'][^>]*content=["']([^"']*)["']`, 'i');
    const m = html.match(re);
    if (m) meta[key] = decodeEntities(m[1]);
  }
  const titleTag = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [, ''])[1];
  const h1 = toText((html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i) || [, ''])[1]).slice(0, 200);

  return {
    h1,
    title_tag: decodeEntities(titleTag).replace(/\s+/g, ' ').trim().slice(0, 200),
    jsonld_titles: [...new Set(ldTitles)].slice(0, 4),
    jsonld_prices: ldPrices.slice(0, 12),
    meta,
    karat_mentions: occurrences(
      text,
      /\b(?:9|10|14|18|22|24)\s?(?:kt|KT|Kt|k|K|karat|Karat)\b|\b(?:375|585|750|916|999)\b/g,
      14,
      70
    ),
    // Every appearance of the word "weight" with a verbatim window, plus every
    // number followed by a gram unit with its own window. Both are recorded
    // raw; deciding what they mean is the reconciliation step's job.
    // The limits are deliberately high: on a storefront page the metal-weight
    // spec sits late in a very long document, and a low cap used to truncate
    // the answer away (a Ross-Simons "Gold Weight 1.7 grams" line was missed
    // that way on 2026-10-23 even though the page printed it).
    weight_keyword_context: occurrences(text, /weight/gi, 60, 150),
    gram_mentions: occurrences(text, /\b\d{1,3}(?:\.\d{1,2})?\s?(?:grams?|g)\b/g, 40, 90),
    // Labelled metal-weight lines ("Gold Weight 1.7 grams", "Item Weight
    // Approximately 3.6g (gold)", "Metal Weight: 2.5 g") - the only form this
    // project accepts as a published weight, and searched in both the stripped
    // text and the raw HTML because spec panels are rendered from JSON blobs.
    gold_weight_label_text: occurrences(
      text,
      /(?:gold|metal|item)\s+weight[^0-9<]{0,40}\d{1,3}(?:\.\d{1,2})?\s*(?:grams?|g)\b/gi,
      12,
      110
    ),
    gold_weight_label_html: occurrences(
      html,
      /(?:gold|metal|item)[_ ]?weight[^0-9<]{0,40}\d{1,3}(?:\.\d{1,2})?\s*(?:grams?|g)\b/gi,
      12,
      130
    ),
    solid_mentions: occurrences(text, /\bsolid\s+(?:\d{1,2}\s?(?:kt|k|karat)\s+)?(?:yellow\s+|white\s+|rose\s+)?gold\b|\bsolid gold\b/gi, 8, 90),
    plated_mentions: occurrences(text, /\b(?:vermeil|gold[- ]?filled|gold[- ]?plated|gold tone|gold-tone|plated over|over sterling|sterling silver)\b/gi, 8, 90),
    sale_mentions: occurrences(text, /\bfinal sale\b|\bexchange for size only\b|\ball sales final\b/gi, 4, 90),
    hallmark_mentions: occurrences(text, /\bhallmark\b|\bmaker'?s mark\b|\bstamped\b|\bengraved with\b/gi, 6, 100),
    // Spec panels on many storefronts are rendered from a JSON blob inside a
    // <script>, so the stripped text never contains them. Scan the raw HTML too.
    html_weight_context: occurrences(html, /(?:metal_weight|metalWeight|gold_weight|goldWeight|"weight"\s*:\s*"?\d[\d.]*)/gi, 12, 110),
    prices: moneyExcerpts(text),
    text_length: text.length,
    text_sha256: createHash('sha256').update(text).digest('hex'),
  };
}

async function shopifyFallback(url) {
  const jsonUrl = url.replace(/[?#].*$/, '').replace(/\/$/, '') + '.json';
  const res = await fetchPage(jsonUrl);
  if (!res.text || res.status !== 200) return null;
  let doc;
  try {
    doc = JSON.parse(res.text);
  } catch {
    return null;
  }
  const prod = doc?.product;
  if (!prod || !Array.isArray(prod.variants)) return null;
  const prices = prod.variants.map((v) => Number(v.price)).filter((n) => Number.isFinite(n) && n > 0);
  const metas = [...new Set(prod.variants.map((v) => v.option1).filter(Boolean))];
  return {
    json_url: jsonUrl,
    http_status: res.status,
    fetched_at: nowIso(),
    title: prod.title,
    handle: prod.handle,
    updated_at: prod.updated_at,
    tags: String(prod.tags || '').split(',').map((t) => t.trim()).filter(Boolean).slice(0, 40),
    options: (prod.options || []).map((o) => ({ name: o.name, values: o.values })),
    variant_count: prod.variants.length,
    price_min: prices.length ? Math.min(...prices) : null,
    price_max: prices.length ? Math.max(...prices) : null,
    metal_options: metas.slice(0, 12),
    variants_sample: prod.variants.slice(0, 30).map((v) => ({
      title: v.title,
      price: v.price,
      compare_at_price: v.compare_at_price,
      available: v.available ?? null,
    })),
  };
}

/**
 * Variant-level read from the seller's own product JSON (`<product-url>.js`).
 *
 * Why this exists: a product-level price (JSON-LD `offers.price`, or the page
 * headline "From $x") is the **cheapest variant**, which for these retailers is
 * often a different metal — a vermeil variant on a solid-gold page, or an 18K
 * variant on a 14K row. Reading the product minimum and treating it as the row's
 * price would be exactly the mistake this project forbids. The variant table lets
 * reconciliation match the stored karat to a variant whose own option title
 * states that karat, and record the rest as a disclosed range.
 *
 * Shipping-weight fields (`grams`, `weight`, `weight_unit`) are copied into a
 * clearly separated `shipping_weight_fields` block marked `not_metal_weight`.
 * They are parcel weights (e.g. Ross-Simons lists `grams: 113` = 0.25 lb) and
 * must never be reconciled into `weight_g_low`/`weight_g_high`.
 */
async function shopifyVariantTable(url) {
  const jsonUrl = url.replace(/[?#].*$/, '').replace(/\/$/, '') + '.js';
  const res = await fetchPage(jsonUrl);
  if (res.status !== 200 || !res.text) {
    return { ok: false, json_url: jsonUrl, http_status: res.status, error: res.error || `HTTP ${res.status}`, fetched_at: nowIso() };
  }
  let prod = null;
  try {
    prod = JSON.parse(res.text);
  } catch {
    return { ok: false, json_url: jsonUrl, http_status: 200, error: 'response is not JSON (not a Shopify storefront)', fetched_at: nowIso() };
  }
  const variants = Array.isArray(prod?.variants) ? prod.variants : [];
  if (!variants.length) {
    return { ok: false, json_url: jsonUrl, http_status: 200, error: 'no variants array', fetched_at: nowIso() };
  }
  const cents = (v) => {
    const n = Number(v);
    return Number.isFinite(n) ? n / 100 : null;
  };
  const descText = toText(String(prod.description || ''));
  const table = variants.map((v) => ({
    title: v.title,
    option1: v.option1 ?? null,
    option2: v.option2 ?? null,
    option3: v.option3 ?? null,
    price_usd: cents(v.price),
    compare_at_usd: v.compare_at_price === null || v.compare_at_price === undefined ? null : cents(v.compare_at_price),
    available: v.available ?? null,
    sku: v.sku ?? null,
  }));
  const prices = table.map((v) => v.price_usd).filter((n) => Number.isFinite(n) && n > 0);
  const byMetal = {};
  for (const v of table) {
    const k = String(v.option1 ?? '(none)');
    if (!byMetal[k]) byMetal[k] = { option1: k, prices: [], variants: 0, available: 0, sample_titles: [] };
    byMetal[k].variants++;
    if (v.available) byMetal[k].available++;
    if (Number.isFinite(v.price_usd)) byMetal[k].prices.push(v.price_usd);
    if (byMetal[k].sample_titles.length < 3) byMetal[k].sample_titles.push(`${v.title} = $${v.price_usd}`);
  }
  for (const k of Object.keys(byMetal)) {
    const p = byMetal[k].prices;
    byMetal[k].price_min = p.length ? Math.min(...p) : null;
    byMetal[k].price_max = p.length ? Math.max(...p) : null;
    byMetal[k].prices = [...new Set(p)].sort((a, b) => a - b).slice(0, 12);
  }
  return {
    ok: true,
    json_url: jsonUrl,
    http_status: 200,
    fetched_at: nowIso(),
    title: prod.title,
    handle: prod.handle,
    vendor: prod.vendor,
    type: prod.type,
    product_updated_at: prod.updated_at ?? null,
    product_published_at: prod.published_at ?? null,
    tags: String(prod.tags || '').split(',').map((t) => t.trim()).filter(Boolean).slice(0, 60),
    price_usd: cents(prod.price),
    price_min_usd: cents(prod.price_min),
    price_max_usd: cents(prod.price_max),
    variant_count: table.length,
    price_min_variant: prices.length ? Math.min(...prices) : null,
    price_max_variant: prices.length ? Math.max(...prices) : null,
    options: (prod.options || []).map((o) => ({ name: o.name, values: o.values })),
    metal_groups: byMetal,
    variants: table.slice(0, 220),
    description_text: descText.slice(0, 2600),
    description_gram_mentions: occurrences(descText, /\b\d{1,3}(?:\.\d{1,2})?\s?(?:grams?|g)\b/g, 20, 120),
    description_weight_context: occurrences(descText, /weight/gi, 12, 140),
    description_solid_mentions: occurrences(descText, /\bsolid\b|\bvermeil\b|\bplated\b|\bgold[- ]filled\b/gi, 10, 90),
    shipping_weight_fields: {
      not_metal_weight: true,
      note: 'Parcel/shipping weights published on the variant record. Copied only so a later pass never mistakes them for metal weight.',
      values: [...new Set(variants.map((v) => `${v.weight ?? 'null'} ${v.weight_unit ?? ''}`.trim()).filter((s) => s !== 'null'))].slice(0, 6),
      grams_field_values: [...new Set(variants.map((v) => v.grams).filter((n) => n !== undefined && n !== null))].slice(0, 6),
    },
  };
}

async function runOne(row) {
  const t0 = Date.now();
  const res = await fetchPage(row.source_url);
  const fetched_at = nowIso();
  // The variant table is read for every row, whether or not the HTML page was
  // reachable: the seller's own JSON endpoint is the same official source and is
  // usually served even when the HTML page is bot-walled.
  const variants = await shopifyVariantTable(row.source_url);
  if (!res.text || res.status >= 400) {
    const fb = variants.ok ? null : await shopifyFallback(row.source_url);
    return {
      id: row.id,
      retailer: row.retailer,
      url: row.source_url,
      http_status: res.status,
      fetched_at,
      ok: false,
      error: res.error || `HTTP ${res.status}`,
      shopify_variant_table: variants,
      shopify_json_fallback: fb,
      extraction: null,
    };
  }
  return {
    id: row.id,
    retailer: row.retailer,
    url: row.source_url,
    final_url: res.finalUrl,
    http_status: res.status,
    fetched_at,
    ok: res.status >= 200 && res.status < 300,
    bytes: res.text.length,
    shopify_variant_table: variants,
    extraction: extract(res.text, row),
  };
}

async function pool(items, worker, concurrency) {
  const results = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        results[idx] = await worker(items[idx], idx);
        process.stderr.write(`  ${idx + 1}/${items.length} ${items[idx].id}\n`);
      }
    })
  );
  return results;
}

/* ---------------------------------------------------------------- gold spot */
async function goldSpot() {
  const readings = [];
  for (const src of [
    { url: 'https://api.gold-api.com/price/XAU', publisher: 'gold-api.com' },
    {
      url: 'https://query1.finance.yahoo.com/v8/finance/chart/GC%3DF?interval=1d&range=5d',
      publisher: 'Yahoo Finance (COMEX GC=F front month)',
    },
  ]) {
    const res = await fetchPage(src.url);
    let payload = null;
    try {
      payload = JSON.parse(res.text);
    } catch {
      payload = null;
    }
    readings.push({
      publisher: src.publisher,
      url: src.url,
      http_status: res.status,
      fetched_at: nowIso(),
      price_usd_per_ozt:
        payload && typeof payload.price === 'number'
          ? payload.price
          : payload?.chart?.result?.[0]?.meta?.regularMarketPrice ?? null,
      publisher_timestamp: payload?.updatedAt
        ? String(payload.updatedAt)
        : payload?.ts
          ? new Date(Number(payload.ts)).toISOString()
          : null,
      raw_excerpt: res.text ? res.text.slice(0, 300) : res.error,
    });
  }
  return readings;
}

/* -------------------------------------------------------------------- main */
const rows = ringsDoc.rows.filter((r) => (only ? only.has(r.id) : true));
console.error(`live re-verification: ${rows.length} rows, concurrency ${CONCURRENCY}`);

const started_at = nowIso();
const results = await pool(rows, runOne, CONCURRENCY);
if (results.some((r) => r === null || r === undefined)) {
  throw new Error('pool returned empty results — refusing to write an evidence file');
}
const gold = await goldSpot();

await mkdir(OUT_DIR, { recursive: true });
const doc = {
  pass: 'P42-live',
  script_version: 'v5 labelled metal-weight search in text and raw HTML + higher occurrence caps (ninth pass, sess-7626fc93)',
  purpose:
    'Independent live re-read of every curated row at its own official product URL, plus a variant-level read of the seller product JSON. Verbatim excerpts only; no value is inferred. Reconciliation against data/rings.json is recorded separately.',
  started_at,
  finished_at: nowIso(),
  run_context: process.env.GITHUB_RUN_ID ? `github-actions run ${process.env.GITHUB_RUN_ID}` : 'local',
  row_count: results.length,
  fetch_ok: results.filter((r) => r.ok).length,
  fetch_failed: results.filter((r) => !r.ok).map((r) => ({ id: r.id, status: r.http_status, error: r.error })),
  gold_price_readings: gold,
  rows: results,
};

const stamp = doc.finished_at.replace(/[:.]/g, '-');
await writeFile(join(OUT_DIR, `${stamp}.json`), JSON.stringify(doc, null, 1));
// Guard: a run that reached nothing (e.g. executed inside a sandbox with no
// outbound network) must not overwrite the published evidence pointer. The
// timestamped file is still written, so the failed attempt is visible.
if (doc.fetch_ok === 0 && !doc.rows.some((r) => r?.shopify_variant_table?.ok || r?.shopify_json_fallback)) {
  console.error(
    `live re-verification: 0/${doc.row_count} pages reachable — writing data/live/${stamp}.json only, latest.json left untouched`
  );
} else {
  await writeFile(join(OUT_DIR, 'latest.json'), JSON.stringify(doc, null, 1));
}

console.log(
  `live re-verification: ${doc.fetch_ok}/${doc.row_count} pages fetched OK -> data/live/${stamp}.json`
);
if (doc.fetch_failed.length) {
  for (const f of doc.fetch_failed) console.log(`  FAILED ${f.id} status=${f.status} ${f.error}`);
}
