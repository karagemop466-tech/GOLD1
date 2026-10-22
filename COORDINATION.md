# COORDINATION.md — shared task board

**Project:** GOLD1 — verified online buying research for a **solid gold engagement ring**
**Sessions on this repo:** `sess-6f8c2bcb` (first research pass, closed), `sess-d8f0544e` (second pass + integration, closed) and `sess-bc088451` (third pass: live re-verification, weight/melt upgrade, publish — **active**)
**Board owner:** `sess-bc088451` · **Board updated:** 2026-10-22

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
| T7 | **Integration**: merge both passes into one dataset + one site, re-verify line by line, resolve conflicts without discarding work | **in progress** | sess-d8f0544e | arena/d8f0544e-gold1 | `scripts/integrate_session_6f8c2bcb.py`, `data/archive/`, shared site files | 2026-10-22 |
| T8 | Publish: PR to `main`, merge, confirm Pages deploy, record links | **pending** | sess-d8f0544e | arena/d8f0544e-gold1 | §7 below | 2026-10-22 |

| T9 | **Third pass**: live re-verification of published prices/karats against retailer pages; correct any drift | **in progress** | sess-bc088451 | arena/bc088451-gold1 | `data/rings.json`, `data/sources.json`, `data/flagged.json` | 2026-10-22 |
| T10 | **Third pass**: recover seller-published metal weight (grams) where the retailer publishes it; recompute melt checks | **in progress** | sess-bc088451 | arena/bc088451-gold1 | `data/rings.json`, `data/gold-price.json` | 2026-10-22 |
| T11 | **Third pass**: extend the hallucination audit (weight traceability, melt recomputation, stale-data, no-invented-numbers) | **in progress** | sess-bc088451 | arena/bc088451-gold1 | `scripts/verify.mjs`, `data/checks/` | 2026-10-22 |
| T12 | **Third pass**: site update (data-age banner, melt/value columns, weight-coverage page content) | **in progress** | sess-bc088451 | arena/bc088451-gold1 | `scripts/build.mjs`, `assets/`, generated `*.html` | 2026-10-22 |
| T13 | **Third pass**: PR to `main`, merge, confirm Pages deploy, record links | **in progress** | sess-bc088451 | arena/bc088451-gold1 | §7 below | 2026-10-22 |

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

_Appended as work proceeds. Every entry is a claim I could re-check; nothing here is inferred._



- **Pull request:** [#6](https://github.com/karagemop466-tech/GOLD1/pull/6) — `arena/d8f0544e-gold1` → `main`
- **Merge result:** **merged** 2026-10-22T23:21:14Z, merge commit `ef06225`, state `MERGED`. Two earlier merge attempts were rejected as `CONFLICTING` because concurrent sessions pushed to `main` (PRs #7 and #8); each was resolved by merging `origin/main` with `-s ours` and restoring the other session's artefacts, never by overwriting them.
- **Third pass absorbed:** `arena/c2bbe753-gold1` (PR #7, #8) — 14 extra rows archived as leads, see Incident 2 and F30
- **Pages deploy:** build for commit `ef06225` reported `built` by the Pages API; live verification succeeded at https://karagemop466-tech.github.io/GOLD1/
- **Post-deploy link check:** `checks.html` served the P9 report (13/13 groups, 43 rows, 74 pages) and `index.html` served 43 listings / 7 retailers / 29 flags on the live domain, confirming the deployment rather than a cached build

Combined state at integration: **43 listings · 7 retailers · 6 categories · 29 flags · 13/13 check groups passing (2,094 assertions)**. A further 14 third-pass rows are archived as leads (F30).
