#!/usr/bin/env python3
"""Reconcile the sess-277867af line-by-line re-verification pass onto the shared dataset.

Context
-------
Session sess-277867af re-opened all 43 official product pages on 2026-10-22 and read
title, karat, price, price basis and any published weight straight off each page. The
per-row record of that pass lives in data/verification-2026-10-22.json.

While that pass was running, other sessions (bc088451, b93ff7c6, cf46c7b9, c662efda)
landed their own passes on main, including P12 which recovered Ross-Simons weights and
corrected two prices. This script merges the two independent passes without discarding
either one's evidence:

  * rows keep every field the shared dataset already had (weights, P12 reverified_at);
  * each row gains verified_at / verification_status from this pass;
  * the re-read quote is appended to the row's evidence string, never substituted for it;
  * where the two passes disagree, the row is NOT silently overwritten. It is marked
    partially verified and a finding is published on the Flagged page. A value no pass
    can reproduce is marked price_unverified, so the site renders "— unverified".

Nothing here infers, averages or estimates a value.

Usage:  python3 scripts/reconcile_session_277867af.py
"""

import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATE = "2026-10-22"
SESSION = "sess-277867af"


def load_main(path):
    """Read a file as it stands on origin/main (the shared dataset of record)."""
    out = subprocess.run(
        ["git", "show", f"origin/main:{path}"], cwd=ROOT, capture_output=True, text=True, check=True
    )
    return json.loads(out.stdout)


