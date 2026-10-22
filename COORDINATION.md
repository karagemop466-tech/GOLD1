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

## Completed-task records

### T1 — Coordination board
- Sources: n/a (process file).
- Verification: statuses cross-checked against git history.
- Irregularities: none.

*(Each task appends its record here when marked done.)*
