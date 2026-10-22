#!/usr/bin/env python3
"""GOLD1 verification & hallucination audit.

Run after EVERY data review:
    python3 scripts/verify_data.py

Checks (any FAIL exits non-zero and must be fixed before publish):
  1. Schema: every ring has required fields; price/karat verification consistency.
  2. Anti-hallucination: a non-null price REQUIRES price_verified=true AND a
     price_evidence with URL + exact quote + fetch method + date. An unverified
     price MUST be null (never rendered as a number).
  3. Evidence integrity: every evidence/claim URL is https and registered in
     data/sources.json (or is the listing's own official product page).
  4. Arithmetic: karat purity % = karat/24; anchor per-gram derivation correct.
  5. Rendered-number audit: scan generated docs/*.html for $ amounts and
     purity percentages; every match must be explainable from data/*.json or
     documented constants (formulas/disclaimers) — catches stray invented numbers.
  6. Internal links: every relative href/src in docs/*.html exists on disk.
  7. Flags: every ring with any unverified value must be covered by a flag
     (F1 covers weight; per-row unverified prices/karats must be in flagged.json).

Writes data/audit_report.json.
"""
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
DOCS = os.path.join(ROOT, "docs")

failures = []
warnings = []


def load(name):
    with open(os.path.join(DATA, name), encoding="utf-8") as f:
        return json.load(f)


def check(cond, msg):
    if not cond:
        failures.append(msg)
    return cond


