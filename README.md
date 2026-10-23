# GOLD1 — solid gold engagement ring research

A source-linked buying dashboard for **solid gold engagement rings**, built so that no price or specification can be invented.

**Live site:** https://karagemop466-tech.github.io/GOLD1/ (plus standalone 13-row official-source evidence review at https://karagemop466-tech.github.io/GOLD1/site/)

> ### No hallucinations. Read this first.
> Every price, karat and gram figure on this site was copied from the seller's own official page and linked on the same row. **Nothing is estimated, averaged, inferred or remembered.** A value that could not be confirmed is printed as **— unverified** and listed on **Flagged for review**. Every build is re-tested by 20 anti-hallucination groups (S01–S20) plus 10 extended provenance/security groups (A01–A10), and the suite is deliberately sabotaged with a fake price to prove it fires.

**Latest pass — 2026-10-23 (`arena/8dffa7e8-gold1`):** every one of the 59 listings was opened again at its own official product URL from an independent network. **39 prices reproduced exactly; 4 were corrected** against a quoted page line (wider size/variant ranges); **1 row was withdrawn** because Ross-Simons now sells a different ring under that SKU at the same price and weight (F51); **9 pages were blocked** by With Clarity, Cartier and Brilliant Earth, so those rows are labelled *not re-read* rather than presented as fresh (F53). New in this pass: a **12-point requirements scorecard** (`requirements.html`) that scores every row against the buyer's own checklist, and a **full re-check ledger** (`recheck.html`) with the quote behind every verdict.

Built and reconciled across research passes: **arena-6f8c2bcb-gold1** (Blue Nile, Mejuri, Brilliant Earth — 13 rows), **arena/d8f0544e-gold1** (Ross-Simons, Aurate, With Clarity, Anna Sheffield — 30 rows), **arena/c2bbe753-gold1** (luxury leads in `docs/` & `data/rings_c2bbe753.json`), **arena/bc088451-gold1** & **arena/b93ff7c6-gold1** (reconciled P12 live re-reads & 6 Ross-Simons weights), **arena/c662efda-gold1** (standalone 13-row audit at `/site/` & `research/`), and **arena/0804e222-gold1** (100% live HTML PDP re-verification across all 43 inherited rows + 5 further recovered weights + 16 new primary-source verified `10K`/`14K`/`18K`/`24K` listings from Ross-Simons, Mejuri, Automic Gold, Cartier and Menē, 10-retailer policies & BBB grades, eCFR `16 CFR Part 23` + NIST `31.1034768 g/ozt` + GIA `2024`/`2025` XRF limits + CFPB FCBA dispute rules). All prior archives are preserved unmodified.

---

## The one rule

> **No hallucinated prices.** Every price, karat and weight on the site was copied from an official retailer feed, stored with the date it was retrieved, and linked on the same row to the exact page it came from. If a value could not be confirmed on an official source it is shown as **— unverified** and published on the **Flagged for review** page. Nothing is estimated, averaged, inferred or remembered.

That rule is printed at the top of the landing page, repeated on every subpage, and then enforced mechanically by `scripts/verify.mjs`, which checks each claim against its stored evidence text. This structural audit does **not** prove a seller page is still live or unchanged.

**Freshness rule:** a price is only current as of the timestamp at which the seller's page was actually re-opened. `data/reverification.json` is the single ledger: one line per listing re-opened, with the old value, the value read, the seller's quote, the URL and the date. The latest full re-read recorded in this repository is **2026-10-22**; these values are dated snapshots, not live quotes, and may have changed since then. Open the official product link immediately before purchasing. Nothing is silently refreshed, and rows that were not re-opened keep their capture date and say so.

---

## What is in the repo

