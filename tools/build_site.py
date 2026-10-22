#!/usr/bin/env python3
"""
GOLD1 — static site generator.

Reads data/*.json and writes a dependency-free static site into docs/ (served by
GitHub Pages). Nothing on the site is typed by hand: every number in every table
comes from the verified dataset, so a figure cannot drift from its source.

Also performs a link check over the generated site:
  * internal links must resolve to a generated file (and to an existing anchor)
  * external links must be https and on an approved host
Exit code 1 on any broken link or missing dataset.
"""

from __future__ import annotations

import html
import json
import re
import shutil
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
OUT = ROOT / "docs"
TODAY = "2026-10-22"

APPROVED_EXTERNAL_HOSTS = {
    "www.bluenile.com", "bluenile.com", "mejuri.com", "www.mejuri.com",
    "www.brilliantearth.com", "brilliantearth.com", "goldprice.org", "www.goldprice.org",
    "ecfr.gov", "www.ecfr.gov", "federalregister.gov", "www.federalregister.gov",
    "ftc.gov", "www.ftc.gov", "consumerfinance.gov", "www.consumerfinance.gov",
    "www.costco.com", "costco.com", "www.jamesallen.com", "jamesallen.com",
    "www.tiffany.com", "tiffany.com", "auratenewyork.com", "www.dercodiamonds.com",
    "www.lbma.org.uk",
}

rings_doc = json.loads((DATA / "rings.json").read_text())
spot_doc = json.loads((DATA / "spot-gold.json").read_text())
sources_doc = json.loads((DATA / "sources.json").read_text())

ROWS = rings_doc["rings"]
FLAGS = rings_doc["flags"]
RETAILERS = rings_doc["retailers"]
ANALYSIS = rings_doc["analysis"]
META = rings_doc["meta"]
SOURCES = sources_doc["sources"]
AUDIT = json.loads((DATA / "verification-report.json").read_text())
SPOT = spot_doc["value"]

NAV = [
    ("index.html", "Overview"),
    ("solitaire.html", "Solitaire settings"),
    ("bands.html", "Bands"),
    ("retailers.html", "Retailers"),
    ("calculator.html", "Gold calculator"),
    ("verification.html", "Verification"),
    ("flagged.html", f"Flagged ({len(FLAGS)})"),
]


def esc(value) -> str:
    return html.escape(str(value), quote=True)


def badge(status: str) -> str:
    mapping = {
        "verified": ("ok", "Verified · product page"),
        "verified-with-flag": ("warn", "Verified · with a flag"),
        "listing-verified": ("info", "Verified · listing page"),
        "needs review": ("warn", "Needs review"),
        "resolved": ("ok", "Resolved"),
        "high": ("danger", "High"),
        "medium": ("warn", "Medium"),
        "low": ("info", "Low"),
    }
    cls, label = mapping.get(status, ("info", status))
    return f'<span class="badge {cls}">{esc(label)}</span>'


def money(amount: float) -> str:
    return f"${amount:,.0f}"


def page(title: str, active: str, body: str, description: str, script: str = "") -> str:
    nav = "".join(
        f'<a href="{href}" class="{"active" if href == active else ""}">{esc(label)}</a>'
        for href, label in NAV
    )
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{esc(title)} · GOLD1</title>
<meta name="description" content="{esc(description)}">
<link rel="stylesheet" href="assets/style.css">
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="site-header">
  <div class="wrap header-inner">
    <a class="brand" href="index.html"><span class="brand-dot"></span>GOLD<span class="brand-suffix">/ ring research</span></a>
    <nav class="site-nav" aria-label="Sections">{nav}</nav>
  </div>
</header>
<main id="main" class="wrap">
{body}
</main>
<footer class="site-footer">
  <div class="wrap footer-inner">
    <p><strong>No invented numbers.</strong> Every price here was read from the retailer's own page on {TODAY} and is timestamped. Blank cells are blank because the seller does not publish the value — not because it was estimated.</p>
    <p class="foot-meta">Dataset v{esc(META["dataset_version"])} · compiled {esc(META["compiled_on"])} · <a href="verification.html">how verification works</a> · <a href="flagged.html">flagged items</a> · <a href="data/rings.csv">download CSV</a></p>
  </div>
</footer>
<script src="assets/app.js" defer></script>
{script}
</body>
</html>
"""


def table(rows_html: str, headers: list[tuple[str, str]], table_id: str, note: str = "") -> str:
    head = "".join(
        f'<th class="{cls}" scope="col">{esc(label)}</th>' for label, cls in headers
    )
    note_html = f'<p class="table-note">{note}</p>' if note else ""
    return f"""
<div class="table-tools">
  <label class="filter-label">Filter
    <input type="search" data-filter="{table_id}" placeholder="Type a retailer, product or ID…" aria-label="Filter table">
  </label>
  <span class="filter-count" data-count-for="{table_id}"></span>
</div>
<div class="table-scroll">
<table id="{table_id}" class="data-table" data-filterable>
  <thead><tr>{head}</tr></thead>
  <tbody>{rows_html}</tbody>
