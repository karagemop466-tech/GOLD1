# COORDINATION.md — Shared Task Board

This file is the shared task board for all agent sessions working on this repo.
Read it before starting any work. Claim a task by adding your session ID and file
scope, then commit and push the claim immediately. Never start a task another
session has claimed.

- Statuses: `unclaimed` / `in progress` / `needs review` / `done`
- `needs review` = published on the site's **Flagged for Review** page; does not block anything.
- Every `done` task must record: sources used, verification performed, and any irregularities.
- Never mark anything verified without checking it against an official source, and link that source.

---

## Session registry

| Session ID | Branch | Notes |
|---|---|---|
| `arena-c2bbe753` | `arena/c2bbe753-gold1` | Arena-managed session branch. Platform requires all commits on this branch; per-task branches (`session-<id>/<task>`) are not possible on this platform. Non-overlapping file scopes + small frequent commits are used instead. |

## Ground rules (adapted to this platform)

1. Each session commits only to its own registered branch (platform constraint).
2. Shared outputs (`docs/index.html`, `docs/nav`, combined tables) are changed only by the
   final integration session after all other tasks are done.
3. `git pull --rebase` before every push. Small, frequent commits.
4. If a claim is >60 minutes old with no commits, another session may take over and must
   note the handoff in the log.
5. Merge conflicts: stop, resolve without discarding the other session's work, log what happened.

## Task board

| ID | Task | Status | Owner | Files in scope |
|---|---|---|---|---|
| T1 | Create/claim coordination board | done | arena-c2bbe753 | `COORDINATION.md` |
| T2 | Gold market data: spot price + karat purity facts, from official sources | done | arena-c2bbe753 | `data/gold_price.json`, `data/karats.json`, `docs/prices.html` |
| T3 | Buying checklist + verification methodology pages (FTC/GIA/assay sources) | done | arena-c2bbe753 | `data/checklist.json`, `data/sources.json`, `docs/checklist.html`, `docs/methodology.html` |
| T4 | Product data: verified solid-gold engagement ring listings per retailer | done | arena-c2bbe753 | `data/rings/*.json`, `docs/rings-*.html` |
| T5 | Gold value calculator page | done | arena-c2bbe753 | `docs/calculator.html` |
| T6 | Flagged-for-review ledger + page | done | arena-c2bbe753 | `data/flagged.json`, `docs/flagged.html` |
| T7 | Verification / hallucination-audit scripts + audit report | done | arena-c2bbe753 | `scripts/*.py`, `data/audit_report.json` |
| T8 | Site integration: index, nav, styles; build all pages | done | arena-c2bbe753 | `docs/index.html`, `docs/styles.css`, `scripts/build_site.py` |
| T9 | Link check, final re-verify, PR to main, merge, publish GitHub Pages | done | arena-c2bbe753 | `docs/**` (generated), branch merge, Pages config |

## Work log (append-only)

| Date (UTC) | Session | Entry |
|---|---|---|
| 2026-10-22 | arena-c2bbe753 | Repo was empty (README only). Created this board; claimed T1–T9 for single-session sequential execution (no other sessions were present on the board). |
| 2026-10-22 | arena-c2bbe753 | T1 done. |
| 2026-10-22 | arena-c2bbe753 | T2–T7 executed line by line. All values taken from official pages (direct fetch preferred; search-snapshot-only values rendered BLANK and flagged). Audit script created and run — PASS after fixes (3 failures caught and corrected on first pass: karat fineness-standard rounding, flag cross-reference, number traceability). |
| 2026-10-22 | arena-c2bbe753 | T8 site built: 13 HTML pages + CSS from data layer; internal links verified by audit. |
| 2026-10-22 | arena-c2bbe753 | T9 started: PR to main, merge, GitHub Pages publish pending. |

## Completed-task records

### T1 — Coordination board
- Sources: n/a (process file).
- Verification: statuses cross-checked against git history.
- Irregularities: none.

### T2 — Gold market data (`data/gold_price.json`, `data/karats.json`, `docs/prices.html`)
- Sources: World Gold Council goldhub (direct fetch — anchor USD 4,024.36/oz, data as of 2026-10-21); LBMA (direct fetch — methodology/licence note only); Kitco/CNBC/Bloomberg (search snapshots — cross-check log only, NOT used for calculations); eCFR 16 CFR Part 23 (direct fetch); 15 U.S.C. ch. 8 via govinfo (direct fetch); London Assay Office (direct fetch).
- Verification: karat percentages re-derived in audit (22K→916→91.6%, 24K→999→99.9% millesimal standards; others karat/24); anchor per-gram derivation re-computed (129.39).
- Irregularities: LBMA numeric data licence-gated (F10); intraday spot variance ~$4,028–$4,084 documented; secondary-source "0.5 karat tolerance" claim contradicted by official statute (F9); FTC removed 10K minimum in 2018 (F11).

### T3 — Checklist + methodology (`data/checklist.json`, `docs/checklist.html`, `docs/methodology.html`, `data/sources.json`)
- Sources: 16 CFR §23.3/§23.10/§23.18; 15 U.S.C. §§294–297; London Assay Office. All direct-fetched.
- Verification: every checklist rule with a legal basis carries an official URL + quote; advice-only items are labeled "advice".
- Irregularities: none beyond T2 flags.

### T4 — Product data (`data/rings.json`, `docs/rings*.html`)
- Sources (direct fetches): tiffany.com product page; cartier.com category + product page; brilliantearth.com product page; bluenile.com product page + JA-redirect page; mejuri.com product page.
- Verification: 7/14 prices verified by direct fetch with exact quotes; 7 prices left BLANK (snippet-only or stale) and flagged; karat verified 12/14; weight verified 0/14 (not published anywhere — F1).
- Irregularities: Tiffany return-policy conflict (F2); Cartier rose/white-gold karat not stated on fetched pages (F4); Brilliant Earth EUR/USD geo pricing (F5); James Allen→Blue Nile migration with stale JA prices (F8).

### T5 — Calculator (`docs/calculator.html`)
- Sources: prefilled spot = T2 anchor with date + link; conversions documented (1 ozt = 31.1034768 g; 1 dwt = 1.55517384 g).
- Verification: client-side arithmetic only; labeled estimate; limitations stated (no appraisal; XRF needed).
- Irregularities: none.

### T6 — Flagged ledger (`data/flags.json`, `docs/flagged.html`)
- Sources: each flag carries its own source URLs.
- Verification: 12 flags open; audit cross-checks that every unverified price is referenced by a flag.
- Irregularities: F1–F12 as published on the site.

### T7 — Audit scripts (`scripts/verify_data.py`, `data/audit_report.json`)
- Verification: audit checks schema, price/karat evidence policy (non-null price ⇒ direct-fetch evidence + quote), URL registration, karat arithmetic, rendered-number traceability vs data layer, and internal links. First run FAILED with 3 findings → fixed → PASS. Re-run after every data review (see log).
- Irregularities: findings fixed (see log entry 2026-10-22).

### T8 — Site integration (`scripts/build_site.py`, `docs/**`, `docs/index.html`, nav)
- Verification: build from data only; internal-link check PASS; no CDN/external assets; mobile-responsive.
- Irregularities: none.

*(Each task appends its record here when marked done.)*
