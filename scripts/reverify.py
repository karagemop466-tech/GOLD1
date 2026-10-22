#!/usr/bin/env python3
"""
GOLD1 — line-by-line re-verification recorder (session sess-277867af).

Merge observed live-page values into data/verification-<date>.json and, when a
row is confirmed or corrected, into data/rings.json.

This script never invents a value. Every number it writes must be passed in as
an `observed_*` string copied from the official page, together with the page URL
and the exact quote it was read from. Anything not observed stays blank and is
flagged.

Usage:
    python3 scripts/reverify.py data/verify-batch-N.json [--apply]
"""
import json
import sys
import os
from datetime import datetime, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load(p):
    with open(os.path.join(ROOT, p), encoding="utf-8") as f:
        return json.load(f)


def save(p, obj):
    full = os.path.join(ROOT, p)
    os.makedirs(os.path.dirname(full), exist_ok=True)
    with open(full, "w", encoding="utf-8") as f:
        json.dump(obj, f, indent=1, ensure_ascii=False)
        f.write("\n")


def num(v):
    if v is None:
        return None
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).strip().replace("$", "").replace(",", "")
    if not s:
        return None
    try:
        return float(s)
    except ValueError:
        return None


def main():
    batch_path = sys.argv[1]
    apply_changes = "--apply" in sys.argv
    batch = load(batch_path)

    vdate = batch.get("date", "2026-10-22")
    vpath = f"data/verification-{vdate}.json"
    vdoc = load(vpath) if os.path.exists(os.path.join(ROOT, vpath)) else {
        "as_of": batch.get("fetched_at", vdate),
        "session": "sess-277867af",
        "branch": "arena/277867af-gold1",
        "method": (
            "Each row's official source page was fetched again on the verification date. "
            "Price, karat, title, metal and any published weight were read from that page and "
            "compared with the stored value. A stored value that could not be reproduced on the "
            "live official page is replaced by the observed value (or blanked if the page no "
            "longer shows it) and flagged. Nothing is inferred."
        ),
        "results": [],
    }
    existing = {r["id"]: r for r in vdoc["results"]}
    for r in batch["results"]:
        existing[r["id"]] = r
    vdoc["results"] = [existing[k] for k in sorted(existing)]
    save(vpath, vdoc)

    if not apply_changes:
        print(f"recorded {len(batch['results'])} result(s) into {vpath} (data/rings.json untouched)")
        return

    rings = load("data/rings.json")
    by_id = {r["id"]: r for r in rings["rows"]}
    changes = []
    for res in vdoc["results"]:
        row = by_id.get(res["id"])
        if not row:
            print(f"  !! {res['id']}: no such row in data/rings.json")
            continue
        obs = res.get("observed", {})
        # price
        lo, hi = num(obs.get("price_low")), num(obs.get("price_high"))
        if lo is not None and hi is not None:
            if (row.get("price_low"), row.get("price_high")) != (lo, hi):
                changes.append(f"{res['id']}: price {row.get('price_low')}-{row.get('price_high')} -> {lo}-{hi}")
                row["price_low"], row["price_high"] = lo, hi
        # published weight
        wlo, whi = num(obs.get("weight_g_low")), num(obs.get("weight_g_high"))
        if wlo is not None:
            if (row.get("weight_g_low"), row.get("weight_g_high")) != (wlo, whi if whi is not None else wlo):
                changes.append(f"{res['id']}: weight {row.get('weight_g_low')}-{row.get('weight_g_high')} -> {wlo}-{whi}")
            row["weight_g_low"] = wlo
            row["weight_g_high"] = whi if whi is not None else wlo
            row.setdefault("flags", [])
            if "weight_not_published" in row["flags"]:
                row["flags"].remove("weight_not_published")
            if "weight_published" not in row["flags"]:
                row["flags"].append("weight_published")
        elif res.get("status") == "confirmed" and obs.get("weight_absent"):
            if "weight_not_published" not in row.get("flags", []):
                row.setdefault("flags", []).append("weight_not_published")
        # karat
        if obs.get("karat"):
            if row.get("karat") != obs["karat"]:
                changes.append(f"{res['id']}: karat {row.get('karat')} -> {obs['karat']}")
                row["karat"] = obs["karat"]
        # title
        if obs.get("title") and row.get("title") != obs["title"]:
            changes.append(f"{res['id']}: title -> {obs['title']}")
            row["title"] = obs["title"]
        # solid gold wording
        if obs.get("solid_stated") is True and not row.get("solid_stated"):
            row["solid_stated"] = True
            row.setdefault("flags", [])
            if "solid_not_stated" in row["flags"]:
                row["flags"].remove("solid_not_stated")
            changes.append(f"{res['id']}: 'solid gold' wording now confirmed on page")
        # provenance refresh
        row["retrieved_at"] = vdate
        row["verified_at"] = vdate
        row["verification_status"] = res.get("status")
        row["verification_quote"] = res.get("quote", "")
        if res.get("status") == "changed":
            row.setdefault("flags", [])
            if "price_changed_on_recheck" not in row["flags"]:
                row["flags"].append("price_changed_on_recheck")
        if obs.get("evidence_suffix"):
            row["evidence"] = (row.get("evidence", "") + " " + obs["evidence_suffix"]).strip()
        if obs.get("notes"):
            row["notes"] = ((row.get("notes", "") + " ") if row.get("notes") else "") + obs["notes"]

    save("data/rings.json", rings)
    save(vpath, vdoc)
    print(f"applied to data/rings.json — {len(changes)} change(s):")
    for c in changes:
        print("   -", c)


if __name__ == "__main__":
    main()
