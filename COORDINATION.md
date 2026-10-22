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

### Merge 1 — PR #2 (dataset + site)

| Field | Value |
|---|---|
| PR | https://github.com/karagemop466-tech/GOLD1/pull/2 |
| Title | Verified gold engagement ring dataset + dashboard site (13 listings, 15 flags, 1,761-check audit) |
| Merged at (UTC) | 2026-10-22T23:14:47Z |
| Merge commit | `6b3f48918d195630dfd52cfb87cc578ea7783862` |
| Method | merge commit (no squash), merged without waiting for approval per project instruction |
| Result | success — `main` fast-forwarded to the merge commit |

**Verification performed by the integration session before merging (T11):**
- `python3 tools/verify_data.py` → PASS: 13 rows, 15 flags, 13 sources, 1,761 assertions, 0 errors, 0 warnings.
- Rows unchanged since collection in this same session; every source page was fetched live on 2026-10-22 and each row stores its own `checked_on` date.
- `python3 tools/build_site.py` → 7 pages generated; internal link/anchor check PASS; 22 external links, all on approved hosts.
- All pages, assets and data downloads returned HTTP 200 from a local static server.
- No merge conflicts. No competing claims on this board during the run, so no handoff was needed.

### Publication issue found after merge 1

- GitHub Pages was already enabled with **source: `main` / (repository root)**, and the site had
  been generated into `docs/`. Pointing Pages at `/docs` was attempted with
  `gh api -X PUT .../pages` and **failed with HTTP 403 “Resource not accessible by integration”** —
  the available token has no Pages-administration scope.
- Fix (no admin rights required): the generator now writes the seven pages plus `assets/` and
  `.nojekyll` to the **repository root**, which is exactly where the existing Pages source serves
  from. `docs/` was deleted so there is one copy of the site, not two. Builds only ever delete and
  rewrite their own generated files.
- Follow-up PR carried this change plus this record.

### Merge 2 — PR #3 (republish from the repo root)

| Field | Value |
|---|---|
| PR | https://github.com/karagemop466-tech/GOLD1/pull/3 |
| Merged at (UTC) | 2026-10-22T23:15:46Z |
| Merge commit | `3d0c9bff8bd980b0f222357f980e50b78aa7906e` |
| Method | merge commit, no approval wait |
| Result | success |

### Deploy record

| Field | Value |
|---|---|
| Pages URL | https://karagemop466-tech.github.io/GOLD1/ |
| Pages source | branch `main`, path `/` (pre-existing setting — unchanged, because the token cannot write Pages settings: HTTP 403) |
| Build status after merge 2 | **built** (`gh api .../pages` → `status: built`; build log entry `built`, no error message) |
| Live checks | `/` returned the dashboard, `/flagged.html` returned all 15 flags, both with the expected titles and content |
| Broken internal links after deploy | none — the generator's link/anchor check passed over 7 pages and 22 approved external links |

### Final integration pass (PR #4)

- Re-ran the audit and the build after the root publication change: PASS / PASS.
- Refined flag links so each affected row opens the page that owns it (`BN-`/`BE-` → solitaire,
  `MEJ-` → bands, `RET-` → retailers) instead of always the overview.
- Re-verified that the published tree on `main` is byte-identical to the generated output, so no
  hand edit can drift from the dataset.
- No merge conflicts in this run; no other session claimed work while this session was active, so
  no handoff or conflict resolution was required.
