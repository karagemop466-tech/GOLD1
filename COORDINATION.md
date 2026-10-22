# COORDINATION.md — shared task board

**Project:** GOLD1 — verified online buying research for a **solid gold engagement ring**
**Board owner:** session `sess-d8f0544e` (Arena branch `arena/d8f0544e-gold1`)
**Board updated:** 2026-10-22 (final integration)

---

## 0. How to use this board

1. Read this file **before** starting any task.
2. Claim a task by writing your session ID, branch, and file scope in the row, then **commit and push the claim immediately**.
3. Never start a task another session has claimed and not released.
4. Keep scopes non-overlapping. If a task needs a file owned by another session, log a *Request* in §5 instead of editing the file.
5. Make small, frequent commits; `git pull --rebase` before every push.
6. A claim older than 60 minutes with no commits may be taken over — record the handoff in §6.
7. Shared outputs (the table data, the site index and navigation) are changed only by the final integration session.
8. Never mark anything verified without an official source link.

### Branch naming note (Arena sessions)

The generic protocol asks for branches named `session-<id>/<task>`. Arena fixes the branch name of an
interactive session, so this session worked on `arena/d8f0544e-gold1` and mapped every task to it. The
constraints that matter — one session per scope, one branch per session, no cross-session edits — were kept.

### Concurrency check

At the start of the session `git branch -a` showed only `main` and `arena/d8f0544e-gold1`, and the
repository contained a single commit (`2820cba`) with one file (`README.md`). No other session had a claim,
a branch, or uncommitted work. This session therefore claimed all tasks and recorded that claim in commit
`c3c552f`. No conflicts occurred and no handoff was needed.

---

## 1. Task board

| ID | Task | Status | Owner (session) | Branch | File scope | Updated |
|----|------|--------|-----------------|--------|-----------|---------|
| T1 | Primary-source evidence collection (official product feeds, policy pages, gold price, regulator text) | **done** | sess-d8f0544e | arena/d8f0544e-gold1 | `scripts/collect.mjs`, `data/collect/`, `data/raw/`, `.github/workflows/collect.yml` | 2026-10-22 |
| T2 | Curate verified ring rows + source registry + flagged items | **done** | sess-d8f0544e | arena/d8f0544e-gold1 | `data/rings.json`, `data/sources.json`, `data/flagged.json`, `data/retailers.json`, `data/gold-price.json`, `data/checklist.json` | 2026-10-22 |
| T3 | Site build (landing dashboard, category pages, table, calculator, sources, flagged) | **done** | sess-d8f0544e | arena/d8f0544e-gold1 | `assets/`, root `*.html`, `categories/`, `rings/`, `scripts/build.mjs` | 2026-10-22 |
| T4 | Verification + anti-hallucination checks | **done** | sess-d8f0544e | arena/d8f0544e-gold1 | `scripts/verify.mjs`, `data/checks/` | 2026-10-22 |
| T5 | Documentation (README, methodology, checklist) | **done** | sess-d8f0544e | arena/d8f0544e-gold1 | `README.md`, `methodology.html`, `checklist.html` | 2026-10-22 |
| T6 | Integration: re-verify combined data, confirm build + no broken links, publish Pages, PR | **in progress** | sess-d8f0544e | arena/d8f0544e-gold1 | root config, §7 below | 2026-10-22 |

Status values: `unclaimed`, `in progress`, `done`, `needs review`.
`needs review` = published on the Flagged for Review page; it never blocks a merge.

---

