#!/usr/bin/env python3
"""
GOLD1 — data verification ("security") pass.

This script is the guard against hallucination. It does not trust the dataset; it
re-derives every number it can and fails the build when a row is unsupported.

Passes
  1. SCHEMA      required fields, correct types, no placeholder strings
  2. SOURCE      every row has an https source that exists in the source registry
                 and whose host matches the retailer's own domain
  3. PRICE       price is a positive number, USD, display string matches the number,
                 price type is explicit, dates are real and not in the future
  4. EVIDENCE    no invented values: weight/hallmark may only be non-null when a
                 source is supplied for them; every empty value must carry a flag
  5. FLAGS       flag ids resolve; required flags are attached to the rows they affect;
                 severity/status vocabulary is valid
  6. STATS       the analysis block is recomputed from the rows and compared. Any
                 headline number that the data cannot reproduce is an error, because a
                 wrong summary statistic is a hallucination even when every row is right.

Exit code 0 = all passes clean, 1 = errors. Warnings do not fail the build.
Usage: python3 tools/verify_data.py
"""

from __future__ import annotations

import csv
import datetime as dt
import json
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"

ALLOWED_HOSTS = {
    "Blue Nile": {"www.bluenile.com", "bluenile.com"},
    "Mejuri": {"mejuri.com", "www.mejuri.com"},
    "Brilliant Earth": {"www.brilliantearth.com", "brilliantearth.com"},
}
# Government / regulator sources: acceptable evidence for legal and consumer-protection claims.
REGULATOR_HOSTS = {"ecfr.gov", "www.ecfr.gov", "federalregister.gov", "www.federalregister.gov",
                   "ftc.gov", "www.ftc.gov", "consumerfinance.gov", "www.consumerfinance.gov"}
# Market-data sources: acceptable ONLY for a point-in-time metal quote, never for a product claim.
MARKET_HOSTS = {"goldprice.org", "www.goldprice.org", "lbma.org.uk", "www.lbma.org.uk"}
# Retailers named in the flags as "not yet vetted". No dataset row may use these hosts.
CANDIDATE_HOSTS = {"costco.com", "www.costco.com", "jamesallen.com", "www.jamesallen.com",
                   "tiffany.com", "www.tiffany.com", "auratenewyork.com",
                   "dercodiamonds.com", "www.dercodiamonds.com"}
REQUIRED_ROW_FIELDS = [
    "id", "retailer", "category", "product", "url", "source_url", "source_type",
    "price", "price_display", "price_type", "purity", "metal",
    "solid_gold_statement", "weight_g", "weight_note", "hallmark_note",
    "checked_on", "status", "flags", "notes",
]
VALID_STATUS = {"verified", "verified-with-flag", "listing-verified"}
VALID_SOURCE_TYPES = {"product page", "category listing"}
VALID_SEVERITY = {"high", "medium", "low"}
FLAG_STATUS = {"needs review", "resolved"}

errors: list[str] = []
warnings: list[str] = []
checks = 0


def check(condition: bool, message: str) -> None:
    global checks
    checks += 1
    if not condition:
        errors.append(message)


def warn(condition: bool, message: str) -> None:
    global checks
    checks += 1
    if not condition:
        warnings.append(message)


def load(name: str) -> dict:
    path = DATA / name
    if not path.exists():
        errors.append(f"missing data file: {name}")
        return {}
    try:
        return json.loads(path.read_text())
    except json.JSONDecodeError as exc:
        errors.append(f"{name} is not valid JSON: {exc}")
        return {}


def host_of(url: str) -> str:
    m = re.match(r"https?://([^/]+)/?", url or "")
    return m.group(1).lower() if m else ""


