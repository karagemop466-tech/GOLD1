# COORDINATION.md — shared task board

**Project:** GOLD1 — verified online buying research for a **solid gold engagement ring**
**Board owner:** session `sess-d8f0544e` (Arena branch `arena/d8f0544e-gold1`)
**Board updated:** 2026-10-22

---

## 0. How to use this board

1. Read this file **before** starting any task.
2. Claim a task by writing your session ID, branch, and file scope in the row, then
   **commit and push the claim immediately**.
3. Never start a task another session has claimed and not released.
4. Keep scopes non-overlapping. If a task needs a file owned by another session,
   log a *Request* in §5 instead of editing the file.
5. Make small, frequent commits; `git pull --rebase` before every push.
6. A claim older than 60 minutes with no commits may be taken over — record the
   handoff in §6.
7. Shared outputs (the table data, the site index and navigation) are changed only
   by the final integration session.
8. Never mark anything verified without an official source link.

### Branch naming note (Arena sessions)

The generic protocol asks for branches named `session-<id>/<task>`. Arena fixes the
branch name of an interactive session, so this session works on
`arena/d8f0544e-gold1` and maps tasks to it in the table below. The constraint that
matters — one session per scope, one branch per session, no cross-session edits — is
preserved.

---

## 1. Task board

| ID | Task | Status | Owner (session) | Branch | File scope | Updated |
|----|------|--------|-----------------|--------|-----------|---------|
| T1 | Primary-source evidence collection (official product feeds, policy pages, gold price, regulator text) | **in progress** | sess-d8f0544e | arena/d8f0544e-gold1 | `scripts/collect.mjs`, `data/collect/`, `data/raw/`, `.github/workflows/collect.yml` | 2026-10-22 |
| T2 | Curate verified ring rows + source registry + flagged items | unclaimed | — | — | `data/rings.json`, `data/sources.json`, `data/flagged.json` | — |
| T3 | Site build (landing dashboard, category pages, table, calculator, sources, flagged) | unclaimed | — | — | `site/`, `assets/`, root `*.html`, `scripts/build.mjs` | — |
| T4 | Verification + anti-hallucination checks (schema, provenance, arithmetic, internal links) | unclaimed | — | — | `scripts/verify.mjs`, `data/checks/` | — |
| T5 | Documentation (README, methodology, checklist) | unclaimed | — | — | `README.md`, `docs/` | — |
| T6 | Integration: merge, re-verify combined data, confirm build + no broken links, publish Pages, PR | unclaimed | — | — | root config, `COORDINATION.md` §7 | — |

Status values: `unclaimed`, `in progress`, `done`, `needs review`.
`needs review` = published on the Flagged for Review page; it never blocks a merge.

---

## 2. Ground rules for this project (agreed requirements)

- **No hallucinated prices or specifications.** Every value in every table row must be
  copied from an official source snapshot under `data/raw/` and must carry that
  source link.
- If a value cannot be confirmed from an official source, it stays **blank** and is
  listed on `flagged.html` as **unverified**.
- Higher karat is not automatically "better"; **solid gold** must be stated explicitly.
- A stamp is a claim, not proof — the site says so on every page that shows karat.
- Automated checks must run after every review pass and must re-run before publish.

---

## 3. Sources policy

Accepted primary sources:

- Official retailer product feed / product page for **price and stated metal**.
- Official retailer policy page for **returns**.
- Regulator (FTC / eCFR) for **marking and purity rules**.
- Market data publisher (gold-api.com, Yahoo/COMEX, LBMA) for **gold price**, always
  stored with the publisher's own timestamp.

Not accepted as a source: search-result snippets, review aggregators, affiliate
round-ups, screenshots without URL, or any value "remembered" by an agent.

---

## 4. Verification log

| Date (UTC) | Session | What was verified | Method / source | Result |
|------------|---------|-------------------|-----------------|--------|
| 2026-10-22 | sess-d8f0544e | Repo state before work: single commit `2820cba`, only `README.md` present; no other session branches or claims found | `git log`, `git branch -a`, `gh api repos/.../pages` | clean baseline |
| 2026-10-22 | sess-d8f0544e | GitHub Pages already enabled, source `main` / root, HTTPS enforced | `gh api repos/karagemop466-tech/GOLD1/pages` | publish target confirmed |
| 2026-10-22 | sess-d8f0544e | Sandbox has no direct outbound access to retailer domains; GitHub Actions runners do | `curl` probes, workflow run | collection moved into Actions for reproducibility |

---

## 5. Requests between sessions

_None yet._

---

## 6. Handoffs / incidents

_None yet._

---

## 7. Integration record (PR, merge, deploy)

_Filled in by the final integration session._
