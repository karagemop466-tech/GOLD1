#!/usr/bin/env node
/**
 * GOLD1 evidence collector.
 *
 * Purpose: retrieve primary-source data (official retailer product feeds,
 * official policy pages, official gold-price feeds) and store an immutable
 * snapshot of exactly what the source returned.
 *
 * Nothing in this script invents a value. It only records:
 *   - the URL requested
 *   - the HTTP status
 *   - the timestamp of the request
 *   - the response payload (or an error string)
 *
 * Curated rows in data/rings.json must be traceable to a file written here.
 *
 * Run: node scripts/collect.mjs [configPath]
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';

const CONFIG = process.argv[2] || 'data/collect/sources.json';
const OUT_DIR = 'data/raw';
const UA =
  'Mozilla/5.0 (compatible; GOLD1-evidence-collector/1.0; +https://github.com/karagemop466-tech/GOLD1)';

const LIMITS = {
  bodyHtml: 3000,
  pageText: 30000,
  maxProducts: 250,
};

function nowIso() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

function stripHtml(html) {
  if (!html) return '';
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&rsquo;/g, "'")
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchText(url, attempts = 3) {
  let lastErr = null;
  for (let i = 0; i < attempts; i++) {
    try {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 45000);
      const res = await fetch(url, {
        headers: {
          'user-agent': UA,
          accept: 'application/json,text/html;q=0.9,*/*;q=0.8',
          'accept-language': 'en-US,en;q=0.9',
        },
        redirect: 'follow',
        signal: controller.signal,
      });
      clearTimeout(t);
      const text = await res.text();
      return { status: res.status, finalUrl: res.url, text };
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 1500 * (i + 1)));
    }
  }
  throw lastErr;
}

/** Normalise a Shopify product payload to evidence-relevant fields only. */
function slimProduct(p) {
  return {
    id: p.id,
    title: p.title,
    handle: p.handle,
    vendor: p.vendor,
    product_type: p.product_type,
    published_at: p.published_at,
    updated_at: p.updated_at,
    tags: p.tags,
    product_url: `https://${p.__host}/products/${p.handle}`,
    body_text: stripHtml(p.body_html).slice(0, LIMITS.bodyHtml),
    options: p.options,
    variants: (p.variants || []).map((v) => ({
      id: v.id,
      title: v.title,
      sku: v.sku,
      price: v.price,
      compare_at_price: v.compare_at_price,
      available: v.available,
      grams: v.grams,
      options: [v.option1, v.option2, v.option3].filter((x) => x !== null && x !== undefined),
    })),
  };
}

async function run() {
  const cfg = JSON.parse(await readFile(CONFIG, 'utf8'));
  const manifest = [];
  let failures = 0;

  for (const src of cfg.sources) {
    const fetchedAt = nowIso();
    const record = {
      id: src.id,
      kind: src.kind,
      requested_url: src.url,
      note: src.note || '',
      fetched_at: fetchedAt,
    };
    try {
      const { status, finalUrl, text } = await fetchText(src.url);
      record.http_status = status;
      record.final_url = finalUrl;

      let payload;
      if (src.kind === 'shopify_products') {
        const json = JSON.parse(text);
        const host = new URL(finalUrl || src.url).host;
        payload = {
          product_count: (json.products || []).length,
          products: (json.products || [])
            .slice(0, LIMITS.maxProducts)
            .map((p) => slimProduct({ ...p, __host: host })),
        };
      } else if (src.kind === 'shopify_suggest') {
        const json = JSON.parse(text);
        const host = new URL(finalUrl || src.url).host;
        const products = json?.resources?.results?.products || [];
        payload = {
          product_count: products.length,
          query: src.query || null,
          products: products.map((p) => {
            const row = {
              id: p.id,
              title: p.title,
              handle: p.handle,
              vendor: p.vendor,
              product_type: p.type,
              available: p.available,
              price_min: p.price_min,
              price_max: p.price_max,
              tags: p.tags,
              product_url: `https://${host}/products/${p.handle}`,
              body_text: stripHtml(p.body).slice(0, LIMITS.bodyHtml),
            };
            return row;
          }),
        };
      } else if (src.kind === 'json') {
        payload = JSON.parse(text);
      } else if (src.kind === 'page') {
        payload = {
          title: (text.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [, ''])[1].trim(),
          text: stripHtml(text).slice(0, LIMITS.pageText),
        };
      } else {
        throw new Error(`unknown kind: ${src.kind}`);
      }

      record.ok = status >= 200 && status < 300;
      if (!record.ok) failures++;
      await writeFile(
        join(OUT_DIR, `${src.id}.json`),
        JSON.stringify({ meta: record, payload }, null, 2) + '\n',
      );
    } catch (err) {
      record.ok = false;
      record.http_status = null;
      record.error = String((err && err.message) || err);
      failures++;
      await mkdir(OUT_DIR, { recursive: true });
      await writeFile(
        join(OUT_DIR, `${src.id}.json`),
        JSON.stringify({ meta: record, payload: null }, null, 2) + '\n',
      );
    }
    manifest.push(record);
    console.log(
      `${record.ok ? 'OK  ' : 'FAIL'} ${record.http_status ?? '---'} ${src.id} ${src.url}`,
    );
  }

  await writeFile(
    join(OUT_DIR, '_manifest.json'),
    JSON.stringify({ collected_at: nowIso(), failures, sources: manifest }, null, 2) + '\n',
  );
  console.log(`\n${manifest.length - failures}/${manifest.length} sources retrieved.`);
  if (failures === manifest.length) process.exitCode = 1;
}

await mkdir(dirname(join(OUT_DIR, 'x')), { recursive: true });
await run();