## 2. Ground rules for this project (agreed requirements)

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
| 2026-10-22 | sess-d8f0544e | Repo baseline: single commit `2820cba`, only `README.md`; no other session branches or claims | `git log`, `git branch -a`, `gh api repos/.../pages` | clean baseline |
| 2026-10-22 | sess-d8f0544e | GitHub Pages already enabled: source `main`, path `/`, HTTPS enforced, URL `https://karagemop466-tech.github.io/GOLD1/` | `gh api repos/karagemop466-tech/GOLD1/pages` | publish target confirmed |
| 2026-10-22 | sess-d8f0544e | Sandbox has no direct outbound access to retailer domains; GitHub Actions workflow dispatch returns 404 (only the internal Pages workflow is registered) | `curl` probes; `gh workflow run collect.yml --ref arena/d8f0544e-gold1` | collection done by direct retrieval instead; collector kept as refresh path |
| 2026-10-22 | sess-d8f0544e | Ross-Simons prices, karats, product titles | Official feeds: `/collections/jewelry-rings-gold/products.json`, `/search/suggest.json?q=14kt gold band`, `?q=diamond engagement ring 14kt`, `?q=estate 14kt gold ring` | 17 rows sourced |
| 2026-10-22 | sess-d8f0544e | With Clarity setting prices and the "Ring Setting Product" tag | Official search feed `/search/suggest.json?q=solitaire`, `?q=sapphire engagement ring` | 5 rows sourced, all labelled setting-only |
| 2026-10-22 | sess-d8f0544e | Anna Sheffield prices, 14k recycled gold statements, stone specs | Official search feed `/search/suggest.json?q=engagement ring`, `?q=solitaire engagement ring` | 3 rows sourced |
| 2026-10-22 | sess-d8f0544e | Aurate prices, published weight, vermeil-vs-solid trap | Official search feed `/search/suggest.json?q=engagement ring`, `?q=14k gold band` | 5 rows sourced; vermeil variant flagged |
| 2026-10-22 | sess-d8f0544e | Ross-Simons return terms and contact details | `/policies/refund-policy` (official) | 30 days; resized-by-another-jeweler exclusion; phone 800-835-0919 |
| 2026-10-22 | sess-d8f0544e | Aurate return terms and contact details | `/policies/refund-policy` (official) | 14 days US; engraved/international final; care@auratenewyork.com |
| 2026-10-22 | sess-d8f0544e | With Clarity return terms | `/policies/refund-policy` (official) | 30 days; resize/repair by another jeweller voids return; $250 certificate fee |
| 2026-10-22 | sess-d8f0544e | Anna Sheffield return terms and contact details | `/policies/refund-policy` (official) | Two weeks; 10% restocking fee (max $500); engraved/bespoke final; info@annasheffield.com |
| 2026-10-22 | sess-d8f0544e | Gold price | `https://api.gold-api.com/price/XAU` → 4,028.100098 USD/ozt at 2026-10-22T23:01:42Z; COMEX GC=F 4,043.00 cross-check | stored with publisher timestamp |
| 2026-10-22 | sess-d8f0544e | US gold-marking rules exist and are current | eCFR 16 CFR Part 23, up to date as of 2026-10-21; § 23.3, § 23.4, § 23.10, § 23.18 headings read | cited, body text not quoted |
| 2026-10-22 | sess-d8f0544e | Automated audit of all 30 rows and 45 generated pages | `node scripts/verify.mjs` passes P1–P3 | 13/13 groups pass, 1,557 assertions, 0 failures |

### Rejected sources (recorded so they are not silently reused)

| Source | Why rejected |
|--------|--------------|
| `ftc.gov/business-guidance/resources/gold-silver-jewelry-industry-guide` | Returned 404 on 2026-10-22 |
| `prices.lbma.org.uk/json/gold_pm.json` | HTTP 500 on 2026-10-22 |
| `bluenile.com/engagement-rings/solitaire` | Returned 404, so no Blue Nile row was created |
| Set & Stones engagement-ring search | Results were gold-filled; fails the solid-gold rule |

---

## 5. Requests between sessions

_None._

---

## 6. Handoffs / incidents

- **Actions unavailable.** `.github/workflows/collect.yml` is committed but `workflow_dispatch` returns 404 because GitHub Actions is not registered for this repository (only `pages-build-deployment` exists). The collector remains the documented refresh path; run it locally, or enable Actions and dispatch it.
- **No merge conflicts** occurred: a single session owned every scope, and the claim was pushed before any file was written.

---

## 7. Integration record (PR, merge, deploy)

To be completed by the final integration session after the pull request is merged and Pages redeploys:

- Pull request: _pending_
- Merge result: _pending_
- Pages deploy: _pending_
- Post-deploy link check: _pending_