| Path | What it is |
|------|------------|
| `index.html` | Landing dashboard: the rule, headline findings, gold price, category cards, full table |
| `rings.html` | All listings with filters (search, category, seller, karat, max price) and sortable columns |
| `weights.html` | Weight and gold content: every listing with a published weight, the melt arithmetic shown line by line, and the per-seller count of rows where no weight exists |
| `categories/*.html` | One page per style: solitaire, three-stone & halo, bezel & modern, gemstone, bands, estate |
| `rings/<id>.html` | One page per listing: evidence text, melt-value check, flags, seller contact and return terms, pre-purchase steps |
| `calculator.html` | Gold value calculator: grams × karat ÷ 24 × published gold price, plus price-to-melt multiple |
| `checklist.html` | The original 12-point checklist, scored item by item |
| `sources.html` | Source registry, including sources that were checked and **rejected** |
| `requirements.html` | **12-point requirements scorecard**: every listing scored against the buyer's checklist, with a shortlist of rows that meet every criterion checkable before paying |
| `recheck.html` | **2026-10-23 re-check ledger**: what each seller printed, what was stored, the verdict and the verbatim quote |
| `flagged.html` | 52 findings that need a human decision (published, non-blocking) |
| `methodology.html` | Collection method, exclusions, what the passes test, and the limits |
| `checks.html` | Output of the latest automated verification pass and the pass history |
| `data/rings.json` | The curated dataset — 59 rows across 10K, 14K, 18K and 24K, each with verbatim evidence |
| `data/reverification.json` | Unified 59-row ledger of live primary-page reads: row, URL, checked fields, before/after, verdict and verbatim quote |
| `data/verification-2026-10-22.json` | Per-row line-by-line quote audit of the 43 inherited rows (`arena/277867af-gold1`) |
| `data/verification-2026-10-23.json` | **This pass**: per-row live re-read of all 59 rows, with the verdict and quote for each |
| `data/live/` | Raw evidence from the re-read workflow: parsed page signals, manual reads, HTTP status and timestamps |
| `data/compliance.json` | Machine-readable 12-point scorecard behind `requirements.html` |
| `data/session-0804e222/` | Isolated primary-source audit, retailer policies & BBB profiles, NIST/FTC/GIA/CFPB standards, and 16-ring expansion |
| `data/archive/` | Preserved unmodified archives from earlier sessions (`session-6f8c2bcb`, `session-c662efda`) |
| `site/` & `research/` | Standalone 13-row CSP-hardened evidence review (`arena/c662efda-gold1`) published at `/site/` |
| `docs/` | Secondary category dashboard from `arena/c2bbe753-gold1` |
| `data/sources.json` | Source registry with retrieval dates and status (54 entries incl. rejected 404s) |
| `data/flagged.json` | Findings, severity, affected rows, source links (`49` published items) |
| `data/retailers.json` | All 10 retailers' verified contacts, official return/resize terms, and BBB records |
| `data/gold-price.json` | Gold spot (`3` timestamped readings) + COMEX cross-check + NIST exact `grams_per_troy_ounce` (`31.1034768`) |
| `data/checks/` | Latest canonical anti-hallucination pass and full pass history |
| `scripts/integrate_0804e222.mjs` | Zero-loss, idempotent integrator merging `data/session-0804e222/*` into canonical `data/*.json` |
| `scripts/build.mjs` | Root static site generator (91 HTML pages, zero runtime dependencies) |
| `scripts/verify.mjs` | Canonical anti-hallucination audit: **20 check groups (`S01`–`S20`)** |
| `scripts/live_reverify.mjs` | Re-opens every official product page on a runner with full internet and records what it printed (never edits the curated data) |
| `scripts/reconcile_live.mjs` | Applies only evidence-backed corrections, with a quote and URL for each, and writes the per-row ledger |
| `scripts/build_compliance.mjs` | Builds the 12-point requirements scorecard |
| `.github/workflows/reverify.yml` | Runs the re-read on demand and commits the evidence file |
| `scripts/audit_0804e222.mjs` | Extended cross-file provenance, regulatory & HTML security/XSS audit (`A01`–`A10`, 1,491 assertions) |
| `COORDINATION.md` | Shared task board, verification log and integration record |