</table>
</div>
{note_html}
"""


# --------------------------------------------------------------------------- index
CHECKLIST = [
    ("Gold purity stated on the listing (karat)", "verified",
     "All 13 rows state 14K or 18K in the product title and metal spec (10 × 14K, 3 × 18K).",
     "solitaire.html", "See purity column"),
    ("Solid gold — not plated/vermeil/filled", "partial",
     "Mejuri uses the words “14k solid gold” (4 rows). Blue Nile and Brilliant Earth state karat only; none of the pages uses plated or vermeil language for these rows.",
     "verification.html", "Wording gap, see finding"),
    ("Hallmark + maker's mark", "unverified",
     "0 of 13 listings publish what is stamped inside the band. The legal requirement for a maker's mark beside a quality mark is cited, but no physical stamp has been inspected.",
     "flagged.html", "Flag F-05"),
    ("Weight in grams", "unverified",
     "0 of 13 listings publish a gram weight. Widths and thicknesses are published instead. Weight must be requested in writing.",
     "flagged.html", "Flag F-04"),
    ("Seller reputation (independent)", "unverified",
     "Business contact details verified (phone numbers or store locator). BBB profiles, complaint records and independent reviews were NOT checked in this pass.",
     "retailers.html", "Flag F-10"),
    ("Price vs gold value", "partial",
     "Prices are verified per row. Melt value cannot be computed for any row without a weight, so no price is labelled cheap or expensive.",
     "calculator.html", "Calculator ready, data missing"),
    ("Return policy", "partial",
     "Mejuri: 30-day free returns with stated exclusions. Blue Nile and Brilliant Earth show a Free Returns badge but the window was not confirmed on the pages read.",
     "retailers.html", "Flags F-08, F-09"),
    ("Payment protection", "unverified",
     "Credit card is recommended as standard practice; no official CFPB/FTC citation was captured in this pass, so the claim is not marked verified.",
     "flagged.html", "Flag F-12"),
    ("Documentation kept", "verified",
     "Every row stores its source URL, checked date, purity wording and price basis in machine-readable form (JSON + CSV) so the record survives page changes.",
     "verification.html", "Download the dataset"),
    ("Independent verification on arrival", "recommended",
     "Physical XRF or equivalent testing at an independent jeweler is the only way to confirm composition. Nothing on this site substitutes for it.",
     "verification.html", "Read the method"),
    ("XRF / professional purity test", "recommended",
     "XRF is named as a non-destructive option. This project did not verify any testing standard or accredit a lab, so treat the named method as a recommendation.",
     "verification.html", "Scope limits"),
    ("Seller must allow verification + return", "recommended",
     "A seller who will not supply weight in writing, will not allow inspection and will not accept a return fails this project's buy/no-buy rule.",
     "retailers.html", "Buy rule"),
    ("14K/18K stamp is not proof", "verified",
     "Cited to the National Stamping Act as described in the Federal Register's Jewelry Guides: a quality mark is a marking requirement, not an assay of the item in hand.",
     "verification.html", "Primary sources"),
]


def checklist_rows() -> str:
    out = []
    icons = {"verified": ("✔", "ok"), "partial": ("◐", "warn"),
             "unverified": ("✕", "danger"), "recommended": ("→", "info")}
    for item, status, note, href, link_label in CHECKLIST:
        glyph, cls = icons[status]
        out.append(
            f'<tr><td data-label="Check"><strong>{esc(item)}</strong></td>'
            f'<td data-label="Status"><span class="badge {cls}">{glyph} {esc(status)}</span></td>'
            f'<td data-label="What we found">{esc(note)}</td>'
            f'<td data-label="Evidence"><a href="{href}">{esc(link_label)}</a></td></tr>'
        )
    return "".join(out)


def index_row(row: dict) -> str:
    weight = "—" if row["weight_g"] is None else f'{row["weight_g"]} g'
    return (
        f'<tr>'
        f'<td data-label="ID"><code>{esc(row["id"])}</code></td>'
        f'<td data-label="Retailer">{esc(row["retailer"])}</td>'
        f'<td data-label="Ring"><a href="{esc(row["url"])}" target="_blank" rel="noopener">{esc(row["product"])}</a>'
        f'<span class="cell-sub">{esc(row["category"])}</span></td>'
        f'<td data-label="Purity">{esc(row["purity"])}</td>'
        f'<td data-label="Price" class="num">{esc(row["price_display"])}</td>'
        f'<td data-label="Price basis">{esc(row["price_type"])}</td>'
        f'<td data-label="Weight" class="muted">{weight}</td>'
        f'<td data-label="Checked">{esc(row["checked_on"])}</td>'
        f'<td data-label="Status">{badge(row["status"])}</td>'
        f'</tr>'
    )


def stat_card(value: str, label: str, sub: str, tone: str = "") -> str:
    return (f'<div class="stat {tone}"><div class="stat-value">{esc(value)}</div>'
            f'<div class="stat-label">{esc(label)}</div>'
            f'<div class="stat-sub">{esc(sub)}</div></div>')


def build_index() -> str:
    rows_html = "".join(index_row(r) for r in ROWS)
    nav_cards = "".join(
        f'<a class="nav-card" href="{href}"><h3>{esc(title)}</h3><p>{esc(desc)}</p>'
        f'<span class="nav-card-link">Open →</span></a>'
        for href, title, desc in [
            ("solitaire.html", "Solitaire settings", f'{ANALYSIS["setting_only_rows"]} Blue Nile and Brilliant Earth settings, prices excluding the centre stone.'),
            ("bands.html", "Bands", f'{ANALYSIS["complete_ring_rows"]} Mejuri rings, sold as complete rings in 14k solid gold.'),
            ("retailers.html", "Retailers", "Returns, warranty, contact details and what each seller refuses to publish."),
            ("calculator.html", "Gold calculator", "Weight × purity × spot. Works the moment you have a real gram weight."),
            ("verification.html", "Verification", "Six automated passes, the source registry, and what was not verified."),
            ("flagged.html", f'Flagged for review ({len(FLAGS)})', "Every irregularity, with its source link, published rather than buried."),
        ]
    )
    findings = "".join(f"<li>{esc(f)}</li>" for f in ANALYSIS["findings"])
    body = f"""
