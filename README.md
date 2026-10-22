# GOLD1 — solid gold engagement ring research

A source-linked buying dashboard for **solid gold engagement rings**, built so that no price or specification can be invented.

**Live site:** https://karagemop466-tech.github.io/GOLD1/

Built across three research passes: session **arena-6f8c2bcb-gold1** (Blue Nile, Mejuri, Brilliant Earth — 13 rows), session **arena/d8f0544e-gold1** (Ross-Simons, Aurate, With Clarity, Anna Sheffield — 30 rows), and session **arena/bc088451-gold1** (live re-verification of 7 pages + one market feed, 4 weights recovered, 2 prices corrected, 5 new findings). The first pass's original records are preserved unmodified in `data/archive/session-6f8c2bcb/`.

---

## The one rule

> **No hallucinated prices.** Every price, karat and weight on the site was copied from an official retailer feed, stored with the date it was retrieved, and linked on the same row to the exact page it came from. If a value could not be confirmed on an official source it is shown as **— unverified** and published on the **Flagged for review** page. Nothing is estimated, averaged, inferred or remembered.

That rule is printed at the top of the landing page, repeated on every subpage, and then enforced mechanically by `scripts/verify.mjs`, which re-derives every claim from its own evidence text.

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
| `flagged.html` | 29 findings that need a human decision (published, non-blocking) |
| `methodology.html` | Collection method, exclusions, what the passes test, and the limits |
| `checks.html` | Output of the latest automated verification pass and the pass history |
| `data/rings.json` | The curated dataset — 43 rows, each with its evidence string |
| `data/reverification.json` | Ledger of the P12 live re-reads: row, URL, what was checked, before/after, verdict and the quoted line |
| `data/archive/session-6f8c2bcb/` | First pass's original 13 rows, 15 flags, CSV and gold reading, preserved unmodified |
| `data/sources.json` | Source registry with retrieval dates and status |
| `data/flagged.json` | Findings, severity, affected rows, source links |
| `data/retailers.json` | Retailer identity, contact details and return terms (verbatim-sourced) |
| `data/gold-price.json` | Gold spot + COMEX cross-check with publisher timestamps |
| `data/checks/` | Latest pass and full pass history |
| `data/collect/sources.json` | Machine-readable list of every primary URL used |
| `scripts/collect.mjs` | Evidence collector: re-fetches every source and writes a timestamped snapshot |
| `scripts/integrate_session_6f8c2bcb.py` | Mechanical migration of the first pass's rows into this schema (no number is retyped) |
| `scripts/build.mjs` | Static site generator (no dependencies) |
| `scripts/verify.mjs` | Anti-hallucination audit: 13 check groups, ~1,500 assertions |
| `.github/workflows/collect.yml` | On-demand evidence refresh (requires GitHub Actions to be enabled for the repo) |
| `COORDINATION.md` | Shared task board, verification log and integration record |

All generated root pages live in the repo root because GitHub Pages serves this repository from `main` at `/`. The reserved `site/` directory now contains the separate fourth-pass review described below; it does not replace the root dashboard.

---

## Independent official-source review (`site/`)

[Open the official-source audit dashboard](site/) — 13 directly reviewed product records, three seller-policy/reputation profiles, ten irregularity groups, nine verification gates, category pages, a prominent review matrix, and a nominal gold-weight calculator.

This is a **separate evidence set**, not an automatic migration or a claim of 56 unique products. It may overlap seller/catalog coverage with the root set. Six rows have seller-stated solid-gold wording and listed item weights; seven leave those fields blank. All 13 remain flagged and **zero are purchase-ready**. Listed weight is not net metal weight, and nominal arithmetic is not actual raw-gold content, melt/resale value, or an appraisal.

