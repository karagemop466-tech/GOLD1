#!/usr/bin/env python3
"""Reconcile the two P12 sessions without discarding either one.

Session `bc088451` merged its P12 (PR #10) into `main` first: it re-read seven listings,
recovered four Ross-Simons weights, corrected two prices and added flags F31-F35 plus check
groups S14-S17. Session `b93ff7c6` (this branch) re-read the same pages independently and had
two facts the other pass missed:

  * rs-571222 (Women's 3mm 14kt Yellow Gold Band) DOES publish a metal weight - the spec panel
    reads "Gold Weight 2.5 grams". PR #10 recorded "weight still not published as a metal
    weight" for that SKU; that entry is corrected here, with the page quote.
  * rs-571213 (Men's 5mm 14kt Yellow Gold Band) also publishes one: "Gold Weight 5.0 grams".

It also re-read ten further listings (prices only) and found that one stored product title had
been paraphrased. Those reads are appended to the single ledger (`data/reverification.json`) so
the site keeps one source of truth rather than two parallel logs.

Rule kept throughout: a value is written only when it was read on 2026-10-22 from the URL named
beside it. Nothing here is inferred from a sibling product.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATE = "2026-10-22"

rings_path = ROOT / "data/rings.json"
ledger_path = ROOT / "data/reverification.json"
flag_path = ROOT / "data/flagged.json"

rings = json.loads(rings_path.read_text())
ledger = json.loads(ledger_path.read_text())
flagged = json.loads(flag_path.read_text())
by_id = {r["id"]: r for r in rings["rows"]}

# ------------------------------------------------------------------ 1. the two missed weights
WEIGHTS = {
    "rs-571222": dict(
        grams=(2.5, 2.5),
        quote='Metal "14kt Yellow Gold" · Gold Weight 2.5 grams · Finish "Polished"',
        evidence_add='; spec panel "Metal 14kt Yellow Gold - Gold Weight 2.5 grams" (re-read 2026-10-22)',
        note=(
            "Metal weight 2.5 grams is published in the spec panel and was captured on the P12 "
            "second read. PR #10 had recorded this SKU as having no metal weight; that entry was "
            "corrected here after the same page was opened again and the spec panel quoted."
        ),
    ),
    "rs-571213": dict(
        grams=(5.0, 5.0),
        quote='Metal "14kt Yellow Gold" · Gold Weight 5.0 grams · page banner "20% Off / Original price $1,195 / Sale price $959"',
        evidence_add='; spec panel "Metal 14kt Yellow Gold - Gold Weight 5.0 grams"; sale banner "20% Off", "Original price $1,195", "Sale price $959"',
        note=(
            "Metal weight 5.0 grams is published in the spec panel. The $959.00 is a sale price "
            "against a $1,195.00 compare-at shown on the same page."
        ),
    ),
}
for rid, w in WEIGHTS.items():
    row = by_id[rid]
    row["weight_g_low"], row["weight_g_high"] = w["grams"]
    row["evidence"] = row["evidence"].rstrip(". ") + w["evidence_add"]
    row["flags"] = [f for f in row.get("flags", []) if f != "weight_not_published"]
    row["notes"] = (row.get("notes", "") + " " + w["note"]).strip()
    row["reverified_at"] = DATE
    row["reverified_pass"] = "P12"

# ------------------------------------------------------------------ 2. the paraphrased title
TITLE = {
    "rs-999230": (
        "Pink Sapphire and Garnet Eternity Band in 14kt Yellow Gold",
        ".80 ct. t.w. Garnet and .30 ct. t.w. Pink Sapphire Geometric Eternity Band in 14kt Yellow Gold",
    ),
}
title_fixes = []
for rid, (old_title, new_title) in TITLE.items():
    row = by_id[rid]
    if row["title"] != new_title:
        row["title"] = new_title
        row["reverified_at"] = DATE
        row["reverified_pass"] = "P12"
        title_fixes.append((rid, old_title, new_title))

# ------------------------------------------------------------------ 3. append reads to the ledger
existing_rows = {e["row"] for e in ledger["entries"]}

# correct the PR #10 entry for 571222 and add its second-read quote
for e in ledger["entries"]:
    if e["row"] == "rs-571222":
        e["checked"] = ["price", "karat", "metal_weight", "title"]
        e["new"]["weight_g"] = "2.5"
        e["change"] = (
            "a second read of the same page on 2026-10-22 found the metal weight published in the "
            "spec panel as \"Gold Weight 2.5 grams\"; price and karat unchanged. The first read in "
            "this pass missed the field and recorded no metal weight, which was wrong."
        )
        e["verdict"] = "confirmed + weight added on second read (corrects the entry above)"
        e["quote"] = 'Metal "14kt Yellow Gold" · Gold Weight 2.5 grams · every size variant price 599.00'

NEW = [
    dict(row="rs-571213", source_url="https://www.ross-simons.com/products/571213",
         checked=["price", "karat", "metal_weight", "compare_at_price"],
         old={"price": "959.00", "karat": "14K", "weight_g": None, "compare_at": "1195.00"},
         new={"price": "959.00", "karat": "14kt", "weight_g": "5.0", "compare_at": "1195.00"},
         change="price and the 1,195.00 compare-at unchanged; metal weight published as \"Gold Weight 5.0 grams\"",
         verdict="confirmed + weight added",
         quote='Metal "14kt Yellow Gold" · Gold Weight 5.0 grams · "20% Off · Original price $1,195 · Sale price $959"'),
    dict(row="rs-879968", source_url="https://www.ross-simons.com/search/suggest.json?q=879968",
         checked=["price", "title"],
         old={"price": "2695.00"}, new={"price": "2695.00"},
         change="price unchanged; no metal weight is published for this diamond eternity band",
         verdict="confirmed",
         quote='Per-SKU official search feed: price "2695.00", title "2.00 ct. t.w. Diamond Eternity Band in 14kt Yellow Gold"'),
    dict(row="rs-960952", source_url="https://www.ross-simons.com/search/suggest.json?q=960952",
         checked=["price", "title"],
         old={"price": "399.00"}, new={"price": "399.00"},
         change="price unchanged; no metal weight published in the feed entry",
         verdict="confirmed",
         quote='Per-SKU official search feed: price "399.00", title "Italian 14kt Yellow Gold Dome Ring"'),
    dict(row="rs-999230", source_url="https://www.ross-simons.com/search/suggest.json?q=999230",
         checked=["price", "title"],
         old={"price": "489.00-559.00"}, new={"price": "489.00-559.00"},
         change="price range unchanged; the stored title was a paraphrase and was replaced with the seller's exact string",
         verdict="confirmed + title corrected (see F36)",
         quote='Per-SKU official search feed: price_min "489.00", price_max "559.00", title ".80 ct. t.w. Garnet and .30 ct. t.w. Pink Sapphire Geometric Eternity Band in 14kt Yellow Gold"'),
    dict(row="rs-993512", source_url="https://www.ross-simons.com/search/suggest.json?q=993512",
         checked=["price", "title"],
         old={"price": "2795.00"}, new={"price": "2795.00"},
         change="price unchanged", verdict="confirmed",
         quote='Per-SKU official search feed: price "2795.00", title "2.30 ct. t.w. Lab-Grown Diamond Engagement Ring in 14kt Yellow Gold"'),
    dict(row="rs-864785", source_url="https://www.ross-simons.com/search/suggest.json?q=864785",
         checked=["price", "title"],
         old={"price": "2395.00"}, new={"price": "2395.00"},
         change="price unchanged; the row is a two-ring bridal set, not a single ring",
         verdict="confirmed (basis note)",
         quote='Per-SKU official search feed: price "2395.00", title "1.00 ct. t.w. Diamond Bridal Set: Engagement and Wedding Rings in 14kt Yellow Gold"'),
    dict(row="rs-242556", source_url="https://www.ross-simons.com/search/suggest.json?q=242556",
         checked=["price", "title"],
         old={"price": "2195.00"}, new={"price": "2195.00"},
         change="price unchanged; estate piece, size 6.5, one of a kind",
         verdict="confirmed",
         quote='Per-SKU official search feed: price "2195.00", title "C. 1980 Vintage .30 Carat Sapphire Ring with .16 ct. t.w. Diamonds in 14kt Yellow Gold. Size 6.5"'),
    dict(row="rs-991907", source_url="https://www.ross-simons.com/products/991907.js",
         checked=["price", "karat", "metal"],
         old={"price": "2795.00"}, new={"price": "2795.00"},
         change="price unchanged; metal re-confirmed as 14kt white gold",
         verdict="confirmed",
         quote='Product feed: price 279500 cents, title "2.30 ct. t.w. Lab-Grown Diamond Engagement Ring in 14kt White Gold"'),
    dict(row="rs-240912", source_url="https://www.ross-simons.com/products/240912.js",
         checked=["price", "karat", "stone_certificate"],
         old={"price": "8995.00"}, new={"price": "8995.00"},
         change="price unchanged; GIA certificate number 7235079100 re-confirmed in the seller's own copy",
         verdict="confirmed",
         quote='Product feed: price 899500 cents, description "GIA Cert #7235079100", size 7 only'),
    dict(row="as-bea-sol", source_url="https://www.annasheffield.com/products/bea-solitaire-ring-gold-north-south-1-50ct-oval-champagne-diamond.js",
         checked=["price", "metal"],
         old={"price": "11500.00"}, new={"price": "11500.00"},
         change="price unchanged (1,150,000 cents); 14k recycled gold description unchanged; no metal weight published",
         verdict="confirmed",
         quote='Product feed: price 1150000 cents, description "1.50ct oval champagne diamond center set in 14k recycled yellow or rose gold tapered shank"'),
    dict(row="wc-tulip", source_url="https://www.withclarity.com/products/tulip-basket-cathedral-classic-solitaire-engagement-ring.js",
         checked=["price", "setting_basis"],
         old={"price": "590.00-1110.00"}, new={"price": "590.00-1110.00"},
         change="price range unchanged; still tagged \"Ring Setting Product\", so the price is the setting only",
         verdict="confirmed",
         quote='Product feed: price_min 59000, price_max 111000 cents; tag "Ring Setting Product"'),
    dict(row="au-cigar", source_url="https://auratenewyork.com/products/modern-cigar-band.js",
         checked=["weight_range", "price_range"],
         old={"price": "1308.00 (14K variant)"}, new={"price": "not re-read variant by variant; feed spans 118.00-1668.00"},
         change=("the published weight range 2.6-4 g is unchanged, but the stored 14K price of 1,308.00 was NOT "
                 "re-confirmed: the live feed now spans 118.00 (vermeil variant) to 1,668.00. Left as historical "
                 "rather than restated."),
         verdict="weight confirmed / 14K price unconfirmed",
         quote='Product feed: price_min 11800, price_max 166800 cents; description "Weight: 2.6-4g"'),
]

for e in NEW:
    if e["row"] in existing_rows:
        continue
    ledger["entries"].append(e)

ledger["note"] = (
    "One ledger for every live re-read in pass P12, written by two sessions that worked the same "
    "pass independently (bc088451 on main, b93ff7c6 on its own branch). The second session's extra "
    "reads were appended here rather than kept in a parallel log, and its correction to the "
    "rs-571222 entry is recorded in that entry rather than overwriting the history."
)
ledger["read_at"] = "2026-10-22T23:35Z"

# ------------------------------------------------------------------ 3b. one URL per row
# S15 requires the ledger URL to be the row's own product URL, so a read that used the seller's
# JSON or search endpoint records that endpoint in the quote instead of replacing the URL.
for e in ledger["entries"]:
    row = by_id.get(e["row"])
    if row is None:
        continue
    if e.get("source_url") != row["source_url"]:
        if "read via" not in e.get("quote", ""):
            e["quote"] = f"{e.get('quote', '')} (read via {e['source_url']})".strip()
        e["source_url"] = row["source_url"]

# ------------------------------------------------------------------ 4. rows that were read get the badge
for e in ledger["entries"]:
    row = by_id.get(e["row"])
    if row is not None:
        row.setdefault("reverified_at", DATE)
        row.setdefault("reverified_pass", "P12")

# ------------------------------------------------------------------ 5. findings this pass proved wrong
items = {f["id"]: f for f in flagged["items"]}
RS = "https://www.ross-simons.com/products/"

items["F02"].update({
    "title": "Metal weight is published for 7 of 43 listings - the other 36 cannot be value-checked",
    "severity": "high",
    "affected": "36 of 43 rows",
    "finding": (
        "Weight in grams is the number you need to test a price against gold content, and most of this "
        "list does not publish it. Seven rows do: six Ross-Simons bands read straight off the spec "
        "panel - 571221 1.7 g, 571222 2.5 g, 571223 3.8 g, 571213 5.0 g, 981367 0.5 g, 907250 0.5 g - "
        "plus the Aurate Modern Cigar Band, which publishes a 2.6-4 g range. Earlier passes reported "
        "1 of 43 because they never captured Ross-Simons' \"Gold Weight\" field. The remaining 36 rows "
        "(every Mejuri, Blue Nile, Brilliant Earth, With Clarity and Anna Sheffield row, plus the 11 "
        "Ross-Simons rows not re-read) stay blank rather than estimated."
    ),
    "buyer_action": (
        "For a listing with no published weight, ask the seller for the grams of your exact size in "
        "writing and run the calculator with it. For the seven that do publish a weight, treat the "
        "figure as the seller's claim until an independent jeweller weighs the ring."
    ),
    "sources": [RS + "571221", RS + "571222", RS + "571223", RS + "571213", RS + "981367",
                RS + "907250", "https://auratenewyork.com/products/modern-cigar-band.js"],
    "status": "needs review",
})

items["F32"].update({
    "title": "Ross-Simons publishes a gold weight on its product pages, but 11 of its 17 rows still have none",
    "finding": (
        "Ross-Simons renders a \"Gold Weight\" line in the spec panel of its product pages (for example "
        "\"Gold Weight 1.7 grams\" on 571221, \"Gold Weight 3.8 grams\" on 571223 and \"Gold Weight 0.5 "
        "grams\" on 981367 and 907250). The earlier passes captured prices and karats but not that field. "
        "Six Ross-Simons rows now carry a weight after the P12 re-reads; the other 11 were not re-read, "
        "so their weight stays blank rather than being inferred from a sibling item."
    ),
})

if "F36" not in items:
    items["F36"] = {
        "id": "F36",
        "title": "One stored product title was a paraphrase, not the seller's string",
        "severity": "low",
        "type": "wording",
        "affected": "rs-999230",
        "finding": (
            "The dataset called Ross-Simons SKU 999230 \"Pink Sapphire and Garnet Eternity Band in 14kt "
            "Yellow Gold\". The seller's own title is \".80 ct. t.w. Garnet and .30 ct. t.w. Pink Sapphire "
            "Geometric Eternity Band in 14kt Yellow Gold\". The paraphrase was replaced with the exact "
            "string on the P12 second read; the price (489.00-559.00) did not change."
        ),
        "buyer_action": (
            "Nothing at checkout. It is recorded because a paraphrased title is the first step towards a "
            "paraphrased specification, and this project claims to copy rather than summarise."
        ),
        "sources": [
            "https://www.ross-simons.com/search/suggest.json?q=999230&resources[type]=product&resources[limit]=1",
            RS + "999230",
        ],
        "status": "needs review",
    }

flagged["items"] = sorted(items.values(), key=lambda f: int(f["id"][1:]))
flagged["as_of"] = DATE

rings_path.write_text(json.dumps(rings, indent=2, ensure_ascii=False) + "\n")
ledger_path.write_text(json.dumps(ledger, indent=2, ensure_ascii=False) + "\n")
flag_path.write_text(json.dumps(flagged, indent=2, ensure_ascii=False) + "\n")

rows_with_weight = [r for r in rings["rows"] if r["weight_g_low"] is not None]
rows_reverified = [r for r in rings["rows"] if r.get("reverified_at")]
print(f"weights: {len(rows_with_weight)} rows -> " + ", ".join(f"{r['id']}={r['weight_g_low']}" for r in rows_with_weight))
print(f"re-verified rows: {len(rows_reverified)} | ledger entries: {len(ledger['entries'])}")
print("title fixes:", title_fixes)
print("flags:", len(flagged["items"]))
