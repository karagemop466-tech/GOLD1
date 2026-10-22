/* GOLD1 — progressive enhancement only. Core content is server-rendered HTML. */
(function () {
  'use strict';

  /* ---------------------------------------------------------- table filters */
  document.querySelectorAll('[data-filters]').forEach(function (bar) {
    var table = bar.parentElement.querySelector('[data-ring-table]');
    if (!table) return;
    var tbody = table.tBodies[0];
    var rows = Array.prototype.slice.call(tbody.rows);
    var counter = bar.parentElement.querySelector('[data-result-count]');
    var inputs = {
      q: bar.querySelector('[data-filter="q"]'),
      category: bar.querySelector('[data-filter="category"]'),
      retailer: bar.querySelector('[data-filter="retailer"]'),
      karat: bar.querySelector('[data-filter="karat"]'),
      max: bar.querySelector('[data-filter="max"]'),
    };

    function apply() {
      var q = (inputs.q && inputs.q.value || '').trim().toLowerCase();
      var cat = inputs.category && inputs.category.value;
      var ret = inputs.retailer && inputs.retailer.value;
      var kar = inputs.karat && inputs.karat.value;
      var max = inputs.max && inputs.max.value ? parseFloat(inputs.max.value) : null;
      var shown = 0;
      rows.forEach(function (tr) {
        var ok = true;
        if (q && (tr.dataset.title || '').indexOf(q) === -1) ok = false;
        if (cat && tr.dataset.category !== cat) ok = false;
        if (ret && tr.dataset.retailer !== ret) ok = false;
        if (kar && tr.dataset.karat !== kar) ok = false;
        if (max !== null && !isNaN(max) && parseFloat(tr.dataset.price) > max) ok = false;
        tr.hidden = !ok;
        if (ok) shown++;
      });
      if (counter) counter.textContent = shown + (shown === 1 ? ' ring' : ' rings') + (shown === rows.length ? '' : ' of ' + rows.length);
      if (inputs.category && cat) {
        var url = new URL(window.location.href);
        url.searchParams.set('category', cat);
        history.replaceState(null, '', url);
      }
    }

    Object.keys(inputs).forEach(function (k) {
      var el = inputs[k];
      if (!el) return;
      el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'input', apply);
    });

    var reset = bar.querySelector('[data-filter-reset]');
    if (reset) {
      reset.addEventListener('click', function () {
        Object.keys(inputs).forEach(function (k) { if (inputs[k]) inputs[k].value = ''; });
        apply();
      });
    }

    var params = new URLSearchParams(window.location.search);
    var preset = params.get('category');
    if (preset && inputs.category) {
      inputs.category.value = preset;
      apply();
    }
  });

  /* ------------------------------------------------------------ sort tables */
  document.querySelectorAll('[data-ring-table]').forEach(function (table) {
    var headers = table.tHead ? Array.prototype.slice.call(table.tHead.rows[0].cells) : [];
    headers.forEach(function (th, idx) {
      th.style.cursor = 'pointer';
      th.title = 'Sort by this column';
      var dir = 1;
      th.addEventListener('click', function () {
        var tbody = table.tBodies[0];
        var rows = Array.prototype.slice.call(tbody.rows);
        var numeric = th.classList.contains('num-col');
        rows.sort(function (a, b) {
          var av = a.cells[idx] ? a.cells[idx].textContent.trim() : '';
          var bv = b.cells[idx] ? b.cells[idx].textContent.trim() : '';
          if (numeric) {
            var an = parseFloat(av.replace(/[^0-9.]/g, ''));
            var bn = parseFloat(bv.replace(/[^0-9.]/g, ''));
            if (isNaN(an)) an = Number.MAX_SAFE_INTEGER;
            if (isNaN(bn)) bn = Number.MAX_SAFE_INTEGER;
            return (an - bn) * dir;
          }
          return av.localeCompare(bv) * dir;
        });
        dir *= -1;
        rows.forEach(function (r) { tbody.appendChild(r); });
      });
    });
  });

  /* ------------------------------------------------------------ calculator */
  var form = document.getElementById('calc-form');
  if (!form) return;

  var el = {
    weight: document.getElementById('c-weight'),
    karat: document.getElementById('c-karat'),
    spot: document.getElementById('c-spot'),
    price: document.getElementById('c-price'),
    pure: document.getElementById('o-pure'),
    value: document.getElementById('o-value'),
    pergram: document.getElementById('o-pergram'),
    multiple: document.getElementById('o-multiple'),
    verdict: document.getElementById('o-verdict'),
  };

  var USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
  var OZT = 31.1034768;

  function calc() {
    var g = parseFloat(el.weight.value);
    var k = parseFloat(el.karat.value);
    var spot = parseFloat(el.spot.value);
    var ask = parseFloat(el.price.value);

    if (!isFinite(g) || !isFinite(k) || !isFinite(spot) || g <= 0 || spot <= 0) {
      el.pure.textContent = el.value.textContent = el.pergram.textContent = el.multiple.textContent = '—';
      el.verdict.className = 'verdict';
      el.verdict.textContent = 'Enter a weight, a karat and a gold price to see the metal value.';
      return;
    }

    var pure = g * (k / 24);
    var value = pure * (spot / OZT);
    el.pure.textContent = pure.toFixed(3) + ' g';
    el.value.textContent = USD.format(value);
    el.pergram.textContent = USD.format(value / g);

    if (isFinite(ask) && ask > 0) {
      var mult = ask / value;
      el.multiple.textContent = mult.toFixed(2) + '×';
      if (mult < 1) {
        el.verdict.className = 'verdict bad';
        el.verdict.textContent = 'Below the gold value. That is a red flag, not a bargain — check the karat, the weight and whether the piece is plated.';
      } else if (mult < 1.5) {
        el.verdict.className = 'verdict warn';
        el.verdict.textContent = 'Very close to metal value. Unusual for new retail jewellery; confirm the karat and weight independently.';
      } else if (mult <= 6) {
        el.verdict.className = 'verdict good';
        el.verdict.textContent = 'A normal retail multiple over metal value (labour, setting, stones and margin are not included in the gold value).';
      } else {
        el.verdict.className = 'verdict warn';
        el.verdict.textContent = 'A high multiple. That can be fair for design or stones, but compare against similar rings before paying.';
      }
    } else {
      el.multiple.textContent = '—';
      el.verdict.className = 'verdict';
      el.verdict.textContent = 'Metal value only. Add the asking price to see the multiple.';
    }
  }

  form.addEventListener('input', calc);
  form.addEventListener('submit', function (e) { e.preventDefault(); calc(); });

  var params = new URLSearchParams(window.location.search);
  var preset = params.get('karat');
  if (preset) {
    var digits = String(preset).replace(/[^0-9]/g, '');
    if (digits) el.karat.value = digits;
  }
  calc();
})();