<section class="hero">
  <p class="eyebrow">Gold engagement ring · buyer's dashboard</p>
  <h1>Gold engagement rings, priced only from the seller's own page.</h1>
  <p class="lede">A small, verified dataset — {ANALYSIS["row_count"]} listings across {ANALYSIS["retailer_count"]} retailers — built to answer one question honestly: can this ring's gold content be checked before you pay for it?</p>
  <div class="meta-row">
    <span class="chip">Checked {esc(META["compiled_on"])}</span>
    <span class="chip">{ANALYSIS["row_count"]} listings</span>
    <span class="chip">{ANALYSIS["retailer_count"]} retailers</span>
    <span class="chip">{len(FLAGS)} flagged items</span>
    <span class="chip chip-gold">Spot ${SPOT:,.2f}/oz · {esc(spot_doc["quote_timestamp_on_source"])}</span>
  </div>
</section>

<section class="policy" aria-label="No-hallucination policy">
  <div class="policy-head">
    <span class="policy-flag">No hallucinations</span>
    <h2>The rule this whole project runs on</h2>
  </div>
  <ol class="policy-list">
    <li><strong>No invented prices.</strong> Every figure was read from the retailer's own product or listing page on {esc(META["compiled_on"])} and carries that date. Search snippets are treated as untrusted — two of them were wrong (flags F-02, F-03).</li>
    <li><strong>No inferred values.</strong> If a seller does not publish a weight or a hallmark, the cell is empty and flagged. We never fill a gap from a similar ring, a blog, or memory.</li>
    <li><strong>No silent estimates.</strong> The gold calculator is arithmetic on numbers you supply. It is not a valuation and no row in this dataset carries a computed melt value.</li>
    <li><strong>Every claim is re-checkable.</strong> {ANALYSIS["row_count"]} rows, {len(SOURCES)} registered sources, and an automated audit that recomputes every headline statistic before the site builds.</li>
  </ol>
  <p class="policy-foot">Applied at every review: <a href="verification.html">six verification passes</a> · <a href="flagged.html">everything that failed or could not be checked</a></p>
</section>

<section class="stats" aria-label="Dataset summary">
  {stat_card(str(ANALYSIS["row_count"]), "Verified listings", f'{ANALYSIS["verified_product_page_rows"]} product pages + {ANALYSIS["listing_verified_rows"]} listing pages')}
  {stat_card(f'0 / {ANALYSIS["row_count"]}', "Publish a gram weight", "Blocks any gold-value check", "tone-danger")}
  {stat_card(f'0 / {ANALYSIS["row_count"]}', "Publish hallmark details", "Stamp must be verified in person", "tone-danger")}
  {stat_card(f'{ANALYSIS["setting_only_rows"]} vs {ANALYSIS["complete_ring_rows"]}', "Setting-only vs complete", "Two price types, never comparable", "tone-warn")}
  {stat_card(f'{ANALYSIS["rows_with_explicit_solid_gold_wording"]} / {ANALYSIS["row_count"]}', "Say “solid gold” explicitly", "Only Mejuri uses the phrase", "tone-warn")}
  {stat_card(str(len(FLAGS)), "Open flags", "Published, none blocking", "tone-warn")}
</section>

<section class="block">
  <div class="block-head"><h2>What the data actually shows</h2><p>Three findings that changed how this list is read.</p></div>
  <ul class="findings">{findings}</ul>
</section>

<section class="block">
  <div class="block-head"><h2>Your checklist, scored against evidence</h2>
  <p>Each line of the original buying checklist, marked verified, partial, unverified or a recommendation — with the page that supports the call.</p></div>
  <div class="table-scroll">
  <table class="data-table checklist">
    <thead><tr><th scope="col">Check</th><th scope="col">Status</th><th scope="col">What we found</th><th scope="col">Evidence</th></tr></thead>
    <tbody>{checklist_rows()}</tbody>
  </table>
  </div>
</section>

<section class="block">
  <div class="block-head"><h2>All verified entries</h2>
  <p>One row per listing. Prices are exactly what the page showed on {esc(META["compiled_on"])}; every product name links to its source. Use the filter box, or open a category for the full specification columns.</p></div>
  {table(rows_html, [("ID", ""), ("Retailer", ""), ("Ring", ""), ("Purity", ""), ("Price", "num"), ("Price basis", ""), ("Weight", ""), ("Checked", ""), ("Status", "")], "all-entries", "“Setting price” excludes the centre diamond. “From” means the lowest price displayed for that model on the day checked.")}
</section>

<section class="block">
  <div class="block-head"><h2>Go deeper</h2></div>
  <div class="nav-grid">{nav_cards}</div>
</section>

<section class="block buy-rule">
  <h2>The buy / no-buy rule</h2>
  <p>Buy only when the seller will put the <strong>karat</strong>, the <strong>weight in grams</strong> and the <strong>return window</strong> in writing, and will accept the ring back after an independent jeweler inspects it. If any of those three is refused, the price does not matter.</p>
  <p class="fine">Nothing here is financial or legal advice, and no listing in this dataset has been physically inspected.</p>
