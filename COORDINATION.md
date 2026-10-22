# COORDINATION — shared task board

**Purpose.** Multiple agent sessions may work in this repo at the same time. This file is the
single shared task board. Read it before starting work; claim a task by writing your session ID
and file scope here, then commit and push the claim immediately. Never start a task another
session has claimed.

**Branch/worktree convention.** Each session works on its own branch named `session-<id>/<task>`
(or, where the platform pins the branch, on its assigned session branch) and edits only files in
its claimed scope. Shared outputs (`data/rings.json`, the site navigation and `index.html`) are
changed only by a final integration session.

**Handoff rule.** If a claim is more than 60 minutes old with no commits, any session may take the
task over and must note the handoff in the log below.

**Status vocabulary.** `unclaimed` · `in progress` · `done` · `needs review`.
`needs review` means the item is published on the **Flagged for Review** page and does not block
anything.

---

## Current session

| Field | Value |
|---|---|
| Session ID | `arena-6f8c2bcb-gold1` |
| Branch | `arena/6f8c2bcb-gold1` (platform-pinned session branch — not renamed) |
| Started (UTC) | 2026-10-22 |
| Role in this run | collector **and** final integration session (single session active) |

Because only one session is active in this run, this session claims the collector tasks and then
performs the integration itself, recording both steps below. Scopes are kept non-overlapping at
file granularity so a second session can take any single scope without collisions.

---

## Task board

| ID | Task | Status | Owner (session) | Files in scope | Notes |
|---|---|---|---|---|---|
| T1 | Coordination board + no-hallucination policy | done | `arena-6f8c2bcb-gold1` | `COORDINATION.md`, `README.md` | CLAIMED 2026-10-22 |
| T2 | Regulatory/legal source pack (FTC / eCFR / Stamping Act) | done | `arena-6f8c2bcb-gold1` | `data/sources.json` | CLAIMED 2026-10-22 |
| T3 | Spot gold reference record | done | `arena-6f8c2bcb-gold1` | `data/spot-gold.json` | CLAIMED 2026-10-22 |
| T4 | Blue Nile listing collection (14K/18K yellow-gold solitaire settings) | done | `arena-6f8c2bcb-gold1` | `data/rings.json` (`BN-*` rows) | CLAIMED 2026-10-22 |
| T5 | Mejuri + Brilliant Earth collection (14K solid gold bands, 18K setting) | done | `arena-6f8c2bcb-gold1` | `data/rings.json` (`MEJ-*`, `BE-*` rows) | CLAIMED 2026-10-22 |
| T6 | Retailer policy/contact vetting | done | `arena-6f8c2bcb-gold1` | `data/rings.json` (`retailers`) | CLAIMED 2026-10-22 |
| T7 | Verification tooling (schema + source + price + flag passes) | done | `arena-6f8c2bcb-gold1` | `tools/verify_data.py` | CLAIMED 2026-10-22 |
| T8 | Static site generator + link check | done | `arena-6f8c2bcb-gold1` | `tools/build_site.py`, `site/` | CLAIMED 2026-10-22 |
| T9 | Gold-value calculator | done | `arena-6f8c2bcb-gold1` | `site/assets/calculator.js`, `site/calculator.html` | CLAIMED 2026-10-22 |
| T10 | Flagged-for-review page | done | `arena-6f8c2bcb-gold1` | `site/flagged.html` (generated) | CLAIMED 2026-10-22 |
| T11 | Integration: merge, re-verify combined data, publish | **in progress** | `arena-6f8c2bcb-gold1` | `main` (via PR), `COORDINATION.md` | CLAIMED 2026-10-22 — integration session took over after T1–T10 landed on the session branch (single active session, so no competing claims) |

---

## Log

### 2026-10-22 — `arena-6f8c2bcb-gold1`
- Read repo: single `README.md`, no prior data, no prior coordination file. Created this board.
- Claimed T1–T11 in one batch (single active session). Each task has a disjoint file scope.
- **Sources used** (all fetched live on 2026-10-22; see `data/sources.json` for the full registry):
  - `bluenile.com` category listing + 3 individual product pages
  - `mejuri.com` 4 individual product pages
  - `brilliantearth.com` 1 individual product page
  - `goldprice.org` live spot quote (timestamp recorded)
  - `ecfr.gov` 16 CFR Part 23, `federalregister.gov` 2018 final Guides, `ftc.gov` (see registry)
- **Verification performed:** every price in `data/rings.json` was read from the official page in
  this session; no price was taken from a search-result snippet. Two snippet-vs-page discrepancies
  were found and are published as flagged items (F-02, F-03).
- **Irregularities:** see `site/flagged.html` (generated from `data/rings.json → flags`). None block
  publication; all are published with source links for human review.

### 2026-10-22 — integration pass (same session)
- Re-ran `tools/verify_data.py` and `tools/build_site.py` on the combined tree; internal link check
  must pass before the PR is opened.
- PR/merge result recorded at the end of this file after the merge.

---

## Integration record

_(filled in after the merge — see bottom of file)_
