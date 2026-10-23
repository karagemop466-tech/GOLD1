# GOLD1 — solid gold engagement ring research

A source-linked buying dashboard for **solid gold engagement rings**, built so that no price or specification can be invented.

**Live site:** https://karagemop466-tech.github.io/GOLD1/ (plus standalone 13-row official-source evidence review at https://karagemop466-tech.github.io/GOLD1/site/)

> ### No hallucinations. Read this first.
> Every price, karat and gram figure on this site was copied from the seller's own official page and linked on the same row. **Nothing is estimated, averaged, inferred or remembered.** A value that could not be confirmed is printed as **— unverified** and listed on **Flagged for review**. Every build is re-tested by 20 canonical anti-hallucination groups (S01–S20), 10 extended provenance/security groups (A01–A10), 13 title-identity/5-karat/prose-parity groups (H01–H13) and 11 ninth-pass live-ledger groups (N01–N11) — and we actively recommend that readers look for hallucinations themselves against every linked official source.

**Latest pass — 2026-10-23 20:22–20:27Z (`arena/0a6df02e-gold1`, ninth pass, board T46/§21, verification pass P110):** **71 listings** across **11 retailers** spanning five karat tiers — **10K (4)**, **14K (50, incl. 2 withdrawn SKUs)**, **18K (11)**, **22K (4, Auvere LLC)** and **24K (2, Menē)** — with **25 published gram weights** (`0.3 g`–`7.0 g`) and **21 explicit `"solid gold"` disclosures**. This pass re-opened **17 official sources live** across all 11 retailers (15 product pages/feeds + both gold feeds; verbatim quotes in `data/session-0a6df02e/live-reads-2026-10-23.json`): gold spot refreshed to `3,998.100098 USD/ozt` at `2026-10-23T20:19:15Z` (gold-api.com; COMEX `GC=F` cross-check `4,010.70` at `20:17:18Z`) so every melt figure is re-derived; both spot-linked Menē 24K prices corrected again (`$1,707 → $1,694`, `$1,361 → $1,350`); the last partly-verified price (`be-18k-6p-121h6`, Brilliant Earth) confirmed in USD on a second channel and upgraded to confirmed; **a second reused product URL caught and withdrawn** — Blue Nile item 195639 now resolves to a different ring (`F65`, joining `F51`); a template defect that displayed partly-verified/withdrawn rows with a green "confirmed" chip found, fixed, disclosed and regression-pinned in S18 (`F66`); per-flag anchors (`flagged.html#F51`…`#F66`) made real; and `sess-3020df54`'s independent second-channel ledger (PR #41) integrated zero-loss after line-by-line verification (T37b). This PR is also the **union with the parallel ninth and tenth passes** (`sess-dab93754` §19; `arena/e0f33b77-gold1` §20, whose dataset-derived Current-findings bullets and new **H13** stale-prose guard are kept verbatim): their live-audit findings `F59`–`F64` are folded into the canonical registry verbatim (this pass's own two flags are `F65`/`F66`), their independent Menē reads ($1,694 @20:26Z, $1,350 @20:33Z) corroborate this pass's corrections exactly, and both sessions read the identical gold primary. `sess-5f363d57` independently re-confirmed the Blue Nile mismatch and both Menē displays at 20:47Z (and asked for the non-colliding `F65`), and `arena/e0f33b77-gold1` read the identical gold primary a third time. Whole audit set green on the union tree — **S01–S20 20/20, A01–A10 10/10, H01–H13 13/13, N01–N11 11/11, `npm test` /site/ suite** (advisory R01–R10: **159 findings vs the 181 baseline** on pre-union `main` — the fold-in closed six R09 items, the `F66` chip fix six R08 badge items, and the landing now shows **69 active + 2 withdrawn** (last two R08 items closed; the only newly-surfaced item is the current R07 script also catching the stock karat-spectrum phrase in dated paragraphs below) — plus two sabotage negative tests in a throwaway copy (an invented `$99,999` price and a forged "confirmed" chip; both caught). The owner's 12-point checklist was re-audited item by item against `data/checklist.json` + the `requirements.html` scorecard: 12/12 mapped, no gap. **Honest limit:** this session re-opened 17 sources, not 71; untouched rows rest on today's earlier dated channels (09:59Z 71/71 ledger, T37b second-channel reads, eighth-pass reads) and keep their own capture dates.

