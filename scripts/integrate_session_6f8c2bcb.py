#!/usr/bin/env python3
"""
Integrate the dataset produced by session arena-6f8c2bcb-gold1 into this site's schema.

Why a script: the previous session's rows use a different schema (price / purity /
solid_gold_quote / url). Migrating by hand would risk retyping a number. This maps
fields mechanically and refuses to invent anything:

  * price          -> price_low = price_high = price  (no rounding, no conversion)
  * purity         -> karat                            (copied verbatim)
  * solid_gold_quote -> evidence + solid_stated        (true only if the quote says "solid")
  * weight_g       -> null + weight_not_published flag (they published none)

Run: python3 scripts/integrate_session_6f8c2bcb.py
"""
import json
import os

SRC = "data/archive/session-6f8c2bcb/rings.json"
DST = "data/rings.json"

RETAILER_MAP = {
    "RET-BN": "blue-nile",
    "RET-MEJ": "mejuri",
    "RET-BE": "brilliant-earth",
}

retailer_names = {
    "blue-nile": "Blue Nile",
    "mejuri": "Mejuri",
    "brilliant-earth": "Brilliant Earth",
}

src = json.load(open(SRC))
dst = json.load(open(DST))

existing_ids = {r["id"] for r in dst["rows"]}
existing_urls = {r["source_url"].rstrip("/") for r in dst["rows"]}

migrated = []
skipped = []

for row in src["rings"]:
    rid = row["id"].lower()
    if rid in existing_ids or row["url"].rstrip("/") in existing_urls:
        skipped.append(f"{row['id']}: duplicate of an existing row")
        continue

    price = row["price"]
    assert isinstance(price, (int, float)), row["id"]
    price_type = (row.get("price_type") or "").lower()
    is_setting = "setting" in price_type
    is_from = bool(row.get("price_is_from"))

    if is_setting:
        basis = "setting only - center stone sold separately"
    elif is_from:
        basis = "starting price - varies with stone size"
    else:
        basis = "single listed price"

    category = "solitaire" if "solitaire" in row["category"].lower() else "bands"
    if "eternity" in row["category"].lower() or "diamond" in row["category"].lower():
        stone = "Natural diamonds (per listing)"
        stone_type = "Natural diamond"
    elif "plain" in row["category"].lower():
        stone = "None"
        stone_type = None
    else:
        stone = "Setting only - centre stone chosen separately"
        stone_type = None

    solid_quote = (row.get("solid_gold_quote") or "").strip()
    solid_stated = "solid" in solid_quote.lower() and row.get("solid_gold_statement", "").lower().startswith("yes")

    price_display = row.get("price_display") or f"${price:,.0f}"
    evidence = (
        f'Title "{row["product"]}"; price "{price_display}"; metal "{row["metal"]}"; '
        f'solid-gold note "{solid_quote}"; price read from the {row["source_type"]} on {row["checked_on"]}'
    )

    flags = ["weight_not_published"]
    if is_setting:
        flags.append("setting_only")
    if is_from:
        flags.append("starting_price")
    if not solid_stated:
        flags.append("solid_not_stated")
    if row["source_type"] != "product page":
        flags.append("price_from_listing_page")
    if "F-14" in (row.get("flags") or []):
        flags.append("mixed_karat_components")
    flags.append("hallmark_not_published")

    note_bits = []
    if row.get("notes"):
        note_bits.append(row["notes"].rstrip("."))
    if row.get("weight_note"):
        note_bits.append(row["weight_note"].rstrip("."))
    note_bits.append(
        "Carried over from the first research pass (session arena-6f8c2bcb-gold1) and "
        "re-mapped into this schema without changing any number"
    )

    migrated.append(
        {
            "id": rid,
            "retailer_id": RETAILER_MAP[row["retailer_id"]],
            "retailer": retailer_names[RETAILER_MAP[row["retailer_id"]]],
            "title": row["product"],
            "category": category,
            "style": row["category"],
            "karat": row["purity"],
            "metal": row["metal"],
            "stone": stone,
            "stone_type": stone_type,
            "price_low": float(price),
            "price_high": float(price),
            "compare_at_high": None,
            "price_basis": basis,
            "weight_g_low": None,
            "weight_g_high": None,
            "source_url": row["url"],
            "source_type": f"official {row['source_type']}",
            "retrieved_at": row["checked_on"],
            "evidence": evidence,
            "solid_stated": solid_stated,
            "flags": flags,
            "notes": ". ".join(note_bits) + ".",
            "inherited": True,
            "verified_by": "session-6f8c2bcb",
        }
    )

dst["rows"].extend(migrated)
dst["note"] += (
    " Rows carry an inherited=true marker when they came from the first research pass "
    "(session arena-6f8c2bcb-gold1) and were mapped mechanically by "
    "scripts/integrate_session_6f8c2bcb.py; their numbers were not retyped."
)
json.dump(dst, open(DST, "w"), indent=2, ensure_ascii=False)
open(DST, "a").write("\n")

print(f"migrated {len(migrated)} rows, skipped {len(skipped)}")
for s in skipped:
    print("  skip:", s)
for m in migrated:
    print(f"  {m['id']:22s} {m['karat']:4s} {m['price_low']:>8.0f}  solid={m['solid_stated']}  {m['price_basis']}")