def main() -> int:
    rings_doc = load("rings.json")
    spot = load("spot-gold.json")
    sources = load("sources.json")

    rows = rings_doc.get("rings", [])
    flags = rings_doc.get("flags", [])
    retailers = rings_doc.get("retailers", [])
    analysis = rings_doc.get("analysis", {})
    registry = sources.get("sources", [])
    registry_urls = {s.get("url", "") for s in registry}

    if not rows:
        print("FAIL: no rows found")
        return 1

    # ---------- pass 1: schema ----------
    for row in rows:
        rid = row.get("id", "<no-id>")
        for field in REQUIRED_ROW_FIELDS:
            check(field in row, f"{rid}: missing field '{field}'")
        for field, value in row.items():
            if isinstance(value, str):
                check(value.strip() != "", f"{rid}: empty string in '{field}'")
                check("null" != value.strip().lower(), f"{rid}: placeholder 'null' in '{field}'")
                check("tbd" != value.strip().lower(), f"{rid}: placeholder 'TBD' in '{field}'")
        check(re.fullmatch(r"[A-Z0-9\-]{6,}", rid) is not None, f"{rid}: id is not a stable slug")
        check(row.get("status") in VALID_STATUS, f"{rid}: invalid status {row.get('status')!r}")
        check(row.get("source_type") in VALID_SOURCE_TYPES, f"{rid}: invalid source_type")
        check(row.get("purity") in {"10K", "14K", "18K", "22K", "24K"}, f"{rid}: unexpected purity")
        check("solid gold" in row.get("solid_gold_statement", "").lower()
              or "karat" in row.get("solid_gold_statement", "").lower(),
              f"{rid}: solid_gold_statement must say whether 'solid gold' appears")
        check(len(row.get("specs", "")) > 0, f"{rid}: specs empty")

    ids = [r.get("id") for r in rows]
    dupes = [k for k, v in Counter(ids).items() if v > 1]
    check(not dupes, f"duplicate row ids: {dupes}")
    pairs = [(r.get("retailer"), r.get("product")) for r in rows]
    dupes2 = [k for k, v in Counter(pairs).items() if v > 1]
    check(not dupes2, f"duplicate retailer/product pairs: {dupes2}")

    # ---------- pass 2: source ----------
    for row in rows:
        rid = row.get("id")
        for field in ("url", "source_url"):
            url = row.get(field, "")
            check(url.startswith("https://"), f"{rid}: {field} is not https")
            check(" " not in url, f"{rid}: {field} contains a space")
            host = host_of(url)
            allowed = ALLOWED_HOSTS.get(row.get("retailer"), set())
            check(host in allowed, f"{rid}: {field} host {host!r} is not an official retailer host")
        check(row.get("source_url") in registry_urls,
              f"{rid}: source_url is not registered in data/sources.json")
        if row.get("source_type") == "category listing":
            check(row.get("status") == "listing-verified",
                  f"{rid}: listing-sourced row must carry status 'listing-verified'")
            warn("listing" in row.get("notes", "").lower(),
                 f"{rid}: listing-verified row should say the product page was not opened")
        else:
            warn(row.get("status") != "listing-verified",
                 f"{rid}: product-page row is wrongly marked listing-verified")

    # ---------- pass 3: price + dates ----------
    today = dt.date(2026, 10, 22)
    for row in rows:
        rid = row.get("id")
        price = row.get("price")
        check(isinstance(price, (int, float)) and not isinstance(price, bool),
              f"{rid}: price must be numeric")
        if isinstance(price, (int, float)):
            check(price > 0, f"{rid}: price must be positive")
            check(float(price).is_integer(), f"{rid}: price should be a whole dollar amount")
            expected = f"${price:,.0f}"
            display = row.get("price_display", "")
            check(expected in display, f"{rid}: price_display {display!r} does not contain {expected}")
            if row.get("price_is_from"):
                check(display.lower().startswith("from"), f"{rid}: 'from' price must say From")
        ptype = row.get("price_type", "")
        check(any(k in ptype for k in ("Setting", "Complete")),
              f"{rid}: price_type must state whether the centre stone is included")
        checked = row.get("checked_on", "")
        try:
            checked_date = dt.date.fromisoformat(checked)
            check(checked_date <= today, f"{rid}: checked_on is in the future")
            check((today - checked_date).days <= 7, f"{rid}: checked_on is more than 7 days old")
        except ValueError:
            errors.append(f"{rid}: checked_on is not ISO YYYY-MM-DD")

    # ---------- pass 4: evidence (no invented values) ----------
    for row in rows:
        rid = row.get("id")
        weight = row.get("weight_g")
        if weight is None:
            check(bool(row.get("weight_note")), f"{rid}: null weight needs an explanation")
            check("F-04" in row.get("flags", []), f"{rid}: null weight must carry flag F-04")
            check("no gram weight" in row.get("weight_note", "").lower(),
                  f"{rid}: weight_note should state that no gram weight was published")
        else:
            check(any(k in row for k in ("weight_source_url",)),
                  f"{rid}: a published weight needs its own source URL")
        check(row.get("weight_g") is not None or "F-04" in row.get("flags", []),
              f"{rid}: missing weight must be flagged")
        check(bool(row.get("hallmark_note")), f"{rid}: hallmark_note is required")
        if "no hallmark" in row.get("hallmark_note", "").lower():
            check("F-05" in row.get("flags", []), f"{rid}: unpublished hallmark must carry flag F-05")
        if "setting" in row.get("price_type", "").lower():
            check("F-06" in row.get("flags", []),
                  f"{rid}: setting-only price must carry flag F-06")
        if row.get("retailer") == "Mejuri":
            check("solid gold" in row.get("solid_gold_quote", "").lower(),
                  f"{rid}: Mejuri row should quote the page's 'solid gold' wording")
        check(row.get("source_url") != "", f"{rid}: empty source_url")

    # ---------- pass 5: flags ----------
    flag_ids = [f.get("id") for f in flags]
    dup_flags = [k for k, v in Counter(flag_ids).items() if v > 1]
    check(not dup_flags, f"duplicate flag ids: {dup_flags}")
    for flag in flags:
        fid = flag.get("id", "<no-id>")
        check(re.fullmatch(r"F-\d{2}", fid) is not None, f"{fid}: bad flag id format")
        check(flag.get("severity") in VALID_SEVERITY, f"{fid}: bad severity")
        check(flag.get("status") in FLAG_STATUS, f"{fid}: bad status")
        check(flag.get("detail", "").strip() != "", f"{fid}: empty detail")
        check(flag.get("source_url", "").startswith("https://"), f"{fid}: source_url must be https")
        host = host_of(flag.get("source_url", ""))
        check(host in REGULATOR_HOSTS or host in MARKET_HOSTS or host in CANDIDATE_HOSTS
              or any(host in v for v in ALLOWED_HOSTS.values()),
              f"{fid}: flag source host {host!r} is not an official, market or named-candidate host")
        if host in CANDIDATE_HOSTS:
            warn("not vetted" in flag.get("detail", "").lower() or "not vetted" in flag.get("title", "").lower(),
                 f"{fid}: a named-but-unvetted retailer must be labelled as such")
        for affected in flag.get("affected_rows", []):
            if affected.startswith(("BN-", "MEJ-", "BE-")):
                check(affected in ids, f"{fid}: references unknown row {affected}")
    for row in rows:
        for fid in row.get("flags", []):
            check(fid in flag_ids, f"{row.get('id')}: references unknown flag {fid}")
    for row in rows:
        check(len(row.get("flags", [])) > 0, f"{row.get('id')}: rows must carry their flags")

    # ---------- pass 6: statistics must be reproducible ----------
    actual = {
        "row_count": len(rows),
        "retailer_count": len({r.get("retailer") for r in rows}),
        "verified_product_page_rows": sum(1 for r in rows if r.get("source_type") == "product page"),
        "listing_verified_rows": sum(1 for r in rows if r.get("source_type") == "category listing"),
        "setting_only_rows": sum(1 for r in rows if "setting" in r.get("price_type", "").lower()),
        "complete_ring_rows": sum(1 for r in rows if "complete" in r.get("price_type", "").lower()),
        "rows_with_published_gram_weight": sum(1 for r in rows if r.get("weight_g") is not None),
        "rows_with_published_hallmark": sum(
            1 for r in rows if "no hallmark" not in r.get("hallmark_note", "").lower()),
        "rows_with_explicit_solid_gold_wording": sum(
            1 for r in rows if r.get("solid_gold_statement", "").lower().startswith("yes")),
        "purity_spread": dict(Counter(r.get("purity") for r in rows)),
    }
    for key, value in actual.items():
        check(analysis.get(key) == value,
              f"analysis.{key} says {analysis.get(key)!r} but the rows give {value!r}")
    check(actual["setting_only_rows"] + actual["complete_ring_rows"] == len(rows),
          "every row must be either setting-only or complete-ring")
    check(actual["rows_with_published_gram_weight"] == 0,
          "a published weight appeared: re-check flag F-04 before shipping")
    setting_prices = [r["price"] for r in rows if "setting" in r["price_type"].lower()]
    complete_prices = [r["price"] for r in rows if "complete" in r["price_type"].lower()]
    rng = analysis.get("setting_price_range_usd", {})
    check(rng.get("min") == min(setting_prices) and rng.get("max") == max(setting_prices),
          "setting price range does not match the rows")
    rng2 = analysis.get("complete_ring_price_range_usd", {})
    check(rng2.get("min") == min(complete_prices) and rng2.get("max") == max(complete_prices),
          "complete-ring price range does not match the rows")
    cmp = analysis.get("same_design_14k_vs_18k", {})
    if cmp:
        check(cmp.get("18k_price", 0) - cmp.get("14k_price", 0) == cmp.get("difference"),
              "14K vs 18K difference does not add up")
        check(round(100 * (cmp["18k_price"] - cmp["14k_price"]) / cmp["14k_price"], 1)
              == cmp.get("difference_percent"),
              "14K vs 18K percentage difference does not recompute")
        check(cmp.get("14k_price") == next(r["price"] for r in rows if r["id"] == "BN-14K-6P-203272"),
              "14K comparison price does not match the referenced row")
        check(cmp.get("18k_price") == next(r["price"] for r in rows if r["id"] == "BN-18K-6P-194159"),
              "18K comparison price does not match the referenced row")

    # ---------- spot + registry sanity ----------
    spot_value = spot.get("value")
    check(isinstance(spot_value, (int, float)) and spot_value > 0, "spot-gold value missing")
    check(bool(spot.get("quote_timestamp_on_source")), "spot-gold must carry its source timestamp")
    check(spot.get("source_url") in registry_urls, "spot-gold source is not registered")
    check(spot.get("retrieved_on") == "2026-10-22", "spot-gold retrieval date drifted")
    check(abs(spot.get("unit_constants", {}).get("grams_per_troy_ounce", 0) - 31.1034768) < 1e-9,
          "troy ounce constant is wrong")
    for src in registry:
        check(src.get("url", "").startswith("https://"), f"{src.get('id')}: registry url not https")
        check(src.get("status") in {"official", "official-partial", "verified",
                                    "verified-with-flag", "verified-listing",
                                    "verified-single-source", "unverified"},
              f"{src.get('id')}: unknown registry status {src.get('status')!r}")
    for retailer in retailers:
        check(retailer.get("rows_in_dataset") ==
              sum(1 for r in rows if r.get("retailer") == retailer.get("name")),
              f"{retailer.get('id')}: rows_in_dataset does not match the rows")

    # ---------- CSV is generated, never hand-edited ----------
    csv_path = DATA / "rings.csv"
    with csv_path.open("w", newline="") as fh:
        writer = csv.writer(fh)
        cols = ["id", "retailer", "category", "product", "purity", "metal", "price",
                "price_display", "price_type", "weight_g", "weight_note", "hallmark_note",
                "specs", "returns_summary", "source_url", "checked_on", "status", "flags", "notes"]
        writer.writerow(cols)
        for row in rows:
            writer.writerow([row.get(c, "") if c != "flags" else "; ".join(row.get("flags", []))
                             for c in cols])

    # ---------- report ----------
    report = {
        "generated_on": today.isoformat(),
        "rows": len(rows),
        "flags": len(flags),
        "sources": len(registry),
        "assertions": checks,
        "errors": len(errors),
        "warnings": len(warnings),
        "error_list": errors,
        "warning_list": warnings,
        "statistics": {k: v for k, v in actual.items()},
    }
    (DATA / "verification-report.json").write_text(json.dumps(report, indent=2) + "\n")

    print("=" * 72)
    print("GOLD1 VERIFICATION REPORT")
    print("=" * 72)
    print(f"rows checked        : {len(rows)}")
    print(f"flags checked       : {len(flags)}")
    print(f"source registry     : {len(registry)}")
    print(f"assertions run      : {checks}")
    print(f"errors              : {len(errors)}")
    print(f"warnings            : {len(warnings)}")
    for key, value in actual.items():
        print(f"  {key:38s}: {value}")
    if warnings:
        print("\nWARNINGS")
        for w in warnings:
            print("  ~", w)
    if errors:
        print("\nERRORS")
        for e in errors:
            print("  x", e)
        print("\nRESULT: FAIL — fix the errors above before publishing.")
        return 1
    print("\nRESULT: PASS — schema, sources, prices, evidence, flags and statistics all reconcile.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
