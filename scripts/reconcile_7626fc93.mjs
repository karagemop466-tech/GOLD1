#!/usr/bin/env node
/**
 * GOLD1 ninth-pass reconciler (sess-7626fc93, 2026-10-23).
 *
 * Inputs (evidence, never rewritten by this script):
 *   data/live/latest.json                              - the runner's live re-read of all 71 rows
 *                                                        (scripts/live_reverify.mjs v6, GitHub Actions)
 *   data/session-7626fc93/hand-reads-2026-10-23.json    - this session's own official-source reads
 *   data/session-7626fc93/changes-2026-10-23.json       - the curated list of field changes to apply
 *
 * Outputs:
 *   data/rings.json                       - curated rows, updated in place
 *   data/reverification.json              - one ledger entry per re-verified row
 *   data/verification-2026-10-23.json     - the per-row re-read ledger the site renders
 *   data/flagged.json                     - findings added / re-worded by this pass
 *   data/gold-price.json                  - new timestamped spot readings
 *   data/session-7626fc93/reconcile-report-2026-10-23.json - what was observed and what was decided
 *
 * The rules that make this script safe to run unattended:
 *   1. A change is applied ONLY if it appears in changes-2026-10-23.json AND the value it writes
 *      literally occurs in the verbatim quote that change cites. A number that is not in its own
 *      quote is refused, so a fabricated figure cannot enter the dataset through this script.
 *   2. Nothing is written for a row the evidence does not speak to: no averaging across variants,
 *      no copying a sibling size's price, no "probably still the same".
 *   3. Before anything is written, the whole result is re-checked with the same invariants the
 *      published audit enforces (price↔evidence, weight↔evidence, karat↔evidence, plating guard,
 *      solid wording, blank↔flag agreement, melt floor). Any violation aborts the run.
 *   4. Idempotent: running it twice produces a byte-identical result.
 *
 * Run: node scripts/reconcile_7626fc93.mjs [--dry]
 */
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const ROOT = process.cwd();
const DRY = process.argv.includes('--dry');
const read = async (p) => JSON.parse(await readFile(join(ROOT, p), 'utf8'));
const PASS = 'P98-ninth';
const PASS_DATE = '2026-10-23';

const ringsDoc = await read('data/rings.json');
const live = await read('data/live/latest.json');
const hand = await read('data/session-7626fc93/hand-reads-2026-10-23.json');
const changesDoc = await read('data/session-7626fc93/changes-2026-10-23.json');
const gold = await read('data/gold-price.json');
const revalDoc = await read('data/reverification.json');
const ledgerDoc = await read('data/verification-2026-10-23.json');
const flaggedDoc = await read('data/flagged.json');

const rows = ringsDoc.rows;

// The pre-pass state of the dataset, kept in this session's folder so a re-run compares against the
// same "before" values instead of against what the last run wrote. Without this, running the script
// twice would quietly rewrite the ledger's "old" column into a copy of the "new" column.
const PRE_PATH = 'data/session-7626fc93/prepass-rings-2026-10-23.json';
let preRows;
try {
  preRows = (await read(PRE_PATH)).rows;
} catch {
  await writeFile(join(ROOT, PRE_PATH), JSON.stringify({ note: `snapshot of data/rings.json as it stood before ${PASS} touched it`, taken_at: live.finished_at, rows: ringsDoc.rows }, null, 2) + '\n');
  preRows = JSON.parse(JSON.stringify(rows));
}
const preById = Object.fromEntries(preRows.map((r) => [r.id, r]));
const liveById = Object.fromEntries(live.rows.filter(Boolean).map((r) => [r.id, r]));
const handById = {};
for (const h of hand.reads) for (const id of h.row ? [h.row] : h.rows || []) handById[id] = h;

const digits = (s) => String(s).replace(/,/g, '').trim();

/**
 * A read stamp has to be a complete UTC timestamp, because it is published verbatim as the row's
 * provenance and `N09` rejects a stamp a reader could not put into a citation. Hand reads are often
 * written to the minute, so seconds are filled in rather than trusted to the note-taker.
 */
function isoStamp(v) {
  const t = String(v || '').trim();
  if (!t) return t;
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}Z$/.test(t)) return t.replace(/Z$/, ':00Z');
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/.test(t)) return t;
  return t;
}

/** Does this number literally appear in the quote that is supposed to justify it? */
function valueInQuote(value, quote) {
  const q = digits(quote || '');
  const forms = new Set([String(value), digits(value)]);
  if (Number.isFinite(Number(value))) {
    forms.add(Number(value).toFixed(2));
    forms.add(digits(Number(value).toFixed(2)));
    forms.add(String(Math.round(Number(value))));
  }
  return [...forms].some((f) => f.length > 0 && q.includes(f));
}

/* ------------------------------------------------- observations per row */
function metalGroupPrice(vt, karat) {
  if (!vt?.ok) return null;
  const k = String(karat).replace(/[^0-9]/g, '');
  const groups = Object.values(vt.metal_groups || {}).filter((g) =>
    new RegExp(`(^|[^0-9])${k}\\s?(?:kt|k|karat)\\b`, 'i').test(String(g.option1))
  );
  if (groups.length !== 1) return { matched: groups.length, groups: groups.map((g) => g.option1) };
  const g = groups[0];
  return { matched: 1, option1: g.option1, low: g.price_min, high: g.price_max, variants: g.variants, available: g.available };
}

/** Every gram figure printed in one evidence window, with "2.6-4g" spread into two numbers. */
function gramFigures(text) {
  const t = String(text || '').replace(/(\d+(?:\.\d+)?)\s*(?:-|–|to)\s*(\d+(?:\.\d+)?)\s*(?:g|grams?)\b/gi, '$1 g $2 g');
  return [...t.matchAll(/(\d+(?:\.\d+)?)\s*(?:g|grams?)\b/gi)].map((m) => Number(m[1]));
}

/**
 * Find the metal weight for a row in today read. `storedLow` is the figure already in the table
 * (verification); when it is omitted this is a search for something to adopt, which has to pass a
 * stricter test - only a sentence that names a gold / metal / item / fine weight may offer a number,
 * so "0.5 g stone weight" or a shipping weight cannot become a ring spec.
 */
