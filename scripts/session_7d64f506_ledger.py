#!/usr/bin/env python3
"""sess-7d64f506 (board T50) — write the live re-read ledger for the /site/ register.

Every quote below was transcribed from the seller's own official page (or the
seller's own product JSON feed for that same product) during the 2026-10-23
23:38Z-23:48Z reads. Nothing is paraphrased and nothing is inferred: if a value
could not be read, it is recorded as not read.
"""
from __future__ import annotations

import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

READS = [
    dict(
        id="trax-71345", seller="traxnyc",
        readUrl="https://traxnyc.com/products/3-ct-marquise-diamond-engagement-ring-70845.js",
        channel="seller's own Shopify product JSON (.js) for the official product URL",
        quotes=[
            '"title":"14K Gold Marquise Lab-Grown Diamond Engagement Ring 3 CT 71345"',
            '"price":250000,"price_min":250000,"price_max":250000,"available":true,"price_varies":false',
            "All of them sit in prongs, on 14K gold at 2.80 grams.",
            '"sku":"71345"',
        ],
        observedAt="2026-10-23T23:43Z", verdict="confirmed_exact",
        note=("Stored $2,500 reproduced exactly (250000 cents). The seller's own description also states "
              "2.80 grams, corroborating the stored 2.8 g on a second channel. The feed's variant weight "
              "field reads 3 — that is the parcel weight and was not used as metal weight."),
    ),
    dict(
        id="trax-70114", seller="traxnyc",
        readUrl="https://traxnyc.com/products/solitaire-emerald-lab-grown-diamond-engagement-ring.js",
        channel="seller's own Shopify product JSON (.js) for the official product URL",
        quotes=[
            '"title":"Solitaire Emerald Lab-Grown Diamond Engagement Ring 70114"',
            '"price":180000,"price_min":180000,"price_max":209000,"available":true,"price_varies":true',
            "a 2 carat emerald-cut lab grown diamond with VVS clarity, set in solid 14K gold",
        ],
        observedAt="2026-10-23T23:43Z",
        verdict="confirmed_base_price_with_disclosed_surcharges",
        note=("Stored $1,800 is the base variant price (Yellow / 5); the feed's price_max 209000 ($2,090) is "
              "the size-surcharge ceiling, consistent with the stored '5.5+$80' basis. The stored 2 g appears "
              "only in the PDP spec table, not in this feed."),
    ),
    dict(
        id="trax-71851", seller="traxnyc",
        readUrl="https://traxnyc.com/products/two-tone-radiant-solitaire-ring.js",
        channel="seller's own Shopify product JSON (.js) for the official product URL",
        quotes=[
            '"title":"14K Gold Two-Tone Radiant Solitaire Engagement Ring 71851"',
            '"price":200000,"price_min":200000,"price_max":229000,"available":true,"price_varies":true',
            "this two-tone solitaire engagement ring in solid 14K gold",
            "on a band 1.70 mm wide, and the ring weighs 3.00 grams",
        ],
        observedAt="2026-10-23T23:45Z", verdict="confirmed_exact",
        note="Stored $2,000 base price and 3.0 g both reproduced by the seller's own feed description.",
    ),
    dict(
        id="trax-70689", seller="traxnyc",
        readUrl="https://traxnyc.com/products/ladies-rings-radiant-spark-engagement-ring-item70689.js",
        channel="seller's own Shopify product JSON (.js) for the official product URL",
        quotes=[
            '"title":"18K Gold Radiant Spark Lab-Grown Diamond Engagement Ring 70689"',
            '"price":300000,"price_min":300000,"price_max":300000,"available":true,"price_varies":false,'
            '"compare_at_price":570000',
            "centers a 2 carat radiant-cut lab grown diamond in solid 18K gold",
        ],
        observedAt="2026-10-23T23:46Z", verdict="confirmed_exact",
        note=("Stored $3,000 reproduced exactly with no size variance. The feed also carries a compare-at price "
              "of 570000 ($5,700) — a seller-set strikethrough reference, deliberately NOT stored as a value "
              "(see irregularity compare-at-price-not-market-value). The stored 3.8 g appears only in the PDP "
              "spec table."),
    ),
    dict(
        id="trax-66233", seller="traxnyc",
        readUrl="https://traxnyc.com/products/ladies-ladies-diamond-rings-engagement-18k-white-gold-engagement-diamond-ring-item66233.js",
        channel="seller's own Shopify product JSON (.js) for the official product URL",
        quotes=[
            '"title":"18K White Gold Engagement Diamond Ring 66233"',
            '"price":350000,"price_min":350000,"price_max":389000,"available":true,"price_varies":true',
            "The ring weighs 3.20 grams, so the center stone leads and the band stays out of its way.",
        ],
        observedAt="2026-10-23T23:47Z", verdict="confirmed_exact",
        note=("Stored $3,500 base and 3.2 g reproduced. Feed weight fields read 3 (white-gold variants) and 0 "
              "(yellow-gold variants) — parcel weights, not metal."),
    ),
    dict(
        id="trax-70589", seller="traxnyc",
        readUrl="https://traxnyc.com/products/ladies-rings-material-aurora-2ct-oval-engagement-ring-item70589.js",
        channel="seller's own Shopify product JSON (.js) for the official product URL",
        quotes=[
            '"title":"18K Gold Aurora 2ct Oval Lab-Grown Diamond Engagement Ring 70589"',
            '"price":325000,"price_min":325000,"price_max":376000,"available":true,"price_varies":true',
            "In 18K white gold, the cool setting sharpens the contrast between metal and diamond",
        ],
        observedAt="2026-10-23T23:48Z",
        verdict="confirmed_base_price_with_disclosed_surcharges",
        note=("Stored $3,250 is the base variant price (White / 4); price_max 376000 ($3,760) is the size "
              "ceiling, consistent with the stored '4.5+$150' basis. The stored 2.9 g appears only in the PDP "
              "spec table."),
    ),
    dict(
        id="bn-501130y14", seller="blue-nile",
        readUrl="https://www.bluenile.com/engagement-rings/design-your-own-ring/petite-solitaire-engagement-ring-in-14k-yellow-gold-item-195639",
        channel="official product page (page-fetch)",
        quotes=[
            "# Petite Solitaire Engagement Ring in 14k Yellow Gold",
            "Stock Number 501130y14",
            "Metal 14K Yellow Gold",
            "Width 1.80mm",
            "$1,000(Setting Price)",
        ],
        observedAt="2026-10-23T23:41Z", verdict="confirmed_exact",
        note=("Blue Nile item number 195639 previously resolved to a Petite Micropave setting (1.50 mm, platinum "
              "prongs); the canonical root dataset withdrew that row as a source mismatch (flag F65). What the "
              "URL sells today is the Petite Solitaire 501130y14 at $1,000 — exactly this row. Recorded so the "
              "two rows are never confused."),
    ),
    dict(
        id="bn-500000y14", seller="blue-nile",
        readUrl="https://www.bluenile.com/engagement-rings/design-your-own-ring/classic-four-prong-solitaire-engagement-ring-in-14k-yellow-gold-item-203257",
        channel="official product page (page-fetch)",
        quotes=[
            "# Classic Four Prong Solitaire Engagement Ring in 14K Yellow Gold",
            "Stock Number 500000y14",
            "Metal 14K Yellow Gold",
            "Width 1.90mm",
            "$870(Setting Price)",
            "this classic 14k yellow gold four-prong solitaire engagement ring with platinum prongs",
        ],
        observedAt="2026-10-23T23:41Z", verdict="confirmed_exact",
        note=("Stored $870 reproduced. The description re-confirms platinum prongs on a 14K yellow-gold shank "
              "(irregularity mixed-metal-components)."),
    ),
    dict(
        id="bn-501140y", seller="blue-nile",
        readUrl="https://www.bluenile.com/engagement-rings/design-your-own-ring/classic-six-prong-solitaire-engagement-ring-in-18k-yellow-gold-item-194159",
        channel="official product page (page-fetch)",
        quotes=[
            "# Classic Six-Prong Solitaire Engagement Ring in 18k Yellow Gold",
            "Stock Number 501140y",
            "Metal 18K Yellow Gold",
            "Width 1.90mm",
            "$1,240(Setting Price)",
        ],
        observedAt="2026-10-23T23:41Z", verdict="confirmed_exact",
        note="Stored $1,240 reproduced exactly.",
    ),
    dict(
        id="bn-502690y14", seller="blue-nile",
        readUrl="https://www.bluenile.com/engagement-rings/design-your-own-ring/east-west-solitaire-in-14k-yellow-gold-item-193755",
        channel="official product page (page-fetch)",
        quotes=[
            "# East West Solitaire in 14k Yellow Gold",
            "Stock Number 502690y14",
            "Metal 14K Yellow Gold",
            "Width 2.00mm",
            "$1,050(Setting Price)",
        ],
        observedAt="2026-10-23T23:41Z", verdict="confirmed_exact",
        note="Stored $1,050 reproduced exactly.",
    ),
    dict(
        id="be-BE1199H6-18KY", seller="brilliant-earth",
        readUrl="https://www.brilliantearth.com/Six-Prong-Petite-Comfort-Fit-1.5mm-Solitaire-Ring-Gold-BE1199H6-1912137/",
        channel="official product page (page-fetch)",
        quotes=[
            "# Six-Prong Petite Comfort Fit 1.5mm Solitaire Ring in 18K Yellow Gold",
            "$850(Setting Only)",
            "Style: BE1199H6-18KY",
            "Metal: 18K Yellow Gold",
            "Prong metal: 14K White Gold",
            "Width: 1.5 mm",
        ],
        observedAt="2026-10-23T23:44Z", verdict="confirmed_exact",
        note=("Stored $850 reproduced exactly. Prong metal re-confirmed as 14K white gold on an 18K yellow-gold "
              "setting (mixed-metal-components). The page currency selector read USD."),
    ),
    dict(
        id="be-BE1D1009-18KY", seller="brilliant-earth",
        readUrl="https://www.brilliantearth.com/Andrea-Bezel-Prong-Ring-Gold-BE1D1009-39303615/",
        channel="official product page (page-fetch)",
        quotes=[
            "# Andrea Bezel Prong Ring in 18K Yellow Gold",
            "$1,950(Setting Only)",
            "Style: BE1D1009-18KY",
            "Metal: 18K Yellow Gold",
            "Width: 3 mm",
            "Setting: Claw Prong",
        ],
        observedAt="2026-10-23T23:45Z", verdict="confirmed_exact",
        note="Stored $1,950 reproduced exactly.",
    ),
    dict(
        id="be-BE1D1009-14KY", seller="brilliant-earth",
        readUrl="https://www.brilliantearth.com/Andrea-Bezel-Prong-Ring-14K-Gold-BE1D1009-76788518/",
        channel="official product page (page-fetch)",
        quotes=[
            "# Andrea Bezel Prong Ring in 14K Yellow Gold",
            "$1,750(Setting Only)",
            "Style: BE1D1009-14KY",
            "Metal: 14K Yellow Gold",
            "Width: 3 mm",
            "Setting: Claw Prong",
        ],
        observedAt="2026-10-23T23:46Z", verdict="confirmed_exact",
        note="Stored $1,750 reproduced exactly.",
    ),
]

