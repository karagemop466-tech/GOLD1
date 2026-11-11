import test from 'node:test';
import assert from 'node:assert/strict';
import { reviewRows } from '../scripts/current-review.mjs';
const sellers = [{id: 's', domain: 'example.com'}];
const row = {id: 'ring', retailer_id: 's', source_url: 'https://www.example.com/ring', verified_at: '2026-10-23', price_low: 100};
test('historical prices never become current facts', () => {
  const [result] = reviewRows([row], sellers, '2026-11-11');
  for (const field of ['current_price', 'current_currency', 'current_karat', 'current_weight_g', 'current_raw_gold_g', 'current_verified_at']) assert.equal(result[field], null);
  assert.equal(result.status, 'unverified');
  assert.equal(result.historical_evidence_date, '2026-10-23');
});
test('reject foreign, deceptive, credentialed and insecure links', () => {
  for (const source_url of ['https://example.com.evil.test/r', 'https://evil-example.com/r', 'http://example.com/r', 'https://user@example.com/r', 'javascript:alert(1)']) {
    assert.throws(() => reviewRows([{...row, source_url}], sellers, '2026-11-11'));
  }
});
test('reject duplicate rows, missing sellers and future evidence', () => {
  assert.throws(() => reviewRows([row, row], sellers, '2026-11-11'));
  assert.throws(() => reviewRows([row], [], '2026-11-11'));
  assert.throws(() => reviewRows([{...row, verified_at: '2026-12-01'}], sellers, '2026-11-11'));
});

import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
test('published current register covers every canonical record with blank fields and official links', () => {
  const canonical = JSON.parse(readFileSync('data/rings.json', 'utf8')).rows;
  const report = JSON.parse(readFileSync('data/current-review.json', 'utf8'));
  assert.deepEqual(report.rows.map(r => r.id), canonical.map(r => r.id));
  const doc = new JSDOM(readFileSync('current-review.html', 'utf8')).window.document;
  const rows = [...doc.querySelectorAll('tbody tr')];
  assert.equal(rows.length, canonical.length);
  rows.forEach((tr, i) => {
    assert.equal(tr.querySelector('td:last-child a').href, canonical[i].source_url);
    assert.equal(tr.querySelectorAll('td[aria-label="Unverified"]').length, 4);
    tr.querySelectorAll('td[aria-label="Unverified"]').forEach(td => assert.equal(td.textContent, ''));
  });
  for (const path of ['index.html', 'flagged.html', 'calculator.html', ...canonical.map(r => `rings/${r.id}.html`)]) {
    const page = new JSDOM(readFileSync(path, 'utf8')).window.document;
    assert.match(page.querySelector('main > section').textContent, /No hallucinations/);
    assert.match(page.querySelector('main > section').textContent, /not current verified offers/);
  }
});
