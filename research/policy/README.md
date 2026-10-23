# Verification policy and market reference

> **NO HALLUCINATIONS.** A source’s scope is part of the evidence. A karat statement is not solid-gold proof, a listed ring weight is not net metal weight, a BBB grade is not a guarantee, and a gold benchmark is not a jewelry valuation.

Retrieved **2026-10-22**.

## Files

- `verification.json` — FTC jewelry-marking guidance, GIA XRF evidence, CFPB dispute guidance, and the project’s pass/fail gates.
- `market.json` — named Kitco snapshot, troy-ounce conversion, formula, rounding, and LBMA methodology context.

## Gold reference used by the calculator

The calculator uses the **Kitco “Live GoldPrice” panel** retrieved October 22, 2026:

- Source timestamp: **Oct 22, 2026 - 19:11 NY Time**.
- Bid: **$4,025.00 per troy ounce**.
- Ask: **$4,027.00 per troy ounce** (recorded, not used for bid-side calculations).
- Source-displayed bid: **$129.41 per gram**.
- Conversion stated on the same page: **1 troy ounce = 31.1034768 grams**.

The page contained dynamically updated panels with slightly different timestamps/values. They are not blended. The named panel’s bid and timestamp are preserved, and the variance is documented in `market.json`.

**Second, independent reading published beside it (2026-10-23, `sess-7d64f506`, board `T52`):** the calculator reference above is a **dated snapshot**, so a separate gold-api.com spot read was taken and stored in `market.json` as `liveFeed`, with the publisher's own timestamp:

- Source: <https://api.gold-api.com/price/XAU>, publisher timestamp **2026-10-23T23:38:16Z**.
- Spot: **3996.899902 USD per troy ounce** ($3,996.899902), read twice with the same value.
- Derived at the same 31.1034768 g/ozt conversion: **$128.50 per gram**.

The calculator still uses the named Kitco panel so its arithmetic stays reproducible against the audited snapshot; the second reading is published next to it so the gap between the two is visible rather than hidden. Neither is a dealer quote, a resale offer or an appraisal, and neither is blended, averaged or substituted.

### Formula

```text
reference USD/g = bid USD/troy oz ÷ 31.1034768
nominal fine-gold grams = listed weight g × karat ÷ 24
nominal reference USD = nominal fine-gold grams × reference USD/g
```

Keep full precision through the arithmetic and round only displayed outputs. The nominal calculation is an arithmetic illustration from a listed weight; it is **not actual gold content**, a melt quote, a resale value, or a retail fairness score. Actual raw-gold amount/value remains blank without verified net metal weight.

LBMA’s page is used only to explain the twice-daily London benchmark methodology. No current LBMA number was obtained or inserted.

## Verification boundaries

- FTC: 18K means 18/24 and 14K means 14/24; look for a maker’s U.S. registered trademark near the karat mark; “solid gold” means not hollow; plated/filled/overlay/vermeil/flashed/washed constructions are distinct.
- GIA: quantitative XRF can measure major components of common gold alloys and help detect plating. Sampling and interpretation still matter; one reading is not universal proof.
- CFPB: contact the card company about disputes; written billing-error notices have a 60-calendar-day deadline after the charge appears on the statement. Defective-goods disputes can follow a different process. This is not a promise of a chargeback.
- Project gate: do not buy when reasonable independent verification or a workable return route is refused. Complete inspection before the seller’s actual return deadline.

All gaps remain visible. Continue hallucination, source-scope, and security review after every change.
