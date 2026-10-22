#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'site/assets/app.js'), 'utf8');
const datasets = {
  'candidates.json': JSON.parse(fs.readFileSync(path.join(root, 'research/candidates.json'), 'utf8')),
  'sellers.json': JSON.parse(fs.readFileSync(path.join(root, 'research/sellers.json'), 'utf8')),
  'irregularities.json': JSON.parse(fs.readFileSync(path.join(root, 'research/irregularities.json'), 'utf8')),
  'market.json': JSON.parse(fs.readFileSync(path.join(root, 'research/policy/market.json'), 'utf8')),
  'verification.json': JSON.parse(fs.readFileSync(path.join(root, 'research/policy/verification.json'), 'utf8'))
};
const pages = [
  'index.html', 'catalog/index.html', 'catalog/solitaire.html', 'catalog/side-stones.html', 'catalog/bezel.html',
  'catalog/14k.html', 'catalog/18k.html', 'flagged.html', 'sellers.html', 'checklist.html', 'calculator.html', 'analysis.html', 'methodology.html'
];

async function waitFor(predicate, timeout = 6000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error('Timed out waiting for evidence rendering.');
}

async function loadPage(relative) {
  const html = fs.readFileSync(path.join(root, 'site', relative), 'utf8');
  const cleanPath = relative === 'index.html' ? '/' : relative.endsWith('/index.html') ? `/${relative.slice(0, -'index.html'.length)}` : `/${relative}`;
  const dom = new JSDOM(html, { url: `https://gold1.test${cleanPath}`, runScripts: 'outside-only', pretendToBeVisual: true });
  const calls = [];
  dom.window.fetch = async (url) => {
    const value = String(url);
    calls.push(value);
    assert.ok(/^(\.\.?\/data\/)/.test(value), `Unexpected nonlocal fetch: ${value}`);
    const name = value.split('/').pop();
    assert.ok(datasets[name], `Unknown local dataset: ${name}`);
    return { ok: true, status: 200, json: async () => structuredClone(datasets[name]) };
  };
  dom.window.print = () => {};
  dom.window.document.querySelectorAll('dialog').forEach((dialog) => {
    dialog.showModal = function () { this.setAttribute('open', ''); };
    dialog.close = function () { this.removeAttribute('open'); };
  });
  dom.window.eval(app);
  await waitFor(() => !dom.window.document.querySelector('.loading'));
  assert.equal(calls.length, 5, `${relative}: expected five local evidence requests.`);
  const errors = [...dom.window.document.querySelectorAll('.error-box')].filter((node) => !node.closest('noscript'));
  assert.equal(errors.length, 0, `${relative}: dynamic error box: ${errors.map((node) => node.textContent).join(' ')}`);
  const mainText = dom.window.document.querySelector('main').textContent;
  assert.ok(!/\bNaN\b|\bundefined\b|\[object Object\]/.test(mainText), `${relative}: malformed rendered value.`);
  dom.window.document.querySelectorAll('a[target="_blank"]').forEach((anchor) => {
    assert.ok(anchor.href.startsWith('https://'), `${relative}: non-HTTPS external link.`);
    assert.ok(anchor.rel.includes('noopener') && anchor.rel.includes('noreferrer'), `${relative}: unprotected external link.`);
  });
  return { dom, calls };
}

function change(dom, selector, value, eventType = 'change') {
  const control = dom.window.document.querySelector(selector);
  control.value = value;
  control.dispatchEvent(new dom.window.Event(eventType, { bubbles: true }));
}