**Tenth pass — 2026-10-23 20:55Z (`arena/e0f33b77-gold1`, tenth pass):** a fresh session re-opened six official sources live (the gold feed, Ross-Simons `571221` and `939479`, the Aurate Modern Cigar Band feed, Mejuri's 10K Diamonds Line Ring and Cartier's 1895 wedding band); every read matched or re-confirmed the stored value (the Ross-Simons `939479` URL still sells the Claddagh ring, F51). Its own gold reading (`3,998.100098 USD/ozt` at `2026-10-23T20:19:15Z`) is recorded in `data/session-e0f33b77/live-reads-2026-10-23.json` and handed to the canonical gold-price owner as a request, because `data/gold-price.json` belongs to a parallel session (see `COORDINATION.md` §5). This pass also corrected the **Current findings** bullets below — which still described the older 59-row / 10-retailer dataset — to the live **71 rows / 11 retailers**, and added audit group **H13** so a stale prose bullet can no longer ship. Merged on top of the ninth pass below; the full suite (S01–S20, A01–A10, H01–H13, N01–N11) was re-run green. Full record in `COORDINATION.md` §20.

**Parallel ninth pass — 2026-10-23 20:22Z (`arena/dab93754-gold1`, ninth pass, verification pass P99):** **71 listings** across **11 retailers** in all five karat tiers, re-read **live in one automated run** (20:21:46Z–20:22:25Z) at each seller's own URL. **54 of 71 rows were confirmed today** (49 exact price matches, 5 confirmed at variant level), **2 prices had moved** (both Menē 24K bands, which track spot gold), **4 prices are not machine-readable** (client-side rendering — left unresolved, not guessed) and **10 pages refused the runner with HTTP 403** (5 With Clarity, 4 Cartier, 1 Brilliant Earth) and are explicitly *not* presented as fresh. A second, independent channel re-read 8 sources — including the gold spot, which agreed with the runner's reading to **0.0125%** — and every finding is published on the new **[evening live audit](https://karagemop466-tech.github.io/GOLD1/live-audit.html)** page. The pass adds audit groups **N01–N11** (ledger↔dataset bijection, no confirmation from a failed fetch, evidence-traceability of every claimed price, weight-quote traceability, dual-channel gold agreement, verbatim-quote requirement, verdict arithmetic, and HTML security), sabotage-tested by injecting a `rel="noopener"`-less link and a template leak, and **replicated**: a second automated run at 20:27Z returned the identical verdict for all 71 rows. Full suite at publish: **S01–S20 20/20**, **A01–A10 10/10**, **H01–H12 12/12**, **N01–N11 11/11**, `npm test` green, **0 broken internal links** across 603 links on 17 root pages.

**Previous pass — 2026-10-23 19:38Z (`arena/5aa23937-gold1`, eighth pass, verification pass P86):** **71 listings** across **11 retailers** spanning all five legal karat tiers — **10K (4)**, **14K (50, incl. 1 withdrawn SKU)**, **18K (11)**, **22K (4, Auvere LLC)** and **24K (2, Menē)** — with **25 published gram weights** (`0.3 g`–`7.0 g`) and **21 explicit `"solid gold"` disclosures**. This pass re-ran the whole audit set green (**S01–S20 20/20, 6,360 assertions; A01–A10 10/10; H01–H12 12/12; /site/ suite incl. `html-validate` and the runtime test**), refreshed the published gold spot from its own timestamped feed (`3,999.899902 USD/ozt` at `2026-10-23T19:38:15Z`, gold-api.com) so **every melt figure on the site is re-derived, not retyped**, and re-opened four official sources live (gold feed, Ross-Simons `571223` and `943668` variant feeds, Aurate Modern Cigar Band feed) — all four matched the stored values, and the Ross-Simons parcel-weight field was deliberately **not** mistaken for metal weight. The 2026-10-23 09:59Z automated re-read ledger (`data/verification-2026-10-23.json`) still carries a verbatim quote and HTTP status for **71 of 71** rows, and the honest limit is stated on the board: this session re-opened 4 sources, not 71.

**Earlier 2026-10-23 passes (`arena/545688f3-gold1` building on `arena/8dffa7e8-gold1`):** **71 listings across 11 retailers** spanning **all 5 legal karat tiers** — **10K (4), 14K (50, incl. 1 withdrawn SKU), 18K (11), 22K (4, via Auvere LLC), and 24K (2, via Menē)** — with **25 published gram weights** (`0.3 g`–`7.0 g` across `10K`/`14K`/`18K`) and **21 explicit `"solid gold"` disclosures**. That pass closed the 9 bot-walled PDPs through storefront JSON reads and anchored `15 U.S.C. §§ 295, 297`. All 9 pages previously blocked by HTTP 403 on the Actions runner (5 With Clarity, 3 Cartier, 1 Brilliant Earth) were opened directly via storefront `.json` feeds and US PDPs, Menē 24K live spot-linked prices were updated (`$1,707` & `$1,361`), Ross-Simons SKU `939479` remains withdrawn (`F51`), Auvere's ambiguous `"Approximate Fine Weight"` size ranges and 15-day vs 30-day return contradiction are flagged (`F54`, `F55`), and `15 U.S.C. §§ 295, 297` trademark/assay statutes are anchored alongside `16 CFR Part 23`, NIST `31.1034768 g/ozt`, GIA `2024`/`2025` Lab Notes, and CFPB FCBA protections.

Built and reconciled across research passes: **arena-6f8c2bcb-gold1** (Blue Nile, Mejuri, Brilliant Earth — 13 rows), **arena/d8f0544e-gold1** (Ross-Simons, Aurate, With Clarity, Anna Sheffield — 30 rows), **arena/c2bbe753-gold1** (luxury leads in `docs/` & `data/rings_c2bbe753.json`), **arena/bc088451-gold1** & **arena/b93ff7c6-gold1** (reconciled P12 live re-reads & 6 Ross-Simons weights), **arena/c662efda-gold1** (standalone 13-row audit at `/site/` & `research/`), and **arena/0804e222-gold1** (100% live HTML PDP re-verification across all 43 inherited rows + 5 further recovered weights + 16 new primary-source verified `10K`/`14K`/`18K`/`24K` listings from Ross-Simons, Mejuri, Automic Gold, Cartier and Menē, 10-retailer policies & BBB grades, eCFR `16 CFR Part 23` + NIST `31.1034768 g/ozt` + GIA `2024`/`2025` XRF limits + CFPB FCBA dispute rules). All prior archives are preserved unmodified.

---

## The one rule

> **No hallucinated prices.** Every price, karat and weight on the site was copied from an official retailer feed, stored with the date it was retrieved, and linked on the same row to the exact page it came from. If a value could not be confirmed on an official source it is shown as **— unverified** and published on the **Flagged for review** page. Nothing is estimated, averaged, inferred or remembered.

That rule is printed at the top of the landing page, repeated on every subpage, and then enforced mechanically by `scripts/verify.mjs`, which checks each claim against its stored evidence text. This structural audit does **not** prove a seller page is still live or unchanged.

**Freshness rule:** a price is only current as of the timestamp at which the seller's page was actually re-opened. `data/reverification.json` is the single ledger: one line per listing re-opened, with the old value, the value read, the seller's quote, the URL and the date. The latest full-catalogue re-read recorded in this repository is **2026-10-23** (`data/verification-2026-10-23.json`, 71 of 71 rows, with dated spot re-reads since — see COORDINATION.md §15–§18); these values are dated snapshots, not live quotes, and may have changed since then. Open the official product link immediately before purchasing. Nothing is silently refreshed, and rows that were not re-opened keep their capture date and say so.

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
| `live-audit.html` | **Evening live audit (P87)**: 71-row product/variant-level reconciliation from the 20:21Z run, the independent second-channel reads, findings `F59`–`F64`, and the `N01–N09` audit results |
| `flagged.html` | 65 findings that need a human decision (published, non-blocking) |
| `methodology.html` | Collection method, exclusions, what the passes test, and the limits |
| `checks.html` | Output of the latest automated verification pass and the pass history |
| `data/rings.json` | The curated dataset — 71 listings across 10K (4), 14K (50), 18K (11), 22K (4) and 24K (2), each with verbatim evidence |
| `data/reverification.json` | Unified 71-row ledger of live primary-page reads: row, URL, checked fields, before/after, verdict and verbatim quote |
| `data/verification-2026-10-22.json` | Per-row line-by-line quote audit of the 43 inherited rows (`arena/277867af-gold1`) |
| `data/verification-2026-10-23.json` | Per-row live re-read of all 71 rows, with the verdict and quote for each |
| `data/verification-2026-10-23-evening-dab93754.json` | Ninth-pass ledger: verdict, source, weight status and independent quote per row, plus findings `F59`–`F64` |
| `data/session-dab93754/` | Ninth-pass independent reads (verbatim), audit output `N01–N09`, and the daily note |
| `data/live/` | Raw evidence from the re-read workflow: parsed page signals, manual reads, HTTP status and timestamps |
| `data/compliance.json` | Machine-readable 12-point scorecard behind `requirements.html` |
| `data/session-0804e222/` | Isolated primary-source audit, retailer policies & BBB profiles, NIST/FTC/GIA/CFPB standards, and 16-ring expansion |
| `data/session-545688f3/` | Isolated 2026-10-23 spot feed, 11th retailer Auvere (22K), 12-ring 10K–22K expansion, and line-by-line audit artifacts |
| `data/archive/` | Preserved unmodified archives from earlier sessions (`session-6f8c2bcb`, `session-c662efda`) |
| `site/` & `research/` | Standalone 13-row CSP-hardened evidence review (`arena/c662efda-gold1`) published at `/site/` |
| `docs/` | Secondary category dashboard from `arena/c2bbe753-gold1` |
| `data/sources.json` | Source registry with retrieval dates and status (58 entries incl. rejected 404s) |
| `data/flagged.json` | Findings, severity, affected rows, source links (`57` published items, `F01`–`F58`) |
| `data/retailers.json` | All 11 retailers' verified contacts, official return/resize terms, and BBB records |
| `data/gold-price.json` | Gold spot (`5` timestamped readings) + COMEX cross-check + NIST exact `grams_per_troy_ounce` (`31.1034768`) |
| `data/checks/` | Latest canonical anti-hallucination pass and full pass history |
| `scripts/integrate_0804e222.mjs` | Zero-loss, idempotent integrator merging `data/session-0804e222/*` into canonical `data/*.json` |
| `scripts/integrate_545688f3.mjs` | Zero-loss, idempotent integrator merging `data/session-545688f3/*` into canonical `data/*.json` |
| `scripts/build.mjs` | Root static site generator (105 HTML pages, zero runtime dependencies) |
| `scripts/verify.mjs` | Canonical anti-hallucination audit: **20 check groups (`S01`–`S20`)** |
| `scripts/live_reverify.mjs` | Re-opens every official product page on a runner with full internet and records what it printed (never edits the curated data) |
| `scripts/reconcile_live.mjs` | Applies only evidence-backed corrections, with a quote and URL for each, and writes the per-row ledger |
| `scripts/build_compliance.mjs` | Builds the 12-point requirements scorecard |
| `.github/workflows/reverify.yml` | Runs the re-read on demand and commits the evidence file |
| `scripts/audit_0804e222.mjs` | Extended cross-file provenance, regulatory & HTML security/XSS audit (`A01`–`A10`) |
| `scripts/audit_545688f3.mjs` | Deep title-identity, 5-karat-tier, prose-parity & security audit (`H01`–`H12`) |
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
- **9 of 71 rows clear every criterion that can be checked before paying** — the eight Automic Gold pieces and Ross-Simons 997811. They are the only rows that state *solid*, publish grams, state a karat and sit with a usable return window. **0 of 71 publish a hallmark or maker's mark**, so point 3 of the checklist can only be completed in person (F12, F20).
- **71 verified listings across 10K (4), 14K (50), 18K (11), 22K (4) and 24K (2)** from **11 retailers** (Ross-Simons, With Clarity, Anna Sheffield, Aurate, Blue Nile, Mejuri, Brilliant Earth, Automic Gold, Cartier, Menē, Auvere), across 6 style categories, with **all 71 rows re-read on 2026-10-23** — 50 parsed by the automated runner, and the 9 bot-walled pages plus the 12 newer listings opened directly from official storefront feeds and PDPs (none silently carried forward).
- **21 of 71 listings explicitly state "solid gold"** (8 Automic Gold, 7 Mejuri, 4 Auvere, Ross-Simons 997811, and Aurate Diamond X Ring). Under FTC **16 CFR § 23.3(c)(1)**, hollow-center gold may not legally be called "Solid Gold" — yet Mejuri's FAQ and Bold Chain Ring ($348) call hollowed rings "solid gold" (flagged). → F01, F38
- **25 of 71 listings publish a weight in grams** (12 Ross-Simons `0.3–5.0 g`, 8 Automic Gold `1.4–7.0 g`, 5 Aurate `1.97–4.0 g`). The remaining 46 rows (including Menē's 2 JS-rendered 24K bands) omit static HTML gram numbers and stay blank, never estimated. → F02, F32, F40, F43
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