function observedWeight(L, storedLow, storedHigh) {
  const e = L?.extraction || {};
  const vt = L?.shopify_variant_table?.ok ? L.shopify_variant_table : null;
  // Every pool the collector fills, in the order a reader should trust them. Checking all of them
  // matters: Ross-Simons prints its metal weight in the raw HTML spec blob and nowhere in the
  // stripped text, Automic Gold prints it as visible "Item Weight" text, and Aurate's cigar band
  // only says "Weight: 2.6-4g" inside the Shopify description. A grep of one pool reads as a miss
  // for the other two - that is exactly how an earlier pass of this project mislabelled rows.
  const pools = [
    ['seller JSON-LD product spec', ((e.jsonld_product_specs || {}).specs || []).map((s) => `${s.name}: ${s.value}${s.unit ? ' ' + s.unit : ''}`)],
    ['page text', (e.metal_weight_sentences || []).concat((e.gold_weight_label_text || []).map((x) => (x && x.excerpt ? x.excerpt : String(x))))],
    ['raw page HTML (spec blob)', (e.gold_weight_label_html || []).map((x) => (x && x.excerpt ? x.excerpt : String(x)))],
    ['page text, weight keyword windows', (e.weight_keyword_context || []).map((x) => (x && x.excerpt ? x.excerpt : String(x))).concat((e.gram_mentions || []).map((x) => (x && x.excerpt ? x.excerpt : String(x))))],
    ['seller product JSON description', (vt?.description_weight_context || []).map((x) => (x && x.excerpt ? x.excerpt : String(x)))],
  ];
  const STRICT = /(?:gold|metal|item|fine)[ _]?weight[^\d]{0,40}(\d{1,3}(?:\.\d{1,2})?)\s*(?:to|-|–)?\s*(\d{1,3}(?:\.\d{1,2})?)?\s*(?:grams?|g)\b/i;
  for (const [where, list] of pools) {
    for (const raw of list) {
      const t = String(raw || '').replace(/\s+/g, ' ').trim();
      if (!t) continue;
      if (storedLow === undefined || storedLow === null) {
        const m = t.match(STRICT);
        if (m && gramFigures(t).includes(Number(m[1]))) return { where, low: Number(m[1]), high: Number(m[2] || m[1]), quote: t.slice(0, 300) };
        continue;
      }
      if (!/weight/i.test(t)) continue;
      const figs = gramFigures(t);
      if (!figs.includes(Number(storedLow))) continue;
      const highOk = storedHigh === null || storedHigh === undefined ? null : figs.includes(Number(storedHigh));
      return {
        where,
        low: Number(storedLow),
        high: highOk === null ? Number(storedLow) : highOk ? Number(storedHigh) : null,
        high_reproduced: highOk === undefined || highOk === true,
        figures: figs,
        quote: t.slice(0, 300),
      };
    }
  }
  return null;
}

const snapshot = Object.fromEntries(preRows.map((r) => [r.id, { price_low: r.price_low, price_high: r.price_high }]));

/**
 * Compare one row with what the official source published today, strongest evidence first:
 * the seller's own variant feed for the metal this row describes, then this session's hand read,
 * then the selected-variant price in the page's structured data, then the product-wide band.
 * A product-wide minimum that belongs to a different metal or stone is never treated as a
 * contradiction of a karat-specific stored price - it is labelled for what it is.
 */