def dump(path, obj):
    (ROOT / path).write_text(json.dumps(obj, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote {path}")


# ----------------------------------------------------------------- rings.json
rings = load_main("data/rings.json")
verification = json.loads((ROOT / "data/verification-2026-10-22.json").read_text(encoding="utf-8"))
results = {r["id"]: r for r in verification["results"]}

# Where the two independent passes disagree, the row is marked partially verified and
# the disagreement is published instead of being silently resolved. Where this pass
# could not reproduce a value at all, the row becomes unverified.
PARTIAL = {
    "rs-999230": (
        "This pass read a single clearance price of 489.00 at 23:48Z and could not reproduce the "
        "stored upper figure 559.00. P12 had recorded 489.00-559.00 at 23:35Z. The stored range is "
        "kept (both passes are published) and flagged rather than overwritten."
    ),
    "au-xring": (
        "This pass read the storefront feed showing a product price band of 1,808.00-2,578.00 across "
        "variants, but the band could not be attributed to a specific metal/size variant on this read. "
        "The stored 1,808.00 (14K) is kept and the row is marked partially verified rather than "
        "widened to a range no single official line supports."
    ),
    "au-cigar": (
        "Product, tags and the published 2.6-4g weight range were re-confirmed. The stored 1,308.00 "
        "belongs to the 14K/yellow/size-3 variant and was not re-readable at variant level this pass "
        "(the feed exposes only price_min 118.00 and price_max 1,668.00 for the product)."
    ),
}

UNVERIFIED = {
    "as-bea-sol": (
        "The official product page still resolves and still describes the 1.50ct oval champagne "
        "diamond in 14k recycled gold, but it no longer displays any price: the buy box has been "
        "replaced by an enquiry form ('While this one-of-a-kind piece was made for a client, we are "
        "able to create a unique version just for you within your desired price range.'). The stored "
        "11,500.00 could not be reproduced, so it is published as unverified and must not be used as "
        "a quote until Anna Sheffield prices the piece in writing."
    ),
}

# A published weight this pass read that the shared dataset did not yet hold. The grams
# are copied from the seller's own spec panel, and the quote is what makes it auditable.
WEIGHT_ADDITIONS = {
    "rs-960952": (
        1.3,
        1.3,
        (
            "Re-checked 2026-10-22: the page's own spec panel reads \u201cMetal 14kt Yellow Gold "
            "\u00b7 Gold Weight 1.3 grams \u00b7 Finish Polished\u201d, so the weight this pass read "
            "is stored here."
        ),
    ),
}

changes = []
for row in rings["rows"]:
    if row["id"] in WEIGHT_ADDITIONS and row["weight_g_low"] is None:
        lo, hi, quote = WEIGHT_ADDITIONS[row["id"]]
        row["weight_g_low"] = lo
        row["weight_g_high"] = hi
        row["flags"] = [f for f in (row["flags"] or []) if f != "weight_not_published"]
        ev = (row.get("evidence") or "").rstrip()
        if quote not in ev:
            row["evidence"] = (ev + " " + quote).strip()
        changes.append(f"{row['id']}: published weight {lo} g added from the seller's spec panel")

    rec = results.get(row["id"])
    if rec is None:
        raise SystemExit(f"{row['id']}: no entry in data/verification-2026-10-22.json")

    row["verified_at"] = DATE
    row["verified_by"] = SESSION
    row["verification_status"] = "confirmed"

    # append the re-read quote; never replace the existing evidence
    suffix = (rec.get("observed") or {}).get("evidence_suffix")
    if suffix and suffix.strip():
        ev = (row.get("evidence") or "").rstrip()
        if suffix.strip() not in ev:
            row["evidence"] = (ev + " " + suffix.strip()).strip()
        changes.append(f"{row['id']}: evidence gained the re-read quote")

    if row["id"] in UNVERIFIED:
        row["verification_status"] = "unverified"
        row["price_unverified"] = True
        row["price_unverified_reason"] = UNVERIFIED[row["id"]]
        for f in ("price_unverified", "price_not_reproducible"):
            if f not in (row["flags"] or []):
                row.setdefault("flags", []).append(f)
        row["notes"] = (
            (row.get("notes") or "").rstrip()
            + " Re-checked 2026-10-22 (sess-277867af): the page no longer shows a price, so the row "
            "is published as unverified. The stored figure is retained in the data file only as the "
            "last observed value and must not be read as a quote."
        ).strip()
        changes.append(f"{row['id']}: price marked unverified (not reproducible)")

    if row["id"] in PARTIAL:
        row["verification_status"] = "partially verified"
        row["verification_note"] = PARTIAL[row["id"]]
        changes.append(f"{row['id']}: marked partially verified (passes disagree)")

# keep the row key order stable: new keys go to the end
dump("data/rings.json", rings)

# --------------------------------------------------------------- flagged.json
flagged = load_main("data/flagged.json")
existing_titles = {i["title"] for i in flagged["items"]}
next_id = max(int(i["id"].lstrip("F")) for i in flagged["items"])

new_items = [
    {
        "title": "Anna Sheffield Bea solitaire no longer publishes a price",
        "severity": "high",
        "type": "unverified value",
        "affected": "as-bea-sol",
        "finding": UNVERIFIED["as-bea-sol"],
        "buyer_action": (
            "Do not treat the stored 11,500.00 as a price. The row now reads '— unverified' on this "
            "site. Email Anna Sheffield for a written quote for a 1.50ct oval champagne diamond Bea "
            "solitaire in 14k, and ask for the metal weight in grams at the same time."
        ),
        "sources": [
            "https://www.annasheffield.com/products/bea-solitaire-ring-14k-gold-champagne-diamond-1-50ct"
        ],
    },
    {
        "title": "Two Blue Nile setting pages contradict themselves on karat and metal colour",
        "severity": "medium",
        "type": "official source contradiction",
        "affected": "bn-14k-ccf-203284, bn-18k-pn-203268",
        "finding": (
            "The page title/price block for Classic Comfort Fit (2.5mm) is headed '14K Yellow Gold' "
            "while the details panel on the same page reads '18k' and 'Metal: 18k Yellow Gold'. The "
            "Petite Nouveau six-prong page is headed '18K Yellow Gold' while its details panel reads "
            "'polished 14k white gold'. Both rows store the karat from the page heading, which is what "
            "the price block is attached to; the contradiction is on the seller's own page and cannot "
            "be resolved from it."
        ),
        "buyer_action": (
            "Put the exact configuration in the basket and read the karat off the order summary before "
            "paying. Screenshot it. Karat is the single biggest driver of the gold value of the ring, "
            "so a 14K part billed as 18K is worth challenging."
        ),
        "sources": [
            "https://www.bluenile.com/build-your-own-ring/classic-comfort-fit-solitaire-engagement-ring-in-14k-yellow-gold-item-203284",
            "https://www.bluenile.com/build-your-own-ring/petite-nouveau-six-prong-solitaire-engagement-ring-in-18k-yellow-gold-item-203268",
        ],
    },
    {
        "title": "Aurate Modern Cigar Band: the 14K variant price was not re-read at variant level",
        "severity": "medium",
        "type": "partial verification",
        "affected": "au-cigar",
        "finding": PARTIAL["au-cigar"],
        "buyer_action": (
            "Select the 14K/yellow/size 3 variant and read the price in the basket before relying on "
            "the stored 1,308.00. The same product also sells a vermeil variant, so check which one is "
            "selected."
        ),
        "sources": ["https://auratenewyork.com/products/modern-cigar-band"],
    },
    {
        "title": "One stored price range could not be reproduced in full (rs-999230)",
        "severity": "medium",
        "type": "data correction / verification",
        "affected": "rs-999230",
        "finding": PARTIAL["rs-999230"],
        "buyer_action": (
            "Read the price off the Ross-Simons page yourself before ordering. The clearance banner "
            "was live on 2026-10-22 and clearance stock is one-of-a-kind, so the price may move again "
            "without notice."
        ),
        "sources": ["https://www.ross-simons.com/products/999230"],
    },
    {
        "title": "Aurate Diamond X Ring: the product feed shows a price band the row cannot attribute to one variant",
        "severity": "low",
        "type": "partial verification",
        "affected": "au-xring",
        "finding": PARTIAL["au-xring"],
        "buyer_action": (
            "Choose your metal and size and read the price on the product page. If it is above the "
            "stored 1,808.00, the higher figure is the one that applies to the variant you picked."
        ),
        "sources": ["https://auratenewyork.com/products/diamond-x-ring"],
    },
]

for item in new_items:
    if item["title"] in existing_titles:
        print(f"flagged: already present, skipped: {item['title'][:60]}")
        continue
    next_id += 1
    item_with_id = {"id": f"F{next_id:02d}", "status": "needs review", **item}
    item_with_id["found_by"] = SESSION
    item_with_id["found_at"] = DATE
    flagged["items"].append(item_with_id)
    print(f"flagged: added {item_with_id['id']} — {item['title'][:70]}")

flagged["as_of"] = flagged.get("as_of", DATE)
dump("data/flagged.json", flagged)

# --------------------------------------------------------------- sources.json
sources = load_main("data/sources.json")
have_urls = {s["url"] for s in sources["sources"]}

recheck_records = [
    (
        "ross-simons",
        "Ross-Simons",
        "https://www.ross-simons.com/products/571221",
        "17 product pages re-read line by line on 2026-10-22; 7 publish a Gold Weight spec (1.7 / 2.5 / 3.8 / 5.0 / 0.5 / 0.5 / 1.3 g)",
    ),
    (
        "with-clarity",
        "With Clarity",
        "https://www.withclarity.com/search/suggest.json?q=solitaire",
        "5 rows re-read from the storefront feed; setting prices confirmed, no metal weight published",
    ),
    (
        "aurate",
        "Aurate New York",
        "https://auratenewyork.com/search/suggest.json?q=ring",
        "5 rows re-read from the storefront feed; published weight range 2.6-4g confirmed on Modern Cigar Band",
    ),
    (
        "anna-sheffield",
        "Anna Sheffield",
        "https://www.annasheffield.com/products/bea-solitaire-ring-14k-gold-champagne-diamond-1-50ct",
        "3 rows re-read; the Bea solitaire page no longer displays any price, so the row is published as unverified",
    ),
    (
        "blue-nile",
        "Blue Nile",
        "https://www.bluenile.com/build-your-own-ring/classic-comfort-fit-solitaire-engagement-ring-in-14k-yellow-gold-item-203284",
        "8 setting pages re-read; two pages contradict themselves on karat in the details panel",
    ),
    (
        "mejuri",
        "Mejuri",
        "https://mejuri.com/shop/rings?Material=Solid+Yellow+Gold+(14k)",
        "4 rows re-read; all four state 'Solid Yellow Gold (14k)' on the page",
    ),
    (
        "brilliant-earth",
        "Brilliant Earth",
        "https://www.brilliantearth.com/Classic-Six-Prong-Solitaire-Ring-Gold-BE121H6-1151507/",
        "Setting price 1,090.00 re-read; metal 18K Yellow Gold with 14K White Gold prongs",
    ),
    (
        "gold-api.com",
        "gold-api.com",
        "https://api.gold-api.com/price/XAU",
        "Third reading of the same feed: 4,026.699951 USD/ozt at 2026-10-22T23:38:41Z",
    ),
    (
        "CME Group / Yahoo Finance",
        "CME Group (via Yahoo Finance)",
        "https://query1.finance.yahoo.com/v8/finance/chart/GC%3DF?interval=1d&range=5d",
        "COMEX front-month futures 4,042.50 USD/ozt at 2026-10-22T23:28:38Z, used only as a cross-check",
    ),
]

added = 0
for slug, publisher, url, verified in recheck_records:
    if url in have_urls:
        continue
    sources["sources"].append(
        {
            "id": f"p18-{slug}-recheck",
            "publisher": publisher,
            "type": "official product page" if "api" not in url and "chart" not in url else "market data publisher",
            "url": url,
            "verified": verified,
            "status": "retrieved",
            "retrieved_at": DATE,
            "observed_by": SESSION,
        }
    )
    have_urls.add(url)
    added += 1
print(f"sources: added {added} re-check records")
sources["as_of"] = DATE
dump("data/sources.json", sources)

# ------------------------------------------------------------ gold-price.json
gold = load_main("data/gold-price.json")
gold["as_of"] = "2026-10-22T23:38:41Z"
gold["primary"].update(
    {
        "price_usd_per_ozt": 4026.699951,
        "publisher": "gold-api.com",
        "publisher_timestamp": "2026-10-22T23:38:41Z",
        "source_url": "https://api.gold-api.com/price/XAU",
        "source_type": "market data publisher",
        "observed_by": SESSION,
    }
)
gold["cross_check"].update(
    {
        "price_usd_per_ozt": 4042.5,
        "publisher_timestamp_epoch": 1792711718,
        "publisher_timestamp": "2026-10-22T23:28:38Z",
        "observed_by": SESSION,
    }
)
gold.setdefault("readings", []).append(
    {
        "price_usd_per_ozt": 4026.699951,
        "publisher_timestamp": "2026-10-22T23:38:41Z",
        "publisher": "gold-api.com",
        "observed_by": SESSION,
    }
)
gold["readings_note"] = (
    "Three separate readings of the same published feed, 37 minutes end to end, each stored with the "
    "publisher's own timestamp: 4,028.100098 (23:01:42Z), 4,029.699951 (23:22:41Z), 4,026.699951 "
    "(23:38:41Z). The latest reading drives the melt arithmetic on this site. Spread across all three "
    "readings: 3.60 USD/ozt (0.09%). The melt figures are re-derived from this stored price by "
    "scripts/verify.mjs, so changing the price here changes every gold-value figure on the site."
)
dump("data/gold-price.json", gold)

print(f"\n{len(changes)} row-level changes applied:")
for c in changes:
    print("  -", c)
