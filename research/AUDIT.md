# Research audit log

## 2026-10-22 — T1 evidence and hallucination audit

**Result: PASS after corrections.**

Reviewed all 13 candidate records, three seller records, and ten irregularity records against the direct-page retrieval notes and official-page excerpts.

### Checks performed

- Unique candidate IDs and valid seller references.
- Official HTTPS product URL and 2026-10-22 retrieval date on every row.
- Field-level evidence for every nonblank name, item number, category, style, karat, metal color, price, price basis, solid-gold statement, listed weight, and documentation claim.
- Price string present in the associated official excerpt.
- `purityStamp`, `makersMark`, `netMetalWeightGrams`, and `independentVerification` remain `null` on every row.
- Explicit solid-gold wording counted separately from karat-only wording.
- No affiliate/query parameters added to product links.
- Every irregularity references valid candidate IDs or an explicit exclusion.

### Audit totals

- 13 candidates; 3 sellers; 10 irregularities.
- 6 explicit seller-stated solid-gold rows.
- 6 listed-weight rows; 0 verified net-metal-weight rows.
- 0 rows with verified physical purity stamp plus maker’s mark and independent testing.
- 0 purchase-ready rows.

### Corrections and disposition

- Corrected Aurora 70589 to side stones.
- Removed unsupported certificate-of-authenticity wording; retained sourced appraisal/IGI statements only.
- Replaced compressed paraphrases with source-wording excerpts and documented normalization.
- Excluded the €720 Six-Prong Petite 14K variant from the USD catalog.
- Discarded the non-reproducible BBB search-summary letter grade; retained direct-profile findings only.
- Kept every unresolved gap visible rather than blocking publication.

### Security/privacy review

The research files contain public product, policy, and business-contact information only. No credentials, payment details, customer personal data, tracking URLs, or affiliate codes were added. Public complaint narratives are not copied into the dataset; only BBB aggregate counts and profile-level findings are retained.

**Continuing requirement:** repeat evidence, hallucination, link, and security checks after integration and after every subsequent review.
