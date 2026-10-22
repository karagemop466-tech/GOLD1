# GOLD1 — solid gold engagement ring research

A source-linked buying dashboard for **solid gold engagement rings**, built so that no price or specification can be invented.

**Live site:** https://karagemop466-tech.github.io/GOLD1/

Built across three research passes: session **arena-6f8c2bcb-gold1** (Blue Nile, Mejuri, Brilliant Earth — 13 rows), session **arena/d8f0544e-gold1** (Ross-Simons, Aurate, With Clarity, Anna Sheffield — 30 rows), and session **arena/b93ff7c6-gold1** (pass **P12**, 2026-10-22: re-opened 18 listings, added the six metal weights Ross-Simons actually publishes, corrected one price that had moved, and added two new check groups). The earlier passes' original records are preserved unmodified under `data/archive/`.

---

## The one rule

> **No hallucinated prices.** Every price, karat and weight on the site was copied from an official retailer feed, stored with the date it was retrieved, and linked on the same row to the exact page it came from. If a value could not be confirmed on an official source it is shown as **— unverified** and published on the **Flagged for review** page. Nothing is estimated, averaged, inferred or remembered.

That rule is printed at the top of the landing page, repeated on every subpage, and then enforced mechanically by `scripts/verify.mjs`, which re-derives every claim from its own evidence text.

**Pass P12 added a second rule:** a price is only "current" if the seller's page was actually re-opened. Every row now carries a re-check status — `matched`, `price corrected`, `not re-checked`, `could not confirm` — and `data/recheck.json` records, line by line, the price before, the price read, the weight read, the URL that was opened and the date. Nothing was silently refreshed.

---

## What is in the repo

| Path | What it is |
|------|------------|
| `index.html` | Landing dashboard: the rule, headline findings, gold price, category cards, full table |
| `rings.html` | All listings with filters (search, category, seller, karat, max price) and sortable columns |
| `categories/*.html` | One page per style: solitaire, three-stone & halo, bezel & modern, gemstone, bands, estate |
| `rings/<id>.html` | One page per listing: evidence text, melt-value check, flags, seller contact and return terms, pre-purchase steps |
| `calculator.html` | Gold value calculator: grams × karat ÷ 24 × published gold price, plus price-to-melt multiple |
| `checklist.html` | The original 12-point checklist, scored item by item |
| `sources.html` | Source registry, including sources that were checked and **rejected** |
| `flagged.html` | 29 findings that need a human decision (published, non-blocking) |
| `methodology.html` | Collection method, exclusions, what the passes test, and the limits |
| `checks.html` | Output of the latest automated verification pass and the pass history |
| `data/rings.json` | The curated dataset — 43 rows, each with its evidence string, its weight evidence and its re-check status |
| `data/recheck.json` | **P12 log:** one line per listing re-opened — price before, price read, weight read, URL, date, result |
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
| `scripts/verify.mjs` | Anti-hallucination audit: **15 check groups, ~2,600 assertions** (S14 traces every weight to the seller's own wording, S15 audits the re-check log) |
| `scripts/apply_recheck_p12.py` | The P12 re-check, as a script: every value it writes was read from the URL named beside it, and running it twice changes nothing |
| `scripts/apply_recheck_p12_meta.py` | P12 gold-price refresh, source registrations, and the findings this pass proved wrong (F02, F06 rewritten; F31–F35 added) |
| `.github/workflows/collect.yml` | On-demand evidence refresh (requires GitHub Actions to be enabled for the repo) |
| `COORDINATION.md` | Shared task board, verification log and integration record |

Directories `site/` is reserved and currently empty; all generated pages live in the repo root because GitHub Pages serves this repository from `main` at `/`.

---

## Run it

```bash
node scripts/build.mjs      # regenerate every page from data/
node scripts/verify.mjs     # audit the data and the generated HTML
python3 -m http.server 8080 # preview at http://localhost:8080
```

Node 22, no npm install, no network calls at build time, no tracking scripts, no CDN.

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
| S14 | Weight traceable to evidence | A published weight whose digits are not in the weight evidence copied from the seller page |
| S15 | Re-check log integrity | A row claiming a re-check that is not in `data/recheck.json`, or a logged price that disagrees with the row |

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
- **7 of 43 listings publish metal weight in grams**, not 1 as the earlier passes reported: six Ross-Simons bands (1.7 g, 2.5 g, 3.8 g, 5.0 g, 0.5 g, 0.5 g) and the Aurate Modern Cigar Band (2.6–4 g range). The other 36 are blank, not estimated. → F02
- **The two "suspiciously cheap" rings are explained:** $149 buys 0.5 g of 14K and $179 buys 0.5 g of 18K — about $37.79 and $48.58 of gold at the P12 price, so roughly 3.9× and 3.7× melt. → F06
- **A stored price had moved:** Ross-Simons 571223 was recorded at $799–$849 and is $849 for every size on re-read. The row was corrected and the change logged. → F31
- **18 rows were re-opened and confirmed or corrected; 22 were not**, and the site labels those as historical rather than current. → F32
- **Aurate mixes a vermeil variant into a solid-gold listing** ($118 vs $1,308 for the same 14K band). → F03
- **5 listings are settings, not rings** (4 × With Clarity, 1 × Ross-Simons). → F04, F05
- **Two Ross-Simons pieces at $149 and $179** are flagged as value-unverifiable without a weight. → F06
- **Resizing is a return-rights trap**: Ross-Simons and With Clarity both refuse returns on jewellery resized by another jeweller; Anna Sheffield charges a 10% restocking fee. → F07, F11
- **Blue Nile's 18K Petite Nouveau listing contradicts its own metal spec** (first pass, F15).
- **Set & Stones was excluded** because its engagement-ring results were gold-filled. Blue Nile's category URL 404'd, so no row was invented. → `sources.html`

---

## Limits

Prices are a snapshot and retailers change them without notice — the retailer page always wins. In pass P12 the re-check itself caught a real drift (F31), which is why every row now says whether it was re-read or is historical. Weight is mostly unpublished. Hallmarks and purity cannot be verified from a web page; the only real test is an independent jeweller with XRF. Retailer "reputation" here means verifiable identity and contact details, not a rating. Nothing on this site is an appraisal or financial advice.

## License

Data and text in this repository are published for personal research use. Product names, prices and descriptions belong to their retailers and are quoted only as evidence.