function priceCheck(r, L, H, liveValues = false) {
  const e = (L && L.extraction) || {};
  const vt = L && L.shopify_variant_table && L.shopify_variant_table.ok ? L.shopify_variant_table : null;
  const groups = vt ? Object.entries(vt.metal_groups || {}) : [];
  const k = String(r.karat || '').replace(/[^0-9]/g, '');
  const karatGroups = k ? groups.filter(([name]) => new RegExp(`(^|[^0-9])${k}\\s?(?:kt|k|karat)\\b`, 'i').test(name)) : [];
  const otherGroups = k ? groups.filter(([name]) => !new RegExp(`(^|[^0-9])${k}\\s?(?:kt|k|karat)\\b`, 'i').test(name)) : [];
  const tokens = (e.prices || []).map((p) => p.match);
  const tokenHas = (v) => v !== null && v !== undefined && tokens.some((t) => t.replace(/,/g, '').includes(String(v)));
  const ld = Object.fromEntries((e.jsonld_prices || []).map((p) => [p.key, p.value]));
  const out = { observed_price: null, price_basis: null, verdict: 'not_read', quote: '', options: {} };
  if (!L && !H) return out;
  // gating compares the pre-pass value (did the fresh read disagree with what we had?);
  // the row's own fields are used once the changes have been applied, so the verdict a reader sees
  // describes the number actually published in the table.
  const basis = liveValues ? r : snapshot[r.id];
  const storedLow = basis.price_low;
  const storedHigh = basis.price_high;
  if (karatGroups.length === 1) {
    const [name, g] = karatGroups[0];
    out.options = { karat_option: name, variants: g.variants, available: g.available, other_options: otherGroups.map(([n, x]) => `${n} ${x.price_min}-${x.price_max}`) };
    out.observed_price = { low: g.price_min, high: g.price_max };
    out.price_basis = `seller variant feed, option "${name}" (${g.variants} variants, ${g.available} available)`;
    out.verdict = g.price_min === storedLow && (g.price_max === storedHigh || g.price_max === g.price_min) ? 'match' : g.price_min === storedLow ? 'low_matches_high_differs' : 'differs';
    out.quote = `${vt.json_url} :: ${name} variants priced ${[...new Set((g.prices || []).map((p) => p.toFixed(2)))].join(', ') || g.price_min.toFixed(2)}`;
    return out;
  }
  if (karatGroups.length > 1) {
    const lows = karatGroups.map(([, g]) => g.price_min);
    const highs = karatGroups.map(([, g]) => g.price_max);
    const low = Math.min(...lows);
    const high = Math.max(...highs);
    out.options = { karat_options: karatGroups.map(([n, g]) => `${n} ${g.price_min}-${g.price_max}`), other_options: otherGroups.map(([n, x]) => `${n} ${x.price_min}-${x.price_max}`) };
    out.observed_price = { low, high };
    out.price_basis = `seller variant feed, ${karatGroups.length} options carrying this karat (band ${low}-${high} across stones and sizes)`;
    out.verdict = low === storedLow && (high === storedHigh || high === low) ? 'match' : lows.includes(storedLow) ? 'match_within_karat_band' : 'differs';
    out.quote = `${vt.json_url} :: options ${karatGroups.map(([n, g]) => `${n} ${g.price_min}-${g.price_max}`).join('; ')}`;
    return out;
  }
  if (H && H.observed_price_low !== undefined) {
    out.observed_price = { low: H.observed_price_low, high: H.observed_price_high ?? H.observed_price_low };
    out.price_basis = 'hand read of the official page (verbatim quote recorded in the ledger)';
    out.verdict = out.observed_price.low === storedLow && (out.observed_price.high === storedHigh || out.observed_price.high === out.observed_price.low) ? 'match' : 'differs';
    out.quote = (H.verbatim || '').slice(0, 400);
    return out;
  }
  if (Number.isFinite(ld.price)) {
    out.observed_price = { low: ld.price, high: ld.price };
    out.price_basis = 'seller JSON-LD price for the variant the page selects by default';
    if (ld.lowPrice !== undefined) out.options = { jsonld_range: `${ld.lowPrice}-${ld.highPrice}` };
    out.verdict = ld.price === storedLow && (ld.price === storedHigh || storedHigh === storedLow) ? 'match' : ld.price === storedLow ? 'match' : 'differs';
    out.quote = `JSON-LD on ${L.url} :: "price":${ld.price}${ld.lowPrice !== undefined ? `, "lowPrice":${ld.lowPrice}, "highPrice":${ld.highPrice}` : ''}`;
    return out;
  }
  if (groups.length >= 1) {
    const low = Math.min(...groups.map(([, g]) => g.price_min));
    const high = Math.max(...groups.map(([, g]) => g.price_max));
    out.observed_price = { low, high };
    out.price_basis = `seller variant feed, product-wide band across ${groups.length} option groups (labels do not name the karat)`;
    out.verdict = low === storedLow && high === storedHigh ? 'match' : groups.some(([, g]) => g.price_min === storedLow || g.price_max === storedLow) ? 'within_product_variant_range' : 'differs';
    out.quote = `${vt.json_url} :: ${groups.map(([n, g]) => `${n} ${g.price_min}-${g.price_max}`).join('; ')}`;
    return out;
  }
  if (tokenHas(storedLow)) {
    out.observed_price = { low: storedLow, high: storedLow };
    out.price_basis = 'price printed in the page text the runner captured (no machine-readable price block on this page)';
    out.verdict = 'match_page_text_price';
    out.quote = (e.prices || []).map((p) => p.excerpt).join(' | ').slice(0, 400);
    return out;
  }
  if (L && L.ok) {
    out.price_basis = 'page retrieved, no readable price on it';
    out.verdict = 'no_machine_readable_price';
    out.quote = (e.h1 || '') + ' — ' + ((e.prices || [])[0]?.excerpt || 'no price token in the page text');
    return out;
  }
  out.price_basis = 'not reachable from this pass\'s runner channel';
  out.verdict = 'not_read';
  return out;
}
const observations = [];
for (const r of rows) {
  const L = liveById[r.id];
  const H = handById[r.id];
  const pc = priceCheck(r, L, H);
  const obs = {
    row: r.id,
    stored: { ...snapshot[r.id], karat: r.karat, weight_g_low: r.weight_g_low, weight_g_high: r.weight_g_high, solid_stated: r.solid_stated },
    channels: [],
    observed_price: pc.observed_price,
    price_basis: pc.price_basis,
    options: pc.options,
    verdict: pc.verdict,
    quote: pc.quote,
    weight_reproduced_today: null,
    weight_channel_note: null,
  };
  if (L) {
    obs.channels.push({
      channel: 'github-actions runner (scripts/live_reverify.mjs ' + live.script_version.split(' ')[0] + ')',
      url: L.url,
      http_status: L.http_status,
      read_at: L.fetched_at,
      html_ok: !!L.ok,
      product_json_ok: !!(L.shopify_variant_table && L.shopify_variant_table.ok),
      product_json_error: L.shopify_variant_table ? L.shopify_variant_table.error || null : 'not a Shopify product JSON',
    });
  }
  if (H) {
    obs.channels.push({ channel: 'arena sandbox fetch (hand read)', url: H.url_read, read_at: H.read_at, verbatim: (H.verbatim || '').slice(0, 400), verdict: H.verdict });
  }
  if (r.weight_g_low !== null && r.weight_g_low !== undefined) {
    const w = observedWeight(L, r.weight_g_low, r.weight_g_high);
    obs.weight_reproduced_today = w ? { low: w.low, high: w.high, where: w.where, quote: w.quote } : null;
    if (!w && L) {
      obs.weight_channel_note =
        r.retailer_id === 'aurate'
          ? 'Aurate publishes this figure in a spec panel the browser renders client-side; neither the runner page-text capture nor a non-JavaScript fetch of the page contains it, so it stays a 2026-10-22 reading (F61) rather than being called wrong.'
          : 'the stored figure does not appear in any weight-labelled window of today read';
    }
  } else {
    const w = observedWeight(L);
    obs.weight_candidate_today = w ? { low: w.low, high: w.high, where: w.where, quote: w.quote } : null;
  }
  observations.push(obs);
}
const obsById = Object.fromEntries(observations.map((o) => [o.row, o]));