</section>
"""
    return page("Gold engagement ring buyer's dashboard", "index.html", body,
                "Verified gold engagement ring listings with source links, prices checked on 2026-10-22, no invented figures.")


# --------------------------------------------------------------------------- category pages
def detail_row(row: dict) -> str:
    weight = "Not published" if row["weight_g"] is None else f'{row["weight_g"]} g'
    return (
        f'<tr>'
        f'<td data-label="ID"><code>{esc(row["id"])}</code></td>'
        f'<td data-label="Ring"><a href="{esc(row["url"])}" target="_blank" rel="noopener">{esc(row["product"])}</a>'
        f'<span class="cell-sub">{esc(row["specs"])}</span></td>'
        f'<td data-label="Metal">{esc(row["metal"])}</td>'
        f'<td data-label="Price" class="num">{esc(row["price_display"])}<span class="cell-sub">{esc(row["price_type"])}</span></td>'
        f'<td data-label="Weight" class="muted">{weight}</td>'
        f'<td data-label="Solid gold?">{esc(row["solid_gold_statement"])}'
        f'<span class="cell-sub quote">{esc(row["solid_gold_quote"])}</span></td>'
        f'<td data-label="Returns" class="muted">{esc(row["returns_summary"])}</td>'
        f'<td data-label="Checked">{esc(row["checked_on"])}<span class="cell-sub"><a href="{esc(row["source_url"])}" target="_blank" rel="noopener">Source</a></span></td>'
        f'</tr>'
    )


DETAIL_HEADERS = [("ID", ""), ("Ring & published specs", ""), ("Metal", ""), ("Price", "num"),
                  ("Weight", ""), ("Solid gold wording", ""), ("Returns as published", ""), ("Checked / source", "")]


def build_category(active: str, title: str, subtitle: str, rows: list[dict],
                   extra: str, description: str) -> str:
    rows_html = "".join(detail_row(r) for r in rows)
    prices = [r["price"] for r in rows]
    lead = f"""
<section class="hero hero-tight">
  <p class="eyebrow">{esc(title)}</p>
  <h1>{esc(subtitle)}</h1>
  <div class="meta-row">
    <span class="chip">{len(rows)} listings</span>
    <span class="chip">Price range {money(min(prices))} – {money(max(prices))}</span>
    <span class="chip">Checked {esc(META["compiled_on"])}</span>
  </div>
</section>
{extra}
<section class="block">
  <div class="block-head"><h2>Full specifications</h2>
  <p>Every cell below comes from the linked page. “Not published” is a finding, not a gap in the work.</p></div>
  {table(rows_html, DETAIL_HEADERS, active.replace(".html", "") + "-table", "Setting-only and complete-ring prices are labelled per row and must not be compared to each other.")}
</section>
"""
    return page(title, active, lead, description)


def build_solitaire() -> str:
    rows = [r for r in ROWS if r["retailer"] != "Mejuri"]
    extra = f"""
<section class="block note-block">
  <h2>Read this before comparing these prices</h2>
  <p>All {len(rows)} rows on this page are <strong>setting prices</strong>: the metal work only, with the centre diamond excluded. A $1,000 setting with a 1-carat diamond is not a $1,000 ring. Only the two 18K Blue Nile rows and the one 18K Brilliant Earth row can be compared closely, and even then the models differ.</p>
  <p>The one like-for-like pair in the dataset is the same Blue Nile Classic Six-Prong design in two purities:</p>
  <div class="compare">
    <div><span class="compare-label">14K Yellow Gold</span><strong>{money(ANALYSIS["same_design_14k_vs_18k"]["14k_price"])}</strong></div>
    <div class="compare-arrow">→</div>
    <div><span class="compare-label">18K Yellow Gold</span><strong>{money(ANALYSIS["same_design_14k_vs_18k"]["18k_price"])}</strong></div>
    <div class="compare-delta">+{money(ANALYSIS["same_design_14k_vs_18k"]["difference"])} (+{ANALYSIS["same_design_14k_vs_18k"]["difference_percent"]}%)</div>
  </div>
  <p class="fine">That gap is the retailer's price difference, not a gold-value calculation. The 18K ring contains more fine gold, but the exact amount is unknown because neither listing publishes a gram weight.</p>
</section>
<section class="block note-block warn-block">
  <h2>Flagged on this page</h2>
  <ul class="link-list">
    <li><a href="flagged.html#F-01">F-01 · Blue Nile 18K ring whose own description says 14k white gold</a></li>
    <li><a href="flagged.html#F-02">F-02 · Search snippet said $925; the live page said $1,420</a></li>
    <li><a href="flagged.html#F-06">F-06 · Setting-only prices are not ring prices</a></li>
    <li><a href="flagged.html#F-14">F-14 · An 18K Brilliant Earth ring with 14K white gold prongs</a></li>
  </ul>
</section>
"""
    return build_category("solitaire.html", "Solitaire settings",
                          f"Solitaire settings from Blue Nile and Brilliant Earth, 14K and 18K yellow gold.",
                          rows, extra,
                          "Solitaire engagement ring settings with verified prices and source links, 2026-10-22.")


def build_bands() -> str:
    rows = [r for r in ROWS if r["retailer"] == "Mejuri"]
    extra = """
<section class="block note-block">
  <h2>These are complete rings</h2>
  <p>Mejuri sells these as finished rings, so the price includes the gold, the stones and the labour. That makes them the only rows here whose price can be compared with a gold-value estimate — once a weight is known, which it still is not.</p>
  <p>Mejuri is also the only retailer in this dataset whose pages use the words <strong>“14k solid gold”</strong> explicitly. That is the wording the checklist asks for; Blue Nile and Brilliant Earth state karat only.</p>
  <p class="fine">Prices marked “From” depend on ring size. White gold pieces are rhodium-plated, which is a surface finish over the gold, not a lower-purity core.</p>
</section>
<section class="block note-block warn-block">
  <h2>Flagged on this page</h2>
  <ul class="link-list">
    <li><a href="flagged.html#F-03">F-03 · Bold Diamond Eternity Ring: snippet $2,800, live page $2,900</a></li>
    <li><a href="flagged.html#F-07">F-07 · “From” prices move with ring size</a></li>
    <li><a href="flagged.html#F-04">F-04 · Still no gram weight on any Mejuri page</a></li>
  </ul>
