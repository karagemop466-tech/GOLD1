#!/usr/bin/env python3
"""sess-7d64f506 (board T52) — fold the 2026-10-23 live re-reads into the /site/ evidence register.

Rules this script obeys (and that scripts/audit-evidence.js enforces afterwards):

* No stored price, karat or gram weight is changed. The 2026-10-23 reads reproduced
  all 13 stored prices exactly, so the only data movement is the retrieval date, a
  per-row re-verification block carrying the fresh verbatim quote, and new
  irregularities.
* Nothing is added to a candidate's ``evidence`` array unless it was read on the
  candidate's own ``officialProductUrl``: the audit requires evidence URLs to equal
  the product URL, so second-channel (.js feed) reads live in the re-verification
  block and in data/session-7d64f506/live-reads-2026-10-23.json instead.
* research/** is the source of truth; site/data/** is the published copy and is
  byte-synced from it at the end.
"""
from __future__ import annotations

import json
import os
import shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATE = "2026-10-23"
PASS_ID = "T52-7d64f506"
SESSION = "sess-7d64f506"


def load(relative: str):
    with open(os.path.join(ROOT, relative), encoding="utf-8") as handle:
        return json.load(handle)


def save(relative: str, payload) -> None:
    with open(os.path.join(ROOT, relative), "w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2, ensure_ascii=False)
        handle.write("\n")


def main() -> None:
    ledger = load("data/session-7d64f506/live-reads-2026-10-23.json")
    reads = {read["id"]: read for read in ledger["reads"]}
    live_feed = ledger["goldReadings"][0]

    # --- candidates -----------------------------------------------------
    candidates = load("research/candidates.json")
    candidates["retrievedDate"] = DATE
    candidates["coverageNote"] = (
        "Thirteen active candidates inspected line by line on official product pages and re-opened live on "
        "2026-10-23 (session sess-7d64f506, board T52): all 13 stored prices were reproduced, 11 exactly and 2 "
        "at the base configuration with the seller's own size surcharges disclosed. This is a bounded audit "
        "set, not an exhaustive list of every ring for sale, and it is not the canonical 71-row catalogue on "
        "the dashboard root."
    )
    candidates["reverificationLedger"] = "data/session-7d64f506/live-reads-2026-10-23.json"
    for row in candidates["candidates"]:
        read = reads[row["id"]]
        row["retrievedDate"] = DATE
        row["reverification"] = {
            "at": DATE,
            "pass": PASS_ID,
            "session": SESSION,
            "observedAt": read["observedAt"],
            "channel": read["channel"],
            "readUrl": read["readUrl"],
            "verdict": read["verdict"],
            "quotes": read["quotes"],
            "note": read["note"],
        }
    save("research/candidates.json", candidates)

    # --- market reference ----------------------------------------------
    market = load("research/policy/market.json")
    per_gram_live = live_feed["priceUsdPerOzt"] / market["conversion"]["gramsPerTroyOunce"]
    market["retrievedDate"] = DATE
    market["liveFeed"] = {
        "publisher": live_feed["publisher"],
        "url": live_feed["url"],
        "sourceTimestamp": live_feed["publisherTimestamp"],
        "currency": "USD",
        "spotPerTroyOunce": live_feed["priceUsdPerOzt"],
        "derivedPerGram": round(live_feed["priceUsdPerOzt"] / market["conversion"]["gramsPerTroyOunce"], 10),
        "quote": live_feed["quote"],
        "observedBy": SESSION,
        "observedAt": live_feed["observedAt"],
        "snapshotWarning": (
            "A spot feed reading, not a dealer quote, a resale offer or an appraisal. The calculator still "
            "uses the named Kitco Live GoldPrice panel below so its arithmetic stays reproducible against the "
            "audited snapshot; this reading is published beside it so the gap between the two is visible "
            "instead of hidden."
        ),
    }
    market["freshnessNote"] = (
        "The calculator reference (source) is the Kitco Live GoldPrice panel as of Oct 22, 2026 - 19:11 NY "
        "Time (bid $4,025.00 per troy ounce, displayed $129.41 per gram). An independent gold-api.com spot "
        f"read on {live_feed['publisherTimestamp']} published {live_feed['priceUsdPerOzt']} USD per troy "
        f"ounce (${live_feed['priceUsdPerOzt']:,.6f} = {per_gram_live:.2f} per gram). Both carry their own "
        "publisher timestamps; neither is blended, averaged or substituted."
    )
    save("research/policy/market.json", market)

    # --- irregularities -------------------------------------------------
    issues = load("research/irregularities.json")
    existing = {issue["id"] for issue in issues["irregularities"]}
    per_gram_live = live_feed["priceUsdPerOzt"] / market["conversion"]["gramsPerTroyOunce"]
    new_issues = [
        {
            "id": "market-reference-snapshot-age",
            "severity": "review-before-order",
            "status": "open",
            "title": "The calculator's gold reference is a dated snapshot, not a live quote",
            "affectedCandidateIds": [],
            "finding": (
                f"The calculator reference is the Kitco Live GoldPrice panel at Oct 22, 2026 - 19:11 NY Time "
                f"(bid $4,025.00 per troy ounce, displayed $129.41 per gram). An independent gold-api.com spot "
                f"read on 2026-10-23T23:38:16Z published {live_feed['priceUsdPerOzt']:.6f} USD per troy ounce "
                f"({per_gram_live:.2f} per gram). Both are stored with their own publisher timestamps in "
                f"research/policy/market.json."
            ),
            "action": (
                "Read the timestamp next to any gold figure before using it. The calculator prints the named "
                "Kitco panel and its timestamp and never blends the two readings; re-open the official page "
                "before relying on a melt figure, and remember melt value is a floor, not a price."
            ),
            "sourceBasis": "research/policy/market.json (source and liveFeed), each with a publisher timestamp.",
        },
        {
            "id": "blue-nile-item-195639-repurposed",
            "severity": "review-before-order",
            "status": "open",
            "title": "Blue Nile item 195639 has been repurposed to a different ring",
            "affectedCandidateIds": ["bn-501130y14"],
            "finding": (
                "Read live on 2026-10-23T23:41Z, the official item-195639 URL sells 'Petite Solitaire "
                "Engagement Ring in 14k Yellow Gold', Stock Number 501130y14, Metal 14K Yellow Gold, Width "
                "1.80mm, $1,000 (Setting Price) — which is this row. The canonical 71-row dataset on the "
                "dashboard root held a different ring at the same item number ('Petite Micropave', 1.50 mm, "
                "platinum prongs) and withdrew that row as a source mismatch (root flag F65). A seller may "
                "reuse an item number or URL for a different product."
            ),
            "action": (
                "Never trust an item number or URL alone. Re-open the official page immediately before "
                "ordering and check the product name, stock number and width against what you intend to buy; "
                "keep the listing text with the receipt."
            ),
            "sourceUrl": (
                "https://www.bluenile.com/engagement-rings/design-your-own-ring/"
                "petite-solitaire-engagement-ring-in-14k-yellow-gold-item-195639"
            ),
            "quote": "Stock Number 501130y14; Metal 14K Yellow Gold; Width 1.80mm; $1,000(Setting Price)",
        },
        {
            "id": "compare-at-price-not-market-value",
            "severity": "source-quality-warning",
            "status": "open",
            "title": "A seller's strikethrough 'compare at' price is not evidence of value",
            "affectedCandidateIds": ["trax-70689"],
            "finding": (
                "The seller's own product feed for item 70689 publishes price 300000 ($3,000) beside "
                "compare_at_price 570000 ($5,700). The larger figure is a seller-set marketing reference; it "
                "was read on 2026-10-23T23:46Z and is deliberately not stored as a catalog value."
            ),
            "action": (
                "Judge price against the ring's published gold weight and the current gold price, not against "
                "a strikethrough figure. No discount claim on this dashboard is based on a compare-at price."
            ),
            "sourceUrl": (
                "https://traxnyc.com/products/ladies-rings-radiant-spark-engagement-ring-item70689.js"
            ),
            "quote": '"price":300000,"price_min":300000,"price_max":300000,"available":true,"price_varies":false,"compare_at_price":570000',
        },
        {
            "id": "shopify-weight-field-is-parcel-weight",
            "severity": "blocks-raw-gold-claim",
            "status": "open",
            "title": "The machine-readable weight field is shipping weight, not gold weight",
            "affectedCandidateIds": [
                "trax-71345", "trax-70114", "trax-71851", "trax-70689", "trax-66233", "trax-70589",
            ],
            "finding": (
                "Read on 2026-10-23, the seller's own product feeds carry a variant weight field of 3 or 4 "
                "grams (and 0 on some yellow-gold variants of item 66233) while the seller's own prose states "
                "the metal weight: item 71345 'on 14K gold at 2.80 grams', item 71851 'the ring weighs 3.00 "
                "grams', item 66233 'The ring weighs 3.20 grams'. The feed field is the parcel/shipment "
                "weight. Three stored weights (70689 3.8 g, 70589 2.9 g, 70114 2 g) appear only in the product "
                "page spec table and not in the feed."
            ),
            "action": (
                "Never read a platform weight field as gold weight. Only a weight the seller states for the "
                "piece, with its basis disclosed, is used here — and a listed weight is still not a verified "
                "net metal weight."
            ),
            "sourceBasis": (
                "data/session-7d64f506/live-reads-2026-10-23.json: feed weight fields versus the seller's own "
                "gram statements for the same products."
            ),
        },
        {
            "id": "secondary-dashboards-are-dated-snapshots",
            "severity": "review-before-order",
            "status": "open",
            "title": "Two published dashboards beside the root are bounded, dated snapshots",
            "affectedCandidateIds": [],
            "finding": (
                "Besides the canonical dashboard at the site root, GitHub Pages also serves /site/ (this "
                "13-row official-source review, re-read 2026-10-23) and /docs/ (a 14-row dashboard dated "
                "2026-10-22 whose gold anchor is dated 2026-10-21 at $4,024.36 per troy ounce and where 7 of "
                "14 prices are marked unverified). Neither is the full catalogue."
            ),
            "action": (
                "Treat /site/ and /docs/ as dated evidence snapshots. For the full verified catalogue use the "
                "dashboard root, and always re-open the seller's own page before ordering."
            ),
            "sourceBasis": (
                "site/index.html, docs/index.html and data/rings_c2bbe753.json as published on GitHub Pages."
            ),
        },
        {
            "id": "legacy-generator-wrote-to-repo-root",
            "severity": "source-quality-warning",
            "status": "resolved-with-record",
            "title": "A dormant first-pass generator could overwrite the published dashboard",
            "affectedCandidateIds": [],
            "finding": (
                "tools/build_site.py (the first-pass generator, dormant since 2026-10-22) had OUT set to the "
                "repository root and listed index.html, flagged.html and calculator.html among the pages it "
                "writes — the same filenames as the canonical published dashboard. Running it would have "
                "overwritten 71-row pages with 14-row pages."
            ),
            "action": (
                "Fixed on 2026-10-23 (board T52): the script now refuses to write to the repository root and "
                "requires an explicit --allow-regenerate flag; its default output is docs/. No generated page "
                "was overwritten by this change."
            ),
            "sourceBasis": "tools/build_site.py before and after the 2026-10-23 change in this branch.",
        },
    ]
    for issue in new_issues:
        if issue["id"] not in existing:
            issues["irregularities"].append(issue)
    issues["retrievedDate"] = DATE
    save("research/irregularities.json", issues)

    # --- publish: byte-sync site/data from research ---------------------
    pairs = [
        ("research/candidates.json", "site/data/candidates.json"),
        ("research/sellers.json", "site/data/sellers.json"),
        ("research/irregularities.json", "site/data/irregularities.json"),
        ("research/policy/market.json", "site/data/market.json"),
        ("research/policy/verification.json", "site/data/verification.json"),
    ]
    for source, destination in pairs:
        shutil.copyfile(os.path.join(ROOT, source), os.path.join(ROOT, destination))

    print(f"candidates: {len(candidates['candidates'])} rows re-verified on {DATE}")
    print(f"irregularities: {len(issues['irregularities'])} groups")
    print(f"live feed: {live_feed['priceUsdPerOzt']} USD/ozt @ {live_feed['publisherTimestamp']} "
          f"= {per_gram_live:.10f}/g")
    print("published copies byte-synced: " + ", ".join(destination for _, destination in pairs))


if __name__ == "__main__":
    main()