LEDGER = {
    "schemaVersion": 1,
    "session": "sess-7d64f506",
    "branch": "arena/7d64f506-gold1",
    "boardTask": "T50",
    "pass": "T50-7d64f506",
    "date": "2026-10-23",
    "scope": (
        "Every row of the standalone /site/ 13-row evidence review (research/candidates.json) re-opened on "
        "this session's own clock at the seller's own official URL, plus an independent gold-price reading. "
        "The canonical 71-row root dataset was NOT touched: data/rings.json, data/flagged.json, "
        "data/gold-price.json, data/checks/**, scripts/build.mjs, scripts/verify.mjs, the generated root "
        "*.html and README.md are owned by the concurrent eleventh-pass sessions (T47/T48/T49)."
    ),
    "method": (
        "Bash egress in this sandbox is allowlist-only, so reads used the session page-fetch channel, as in "
        "COORDINATION.md §17 and §21. Shopify sellers were read through their own product JSON endpoint "
        "(officialProductUrl + '.js'), which is the seller's own feed for the same product; Brilliant Earth "
        "and Blue Nile were read on the product page itself. Nothing was taken from a search snippet, an "
        "aggregator, a screenshot or memory."
    ),
    "goldReadings": [
        {
            "publisher": "gold-api.com",
            "url": "https://api.gold-api.com/price/XAU",
            "quote": ('{"currency":"USD","currencySymbol":"$","exchangeRate":1.0,"name":"Gold",'
                      '"price":3996.899902,"symbol":"XAU","updatedAt":"2026-10-23T23:38:16Z"}'),
            "priceUsdPerOzt": 3996.899902,
            "publisherTimestamp": "2026-10-23T23:38:16Z",
            "observedAt": ["2026-10-23T23:38Z", "2026-10-23T23:41Z"],
            "note": "Read twice; both reads returned the same publisher timestamp and value.",
        },
        {
            "publisher": "Kitco Metals Inc. (retained audited snapshot, not re-read by this session)",
            "url": "https://www.kitco.com/charts/gold",
            "quote": "Oct 22, 2026 - 19:11 NY Time; Bid 4,025.00 USD; Ask 4,027.00; ounce 4,025.00; gram 129.41",
            "bidPerTroyOunce": 4025.0,
            "askPerTroyOunce": 4027.0,
            "publisherTimestamp": "Oct 22, 2026 - 19:11 NY Time",
            "observedAt": ["2026-10-22 (previous session, arena/c662efda-gold1)"],
            "note": ("Retained because research/policy/market.json names this panel as the calculator "
                     "reference and scripts/audit-evidence.js pins it. Not refreshed by this session."),
        },
    ],
    "reads": READS,
    "summary": {
        "rowsInRegister": 13,
        "rowsReopenedLive": 13,
        "confirmedExact": sum(1 for r in READS if r["verdict"] == "confirmed_exact"),
        "confirmedBasePriceWithDisclosedSurcharges": sum(
            1 for r in READS if r["verdict"].startswith("confirmed_base")
        ),
        "pricesChanged": 0,
        "weightsChanged": 0,
        "notRead": [],
        "statement": (
            "13 of 13 stored prices were reproduced by a live read on 2026-10-23. No stored value was changed, "
            "added or removed. Two rows carry the seller's own size surcharges above the stored base price and "
            "say so; the surcharge ceiling is recorded here and is not stored as a price."
        ),
    },
}


def main() -> None:
    target = os.path.join(ROOT, "data", "session-7d64f506", "live-reads-2026-10-23.json")
    os.makedirs(os.path.dirname(target), exist_ok=True)
    with open(target, "w", encoding="utf-8") as handle:
        json.dump(LEDGER, handle, indent=2, ensure_ascii=False)
        handle.write("\n")
    print(f"wrote {os.path.relpath(target, ROOT)}: {LEDGER['summary']}")


if __name__ == "__main__":
    main()
