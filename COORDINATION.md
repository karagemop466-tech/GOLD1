# Coordination board

Last updated: 2026-10-22 (UTC)

## Non-negotiable evidence rules

- **No hallucinations.** Never infer, estimate, or fill a catalog value. A missing value stays blank and is flagged `unverified`.
- Prices and product facts must come from the official seller/manufacturer page, with a direct URL and retrieval date. Search-result snippets are discovery aids, not evidence.
- Independent review sources are used for reputation findings; official seller pages are not independent reviews.
- Every research record must preserve exact source wording or a precise quote for the claimed fields.
- A karat stamp alone does not verify purity. Listings are candidates, not authenticated purchases.
- Run the evidence/security audit after every review and before integration. Fix or flag every failure.

## Session protocol

Claim one task before editing its scope. Keep file scopes non-overlapping. Record source URLs, verification performed, and irregularities when marking a task done. Run `git pull --rebase` before every push. A claim older than 60 minutes with no commits may be taken over with a handoff note here.

This Arena session is restricted by the hosting environment to branch `arena/c662efda-gold1`; all task and integration commits therefore remain on that session branch. The final PR must use that branch.

## Tasks

| ID | Task | Status | Owning session | File scope | Started (UTC) |
|---|---|---|---|---|---|
| T1 | Repository audit and source research | done | arena/c662efda-gold1 | `research/**`, `README.md` | 2026-10-22 |
| T2 | Verification policy and trust/safety sources | done | arena/c662efda-gold1 | `research/policy/**` | 2026-10-22 |
| T3 | Static dashboard shell and accessible UI | done | arena/c662efda-gold1 | `site/assets/**`, `site/**/*.html` (except generated catalog/review tables) | 2026-10-22 |
| T4 | Automated evidence, link, and security checks | in progress | arena/c662efda-gold1 | `scripts/**`, `tests/**`, `package.json`, `package-lock.json` | 2026-10-22 |
| T5 | Final integration: combine evidence, generate all shared outputs, build, audit, PR, deploy | unclaimed | — | `data/**`, `site/data/**`, generated tables/navigation, `.github/**`, root config, `COORDINATION.md` | — |

## Requests across scopes

None.

## Work log

### 2026-10-22 — arena/c662efda-gold1

- Claimed T1. Initial repository contains only `README.md` (`# GOLD1`); there is no existing catalog, price, purity, weight, seller, or return-policy claim to preserve or verify.
- Remote branches checked before starting: only `origin/main` was present. No competing task claim was found.
- **T1 done (c098387).** `research/candidates.json` contains 13 active rows with official product URLs, retrieval dates, field-level excerpts, null missing values, and review flags. Six have explicit seller-stated solid-gold wording and listed weights; seven leave solid-gold/weight fields blank. No row has verified physical marks, net metal weight, independent testing, or purchase-ready status. `research/sellers.json` records official contact/payment/return/documentation findings and direct BBB profile/complaint snapshots. `research/irregularities.json` records ten open/excluded issues, including item 71345’s URL-ID mismatch, size surcharges, mixed-metal prongs, the excluded €720 BE variant, the BBB snippet conflict, chargeback wording, and BE’s return clock. All source URLs are preserved in those files. T1 evidence/hallucination/security audit passed; see `research/AUDIT.md`.
- **T2 done.** `research/policy/verification.json` preserves FTC karat/maker/solid/plating guidance, GIA XRF capabilities/limitations, CFPB dispute timing/records guidance, and nine explicit verification gates. `research/policy/market.json` uses only Kitco’s named Live GoldPrice panel: 2026-10-22 19:11 NY, bid $4,025.00/troy oz, ask $4,027.00, displayed $129.41/g; troy-ounce conversion 31.1034768 g. LBMA is methodology-only. Dynamic Kitco panel variance is recorded, not blended. Derived rate $129.4067549387/g cross-checks to displayed $129.41/g. Audit passed in `research/policy/AUDIT.md`. Claimed T3.

## Final publication record

Pending final integration.
