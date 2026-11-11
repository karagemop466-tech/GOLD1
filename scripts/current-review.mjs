/** Current availability is never inferred from historical evidence. */
import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

export function reviewRows(rings, retailers, asOf) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf) || !Number.isFinite(Date.parse(asOf))) throw new Error('Invalid review date');
  const seen = new Set();
  return rings.map(row => {
    if (!row.id || seen.has(row.id)) throw new Error('Missing or duplicate row ID');
    seen.add(row.id);
    const seller = retailers.find(r => r.id === row.retailer_id);
    const url = new URL(row.source_url);
    if (url.protocol !== 'https:' || url.username || url.password || !seller ||
        !(url.hostname === seller.domain || url.hostname.endsWith('.' + seller.domain))) {
      throw new Error(`Non-official or unsafe source: ${row.id}`);
    }
    const dates = [row.retrieved_at, row.reverified_at, row.verified_at].filter(Boolean).sort();
    const latest = dates.at(-1) ?? null;
    if (latest && (!Number.isFinite(Date.parse(latest)) || latest.slice(0, 10) > asOf)) throw new Error(`Invalid/future evidence: ${row.id}`);
    return {
      id: row.id, title: row.title, retailer: row.retailer, category: row.category,
      source_url: row.source_url, historical_evidence_date: latest,
      current_price: null, current_currency: null, current_karat: null,
      current_weight_g: null, current_raw_gold_g: null,
      current_verified_at: null, status: 'unverified',
      reason: row.withdrawn ? 'Previously withdrawn source mismatch; no fresh verification.' :
        'No official-source retrieval in this session; historical evidence is not a current quote.',
      historical_flags: row.flags ?? []
    };
  });
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const read = p => JSON.parse(readFileSync(p, 'utf8'));
  const asOf = process.env.REVIEW_DATE || '2026-11-11';
  const rows = reviewRows(read('data/rings.json').rows, read('data/retailers.json').retailers, asOf);
  const report = {
    reviewed_at: asOf, scope: 'Local provenance and freshness review, not live seller verification',
    network_limit: 'Retailer and gold-feed hosts are outside this session’s allowed outbound hosts. No HTTP result is claimed.',
    current_gold_price: null, current_gold_source: read('data/gold-price.json').primary.source_url,
    historical_gold_date: read('data/gold-price.json').primary.publisher_timestamp,
    recommendation: 'Look for hallucinations after every review. Automated consistency checks cannot prove source truth, current pricing, return eligibility, or physical purity.',
    rows
  };
  writeFileSync('data/current-review.json', JSON.stringify(report, null, 2) + '\n');
  console.log(`Current review: ${rows.length} source-domain checks; ${rows.length} current quotes unverified; no prices invented.`);
}