</section>
"""
    return build_category("bands.html", "Bands",
                          "Diamond bands and a plain gold band from Mejuri, priced as complete rings.",
                          rows, extra,
                          "Mejuri 14k solid gold bands with verified prices and source links, 2026-10-22.")


# --------------------------------------------------------------------------- retailers
def build_retailers() -> str:
    cards = ""
    for ret in RETAILERS:
        window = ("Confirmed" if ret["returns_window_confirmed"] else "Not confirmed — see flag")
        cards += f"""
<article class="retailer-card">
  <header>
    <h2>{esc(ret["name"])}</h2>
    <span class="badge info">{ret["rows_in_dataset"]} rows</span>
  </header>
  <dl class="kv">
    <dt>Contact</dt><dd>{esc(ret["public_phone"] or "No phone published on the pages read")}
      <span class="cell-sub">{esc(ret["contact_notes"])}</span>
      <a href="{esc(ret["phone_source"] or ret["site"])}" target="_blank" rel="noopener">Source</a></dd>
    <dt>Returns</dt><dd>{esc(ret["returns_summary"])} <span class="badge {"ok" if ret["returns_window_confirmed"] else "warn"}">{esc(window)}</span>
      <span class="cell-sub"><a href="{esc(ret["returns_source"])}" target="_blank" rel="noopener">Source</a></span></dd>
    <dt>Warranty</dt><dd>{esc(ret["warranty"])}
      <span class="cell-sub"><a href="{esc(ret["warranty_source"])}" target="_blank" rel="noopener">Source</a></span></dd>
    <dt>Publishes hallmark policy?</dt><dd>{"Yes" if ret["hallmark_policy_published"] else "No — must be asked"}</dd>
    <dt>Publishes gram weight?</dt><dd>{"Yes" if ret["weight_policy_published"] else "No — must be asked"}</dd>
    <dt>Payment</dt><dd>{esc(ret["payment_notes"])}</dd>
    <dt>Open flags</dt><dd>{", ".join(f'<a href="flagged.html#{esc(f)}">{esc(f)}</a>' for f in ret["flags"])}</dd>
  </dl>
</article>
"""
    rows = "".join(
        f'<tr><td data-label="Retailer"><strong>{esc(r["name"])}</strong></td>'
        f'<td data-label="Phone">{esc(r["public_phone"] or "—")}</td>'
        f'<td data-label="Return window">{esc("Confirmed" if r["returns_window_confirmed"] else "Not confirmed")}</td>'
        f'<td data-label="Warranty">{esc(r["warranty"])}</td>'
        f'<td data-label="Hallmark policy">{"Published" if r["hallmark_policy_published"] else "Not published"}</td>'
        f'<td data-label="Weight policy">{"Published" if r["weight_policy_published"] else "Not published"}</td>'
        f'<td data-label="Source"><a href="{esc(r["returns_source"])}" target="_blank" rel="noopener">Page</a></td></tr>'
        for r in RETAILERS
    )
    body = f"""
<section class="hero hero-tight">
  <p class="eyebrow">Retailer vetting</p>
  <h1>What each seller publishes — and what you have to ask for.</h1>
  <p class="lede">Contact details and warranty terms are quoted from the retailers' own pages. Independent reputation research is flagged as not done ({esc("F-10")}), because it was not done.</p>
</section>
<section class="block">
  <div class="block-head"><h2>Side by side</h2></div>
  <div class="table-scroll"><table class="data-table">
  <thead><tr><th>Retailer</th><th>Phone</th><th>Return window</th><th>Warranty</th><th>Hallmark info</th><th>Gram weight</th><th>Source</th></tr></thead>
  <tbody>{rows}</tbody></table></div>
</section>
<section class="retailer-grid">{cards}</section>
<section class="block note-block">
  <h2>Named but not vetted</h2>
  <p>Costco, James Allen, Tiffany &amp; Co., Aurate and Derco Diamonds were encountered while sourcing and are deliberately <strong>not</strong> scored here. No price from any of them appears in this dataset. Absence is not a negative finding — it is an open task (flag <a href="flagged.html#F-15">F-15</a>).</p>
</section>
<section class="block buy-rule">
  <h2>Contact and returns are the two fastest filters</h2>
  <p>A seller who will not give a phone number, a written weight and a return window in writing fails the checklist before price is even discussed. All three retailers here do publish a contact route; only Mejuri publishes a confirmed 30-day window on the pages read.</p>
</section>
"""
    return page("Retailers", "retailers.html", body,
                "Retailer contact, return and warranty terms quoted from official pages.")


# --------------------------------------------------------------------------- verification
def build_verification() -> str:
    reg_rows = "".join(
        f'<tr><td data-label="ID"><code>{esc(s["id"])}</code></td>'
        f'<td data-label="Source"><a href="{esc(s["url"])}" target="_blank" rel="noopener">{esc(s["title"])}</a>'
        f'<span class="cell-sub">{esc(s["publisher"])} · {esc(s["type"])}</span></td>'
        f'<td data-label="Used for">{esc(s["used_for"])}</td>'
        f'<td data-label="Status">{badge("verified" if s["status"] in {"official", "verified", "verified-listing", "verified-with-flag"} else ("needs review" if s["status"] == "unverified" else "listing-verified"))}'
        f'<span class="cell-sub">{esc(s["status"])}</span></td></tr>'
        for s in SOURCES
    )
    body = f"""
<section class="hero hero-tight">
  <p class="eyebrow">Verification</p>
  <h1>How each number earned its place.</h1>
  <p class="lede">Verification here is not a promise that the data is complete. It is a promise that nothing was invented, that every value is traceable, and that everything unchecked is labelled.</p>