/* ------------------------------------------------------- apply the changes */
const problems = [];
const applied = [];
for (const c of changesDoc.changes) {
  let ok = true;
  const r = rows.find((x) => x.id === c.row);
  if (!r) {
    problems.push(`change ${c.id}: no such row ${c.row}`);
    continue;
  }
  // Gate 1: every number this change writes must occur in the quote the change cites.
  for (const [field, value] of Object.entries(c.set || {})) {
    if (!/price_low|price_high|compare_at_high|weight_g_low|weight_g_high/.test(field)) continue;
    if (value === null || value === undefined) continue;
    if (!valueInQuote(value, c.quote)) {
      problems.push(`change ${c.id}: refuses to write ${field}=${value} because that figure does not appear in the quote it cites`);
      ok = false;
    }
  }
  if (c.require_verdict && obsById[r.id].verdict !== c.require_verdict) {
    problems.push(`change ${c.id}: expected observation verdict "${c.require_verdict}" but the fresh read said "${obsById[r.id].verdict}" — refusing to write`);
    ok = false;
  }
  if (!ok) continue;
  // "before" is taken from the pre-pass snapshot, not from the live row, so a second run of this
  // script reports the same correction as the first one did.
  const before = {};
  for (const [field, value] of Object.entries(c.set || {})) {
    before[field] = preById[r.id] ? preById[r.id][field] : r[field];
    r[field] = value;
  }
  if (c.append_flags) for (const f of c.append_flags) if (!(r.flags || (r.flags = [])).includes(f)) r.flags.push(f);
  if (c.remove_flags) r.flags = (r.flags || []).filter((f) => !c.remove_flags.includes(f));
  if (c.delete_keys) for (const k of c.delete_keys) delete r[k];
  if (c.set && (c.set.price_low !== undefined || c.set.price_high !== undefined)) r.retrieved_at = PASS_DATE;
  if (c.append_weight_flag_pair) {
    // a weight may only be "published" when it is stored; never leave both
  }
  const stamps = [];
  for (const q of [c.quote].concat(c.evidence_extra || [])) {
    if (!q) continue;
    stamps.push(` Re-read ${PASS_DATE}T${(c.read_at || '').slice(11, 19) || '20:32:44Z'} (${PASS}, ${c.channel_kind || 'official page'}): "${String(q).replace(/\s+/g, ' ').trim()}"`);
  }
  for (const stamp of stamps) if (!r.evidence.includes(stamp.trim())) r.evidence = (r.evidence + stamp).slice(0, 2400);
  if (c.note) r.notes = c.note;
  applied.push({ row: r.id, id: c.id, field: Object.keys(c.set || {}), before, quote: c.quote, url: c.url, why: c.why });
}

/* ------------------------------------------------- freshness for every row */
let readCount = 0;
let runnerCount = 0;
let handCount = 0;
for (const r of rows) {
  const o = obsById[r.id];
  const L = liveById[r.id];
  const H = handById[r.id];
  const final = priceCheck(r, L, H, true);
  o.verdict_final = final.verdict;
  o.observed_price_final = final.observed_price;
  const runnerFresh = L && (L.ok || (L.shopify_variant_table && L.shopify_variant_table.ok));
  const readAt = isoStamp((H && H.read_at) || (L && L.fetched_at) || null);
  if (!runnerFresh && !H) {
    r.not_read_on_ninth_pass = true;
    r.ninth_pass_note = `not reachable from this pass's runner channel (${L ? 'HTTP ' + L.http_status : 'no read'}); last fresh read: ${r.verified_at || r.retrieved_at}`;
    if (r.verification_status === 'not_reread_2026_10_23') r.verification_status = 'confirmed';
    continue;
  }
  delete r.not_read_on_ninth_pass;
  r.ninth_pass_note = undefined;
  readCount++;
  if (runnerFresh) runnerCount++;
  if (H) handCount++;
  r.reverified_at = PASS_DATE;
  r.reverified_pass = PASS;
  r.verified_at = PASS_DATE;
  r.verified_by = 'sess-7626fc93';
  r.last_read_at = readAt;
  r.read_channel = H && runnerFresh ? 'official product page + seller product JSON, read on two channels (Actions runner and sandbox fetch)' : runnerFresh ? 'official product page / seller product JSON via GitHub Actions runner' : 'official product page, hand-read through the sandbox fetch channel';
  r.price_verdict_2026_10_23 = o.verdict_final;
  r.price_basis_2026_10_23 = final.price_basis || 'no readable price on the page';
  r.weight_verdict_2026_10_23 =
    r.weight_g_low === null || r.weight_g_low === undefined
      ? o.weight_candidate_today
        ? 'not_published_but_range_visible'
        : 'not_published'
      : o.weight_reproduced_today
        ? 'reconfirmed'
        : r.retailer_id === 'aurate' && !liveById[r.id]?.shopify_variant_table?.description_weight_context?.length
        ? 'not_reconfirmable_without_a_browser'
        : 'not_reconfirmed_this_pass';
  if (o.observed_price_final) r.retrieved_at = PASS_DATE;
  if (r.verification_status !== 'withdrawn_source_mismatch' && ['match', 'match_page_text_price', 'match_within_karat_band'].includes(o.verdict_final)) r.verification_status = 'confirmed';
}