---

## Run it

```bash
node scripts/build.mjs          # regenerate every page from data/
node scripts/verify.mjs         # audit the data and generated HTML; writes latest pass
node scripts/build.mjs          # publish that exact pass ID to index.html and checks.html
node scripts/audit_0804e222.mjs # verify cross-file provenance, security, and pass-ID sync
python3 -m http.server 8080     # preview at http://localhost:8080
```

The second build is intentional: it renders the pass just written by the verifier. `python3 scripts/verify_data.py` is retained as a compatibility wrapper for the same canonical `node scripts/verify.mjs` audit; it is not an independent verifier. These local checks do not re-fetch retailer or market pages. Node 22, no network calls at build time, no tracking scripts, no CDN.

---

## The verification passes

`scripts/verify.mjs` runs after every review. Each group is a mechanical test, not an opinion:

| ID | Group | What it catches |
|----|-------|-----------------|
| S01 | Provenance | A row with no HTTPS source, a source on the wrong domain, or no evidence text |
| S02 | Price traceable to evidence | **The price digits must literally occur in the evidence text.** A number that is not in its own evidence is treated as fabricated |
| S03 | Karat validity | A karat that is not 10/14/18/22/24, or that the evidence never states |
| S04 | Internal arithmetic | Price low > high, non-positive weight, compare-at below selling price |
| S05 | Solid-claim honesty | Claiming "solid stated" when the seller text never says solid |
| S06 | Melt-value plausibility | An asking price below the gold content — impossible, so weight/karat/price must be wrong |
| S07 | Plated-metal guard | Vermeil / plated / gold-filled language passing silently |
| S08 | Date sanity | Missing or future retrieval dates, bad price feed |
| S09 | Identity and schema | Duplicate IDs or URLs, unknown retailer or category, unflagged flags |
| S10 | No silent blanks | A blank weight without an explanation, or an undisclosed price range |
| S11 | Links and placeholders | Broken internal links, missing assets, placeholder text |
| S12 | Row-to-page coverage | A row without a detail page showing its source and price |
| S13 | Source registry coverage | A retailer used for values with no registry entry |
| S14 | Weight traceability | Grams that do not appear in the seller's own evidence text, or a blank/known flag that contradicts the stored weight |
| S15 | Re-verification ledger | A row labelled "re-read" with no ledger entry, no quote, or a different URL |
| S16 | No invented dollar amounts | **Any dollar figure on any page that no data file or formula produces.** Tested against deliberate sabotage (pass P15: a fake five-figure price was injected and caught) |
| S17 | Data age | A snapshot older than 30 days, or a re-verified count that does not match the ledger |

Failures are printed, written to `data/checks/latest.json`, appended to `data/checks/history.json`, and rendered on `checks.html`. The command exits non-zero on any failure.

---

## Adding a listing (the only allowed way)

1. Retrieve the product from the retailer's own feed or product page. Record the exact wording that states the karat and the price.
2. Add a row to `data/rings.json` with `source_url`, `retrieved_at`, and an `evidence` string containing the verbatim price and karat.
3. If weight is not published, leave it `null` **and** add the `weight_not_published` flag. Do not estimate it.
4. Add any new source to `data/sources.json`.
5. Add a finding to `data/flagged.json` if the listing has a trap (setting-only price, plated variant, one-off estate piece).
6. Run `node scripts/build.mjs && node scripts/verify.mjs`. If S02 fails, the price is not in your evidence — fix the evidence, not the price.

---

## Current findings (as of 2026-10-23)