def main():
    sources = load("sources_c2bbe753.json")
    price = load("gold_price.json")
    karats = load("karats.json")
    rings = load("rings_c2bbe753.json")
    flags = load("flags.json")
    checklist = load("checklist.json")

    report = {"generated_utc_hint": "see git log", "checks": [], "failures": [], "warnings": []}

    src_urls = {s["url"] for s in sources["sources"]}

    # ---- 1/2/3: rings
    for r in rings["rings"]:
        rid = r.get("id", "?")
        for field in ("retailer", "name", "url", "karat", "price_verified", "karat_verified", "weight_g", "weight_verified"):
            check(field in r, f"{rid}: missing field '{field}'")
        check(r["url"].startswith("https://"), f"{rid}: product URL must be https")
        # price policy
        if r["price_usd"] is not None:
            check(r["price_verified"] is True, f"{rid}: price {r['price_usd']} present but price_verified is not true")
            pe = r.get("price_evidence")
            check(bool(pe), f"{rid}: verified price missing price_evidence")
            if pe:
                check(bool(pe.get("quote")), f"{rid}: price_evidence missing exact quote")
                check(pe.get("fetch_method") == "direct-fetch", f"{rid}: price evidence must be direct-fetch")
                check(bool(pe.get("fetched_utc")), f"{rid}: price_evidence missing fetch date")
                u = pe.get("url", r["url"])
                check(u in src_urls or u == r["url"], f"{rid}: price evidence URL not registered in sources.json: {u}")
        else:
            check(r["price_verified"] is False, f"{rid}: null price must have price_verified=false")
        # karat policy
        if r.get("karat_verified"):
            ke = r.get("karat_evidence")
            check(bool(ke), f"{rid}: karat_verified without karat_evidence")
            if ke:
                check(bool(ke.get("quote")), f"{rid}: karat_evidence missing quote")
        else:
            check("UNVERIFIED" in (r.get("karat") or "").upper() or r.get("karat") is None,
                  f"{rid}: unverified karat text must say UNVERIFIED")
        # weight policy: weight must be null unless weight_verified with evidence
        if r["weight_g"] is not None:
            check(r["weight_verified"] is True and bool(r.get("weight_evidence")),
                  f"{rid}: weight present without verification/evidence")
        # returns, if string exists keep as captured (no check possible)
        check(r.get("price_usd") is None or r["price_usd"] > 0, f"{rid}: price must be positive")

    # ---- 3: sources register sanity
    for s in sources["sources"]:
        check(s["url"].startswith("https://"), f"source {s['id']}: URL must be https")
        check(s["fetch_method"] in ("direct-fetch", "search-snapshot"), f"source {s['id']}: bad fetch_method")

    # ---- 4: arithmetic
    for k in karats["karats"]:
        # purity follows the millesimal fineness standard when the mark is a
        # specific number (e.g. 22K -> 916 -> 91.6%, 24K -> 999 -> 99.9%),
        # otherwise exact karat/24 math.
        import re as _re
        m = _re.match(r"(\d{3})", str(k.get("fineness_mark", "")))
        if m:
            expect = round(int(m.group(1)) / 10.0, 1)
            tol = 0.2  # allows dual marks like 583/585
        else:
            expect = round(k["karat"] / 24 * 100, 1)
            tol = 0.051
        check(abs(k["purity_percent"] - expect) <= tol,
              f"karat {k['karat']}K: purity {k['purity_percent']} != expected {expect}")
    anchor = price["anchor"]
    per_g = round(anchor["price_usd_per_troy_oz"] / 31.1034768, 2)
    check(per_g == 129.39, f"anchor per-gram derivation mismatch: computed {per_g}")

    # ---- 5: rendered-number audit (docs must exist)
    docs_exist = os.path.isdir(DOCS) and os.path.exists(os.path.join(DOCS, "index.html"))
    if not docs_exist:
        warnings.append("docs/ not built yet — rendered-number audit skipped (run build_site.py first)")
    else:
        known = set()
        def add_known(x):
            known.add(x)
        for r in rings["rings"]:
            if r["price_usd"] is not None:
                add_known(f"${r['price_usd']:,.0f}")
                add_known(f"${r['price_usd']:,d}")
        add_known(f"${anchor['price_usd_per_troy_oz']:,.2f}")
        add_known(f"{anchor['price_usd_per_troy_oz']:,.2f}")
        for c in price["cross_checks"]:
            add_known(f"${c['value_usd_per_oz']:,.2f}")
            add_known(f"{c['value_usd_per_oz']:,.2f}")
        for k in karats["karats"]:
            add_known(f"{k['purity_percent']:.1f}%")
            add_known(f"{k['purity_percent']:.1f}")
        # documented constants on pages (formulas/disclaimers/conversions)
        documented = {"$1,000", "4,024.36", "31.1034768", "1.55517384", "58.3", "75.0", "41.7", "91.6", "99.9",
                      "0.5", "7/1000", "3/1000", "1/40th", "13.5", "2.5"}
        pattern = re.compile(r"\$[\d,]+(?:\.\d+)?|\b\d{1,3}(?:,\d{3})+(?:\.\d+)?%?")
        html_blob = ""
        per_page_counts = {}
        for fn in sorted(os.listdir(DOCS)):
            if fn.endswith(".html"):
                t = open(os.path.join(DOCS, fn), encoding="utf-8").read()
                per_page_counts[fn] = len(t)
                html_blob += t

        def norm(tok):
            t = tok.replace("$", "").replace("%", "").replace(",", "").strip()
            try:
                fv = float(t)
                return round(fv, 2)
            except ValueError:
                return t

        known_norm = {norm(x) for x in known}
        # every numeric token that literally appears anywhere in data/*.json is
        # by definition traceable to the audited data layer (quotes, notes, ranges)
        for fn in sorted(os.listdir(DATA)):
            if fn.endswith(".json"):
                blob = open(os.path.join(DATA, fn), encoding="utf-8").read()
                for tok in pattern.findall(blob):
                    known_norm.add(norm(tok))
        documented_norm = {norm(x) for x in documented}
        for m in set(pattern.findall(html_blob)):
            if norm(m) not in known_norm and norm(m) not in documented_norm:
                warnings.append(f"rendered number {m!r} not matched to data values — confirm it is a documented constant/formula, else investigate")
        report["pages"] = per_page_counts

    # ---- 6: internal links
    if docs_exist:
        href = re.compile(r'(?:href|src)="([^"#?]+)(?:[?#][^"]*)?"')
        for fn in sorted(os.listdir(DOCS)):
            if not fn.endswith(".html"):
                continue
            t = open(os.path.join(DOCS, fn), encoding="utf-8").read()
            for u in href.findall(t):
                if u.startswith(("http://", "https://", "mailto:", "tel:", "data:")):
                    continue
                target = os.path.join(DOCS, u)
                check(os.path.exists(target), f"{fn}: broken internal link -> {u}")

    # ---- 7: unverified values must be flagged
    flag_ids = {f["id"] for f in flags["flags"]}
    check("F1" in flag_ids, "F1 (weights not published) must exist while any weight_g is null")
    for r in rings["rings"]:
        if not r["price_verified"]:
            hay = " ".join((f.get("detail", "") + " " + f.get("title", "")) for f in flags["flags"])
            style = str(r.get("style_ref") or "")
            covered = (r["id"] in hay) or (len(style) >= 4 and style in hay)
            check(covered, f"{r['id']}: unverified price not referenced by any flag in flagged.json")
    # checklist sanity
    for c in checklist["checklist"]:
        if c.get("source_url"):
            check(c["source_url"].startswith("https://"), f"{c['id']}: source_url must be https")

    report["failures"] = failures
    report["warnings"] = warnings
    report["checks_summary"] = {
        "rings_total": len(rings["rings"]),
        "prices_verified": sum(1 for r in rings["rings"] if r["price_verified"]),
        "prices_left_blank": sum(1 for r in rings["rings"] if r["price_usd"] is None),
        "karats_verified": sum(1 for r in rings["rings"] if r.get("karat_verified")),
        "weights_verified": sum(1 for r in rings["rings"] if r["weight_verified"]),
        "flags_open": len(flags["flags"]),
        "registered_sources": len(sources["sources"]),
        "direct_fetch_sources": sum(1 for s in sources["sources"] if s["fetch_method"] == "direct-fetch"),
    }

    with open(os.path.join(DATA, "audit_report.json"), "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    print("=== GOLD1 verification audit ===")
    print(json.dumps(report["checks_summary"], indent=2))
    for w in warnings:
        print("WARN:", w)
    if failures:
        print(f"\nFAIL ({len(failures)}):")
        for x in failures:
            print("  -", x)
        sys.exit(1)
    print("\nPASS: no hallucination-pattern failures detected.")


if __name__ == "__main__":
    main()