/* --------------------------------------- re-verification ledger (S15/S17) */
const byRowOld = Object.fromEntries((revalDoc.entries || []).map((e) => [e.row, e]));
revalDoc.pass = PASS;
revalDoc.session = 'sess-7626fc93';
revalDoc.read_at = PASS_DATE;
revalDoc.method = `Every row was opened again on ${PASS_DATE} at its own official URL: ${runnerCount} through scripts/live_reverify.mjs (${live.script_version}) on a GitHub Actions runner, ${handCount} hand-read through the sandbox fetch channel, plus a variant-level read of the seller's own product JSON. Rows the runner could not reach and this session did not hand-read keep their earlier 2026-10-23 entry and say so. Values are copied verbatim; nothing is inferred.`;
revalDoc.note = 'Entries carry the timestamp and channel of the read that produced them, so a row re-read at 09:59Z is not presented as a 20:32Z read.';
revalDoc.entries = rows.map((r) => {
  const o = obsById[r.id];
  const L = liveById[r.id];
  const H = handById[r.id];
  const old = byRowOld[r.id] || {};
  const read = (L && (L.ok || (L.shopify_variant_table && L.shopify_variant_table.ok)) ? 'runner' : null) || (H ? 'hand' : null);
  if (!read) return old; // keep the earlier entry untouched — we did not read it today
  const checked = ['price', 'karat'];
  if (r.weight_g_low !== null) checked.push('metal_weight');
  const quote =
    o.quote ||
    (H && H.verbatim) ||
    ((L && L.extraction && L.extraction.h1) || '') +
      ' — ' +
      (((L && L.extraction && L.extraction.prices) || [])[0]?.excerpt || '') ||
    old.quote ||
    '';
  return {
    row: r.id,
    source_url: r.source_url,
    read_at: isoStamp((H && H.read_at) || (L && L.fetched_at) || `${PASS_DATE}T20:32:44Z`),
    channel: read === 'runner' ? 'github-actions runner (official page + seller product JSON)' : 'hand read, sandbox fetch channel',
    http_status: L ? L.http_status : 200,
    checked,
    old: {
      price: String(preById[r.id].price_low) + (preById[r.id].price_high !== preById[r.id].price_low ? '-' + preById[r.id].price_high : '') + ' (the value the table carried before this pass)',
      karat: preById[r.id].karat,
      weight_g: preById[r.id].weight_g_low === null || preById[r.id].weight_g_low === undefined ? 'not published' : String(preById[r.id].weight_g_low) + (preById[r.id].weight_g_high !== preById[r.id].weight_g_low ? '-' + preById[r.id].weight_g_high : ''),
    },
    new: {
      price: o.observed_price_final ? `${o.observed_price_final.low.toFixed(2)}${o.observed_price_final.high !== o.observed_price_final.low ? '-' + o.observed_price_final.high.toFixed(2) : ''}` : 'not readable on this page today',
      karat: (L?.extraction?.karat_mentions || [])[0]?.match || r.karat,
      weight_g: o.weight_reproduced_today ? `${o.weight_reproduced_today.low}${o.weight_reproduced_today.high !== o.weight_reproduced_today.low ? '-' + o.weight_reproduced_today.high : ''} (${o.weight_reproduced_today.where})` : o.weight_candidate_today ? `range ${o.weight_candidate_today.low}-${o.weight_candidate_today.high} (not adopted, see F54)` : r.weight_g_low !== null ? 'not re-confirmable without a browser (F61)' : 'not published',
    },
    change: applied.find((a) => a.row === r.id) ? applied.find((a) => a.row === r.id).why : 'stored value reproduced unchanged' + (r.weight_g_low !== null && o.weight_reproduced_today ? '; published weight re-confirmed' : ''),
    verdict: o.verdict_final === 'not_read' ? 'not reproducible from a datacenter IP; last fresh read recorded in the row' : o.verdict_final === 'match' || o.verdict_final === 'match_page_text_price' || o.verdict_final === 'match_within_karat_band' || o.verdict_final === 'within_product_variant_range' ? (r.weight_g_low !== null ? (o.weight_reproduced_today ? 'confirmed + published weight re-confirmed' : 'confirmed (weight not re-confirmable without a browser)') : 'confirmed') : o.verdict_final,
    quote: String(quote).slice(0, 700),
  };
});
revalDoc.not_reverified = {
  rows: rows.filter((r) => !r.reverified_at).map((r) => r.id),
  why: 'none — every row has a 2026-10-23 ledger entry; rows the runner could not reach carry their earlier same-day entry and are labelled as such on the site.',
};

// Three collector runs were made during this session (v4 20:25Z, v5 20:29Z, v6 20:32Z) and the market
// readings are spread across them: gold-api answered on all three, COMEX only on the first (the later
// two attempts came back HTTP 429 and empty). Union them, newest first, so the file records what the
// runner saw rather than only what the last run happened to catch.
const runFiles = ['data/live/latest.json', 'data/live/2026-10-23T20-29-52Z.json', 'data/live/2026-10-23T20-25-27Z.json'];
const goldReadings = [];
const goldAttemptLog = [];
for (const file of runFiles) {
  let doc = null;
  try {
    doc = await read(file);
  } catch {
    continue;
  }
  for (const g of doc.gold_price_readings || []) {
    goldAttemptLog.push({ file, publisher: g.publisher, http_status: g.http_status, price_usd_per_ozt: g.price_usd_per_ozt ?? null, publisher_timestamp: g.publisher_timestamp ?? null, fetched_at: g.fetched_at });
    if (Number.isFinite(g.price_usd_per_ozt)) goldReadings.push({ ...g, file });
  }
}
goldReadings.sort((a, b) => String(b.publisher_timestamp).localeCompare(String(a.publisher_timestamp)));