- **Ross-Simons SKU 939479 was withdrawn (F51).** The URL now returns an Italian 14kt gold Claddagh ring ($499, 1.5 g) instead of the lab-grown diamond eternity band the row described. The price and weight coincidentally match, which is why four earlier passes missed it. Always re-open the product URL.
- **8 of 59 rows clear every criterion that can be checked before paying** — the seven Automic Gold pieces and Ross-Simons 997811. They are the only rows that state *solid*, publish grams, state a karat and sit with a usable return window. **0 of 59 publish a hallmark or maker's mark**, so point 3 of the checklist can only be completed in person (F12, F20).
- **59 verified listings across 10K (3), 14K (45), 18K (9) and 24K (2)** from **10 retailers** (Ross-Simons, With Clarity, Anna Sheffield, Aurate, Blue Nile, Mejuri, Brilliant Earth, Automic Gold, Cartier, Menē), across 6 style categories, with **50 of 59 product pages re-read live on 2026-10-23** (the other 9 are behind bot walls and are labelled *not re-read*, not silently carried forward).
- **15 of 59 listings explicitly state "solid gold"** (7 Automic Gold, 6 Mejuri, Ross-Simons 997811, and Aurate Diamond X Ring). Under FTC **16 CFR § 23.3(c)(1)**, hollow-center gold may not legally be called "Solid Gold" — yet Mejuri's FAQ and Bold Chain Ring ($348) call hollowed rings "solid gold" (flagged). → F01, F38
- **21 of 59 listings publish a weight in grams** (9 Ross-Simons `0.3–5.0 g`, 7 Automic Gold `1.4–7.0 g`, 5 Aurate `1.97–4.0 g`). The remaining 38 rows (including Menē's 2 JS-rendered 24K bands) omit static HTML gram numbers and stay blank, never estimated. → F02, F32, F40, F43
- **Independent BBB reputation diverges sharply**: Ross-Simons, Blue Nile, Brilliant Earth, and With Clarity hold **A+ BBB Accreditation**, whereas **Aurate New York holds a BBB "F" rating** (8 unanswered of 23 complaints) and displays `"Final Sale! Exchange for size only"` on all 5 ring PDPs. → F25, F39
- **Page contradictions & inquiry-only archive pages caught**: Blue Nile item 203284 ($935) states `14K` in specs and `"18k yellow gold"` in prose while missing Blue Nile's $1,000 warranty minimum; Anna Sheffield `as-bea-sol` and `as-hazeline` have no live HTML price or checkout button; With Clarity gallery alt text says `"14KT Platinum"`. → F16, F37, F39, F41
- **Surface XRF alone is not enough (GIA Lab Notes 2024–2025)**: GIA documented a 41 g resin-filled electroformed bracelet reading `17.99K–22.47K` on XRF and `"Gold-Plated Gold"` 9K/10K rings reading `13.5K–18K` on XRF with no plating alert — pair XRF with calibrated gram weight and hydrostatic specific gravity inside the return window. → F42
- **Return clocks & engraving traps**: Menē allows 7 days (up to 10% refund restocking fee), Anna Sheffield 14 days (10% restocking), Blue Nile & Brilliant Earth start 30-day clocks at **shipment/readiness** rather than delivery, With Clarity caps returns at 1 per 6 months, and every retailer voids returns if resized by a third-party jeweller or engraved. → F07, F11, F23, F24, F33, F41, F43
- **Blue Nile's 18K Petite Nouveau listing contradicts its own metal spec** (first pass, F15).
- **Set & Stones was excluded** because its engagement-ring results were gold-filled. Blue Nile's category URL 404'd, so no row was invented. → `sources.html`

---

## Limits

Prices are a snapshot and retailers change them without notice — the retailer page always wins. In pass P12 the re-check itself caught a real drift (F31), which is why every row now says whether it was re-read or is historical. Weight is mostly unpublished. Hallmarks and purity cannot be verified from a web page; the only real test is an independent jeweller with XRF. Retailer "reputation" here means verifiable identity and contact details, not a rating. Nothing on this site is an appraisal or financial advice.

## License

Data and text in this repository are published for personal research use. Product names, prices and descriptions belong to their retailers and are quoted only as evidence.
