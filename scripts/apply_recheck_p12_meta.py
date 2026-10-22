#!/usr/bin/env python3
"""P12 (2026-10-22): refresh the published gold price, register the sources that were
re-read, and rewrite the findings that this pass proved wrong.

Every number below was read from the source named next to it on 2026-10-22. Melt figures are
arithmetic on two published numbers (weight x karat fraction x spot per gram) and are labelled
as such - they are not quoted from anybody.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATE = "2026-10-22"

# ---------------------------------------------------------------- gold price
gold_path = ROOT / "data/gold-price.json"
gold = json.loads(gold_path.read_text())

NEW_PRICE = 4029.699951
NEW_TS = "2026-10-22T23:22:41Z"
old_primary = dict(gold["primary"])
if old_primary["publisher_timestamp"] != NEW_TS:
    gold.setdefault("previous_readings", []).insert(0, {
        "label": old_primary["label"],
        "price_usd_per_ozt": old_primary["price_usd_per_ozt"],
        "publisher": old_primary["publisher"],
        "publisher_timestamp": old_primary["publisher_timestamp"],
        "source_url": old_primary["source_url"],
        "superseded_on": DATE,
        "why": "Re-read in pass P12 to keep the value check on the newest published price.",
    })
gold["primary"]["price_usd_per_ozt"] = NEW_PRICE
gold["primary"]["publisher_timestamp"] = NEW_TS
gold["as_of"] = NEW_TS
gold["note"] = (
    "Two independent published gold prices, each stored with the publisher's own timestamp. "
    "Neither is an estimate. The primary reading was refreshed in pass P12; earlier readings are "
    "kept in previous_readings so the calculator can be re-run against the price a row was "
    "captured with. The COMEX cross-check is the reading taken earlier in the same session and is "
    "labelled with its own timestamp."
)
gold_path.write_text(json.dumps(gold, indent=2) + "\n")

spot_per_gram = NEW_PRICE / gold["grains_per_troy_ounce"]
melt_14k_05 = round(0.5 * (14 / 24) * spot_per_gram, 2)
melt_18k_05 = round(0.5 * (18 / 24) * spot_per_gram, 2)

# ---------------------------------------------------------------- sources
src_path = ROOT / "data/sources.json"
src = json.loads(src_path.read_text())
existing = {s["id"] for s in src["sources"]}
NEW_SOURCES = [
    ("p12-rs-product-pages", "Ross-Simons", "official product page",
     "https://www.ross-simons.com/products/571221",
     "Gold weight in grams (Details table), live price per size, metal statement for SKUs 571221, 571222, 571223, 571213, 981367, 907250"),
    ("p12-rs-product-json", "Ross-Simons", "official product feed (JSON)",
     "https://www.ross-simons.com/products/991907.js",
     "Price and metal for SKU 991907 and 240912 when site search returned no product"),
    ("p12-rs-search-sku", "Ross-Simons", "official search feed",
     "https://www.ross-simons.com/search/suggest.json?q=879968&resources[type]=product&resources[limit]=1",
     "Per-SKU price re-read for 879968, 960952, 999230, 993512, 864785, 242556"),
    ("p12-mejuri-product", "Mejuri", "official product page",
     "https://mejuri.com/products/2mm-smooth-band",
     "Price $498 and the phrase 'Handcrafted in recycled 14k solid gold'; specification block has width/thickness but no grams"),
    ("p12-as-product-json", "Anna Sheffield", "official product feed (JSON)",
     "https://www.annasheffield.com/products/bea-solitaire-ring-gold-north-south-1-50ct-oval-champagne-diamond.js",
     "Price 1,150,000 cents = $11,500.00 and the 14k recycled gold description"),
    ("p12-wc-product-json", "With Clarity", "official product feed (JSON)",
     "https://www.withclarity.com/products/tulip-basket-cathedral-classic-solitaire-engagement-ring.js",
     "Setting price range 59000-111000 cents and the 'Ring Setting Product' tag"),
    ("p12-au-product-json", "Aurate", "official product feed (JSON)",
     "https://auratenewyork.com/products/modern-cigar-band.js",
     "Vermeil price $118 at the low end, price_max $1,668, published weight range 2.6-4 g"),
    ("p12-gold-refresh", "gold-api.com", "market data publisher",
     "https://api.gold-api.com/price/XAU",
     f"Gold spot ${NEW_PRICE} /ozt at {NEW_TS}"),
]
for sid, publisher, typ, url, verified in NEW_SOURCES:
    if sid in existing:
        continue
    src["sources"].append({
        "id": sid,
        "publisher": publisher,
        "type": typ,
        "url": url,
        "verified": verified,
        "status": "retrieved",
        "retrieved_at": DATE,
    })
src["as_of"] = DATE
src_path.write_text(json.dumps(src, indent=2) + "\n")

# ---------------------------------------------------------------- findings
flag_path = ROOT / "data/flagged.json"
flagged = json.loads(flag_path.read_text())
items = {f["id"]: f for f in flagged["items"]}

W = "https://www.ross-simons.com/products/"
RS_WEIGHTS = [
    (W + "571221", "1.7 g"),
    (W + "571222", "2.5 g"),
    (W + "571223", "3.8 g"),
    (W + "571213", "5.0 g"),
    (W + "981367", "0.5 g"),
    (W + "907250", "0.5 g"),
]

items["F02"].update({
    "title": "Metal weight is published for 7 of 43 listings - the rest still cannot be value-checked",
    "severity": "high",
    "affected": "36 of 43 rows",
    "finding": (
        "The earlier passes recorded 1 of 43 as weight-published. Pass P12 found that this was "
        "wrong: Ross-Simons prints a 'Gold Weight' figure in the Details table of its product "
        "pages, and it reads 1.7 g (571221), 2.5 g (571222), 3.8 g (571223), 5.0 g (571213), "
        "0.5 g (981367) and 0.5 g (907250). Aurate publishes a 2.6-4 g range for the Modern Cigar "
        "Band. That is 7 of 43 rows where the price can be compared with the gold actually in the "
        "ring. The other 36 - every Mejuri, Blue Nile, Brilliant Earth, With Clarity and Anna "
        "Sheffield row, plus 11 Ross-Simons rows - do not publish grams on the page read, so their "
        "cells stay blank rather than estimated."
    ),
    "buyer_action": (
        "For the 36 rows without a published weight, ask the seller for the gram weight of your "
        "exact size in writing and run the calculator with it. For the 7 rows with a weight, treat "
        "the figure as the seller's claim until an independent jeweller weighs the ring."
    ),
    "sources": [u for u, _ in RS_WEIGHTS] + [
        "https://auratenewyork.com/products/modern-cigar-band.js",
        "https://mejuri.com/products/2mm-smooth-band",
    ],
    "status": "needs review",
})

items["F06"].update({
    "title": "The two cheapest rings are now explained: both are 0.5 g of gold",
    "severity": "low",
    "finding": (
        "Pass P12 read the published weights for the two suspiciously cheap pieces. The $149 "
        "14K ring (981367) is 0.5 g and the $179 18K rope ring (907250) is 0.5 g. At the P12 "
        f"gold price the 14K piece holds about ${melt_14k_05:.2f} of gold and the 18K piece about "
        f"${melt_18k_05:.2f}, so the asking prices are roughly 3.9x and 3.7x metal content - normal "
        "for retail jewellery, not a red flag. The thin 1/16 inch width on both pages matches that "
        "weight. The finding is closed as 'explained', not deleted."
    ),
    "buyer_action": (
        "These are stacking rings, not engagement rings: 0.5 g will wear through faster than a "
        "3-5 g band. If you want a band that survives daily wear, the 571222 (2.5 g) and 571223 "
        "(3.8 g) listings are the better comparison points."
    ),
    "sources": [W + "981367", W + "907250", W + "571222", W + "571223",
                "https://api.gold-api.com/price/XAU"],
    "status": "needs review",
})

if "F19" in items:
    items["F19"]["superseded_by"] = "F02"
    items["F19"]["finding"] += (
        " SUPERSEDED by F02: pass P12 found that Ross-Simons does publish gold weight on six of "
        "the listings in this dataset, so '0 of 13' described the first pass's reading, not the "
        "seller's page."
    )

NEW_FLAGS = [
    {
        "id": "F31",
        "title": "Ross-Simons 571223: the stored low price ($799) is no longer offered - every size is $849",
        "severity": "medium",
        "type": "price drift",
        "affected": "rs-571223",
        "finding": (
            "The row was captured with a price range of $799.00-$849.00. On re-read during P12 "
            "every size on the product page showed $849.00, so the range collapsed to a single "
            "price and the row was corrected. This is exactly the drift the site warns about: a "
            "price read on any day is a snapshot, and the retailer's page always wins."
        ),
        "buyer_action": "Open the product page and confirm the price for your size before paying.",
        "sources": [W + "571223", W + "571222"],
        "status": "needs review",
    },
    {
        "id": "F32",
        "title": "22 of 43 listings were not re-opened in pass P12 - their prices are not today's",
        "severity": "medium",
        "type": "freshness",
        "affected": "22 rows, listed in data/recheck.json under not_rechecked",
        "finding": (
            "P12 re-opened 18 listings and confirmed 15 of them at the stored price, corrected one "
            "(571223) and could not confirm one variant price (au-cigar). The remaining 22 - mostly "
            "Blue Nile, With Clarity, Aurate, Mejuri and Brilliant Earth rows - still carry the "
            "price captured in the earlier pass. They are shown with a 'not re-checked' label and "
            "must not be read as current. No value was refreshed by guesswork."
        ),
        "buyer_action": (
            "Treat any row labelled 'not re-checked' as historical. Click through to the official "
            "page, or re-run scripts/collect.mjs with network access, before comparing prices."
        ),
        "sources": [
            "https://www.bluenile.com/engagement-rings/styles/solitaire",
            "https://www.withclarity.com/search/suggest.json?q=solitaire",
            "https://auratenewyork.com/search/suggest.json?q=engagement%20ring",
            "https://www.annasheffield.com/search/suggest.json?q=engagement%20ring",
            "https://mejuri.com/products/2mm-smooth-band",
            "https://www.brilliantearth.com/Classic-Six-Prong-Solitaire-Ring-Gold-BE121H6-1151507/",
        ],
        "status": "needs review",
    },
    {
        "id": "F33",
        "title": "Aurate Modern Cigar Band: the $1,308 14K price could not be re-confirmed",
        "severity": "medium",
        "type": "variant price",
        "affected": "au-cigar",
        "finding": (
            "The live product feed on 2026-10-22 lists price_min 11800 cents ($118.00, the vermeil "
            "variant) and price_max 166800 cents ($1,668.00), with the published weight range 2.6-4 g "
            "unchanged. The stored $1,308.00 is the 14K variant price captured earlier; it was not "
            "re-read variant by variant in P12, so it is marked unconfirmed on the row instead of "
            "being restated as current."
        ),
        "buyer_action": (
            "Select the 14K yellow gold option on the product page and read the price for your size "
            "before comparing it with the $118 vermeil option - they are different products."
        ),
        "sources": ["https://auratenewyork.com/products/modern-cigar-band.js",
                    "https://auratenewyork.com/products/modern-cigar-band"],
        "status": "needs review",
    },
    {
        "id": "F34",
        "title": "Three Ross-Simons SKUs are not returned by the site's own search any more",
        "severity": "medium",
        "type": "availability",
        "affected": "rs-943668, rs-991908, rs-254575",
        "finding": (
            "On 2026-10-22 the official Ross-Simons product search returned no product for these "
            "three SKUs, while it did return the other Ross-Simons SKUs in this dataset. The product "
            "pages were not opened in P12, so availability and price are unknown - neither sold out "
            "nor still listed is claimed. The rows keep their earlier price and carry an "
            "availability_unconfirmed flag."
        ),
        "buyer_action": (
            "Open the product URL and check that it still loads and still shows the piece before "
            "relying on it."
        ),
        "sources": [
            W + "943668",
            W + "991908",
            W + "254575",
            "https://www.ross-simons.com/search/suggest.json?q=943668&resources[type]=product&resources[limit]=1",
        ],
        "status": "needs review",
    },
    {
        "id": "F35",
        "title": "One stored product title had been paraphrased instead of copied",
        "severity": "low",
        "type": "wording",
        "affected": "rs-999230",
        "finding": (
            "The dataset called SKU 999230 'Pink Sapphire and Garnet Eternity Band in 14kt Yellow "
            "Gold'. The seller's own title is '.80 ct. t.w. Garnet and .30 ct. t.w. Pink Sapphire "
            "Geometric Eternity Band in 14kt Yellow Gold'. The paraphrase was replaced with the exact "
            "string, and two estate titles were aligned to the seller's punctuation. The prices on "
            "those rows were unchanged."
        ),
        "buyer_action": (
            "Nothing to do at checkout. This is recorded because a paraphrased title is the first "
            "step towards a paraphrased specification."
        ),
        "sources": [
            "https://www.ross-simons.com/search/suggest.json?q=999230&resources[type]=product&resources[limit]=1",
            W + "999230",
        ],
        "status": "needs review",
    },
]

for f in NEW_FLAGS:
    items[f["id"]] = f

flagged["items"] = sorted(items.values(), key=lambda f: int(f["id"][1:]))
flagged["as_of"] = DATE
flagged["status_legend"] = {
    "needs review": "Published here and does not block the release. A human should read it before buying.",
    "blocking": "There are no blocking items: unverified values were left blank instead.",
}
flag_path.write_text(json.dumps(flagged, indent=2, ensure_ascii=False) + "\n")

# ---------------------------------------------------------------- checklist
cl_path = ROOT / "data/checklist.json"
cl = json.loads(cl_path.read_text())
by_req = {i["requirement"]: i for i in cl["items"]}

for req, item in by_req.items():
    if req.startswith("Weight:"):
        item["status"] = "open"
        item["finding"] = (
            "7 of 43 listings publish a metal weight: six Ross-Simons bands (1.7 g, 2.5 g, 3.8 g, "
            "5.0 g, 0.5 g, 0.5 g) and the Aurate Modern Cigar Band (2.6-4 g range). An earlier pass "
            "recorded 1 of 43 and has been corrected (F02). The other 36 rows leave the cell blank "
            "rather than estimate it."
        )
        item["buyer_action"] = (
            "Ask the seller for the gram weight of your exact size in writing. The calculator turns "
            "any quoted weight into a gold value you can compare with the asking price."
        )
        item["links"] = [
            {"label": "F02 - weight coverage", "url": "flagged.html#F02"},
            {"label": "Ross-Simons 571223 (3.8 g)", "url": W + "571223"},
            {"label": "Gold calculator", "url": "calculator.html"},
        ]
    elif req.startswith("Price:"):
        item["status"] = "partial"
        item["finding"] = (
            f"The gold price used for every value check is ${NEW_PRICE:,.2f}/ozt at {NEW_TS}, "
            "published by gold-api.com and stored with that timestamp. For the 7 rows that publish "
            "a weight the check now runs; for the other 36 it cannot, and the cell stays blank. In "
            "P12 the two cheapest pieces were resolved this way: $149 buys 0.5 g of 14K (about "
            f"${melt_14k_05:.2f} of gold) and $179 buys 0.5 g of 18K (about ${melt_18k_05:.2f})."
        )
        item["buyer_action"] = (
            "Run the calculator with the seller's weight. Jewellery sells above melt by design, so "
            "use the multiple to spot the absurd, not to expect a bargain at 1x."
        )
        item["links"] = [
            {"label": "Gold price source", "url": "https://api.gold-api.com/price/XAU"},
            {"label": "Calculator", "url": "calculator.html"},
            {"label": "F06 - the two cheapest rings", "url": "flagged.html#F06"},
        ]
    elif req.startswith("Documentation:"):
        item["finding"] = (
            "This project already does that for you: every row keeps the exact evidence sentence, "
            "the price, the retrieval date, the source URL, and - since pass P12 - whether the value "
            "was re-read today or is historical. data/recheck.json holds one line per listing "
            "re-opened, so a claim can be traced back to a dated read."
        )

cl["as_of"] = DATE
cl["note"] = (
    "Each item is the user's original checklist requirement, scored against what could actually be "
    "checked in this research pass. Re-scored in pass P12 (2026-10-22)."
)
cl_path.write_text(json.dumps(cl, indent=2, ensure_ascii=False) + "\n")

print("gold:", NEW_PRICE, NEW_TS, "per gram:", round(spot_per_gram, 2))
print("melt 0.5g 14K:", melt_14k_05, "| 0.5g 18K:", melt_18k_05)
print("flags:", len(flagged["items"]), "sources:", len(src["sources"]))