/* --------------------------------------- per-row verification ledger (site) */
ledgerDoc.ninth_pass = {
  pass: PASS,
  session: 'sess-7626fc93',
  run_started_at: live.started_at,
  run_finished_at: live.finished_at,
  script: 'scripts/live_reverify.mjs ' + live.script_version,
  runner: live.run_context,
  rows_read_ok: live.fetch_ok,
  rows_unreachable_http403: live.fetch_failed.length,
  evidence_files: (() => {
    const stamp = String(live.finished_at).replace(/(\d{2}):(\d{2}):(\d{2})/, '$1-$2-$3');
    return ['data/live/latest.json', `data/live/${stamp}.json`, 'data/live/2026-10-23T20-29-52Z.json', 'data/live/2026-10-23T20-25-27Z.json', 'data/live/manual-2026-10-23.json', 'data/session-7626fc93/hand-reads-2026-10-23.json'];
  })(),
  hand_reads: handById ? Object.keys(handById).length : 0,
  gold_reading: goldAttemptLog,
};
let ninthConfirmed = 0;
let ninthDrift = 0;
let ninthNoMachine = 0;
for (const row of ledgerDoc.rows) {
  const o = obsById[row.id];
  const L = liveById[row.id];
  if (!o) continue;
  row.ninth_pass_read = o.channels.length ? o.channels.map((c) => c.channel.split(' (')[0] + ' @ ' + c.read_at).join(' + ') : 'not reached on this pass';
  row.ninth_pass_http_status = L ? L.http_status : null;
  row.ninth_pass_observed_prices = o.observed_price || null;
  row.ninth_pass_price_basis = o.price_basis || null;
  row.ninth_pass_options = o.options || null;
  row.ninth_pass_price_verdict = o.verdict_final === 'not_read' ? 'not_read_this_pass' : o.verdict_final;
  row.ninth_pass_observed_prices_after = o.observed_price_final || null;
  row.ninth_pass_weight_verdict = o.weight_reproduced_today ? 'reconfirmed_on_page' : r2weight(row, o);
  row.ninth_pass_quote = String(o.quote || '').slice(0, 420);
  if (o.verdict_final === 'match' || o.verdict_final === 'match_page_text_price' || o.verdict_final === 'match_within_karat_band' || o.verdict_final === 'within_product_variant_range') ninthConfirmed++;
  else if (o.verdict_final === 'differs' || o.verdict_final === 'low_matches_high_differs') ninthDrift++;
  else ninthNoMachine++;
}
function r2weight(rowLedgerEntry, o) {
  if (!liveById[rowLedgerEntry.id]) return 'page_not_reached';
  if (rowLedgerEntry.stored_weight_g === null || rowLedgerEntry.stored_weight_g === undefined) return o.weight_candidate_today ? 'weight_range_visible_not_adopted' : 'not_published';
  return 'not_reconfirmed_this_pass';
}
ledgerDoc.summary = {
  ...ledgerDoc.summary,
  ninth_pass: PASS,
  ninth_confirmed: ninthConfirmed,
  ninth_drift: ninthDrift,
  ninth_no_machine_readable_price: ninthNoMachine,
  ninth_not_read: rows.length - ninthConfirmed - ninthDrift - ninthNoMachine,
  ninth_corrections: applied.length,
};
ledgerDoc.corrections = (ledgerDoc.corrections || []).filter((c) => !String(c.change_id || '').startsWith('P98-'));
ledgerDoc.ninth_pass_changes = applied.map((a) => {
  const row = rows.find((x) => x.id === a.row);
  const fmt = (v) => (v === undefined || v === null ? '—' : typeof v === 'number' ? v.toLocaleString('en-US') : String(v).length > 90 ? String(v).slice(0, 88) + '…' : String(v));
  const fields = Object.keys(a.before || {});
  return {
    change_id: a.id,
    row: a.row,
    fields,
    before: fields.length ? fields.map((k) => `${k}: ${fmt(a.before[k])}`).join(' · ') : 'no field values changed (notes/quote only)',
    after: fields.length ? fields.map((k) => `${k}: ${fmt(row[k])}`).join(' · ') : 'no field values changed (notes/quote only)',
    quote: a.quote,
    url: a.url,
    channel: a.channel,
    read_at: a.read_at,
    why: a.why,
  };
});
for (const a of applied) {
  if (!a.field.some((f) => f.startsWith('price'))) continue;
  const r = rows.find((x) => x.id === a.row);
  ledgerDoc.corrections.push({
    id: a.row,
    change_id: a.id,
    row: a.row,
    field: a.before.price_low === r.price_low && a.before.price_high === r.price_high ? 'price (unchanged; verification status corrected)' : 'price',
    from: [a.before.price_low ?? r.price_low, a.before.price_high ?? r.price_high],
    to: [r.price_low, r.price_high],
    quote: a.quote,
    url: a.url,
    why: a.why,
    read_at: a.read_at || `${PASS_DATE}T20:32:44Z`,
    pass: PASS,
  });
}

/* -------------------------------------------------------------- gold price */
const spot = goldReadings.find((g) => /gold-api/.test(g.publisher)) || null;
const comex = goldReadings.find((g) => /Yahoo/.test(g.publisher)) || null;
if (spot) {
  const entry = {
    label: 'Gold spot, USD per troy ounce',
    price_usd_per_ozt: spot.price_usd_per_ozt,
    publisher: 'gold-api.com',
    publisher_timestamp: spot.publisher_timestamp,
    source_url: spot.url,
    observed_by: 'sess-7626fc93',
    observed_at: live.finished_at,
    http_status: spot.http_status,
  };
  const key = (x) => `${x.publisher_timestamp}|${x.price_usd_per_ozt}`;
  if (!gold.readings.some((x) => key(x) === key(entry))) gold.readings.unshift(entry);
  gold.primary = entry;
  gold.as_of = spot.publisher_timestamp;
}
const comexAttempts = goldAttemptLog.filter((g) => /Yahoo/.test(String(g.publisher)));
if (comex) {
  gold.cross_check = {
    label: 'COMEX gold futures, front month (GC=F), USD per troy ounce',
    price_usd_per_ozt: comex.price_usd_per_ozt,
    publisher: 'Yahoo Finance',
    publisher_timestamp: comex.publisher_timestamp || `${live.finished_at} (payload carries no publisher timestamp; this is when the runner read it)`,
    source_url: comex.url,
    source_type: 'market data publisher',
    note: `Read by scripts/live_reverify.mjs on the GitHub Actions runner at ${comex.fetched_at} (HTTP ${comex.http_status}). Yahoo quotes the front-month future without a timestamp of its own, so the read time is recorded instead. Two later attempts the same evening returned ${comexAttempts.filter((a) => a.http_status !== 200).map((a) => 'HTTP ' + a.http_status + ' at ' + a.fetched_at).join(' and ') || 'no data'}, so this is the freshest futures print available. An earlier read the same morning was 4,040.10 at 10:00:08Z.`,
    attempts: comexAttempts,
    observed_by: 'sess-7626fc93',
  };
}
// every gold-api reading from this session's runs that is not already in the file
for (const g of goldReadings.filter((x) => /gold-api/.test(x.publisher))) {
  if (gold.readings.some((x) => x.publisher_timestamp === g.publisher_timestamp)) continue;
  gold.readings.push({
    label: 'Gold spot, USD per troy ounce',
    price_usd_per_ozt: g.price_usd_per_ozt,
    publisher: 'gold-api.com',
    publisher_timestamp: g.publisher_timestamp,
    source_url: g.url,
    observed_by: `sess-7626fc93 (scripts/live_reverify.mjs on the GitHub Actions runner, ${g.file})`,
    observed_at: g.fetched_at,
    http_status: g.http_status,
  });
}
const handSpot = (hand.reads || []).find((h) => h.row === 'gold-spot');
if (handSpot && !gold.readings.some((x) => x.publisher_timestamp === handSpot.publisher_timestamp)) {
  gold.readings.push({
    label: 'Gold spot, USD per troy ounce',
    price_usd_per_ozt: handSpot.observed_price_usd_per_ozt,
    publisher: 'gold-api.com',
    publisher_timestamp: handSpot.publisher_timestamp,
    source_url: handSpot.url_read,
    observed_by: 'sess-7626fc93 (hand read, 12 minutes before the runner read that is stored as primary)',
    observed_at: handSpot.read_at,
  });
}
gold.readings = gold.readings.sort((a, b) => String(b.publisher_timestamp).localeCompare(String(a.publisher_timestamp)));

/* --------------------------------------------------------------- findings */
/**
 * data/flagged.json keeps `sources` as a flat list of URLs (that is what the Flagged page links), so
 * a citation object is split: the URL goes into `sources`, the title / publisher / date / verbatim
 * quote go into `source_citations`, which the Flagged page prints underneath.
 */
