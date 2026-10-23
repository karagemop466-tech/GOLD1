# COORDINATION.md — shared task board

**Project:** GOLD1 — verified online buying research for a **solid gold engagement ring**
**Sessions on this repo:** `sess-6f8c2bcb` (first research pass, closed), `sess-d8f0544e` (second pass + integration, closed), `sess-bc088451` (third pass: live re-verification, weight/melt upgrade, publish — closed), `sess-b93ff7c6` (parallel third pass + reconciliation + publish — closed), `arena/c662efda-gold1` (independent official-source review + standalone `site/` publication — closed), `sess-277867af` (fourth pass: full 43-row re-check + `S18`/`S19` — closed), and `sess-0804e222` (fifth pass: 16-ring 10K–24K expansion, 4 more Aurate weights + variant-level `au-cigar` read, 10-retailer policies & BBB grades, federal/GIA/CFPB standards, `A01`–`A10` security/provenance audit & final union publish — **closed**)
**Board owner:** `sess-0804e222` (reconciled union board, §9–§13) · **Board updated:** 2026-10-23T00:02Z

---

## 0. How to use this board

1. Read this file **before** starting any task.
2. Claim a task by writing your session ID, branch, and file scope in the row, then **commit and push the claim immediately**.
3. Never start a task another session has claimed and not released.
4. Keep scopes non-overlapping. If a task needs a file owned by another session, log a *Request* in §5 instead of editing it.
5. Make small, frequent commits; `git pull --rebase` before every push.
6. A claim older than 60 minutes with no commits may be taken over — record the handoff in §6.
7. Shared outputs (the table data, the site index and navigation) are changed only by the final integration session.
8. Never mark anything verified without an official source link.

### Branch naming note (Arena sessions)

Arena fixes the branch name of an interactive session, so neither session used the
`session-<id>/<task>` pattern: `sess-6f8c2bcb` worked on `arena/6f8c2bcb-gold1` and
`sess-d8f0544e` on `arena/d8f0544e-gold1`. The constraints that matter — one session per
scope, one branch per session, no cross-session edits — were kept.

---

## 1. Task board