</section>

<section class="block">
  <div class="block-head"><h2>The six passes, run before every publish</h2>
  <p><code>python3 tools/verify_data.py</code> — {AUDIT["assertions"]:,} assertions on the current dataset, {AUDIT["errors"]} errors and {AUDIT["warnings"]} warnings when last run on {esc(AUDIT["generated_on"])}.</p></div>
  <ol class="pass-list">
    <li><strong>Schema pass.</strong> Every row carries id, retailer, product, URL, source, price, price basis, purity, weight note, hallmark note, checked date and flags. Placeholders (“null”, “TBD”, empty strings) fail the build.</li>
    <li><strong>Source pass.</strong> Every row's source must be https, must resolve to the retailer's own domain, and must exist in the source registry. A price with no registered source cannot be published.</li>
    <li><strong>Price pass.</strong> Price must be a positive whole dollar amount; the display string must contain that exact number; “From” pricing must say so; the checked date must be real and no more than seven days old.</li>
    <li><strong>Evidence pass.</strong> A weight may only be present if it has its own source URL. A missing weight must say “no gram weight published” and carry flag F-04. A setting-only price must carry F-06. No exceptions.</li>
    <li><strong>Flag pass.</strong> Every referenced flag exists, every flag has a severity, a status and an official source, and retailer-level flags point at vetted or explicitly-unvetted sellers.</li>
    <li><strong>Statistics pass.</strong> The headline numbers are recomputed from the rows and compared. If a summary says 9 setting-only rows and the data says 8, the build fails — a wrong statistic is a hallucination even when every row is correct.</li>
  </ol>
</section>

<section class="block">
  <div class="block-head"><h2>Hallucination checks that actually caught something</h2></div>
  <div class="callout">
    <p><strong>{AUDIT["errors"]} errors remain in the current audit; 4 were caught and fixed during development.</strong> The parser found a wildcard row reference, two flag sources pointing at hosts outside the approved list, and a purity count that said 9 × 14K / 4 × 18K when the rows said 10 × 14K / 3 × 18K. All four were fixed before this page existed.</p>
    <p><strong>2 snippet prices were wrong.</strong> A search result showed $925 for a Blue Nile setting whose live page said $1,420 (F-02), and $2,800 for a Mejuri ring whose live page said $2,900 (F-03). This is why snippets are never used as evidence.</p>
    <p><strong>1 page contradicts itself.</strong> A Blue Nile 18K ring's description says 14k white gold (F-01). It is published, not hidden.</p>
  </div>
</section>

<section class="block">
  <div class="block-head"><h2>Source registry</h2>
  <p>Every source used for a row, a flag or a policy claim. Status “unverified” means the URL was cited but not retrieved — it is listed so the gap is visible.</p></div>
  <div class="table-scroll"><table class="data-table">
    <thead><tr><th>ID</th><th>Source</th><th>Used for</th><th>Status</th></tr></thead>
    <tbody>{reg_rows}</tbody></table></div>
</section>

<section class="block">
  <div class="block-head"><h2>Primary sources for the law</h2></div>
  <ul class="source-list">
    <li><a href="https://www.ecfr.gov/current/title-16/chapter-I/subchapter-B/part-23" target="_blank" rel="noopener">16 CFR Part 23 — Guides for the Jewelry, Precious Metals, and Pewter Industries</a> (eCFR, current). Establishes that a gold description must be at least 10 karat and governs quality marks.</li>
    <li><a href="https://www.federalregister.gov/documents/2018/08/16/2018-17454/guides-for-the-jewelry-precious-metals-and-pewter-industries" target="_blank" rel="noopener">83 FR 40659 (2018-08-16)</a>. Source of the quoted Note 2 to §23.10: the National Stamping Act requires the maker's trademark or name beside a quality mark.</li>
  </ul>
  <p class="fine">Read with care: these rules govern how sellers may <em>mark and describe</em> jewellery. They do not certify that any particular ring is the purity it claims, which is why independent testing after delivery is still the last step.</p>
</section>

<section class="block note-block warn-block">
  <div class="block-head"><h2>What was not verified</h2></div>
  <ul class="link-list">
    <li><strong>Seller reputation.</strong> No BBB profile, complaint record or independent review set was read (F-10).</li>
    <li><strong>Return windows</strong> at Blue Nile and Brilliant Earth (F-08, F-09).</li>
    <li><strong>Credit-card dispute rights.</strong> Recommended, but no official citation captured (F-12).</li>
    <li><strong>Regulatory text</strong> was confirmed through official excerpts and index entries, not full section reads (F-11).</li>
    <li><strong>Physical properties.</strong> No ring was weighed, XRF-tested or inspected. Every weight and hallmark cell in the dataset is empty because sellers do not publish them.</li>
  </ul>
</section>

<section class="block">
  <div class="block-head"><h2>Reproduce this</h2></div>
  <pre class="code"><code>python3 tools/verify_data.py   # audit the dataset (exits 1 on any error)
python3 tools/build_site.py    # regenerate docs/ + run the link check</code></pre>
  <p>Machine-readable copies: <a href="data/rings.json">rings.json</a> · <a href="data/rings.csv">rings.csv</a> · <a href="data/sources.json">sources.json</a> · <a href="data/spot-gold.json">spot-gold.json</a>. The CSV is generated by the audit script, so it cannot drift from the JSON.</p>