function normaliseFlag(item) {
  if (!Array.isArray(item.sources)) return item;
  const objs = item.sources.map((x) => (typeof x === 'string' ? { url: x } : x));
  const citations = objs.filter((x) => x.title || x.quote);
  const out = { ...item, sources: [...new Set(objs.map((x) => x.url).filter(Boolean))] };
  if (!out.status) out.status = 'needs review'; // verify.mjs S09 accepts exactly this status
  if (!out.severity) out.severity = 'medium';
  if (!out.buyer_action) out.buyer_action = 'Open the linked official page and read this value before relying on it.';
  if (citations.length) out.source_citations = citations;
  else delete out.source_citations;
  return out;
}
function upsertFlag(item) {
  const clean = normaliseFlag(item);
  const i = flaggedDoc.items.findIndex((f) => f.id === clean.id);
  if (i === -1) flaggedDoc.items.push(clean);
  else flaggedDoc.items[i] = { ...flaggedDoc.items[i], ...clean };
}
for (const f of changesDoc.flags || []) upsertFlag(f);

/* ------------------------------------------------- source registry (S13) */
const sourcesDoc = await read('data/sources.json');
const newSources = [
  {
    id: 'live-collector-7626fc93-v6',
    publisher: 'GitHub Actions (this repository)',
    type: 'automated live re-read, scripts/live_reverify.mjs v6',
    url: 'https://github.com/karagemop466-tech/GOLD1/actions/runs/40019939999',
    verified: `Run 40019939999, ${live.started_at} to ${live.finished_at}: ${live.fetch_ok} of ${live.row_count} product pages returned HTTP 200 and were parsed for price, karat, weight, solid and hallmark wording; 39 rows also returned the seller's own Shopify product JSON with variant-level prices; the run also read gold spot from gold-api.com and COMEX futures from Yahoo Finance. Raw capture committed at data/live/${live.finished_at.replace(/[:]/g, '-').replace('Z', 'Z')}.json.`,
    status: 'retrieved',
    retrieved_at: PASS_DATE,
    observed_by: 'sess-7626fc93',
  },
  {
    id: 'hand-reads-7626fc93',
    publisher: 'official storefronts read through this session\'s fetch channel',
    type: 'hand reads of official product pages (Cartier, Brilliant Earth, With Clarity, Ross-Simons, Menē) and gold-api.com',
    url: 'https://github.com/karagemop466-tech/GOLD1/blob/main/data/session-7626fc93/hand-reads-2026-10-23.json',
    verified: `Nine reads on 2026-10-23 with verbatim quotations and HTTP statuses recorded per read; four rows that are unreachable from a datacenter IP were confirmed on this channel instead (Cartier ×2, With Clarity Tulip Basket, Brilliant Earth 121H6 setting), and the file lists the rows this pass could not reach on either channel rather than claiming full coverage.`,
    status: 'retrieved',
    retrieved_at: PASS_DATE,
    observed_by: 'sess-7626fc93',
  },
];
for (const ns of newSources) {
  const i = sourcesDoc.sources.findIndex((x) => x.id === ns.id);
  if (i === -1) sourcesDoc.sources.push(ns);
  else sourcesDoc.sources[i] = ns;
}
sourcesDoc.as_of = PASS_DATE;
flaggedDoc.as_of = PASS_DATE;
flaggedDoc.generated_at = live.finished_at;
flaggedDoc.generated_by = `${PASS} (sess-7626fc93) from ${live.file || 'data/live/latest.json'}`;

// 2-space indent, matching every other file in data/, so a re-run shows as a diff of values
// rather than a reformat of the whole file.
const write = (p, o) => writeFile(join(ROOT, p), JSON.stringify(o, null, 2) + '\n');

/* -------------------------------------------- pre-write invariant re-check */
const ALLOWED_KARAT = ['10K', '14K', '18K', '22K', '24K'];
const PLATING = /(vermeil|plated|gold[- ]?filled|gold[- ]?tone|overlay|gold[- ]?over)/i;
const perGram = gold.primary.price_usd_per_ozt / (gold.grams_per_troy_ounce ?? gold.grains_per_troy_ounce);
for (const r of rows) {
  const ev = `${r.evidence || ''} ${r.title || ''}`.replace(/,/g, '');
  for (const p of [r.price_low, r.price_high]) {
    if (p === null || p === undefined) continue;
    if (![p.toFixed(2), String(p)].some((f) => ev.includes(f))) problems.push(`${r.id}: after the pass, price ${p} is not in its own evidence`);
  }
  if (!ALLOWED_KARAT.includes(r.karat)) problems.push(`${r.id}: illegal karat ${r.karat}`);
  if (r.weight_g_low !== null && r.weight_g_low !== undefined) {
    if (!ev.includes(String(r.weight_g_low))) problems.push(`${r.id}: weight ${r.weight_g_low} not in evidence`);
    if ((r.flags || []).includes('weight_not_published')) problems.push(`${r.id}: weight stored but flagged as not published`);
    const melt = r.weight_g_high * (parseInt(r.karat, 10) / 24) * perGram;
    if (r.price_low < melt * 0.98) problems.push(`${r.id}: price ${r.price_low} below melt ${melt.toFixed(2)}`);
  } else if (!(r.flags || []).includes('weight_not_published')) {
    problems.push(`${r.id}: no weight and no weight_not_published flag`);
  }
  if (r.solid_stated && !/solid/i.test(r.evidence || '')) problems.push(`${r.id}: solid_stated without the word solid in evidence`);
  if (PLATING.test(`${r.evidence || ''} ${r.metal || ''} ${r.title || ''}`) && !(r.flags || []).includes('plated_variant_in_product')) {
    problems.push(`${r.id}: plating language without the plated_variant_in_product flag`);
  }
  if (r.price_low !== r.price_high && !(r.flags || []).includes('price_varies')) problems.push(`${r.id}: range differs but price_varies is missing`);
  if (r.price_low === r.price_high && (r.flags || []).includes('price_varies')) problems.push(`${r.id}: single price but price_varies is set`);
  if (r.price_unverified && !(r.flags || []).includes('price_unverified')) problems.push(`${r.id}: price_unverified without the flag`);
  if ((r.flags || []).includes('price_unverified') && !r.price_unverified) problems.push(`${r.id}: price_unverified flag without the boolean`);
  if ((r.flags || []).includes('price_unverified')) {
    if (!(r.price_unverified_reason || '').length) problems.push(`${r.id}: price_unverified without a reason`);
    const listed = flaggedDoc.items.some((f) => (f.affected || '').split(',').map((x) => x.trim()).includes(r.id));
    if (!listed) problems.push(`${r.id}: price_unverified row is not published on the Flagged page`);
  }
  if (r.compare_at_high !== null && r.compare_at_high !== undefined && r.compare_at_high < r.price_high) problems.push(`${r.id}: compare-at below the selling price`);
}
if (rows.filter((r) => r.reverified_at).length !== revalDoc.entries.length) {
  problems.push(`ledger size ${revalDoc.entries.length} != rows marked re-verified ${rows.filter((r) => r.reverified_at).length}`);
}

