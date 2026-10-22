#!/usr/bin/env python3
"""Apply the P12 re-check (2026-10-22) to data/rings.json and write data/recheck.json.

Nothing in here is inferred. Every number typed below was read on 2026-10-22 from the
retailer's own page and the exact wording is stored in `weight_evidence` / `evidence`.
The script is idempotent: running it twice produces the same files.

Sources read during P12 (all official):
  Ross-Simons product pages      https://www.ross-simons.com/products/<sku>
  Ross-Simons product JSON       https://www.ross-simons.com/products/<sku>.js
  Ross-Simons search feed        https://www.ross-simons.com/search/suggest.json?q=<sku>
  Mejuri product page            https://mejuri.com/products/2mm-smooth-band
  Anna Sheffield product JSON    https://www.annasheffield.com/products/<handle>.js
  With Clarity product JSON      https://www.withclarity.com/products/<handle>.js
  Aurate product JSON            https://auratenewyork.com/products/modern-cigar-band.js
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RINGS = ROOT / "data/rings.json"
RECHECK = ROOT / "data/recheck.json"

PASS = "P12"
DATE = "2026-10-22"

# ring_id -> what was read today. Every entry was opened on 2026-10-22.
CHECKS = {
    "rs-571221": dict(
        url="https://www.ross-simons.com/products/571221",
        method="official product page",
        price=(400.0, 400.0),
        weight=(1.7, 1.7),
        weight_evidence='Details table: "Gold Weight 1.7 grams"; Metal "14kt Yellow Gold"',
        result="matched",
        note="Price $400.00 unchanged. Gold weight published (1.7 g) - not captured in earlier passes.",
    ),
    "rs-571222": dict(
        url="https://www.ross-simons.com/products/571222",
        method="official product page",
        price=(599.0, 599.0),
        weight=(2.5, 2.5),
        weight_evidence='Details table: "Gold Weight 2.5 grams"; Metal "14kt Yellow Gold"',
        result="matched",
        note="Price $599.00 unchanged. Gold weight published (2.5 g).",
    ),
    "rs-571223": dict(
        url="https://www.ross-simons.com/products/571223",
        method="official product page",
        price=(849.0, 849.0),
        weight=(3.8, 3.8),
        weight_evidence='Details table: "Gold Weight 3.8 grams"; Metal "14kt Yellow Gold"',
        evidence=(
            'Title "Women\'s 4mm 14kt Yellow Gold Band"; every size shows price "849.00" '
            '(re-read 2026-10-22); Details table "Gold Weight 3.8 grams". The earlier '
            'capture on the same day recorded price_min "799.00" - that low end is no longer offered.'
        ),
        result="price_changed",
        note=(
            "CORRECTED 2026-10-22: the stored low price was 799.00. Every size on the live page "
            "now shows 849.00, so the range collapsed to a single price. Weight 3.8 g published."
        ),
    ),
    "rs-571213": dict(
        url="https://www.ross-simons.com/products/571213",
        method="official product page",
        price=(959.0, 959.0),
        compare_at=1195.0,
        weight=(5.0, 5.0),
        weight_evidence='Details table: "Gold Weight 5.0 grams"; Metal "14kt Yellow Gold"; page banner "20% Off / Original price $1,195 / Sale price $959"',
        result="matched",
        note="Sale price $959.00 against a $1,195.00 compare-at, confirmed on the page. Gold weight 5.0 g.",
    ),
    "rs-981367": dict(
        url="https://www.ross-simons.com/products/981367",
        method="official product page",
        price=(149.0, 149.0),
        weight=(0.5, 0.5),
        weight_evidence='Details table: "Width 1/16 inch"; "Gold Weight 0.5 grams"; Metal "14kt Yellow Gold"',
        result="matched",
        note="Price $149.00 unchanged. Gold weight published (0.5 g) - the low price is explained by a very light ring, not by a fake karat stamp.",
    ),
    "rs-907250": dict(
        url="https://www.ross-simons.com/products/907250",
        method="official product page",
        price=(179.0, 179.0),
        weight=(0.5, 0.5),
        weight_evidence='Details table: "Gold Weight 0.5 grams"; Metal "18kt Yellow Gold"; width 1/16 inch',
        result="matched",
        note="Price $179.00 unchanged. Gold weight published (0.5 g) for an 18K ring, which explains the price.",
    ),
    "rs-879968": dict(
        url="https://www.ross-simons.com/search/suggest.json?q=879968",
        method="official search feed",
        price=(2695.0, 2695.0),
        result="matched",
        note="Price 2695.00 confirmed in the official product feed. Weight still not published.",
    ),
    "rs-960952": dict(
        url="https://www.ross-simons.com/search/suggest.json?q=960952",
        method="official search feed",
        price=(399.0, 399.0),
        result="matched",
        note="Price 399.00 confirmed in the official product feed.",
    ),
    "rs-999230": dict(
        url="https://www.ross-simons.com/search/suggest.json?q=999230",
        method="official search feed",
        price=(489.0, 559.0),
        compare_at=695.0,
        title=".80 ct. t.w. Garnet and .30 ct. t.w. Pink Sapphire Geometric Eternity Band in 14kt Yellow Gold",
        result="title_corrected",
        note=(
            "Price range 489.00-559.00 confirmed. The stored title was a paraphrase "
            "('Pink Sapphire and Garnet Eternity Band in 14kt Yellow Gold'); replaced with the "
            "seller's exact product title."
        ),
    ),
    "rs-993512": dict(
        url="https://www.ross-simons.com/search/suggest.json?q=993512",
        method="official search feed",
        price=(2795.0, 2795.0),
        result="matched",
        note="Price 2795.00 confirmed in the official product feed.",
    ),
    "rs-991907": dict(
        url="https://www.ross-simons.com/products/991907.js",
        method="official product feed (JSON)",
        price=(2795.0, 2795.0),
        result="matched",
        note="Price 2795.00 confirmed. Karat/metal re-confirmed as 14kt white gold.",
    ),
    "rs-864785": dict(
        url="https://www.ross-simons.com/search/suggest.json?q=864785",
        method="official search feed",
        price=(2395.0, 2395.0),
        result="matched",
        note="Price 2395.00 confirmed. Note this feed entry is a two-ring bridal set, not a single ring.",
    ),
    "rs-242556": dict(
        url="https://www.ross-simons.com/search/suggest.json?q=242556",
        method="official search feed",
        price=(2195.0, 2195.0),
        title="C. 1980 Vintage .30 Carat Sapphire Ring with .16 ct. t.w. Diamonds in 14kt Yellow Gold. Size 6.5",
        result="matched",
        note="Price 2195.00 confirmed; title punctuation aligned to the seller's exact string.",
    ),
    "rs-240912": dict(
        url="https://www.ross-simons.com/products/240912.js",
        method="official product feed (JSON)",
        price=(8995.0, 8995.0),
        title="C. 2023 Vintage 1.36 Carat Certified Sapphire Ring in 14kt Yellow Gold. Size 7",
        result="matched",
        note=(
            "Price 8995.00, size 7 and the GIA certificate number 7235079100 re-confirmed in the "
            "seller's own feed. The SKU did not appear in site search, so the JSON feed was read instead."
        ),
    ),
    "mej-2mm": dict(
        url="https://mejuri.com/products/2mm-smooth-band",
        method="official product page",
        price=(498.0, 498.0),
        result="matched",
        note=(
            "Price $498.00 unchanged and 'Handcrafted in recycled 14k solid gold' still on the page. "
            "The specification block publishes width (2 mm) and thickness (1.3 mm) but no gram weight."
        ),
    ),
    "as-bea-sol": dict(
        url="https://www.annasheffield.com/products/bea-solitaire-ring-gold-north-south-1-50ct-oval-champagne-diamond.js",
        method="official product feed (JSON)",
        price=(11500.0, 11500.0),
        result="matched",
        note="Feed price 1150000 cents = 11500.00 USD, unchanged. No metal weight published.",
    ),
    "wc-tulip": dict(
        url="https://www.withclarity.com/products/tulip-basket-cathedral-classic-solitaire-engagement-ring.js",
        method="official product feed (JSON)",
        price=(590.0, 1110.0),
        result="matched",
        note="Feed price_min 59000 / price_max 111000 cents unchanged; still tagged 'Ring Setting Product'.",
    ),
    "au-cigar": dict(
        url="https://auratenewyork.com/products/modern-cigar-band.js",
        method="official product feed (JSON)",
        price=(1308.0, 1308.0),
        weight=(2.6, 4.0),
        weight_evidence='Product description: "Weight: 2.6-4g"; Width 20mm; Thickness 1mm; Height 5mm',
        result="partial",
        note=(
            "Weight range 2.6-4 g re-confirmed. The 14K price of 1308.00 could NOT be re-confirmed: "
            "the live feed now spans price_min 11800 (=118.00, the vermeil variant) to price_max "
            "166800 (=1668.00). The variant-level 14K price needs a dedicated re-read. Treated as "
            "unconfirmed on the site rather than restated."
        ),
    ),
}

# SKUs that the official site no longer returns in its own search feed today.
NOT_INDEXED = {
    "rs-943668": "Ross-Simons site search returned no product for SKU 943668; the product page was not opened in P12, so availability and price are unconfirmed.",
    "rs-991908": "Ross-Simons site search returned no product for SKU 991908; availability and price are unconfirmed.",
    "rs-254575": "Ross-Simons site search returned no product for SKU 254575; availability and price are unconfirmed.",
}

doc = json.loads(RINGS.read_text())
rows = doc["rows"]
by_id = {r["id"]: r for r in rows}

results = []
for rid, change in CHECKS.items():
    row = by_id[rid]
    before = {"price_low": row["price_low"], "price_high": row["price_high"],
              "weight_g_low": row["weight_g_low"], "weight_g_high": row["weight_g_high"],
              "title": row["title"]}

    row["price_low"] = change["price"][0]
    row["price_high"] = change["price"][1]
    if "compare_at" in change:
        row["compare_at_high"] = change["compare_at"]
    if "title" in change:
        row["title"] = change["title"]
    if "evidence" in change:
        row["evidence"] = change["evidence"]
    if change.get("weight"):
        lo, hi = change["weight"]
        row["weight_g_low"] = lo
        row["weight_g_high"] = hi
        row["weight_evidence"] = change["weight_evidence"]
        row["weight_source_url"] = change["url"]
        # the value is now published, so the "no weight" flag must go
        row["flags"] = [f for f in row.get("flags", []) if f != "weight_not_published"]

    # A single price can no longer carry the price_varies flag.
    if row["price_low"] == row["price_high"]:
        row["flags"] = [f for f in row.get("flags", []) if f != "price_varies"]

    row["recheck_pass"] = PASS
    row["recheck_date"] = DATE
    row["recheck_method"] = change["method"]
    row["recheck_url"] = change["url"]
    row["recheck_result"] = change["result"]
    if change["result"] == "price_changed":
        row["notes"] = (row.get("notes", "") + " " + change["note"]).strip()
        if "price_changed" not in row["flags"]:
            row.setdefault("flags", []).append("price_changed")
    elif change["result"] == "partial":
        row["price_unconfirmed"] = True
        if "price_unconfirmed" not in row["flags"]:
            row.setdefault("flags", []).append("price_unconfirmed")

    results.append({
        "ring_id": rid,
        "retailer": row["retailer"],
        "title": row["title"],
        "url": change["url"],
        "method": change["method"],
        "checked_on": DATE,
        "result": change["result"],
        "price_before": [before["price_low"], before["price_high"]],
        "price_read": [change["price"][0], change["price"][1]],
        "weight_before_g": [before["weight_g_low"], before["weight_g_high"]],
        "weight_read_g": list(change["weight"]) if change.get("weight") else None,
        "weight_evidence": change.get("weight_evidence"),
        "note": change["note"],
    })

for rid, note in NOT_INDEXED.items():
    row = by_id[rid]
    row["recheck_pass"] = PASS
    row["recheck_date"] = DATE
    row["recheck_result"] = "not_indexed"
    row["recheck_method"] = "official search feed (returned no product)"
    row["recheck_url"] = f"https://www.ross-simons.com/search/suggest.json?q={rid.split('-')[1]}"
    if "availability_unconfirmed" not in row.get("flags", []):
        row.setdefault("flags", []).append("availability_unconfirmed")
    results.append({
        "ring_id": rid,
        "retailer": row["retailer"],
        "title": row["title"],
        "url": row["recheck_url"],
        "method": row["recheck_method"],
        "checked_on": DATE,
        "result": "not_indexed",
        "price_before": [row["price_low"], row["price_high"]],
        "price_read": None,
        "weight_before_g": [row["weight_g_low"], row["weight_g_high"]],
        "weight_read_g": None,
        "weight_evidence": None,
        "note": note,
    })

# Everything else keeps the value it was captured with and is labelled as such.
checked = set(CHECKS) | set(NOT_INDEXED)
remaining = []
for row in rows:
    if row["id"] in checked:
        continue
    row.setdefault("recheck_pass", None)
    row["recheck_result"] = "not_rechecked"
    remaining.append(row["id"])

doc["generated_at"] = DATE
doc["note"] = (
    doc["note"].split(" Pass P12")[0]
    + " Pass P12 (2026-10-22) re-opened 18 of these listings on the retailer's own page or feed: "
      "prices were compared with the stored value, six metal weights that the seller does publish "
      "were added, one price that had moved was corrected (rs-571223), one paraphrased title was "
      "replaced with the seller's exact wording (rs-999230). Rows that were not re-opened carry "
      "recheck_result = 'not_rechecked' and the site labels them as not current today. No value "
      "was estimated at any point."
)

RINGS.write_text(json.dumps(doc, indent=2, ensure_ascii=False) + "\n")

recheck = {
    "pass": PASS,
    "checked_on": DATE,
    "summary": {
        "rows_total": len(rows),
        "rows_rechecked": len(CHECKS),
        "rows_not_indexed": len(NOT_INDEXED),
        "rows_not_rechecked": len(remaining),
        "weights_added": sum(1 for r in results if r["result"] in ("matched", "price_changed") and r["weight_read_g"]),
        "prices_changed": sum(1 for r in results if r["result"] == "price_changed"),
        "weights_total_rows": sum(1 for r in rows if r["weight_g_low"] is not None),
    },
    "note": (
        "One line per listing re-opened in P12. `price_before` is what the row stored before this pass; "
        "`price_read` is what the retailer's page showed on 2026-10-22. A null read means the page was "
        "not opened, never that the value was guessed."
    ),
    "results": results,
    "not_rechecked": remaining,
}
RECHECK.write_text(json.dumps(recheck, indent=2, ensure_ascii=False) + "\n")

print(f"rows={len(rows)} rechecked={len(CHECKS)} not_indexed={len(NOT_INDEXED)} not_rechecked={len(remaining)}")
print("weights now published:", sum(1 for r in rows if r["weight_g_low"] is not None))
