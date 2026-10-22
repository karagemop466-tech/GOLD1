# GOLD1 — gold engagement-ring evidence index

A source-linked research repository and static dashboard for comparing gold engagement-ring settings without turning incomplete listings into unsupported buying advice.

> **NO HALLUCINATIONS.** A value that is not confirmed by an official product/manufacturer source stays blank and unverified. Never infer a price, karat, solid-gold construction, weight, hallmark, seller term, or test result. Continued hallucination review is required after every review.

## Current research status

- **13 candidates**, each with a direct official product URL, displayed price, currency, and **2026-10-22** retrieval date.
- **13 flagged for review; 0 purchase-ready.** Publication does not imply clearance.
- Six TraxNYC rows explicitly say solid gold and list gram weights. Those are seller statements and listed item weights—not verified physical purity or net metal weight.
- Seven Blue Nile/Brilliant Earth rows leave solid-gold wording and weight blank. No value is substituted.
- No candidate has verified physical purity-stamp plus maker’s-mark evidence, exact net metal weight, or independent post-delivery testing.
- Seller records preserve official contact, payment, return, documentation, and guarantee findings alongside direct BBB snapshots. BBB complaint counts are not normalized for business size and are not rankings or guarantees.

The dashboard contains 13 pages: landing summary, complete catalog, five category subpages, a prominent **Flagged for Review** matrix, seller review, buyer checklist, gold calculator, analysis, and methodology/sources.

## Run and verify

Node.js 22 or newer is recommended. There are no production dependencies.

```bash
npm ci
npm test
npm run build
npm run serve
```

The preview server binds to `0.0.0.0:4173` and serves only `dist/`. The publish directory is generated; do not edit it directly.

`npm test` runs, in order:

1. Evidence/schema, exact-price, seller, market-math, gate, irregularity, and narrative audits.
2. Static internal-link and local-fragment checks.
3. CSP, safe-DOM, local-only-fetch, external-URL, secret, and supply-chain checks.
4. Recommended HTML/accessibility validation for every page.
5. Browser-style DOM integration for all pages, including category filters, dialogs, seller policies, calculator behavior, and analysis.
6. A clean static build with five exact data copies, `.nojekyll`, and a SHA-256 manifest.
7. Published-byte/data parity and a second internal-link audit against `dist/`.

`npm audit --audit-level=high` is also used for dependency review. Automated checks complement direct source review; they do not authenticate jewelry or prove that an external page remains unchanged.

## Evidence layout

| Path | Purpose |
|---|---|
| `research/candidates.json` | Thirteen field-level product records, official excerpts, prices, URLs, retrieval dates, flags, and unsupported-conclusion lists |
| `research/sellers.json` | Seller contacts, payment/return/documentation findings, BBB evidence, and reputation-methodology limits |
| `research/irregularities.json` | Ten issue groups, including excluded records, source conflicts, mixed metals, size surcharges, and policy cautions |
| `research/policy/verification.json` | FTC/GIA/CFPB/LBMA guidance and nine explicit verification gates |
| `research/policy/market.json` | Named Kitco panel snapshot and nominal listed-weight calculation contract |
| `research/AUDIT.md`, `research/policy/AUDIT.md` | Source-review and verification records |
| `site/` | Reviewed HTML, CSS, and JavaScript source |
| `scripts/`, `tests/` | Automated audits and validator configuration |
| `dist/` | Generated publication output; ignored by Git |
| `COORDINATION.md` | Task ownership, work log, and final PR/merge/deployment record |

## Gold arithmetic and its limits

The only numeric market input is the named **Kitco Live GoldPrice** panel snapshot:

- Source timestamp: **Oct 22, 2026 — 19:11 NY Time**.
- Bid: **$4,025.00 per troy ounce**; ask: $4,027.00.
- Conversion stated by the same source: **31.1034768 grams per troy ounce**.
- Derived 24K bid reference: **$129.4067549387/g**, displayed as **$129.41/g**.

For a listed weight and karat:

```text
nominal fine-gold grams = listed weight × karat ÷ 24
nominal reference USD = nominal fine-gold grams × 4,025 ÷ 31.1034768
```

Precision is retained until display rounding. This is **nominal listed-weight arithmetic only**. It is not actual raw-gold content, melt/resale value, an appraisal, a dealer quote, or a fairness score. Actual raw-gold amount and value remain blank without verified net metal weight.

Size surcharges, stones, labor, design, taxes, shipping, and mixed-metal components can affect comparisons. Blue Nile item `500000y14` has platinum prongs; Brilliant Earth `BE1199H6-18KY` has 14K white-gold prongs. Do not apply one karat fraction blindly to a future whole-ring weight.

## Verification policy

A karat stamp alone is not proof. Before purchase, require explicit karat and solid-gold construction—not plated, vermeil, gold-filled, overlay, or gold-tone—and reconcile the purity stamp with a nearby maker’s mark. Obtain exact net metal weight, written seller/contact answers, configuration-specific return terms (including resized/custom exclusions), documentation, and a protected payment route.

Use an independent jeweler after delivery; quantitative XRF by a qualified professional can help verify precious-metal content and detect plating, but sampling area and interpretation matter. Complete verification before the actual return deadline. **Do not buy if reasonable independent verification or a workable return route is refused.**

Credit-card disputes are not guaranteed refunds. Preserve records, contact the issuer, and follow its process. The cited CFPB billing-error guidance discusses written notice within 60 calendar days after the charge appears; defective-goods disputes may follow a different process.

## Updating research

1. Read `COORDINATION.md`; honor task ownership and scopes.
2. Re-open the official product/policy source. Search snippets are discovery aids, not price evidence.
3. Preserve exact wording for each claimed field, a direct URL, and the retrieval date.
4. Leave missing values null, add source-specific flags, and record conflicting sources rather than choosing a convenient value.
5. Recheck excluded/unavailable records separately; never revive an old discovery price as current.
6. Run `npm test` after every review. Fix failures or keep the affected item explicitly flagged.
7. Reverify combined output and published-byte parity before integration. Continue hallucination and security review after publication.

## Publication

`.github/workflows/pages.yml` runs the full audit chain on the working branch, pull requests, and `main`. Only a successful `main` build is deployed to GitHub Pages. The generated artifact is static, contains no trackers or affiliate parameters, fetches only same-origin JSON, and does not require a backend or secrets.

The authoritative PR, merge, workflow, and live-URL result is recorded in `COORDINATION.md`.