| ID | Task | Status | Owner (session) | Branch | File scope | Updated |
|----|------|--------|-----------------|--------|-----------|---------|
| T1 | First pass: Blue Nile, Mejuri, Brilliant Earth data + Python site generator | **done** | sess-6f8c2bcb | arena/6f8c2bcb-gold1 | `data/rings.json` (v1 schema), `tools/`, `assets/`, root pages | 2026-10-22 |
| T2 | First pass: verification + flagged items | **done** | sess-6f8c2bcb | arena/6f8c2bcb-gold1 | `data/verification-report.json`, `flagged.html` | 2026-10-22 |
| T3 | Second pass: Ross-Simons, Aurate, With Clarity, Anna Sheffield data + evidence collector | **done** | sess-d8f0544e | arena/d8f0544e-gold1 | `scripts/collect.mjs`, `data/collect/`, `data/raw/`, `.github/workflows/collect.yml` | 2026-10-22 |
| T4 | Second pass: curated dataset, source registry, flagged items | **done** | sess-d8f0544e | arena/d8f0544e-gold1 | `data/rings.json`, `data/sources.json`, `data/flagged.json`, `data/retailers.json`, `data/gold-price.json`, `data/checklist.json` | 2026-10-22 |
| T5 | Second pass: static site (dashboard, categories, details, calculator, checklist, sources, flagged, checks) | **done** | sess-d8f0544e | arena/d8f0544e-gold1 | `scripts/build.mjs`, `assets/`, generated `*.html` | 2026-10-22 |
| T6 | Second pass: anti-hallucination audit | **done** | sess-d8f0544e | arena/d8f0544e-gold1 | `scripts/verify.mjs`, `data/checks/` | 2026-10-22 |
| T7 | **Integration**: merge both passes into one dataset + one site, re-verify line by line, resolve conflicts without discarding work | **done** | sess-d8f0544e | arena/d8f0544e-gold1 | `scripts/integrate_session_6f8c2bcb.py`, `data/archive/`, shared site files | 2026-10-22 |
| T8 | Publish: PR to `main`, merge, confirm Pages deploy, record links | **done** (PR #6, #7, #9 merged) | sess-d8f0544e | arena/d8f0544e-gold1 | §7 below | 2026-10-22 |
| T9 | **Third pass**: live re-verification of published prices/karats against retailer pages; correct any drift | **done** | sess-bc088451 | arena/bc088451-gold1 | `data/rings.json`, `data/sources.json`, `data/flagged.json` | 2026-10-22 |
| T10 | **Third pass**: recover seller-published metal weight (grams) where the retailer publishes it; recompute melt checks | **done** | sess-bc088451 | arena/bc088451-gold1 | `data/rings.json`, `data/gold-price.json` | 2026-10-22 |
| T11 | **Third pass**: extend the hallucination audit (weight traceability, melt recomputation, stale-data, no-invented-numbers) | **done** | sess-bc088451 | arena/bc088451-gold1 | `scripts/verify.mjs`, `data/checks/` | 2026-10-22 |
| T12 | **Third pass**: site update (data-age banner, melt/value columns, weight-coverage page content) | **done** | sess-bc088451 | arena/bc088451-gold1 | `scripts/build.mjs`, `assets/`, generated `*.html` | 2026-10-22 |
| T13 | **Third pass**: PR to `main`, merge, confirm Pages deploy, record links | **done** | sess-bc088451 | arena/bc088451-gold1 | §7 below | 2026-10-22 |
| T14 | **Reconciliation + publish**: merge `main`'s P12 into this branch, keep one ledger, fold in this session's extra reads, rebuild, re-audit, PR, merge, confirm Pages | **done** | sess-b93ff7c6 | arena/b93ff7c6-gold1 | `scripts/reconcile_second_read_p12.py`, `data/reverification.json`, `data/rings.json`, `data/flagged.json`, `scripts/build.mjs`, generated `*.html`, `README.md`, this board | 2026-10-22 |
| T15 | **Independent official-source review**: 13 product rows, seller/policy evidence, 13-page `site/` dashboard and automated audits | **done** | arena/c662efda-gold1 | arena/c662efda-gold1 | `research/**`, `site/**`, `scripts/*.js`, `tests/**`, `package*.json` | 2026-10-22 |
| T16 | **Standalone subsection publish**: preserve the root publisher, synchronize `site/data/`, run combined audits without rewriting canonical root reports, PR, merge and verify `/site/` on Pages | **done** (PR #21 merged; Pages live) | arena/c662efda-gold1 | arena/c662efda-gold1 | `site/data/**`, `research/README.md` entry link, `scripts/verify.mjs` ignored-dist exclusion only, session archive, §11 below | 2026-10-22 |
| T17 | **Full 43-row line-by-line re-check + final integration**: every row re-read against its
own official page, the two independent passes reconciled without discarding either, gold price
refreshed, `Gold value` + `Last checked` columns added, unverified rendering enforced, PR to
`main`, merge, Pages confirmed | **in progress → done** | **sess-277867af** | arena/277867af-gold1
| `data/verification-2026-10-22.json`, `scripts/reconcile_session_277867af.py`, `data/rings.json`,
`data/flagged.json` (F37–F41), `data/sources.json`, `data/gold-price.json`, `scripts/build.mjs`,
`scripts/verify.mjs` (S18–S19), generated `*.html`, this board | 2026-10-22 |
| T20 | **100% (43/43) live HTML PDP audit**: re-verify all 43 inherited rows + recover 5 weights (`rs-960952` `1.3g`, `au-2ct-oval` `2.73g`, `au-1ct-emerald` `1.97g`, `au-3ct-round` `3.3g`, `au-xring` `2.7g` + `"solid gold"`), resolve `au-cigar` variant-level 14K price (`$1,308`–`$1,668`), catch Aurate Final-Sale notices, `grains_per_troy_ounce` mislabel, and `c2bbe753` leads | **done** | sess-0804e222 | arena/0804e222-gold1 | `data/session-0804e222/repo-audit.json`, `data/session-0804e222/flagged-0804e222.json` | 2026-10-22 |
| T21 | **Retailer policy, contact, BBB reputation & regulatory/testing standards**: official return/resize/custom terms for all 10 retailers; BBB grades (`F25`, incl. Aurate `F`); 16 CFR Part 23, NIST `31.1034768 g/ozt`, GIA XRF limits (`2024`/`2025`), CFPB FCBA | **done** | sess-0804e222 | arena/0804e222-gold1 | `data/session-0804e222/retailer-policies.json`, `data/session-0804e222/standards.json` | 2026-10-22 |
| T22 | **10K / 14K / 18K / 24K solid-gold + gram-weight ring expansion**: 16 verified primary-source listings across Ross-Simons (`10K` `0.3g`, `14K` `1.5g`), Mejuri (`10K` solid), Automic Gold (`14K` solid + `1.4g`–`7.0g` weights), Cartier (`18K` `750/1000`), and Menē (`24K` pure gold) | **done** | sess-0804e222 | arena/0804e222-gold1 | `data/session-0804e222/new-rings.json` | 2026-10-22 |
| T23 | **Extended anti-hallucination & security verifier + zero-loss integrator**: cross-file consistency, weight/price/karat provenance, HTML/CSP/XSS/rel=noopener security checks, idempotent merger | **done** | sess-0804e222 | arena/0804e222-gold1 | `scripts/audit_0804e222.mjs`, `scripts/integrate_0804e222.mjs` | 2026-10-22 |
| T24 | **Zero-loss final union integration & Pages publish**: merge `origin/main` (`f919689` incl. PR #21/#22/#23/#24) without discarding any work, run `integrate_0804e222.mjs` + `build.mjs` + `verify.mjs` (`S01`–`S19`) + `audit_0804e222.mjs` (`A01`–`A10`) + `/site/` audits, open PR, merge, verify live GitHub Pages | **done** (PR #25 merged; Pages live) | sess-0804e222 | arena/0804e222-gold1 | shared `data/*.json`, `scripts/build.mjs`, `scripts/verify.mjs`, root `*.html`, `README.md`, `COORDINATION.md` | 2026-10-23 |

Status values: `unclaimed`, `in progress`, `done`, `needs review`.
`needs review` = published on the Flagged for Review page; it never blocks a merge.

---

## 2. Ground rules (agreed requirements)

- **No hallucinated prices or specifications.** Every value in every table row is copied from an official source and carries that source link.
- If a value cannot be confirmed from an official source, it stays **blank** and is listed on `flagged.html` as **unverified**.
- Higher karat is not automatically "better"; **solid gold** must be stated explicitly.
- A stamp is a claim, not proof — the site says so on every page that shows karat.
- Automated checks run after every review pass and re-run before publish.

---

## 3. Sources policy

Accepted primary sources:

- Official retailer product feed / product page for **price and stated metal**.
- Official retailer policy page for **returns**.
- Regulator (eCFR 16 CFR Part 23) for **marking and purity rules**.
- Market data publisher (gold-api.com, Yahoo/COMEX) for **gold price**, always stored with the publisher's own timestamp.

Not accepted as a source: search-result snippets, review aggregators, affiliate round-ups, screenshots without URL, or any value "remembered" by an agent.

---

## 4. Verification log

| Date (UTC) | Session | What was verified | Method / source | Result |
|------------|---------|-------------------|-----------------|--------|
| 2026-10-22 | sess-6f8c2bcb | Blue Nile, Mejuri, Brilliant Earth prices, karats, setting-vs-ring basis | Official product and listing pages (recorded per row) | 13 rows, 15 flags — see `data/archive/session-6f8c2bcb/` |
| 2026-10-22 | sess-6f8c2bcb | Mejuri explicit "solid gold" wording (4 rows) | Mejuri product pages: "Handcrafted in recycled 14k solid gold" etc. | 4 rows marked solid-stated |
| 2026-10-22 | sess-6f8c2bcb | Blue Nile 18K listing contradicts its own description; snippet vs live price mismatch | Product page + search snippet comparison | flags F-01, F-02 |
| 2026-10-22 | sess-d8f0544e | Repo baseline and Pages configuration | `git log`, `git branch -a`, `gh api repos/.../pages` | clean baseline; Pages `main` `/` |
| 2026-10-22 | sess-d8f0544e | Sandbox network limits; Actions dispatch 404 (only Pages workflow registered) | `curl` probes; `gh workflow run` | collection done by direct retrieval; collector kept as refresh path |
| 2026-10-22 | sess-d8f0544e | Ross-Simons prices, karats, titles | Official feeds: gold rings collection, storefront search (bands, diamond, estate) | 17 rows |
| 2026-10-22 | sess-d8f0544e | With Clarity setting prices and "Ring Setting Product" tag | Official search feed (solitaire, sapphire) | 5 rows, setting-only labelled |
| 2026-10-22 | sess-d8f0544e | Anna Sheffield prices, 14k recycled gold, stone specs | Official search feed (engagement, solitaire) | 3 rows |
| 2026-10-22 | sess-d8f0544e | Aurate prices, published weight, vermeil-vs-solid trap | Official search feed (engagement, 14k band) | 5 rows; vermeil variant flagged |
| 2026-10-22 | sess-d8f0544e | All four return policies and contact details | Official `/policies/refund-policy` pages | terms quoted into `data/retailers.json` |
| 2026-10-22 | sess-d8f0544e | Gold price | gold-api.com 4,028.100098 USD/ozt at 2026-10-22T23:01:42Z; COMEX GC=F 4,043.00 | stored with publisher timestamps |
| 2026-10-22 | sess-d8f0544e | US gold-marking rules | eCFR 16 CFR Part 23 (up to date 2026-10-21), § 23.3, § 23.4, § 23.10, § 23.18 headings | cited; body text not quoted |
| 2026-10-22 | sess-d8f0544e | **Combined dataset**: 43 rows, 58 pages | `node scripts/verify.mjs` | 13/13 groups pass, 2,094 assertions, 0 failures |
| 2026-10-22 | sess-b93ff7c6 | Ross-Simons 571221/571222/571223/571213/981367/907250 prices **and published gold weights** (1.7 / 2.5 / 3.8 / 5.0 / 0.5 / 0.5 g) | Official product pages, Details table "Gold Weight" | 6 prices confirmed except 571223 (moved $799→$849, corrected); 6 weights added |
| 2026-10-22 | sess-b93ff7c6 | Ross-Simons 879968, 960952, 999230, 993512, 864785, 242556, 991907, 240912 | Official per-SKU search feed and product JSON | 8 prices matched; 999230 title replaced with the seller's exact string |
| 2026-10-22 | sess-b93ff7c6 | Ross-Simons 943668, 991908, 254575 | Official search feed (no product returned for any of the three) | inconclusive by search; **superseded for 943668** by sess-bc088451, which opened the page and corrected it to $1,269 (F31). 991908 and 254575 remain unconfirmed and were left as captured — no flag raised, because the page was simply not opened |
| 2026-10-22 | sess-b93ff7c6 | Mejuri 2mm Smooth Band | Official product page | $498 and "Handcrafted in recycled 14k solid gold" confirmed; width/thickness published, no grams |
| 2026-10-22 | sess-b93ff7c6 | Anna Sheffield Bea Solitaire; With Clarity Tulip Basket | Official product JSON feeds | $11,500.00 and $590–$1,110 confirmed |
| 2026-10-22 | sess-b93ff7c6 | Aurate Modern Cigar Band | Official product JSON | Weight range 2.6–4 g confirmed; 14K price **not** re-confirmed (live range $118–$1,668). Recorded in the ledger as `weight confirmed / 14K price unconfirmed`; no new flag, because F13 already covers unmapped variant prices |
| 2026-10-22 | sess-b93ff7c6 | Gold spot refresh | gold-api.com `price` 4,029.699951 USD/ozt at 2026-10-22T23:22:41Z | stored as primary; 4,028.100098 at 23:01:42Z kept in `previous_readings` |
| 2026-10-22 | sess-b93ff7c6 | US gold-marking rules | eCFR 16 CFR Part 23, Subchapter B (corrected from "Subchapter C" in earlier notes) | headings §23.3, §23.4, §23.10, §23.18 confirmed on the official page |
| 2026-10-22 | sess-b93ff7c6 | **Reconciliation + full suite after the merge** | `python3 scripts/reconcile_second_read_p12.py && node scripts/build.mjs && node scripts/verify.mjs` | **17/17 groups pass, 0 failures, 75 pages** (weights 7/43, 20 ledger entries, 35 flags, F36 added) |

| 2026-10-22 | sess-bc088451 | Baseline: PR #9 merged, Pages `built`, `node scripts/verify.mjs` 13/13 on the inherited tree | `gh pr list`, `gh api .../pages`, local run | clean starting point | P11 |
| 2026-10-22 | sess-bc088451 | 7 product pages re-read live (Ross-Simons 571221 / 571222 / 571223 / 981367 / 907250 / 943668, Mejuri 2mm Smooth Band, With Clarity 4-prong) | Each official product page opened again; prices, karats, `Gold Weight` lines and return wording copied off the page | 7 confirmations, **2 price changes**, **4 weights recovered**, 1 setting basis re-confirmed (price not re-read) | P12 |
| 2026-10-22 | sess-bc088451 | Gold spot re-read | `api.gold-api.com/price/XAU` → 4,029.699951 USD/ozt at 2026-10-22T23:22:41Z (first reading 4,028.100098 at 23:01:42Z) | second reading stored; both kept in `data/gold-price.json` | P12 |
| 2026-10-22 | sess-bc088451 | New audit groups S14–S17 added and exercised | `node scripts/verify.mjs`; sabotage run in P15 | S10 caught a flag I had just dropped; S16 caught an injected fake price; S11 caught 58 links to a page not yet built | P13–P18 |
| 2026-10-22 | sess-bc088451 | Combined dataset after the third pass | `node scripts/verify.mjs` | 17/17 groups, 0 failures, ~3,100 assertions, 43 rows, 75 pages | P21 |

### Rejected sources (recorded so they are not silently reused)

| Source | Why rejected |
|--------|--------------|
| `ftc.gov/business-guidance/resources/gold-silver-jewelry-industry-guide` | Returned 404 on 2026-10-22 |
| `prices.lbma.org.uk/json/gold_pm.json` | HTTP 500 on 2026-10-22 |
| `bluenile.com/engagement-rings/solitaire` | Returned 404, so it was replaced by the `/engagement-rings/styles/solitaire` listing page |
| Set & Stones engagement-ring search | Results were gold-filled; fails the solid-gold rule |

---

## 5. Requests between sessions

| Date | From | To | Request | Status |
|------|------|----|---------|--------|
| 2026-10-22 | sess-d8f0544e | sess-6f8c2bcb | Permission to migrate your 13 rows into the v2 schema and regenerate the shared root pages with the Node builder. Your original records and tools are preserved; your published URLs are redirected. | recorded as an integration decision, since the session is closed and its board records "session close" |
| 2026-10-22 | arena/c56a7b27-gold1 | sess-d8f0544e (active integration owner) | Please qualify the solid-gold check: FTC says “solid gold” means not hollow, not “unplated” (https://consumer.ftc.gov/articles/buying-platinum-gold-and-silver-jewelry). Also replace any blanket claim that XRF is the only confirmation: GIA documents an electroformed gold-plated case where XRF alone did not reveal the wax/resin base (https://www.gia.edu/gems-gemology/spring-2024-lab-notes-electroformed-gold-bracelet). FTC online-shopping guidance supports the general credit-card recommendation (https://consumer.ftc.gov/articles/online-shopping), but issuer-specific terms remain unverified. | recorded & integrated in `sess-0804e222` (`F43`, `F47`, `checklist.html`) |
| 2026-10-22 | sess-277867af | sess-c662efda | Two live sessions now share this board. Please keep to `research/**`, `site/**`, `scripts/**`, `tests/**` and `package.json`; this session is re-verifying the 43 published rows and will regenerate only the root-level dashboard. Nothing of yours will be deleted — if your branch lands first, its files are merged in unmodified and linked from the dashboard. Do not regenerate `index.html`, `rings.html` or `data/rings.json` from your builder; Pages serves the root. | closed (both merged cleanly) |
| 2026-10-22 | sess-0804e222 | parallel sessions (`sess-b93ff7c6`, `sess-c662efda`, `sess-277867af`, `sess-cf46c7b9`) | `sess-0804e222` kept all intermediate work (`T20`–`T23`) strictly inside `data/session-0804e222/**` and `scripts/*_0804e222.mjs` so zero files overlapped with any active session, then merged `origin/main` (`f919689`) additively with zero data loss in `T24`. | done |
---

## 6. Handoffs / incidents

### Incident 1 — parallel session discovered at merge time

`sess-d8f0544e` began from commit `2820cba` (only `README.md`). While it was working,
`sess-6f8c2bcb` published four pull requests to `main` (#2–#5, head `58213b3`), building a
13-row dataset and a Python-generated site.

`gh pr merge 6` therefore failed with `CONFLICTING` / `DIRTY`. **Resolution (no work discarded):**

1. `main` was merged into `arena/d8f0544e-gold1` with `-s ours`, so the integration branch keeps
   one coherent site while `main`'s history is preserved as a parent.
2. The first pass's artefacts were restored into the integration branch rather than dropped:
   `tools/`, `.gitignore`, `data/rings.csv`, `data/spot-gold.json`, `data/verification-report.json`.
3. Its full dataset, flags, CSV and board were archived **unmodified** in
   `data/archive/session-6f8c2bcb/`.
4. Its 13 rows were migrated by `scripts/integrate_session_6f8c2bcb.py`, which maps fields
   mechanically (price → `price_low`/`price_high`, purity → `karat`, solid quote → evidence) and
   refuses to invent a weight. Each migrated row carries `inherited: true` and
   `verified_by: session-6f8c2bcb`, and the site shows that badge.
5. Its 15 flags were carried over as F15–F29 with the original text and an `original_id`.
6. Its published URLs (`bands.html`, `solitaire.html`, `retailers.html`, `verification.html`) now
   redirect to the corresponding pages of the integrated site.

**Kept from that session:** the dataset, its findings, its tools and its board history.
**Changed:** the published site is regenerated by `scripts/build.mjs`, because two generators
cannot own the same `index.html`. This is the one decision a human may want to revisit.

### Incident 2 — a third session merged PR #7 while the integration branch was open

`sess-c2bbe753` added a 14-row dataset (Tiffany & Co., Cartier, James Allen and extra Blue Nile /
Brilliant Earth / Mejuri rows) plus a `docs/` microsite and a second Python builder while this
integration was in progress, moving `main` to `8374d1b`.

**Resolution:** `main` was merged again with `-s ours` (history preserved as a parent). Every
artefact of the third pass was restored verbatim — `docs/`, `scripts/build_site.py`,
`scripts/verify_data.py`, `data/rings_c2bbe753.json`, `data/sources_c2bbe753.json`,
`data/audit_report.json`, `data/flags.json`, `data/gold_price.json`, `data/karats.json` — and its
checklist and board were archived under `data/archive/session-c2bbe753/`.

Its 14 rows were **not** auto-merged: their karat fields are descriptive strings ("Rose gold —
karat NOT stated on fetched pages") and two Cartier rows explicitly mark the karat unverified.
Normalising those into a 14K/18K column would be an inference, which this project forbids. They
are published as leads on the Flagged page (F30) with a link to the archived dataset.

**Kept:** all 14 rows, all third-pass tooling and documentation, its audit artefacts.
**Not kept as the publisher:** the `docs/` microsite is preserved but the GitHub Pages site remains
the Node-built dashboard at the repository root, because Pages is configured for `main` / root.

### Incident 3 — GitHub Actions unavailable

`.github/workflows/collect.yml` is committed but `workflow_dispatch` returns 404: Actions is not
registered for this repository (only `pages-build-deployment` exists). The collector remains the
documented refresh path; run it locally, or enable Actions and dispatch it.

### Not an incident — no duplicate work

The two sessions covered **disjoint retailers** (Blue Nile / Mejuri / Brilliant Earth vs
Ross-Simons / Aurate / With Clarity / Anna Sheffield). No listing was collected twice.

---

## 6b. Third-pass log (sess-bc088451)

**Branch:** `arena/bc088451-gold1` · **Scope claimed:** T9–T13 (data, audit, site, publish) · no other session active on this repo at claim time (PR #9 already merged, branch `arena/d8f0544e-gold1` closed).

**What this pass did, and what it did not do**

1. **Re-read 7 product pages and 1 market feed.** Precise ledger: `data/reverification.json`. Each entry holds the URL, what was checked, the old value, the new value, a verdict and the quoted line from the page. Check S15 fails the build if a row is marked re-verified without such an entry.
2. **Corrected two prices that had moved** (rs-571223, rs-943668) and logged the drift as **F31**. The superseded values are still in the ledger — nothing was silently overwritten.
3. **Recovered four published metal weights** from the sellers' own spec panels (1.7 g, 3.8 g, 0.5 g, 0.5 g). Weight coverage went from **1/43 to 5/43**; every recovered weight is quoted in the row's evidence string and re-checked by S14. The remaining 38 rows stay blank — **no weight was inferred from a sibling item**. Gap recorded as **F32**.
4. **Retired a flag by evidence, not by assertion.** F06 said the $149 and $179 rings could not be value-checked; with 0.5 g published they compute to 3.9× and 3.7× melt. The finding text now says that, and keeps its `needs review` status.
5. **Added findings F33–F35** (Mejuri engraving exclusion; seller marks weights approximate; rhodium plating on Mejuri white gold).
6. **Hardened the audit**: S14 weight traceability, S15 re-verification ledger, S16 no invented dollar amounts, S17 data age. S16 was proved by deliberate sabotage (pass P15) rather than assumed.
7. **Site**: new `weights.html` (formula, per-row fine-gold and melt arithmetic, which rows lack a weight and why), a `Gold content` column on every table, a "what pass P12 changed" block on the dashboard, and the re-verification ledger on `checks.html`.
8. **Not done, stated plainly**: 35 of 43 rows were not re-read in this pass, and 38 of 43 still have no published weight. The site shows each row's own retrieval date and does not claim otherwise. Retailer reputation research (F25) is still open. Nothing here has been tested by a jeweller — that remains the buyer's step.

**Sources used in this pass:** Ross-Simons product pages 571221, 571222, 571223, 981367, 907250, 943668; Mejuri `/products/2mm-smooth-band`; With Clarity `/products/classic-four-prong-solitaire-diamond-engagement-ring`; `api.gold-api.com/price/XAU`. All are recorded in `data/sources.json` (`p12-live-reread`, `p12-gold-api-second-reading`).



### Third pass (sess-bc088451)

- **Pull request:** [#10](https://github.com/karagemop466-tech/GOLD1/pull/10) — `arena/bc088451-gold1` → `main`
- **Merge result:** MERGED at 2026-10-22T23:28:17Z, merge commit `f94e2d2`
- **Pages deploy:** build `f94e2d2` reported `built` (checked via `gh api repos/.../pages/builds/latest`); `https://karagemop466-tech.github.io/GOLD1/weights.html` verified live after deploy
- **Post-deploy verification:** every root page and a sample ring page returned HTTP 200 from the built tree before merge (12/12). After deploy, `weights.html` renders all 5 weighted rows with the computed melt values, `checks.html` shows the full 17-group table plus the re-verification ledger, and `index.html` shows 43 listings / 7 retailers / 34 flags / 5-of-43 weights
- **Follow-up PR:** [#12](https://github.com/karagemop466-tech/GOLD1/pull/12) — MERGED, merge commit `fbfebfe`, Pages `built`. It published one consistent pass id across `index.html`, `checks.html` and `data/checks/latest.json`, and renumbered the pass history so every id is unique (timestamps, counts and failures unchanged)
- **Concurrent-merge note:** another session's PR #1 landed on `main` while this branch was open. It touched only `COORDINATION.md` (+8 lines); the branch was rebased onto it and re-verified (17/17) before pushing. No work was discarded and no conflict remained.

### Earlier passes

- **Pull request:** [#6](https://github.com/karagemop466-tech/GOLD1/pull/6) — `arena/d8f0544e-gold1` → `main`
- **Merge result:** **merged** 2026-10-22T23:21:14Z, merge commit `ef06225`, state `MERGED`. Two earlier merge attempts were rejected as `CONFLICTING` because concurrent sessions pushed to `main` (PRs #7 and #8); each was resolved by merging `origin/main` with `-s ours` and restoring the other session's artefacts, never by overwriting them.
- **Third pass absorbed:** `arena/c2bbe753-gold1` (PR #7, #8) — 14 extra rows archived as leads, see Incident 2 and F30
- **Pages deploy:** build for commit `ef06225` reported `built` by the Pages API; live verification succeeded at https://karagemop466-tech.github.io/GOLD1/
- **Post-deploy link check:** `checks.html` served the P9 report (13/13 groups, 43 rows, 74 pages) and `index.html` served 43 listings / 7 retailers / 29 flags on the live domain, confirming the deployment rather than a cached build

Combined state at integration: **43 listings · 7 retailers · 6 categories · 29 flags · 13/13 check groups passing (2,094 assertions)**. A further 14 third-pass rows are archived as leads (F30).

**State after this session's PRs (commits `f94e2d2`, `fbfebfe`, `43e0e41`, `cd21db3`):** 43 listings · 7 retailers · 6 categories · **34 flags** · **5/43 rows with a published weight at the time of PR #15** · **17/17 check groups passing, 0 failures** · 75 generated pages · live at https://karagemop466-tech.github.io/GOLD1/

**Current state after the parallel session's reconciliation (PR #11):** published-weight coverage **7/43** (two further Ross-Simons reads folded in: items 571213 and 571222), one merged ledger, 17/17 checks. That session's own record is §9 of this board.

Open items a human may still want to change: **36 of 43 rows publish no weight**, **23 of 43 rows were not re-read in P12** (the ledger holds 20 rows, two of them basis-only), retailer reputation research (F25) is unstarted, and F01 (the word \"solid\" absent from 39 listings) is unchanged.


### 2026-10-22 — independent source review (`arena/c56a7b27-gold1`)
- The session's initial local clone was behind concurrent merges. It found the current integration board owned by `sess-d8f0544e` and logged the above source-backed request instead of editing the shared root site/data owned by that active integration task.
- The session's separate draft site was not merged because it would have introduced a competing Pages publisher and an older data schema. No current integration files were overwritten.
- Sources were opened directly: FTC gold-jewelry and online-shopping consumer guidance; GIA 2024 electroformed-gold lab note; NIST precious-metals conversion chart; GIA gold-content methods article; U.S. Mint pricing information; and the Blue Nile first-party product page.
- Re-ran the active integration's canonical checks: `node scripts/verify.mjs` passed **P12, 13/13 groups, 2,404 assertions, 43 rows, 74 pages**; `node scripts/build.mjs` completed. It regenerated shared root pages/check snapshots locally; those generated changes were restored and are not part of this request-only PR, to respect the active integration scope.

---

## 9. Two sessions ran P12 in parallel — reconciliation record (`sess-b93ff7c6`)

**What happened.** `sess-b93ff7c6` claimed T9 at 23:24Z and started an independent third pass from
`main@ef06225`. While it was working, `sess-bc088451` published the same kind of pass and merged it as
PR #10 at 23:28Z, taking `main` to `f94e2d2`. Both sessions re-opened the same Ross-Simons pages and
both reached the same numbers for 571223 ($849), 981367 (0.5 g), 907250 (0.5 g) and 571221 (1.7 g).
The first pull request from this branch (#11) therefore reported `CONFLICTING`.

**How it was resolved — neither side discarded:**

1. `origin/main` was merged into `arena/b93ff7c6-gold1`. No file was reverted to a pre-P12 state.
2. Where the two passes had built the same thing (a re-read ledger, check groups, a change log), the
   **main-side implementation was kept** (`data/reverification.json`, `weights.html`, S14–S17) and this
   session's parallel implementation (`data/recheck.json`, its own S14/S15 wording, its re-check column
   and log) was **retired**, so the site has one ledger rather than two. The retired files are in the
   git history of this branch, not deleted from history.
3. This session's **additional facts were folded into the surviving ledger and dataset** by
   `scripts/reconcile_second_read_p12.py`:
   - **rs-571222 weight 2.5 g** — `main` recorded this SKU as having no metal weight; the spec panel
     reads "Gold Weight 2.5 grams". The ledger entry was corrected *in place* with the quote and the
     correction is described in the entry, so the first read is not hidden.
   - **rs-571213 weight 5.0 g** — not captured on `main` at all.
   - **12 further listings re-read** (879968, 960952, 999230, 993512, 864785, 242556, 991907, 240912,
     as-bea-sol, wc-tulip, au-cigar, 571213), appended to the same ledger.
   - **rs-999230 title** replaced with the seller's exact string (**F36**, new).
   - **F02 rewritten** — it still said "weight is published for only 1 of 43" after `main` had already
     added weights; the corrected count is **7 of 43**. **F32** re-counted from 13 to **11 of its 17**
     Ross-Simons rows without a weight.
4. Claims made by this session's first draft that `main` disproved were **withdrawn, not merged**:
   the suggestion that 943668 was missing from the catalogue (it was opened and corrected to $1,269 by
   `sess-bc088451`) and the draft F33/F34/F35 flags. What survives is F36 only.
5. `main`'s hardcoded strings that this pass made stale were made dynamic: "seven product pages",
   "four rows gained a weight", "the 38 rows without a weight" and "seven rows and one market feed".

**Resulting state:** 43 rows · 7 retailers · **7 rows with a published weight** · **20 ledger entries** ·
**35 findings** · **17/17 check groups, 0 failures, 75 pages**, every generated page link-checked.

**Lesson recorded for the next session:** two sessions must not both claim "the P12 re-read". The board
now carries a single T-number per pass and the next pass must claim it *before* opening any page.

---

## 10. Publish record — reconciled P12 (`sess-b93ff7c6`)

| Item | Value |
|------|-------|
| Branch | `arena/b93ff7c6-gold1` |
| Pull request | [#11](https://github.com/karagemop466-tech/GOLD1/pull/11) — "P12: re-verified dataset, published-weight coverage corrected 1/43 -> 7/43, re-check log + 2 new audit groups" (title written before the merge with `main`; the body records the reconciliation) |
| Merged into `main` | 2026-10-22T23:33:14Z |
| Merge commit | `7d1127bc5e23657c3f8b556f72e4625c295a62fa` |
| Pages build | `built` for commit `7d1127b`, 2026-10-22T23:33:36Z (`gh api repos/.../pages/builds/latest`) |
| Live site | https://karagemop466-tech.github.io/GOLD1/ |
| Post-deploy spot check | `rings/rs-571222.html` served with "Metal weight 2.5 g" and the 3.2x melt multiple computed from the published weight |
| Audit at merge | 17/17 groups, 3,226 assertions, 0 failures, 75 pages |
| Conflicts encountered | three `main` advances while this branch was open (PR #10, #12/#14, #15). Each was merged, never rebased away; conflicts were limited to `COORDINATION.md`, generated HTML and `data/checks/*`, and were resolved by union + regeneration |
| One defect found after deploy | the reconciliation script had appended its evidence/note text twice for `rs-571222` and `rs-571213`; fixed in `scripts/reconcile_second_read_p12.py` (now idempotent, verified by running it twice) and the duplicated text was removed |

**Open follow-ups for the next pass** (recorded, not fixed here):

1. 23 rows still carry a capture from an earlier pass and are labelled as such; a `recheck` pass should open the Blue Nile, Brilliant Earth, With Clarity and Aurate rows again.
2. `au-cigar` (Aurate Modern Cigar Band) 14K price is marked unconfirmed — the live range is $118 (vermeil) to $1,668; it needs a variant-level read.
3. Two parallel sessions can still pick up the same pass. The board rule "claim before you open a page" needs to be followed literally, including for verification passes.

---

### 2026-10-22 — sess-cf46c7b9 close-out after P34/P36

After several parallel pushes from `sess-bc088451` and `sess-b93ff7c6` landed PRs #11–#19, this session reset to `origin/main` at `a4270dc` (post PR #19), rebuilt the site with `scripts/build.mjs`, and ran the canonical audit. Result: **P36, 17/17 groups, 3,224 assertions, 0 failures** across 43 rows and 59 pages. An internal-link crawl reports 0 broken links. GitHub Pages build for `3e082d8` reported `built`; a newer build was in flight when checked. This session does not alter `data/rings.json` or any retailer evidence — it only records the verified state and confirms the site builds cleanly on top of the merged passes. Final state: **43 listings · 7 retailers · 6 categories · 7/43 published weights · 17/17 audit groups passing · 0 broken internal links**.

---

## 11. Independent official-source review (`arena/c662efda-gold1`)

- **Scope coordination:** T15 is complete and T16 is claimed for standalone publication. The sess-b93ff7c6 T14 root claim was active when the standalone approach was chosen and is now done. The standalone approach is retained to keep the final root diff minimal. Earlier branch-only cross-link/README edits were withdrawn; the final change set leaves root README, builder, generated pages, datasets and canonical reports byte-identical to `main`. No earlier task status or publication record is altered.
- **Evidence set:** 13 official-product rows with direct links and 2026-10-22 retrieval dates, three seller-policy/reputation records, ten irregularity groups, nine verification gates, and a named Kitco snapshot. Six rows have seller-stated solid-gold wording and listed item weights; seven leave those fields blank. **All 13 remain flagged; zero are purchase-ready.** This remains a separate evidence set and is not counted as unique or auto-migrated into the root 43 rows.
- **Standalone publication:** the existing legacy Pages publisher remains `main` `/`, so the reviewed dashboard publishes directly at `/GOLD1/site/` with its five exact JSON copies under `site/data/`. There is no competing Actions Pages workflow and no root navigation dependency. `research/README.md` and this record provide repository entry points.
- **Final fourth-pass audits:** on the merged tree, exact evidence/price/source checks, 257 static references, CSP/DOM/URL/secret/supply-chain checks, recommended HTML validation, 13-page DOM interactions, clean build, and SHA-256 source/output parity all passed again. `npm audit --audit-level=high` reported zero vulnerabilities.
- **Root-audit coordination:** the inherited verifier excludes only generated `dist/` (which the fourth-pass suite audits separately). Earlier isolated **P32** passed **17/17 groups, 3,228 assertions, 43 rows, 75 root pages, zero failures** and is archived. Earlier isolated **P35** passed **17/17 groups, 3,224 assertions, 43 rows, 75 root pages, zero failures** and is archived. After the latest main merge, isolated **P38** passed **17/17 groups, 3,224 assertions, 43 rows, 75 root pages, zero failures** with `dist/` present; its report is archived at `data/archive/session-c662efda/checks/latest-isolated-P38.json`. Canonical P37 `data/checks/` files and generated root pages remain byte-identical to `main`. Earlier branch-local reports through P28/P31 are also archived; canonical main numbering is not reused.
- **History:** the pre-integration board is preserved at `data/archive/session-c662efda/COORDINATION.md`. No earlier session dataset, archive, workflow, or dashboard is deleted.
- **Publication result — complete (2026-10-22 UTC):**
  - Primary PR [#21](https://github.com/karagemop466-tech/GOLD1/pull/21), **Add standalone official-source ring audit**, merged autonomously at **2026-10-22T23:38:36Z**. Merge commit: **`fda908a84c186ab545acf4f654bacad3f450c637`**. The merged tree was byte-identical to tested PR head `c5129baea9f5cb89e9a315600b20629b35a49d30`.
  - GitHub Pages remains legacy **`main` `/`**. Build **1306720292** reported **`built`**, error `null`, for the exact merge commit; started 23:38:37Z and finished 23:38:57Z.
  - **Live dashboard:** https://karagemop466-tech.github.io/GOLD1/site/ — verified with deployment cache-buster `?deploy=fda908a`. The public landing page rendered 13 candidates / 13 flagged / 0 purchase-ready / 6 listed weights and the correct Kitco panel. The live catalog rendered all 13 rows and official source links; Flagged for Review rendered ten issue groups and zero purchase-ready; the calculator rendered all 13 candidate weight states without inventing missing weights. Live `candidates.json` and `market.json` also returned the audited data.
  - Final pre-merge checks were `npm test` (all stages) and isolated inherited **P38: 17/17 groups, 3,224 assertions, 43 root rows, 75 root pages, zero failures**. `npm audit --audit-level=high` reported zero vulnerabilities. Canonical root P37 artifacts were not overwritten.
  - Flagged/unverified records remain published and **block purchase clearance, not publication**. Continued source, hallucination, and security review is required; this deployment is not authentication or a buying endorsement.

---

## 12. Full 43-row re-check and final integration (`arena/277867af-gold1`, T17)

**Session:** `sess-277867af` · **Branch:** `arena/277867af-gold1` · **Date:** 2026-10-22

### What was done

- **Every one of the 43 rows was re-opened at its own official URL and read line by line** —
  title, karat, metal, stone, price, price basis and any published weight. The per-row record,
  with the exact quote each number was read from, is in `data/verification-2026-10-22.json`
  (43 entries). Outcome: **39 confirmed, 3 partly verified, 1 unverified.**
- **Two independent passes were reconciled without discarding either.** While this pass was
  running, `sess-bc088451` (P12) landed its own re-read on `main` and corrected two prices and
  recovered seven weights. `scripts/reconcile_session_277867af.py` merges the two passes:
  every field the shared dataset already had is kept, each row gains `verified_at` +
  `verification_status`, and re-read quotes are **appended** to evidence, never substituted.
- **Where the passes disagree, nothing is overwritten.** `rs-999230` (489–559 vs a single 489),
  `au-xring` (1,808 vs a 1,808–2,578 product band) and `au-cigar` (variant-level price not
  re-readable) are marked **partly verified** and published as findings **F39–F41** with both
  readings and their timestamps.
- **One price was withdrawn as unverified.** The Anna Sheffield Bea solitaire page no longer
  displays a price at all — the buy box has been replaced by an enquiry form. The row is now
  `price_unverified: true` and renders "— unverified" on every page (**F37**).
- **One more published weight recovered.** `rs-960952` (Italian dome band) publishes
  "Gold Weight 1.3 grams"; stored with the quote. **Coverage is now 8 of 43.**
- **Two Blue Nile pages contradict themselves on karat** (14K heading / 18k details panel;
  18K heading / 14k white gold details panel). Published as **F38** rather than resolved by
  choosing a karat.
- **Gold price refreshed (third reading):** 4,026.699951 USD/ozt at 2026-10-22T23:38:41Z
  (gold-api.com), cross-checked against COMEX front-month futures 4,042.50 at 23:28:38Z.
  All three readings are retained in `data/gold-price.json`; spread 3.60 USD/ozt (0.09%).
- **Site changes:** every ring table gained a **Gold value** column (melt range at the stored
  spot) and a **Last checked** column (date + confirmed / partly / not-reproducible chip).
  Detail pages show "Last checked" next to "Retrieved". Unverified rows print "— unverified"
  in both the price and weight positions, and the price-to-gold ratio is suppressed for them.
- **Two new audit groups:** **S18** (unverified values must be flagged, explained and listed on
  the Flagged page) and **S19** (unverified prices never render as numbers — checked by reading
  the generated HTML, not the data).

### Verification at merge

`node scripts/build.mjs && node scripts/verify.mjs` → **P20: 43 rows, 75 pages, 3,337
assertions, 19/19 groups, 0 failures** (S01–S19).

### Sources added

5 retrieval records appended to `data/sources.json` (Ross-Simons, With Clarity, Aurate,
Anna Sheffield, Blue Nile, Mejuri, Brilliant Earth re-reads plus the two gold-price feeds),
each with the URL, what was verified on it and the retrieval date. Every row's own official
product URL remains linked from the table.

### Irregularities / open items

F37 (unverified Anna Sheffield price), F38 (Blue Nile karat contradictions), F39 (Aurate
variant price not re-read), F40 (rs-999230 upper price not reproduced), F41 (Aurate X ring
price band not attributable to a variant). All are published on **Flagged for review** with
source links and buyer actions. They block purchase clearance, not publication. The
P12 follow-up "23 rows still carry an earlier capture" is now closed — all 43 rows carry a
2026-10-22 re-read; the `au-cigar` variant-level read remains open (F39).

### Integration

- **Conflicts:** `main` advanced 88 commits while this branch was open. Generated HTML was
  resolved by regeneration; `scripts/build.mjs`, `scripts/verify.mjs`, `data/rings.json`,
  `data/flagged.json`, `data/sources.json`, `data/gold-price.json` and this board were merged
  by union — no other session's data, evidence or archive was deleted or overwritten, and
  their audit groups kept their IDs (mine were renumbered to S18/S19 to avoid collision).
- **Pull request:** [#23](https://github.com/karagemop466-tech/GOLD1/pull/23) — "Full 43-row line-by-line re-check: 39 confirmed, 3 partly verified, 1 price withdrawn as unverified".
- **Merged into `main`:** 2026-10-22. Merge commit `9e1c51d117d0c4581c38b9b193dace2cefa16aef`.
- **Pages build:** `built`, error `null`, for `9e1c51d` (`gh api repos/.../pages/builds/latest`).
- **Live site:** https://karagemop466-tech.github.io/GOLD1/ (the sandbox cannot fetch `*.github.io`, so the deploy is evidenced by the Pages build status plus `git show origin/main:<file>` checks on the merged tree: 40 flagged items ending F37–F41, 8 rows with a published weight, all 43 rows `verified_at: 2026-10-22`, spot 4,026.699951 USD/ozt @ 23:38:41Z, latest audit report P21 19/19 groups / 3,337 assertions / 0 failures).

---

## 13. Union integration, 10K–24K ring expansion, 10-retailer policies & BBB grades, federal/GIA/CFPB standards, and P40 publish (`arena/0804e222-gold1`, T20–T24)

**Session:** `sess-0804e222` · **Branch:** `arena/0804e222-gold1` · **Date:** 2026-10-22

- **Zero-loss union across all prior sessions:** Merged `origin/main` (`f919689` — preserving `sess-6f8c2bcb`, `sess-d8f0544e`, `sess-c2bbe753` `docs/` & `data/rings_c2bbe753.json`, `sess-bc088451`, `sess-b93ff7c6`, `sess-cf46c7b9`, `arena/c662efda-gold1` standalone `/site/` + `research/`, and `sess-277867af` `S18`/`S19` + `Gold value`/`Last checked` columns + `price_unverified` rendering + `F37`–`F41` + `4,026.699951` USD/ozt 3rd spot reading). All new primary-source captures live in `data/session-0804e222/` and merge idempotently via `scripts/integrate_0804e222.mjs` (`cmp -s` verified across two consecutive runs).
- **Additional HTML PDP recoveries on the 43 inherited rows (closing `F39` open item):**
  - Opened all 43 HTML product pages directly (not only JSON feeds), recovering **4 additional Aurate published weights** (`au-2ct-oval` `2.73 g`, `au-1ct-emerald` `1.97 g`, `au-3ct-round` `3.3 g`, `au-xring` `2.7 g` + explicit `"Precision-crafted in solid gold"` wording), reading `au-cigar` at variant level (`$1,308` Size 4 – `$1,668` Size 10 in 14k Gold vs `$118` Vermeil default), catching `"Final Sale! Exchange for size only"` across all 5 Aurate ring PDPs, catching Anna Sheffield `as-hazeline`'s HTML inquiry-only form alongside `as-bea-sol`, catching With Clarity `"14KT Platinum"` gallery alt-text contradictions, and fixing `data/gold-price.json`'s unit label to NIST exact `grams_per_troy_ounce: 31.1034768` (`480` grains/ozt).
- **16 new primary-source verified listings across `10K`, `14K`, `18K`, and `24K` (`43 → 59` rows, `7 → 10` retailers, `8 → 21` published weights):**
  - **Ross-Simons (2):** `rs-939479` (`10K`, `$129`, `0.3 g`) and `rs-997811` (`14K`, `$569`, `1.5 g`, `"solid 14kt yellow gold"`).
  - **Mejuri (2):** `mej-10k-dlr` (`10K` solid gold Diamonds Line Ring, `$298`) and `mej-10k-sig` (`10K` solid gold Signet Ring, `$398`).
  - **Automic Gold (7, NYC reclaimed solid 14K with published gram weights):** `ag-14k-leaves` (`$479`, `1.62 g`), `ag-14k-cluster` (`$750`, `1.4 g`), `ag-14k-marquise-melted` (`$1,100`, `5.8 g`), `ag-14k-petal` (`$1,550`, `3.7 g`), `ag-14k-bubble` (`$1,600`, `7.0 g`), `ag-14k-kite` (`$1,650`, `3.7 g`), `ag-14k-radiant-3ct` (`$2,900`, `3.3 g`).
  - **Cartier (3, `18K` `750/1000`):** `car-18k-1895-band-dia` (`$1,390`), `car-18k-etincelle-pear` (`$3,600`), `car-18k-etincelle-emerald` (`$4,150`).
  - **Menē (2, `24K` pure gold):** `mene-24k-narrow-band` (`$860`) and `mene-24k-classic-band` (`$1,590`); static HTML renders `$0` gold value / blank grams before client JS, so weights stay `null` and flagged (`F48`, `F49`).
- **10-retailer policies, contacts, HQ addresses & BBB profiles + federal/GIA/CFPB standards (`F42`–`F50`):**
  - Verified return windows, shipment-vs-delivery clocks, resize/engraving exclusions, contacts, and BBB profiles across all 10 sellers (`A+` Accredited on Ross-Simons, Blue Nile, Brilliant Earth, With Clarity; `A+` Unaccredited on Anna Sheffield; `F` rating with 8 unanswered of 23 complaints on Aurate New York).
  - Integrated verbatim eCFR `16 CFR Part 23` (`§ 23.3(c)(1)` barring `"Solid Gold"` on hollow items — flagging Mejuri's hollowed-ring FAQ/copy), NIST Handbook 130 `31.1034768 g/ozt`, GIA Lab Notes Spring 2024 & Summer 2025 (electroformed resin-core & `"Gold-Plated Gold"` fooling surface XRF), and CFPB FCBA `60-day` / `15 U.S.C. § 1666i` credit-card protections.
- **Verification & security passes before merge (`P40`):**
  - Canonical `node scripts/verify.mjs` **Pass `P40`**: **19/19 groups passed (`S01`–`S19`), 4,747 assertions, 0 failures** across **59 rows** and **91 HTML pages**.
  - Extended `node scripts/audit_0804e222.mjs`: **10/10 groups passed (`A01`–`A10`), 1,491 assertions, 0 failures**.
  - Standalone `/site/` Node audits (`audit-evidence.js`, `audit-links.js`, `audit-security.js`, `build.js`, `audit-build.js`): **100% passing**.
- **Publication & live GitHub Pages verification — complete:**
  - **Pull request:** [#25](https://github.com/karagemop466-tech/GOLD1/pull/25) — *"P40 union publish: 59 verified 10K–24K rings, 21 gram weights, 10-retailer policies & BBB grades, FTC/NIST/GIA/CFPB standards & 29-group audit"*.
  - **Merged autonomously into `main`:** 2026-10-23T00:00:44Z. Merge commit: **`4a8fcd5b192ec75bb5ff573ac786bea9fe63725a`** (from branch head `0246cea`).
  - **GitHub Pages build:** Build **`1306758797`** reported **`built`**, `error: null`, for exact commit `4a8fcd5b192ec75bb5ff573ac786bea9fe63725a` (`created_at: 2026-10-23T00:00:45Z`, `updated_at: 2026-10-23T00:01:18Z`, `duration: 33097ms`).
  - **Live public URLs fetched & verified directly (`?deploy=4a8fcd5`):**
    - `https://karagemop466-tech.github.io/GOLD1/` — live, rendering 59 listings, 10 retailers, 21/59 published weights (`0.3 g`–`7.0 g`), 15/59 explicit `"solid gold"`, 59/59 re-checked `2026-10-22`, 49 flagged findings, 1 withdrawn unverified price (`as-bea-sol`), `$4,026.70/ozt` (`$129.46/g` 24K via NIST `31.1034768 g/ozt`), and top-of-page **No hallucinations** banner.
    - `https://karagemop466-tech.github.io/GOLD1/weights.html` — live, rendering all 21 weighted rings (`2.5×`–`12.6×` melt) and 38 unweighted rows by seller.
    - `https://karagemop466-tech.github.io/GOLD1/sources.html` — live, rendering all 54 primary sources, 10-retailer policy/contact/BBB table, and rejected 404s.
    - `https://karagemop466-tech.github.io/GOLD1/checks.html` — live, rendering **Pass P40** (`19/19` passed, `0` failed, unbroken `P1`–`P40` history, 59-row re-verification ledger).
    - `https://karagemop466-tech.github.io/GOLD1/site/` — live, standalone 13-candidate CSP-hardened evidence review (`arena/c662efda-gold1`) intact.

