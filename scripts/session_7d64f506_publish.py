#!/usr/bin/env python3
"""sess-7d64f506 (board T52) — publish the 2026-10-23 re-read on the two secondary surfaces.

Text-only changes. No number on any page is invented here: every date and figure
written below comes from data/session-7d64f506/live-reads-2026-10-23.json or
research/policy/market.json, and scripts/audit-evidence.js checks the underlying
data afterwards.
"""
from __future__ import annotations

import glob
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

FOOTER_OLD = "Official product prices retrieved 2026-10-22."
FOOTER_NEW = ("Official product prices retrieved 2026-10-22 and re-read live 2026-10-23 "
              "(all 13 stored prices reproduced; none changed).")

SITE_BANNER = (
    '<div class="rule-banner"><strong>BOUNDED 13-ROW SNAPSHOT.</strong><span>This is the standalone '
    'official-source evidence review, re-read live on 2026-10-23. It is not the full catalogue — the '
    'canonical 71-row verified dashboard is at the <a href="https://karagemop466-tech.github.io/GOLD1/" target="_blank" rel="noopener noreferrer">site root ↗</a>.</span></div>'
)

DOCS_BANNER = (
    '<div class="policy-banner" id="snapshot-notice"><strong>Dated snapshot (2026-10-22), not the current '
    'catalogue.</strong> This is a 14-row secondary dashboard from the first research pass; its gold anchor '
    'is dated 2026-10-21 and 7 of its 14 prices are marked unverified. The canonical, continuously '
    're-verified 71-row dashboard is at <a href="../index.html">the site root</a>. Re-open the official '
    'seller page before relying on any figure here.</div>'
)


def patch_site_page(path: str) -> None:
    with open(path, encoding="utf-8") as handle:
        html = handle.read()
    original = html
    html = html.replace(FOOTER_OLD, FOOTER_NEW)
    html = html.replace("Independent research snapshot · 22 Oct 2026",
                        "Independent research snapshot · 22 Oct 2026, re-read live 23 Oct 2026")
    if "BOUNDED 13-ROW SNAPSHOT" not in html:
        # insert immediately after the existing rule banner on the landing page
        html = re.sub(
            r'(<div class="rule-banner"><strong>NO HALLUCINATIONS\.</strong>.*?</div>)',
            r"\1\n    " + SITE_BANNER,
            html,
            count=1,
        )
    if path.endswith("calculator.html"):
        old = ("The default is Kitco’s Live GoldPrice panel, Oct 22, 2026 – 19:11 NY Time: $4,025.00 bid/troy "
               "oz, displayed $129.41/g.")
        new = ("The default is Kitco’s Live GoldPrice panel, Oct 22, 2026 – 19:11 NY Time: $4,025.00 bid/troy "
               "oz, displayed $129.41/g — a dated snapshot. An independent gold-api.com spot read on "
               "2026-10-23T23:38:16Z published $3,996.899902/troy oz ($128.50/g); it is stored beside the "
               "snapshot, not blended with it.")
        html = html.replace(old, new)
    if html != original:
        with open(path, "w", encoding="utf-8") as handle:
            handle.write(html)
        print(f"updated {os.path.relpath(path, ROOT)}")


def patch_docs_page(path: str) -> None:
    with open(path, encoding="utf-8") as handle:
        html = handle.read()
    if 'id="snapshot-notice"' in html:
        return
    marker = '<main class="wrap">'
    if marker not in html:
        print(f"SKIPPED {os.path.relpath(path, ROOT)} (no <main class=\"wrap\"> marker)")
        return
    html = html.replace(marker, marker + "\n" + DOCS_BANNER, 1)
    with open(path, "w", encoding="utf-8") as handle:
        handle.write(html)
    print(f"updated {os.path.relpath(path, ROOT)}")


def main() -> None:
    for path in sorted(glob.glob(os.path.join(ROOT, "site", "*.html"))):
        patch_site_page(path)
    for path in sorted(glob.glob(os.path.join(ROOT, "docs", "*.html"))):
        patch_docs_page(path)

    ledger = json.load(open(os.path.join(ROOT, "data/session-7d64f506/live-reads-2026-10-23.json"),
                            encoding="utf-8"))
    print(f"ledger summary: {ledger['summary']['rowsReopenedLive']}/{ledger['summary']['rowsInRegister']} "
          f"rows re-opened, {ledger['summary']['pricesChanged']} prices changed")


if __name__ == "__main__":
    main()
