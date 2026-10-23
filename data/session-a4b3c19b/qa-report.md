# T47 independent post-union QA

- Generated: 2026-10-23T23:41:21.401Z (UTC)
- Dataset snapshot: 2026-10-23T20:31:23Z; 71 rows, 11 retailers.
- Scope: static-only audit in a disposable archive; no live seller pages or spot-price feeds were fetched.

## Check results

| Check | Result |
|---|---|
| npm_ci | PASS — 0 vulnerabilities reported by npm audit |
| npm_test | PASS — evidence, internal links, security, HTML validation, runtime, build parity |
| canonical_verifier | PASS — S01–S20, 6,922 assertions, P111, 0 failures |
| audit_0804e222 | PASS — A01–A10, 1,966 assertions |
| audit_545688f3 | PASS — H01–H13, 1,684 assertions |
| audit_dab93754 | PASS — N01–N11, 1,567 assertions |
| evidence_math_test | PASS — 38 assertions, rerun separately after the semantic audit returned nonzero. |
| Semantic audit | **159 findings; 2/10 groups passed** |

### Semantic-audit groups

| Group | Result | Findings |
|---|---:|---:|
| R01 — Exact row schema and numeric-token provenance | PASS | 0 |
| R02 — Verification verdicts agree with observed bounds and weights | FAIL | 6 |
| R03 — Requirements math never averages or reuses unverified values | FAIL | 19 |
| R04 — Requirements tiers and buyer-action labels are honest | FAIL | 91 |
| R05 — Checklist summary matches canonical spot and active/withdrawn counts | FAIL | 3 |
| R06 — README current-state prose is synchronized | FAIL | 5 |
| R07 — No unsupported retail-price or wearability generalisations | FAIL | 26 |
| R08 — Published counts and verification badges distinguish partial and withdrawn rows | PASS | 0 |
| R09 — Flag and requirements source coverage | FAIL | 5 |
| R10 — Source registry and audit-reference integrity | FAIL | 4 |

### First 10 high-severity detector findings (not independently re-verified)

| Finding | Detector statement | Source links in preserved report |
|---|---|---|
| R02-01 (high) | rs-571223: notes claim a single current price but the schema publishes a range | [source 1](https://www.ross-simons.com/products/571223) |
| R02-02 (high) | rs-943668: notes say 1439.00 is no longer listed but the later evidence quotes it | [source 1](https://www.ross-simons.com/products/943668) |
| R02-03 (high) | au-xring: verification note says partially verified but status is confirmed | [source 1](https://auratenewyork.com/products/x-ring-with-diamonds) |
| R02-04 (high) | au-xring: evidence narrative says variant range but schema stores one price | [source 1](https://auratenewyork.com/products/x-ring-with-diamonds) |
| R02-05 (high) | P42 reconciler never detects an observed range that fails to reproduce the stored upper bound | — |
| R02-06 (high) | P42 reconciler marks rows confirmed from price alone, even when a stored weight was not reproduced or a range-widening observation was not explicitly applied | — |
| R03-01 (high) | Requirements builder averages low/high variant prices, contradicting the no-averaging rule | — |
| R03-02 (high) | Site builder divides a lower price bound by an upper melt bound without proving the variants are paired | — |
| R03-03 (high) | Site and requirements builders have no shared ambiguous-item-weight guard | — |
| R03-04 (high) | S06 calls a below-melt result impossible/wrong instead of requiring source review and a visible flag | — |

## Important limits and irregularities

- The main structural verifier and security checks passed in an isolated copy of this exact branch snapshot.
- The independent semantic/provenance audit is explicitly NOT green: it reports 159 findings across R02–R07, R09 and R10. This reproduces the count already logged by the T44 owner; it is not an independent confirmation of each underlying product claim.
- No product, return-policy, hallmark, weight, or current gold-price source was re-opened in this pass. Stored prices are not represented as current or independently verified by this report.
- Source-link structure only establishes HTTPS URLs on the configured retailer domain; it does not prove the page still describes the listed product or that any price is current.

Detailed, unmodified failed-audit finding snapshot: [`audit-5f363d57-snapshot.json`](audit-5f363d57-snapshot.json). Refer to each finding’s source URL for manual review; findings are not treated as verified facts solely because the static detector reported them.