const checks = {
  'index.html': (dom) => {
    const doc = dom.window.document;
    assert.deepEqual([...doc.querySelectorAll('#home-stats .stat-value')].map((node) => node.textContent), ['13', '13', '0', '6']);
    assert.equal(doc.querySelectorAll('#home-categories .card').length, 5);
    assert.ok(doc.querySelector('#home-market').textContent.includes('$4,025.00'));
    assert.equal(doc.querySelector('[data-nav-flag-count]').textContent, '13');
  },
  'catalog/index.html': (dom) => {
    const doc = dom.window.document;
    assert.equal(doc.querySelectorAll('#catalog-table tbody tr').length, 13);
    assert.equal(doc.querySelectorAll('#catalog-table a[href^="https://"]').length, 13);
    change(dom, '#filter-seller', 'blue-nile');
    assert.equal(doc.querySelectorAll('#catalog-table tbody tr').length, 4);
    doc.querySelector('#filter-reset').click();
    change(dom, '#filter-weight', 'missing');
    assert.equal(doc.querySelectorAll('#catalog-table tbody tr').length, 7);
    doc.querySelector('#filter-reset').click();
    change(dom, '#filter-search', '70589', 'input');
    assert.equal(doc.querySelectorAll('#catalog-table tbody tr').length, 1);
    assert.ok(doc.querySelector('#catalog-table').textContent.includes('Aurora'));
    assert.ok(doc.querySelector('#catalog-table').textContent.includes('Side stones'));
    doc.querySelector('#filter-reset').click();
    change(dom, '#filter-sort', 'price-desc');
    assert.ok(doc.querySelector('#catalog-table tbody tr').textContent.includes('$3,500'));
    change(dom, '#filter-seller', 'brilliant-earth');
    doc.querySelector('#catalog-filters').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    assert.equal(doc.querySelectorAll('#catalog-table tbody tr').length, 3);
    doc.querySelector('#filter-reset').click();
    doc.querySelector('#catalog-table .product-name').click();
    assert.equal(doc.querySelector('#evidence-dialog').open, true);
    assert.ok(doc.querySelector('#dialog-body').textContent.includes('Official product excerpts'));
    doc.querySelector('[data-dialog-close]').click();
    assert.equal(doc.querySelector('#evidence-dialog').open, false);
  },
  'catalog/solitaire.html': (dom) => assert.equal(dom.window.document.querySelectorAll('#catalog-table tbody tr').length, 7),
  'catalog/side-stones.html': (dom) => assert.equal(dom.window.document.querySelectorAll('#catalog-table tbody tr').length, 4),
  'catalog/bezel.html': (dom) => assert.equal(dom.window.document.querySelectorAll('#catalog-table tbody tr').length, 2),
  'catalog/14k.html': (dom) => {
    assert.equal(dom.window.document.querySelectorAll('#catalog-table tbody tr').length, 7);
    assert.equal(dom.window.document.querySelector('#filter-karat').disabled, true);
  },
  'catalog/18k.html': (dom) => {
    assert.equal(dom.window.document.querySelectorAll('#catalog-table tbody tr').length, 6);
    assert.equal(dom.window.document.querySelector('#filter-karat').disabled, true);
  },
  'flagged.html': (dom) => {
    const doc = dom.window.document;
    assert.equal(doc.querySelectorAll('.issue-card').length, 10);
    assert.equal(doc.querySelectorAll('.table-wrap tbody tr').length, 13);
    assert.equal(doc.querySelectorAll('[id^="candidate-"]').length, 13);
    assert.equal(doc.querySelectorAll('.table-wrap a[href^="https://"]').length, 13);
  },
  'sellers.html': (dom) => {
    const doc = dom.window.document;
    assert.equal(doc.querySelectorAll('.seller-card').length, 3);
    assert.equal(doc.querySelectorAll('.table-wrap tbody tr').length, 3);
    assert.ok(doc.body.textContent.includes('14 calendar days'));
    assert.ok(doc.body.textContent.includes('available for shipment or pickup'));
    assert.ok(doc.body.textContent.includes('chargeback'));
  },
  'checklist.html': (dom) => {
    const doc = dom.window.document;
    assert.equal(doc.querySelectorAll('.check-item').length, 9);
    assert.ok(doc.body.textContent.includes('Quantitative XRF'));
    assert.ok(doc.body.textContent.includes('60-calendar-day'));
  },
  'calculator.html': (dom) => {
    const doc = dom.window.document;
    assert.equal(doc.querySelectorAll('#calc-candidate option').length, 14);
    assert.equal(doc.querySelector('#calc-weight').value, '');
    change(dom, '#calc-candidate', 'trax-70114');
    assert.equal(doc.querySelector('#calc-weight').value, '2');
    assert.equal(doc.querySelector('#calc-karat').value, '14');
    const expected = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(2 * 14 / 24 * (4025 / 31.1034768));
    assert.ok(doc.querySelector('#calc-output').textContent.includes(expected), `Calculator missing ${expected}.`);
    assert.ok(doc.querySelector('#calc-output').textContent.includes('Nominal listed/item-weight'));
    assert.ok(doc.querySelector('#calc-output').textContent.includes('Actual verified raw-gold amount'));
    doc.querySelector('#gold-calculator').dispatchEvent(new dom.window.Event('submit', { bubbles: true, cancelable: true }));
    assert.ok(doc.querySelector('#calc-output').textContent.includes(expected));
    change(dom, '#calc-candidate', 'bn-501130y14');
    assert.equal(doc.querySelector('#calc-weight').value, '');
    assert.ok(doc.querySelector('#calc-error').textContent.includes('intentionally left blank'));
    change(dom, '#calc-weight', '-2', 'input');
    assert.ok(doc.querySelector('#calc-error').textContent.includes('greater than 0'));
    change(dom, '#calc-weight', '2', 'input');
    change(dom, '#calc-spot', '-1', 'input');
    assert.ok(doc.querySelector('#calc-error').textContent.includes('positive 24K bid'));
    doc.querySelector('#calc-reset').click();
    assert.equal(doc.querySelector('#calc-spot').value, '4025');
    assert.equal(doc.querySelector('#calc-weight').value, '');
    assert.equal(doc.querySelectorAll('#calculator-evidence tbody tr').length, 13);
  },
  'analysis.html': (dom) => {
    const doc = dom.window.document;
    assert.equal(doc.querySelectorAll('.table-wrap tbody tr').length, 6);
    assert.ok(doc.querySelector('#analysis-app').textContent.includes('Unsupported conclusions'));
    assert.ok(doc.querySelector('#analysis-app').textContent.includes('net metal weight is unverified'));
  },
  'methodology.html': (dom) => {
    const doc = dom.window.document;
    const expectedUrls = new Set(datasets['candidates.json'].candidates.map((row) => row.officialProductUrl));
    const actualUrls = new Set([...doc.querySelectorAll('#methodology-sources a[href^="https://"]')].map((anchor) => anchor.href).filter((href) => expectedUrls.has(href)));
    assert.equal(actualUrls.size, 13);
    assert.ok(doc.querySelector('#methodology-sources').textContent.includes('Gemological Institute of America'));
    assert.ok(doc.querySelector('#methodology-sources').textContent.includes('LBMA'));
  }
};

(async () => {
  for (const relative of pages) {
    const { dom } = await loadPage(relative);
    try {
      checks[relative](dom);
      console.log(`PASS runtime: ${relative}`);
    } finally {
      dom.window.close();
    }
  }
  console.log(`PASS browser-style integration: ${pages.length} pages, local-only data, filters, dialogs, seller policies, flags, calculator, and analysis`);
})().catch((error) => {
  console.error('RUNTIME AUDIT FAILED');
  console.error(error.stack || error);
  process.exit(1);
});
