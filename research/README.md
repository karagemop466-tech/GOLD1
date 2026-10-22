# Evidence register — gold engagement rings

> **NO HALLUCINATIONS.** Never infer, estimate, or fill a catalog value. If an official source does not confirm a value, it stays blank (`null`) and unverified. Search-result snippets are discovery aids, never catalog evidence.

Retrieval date for this register: **2026-10-22 (UTC)**.

## Current audit result

- **13 active candidate rows** were read line by line on official product pages.
- **6 rows** have explicit seller wording for solid 14K/18K gold and a listed gram weight.
- **7 rows** state karat but do not provide both explicit solid-gold wording and gram weight; those fields remain blank.
- **0 rows** have verified physical purity-stamp **and** maker’s-mark evidence.
- **0 rows** have verified net metal weight or post-delivery independent testing.
- **0 rows are purchase-ready.** They are research candidates, not authenticated products or endorsements.

This is a bounded audit set, not an exhaustive crawl of every engagement ring on the market. “Active” means an official product page was available at retrieval; it is not a stock or price guarantee.

## Files

| File | Purpose |
|---|---|
| `candidates.json` | Product-level sourced values, blanks, flags, and direct official-page excerpts |
| `sellers.json` | Contact, credit-card acceptance, return, documentation, guarantee, and independent BBB findings |
| `irregularities.json` | Open conflicts, missing evidence, exclusions, and required manual action |

Verification-policy and gold-market sources are maintained separately under `research/policy/`.

## Dashboard and verification

[Open the 13-page official-source audit dashboard](../site/). It includes the complete catalog, five category subpages, a prominent Flagged for Review matrix, seller/policy findings, checklist, calculator, nominal-value analysis, and methodology. On the published GitHub Pages site it is available at `/GOLD1/site/`.

The dashboard reads five exact JSON copies in `site/data/`; it does not migrate these rows into the separate root 43-row dataset. Run `npm ci && npm test` from the repository root to verify evidence, links, security, HTML, runtime interactions, the build, and byte-for-byte publication-data parity.

## Evidence method

1. Open the official product or policy page directly.
2. Read the product title, item/stock number, selected metal variant, price basis, size pricing, weight, item specifics, documentation, and Q&A line by line.
3. Record the direct URL and retrieval date for every row.
4. Preserve source wording in the `evidence` records. Quotes are whitespace/Markdown normalized. A semicolon joins separate, non-contiguous excerpts from the **same** page; it never combines sources.
5. Cross-check seller-level return, payment, and contact claims against official policy pages. Check reputation separately on direct BBB profiles and complaint pages.
6. Leave physical stamps, maker’s marks, net metal weight, and independent testing blank unless evidence actually verifies them.
7. Record conflicts in `irregularities.json`; do not silently choose a convenient value.

Official seller statements are labeled `seller-stated`, not independently verified facts. BBB ratings and complaint counts are snapshots and not endorsements or guarantees. Raw complaint counts are not normalized for seller transaction volume.

## Weight and raw-gold rule

`listedWeightGrams` is only the number displayed by the seller. For the six TraxNYC rows, the page also says sizing can change weight. The listings do **not** establish whether gemstones are included. Therefore:

- `netMetalWeightGrams` remains `null` for every row.
- A nominal calculation may use `listed weight × karat ÷ 24` only as an explicitly labeled arithmetic illustration.
- That nominal result is **not** actual fine-gold content, a melt quote, a resale value, or proof of a fair retail price.
- Do not subtract gemstone weight or invent a metal-only weight without a sourced measurement.
- Mixed-metal heads/prongs require component-level attention; one karat fraction cannot safely be applied to a future whole-ring weight.

## Exclusions and conflicts retained for review

- Brilliant Earth’s Six-Prong Petite 14K page displayed **€720.00** while a USD selector was visible. It is excluded from the USD catalog; no conversion was made.
- TraxNYC item **71345** has a URL slug ending in **70845**. The official page item number is used, and the mismatch is flagged for invoice verification.
- A BBB discovery snippet for TraxNYC conflicted with the direct profile. The snippet’s letter grade was discarded; the direct profile’s non-accreditation and complaint-page counts are recorded instead.
- TraxNYC size surcharges, mixed-metal prongs, return-clock wording, documentation applicability, and seller dispute terms remain visible in the irregularity register.
- Unavailable/sold-out discovery candidates and search-only prices are not active catalog rows.

## Corrections made during the line-by-line audit

- Reclassified TraxNYC Aurora 70589 from solitaire to **side stones** after its official page listed tapered baguette side diamonds.
- Removed an unsupported separate “certificate of authenticity” claim. TraxNYC pages support a **certified appraisal**; only items 71345 and 71851 list an IGI center-stone report.
- Kept Blue Nile’s packaging statement about an appraisal certificate and grading report at seller level with an applicability warning, rather than claiming each setting-only row includes a diamond report.
- Added only directly verified USD prices; preserved the euro-denominated variant as an exclusion rather than relabeling it.

## Required next action before any purchase

1. Open the official link and confirm the exact item number, variant, size, center stone, final price, and availability.
2. Obtain written answers for explicit solid-gold construction, metal-only gram weight, purity stamp, maker’s mark, and configuration-specific documents.
3. Get written confirmation that the exact configured ring is returnable, including any resize/custom/engraving exclusion and the precise return-window start.
4. Prefer a credit card after reviewing issuer protections and seller terms; card acceptance alone is not a protection guarantee.
5. Keep the invoice, appraisal, any lab report, all packaging, and written seller responses.
6. Arrange an independent jeweler immediately after delivery. Inspect stamps/construction and use appropriate testing such as XRF with professional interpretation. A stamp or seller appraisal alone is not proof.
7. **Do not buy if the seller refuses reasonable independent verification or a workable return route.** Complete verification before the return window expires.

## Continuing review

Re-run the evidence, hallucination, and security audits after every data or presentation review. Prices, policies, availability, BBB profiles, and gold benchmarks can change. Re-fetch official pages before relying on this snapshot, and continue independent hallucination review rather than treating one audit as permanent clearance.
