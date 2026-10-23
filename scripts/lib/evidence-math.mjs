/**
 * Shared evidence-bound gold arithmetic and verification labels.
 *
 * This module never retrieves or infers a product fact. Callers must supply the
 * canonical row, a dated market reading, and any row IDs whose seller weight
 * basis is ambiguous. Missing/ambiguous inputs produce nulls, not guesses.
 */

export const NIST_GRAMS_PER_TROY_OUNCE = 31.1034768;

const finitePositive = (value) => Number.isFinite(Number(value)) && Number(value) > 0
  ? Number(value)
  : null;
const round = (value, places) => Number(value.toFixed(places));

export function karatFraction(karat) {
  const match = String(karat || '').match(/^(\d{1,2})(?:\.0+)?K$/i);
  if (!match) return null;
  const value = Number(match[1]);
  return value > 0 && value <= 24 ? value / 24 : null;
}

export function verificationBadge(row) {
  if (row?.withdrawn || row?.verification_status === 'withdrawn_source_mismatch') {
    return { key: 'withdrawn', tone: 'bad', label: 'Withdrawn — source mismatch' };
  }
  if (row?.verification_status === 'partly_verified') {
    return { key: 'partly_verified', tone: 'warn', label: 'Partly verified' };
  }
  if (row?.verification_status === 'confirmed') {
    return { key: 'confirmed', tone: 'ok', label: 'Confirmed on the official page' };
  }
  return { key: 'unverified', tone: 'warn', label: 'Unverified / not re-read' };
}

function nullMetrics(calculationStatus, calculationNote, extra = {}) {
  return {
    fine_gold_g: null,
    gold_value_usd: null,
    price_to_gold: null,
    fine_gold_g_low: null,
    fine_gold_g_high: null,
    gold_value_usd_low: null,
    gold_value_usd_high: null,
    calculation_status: calculationStatus,
    calculation_note: calculationNote,
    price_review: null,
    ...extra,
  };
}

export function deriveGoldMetrics(row, {
  spotUsdPerOzt,
  gramsPerTroyOunce = NIST_GRAMS_PER_TROY_OUNCE,
  ambiguousWeightIds = [],
} = {}) {
  const spot = finitePositive(spotUsdPerOzt);
  const grams = finitePositive(gramsPerTroyOunce);
  if (!spot || !grams) {
    throw new Error('A positive dated USD/troy-ounce reading and the NIST gram conversion are required; grains are not grams.');
  }

  if (row?.withdrawn || row?.verification_status === 'withdrawn_source_mismatch') {
    return nullMetrics('withdrawn', 'Cannot be computed: the official URL now identifies a different product.');
  }
  if (row?.price_unverified) {
    return nullMetrics('source_unverified', 'Cannot be computed: the stored price/source is unverified.');
  }

  const weightLow = finitePositive(row?.weight_g_low);
  if (!weightLow) {
    return nullMetrics('missing_weight', 'Cannot be computed: no eligible seller-published gram weight.');
  }
  const weightHigh = row?.weight_g_high === null || row?.weight_g_high === undefined
    ? weightLow
    : finitePositive(row.weight_g_high);
  if (!weightHigh || weightHigh < weightLow) {
    return nullMetrics('invalid_weight', 'Cannot be computed: the stored weight bounds are invalid.');
  }

  const ambiguous = new Set(ambiguousWeightIds);
  if (ambiguous.has(row.id) || (row.flags || []).includes('weight_basis_unverified')) {
    return nullMetrics('ambiguous_weight', 'Cannot be computed: the seller has not established that Weight is metal-only or excluded stone mass.');
  }

  const fraction = karatFraction(row.karat);
  if (!fraction) {
    return nullMetrics('invalid_karat', 'Cannot be computed: the karat value is missing or invalid.');
  }
  const perGram = spot / grams;
  const fineLow = weightLow * fraction;
  const fineHigh = weightHigh * fraction;
  const meltLow = fineLow * perGram;
  const meltHigh = fineHigh * perGram;
  const priceLow = finitePositive(row.price_low);
  const priceHigh = row.price_high === null || row.price_high === undefined
    ? priceLow
    : finitePositive(row.price_high);
  const priceIsRanged = priceLow !== null && priceHigh !== null && priceLow !== priceHigh;
  const priceIsUsable = priceLow !== null && priceHigh !== null && priceHigh >= priceLow;

  if (weightLow !== weightHigh) {
    return nullMetrics(
      'ranged_weight',
      'Scalar fine-gold/melt outputs are blank; explicit official weight-bound arithmetic is shown separately. A price ratio requires a mapped configuration.',
      {
        fine_gold_g_low: round(fineLow, 3),
        fine_gold_g_high: round(fineHigh, 3),
        gold_value_usd_low: round(meltLow, 2),
        gold_value_usd_high: round(meltHigh, 2),
      },
    );
  }

  const ratio = priceIsUsable && !priceIsRanged ? priceLow / meltLow : null;
  const calculationStatus = !priceIsUsable ? 'invalid_price' : priceIsRanged ? 'unpaired_price_range' : 'computed';
  return {
    ...nullMetrics(
      calculationStatus,
      priceIsRanged
        ? 'Fine-gold/melt arithmetic uses the eligible listed weight; no scalar price ratio is derived from an unmapped variant range.'
        : priceIsUsable
          ? 'Arithmetic illustration only; not an appraisal, resale quote, or fairness score.'
          : 'Fine-gold/melt arithmetic is shown, but no price ratio is computed from missing or invalid price bounds.',
    ),
    fine_gold_g: round(fineLow, 3),
    gold_value_usd: round(meltLow, 2),
    price_to_gold: ratio === null ? null : round(ratio, 2),
    price_review: ratio !== null && ratio < 1 ? 'below_melt_review_required' : null,
  };
}