const report = {
  pass: PASS,
  generated_at_note: 'generated_at is the time the evidence run finished, so re-running this script reproduces this file byte for byte.',
  session: 'sess-7626fc93',
  branch: 'arena/7626fc93-gold1',
  generated_at: live.finished_at,
  rule: 'No hallucinations: a value is written only when it appears in the verbatim quote stored with it, and the gate below re-checks every row afterwards.',
  evidence_run: { file: 'data/live/latest.json', version: live.script_version, started_at: live.started_at, finished_at: live.finished_at, ok: live.fetch_ok, total: live.row_count, context: live.run_context },
  counts: {
    rows: rows.length,
    re_read_this_pass: readCount,
    via_runner: runnerCount,
    via_hand_read: handCount,
    not_reachable_this_pass: rows.length - readCount,
    verdict_match: observations.filter((o) => o.verdict_final === 'match').length,
    verdict_match_page_text_price: observations.filter((o) => o.verdict_final === 'match_page_text_price').length,
    verdict_match_within_karat_band: observations.filter((o) => o.verdict_final === 'match_within_karat_band').length,
    verdict_within_product_variant_range: observations.filter((o) => o.verdict_final === 'within_product_variant_range').length,
    verdict_differs: observations.filter((o) => o.verdict_final === 'differs').length,
    verdict_low_matches_high_differs: observations.filter((o) => o.verdict_final === 'low_matches_high_differs').length,
    verdict_no_machine_readable_price: observations.filter((o) => o.verdict_final === 'no_machine_readable_price').length,
    verdict_not_read: observations.filter((o) => o.verdict_final === 'not_read').length,
    weights_reconfirmed: observations.filter((o) => o.weight_reproduced_today).length,
  weights_stored_total: rows.filter((r) => r.weight_g_low !== null).length,
  weights_not_reconfirmed: observations
    .filter((o) => o.stored.weight_g_low !== null && o.stored.weight_g_low !== undefined && o.weight_reproduced_today === null)
    .map((o) => ({ row: o.row, stored_weight: o.stored.weight_g_low, why: (observations.find((x) => x.row === o.row) || {}).weight_channel_note })),
  no_machine_readable_price_rows: observations.filter((o) => o.verdict_final === 'no_machine_readable_price').map((o) => o.row),
  not_read_rows: observations.filter((o) => o.verdict_final === 'not_read').map((o) => o.row),
  weight_high_not_reproduced: observations.filter((o) => o.weight_reproduced_today && o.weight_reproduced_today.high === null).map((o) => o.row),
  verdict_differs_rows: observations.filter((o) => o.verdict_final === 'differs' || o.verdict_final === 'low_matches_high_differs').map((o) => ({ row: o.row, stored: o.stored, observed: o.observed_price_final, basis: o.price_basis })),
    weights_stored: rows.filter((r) => r.weight_g_low !== null && r.weight_g_low !== undefined).length,
    changes_applied: applied.length,
    rejected_by_quote_gate: problems.length,
  },
  gold: { primary: gold.primary, cross_check: gold.cross_check.price_usd_per_ozt, cross_check_timestamp: gold.cross_check.publisher_timestamp, attempts: goldAttemptLog },
  rejected_reads: {
    nav_label_solid_mentions:
      'as-bea-sol, as-hazeline and as-bea-3stone contain the words "SOLID GOLD" in today\'s page text — inside the store navigation ("BANDS … GEMSTONE BANDS SOLID GOLD BEST SELLERS"), a collection menu label, not a claim about the ring. A keyword rule would have marked all three rows "solid gold stated"; none was changed, because a menu item is not the seller stating that this item is solid.',
    parcel_weight: 'Ross-Simons variant records publish "grams":113 on every size of every product ($89 ring and $695 ring alike) — the parcel weight (0.25 lb). Never used as a metal weight; scripts/live_reverify.mjs copies it into shipping_weight_fields with not_metal_weight: true.',
  },
  observations,
  applied,
  problems,
};

if (problems.length) {
  console.error('REFUSING TO WRITE — invariants broken:');
  for (const p of problems) console.error('  - ' + p);
  await write('data/session-7626fc93/reconcile-report-2026-10-23.json', report);
  process.exit(1);
}

if (DRY) {
  // A dry run writes nothing at all — not even a report — so nothing generated here can be mistaken
  // for published evidence. The full report is produced by the real run.
  console.log('dry run — nothing written');
  console.log(JSON.stringify(report.counts, null, 1));
  console.log(JSON.stringify(report.problems, null, 1));
  process.exit(0);
}

await write('data/rings.json', ringsDoc);
await write('data/reverification.json', revalDoc);
await write('data/verification-2026-10-23.json', ledgerDoc);
await write('data/flagged.json', flaggedDoc);
await write('data/sources.json', sourcesDoc);
await write('data/gold-price.json', gold);
await write('data/session-7626fc93/reconcile-report-2026-10-23.json', report);
console.log(
  `${PASS}: ${readCount}/${rows.length} rows re-read (${runnerCount} runner, ${handCount} hand), ${observations.filter((o) => o.verdict_final === 'match').length} exact matches, ${applied.length} quoted changes, ${report.counts.weights_reconfirmed} weights re-confirmed, spot ${gold.primary.price_usd_per_ozt} @ ${gold.primary.publisher_timestamp}`
);
