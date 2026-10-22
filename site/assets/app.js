/* GOLD1 — safe, local-only rendering for the static evidence dashboard. */
(() => {
  'use strict';

  const body = document.body;
  const root = body.dataset.root || '.';
  const page = body.dataset.page || '';
  const money = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
  const state = { candidates: [], sellers: [], irregularities: [], market: null, verification: null, sellerMap: new Map() };

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function append(parent, ...children) {
    children.flat(Infinity).forEach((child) => {
      if (child === null || child === undefined || child === false) return;
      if (child instanceof Node) parent.append(child);
      else parent.append(document.createTextNode(String(child)));
    });
    return parent;
  }

  function clear(node, ...children) {
    node.replaceChildren();
    append(node, ...children);
    return node;
  }

  function safeHttps(value) {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
    } catch (_) {
      return null;
    }
  }

  function externalLink(value, label, className = '') {
    const url = safeHttps(value);
    if (!url) return el('span', 'text-danger', 'Invalid source URL');
    const a = el('a', className, label || 'Official source ↗');
    a.href = url;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    return a;
  }

  function localLink(path, label, className = '') {
    const a = el('a', className, label);
    a.href = `${root}/${path}`;
    return a;
  }

  function formatUsd(value) {
    return Number.isFinite(value) ? money.format(value) : '— Unverified';
  }

  function formatGrams(value, digits = 3) {
    if (!Number.isFinite(value)) return '— Unverified';
    return `${new Intl.NumberFormat('en-US', { maximumFractionDigits: digits }).format(value)} g`;
  }

  function unverified(label = 'Unverified') {
    return el('span', 'unverified', `— ${label}`);
  }

  function sourceLink(url, label = 'Official source ↗') {
    return externalLink(url, label, 'small');
  }

  function flagged(candidate) {
    return candidate.clearanceStatus !== 'purchase-ready';
  }

  function sellerFor(candidate) {
    return state.sellerMap.get(candidate.sellerId);
  }

  function sellerName(candidate) {
    return sellerFor(candidate)?.name || candidate.sellerId;
  }

  function nominal(candidate) {
    if (!Number.isFinite(candidate.listedWeightGrams) || !Number.isFinite(candidate.karat)) return null;
    const perGram = state.market.source.bidPerTroyOunce / state.market.conversion.gramsPerTroyOunce;
    const fineGrams = candidate.listedWeightGrams * candidate.karat / 24;
    return { fineGrams, value: fineGrams * perGram, perGram };
  }

  function stat(value, label, alert = false) {
    const card = el('div', `stat${alert ? ' stat-alert' : ''}`);
    append(card, el('span', 'stat-value', value), el('span', 'stat-label', label));
    return card;
  }

  function tag(text, type = '') {
    return el('span', `tag${type ? ` tag-${type}` : ''}`, text);
  }

  function flagPill(text = 'Flagged') {
    return el('span', 'flag-pill', text);
  }

  function detailButton(candidate) {
    const button = el('button', 'icon-button product-name', candidate.name);
    button.type = 'button';
    button.addEventListener('click', () => openEvidence(candidate));
    return button;
  }

  function quoteBlock(quote, url, label = 'Source excerpt') {
    const wrapper = el('div');
    const block = el('blockquote', 'quote', `“${quote}”`);
    const footer = el('footer');
    append(footer, externalLink(url, label + ' ↗'));
    append(block, footer);
    append(wrapper, block);
    return wrapper;
  }

  function tableRegion(label, captionText, headers, rows) {
    const wrap = el('div', 'table-wrap');
    wrap.tabIndex = 0;
    wrap.setAttribute('role', 'region');
    wrap.setAttribute('aria-label', label);
    const table = el('table');
    const caption = el('caption', '', captionText);
    const thead = el('thead');
    const headerRow = el('tr');
    headers.forEach((header) => {
      const th = el('th', '', header);
      th.scope = 'col';
      append(headerRow, th);
    });
    append(thead, headerRow);
    const tbody = el('tbody');
    rows.forEach((cells) => {
      const tr = el('tr');
      cells.forEach((cell) => {
        const td = el('td');
        append(td, cell);
        append(tr, td);
      });
      append(tbody, tr);
    });
    append(table, caption, thead, tbody);
    append(wrap, table);
    return wrap;
  }

  function validateData() {
    if (!Array.isArray(state.candidates) || !Array.isArray(state.sellers) || !Array.isArray(state.irregularities)) {
      throw new Error('Evidence arrays are malformed.');
    }
    const ids = new Set();
    state.candidates.forEach((candidate) => {
      if (!/^[A-Za-z0-9-]+$/.test(candidate.id || '') || ids.has(candidate.id)) throw new Error('Candidate IDs are invalid or duplicated.');
      ids.add(candidate.id);
      if (!safeHttps(candidate.officialProductUrl)) throw new Error(`Invalid product URL for ${candidate.id}.`);
      if (!Number.isFinite(candidate.karat) || candidate.karat <= 0 || candidate.karat > 24) throw new Error(`Invalid karat for ${candidate.id}.`);
      ['priceUsd', 'listedWeightGrams', 'netMetalWeightGrams'].forEach((field) => {
        if (candidate[field] !== null && (!Number.isFinite(candidate[field]) || candidate[field] < 0)) throw new Error(`Invalid numeric field ${field} for ${candidate.id}.`);
      });
      if (!Array.isArray(candidate.evidence) || !Array.isArray(candidate.flags)) throw new Error(`Missing evidence/flags for ${candidate.id}.`);
      candidate.evidence.forEach((evidence) => {
        if (evidence.sourceUrl !== candidate.officialProductUrl || !safeHttps(evidence.sourceUrl) || !evidence.quote) throw new Error(`Evidence mismatch for ${candidate.id}.`);
      });
    });
    state.sellers.forEach((seller) => {
      if (!seller.id || !safeHttps(seller.officialUrl)) throw new Error('Invalid seller record.');
    });
    state.irregularities.forEach((issue) => {
      (issue.affectedCandidateIds || []).forEach((id) => {
        if (!ids.has(id)) throw new Error(`Unknown affected candidate ${id}.`);
      });
      if (issue.sourceUrl && !safeHttps(issue.sourceUrl)) throw new Error(`Invalid issue URL ${issue.id}.`);
    });
    const source = state.market?.source;
    if (!source || !Number.isFinite(source.bidPerTroyOunce) || source.bidPerTroyOunce <= 0 || !Number.isFinite(state.market.conversion?.gramsPerTroyOunce)) {
      throw new Error('Market snapshot is malformed.');
    }
    if (!state.verification || !Array.isArray(state.verification.gates)) throw new Error('Verification policy is malformed.');
  }

  async function fetchJson(path) {
    const response = await fetch(`${root}/data/${path}`, { credentials: 'same-origin', headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Unable to load ${path}: ${response.status}`);
    return response.json();
  }

  function fatal(error) {
    console.error('GOLD1 evidence loading failed:', error);
    const message = 'The audited evidence could not be loaded or failed validation. Do not rely on this page; no fallback values have been inserted.';
    document.querySelectorAll('.loading').forEach((node) => {
      const box = el('div', 'error-box', message);
      node.replaceWith(box);
    });
    ['catalog-table', 'flagged-app', 'sellers-app', 'checklist-app', 'analysis-app', 'methodology-sources', 'calculator-evidence'].forEach((id) => {
      const node = document.getElementById(id);
      if (node && !node.querySelector('.error-box')) clear(node, el('div', 'error-box', message));
    });
    const count = document.getElementById('catalog-count');
    if (count) count.textContent = 'Evidence unavailable';
  }

  function renderCommon() {
    const count = state.candidates.filter(flagged).length;
    document.querySelectorAll('[data-nav-flag-count]').forEach((node) => {
      node.textContent = String(count);
      node.hidden = false;
      node.setAttribute('aria-label', `${count} candidates flagged`);
      node.title = `${count} candidates flagged for review`;
    });
  }

  function renderHome() {
    const stats = document.getElementById('home-stats');
    if (!stats) return;
    const flaggedCount = state.candidates.filter(flagged).length;
    const readyCount = state.candidates.length - flaggedCount;
    const weightCount = state.candidates.filter((candidate) => Number.isFinite(candidate.listedWeightGrams)).length;
    clear(stats,
      stat(state.candidates.length, 'Active official-page candidates'),
      stat(flaggedCount, 'Candidates flagged for review', true),
      stat(readyCount, 'Purchase-ready after all gates', readyCount === 0),
      stat(weightCount, `Listed weights · ${state.candidates.length - weightCount} remain blank`)
    );

    const categories = document.getElementById('home-categories');
    const definitions = [
      { title: 'Solitaire', path: 'catalog/solitaire.html', count: (c) => c.category === 'Solitaire', text: 'Official solitaire classifications and their evidence gaps.' },
      { title: 'Side stones', path: 'catalog/side-stones.html', count: (c) => c.category === 'Side stones', text: 'Rings with side diamonds stated by the seller.' },
      { title: 'Bezel', path: 'catalog/bezel.html', count: (c) => c.category === 'Bezel', text: 'Official bezel-prong product names and setting details.' },
      { title: '14K gold', path: 'catalog/14k.html', count: (c) => c.karat === 14, text: 'Explicit 14K variants; physical purity remains unverified.' },
      { title: '18K gold', path: 'catalog/18k.html', count: (c) => c.karat === 18, text: 'Explicit 18K variants; physical purity remains unverified.' }
    ];
    const cards = definitions.map((definition) => {
      const count = state.candidates.filter(definition.count).length;
      const card = localLink(definition.path, '', 'card card-link');
      append(card, el('span', 'eyebrow', `${count} candidate${count === 1 ? '' : 's'}`), el('h3', '', definition.title), el('p', 'small muted', definition.text), el('span', 'arrow', 'Open category →'));
      return card;
    });
    clear(categories, ...cards);

    const market = document.getElementById('home-market');
    const source = state.market.source;
    const marketTitle = el('h3', '', `${formatUsd(source.bidPerTroyOunce)} / troy oz`);
    const marketList = el('ul', 'small muted');
    append(marketList,
      el('li', '', `Bid-side 24K reference; ask ${formatUsd(source.askPerTroyOunce)}`),
      el('li', '', `Source-displayed ${formatUsd(source.displayedBidPerGram)}/g`),
      el('li', '', source.sourceTimestamp),
      el('li', '', 'Dated snapshot—not a live feed or jewelry valuation.')
    );
    clear(market, el('p', 'eyebrow', 'Kitco · Live GoldPrice panel'), marketTitle, marketList, externalLink(source.url, 'Open Kitco source ↗', 'small'));
  }

  function candidateRow(candidate) {
    const product = el('div', 'product-cell');
    append(product, detailButton(candidate), el('span', 'product-meta', `${candidate.officialItemNumber} · ${candidate.category}`), el('span', 'product-meta', candidate.style));

    const seller = el('div');
    append(seller, el('span', '', sellerName(candidate)), el('span', 'product-meta', candidate.retrievedDate));

    const price = el('div', 'price-cell');
    append(price, el('span', 'price', Number.isFinite(candidate.priceUsd) ? formatUsd(candidate.priceUsd) : '— Unverified'), el('span', 'price-basis', candidate.priceBasis || 'Price basis unverified'));

    const metal = el('div', 'stack');
    append(metal, el('span', '', `${candidate.karat}K · ${candidate.metalColor}`));
    if (candidate.solidGold === 'seller-stated') append(metal, tag('Solid: seller-stated', 'gold'));
    else append(metal, unverified('Solid gold unverified'));

    const weight = el('div');
    if (Number.isFinite(candidate.listedWeightGrams)) {
      append(weight, el('strong', '', formatGrams(candidate.listedWeightGrams, 2)), el('span', 'product-meta', 'Listed item weight; not net metal'));
    } else append(weight, unverified(), el('span', 'product-meta', 'No nominal math'));

    const gold = el('div', 'gold-math');
    const calc = nominal(candidate);
    if (calc) {
      append(gold, el('strong', '', `${formatUsd(calc.value)}†`), el('span', 'product-meta', `${formatGrams(calc.fineGrams)} fine-gold nominal†`), el('span', 'product-meta', 'Actual net/raw value: — Unverified'));
    } else append(gold, unverified('Gold math unavailable'));

    const review = el('div', 'source-cell stack');
    const flagLink = localLink(`flagged.html#candidate-${candidate.id}`, `${candidate.flags.length} flags`, 'flag-pill');
    append(review, flagLink, sourceLink(candidate.officialProductUrl), el('span', 'product-meta', `Retrieved ${candidate.retrievedDate}`));
    return [product, seller, price, metal, weight, gold, review];
  }

  function renderCatalog() {
    const main = document.querySelector('[data-catalog-page]');
    if (!main) return;
    const fixedCategory = main.dataset.fixedCategory || '';
    const fixedKarat = main.dataset.fixedKarat || '';
    const search = document.getElementById('filter-search');
    const seller = document.getElementById('filter-seller');
    const karat = document.getElementById('filter-karat');
    const solid = document.getElementById('filter-solid');
    const weight = document.getElementById('filter-weight');
    const sort = document.getElementById('filter-sort');
    const count = document.getElementById('catalog-count');
    const target = document.getElementById('catalog-table');

    [...state.sellers].sort((a, b) => a.name.localeCompare(b.name)).forEach((record) => {
      const option = el('option', '', record.name);
      option.value = record.id;
      append(seller, option);
    });
    if (fixedKarat) {
      karat.value = fixedKarat;
      karat.disabled = true;
      const hint = el('span', 'field-hint', `Fixed to ${fixedKarat}K for this category`);
      append(karat.parentElement, hint);
    }

    function apply() {
      const query = search.value.trim().toLowerCase();
      let rows = state.candidates.filter((candidate) => {
        if (fixedCategory && candidate.category !== fixedCategory) return false;
        if (fixedKarat && candidate.karat !== Number(fixedKarat)) return false;
        if (seller.value && candidate.sellerId !== seller.value) return false;
        if (karat.value && candidate.karat !== Number(karat.value)) return false;
        if (solid.value === 'stated' && candidate.solidGold !== 'seller-stated') return false;
        if (solid.value === 'missing' && candidate.solidGold !== null) return false;
        if (weight.value === 'listed' && !Number.isFinite(candidate.listedWeightGrams)) return false;
        if (weight.value === 'missing' && Number.isFinite(candidate.listedWeightGrams)) return false;
        if (query) {
          const haystack = `${candidate.name} ${candidate.officialItemNumber} ${candidate.style} ${candidate.category} ${sellerName(candidate)}`.toLowerCase();
          if (!haystack.includes(query)) return false;
        }
        return true;
      });
      rows = [...rows].sort((a, b) => {
        if (sort.value === 'price-asc') return (a.priceUsd ?? Infinity) - (b.priceUsd ?? Infinity) || a.id.localeCompare(b.id);
        if (sort.value === 'price-desc') return (b.priceUsd ?? -Infinity) - (a.priceUsd ?? -Infinity) || a.id.localeCompare(b.id);
        if (sort.value === 'weight-desc') return (b.listedWeightGrams ?? -Infinity) - (a.listedWeightGrams ?? -Infinity) || a.id.localeCompare(b.id);
        return sellerName(a).localeCompare(sellerName(b)) || a.officialItemNumber.localeCompare(b.officialItemNumber);
      });
      count.textContent = `${rows.length} of ${state.candidates.length} candidates shown${fixedCategory ? ` · ${fixedCategory}` : ''}${fixedKarat ? ` · ${fixedKarat}K` : ''}`;
      if (!rows.length) {
        clear(target, el('div', 'empty-state', 'No candidates match these filters. Reset filters; no substitute records have been added.'));
        return;
      }
      clear(target, tableRegion('Scrollable ring evidence table', `${rows.length} official-source rows. Every row has a direct product link and retrieval date.`, ['Product / item', 'Seller', 'Displayed price', 'Metal / construction', 'Listed weight', 'Nominal gold math†', 'Review / official source'], rows.map(candidateRow)));
    }

    [search, seller, karat, solid, weight, sort].forEach((control) => {
      control.addEventListener(control === search ? 'input' : 'change', apply);
    });
    document.getElementById('catalog-filters').addEventListener('submit', (event) => {
      event.preventDefault();
      apply();
    });
    document.getElementById('filter-reset').addEventListener('click', () => {
      search.value = '';
      seller.value = '';
      karat.value = fixedKarat;
      solid.value = '';
      weight.value = '';
      sort.value = 'seller';
      apply();
    });
    apply();
  }

  function openEvidence(candidate) {
    const dialog = document.getElementById('evidence-dialog');
    const title = document.getElementById('dialog-title');
    const content = document.getElementById('dialog-body');
    if (!dialog || !content) return;
    title.textContent = `${candidate.officialItemNumber} · evidence detail`;
    const seller = sellerFor(candidate);
    const intro = el('div', 'stack');
    append(intro,
      el('h3', '', candidate.name),
      el('p', 'muted', `${sellerName(candidate)} · ${candidate.category} · retrieved ${candidate.retrievedDate}`),
      localLink(`flagged.html#candidate-${candidate.id}`, `${candidate.flags.length} review flags`, 'flag-pill'),
      externalLink(candidate.officialProductUrl, 'Open official product page ↗', 'button button-secondary button-small')
    );
    const warning = el('div', 'notice notice-warning');
    append(warning, el('p', 'notice-title', 'Listing evidence only—not physical authentication.'), el('p', 'small', candidate.listedWeightBasis || 'No official gram weight was verified. Net metal weight and actual raw-gold value remain blank.'));
    const definitions = el('dl', 'definition-grid');
    const fields = [
      ['Displayed price', Number.isFinite(candidate.priceUsd) ? formatUsd(candidate.priceUsd) : '— Unverified'],
      ['Price basis', candidate.priceBasis || '— Unverified'],
      ['Metal', `${candidate.karat}K · ${candidate.metalColor}`],
      ['Solid-gold evidence', candidate.solidGold === 'seller-stated' ? 'Seller-stated; not independently verified' : '— Unverified'],
      ['Listed weight', Number.isFinite(candidate.listedWeightGrams) ? formatGrams(candidate.listedWeightGrams, 2) : '— Unverified'],
      ['Net metal weight', Number.isFinite(candidate.netMetalWeightGrams) ? formatGrams(candidate.netMetalWeightGrams, 3) : '— Unverified'],
      ['Purity stamp', candidate.purityStamp || '— Unverified'],
      ['Maker’s mark', candidate.makersMark || '— Unverified'],
      ['Independent test', candidate.independentVerification || '— Unverified'],
      ['Listing documents', candidate.listingDocumentation?.length ? candidate.listingDocumentation.join('; ') : '— Product-specific inclusion unverified']
    ];
    fields.forEach(([term, value]) => append(definitions, el('dt', '', term), el('dd', '', value)));
    const evidence = el('section');
    append(evidence, el('h3', '', 'Official product excerpts'));
    candidate.evidence.forEach((record) => {
      append(evidence, el('p', 'small muted', `Supports: ${record.fields.join(', ')}`), quoteBlock(record.quote, record.sourceUrl, 'Review this product page'));
    });
    clear(content, intro, warning, definitions, evidence);
    if (seller) {
      const policies = el('section', 'stack');
      append(policies, el('h3', '', `${seller.name} policy context`), el('p', 'small', `${seller.returns.window}; clock: ${seller.returns.clockStarts}. ${seller.returns.fees}`), sourceLink(seller.returns.sourceUrl, 'Official return policy ↗'), el('p', 'small', seller.documentation.summary));
      if (seller.documentation.sourceUrl) append(policies, sourceLink(seller.documentation.sourceUrl, 'Documentation source ↗'));
      append(content, policies);
    }
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
  }

  function renderFlagged() {
    const target = document.getElementById('flagged-app');
    if (!target) return;
    const flaggedRows = state.candidates.filter(flagged);
    const summary = el('div', 'stat-grid');
    append(summary,
      stat(flaggedRows.length, 'Active candidates flagged', true),
      stat(state.irregularities.length, 'Issue groups / source irregularities'),
      stat(state.irregularities.filter((issue) => issue.status === 'excluded').length, 'Excluded source variants retained for review'),
      stat(state.candidates.length - flaggedRows.length, 'Purchase-ready candidates', true)
    );
    const issueSection = el('section', 'stack');
    append(issueSection, el('h2', '', 'Issue groups'));
    const list = el('div', 'issue-list');
    state.irregularities.forEach((issue) => {
      const card = el('article', `issue-card${issue.status === 'excluded' ? ' excluded' : ''}`);
      card.id = `issue-${issue.id}`;
      const meta = el('div', 'issue-meta');
      append(meta, flagPill(issue.severity.replaceAll('-', ' ')), tag(issue.status));
      append(card, meta, el('h3', '', issue.title), el('p', '', issue.finding));
      const action = el('div', 'issue-action');
      append(action, el('strong', '', 'Required action: '), el('span', '', issue.action));
      append(card, action);
      if (issue.sourceBasis) append(card, el('p', 'small muted', issue.sourceBasis));
      if (issue.quote && issue.sourceUrl) append(card, quoteBlock(issue.quote, issue.sourceUrl, 'Open issue source'));
      else if (issue.sourceUrl) append(card, sourceLink(issue.sourceUrl, 'Open issue source ↗'));
      if (issue.affectedCandidateIds?.length) {
        const affected = el('div', 'affected-links');
        append(affected, el('strong', 'small', 'Affected candidates:'));
        issue.affectedCandidateIds.forEach((id) => {
          const candidate = state.candidates.find((row) => row.id === id);
          if (candidate) append(affected, localLink(`flagged.html#candidate-${id}`, candidate.officialItemNumber, 'small'));
        });
        append(card, affected);
      }
      append(list, card);
    });
    append(issueSection, list);

    const matrixSection = el('section', 'stack');
    append(matrixSection, el('h2', '', 'Candidate verification matrix'), el('p', 'muted', 'Blank fields remain blank. Seller-stated solid gold is not independent proof.'));
    const matrixWrap = el('div', 'table-wrap');
    matrixWrap.tabIndex = 0;
    matrixWrap.setAttribute('role', 'region');
    matrixWrap.setAttribute('aria-label', 'Candidate verification matrix');
    const table = el('table');
    append(table, el('caption', '', 'All active candidates and their unresolved verification states.'));
    const thead = el('thead');
    const hr = el('tr');
    ['Candidate', 'Review', 'Solid wording', 'Listed weight', 'Net metal', 'Physical marks', 'Independent test', 'Official source'].forEach((heading) => {
      const th = el('th', '', heading); th.scope = 'col'; append(hr, th);
    });
    append(thead, hr);
    const tbody = el('tbody');
    state.candidates.forEach((candidate) => {
      const tr = el('tr', 'review-target');
      tr.id = `candidate-${candidate.id}`;
      const name = el('td', 'product-cell');
      append(name, detailButton(candidate), el('span', 'product-meta', `${candidate.officialItemNumber} · ${sellerName(candidate)}`));
      const review = el('td'); append(review, flagPill(`${candidate.flags.length} flags`));
      const solid = el('td'); append(solid, candidate.solidGold === 'seller-stated' ? tag('Seller-stated', 'gold') : unverified());
      const weight = el('td'); append(weight, Number.isFinite(candidate.listedWeightGrams) ? formatGrams(candidate.listedWeightGrams, 2) : unverified());
      const net = el('td'); append(net, Number.isFinite(candidate.netMetalWeightGrams) ? formatGrams(candidate.netMetalWeightGrams) : unverified());
      const marks = el('td'); append(marks, candidate.purityStamp && candidate.makersMark ? 'Review recorded evidence' : unverified());
      const independent = el('td'); append(independent, candidate.independentVerification || unverified());
      const source = el('td'); append(source, sourceLink(candidate.officialProductUrl), el('span', 'product-meta', candidate.retrievedDate));
      append(tr, name, review, solid, weight, net, marks, independent, source);
      append(tbody, tr);
    });
    append(table, thead, tbody);
    append(matrixWrap, table);
    append(matrixSection, matrixWrap);
    clear(target, summary, issueSection, matrixSection);
  }

  function renderSellers() {
    const target = document.getElementById('sellers-app');
    if (!target) return;
    const intro = el('div', 'notice notice-info');
    append(intro, el('p', 'notice-title', 'Reputation is a review input, not a score that clears a ring.'), el('p', '', state.reputationMethodology?.quote || 'BBB ratings are not guarantees. Complaint counts are not normalized by transaction volume.'), externalLink(state.reputationMethodology?.sourceUrl || 'https://www.bbb.org/about/overview-of-ratings', 'BBB rating methodology ↗', 'small'));

    const comparisonRows = state.sellers.map((seller) => [
      el('strong', '', seller.name),
      el('span', '', `${seller.returns.window} · ${seller.returns.clockStarts}`),
      el('span', '', seller.payment.creditCardsListed.join(', ')),
      seller.reputation.bbbRating ? tag(seller.reputation.bbbRating, 'gold') : unverified('BBB grade unverified'),
      el('span', '', `${seller.reputation.complaintsLast3Years} / ${seller.reputation.complaintsLast12Months}`),
      externalLink(seller.reputation.profileUrl, 'BBB profile ↗', 'small')
    ]);
    const comparison = tableRegion('Seller comparison', 'BBB complaint columns: last 3 years / last 12 months. Raw counts are not normalized by sales volume.', ['Seller', 'Return window / trigger', 'Credit cards listed', 'BBB grade', 'BBB complaints 3y / 1y', 'Independent source'], comparisonRows);

    const cards = el('div', 'seller-grid');
    state.sellers.forEach((seller) => {
      const card = el('article', 'seller-card');
      card.id = `seller-${seller.id}`;
      const head = el('div', 'seller-head');
      const heading = el('div');
      append(heading, el('h2', '', seller.name), externalLink(seller.officialUrl, 'Official seller site ↗', 'small'));
      const reputationTags = el('div', 'cluster');
      append(reputationTags, seller.reputation.bbbRating ? tag(`BBB ${seller.reputation.bbbRating}`, 'gold') : unverified('BBB grade unverified'), tag(seller.reputation.bbbAccredited ? 'BBB accredited' : 'Not BBB accredited'));
      append(head, heading, reputationTags);

      const columns = el('div', 'seller-columns');
      const contact = el('section', 'seller-block');
      append(contact, el('h3', '', 'Contact & payment'));
      const contactList = el('ul');
      Object.entries(seller.contact).filter(([key]) => !['sourceUrl', 'quote'].includes(key)).forEach(([key, value]) => {
        if (value) append(contactList, el('li', '', `${key.replace(/([A-Z])/g, ' $1')}: ${value}`));
      });
      append(contact, contactList, el('p', '', `Credit cards listed: ${seller.payment.creditCardsListed.join(', ')}.`), el('p', 'small muted', seller.payment.policyNote), sourceLink(seller.contact.sourceUrl, 'Official contact source ↗'), document.createTextNode(' '), sourceLink(seller.payment.sourceUrl, 'Official payment source ↗'));
      if (seller.payment.policySourceUrl) {
        const disputeDetails = el('details');
        append(disputeDetails, el('summary', '', 'Seller payment-dispute wording'), el('p', 'small', seller.payment.policyNote), quoteBlock(seller.payment.policyQuote, seller.payment.policySourceUrl, 'Official policy'));
        append(contact, disputeDetails);
      }

      const returns = el('section', 'seller-block');
      append(returns, el('h3', '', 'Returns & exclusions'), el('p', '', `${seller.returns.window} from: ${seller.returns.clockStarts}.`), el('p', 'small', `Conditions: ${seller.returns.conditions}`), el('p', 'small', `Fees: ${seller.returns.fees}`), el('p', 'small', `Exclusions: ${seller.returns.exclusions}`));
      const returnDetails = el('details');
      append(returnDetails, el('summary', '', 'Official return-policy excerpts'));
      seller.returns.quotes.forEach((quote) => append(returnDetails, quoteBlock(quote, seller.returns.sourceUrl, 'Official return policy')));
      append(returns, returnDetails);

      const documents = el('section', 'seller-block');
      append(documents, el('h3', '', 'Documentation & guarantees'), el('p', 'small', seller.documentation.summary));
      if (seller.documentation.sourceUrl) append(documents, quoteBlock(seller.documentation.quote, seller.documentation.sourceUrl, 'Official documentation source'));
      else (seller.documentation.sourceUrls || []).forEach((url) => append(documents, sourceLink(url, 'Review product documentation scope ↗')));
      if (seller.karatGuarantee) {
        append(documents, el('h3', '', 'Seller karat guarantee'), el('p', 'small', seller.karatGuarantee.summary));
        const guarantee = el('details');
        append(guarantee, el('summary', '', 'Guarantee wording and conditions'), quoteBlock(seller.karatGuarantee.quote, seller.karatGuarantee.sourceUrl, 'Official guarantee'), quoteBlock(seller.karatGuarantee.conditionsQuote, seller.karatGuarantee.sourceUrl, 'Guarantee conditions'));
        append(documents, guarantee);
      }

      const reputation = el('section', 'seller-block');
      append(reputation, el('h3', '', 'Independent reputation snapshot'), el('p', '', `BBB complaints: ${seller.reputation.complaintsLast3Years} in 3 years; ${seller.reputation.complaintsLast12Months} in 12 months.`), el('p', 'small', `Answered: ${seller.reputation.answered}; resolved: ${seller.reputation.resolved}. Accreditation: ${seller.reputation.bbbAccredited ? 'yes' : 'no'}.`), el('p', 'small muted', seller.reputation.assessment), quoteBlock(seller.reputation.profileQuote, seller.reputation.profileUrl, 'Direct BBB profile'), quoteBlock(seller.reputation.complaintsQuote, seller.reputation.complaintsUrl, 'Direct BBB complaints'));

      append(columns, contact, returns, documents, reputation);
      append(card, head, columns);
      append(cards, card);
    });
    clear(target, intro, comparison, cards);
  }

  function renderChecklist() {
    const target = document.getElementById('checklist-app');
    if (!target) return;
    const decision = el('div', 'notice notice-danger');
    append(decision, el('p', 'notice-title', 'No candidate currently clears this gate.'), el('p', '', state.verification.decisionRule));
    const list = el('ol', 'checklist');
    state.verification.gates.forEach((gate) => {
      const item = el('li', 'check-item');
      append(item, el('h2', '', gate.title), el('p', '', gate.passWhen));
      if (gate.sourceId) {
        const source = state.verification.sources[gate.sourceId];
        const quote = source.quotes?.[gate.sourceQuoteKey] || source[gate.sourceQuoteKey];
        const details = el('details');
        append(details, el('summary', '', `${source.publisher} source and scope`), quoteBlock(quote, source.url, `${source.publisher} source`));
        if (source.interpretationLimit) append(details, el('p', 'small muted', source.interpretationLimit));
        if (source.qualityCaveat) append(details, el('p', 'small muted', source.qualityCaveat));
        append(item, details);
      } else append(item, el('p', 'source-ref muted', gate.basis));
      append(list, item);
    });
    const post = el('section', 'card');
    append(post, el('h2', '', 'Immediately after delivery'));
    const ordered = el('ol');
    state.verification.postDeliveryChecklist.forEach((step) => append(ordered, el('li', '', step)));
    append(post, ordered, el('p', 'small muted', 'Do not resize, engrave, alter, or wear the item before the return/verification implications are clear.'), externalLink(state.verification.sources.cfpbDispute.url, 'CFPB dispute guidance ↗', 'small'));
    clear(target, decision, list, post);
  }

  function renderCalculator() {
    const form = document.getElementById('gold-calculator');
    if (!form) return;
    const candidateSelect = document.getElementById('calc-candidate');
    const weight = document.getElementById('calc-weight');
    const basis = document.getElementById('calc-basis');
    const karat = document.getElementById('calc-karat');
    const spot = document.getElementById('calc-spot');
    const price = document.getElementById('calc-price');
    const output = document.getElementById('calc-output');
    const error = document.getElementById('calc-error');
    const defaultSpot = state.market.source.bidPerTroyOunce;

    [...state.sellers].sort((a, b) => a.name.localeCompare(b.name)).forEach((seller) => {
      const group = el('optgroup');
      group.label = seller.name;
      state.candidates.filter((candidate) => candidate.sellerId === seller.id).forEach((candidate) => {
        const option = el('option', '', `${candidate.officialItemNumber} · ${candidate.name}`);
        option.value = candidate.id;
        append(group, option);
      });
      append(candidateSelect, group);
    });
    spot.value = String(defaultSpot);

    function invalid(message) {
      error.textContent = message;
      clear(output, el('h2', '', 'Reference output'), el('p', 'muted', 'No result shown. Correct the input; missing or invalid values are never replaced with estimates.'), el('p', '', 'Actual raw-gold status: — Unverified'));
    }

    function calculate() {
      error.textContent = '';
      if (!weight.value.trim()) {
        invalid(weight === document.activeElement ? '' : 'Enter a documented weight. It is blank because no value may be inferred.');
        return;
      }
      const weightValue = Number(weight.value);
      const spotValue = Number(spot.value);
      const karatValue = Number(karat.value);
      if (!Number.isFinite(weightValue) || weightValue <= 0 || weightValue > 100000) return invalid('Enter a weight greater than 0 and no more than 100,000 grams.');
      if (!Number.isFinite(spotValue) || spotValue <= 0 || spotValue > 10000000) return invalid('Enter a valid positive 24K bid in USD per troy ounce.');
      if (!Number.isFinite(karatValue) || karatValue <= 0 || karatValue > 24) return invalid('Select a valid karat.');
      let retail = null;
      if (price.value.trim()) {
        retail = Number(price.value);
        if (!Number.isFinite(retail) || retail < 0 || retail > 100000000) return invalid('Enter a valid optional retail price or leave it blank.');
      }
      const perGram = spotValue / state.market.conversion.gramsPerTroyOunce;
      const fineGrams = weightValue * karatValue / 24;
      const reference = fineGrams * perGram;
      const basisWarning = basis.value === 'listed'
        ? 'Nominal listed/item-weight arithmetic only. This is not actual raw-gold content or a melt/resale value.'
        : 'Calculated from your user-stated metal-only weight. The dashboard has not verified that measurement or the item.';
      const primary = el('div', 'output-primary');
      append(primary, el('span', '', 'Calculated metal reference (not a valuation)'), el('strong', '', formatUsd(reference)));
      const rows = el('div');
      append(rows,
        outputRow('24K reference / gram', `${formatUsd(perGram)} / g`),
        outputRow(`${karatValue}K nominal fine-gold mass`, formatGrams(fineGrams)),
        outputRow('Actual verified raw-gold amount', '— Unverified')
      );
      if (retail !== null) {
        append(rows, outputRow('Entered retail price', formatUsd(retail)), outputRow('Price minus calculated reference', formatUsd(retail - reference)));
      }
      const formulaText = `${weightValue} g × ${karatValue}/24 = ${fineGrams} g; ${fineGrams} g × (${spotValue} ÷ ${state.market.conversion.gramsPerTroyOunce}) = ${reference}`;
      clear(output, el('h2', '', 'Reference output'), el('p', 'muted', basisWarning), primary, rows, el('p', 'small muted', `Arithmetic: ${formulaText}`), retail !== null ? el('p', 'small muted', 'Price minus reference is arithmetic only—not a premium, fairness score, or resale estimate.') : null);
    }

    function outputRow(label, value) {
      const row = el('div', 'output-row');
      append(row, el('span', '', label), el('strong', '', value));
      return row;
    }

    candidateSelect.addEventListener('change', () => {
      const candidate = state.candidates.find((row) => row.id === candidateSelect.value);
      if (!candidate) return;
      weight.value = Number.isFinite(candidate.listedWeightGrams) ? String(candidate.listedWeightGrams) : '';
      karat.value = String(candidate.karat);
      price.value = Number.isFinite(candidate.priceUsd) ? String(candidate.priceUsd) : '';
      basis.value = 'listed';
      spot.value = String(defaultSpot);
      calculate();
      if (!Number.isFinite(candidate.listedWeightGrams)) error.textContent = 'Official listed weight is unverified, so the weight input was intentionally left blank.';
    });
    [weight, basis, karat, spot, price].forEach((control) => control.addEventListener(control === basis || control === karat ? 'change' : 'input', calculate));
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      calculate();
    });
    document.getElementById('calc-reset').addEventListener('click', () => {
      candidateSelect.value = '';
      weight.value = '';
      basis.value = 'listed';
      karat.value = '14';
      spot.value = String(defaultSpot);
      price.value = '';
      calculate();
    });
    calculate();
    error.textContent = '';

    const evidence = document.getElementById('calculator-evidence');
    const evidenceRows = state.candidates.map((candidate) => {
      const load = el('button', 'button button-secondary button-small', 'Load');
      load.type = 'button';
      load.addEventListener('click', () => {
        candidateSelect.value = candidate.id;
        candidateSelect.dispatchEvent(new Event('change'));
        candidateSelect.focus();
      });
      return [
        el('span', '', `${candidate.officialItemNumber} · ${sellerName(candidate)}`),
        Number.isFinite(candidate.listedWeightGrams) ? formatGrams(candidate.listedWeightGrams, 2) : unverified(),
        unverified('Net metal unverified'),
        load,
        sourceLink(candidate.officialProductUrl)
      ];
    });
    clear(evidence, el('h2', '', 'Candidate weight states'), el('p', 'small muted', 'Loading a candidate never fills an unknown weight. Net metal remains blank on every row.'), tableRegion('Candidate weight states for calculator', 'All candidate weight states and official product sources.', ['Candidate', 'Listed weight', 'Net metal', 'Preset', 'Official source'], evidenceRows));
  }

  function renderAnalysis() {
    const target = document.getElementById('analysis-app');
    if (!target) return;
    const weighted = state.candidates.filter((candidate) => nominal(candidate));
    const missing = state.candidates.length - weighted.length;
    const settingRows = state.candidates.filter((candidate) => /^Setting/.test(candidate.priceBasis || ''));
    const itemRows = state.candidates.filter((candidate) => !/^Setting/.test(candidate.priceBasis || ''));
    const range = (rows) => {
      const prices = rows.map((row) => row.priceUsd).filter(Number.isFinite);
      return prices.length ? `${formatUsd(Math.min(...prices))}–${formatUsd(Math.max(...prices))}` : '— Unverified';
    };
    const stats = el('div', 'stat-grid');
    append(stats, stat(weighted.length, 'Rows with nominal listed-weight math'), stat(missing, 'Rows with no gold calculation', true), stat(range(itemRows), 'Displayed item-price range · not settings-only'), stat(range(settingRows), 'Setting-price range · stones selected separately'));

    const table = tableRegion('Nominal listed-weight analysis', 'Only rows with official listed weights are calculated. Actual net/raw-gold values remain unverified.', ['Product', 'Displayed price', 'Listed weight', 'Karat', 'Nominal fine gold†', 'Nominal reference†', 'Actual raw gold', 'Official source'], weighted.map((candidate) => {
      const calc = nominal(candidate);
      return [
        el('span', '', `${candidate.officialItemNumber} · ${sellerName(candidate)}`),
        el('span', '', `${formatUsd(candidate.priceUsd)} · ${candidate.priceBasis}`),
        formatGrams(candidate.listedWeightGrams, 2),
        `${candidate.karat}K`,
        formatGrams(calc.fineGrams),
        formatUsd(calc.value),
        unverified(),
        sourceLink(candidate.officialProductUrl)
      ];
    }));

    const conclusions = el('div', 'analysis-grid');
    const can = el('section', 'card');
    append(can, el('h2', '', 'Supported conclusions'), el('ul', '',));
    const canList = can.querySelector('ul');
    [
      `${weighted.length} listings publish a weight that supports clearly labeled nominal arithmetic; ${missing} do not.`,
      `The named Kitco snapshot implies ${formatUsd(weighted[0] ? nominal(weighted[0]).perGram : NaN)}/g for 24K before karat scaling.`,
      'Displayed prices have different bases: some include listed stones, while setting-only prices require a separate center-stone selection.',
      'Every calculated result is a dated reference, not a current offer or a guaranteed future price.'
    ].forEach((text) => append(canList, el('li', '', text)));
    const cannot = el('section', 'card');
    append(cannot, el('h2', '', 'Unsupported conclusions'));
    const cannotList = el('ul');
    [
      'Actual fine-gold mass or raw-gold value: net metal weight is unverified on every row.',
      'A “best value” winner or fair retail premium: stones, design, labor, configuration, and weight error are not measured.',
      'A direct complete-ring versus setting-only price ranking.',
      'Physical authenticity from a listing, stamp, seller appraisal, BBB grade, or calculator output.'
    ].forEach((text) => append(cannotList, el('li', '', text)));
    append(cannot, cannotList);
    append(conclusions, can, cannot);

    const market = el('div', 'notice notice-warning');
    append(market, el('p', 'notice-title', 'Interpretation boundary'), el('p', '', `Nominal reference = listed weight × karat ÷ 24 × (${formatUsd(state.market.source.bidPerTroyOunce)} ÷ ${state.market.conversion.gramsPerTroyOunce}). ${state.market.source.snapshotWarning}`), externalLink(state.market.source.url, 'Kitco snapshot source ↗', 'small'), document.createTextNode(' '), localLink('calculator.html', 'Test the calculator →'));
    clear(target, stats, market, conclusions, table);
  }

  function renderMethodology() {
    const target = document.getElementById('methodology-sources');
    if (!target) return;
    const groups = el('div', 'stack-lg');
    state.sellers.forEach((seller) => {
      const section = el('section', 'card');
      append(section, el('h3', '', `${seller.name} · official product rows`));
      const list = el('ul', 'source-list');
      state.candidates.filter((candidate) => candidate.sellerId === seller.id).forEach((candidate) => {
        const item = el('li');
        append(item, externalLink(candidate.officialProductUrl, `${candidate.officialItemNumber} — ${candidate.name} ↗`), el('span', 'product-meta', `Official product page · retrieved ${candidate.retrievedDate}`));
        append(list, item);
      });
      append(section, list);
      const policies = el('div', 'cluster');
      append(policies, sourceLink(seller.contact.sourceUrl, 'Contact ↗'), sourceLink(seller.payment.sourceUrl, 'Payment ↗'), sourceLink(seller.returns.sourceUrl, 'Returns ↗'), externalLink(seller.reputation.profileUrl, 'BBB profile ↗', 'small'), externalLink(seller.reputation.complaintsUrl, 'BBB complaints ↗', 'small'));
      append(section, el('h3', '', 'Policy and independent sources'), policies);
      append(groups, section);
    });
    const trust = el('section', 'card');
    append(trust, el('h3', '', 'Trust, testing, payment, and market sources'));
    const trustList = el('ul', 'source-list');
    Object.values(state.verification.sources).forEach((source) => {
      const item = el('li');
      append(item, externalLink(source.url, `${source.publisher} ↗`), el('span', 'product-meta', source.url));
      append(trustList, item);
    });
    [
      { name: 'Kitco · named gold snapshot', url: state.market.source.url },
      { name: 'LBMA · auction methodology only', url: state.market.benchmarkMethodology.url },
      { name: 'BBB · rating methodology', url: state.reputationMethodology?.sourceUrl || 'https://www.bbb.org/about/overview-of-ratings' }
    ].forEach((source) => {
      const item = el('li');
      append(item, externalLink(source.url, `${source.name} ↗`), el('span', 'product-meta', source.url));
      append(trustList, item);
    });
    append(trust, trustList);
    append(groups, trust);
    clear(target, groups);
  }

  function attachGlobalControls() {
    document.querySelectorAll('[data-dialog-close]').forEach((button) => {
      button.addEventListener('click', () => {
        const dialog = document.getElementById('evidence-dialog');
        if (dialog?.open && typeof dialog.close === 'function') dialog.close();
        else dialog?.removeAttribute('open');
      });
    });
    const dialog = document.getElementById('evidence-dialog');
    if (dialog) dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });
    document.querySelectorAll('[data-print]').forEach((button) => button.addEventListener('click', () => window.print()));
  }

  async function init() {
    attachGlobalControls();
    try {
      const [candidateData, sellerData, issueData, market, verification] = await Promise.all([
        fetchJson('candidates.json'),
        fetchJson('sellers.json'),
        fetchJson('irregularities.json'),
        fetchJson('market.json'),
        fetchJson('verification.json')
      ]);
      state.candidates = candidateData.candidates;
      state.sellers = sellerData.sellers;
      state.irregularities = issueData.irregularities;
      state.market = market;
      state.verification = verification;
      state.reputationMethodology = sellerData.reputationMethodology;
      validateData();
      state.sellerMap = new Map(state.sellers.map((seller) => [seller.id, seller]));
      renderCommon();
      if (page === 'home') renderHome();
      if (page === 'catalog') renderCatalog();
      if (page === 'flagged') renderFlagged();
      if (page === 'sellers') renderSellers();
      if (page === 'checklist') renderChecklist();
      if (page === 'calculator') renderCalculator();
      if (page === 'analysis') renderAnalysis();
      if (document.getElementById('methodology-sources')) renderMethodology();
    } catch (error) {
      fatal(error);
    }
  }

  init();
})();