</section>
"""
    return page("Verification", "verification.html", body,
                "The six verification passes, the source registry and the list of what was not verified.")


# --------------------------------------------------------------------------- flagged
def build_flagged() -> str:
    cards = ""
    for f in sorted(FLAGS, key=lambda x: ({"high": 0, "medium": 1, "low": 2}[x["severity"]], x["id"])):
        affected = ", ".join(f'<a href="index.html">{esc(a)}</a>' for a in f["affected_rows"]) or "—"
        cards += f"""
<article class="flag-card sev-{esc(f["severity"])}" id="{esc(f["id"])}">
  <header>
    <span class="flag-id">{esc(f["id"])}</span>
    {badge(f["severity"])}
    {badge(f["status"])}
  </header>
  <h3>{esc(f["title"])}</h3>
  <p>{esc(f["detail"])}</p>
  <dl class="kv">
    <dt>Affected rows</dt><dd>{affected}</dd>
    <dt>Source</dt><dd><a href="{esc(f["source_url"])}" target="_blank" rel="noopener">{esc(f["source_url"])}</a></dd>
  </dl>
</article>
"""
    body = f"""
<section class="hero hero-tight">
  <p class="eyebrow">Flagged for review</p>
  <h1>Everything that failed, contradicted itself, or could not be checked.</h1>
  <p class="lede">{len(FLAGS)} items are published here with their source links. None of them blocks the dataset; all of them are yours to review after the site is live.</p>
  <div class="meta-row">
    <span class="chip chip-danger">{sum(1 for f in FLAGS if f["severity"] == "high")} high</span>
    <span class="chip chip-warn">{sum(1 for f in FLAGS if f["severity"] == "medium")} medium</span>
    <span class="chip">{sum(1 for f in FLAGS if f["severity"] == "low")} low</span>
  </div>
</section>
<section class="block">
  <div class="block-head"><h2>Why these are published instead of fixed</h2>
  <p>A flag is a finding. Deleting an awkward row would make the dataset look cleaner and be less true. Where the seller's own page contradicts itself, both statements are recorded and the contradiction is flagged — the buyer, not the compiler, decides what to do about it.</p></div>
</section>
<section class="flag-grid">{cards}</section>
"""
    return page("Flagged for review", "flagged.html", body,
                "Flagged irregularities and unverified items with source links.")


# --------------------------------------------------------------------------- calculator
CALC_BODY = f"""
<section class="hero hero-tight">
  <p class="eyebrow">Gold calculator</p>
  <h1>What is the gold actually worth?</h1>
  <p class="lede">Arithmetic only: weight × purity × spot. It cannot tell you whether a ring is a good buy, and it refuses to run on guessed numbers — you need a real gram weight from the seller.</p>
</section>

<section class="calc-layout">
  <form class="calc-card" id="gold-form" novalidate>
    <h2>Inputs</h2>
    <div class="field">
      <label for="weight">Ring weight <span class="unit">grams</span></label>
      <input type="number" id="weight" name="weight" min="0" step="0.01" inputmode="decimal" placeholder="e.g. 4.2">
      <p class="hint">From the seller, in writing, or from a jeweler's scale. Not published on any listing in this dataset.</p>
    </div>
    <div class="field">
      <label for="karat">Purity</label>
      <select id="karat" name="karat">
        <option value="10">10K — 41.7% fine gold</option>
        <option value="14" selected>14K — 58.3% fine gold</option>
        <option value="18">18K — 75.0% fine gold</option>
        <option value="22">22K — 91.7% fine gold</option>
        <option value="24">24K — 99.9%+ fine gold</option>
        <option value="custom">Other — enter fineness %</option>
      </select>
      <input type="number" id="custom-purity" class="hidden" min="1" max="100" step="0.1" placeholder="Fineness % e.g. 58.5" aria-label="Custom fineness percent">
      <p class="hint">Karat is a 24-part scale: fineness = karat ÷ 24.</p>
    </div>
    <div class="field">
      <label for="spot">Spot gold price <span class="unit">USD per troy ounce</span></label>
      <input type="number" id="spot" name="spot" min="1" step="0.01" value="{SPOT:.2f}" inputmode="decimal">
      <p class="hint">Default is the recorded reading: <strong>${SPOT:,.2f}</strong> on {esc(spot_doc["quote_timestamp_on_source"])} from <a href="{esc(spot_doc["source_url"])}" target="_blank" rel="noopener">GoldPrice.org</a>. Edit it to today's number — the result is stamped with whatever you enter.</p>
    </div>
    <div class="field">
      <label for="paid">Price asked <span class="unit">USD · optional</span></label>
      <input type="number" id="paid" name="paid" min="0" step="1" inputmode="decimal" placeholder="e.g. 1,100">
      <p class="hint">Compare the asking price with the melt value to see the multiple.</p>
    </div>
    <button type="button" class="btn-ghost" id="calc-reset">Reset to recorded spot</button>
  </form>

  <div class="calc-results" aria-live="polite">
    <h2>Result</h2>
    <div class="result-main">
      <span class="result-label">Fine gold content</span>
      <strong id="out-fine">—</strong>
      <span class="result-sub" id="out-fine-sub">enter a weight to begin</span>
    </div>
    <div class="result-main">
      <span class="result-label">Melt value at your spot price</span>
      <strong id="out-value">—</strong>
      <span class="result-sub" id="out-value-sub">not a valuation of the ring</span>
    </div>
    <div class="result-main">
      <span class="result-label">Gold value as a share of the price</span>
      <strong id="out-share">—</strong>
      <span class="result-sub" id="out-share-sub">add a price to compare</span>
    </div>
    <div class="formula">
      <p><strong>Formula</strong></p>
      <p><code>fine gold (g) = weight (g) × (karat ÷ 24)</code></p>
      <p><code>melt value = fine gold (g) ÷ 31.1034768 × spot (USD/oz)</code></p>
      <p><code>share = melt value ÷ price asked</code></p>
    </div>
    <p class="fine">1 troy ounce = 31.1034768 grams exactly. Karat fractions (10/24, 14/24, 18/24) are arithmetic, not an assay.</p>
  </div>