| Path | Purpose |
|------|---------|
| `research/candidates.json` | Field-level official product excerpts, prices, URLs, retrieval dates, blanks, and flags |
| `research/sellers.json` | Official seller contact/payment/return/documentation findings and direct BBB snapshots |
| `research/irregularities.json` | Source conflicts, mixed metals, size surcharges, exclusions, and policy cautions |
| `research/policy/` | FTC/GIA/CFPB/LBMA guidance, nine gates, and the named Kitco market snapshot |
| `site/` | Thirteen-page static audit dashboard and exact publication JSON copies |
| `scripts/*.js`, `tests/` | Evidence, link, security, HTML, runtime, build, and published-byte parity checks |

The only market input for this subsection is Kitco’s named **2026-10-22 19:11 NY** panel: bid **$4,025.00/troy oz**, 31.1034768 g/troy oz, derived reference **$129.4067549387/g** (displayed $129.41/g). The calculation contract and source quote are preserved in `research/policy/market.json`.

---

## Run it

Root dashboard (Node 22, no npm install):

```bash
node scripts/build.mjs      # regenerate root pages from data/
node scripts/verify.mjs     # audit root data and generated HTML; writes data/checks/
python3 -m http.server 8080 # preview the complete repository, including site/
```

Official-source subsection and its publication-data parity checks:

```bash
npm ci
npm test                  # evidence, security, HTML, runtime, links, build, and parity
npm run serve             # preview the subsection build on 0.0.0.0:4173
```

Both dashboards are static, make no network calls at build time, use no tracking scripts or CDN, and have no production dependencies. The `site/data/` files must remain byte-identical to their audited `research/` sources; `npm test` enforces that contract.

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

## Current findings (as of 2026-10-22)

- **43 listings**, 7 retailers (Blue Nile, Mejuri, Brilliant Earth, Ross-Simons, Aurate, With Clarity, Anna Sheffield), 6 style categories.
- **Only 4 of 43 listings use the words "solid gold"** — all four are Mejuri. The other 39 state a karat but never the word solid, and none carries plating language. → F01
- **5 of 43 listings publish metal weight in grams** (up from 1 after the P12 re-read). The value check is complete for those five and impossible for the other 38, where it is left blank rather than estimated. → F02, F32
- **Live re-read of 7 product pages found two prices had moved** (rs-571223 $799→$849; rs-943668 range $1,269–$1,439 → single $1,269 clearance). Both were corrected, and the old values are kept in `data/reverification.json`. → F31
- **The two "impossible" prices are explained, not excused**: $149 and $179 are 0.5 g rings (≈0.29 g and ≈0.38 g of fine gold), giving 3.9× and 3.7× melt. → F06
- **Aurate mixes a vermeil variant into a solid-gold listing** ($118 vs $1,308 for the same 14K band). → F03
- **5 listings are settings, not rings** (4 × With Clarity, 1 × Ross-Simons). → F04, F05
- **Weights the seller publishes are labelled approximate** by the seller, so melt figures carry that tolerance. → F34
- **Mejuri's return promise excludes engraving** — "Engraved items are not eligible for return." Engraving is offered in the same buy box. → F33
- **Resizing is a return-rights trap**: Ross-Simons and With Clarity both refuse returns on jewellery resized by another jeweller; Anna Sheffield charges a 10% restocking fee. → F07, F11
- **Blue Nile's 18K Petite Nouveau listing contradicts its own metal spec** (first pass, F15).
- **Set & Stones was excluded** because its engagement-ring results were gold-filled. Blue Nile's category URL 404'd, so no row was invented. → `sources.html`

---

## Limits

Prices are a snapshot and retailers change them without notice — the retailer page always wins. Weight is mostly unpublished. Hallmarks and purity cannot be verified from a web page; use independent professional testing after delivery. Quantitative XRF can help verify precious-metal content and detect plating, but sampling area and professional interpretation matter, and no single reading proves every aspect of construction. Retailer "reputation" here means verifiable identity and contact details, not a rating. Nothing on this site is an appraisal or financial advice.

## License

Data and text in this repository are published for personal research use. Product names, prices and descriptions belong to their retailers and are quoted only as evidence.
