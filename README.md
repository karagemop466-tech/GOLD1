# GOLD1 — Gold Engagement Ring Research

**Mission:** collect, organize, and analyze solid-gold engagement-ring options against a strict
online-buying checklist — with **zero hallucinated values**.

> ## ⚠️ No-hallucination policy
> Every price, karat, weight, and policy value in this repo and on the site was taken from the
> **official source page linked next to it**, with an exact evidence quote and fetch date.
> If a value could not be confirmed from an official source it is **left blank and flagged** —
> never inferred, estimated, or copied from third parties. Prices are dated snapshots; always
> re-check the live retailer page before buying.
> Run the audit after every review: `python3 scripts/verify_data.py`

**Live site:** https://karagemop466-tech.github.io/GOLD1/ (published from `main` → `/docs` via GitHub Pages)

## What's here

| Path | Purpose |
|---|---|
| `data/` | JSON source of truth: `rings.json` (listings + per-value evidence quotes), `gold_price.json` (spot anchor + cross-checks), `karats.json` (purity table + legal context), `checklist.json`, `flags.json` (Flagged-for-Review ledger), `sources.json` (official source register), `audit_report.json` (latest audit output) |
| `docs/` | The static site (generated) — dashboard, per-retailer listing tables, gold price & karat pages, calculator, checklist, methodology, flagged page |
| `scripts/build_site.py` | Regenerates `docs/` from `data/` (stdlib only): `python3 scripts/build_site.py` |
| `scripts/verify_data.py` | Verification + hallucination audit: schema, evidence, arithmetic, rendered-number scan, internal links. Writes `data/audit_report.json`, exits non-zero on failure |
| `COORDINATION.md` | Shared task board for multi-session work — read before contributing |

## Snapshot (2026-10-22)

- **14 listings** tracked across Tiffany & Co., Cartier, Brilliant Earth, Blue Nile (incl. James Allen-branded settings), Mejuri.
- **7 prices verified by direct fetch** of the official page; 7 deliberately left blank (search-snapshot-only or stale — flagged).
- **Metal weight in grams:** published by **no** retailer reviewed → blank on every row (Flag F1). Ask the seller; verify independently.
- **Gold spot anchor:** USD **4,024.36/troy oz** (World Gold Council, data as of 2026-10-21, fetched directly).
- **Key finding:** a karat stamp alone proves nothing — anchor claims to 16 CFR Part 23 and 15 U.S.C. ch. 8, then test (XRF) after delivery.

## Key official sources (all fetched 2026-10-22)

- FTC Jewelry Guides — 16 CFR Part 23: https://www.ecfr.gov/current/title-16/chapter-I/subchapter-B/part-23
- National Gold and Silver Stamping Act — 15 U.S.C. ch. 8 (§§291–296): https://www.govinfo.gov/link/uscode/15/294
- World Gold Council spot prices: https://www.gold.org/goldhub/data/gold-prices
- Goldsmiths' Company Assay Office (London): https://www.assayofficelondon.co.uk/hallmarking

## Workflow for edits

1. Claim a task in `COORDINATION.md` (commit + push the claim).
2. Edit **only** files in your claimed scope; update `data/*.json` — never hand-edit `docs/` output.
3. `python3 scripts/build_site.py && python3 scripts/verify_data.py` — must PASS.
4. Commit small and often; `git pull --rebase` before every push.
5. Find a hallucination? Fix the data, re-run the audit, and note it in `COORDINATION.md`.
