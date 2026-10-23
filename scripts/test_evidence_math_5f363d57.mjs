#!/usr/bin/env node
import assert from 'node:assert/strict';
import {
  NIST_GRAMS_PER_TROY_OUNCE,
  deriveGoldMetrics,
  karatFraction,
  verificationBadge,
} from './lib/evidence-math.mjs';

const options = {
  spotUsdPerOzt: 3999.899902,
  gramsPerTroyOunce: NIST_GRAMS_PER_TROY_OUNCE,
};
const base = {
  id: 'test-row',
  karat: '14K',
  price_low: 500,
  price_high: 500,
  price_unverified: false,
  withdrawn: false,
  weight_g_low: 2,
  weight_g_high: 2,
  flags: [],
  verification_status: 'confirmed',
};

assert.equal(karatFraction('14K'), 14 / 24);
assert.equal(karatFraction('24k'), 1);
assert.equal(karatFraction('gold'), null);
assert.equal(karatFraction('25K'), null);

const fixed = deriveGoldMetrics(base, options);
assert.equal(fixed.fine_gold_g, 1.167);
assert.equal(fixed.gold_value_usd, 150.03);
assert.equal(fixed.price_to_gold, 3.33);
assert.equal(fixed.calculation_status, 'computed');

const rangedPrice = deriveGoldMetrics({ ...base, price_low: 400, price_high: 600 }, options);
assert.equal(rangedPrice.fine_gold_g, 1.167);
assert.equal(rangedPrice.gold_value_usd, 150.03);
assert.equal(rangedPrice.price_to_gold, null);
assert.equal(rangedPrice.calculation_status, 'unpaired_price_range');

const invalidPrice = deriveGoldMetrics({ ...base, price_high: -1 }, options);
assert.equal(invalidPrice.price_to_gold, null);
assert.equal(invalidPrice.calculation_status, 'invalid_price');

const rangedWeight = deriveGoldMetrics({ ...base, weight_g_low: 2.6, weight_g_high: 4 }, options);
assert.equal(rangedWeight.fine_gold_g, null);
assert.equal(rangedWeight.gold_value_usd, null);
assert.equal(rangedWeight.price_to_gold, null);
assert.equal(rangedWeight.fine_gold_g_low, 1.517);
assert.equal(rangedWeight.fine_gold_g_high, 2.333);
assert.equal(rangedWeight.gold_value_usd_low, 195.04);
assert.equal(rangedWeight.gold_value_usd_high, 300.07);

for (const row of [
  { ...base, flags: ['weight_basis_unverified'] },
  { ...base, id: 'ambiguous-from-flag-registry' },
]) {
  const result = deriveGoldMetrics(row, {
    ...options,
    ambiguousWeightIds: row.id === base.id ? [] : [row.id],
  });
  assert.equal(result.calculation_status, 'ambiguous_weight');
  assert.equal(result.fine_gold_g, null);
  assert.equal(result.gold_value_usd, null);
  assert.equal(result.price_to_gold, null);
}

for (const row of [
  { ...base, withdrawn: true, verification_status: 'withdrawn_source_mismatch' },
  { ...base, price_unverified: true },
]) {
  const result = deriveGoldMetrics(row, options);
  assert.equal(result.fine_gold_g, null);
  assert.equal(result.gold_value_usd, null);
  assert.equal(result.price_to_gold, null);
}

const missing = deriveGoldMetrics({ ...base, weight_g_low: null, weight_g_high: null }, options);
assert.equal(missing.calculation_status, 'missing_weight');
assert.equal(missing.gold_value_usd, null);

const belowMelt = deriveGoldMetrics({ ...base, price_low: 100, price_high: 100 }, options);
assert.equal(belowMelt.price_to_gold, 0.67);
assert.equal(belowMelt.price_review, 'below_melt_review_required');

assert.throws(
  () => deriveGoldMetrics(base, { spotUsdPerOzt: 3999.899902, gramsPerTroyOunce: null }),
  /NIST gram conversion/,
);
assert.throws(
  () => deriveGoldMetrics(base, { spotUsdPerOzt: null }),
  /dated USD\/troy-ounce/,
);

assert.equal(verificationBadge(base).key, 'confirmed');
assert.equal(verificationBadge({ ...base, verification_status: 'partly_verified' }).label, 'Partly verified');
assert.equal(verificationBadge({ ...base, withdrawn: true }).key, 'withdrawn');
assert.equal(verificationBadge({ ...base, verification_status: 'not_reread_2026-10-23' }).key, 'unverified');

console.log('evidence-math: 38 assertions passed; no inferred prices, weights, karats, or unit conversions');