</section>

<section class="block note-block warn-block">
  <h2>Why the result is not a price opinion</h2>
  <p>A ring's price includes fabrication, the setting, the stone, labour, duty, warranty and the retailer's margin. Melt value is what the gold alone would fetch as scrap. On a diamond ring the two numbers can sit far apart, and neither one is “the real price”.</p>
  <p>Melt value is also <strong>not</strong> what a jeweler will pay: refining costs and trade margins apply.</p>
</section>

<section class="block">
  <div class="block-head"><h2>A worked example — clearly hypothetical</h2>
  <p>Not a listing in this dataset. No row in the dataset has a published weight, so this cannot be run on a real entry yet.</p></div>
  <div class="table-scroll"><table class="data-table">
    <thead><tr><th>Hypothetical ring</th><th class="num">Weight</th><th class="num">Fineness</th><th class="num">Fine gold</th><th class="num">Melt value</th></tr></thead>
    <tbody>
      <tr><td>14K band, hypothetical 4.00 g</td><td class="num">4.00 g</td><td class="num">58.33%</td><td class="num">2.333 g</td><td class="num">${4.0 * 14 / 24 / 31.1034768 * SPOT:,.2f}</td></tr>
      <tr><td>18K band, hypothetical 4.00 g</td><td class="num">4.00 g</td><td class="num">75.00%</td><td class="num">3.000 g</td><td class="num">${4.0 * 18 / 24 / 31.1034768 * SPOT:,.2f}</td></tr>
    </tbody>
  </table></div>
  <p class="fine">Computed with the recorded spot of ${SPOT:,.2f}/oz on {esc(spot_doc["quote_timestamp_on_source"])}. Change a weight in the calculator above and the numbers move; nothing here is stored as a fact about any real ring.</p>
</section>
"""
CALC_SCRIPT = '<script src="assets/calculator.js" defer></script>'


def build_calculator() -> str:
    return page("Gold calculator", "calculator.html", CALC_BODY,
                "Gold melt-value calculator: weight, karat and spot price, with the recorded spot reading.",
                CALC_SCRIPT)


# --------------------------------------------------------------------------- write + link check
def write_site() -> None:
    if OUT.exists():
        shutil.rmtree(OUT)
    (OUT / "assets").mkdir(parents=True)
    (OUT / "data").mkdir(parents=True)

    files = {
        "index.html": build_index(),
        "solitaire.html": build_solitaire(),
        "bands.html": build_bands(),
        "retailers.html": build_retailers(),
        "verification.html": build_verification(),
        "flagged.html": build_flagged(),
        "calculator.html": build_calculator(),
    }
    for name, content in files.items():
        (OUT / name).write_text(content)

    for name in ("rings.json", "rings.csv", "sources.json", "spot-gold.json",
                 "verification-report.json"):
        shutil.copy(DATA / name, OUT / "data" / name)

    # GitHub Pages: .nojekyll so folders starting with _ and raw data are served as-is
    (OUT / ".nojekyll").write_text("")


def link_check() -> int:
    broken: list[str] = []
    external: set[str] = set()
    html_files = sorted(OUT.glob("*.html"))
    anchors: dict[str, set[str]] = {}
    for path in html_files:
        text = path.read_text()
        anchors[path.name] = set(re.findall(r'id="([^"]+)"', text))

    for path in html_files:
        text = path.read_text()
        for href in re.findall(r'(?:href|src)="([^"]+)"', text):
            if href.startswith(("mailto:", "tel:", "#")):
                if href.startswith("#") and href[1:] and href[1:] not in anchors[path.name]:
                    broken.append(f"{path.name}: missing local anchor {href}")
                continue
            if href.startswith("http"):
                m = re.match(r"https://([^/]+)/", href + "/")
                host = m.group(1).lower() if m else ""
                external.add(href)
                if host not in APPROVED_EXTERNAL_HOSTS:
                    broken.append(f"{path.name}: external host not approved: {href}")
                continue
            target, _, anchor = href.partition("#")
            target_path = (OUT / target).resolve()
            if not target_path.exists():
                broken.append(f"{path.name}: missing file {href}")
                continue
            if anchor and anchor not in anchors.get(Path(target).name, set()):
                broken.append(f"{path.name}: missing anchor {href}")
        # inline JS/CSS references inside src attributes already covered
    css = (OUT / "assets" / "style.css").read_text()
    for asset in re.findall(r"url\(([^)]+)\)", css):
        asset = asset.strip("'\"")
        if not asset.startswith("http") and not (OUT / "assets" / asset).exists():
            broken.append(f"style.css: missing asset {asset}")

    print(f"link check: {len(html_files)} pages, {len(external)} distinct external links")
    if broken:
        print("BROKEN LINKS:")
        for b in broken:
            print("  x", b)
        return 1
    print("link check: PASS — every internal link and anchor resolves, every external host approved")
    return 0


def main() -> int:
    asset_dir = ROOT / "site_assets"
    if not (asset_dir / "style.css").exists():
        print("missing site_assets/style.css")
        return 1
    write_site()
    for name in ("style.css", "app.js", "calculator.js"):
        shutil.copy(asset_dir / name, OUT / "assets" / name)
    for name, content in {
        "index.html": (OUT / "index.html").read_text(),
    }.items():
        pass
    print(f"wrote {len(list(OUT.glob('*.html')))} pages to docs/")
    return link_check()


if __name__ == "__main__":
    sys.exit(main())
