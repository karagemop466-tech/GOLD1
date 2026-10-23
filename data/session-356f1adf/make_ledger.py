"""Builds the eleventh-pass live-read ledger (sess-356f1adf).

Every quote below was read from the URL shown during the pass window. Rerun only
if the reads themselves are repeated; the ledger is evidence, not a template.
"""
import json
from collections import OrderedDict

R = OrderedDict


def read(row, url, at, quote, verdict):
    return R([("row", row), ("url", url), ("read_at", at), ("quote", quote), ("verdict", verdict)])


ledger = R([
    ("session", "sess-356f1adf"),
    ("branch", "arena/356f1adf-gold1"),
    ("pass_label", "eleventh pass (board T47)"),
    ("read_channel", "page-fetch tool (direct HTTP from this sandbox shell is restricted to an allowlist; no retailer was reachable by script)"),
    ("read_window_utc", "2026-10-23T23:38Z-2026-10-23T23:52Z"),
    ("honest_limit", "This pass opened 16 official sources live (14 retailer pages/feeds + 2 market/standards publishers). The other 57 rows were not re-opened in this pass; they keep their own dated capture and are labelled by date on the site. It also re-opened the federal regulation text and the NIST conversion page to re-check the two official-standard claims the site makes."),
    ("note", "Every quote below was read from the URL shown. No value was inferred, averaged or carried forward. Where the page printed no price, the row says so rather than substituting one."),
    ("reads", [
        read("gold primary", "https://api.gold-api.com/price/XAU", "2026-10-23T23:38:16Z",
             '{"currency":"USD","price":3996.899902,"symbol":"XAU","updatedAt":"2026-10-23T23:38:16Z"}',
             "new primary reading stored; supersedes 3,998.100098 @ 20:19:15Z. Every melt figure re-derived by the builder."),
        read("rs-571221", "https://www.ross-simons.com/products/571221", "2026-10-23T23:40Z",
             "\"Women's 2mm 14kt Yellow Gold Band\" ... \"$400\" ... \"Metal 14kt Yellow Gold\" - \"Gold Weight 1.7 grams\" - sizes 5,6,7,8,9 \"$400.00 In-Stock\"; 5.5,6.5,7.5,8.5 \"Sold Out\"",
             "confirmed exactly: price $400, karat 14kt, published weight 1.7 g"),
        read("rs-997811", "https://www.ross-simons.com/products/997811", "2026-10-23T23:40Z",
             "\"Italian 10kt Yellow Gold Textured Ring\" ... \"$89\" ... \"Metal 10kt Yellow Gold\" - \"Gold Weight 0.3 grams\" - \"Width 1/16 inch\"",
             "confirmed exactly: shortlist row ($89, 10K, 0.3 g)"),
        read("rs-939479 (withdrawn)", "https://www.ross-simons.com/products/939479.js", "2026-10-23T23:41Z",
             '"title":"Italian 14kt Yellow Gold Claddagh Ring" ... "price":49900 ... "description":"This ring bears a very traditional Celtic symbol, known as the Claddagh. Crafted of polished 14kt yellow gold..."',
             "F51/F64 re-confirmed live: the recorded URL still sells a different ring; the row stays withdrawn"),
        read("rs-943668", "https://www.ross-simons.com/products/943668.js", "2026-10-23T23:41Z",
             '".28 ct. t.w. Diamond Engagement Ring Setting in 14kt White Gold" ... "price_min":126900,"price_max":143900,"compare_at_price":179500 ... "Center stone and setting are sold separately." ... Size 5/6/6.5 "available":false, Size 7/8/9 price 126900 "available":true',
             "confirmed: $1,269-$1,439 range, compare-at $1,795, setting-only basis (F05) re-confirmed"),
        read("ag-14k-industrial-band", "https://www.automicgold.com/products/industrial-mirror-band.js", "2026-10-23T23:42Z",
             '"Industrial Mirror Band" ... variant "14k Yellow Gold / 1.7mm / No Gem" "price":59800 ... "price_min":22500,"price_max":350800 (silver to platinum across the range) ... "Our solid band is made in our studio in NYC"',
             "confirmed at variant level: $598 for the stored 14K 1.7 mm no-gem variant; the $225 lower bound is a silver variant and was not used"),
        read("mej-2mm", "https://mejuri.com/products/2mm-smooth-band", "2026-10-23T23:42Z",
             '"2mm Smooth Band" ... "$498" ... Material "Solid Yellow Gold (14k)" ... "Handcrafted in recycled 14k solid gold featuring streamlined edges." ... Specifications "- Width: 2 mm" "- Thickness: 1.3 mm"',
             "confirmed: $498, solid 14k stated. The page now publishes thickness 1.3 mm; not written into the curated row in this pass."),
        read("au-cigar (partly verified)", "https://auratenewyork.com/products/modern-cigar-band.js", "2026-10-23T23:43Z",
             '"Modern Cigar Band" ... "Width: 20mm Thickness: 1mm Height: 5mm Weight: 2.6-4g" ... tags include "vermeil" ... "price":11800,"price_min":11800,"price_max":166800 ... first variants "Vermeil / Yellow / 3" price 11800',
             "weight basis 2.6-4 g re-confirmed; the $118 vermeil variant is still the minimum (F03/F39). The 14K variant price was NOT isolated in this read; the product maximum is $1,668, so the stored $1,308 stays an earlier capture and the row keeps partly_verified."),
        read("wc-4prong", "https://www.withclarity.com/products/classic-four-prong-solitaire-diamond-engagement-ring.js", "2026-10-23T23:43Z",
             '"Classic Four Prong Solitaire Diamond Engagement Ring" ... "price":55800,"price_min":55800,"price_max":80100 ... "compare_at_price":62000 ... tags include "Ring Setting Product"',
             "confirmed: $558-$801 setting-only range; setting basis re-confirmed (F04)"),
        read("as-bea-sol (price unverified)", "https://www.annasheffield.com/products/bea-solitaire-ring-gold-north-south-1-50ct-oval-champagne-diamond", "2026-10-23T23:44Z",
             '"Bea Solitaire Ring - 14k Gold & Champagne Diamond (1.50ct)" ... "While this one-of-a-kind piece was made for a client, we are able to create a unique version just for you within your desired price range." ... an enquiry form follows; no price and no add-to-cart control on the page',
             "F37 re-confirmed: still no published price; the stored $11,500 is NOT displayed and the row stays price_unverified"),
        read("bn-14k-petite-195639 (withdrawn)", "https://www.bluenile.com/engagement-rings/design-your-own-ring/petite-micropave-engagement-ring-in-14k-yellow-gold-1-10-ct-tw-item-195639", "2026-10-23T23:44Z",
             '"Petite Solitaire Engagement Ring in 14k Yellow Gold" ... "Stock Number 501130y14" ... "Metal 14K Yellow Gold" ... "Width 1.80mm" ... "$1,000 (Setting Price)"',
             "F65 re-confirmed: the URL now sells a Petite Solitaire (stock 501130y14), not the Petite Micropave row recorded; the row stays withdrawn"),
        read("be-18k-6p-121h6", "https://www.brilliantearth.com/Classic-Six-Prong-Solitaire-Ring-Gold-BE121H6-1151507/", "2026-10-23T23:45Z",
             '"Classic Six-Prong Solitaire Ring in 18K Yellow Gold" ... "$1,090 (Setting Only)" ... "Style: BE121H6-18KY" "Metal: 18K Yellow Gold" "Prong metal: 14K White Gold" "Width: 2.5 mm" ... "USD" in the site header',
             "confirmed in USD: price, karat and prong-metal composition all match the stored row"),
        read("car-18k-1895-band-dia", "https://www.cartier.com/en-us/jewelry/wedding-bands/1895/1895-wedding-band-CRB4057600.html", "2026-10-23T23:46Z",
             '"1895 wedding band, 2.6 mm width, 1 diamond" ... "Width 2.6 mm" "Yellow gold (750/1000)" "Set with a brilliant-cut diamond of 0.01 carat (for size 52)" ... "$1,140" ... "Ref.B4057600" ... "Unavailable online" (several sizes "Notify when available")',
             "confirmed: $1,140 and 750/1000 fineness; availability caveat noted (some sizes not orderable online)"),
        read("mene-24k-classic-band", "https://mene.com/products/mene-classic-band-gold", "2026-10-23T23:47Z",
             '"Classic Band" ... "$1,694" "USD" ... Metal "Gold 24k Gold" ... "Width: 5mm Thickness: 2mm" ... "Products are sold by weight, not size." ... "Starting at $153/mo or 0% APR with Affirm"',
             "confirmed: $1,694 default-configuration price unchanged since the 20:23Z read. The $153 figure is a monthly financing instalment, not a ring price, and was not stored."),
        read("auv-22k-vneck-sm", "https://auvere.com/product/v-neck-stack-ring-small-polished/", "2026-10-23T23:48Z",
             '"Returns & Exchanges" ... "TIMEFRAMES - You have 15 days from the day ..." (the fetched page text carries the shipping and returns policy; no price block in the retrieved text)',
             "partial read: the 15-day return window (F55) is re-corroborated; the $900 price was NOT visible in this fetch, so it is not claimed fresh (F61 still stands)"),
        read("standards - 16 CFR Part 23", "https://www.ecfr.gov/current/title-16/chapter-I/subchapter-B/part-23/section-23.3", "2026-10-23T23:50Z",
             'Section 23.3(c)(1): "Use of the term \'Gold\' or any abbreviation to describe all or part of a product that is composed throughout of gold alloy, but contains a hollow center or interior, may mislead consumers, unless the fact that the product contains a hollow center is disclosed in immediate proximity ... Such products should not be marked or described as \'solid\' ..."',
             "the site's hollow-centre solid-gold rule is quoted correctly from the official eCFR text (Title 16 up to date as of 10/21/2026)"),
        read("standards - NIST grams per troy ounce", "https://www.nist.gov/pml/owm/metric-si/unit-conversion/precious-metals-conversion-information", "2026-10-23T23:51Z",
             '"Precious Metals Conversion Information" ... "2.17. Precious Metals ... NIST Handbook 130, Uniform Regulation for the Method of Sale of Commodities, Section 2.17."',
             "WORKING official page confirmed. The path previously stored across the site (.../metric-si/precious-metals-conversion-information, without /unit-conversion/) returned a NIST Page-not-found response in the same session, published as F67 and fixed."),
    ]),
])

out = "data/session-356f1adf/live-reads-2026-10-23.json"
with open(out, "w", encoding="utf-8") as fh:
    json.dump(ledger, fh, indent=2, ensure_ascii=False)
    fh.write("\n")
print("wrote", out, "with", len(ledger["reads"]), "reads")
