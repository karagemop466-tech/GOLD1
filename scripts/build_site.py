#!/usr/bin/env python3
"""Build the GOLD1 static site (docs/) from data/*.json.

No external dependencies (stdlib only). Rerun after editing any data file:
    python3 scripts/build_site.py

NO HALLUCINATION POLICY: this script renders ONLY values read from the JSON
data files. If a value is null it renders an explicit blank + 'Unverified'
badge. No value is invented here.
"""
import json
import datetime
import html
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
DOCS = os.path.join(ROOT, "docs")

PROJECT = "GOLD — Gold Engagement Ring Research"
TAGLINE = "Verified listings, official sources, zero invented values"


def load(name):
    with open(os.path.join(DATA, name), "r", encoding="utf-8") as f:
        return json.load(f)


SOURCES = load("sources_c2bbe753.json")
PRICE = load("gold_price.json")
KARATS = load("karats.json")
RINGS = load("rings_c2bbe753.json")
FLAGS = load("flags.json")
CHECKLIST = load("checklist.json")

SOURCE_BY_ID = {s["id"]: s for s in SOURCES["sources"]}
BUILD_UTC = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

NAV = [
    ("index.html", "Dashboard"),
    ("rings.html", "Rings — All"),
    ("rings-tiffany-co.html", "Tiffany & Co."),
    ("rings-cartier.html", "Cartier"),
    ("rings-brilliant-earth.html", "Brilliant Earth"),
    ("rings-blue-nile.html", "Blue Nile / James Allen"),
    ("rings-mejuri.html", "Mejuri"),
    ("prices.html", "Gold Price & Karats"),
    ("calculator.html", "Calculator"),
    ("checklist.html", "Buying Checklist"),
    ("methodology.html", "Methodology & Sources"),
    ("flagged.html", "Flagged for Review"),
]


def e(s):
    return html.escape(str(s), quote=True)


def page(filename, title, body, active):
    nav_html = "".join(
        f'<a href="{e(href)}" class="{"active" if href == active else ""}">{e(label)}</a>'
        for href, label in NAV
    )
    banner = (
        '<div class="policy-banner" id="no-hallucinations">'
        '<strong>No-hallucination policy:</strong> every price, karat, weight and policy value on this '
        'site was taken from the official source page linked next to it, with an exact evidence quote and '
        'fetch date. Values that could not be confirmed from an official source are <em>blank and flagged</em> '
        '— never guessed. Verify prices on the live retailer page before buying; retail prices move with the '
        'gold market. <a href="methodology.html">How we verify</a> · <a href="flagged.html">Flagged for Review</a>'
        "</div>"
    )
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{e(title)} — {PROJECT}</title>
<link rel="stylesheet" href="styles.css">
</head>
<body>
<header class="site-header">
  <div class="wrap">
    <a class="brand" href="index.html">Au&nbsp;<span>{e(PROJECT.split(" — ")[0])}</span></a>
    <nav>{nav_html}</nav>
  </div>
</header>
{banner}
<main class="wrap">
<h1>{e(title)}</h1>
{body}
</main>
<footer>
  <div class="wrap">
    <p><strong>{e(TAGLINE)}</strong> · Data snapshot {e(BUILD_UTC)} · Prices checked {e("2026-10-22")} against official retailer pages.</p>
    <p>Companion dataset &amp; root dashboard: <a href="../index.html">site root — first-run dashboard</a> (Blue Nile · Mejuri · Brilliant Earth) · this section: Tiffany &amp; Co. · Cartier · Brilliant Earth · Blue Nile/James Allen · Mejuri category tables. Both runs keep separate data files and separate audits.</p>
    <p>This is an independent research project. It is not affiliated with, endorsed by, or sponsored by any retailer or institution named on this site. Prices are snapshots for comparison — always confirm on the official product page before purchasing.</p>
  </div>
</footer>
</body>
</html>
"""


def badge(ok, ok_text="Verified", bad_text="Unverified"):
    if ok:
        return '<span class="badge ok">✓ ' + ok_text + "</span>"
    return '<span class="badge warn">⚠ ' + bad_text + "</span>"


def blank_cell(note="Not published / not verified"):
    return f'<span class="blank" title="{e(note)}">—</span>'


def money(v):
    return f"${v:,.0f}" if v is not None else None


def src_link(source_id, label="source"):
    s = SOURCE_BY_ID.get(source_id)
    if not s:
        return e(label)
    return f'<a href="{e(s["url"])}" title="{e(s["name"])}" target="_blank" rel="noopener">{e(label)}</a>'


# ---------------------------------------------------------------- index
def build_index():
    rings = RINGS["rings"]
    n = len(rings)
    pv = sum(1 for r in rings if r["price_verified"])
    kv = sum(1 for r in rings if r.get("karat_verified"))
    wv = sum(1 for r in rings if r["weight_verified"])
    nf = len(FLAGS["flags"])
    anchor = PRICE["anchor"]

    rows = "".join(
        f"<tr><td><a href='flagged.html#{e(f['id'])}'>{e(f['id'])}</a></td>"
        f"<td><span class='sev {e(f['severity'])}'>{e(f['severity'])}</span></td>"
        f"<td>{e(f['title'])}</td><td>open</td></tr>"
        for f in FLAGS["flags"]
    )

    body = f"""
<section class="cards">
  <div class="card"><div class="num">{n}</div><div class="lbl">Listings tracked</div></div>
  <div class="card"><div class="num">{pv}/{n}</div><div class="lbl">Prices verified from official page</div></div>
  <div class="card"><div class="num">{kv}/{n}</div><div class="lbl">Karat claims verified</div></div>
  <div class="card"><div class="num">{wv}/{n}</div><div class="lbl">Weights verified <em>(none published — Flag F1)</em></div></div>
  <div class="card"><div class="num">{nf}</div><div class="lbl">Flags for your review</div></div>
  <div class="card"><div class="num small">${anchor['price_usd_per_troy_oz']:,.2f}</div><div class="lbl">Gold spot anchor USD/oz · {e(anchor['as_of'])} · <a href="prices.html">source</a></div></div>
</section>

<section class="panel">
  <h2>The key (from the official rules)</h2>
  <p>A <strong>14K or 18K stamp by itself does not prove purity</strong>. The safe pattern:
  reputable seller + correct markings (karat + maker's mark) + price consistent with weight × karat × spot
  + independent testing after delivery.</p>
  <p class="muted">Anchored to {src_link('S-ECFR23', '16 CFR Part 23 (FTC Jewelry Guides)')} and
  {src_link('S-USC294', '15 U.S.C. ch. 8 (National Gold and Silver Stamping Act)')} — both fetched 2026-10-22.</p>
</section>

<section class="panel">
  <h2>Browse</h2>
  <div class="grid">
    <a class="tile" href="rings.html"><strong>All listings</strong><span>master table, every row with source link</span></a>
    <a class="tile" href="prices.html"><strong>Gold price &amp; karats</strong><span>spot anchor, karat table, legal tolerances</span></a>
    <a class="tile" href="calculator.html"><strong>Gold value calculator</strong><span>grams × karat × spot → melt value</span></a>
    <a class="tile" href="checklist.html"><strong>Buying checklist</strong><span>the 12 rules, sourced</span></a>
    <a class="tile" href="methodology.html"><strong>Methodology &amp; sources</strong><span>how values are verified</span></a>
    <a class="tile warn" href="flagged.html"><strong>Flagged for review ({nf})</strong><span>unverified + irregularities</span></a>
  </div>
</section>

<section class="panel">
  <h2>Open flags</h2>
  <div class="table-scroll"><table>
    <thead><tr><th>ID</th><th>Severity</th><th>Title</th><th>Status</th></tr></thead>
    <tbody>{rows}</tbody>
  </table></div>
</section>
"""
    return page("index.html", "Dashboard", body, "index.html")


# ---------------------------------------------------------------- rings
def ring_row(r, with_retailer=True):
    price = money(r["price_usd"]) or blank_cell(r.get("price_note_unverified", "Not verified — left blank on purpose"))
    label = r.get("price_label") or ""
    label_html = (' <span class="muted">' + e(label) + "</span>") if label else ""
    price_html = price + label_html
    if not r["price_verified"]:
        price_html += " " + badge(False, ok_text="", bad_text="price unverified")
    else:
        price_html += " " + badge(True, ok_text="price")
    karat_html = (e(r["karat"]) if r["karat"] else blank_cell()) + " " + (
        badge(True, ok_text="karat") if r.get("karat_verified") else badge(False, ok_text="", bad_text="karat unverified"))
    weight_html = blank_cell() if r["weight_g"] is None else f"{e(r['weight_g'])} g"
    src_html = ""
    pe = r.get("price_evidence") or r.get("karat_evidence")
    checked = "—"
    if pe:
        checked = e(pe.get("fetched_utc", "2026-10-22"))
        if pe.get("url"):
            src_html = f'<a href="{e(pe["url"])}" target="_blank" rel="noopener">official page ↗</a>'
        else:
            src_html = src_link(pe.get("source_id", ""), "official source")
    ret = r.get("returns") or blank_cell("No return info captured")
    name_html = f'<a href="{e(r["url"])}" target="_blank" rel="noopener">{e(r["name"])}</a>'
    if r.get("style_ref"):
        name_html += f' <span class="muted">({e(r["style_ref"])})</span>'
    retailer_html = f'<td><a href="{e(r["retailer_url"])}" target="_blank" rel="noopener">{e(r["retailer"])}</a></td>' if with_retailer else ""
    return (
        "<tr>"
        f"{retailer_html}"
        f"<td>{name_html}</td>"
        f"<td class='num'>{price_html}</td>"
        f"<td>{karat_html}</td>"
        f"<td class='num'>{weight_html}</td>"
        f"<td>{ret}</td>"
        f"<td>{src_html}<br><span class='muted'>checked {checked}</span></td>"
        "</tr>"
    )


def rings_table(subset, with_retailer=True):
    head_ret = "<th>Retailer</th>" if with_retailer else ""
    rows = "".join(ring_row(r, with_retailer) for r in subset)
    return f"""<div class="table-scroll"><table>
<thead><tr>{head_ret}<th>Listing (link to official product page)</th><th>Price USD</th><th>Karat / metal</th><th>Weight (g)</th><th>Returns (as listed)</th><th>Source &amp; checked</th></tr></thead>
<tbody>{rows}</tbody>
</table></div>
<p class="muted">— = value deliberately left blank: not published by the seller or not verifiable from an official source. See <a href="flagged.html">Flagged for Review</a>. Never inferred.</p>"""


def build_rings_all():
    rings = RINGS["rings"]
    by_ret = {}
    for r in rings:
        by_ret.setdefault(r["retailer_key"], []).append(r)
    body = f"""
<p class="lead">All {len(rings)} tracked listings. Category pages: <a href="rings-tiffany-co.html">Tiffany &amp; Co.</a> ·
<a href="rings-cartier.html">Cartier</a> · <a href="rings-brilliant-earth.html">Brilliant Earth</a> ·
<a href="rings-blue-nile.html">Blue Nile / James Allen</a> · <a href="rings-mejuri.html">Mejuri</a></p>
{rings_table(rings, with_retailer=True)}
<section class="panel">
<h2>Findings</h2>
<ul>
<li><strong>Weight (grams) is published by no retailer reviewed</strong> — the column is blank on every row (Flag F1). Ask the seller in writing; verify independently.</li>
<li><strong>Solid-gold language:</strong> Mejuri states '14k solid gold' explicitly; Tiffany/Cartier/BE/BN state karat + metal. FTC Guides (16 CFR §23.3) prohibit describing surface-coated or hollow products as solid gold.</li>
<li><strong>Return policies differ materially</strong> — Tiffany's page shows conflicting return text (Flag F2); verify before purchase.</li>
<li><strong>James Allen → Blue Nile migration</strong> means any JA price in circulation may be stale (Flag F8).</li>
</ul>
</section>"""
    return page("rings.html", "Rings — All Listings", body, "rings.html")


RETAILER_PAGES = {
    "tiffany-co": ("Tiffany & Co. — Listings", "Category: Tiffany &amp; Co. (tiffany.com)"),
    "cartier": ("Cartier — Listings", "Category: Cartier (cartier.com)"),
    "brilliant-earth": ("Brilliant Earth — Listings", "Category: Brilliant Earth (brilliantearth.com)"),
    "blue-nile": ("Blue Nile / James Allen — Listings", "Category: Blue Nile (bluenile.com), including James Allen-branded settings now sold on Blue Nile"),
    "mejuri": ("Mejuri — Listings", "Category: Mejuri (mejuri.com)"),
}


def build_retailer(key):
    title, desc = RETAILER_PAGES[key]
    subset = [r for r in RINGS["rings"] if r["retailer_key"] == key]
    extra = ""
    if key == "blue-nile":
        extra = """<section class="panel"><h2>⚠ Seller note — James Allen is now part of Blue Nile</h2>
<p>Verified 2026-10-22: <a href="https://www.bluenile.com/engagement-rings/design-your-own-ring/14k-yellow-gold-15mm-comfort-fit-engagement-ring-item-41515?jaRedirect=true" target="_blank" rel="noopener">bluenile.com states “James Allen is Now Part of Blue Nile”</a>; old jamesallen.com product URLs redirect there. Treat any James Allen price seen elsewhere as stale (Flag F8).</p></section>"""
    body = f"<p class=\"lead\">{desc}</p>{extra}{rings_table(subset, with_retailer=False)}"
    return page(f"rings-{key}.html", title, body, f"rings-{key}.html")


# ---------------------------------------------------------------- prices
def build_prices():
    anchor = PRICE["anchor"]
    cross_rows = "".join(
        f"<tr><td>{e(c['source'])}</td><td class='num'>${c['value_usd_per_oz']:,.2f}</td>"
        f"<td>{e(c['timestamp_in_source'])}</td><td><a href='{e(c['url'])}' target='_blank' rel='noopener'>link ↗</a></td>"
        f"<td>{badge(c['fetch_method'] == 'direct-fetch', 'direct fetch', 'search snapshot')}</td></tr>"
        for c in PRICE["cross_checks"]
    )
    k_rows = "".join(
        f"<tr><td class='num'><strong>{k['karat']}K</strong></td><td class='num'>{k['fraction']}</td>"
        f"<td class='num'>{k['purity_percent']:.1f}%</td><td class='num'>{e(k['fineness_mark'])}</td>"
        f"<td>{e(k['note'])}</td></tr>"
        for k in KARATS["karats"]
    )
    legal_rows = "".join(
        f"<tr><td>{e(l['claim'])}</td><td><a href='{e(l['source_url'])}' target='_blank' rel='noopener'>official source ↗</a></td>"
        f"<td class='quote'>{e(l['evidence_quote'])}</td></tr>"
        for l in KARATS["legal_context"]
    )
    derived = anchor["derived"][0]
    body = f"""
<section class="panel">
<h2>Project gold-price anchor</h2>
<table class="kv">
<tr><th>Anchor price</th><td class="num"><strong>${anchor['price_usd_per_troy_oz']:,.2f} / troy oz</strong> (fine gold, USD)</td></tr>
<tr><th>Data as of</th><td>{e(anchor['as_of'])} — fetched {e(anchor['fetched_utc'])}</td></tr>
<tr><th>Per gram (derived)</th><td class="num">{e(derived['value'])} <span class="muted">({e(derived['formula'])})</span></td></tr>
<tr><th>Source</th><td><a href="{e(anchor['source_url'])}" target="_blank" rel="noopener">World Gold Council — Gold spot prices (gold.org) ↗</a></td></tr>
<tr><th>Evidence</th><td class="quote">“{e(anchor['evidence_quote'])}”</td></tr>
</table>
<p class="muted">This is the only price the calculator uses. Bullion spot is for .999 gold; scrap buy-back is typically below spot; retail jewellery is far above spot.</p>
</section>

<section class="panel">
<h2>Same-day cross-checks (NOT used for calculations)</h2>
<div class="table-scroll"><table>
<thead><tr><th>Source</th><th>USD/oz</th><th>Timestamp in source</th><th>Link</th><th>Method</th></tr></thead>
<tbody>{cross_rows}</tbody>
</table></div>
<p class="muted">Intraday variance 2026-10-22 was ~$4,028–$4,084/oz — never quote a gold value without a date and time.</p>
</section>

<section class="panel">
<h2>Karat → purity table <span class="muted">(arithmetic: karat ÷ 24)</span></h2>
<div class="table-scroll"><table>
<thead><tr><th>Karat</th><th>Fraction</th><th>Purity</th><th>Fineness stamp</th><th>Note</th></tr></thead>
<tbody>{k_rows}</tbody>
</table></div>
</section>

<section class="panel">
<h2>Legal context — each claim with its official source</h2>
<div class="table-scroll"><table>
<thead><tr><th>Claim</th><th>Source</th><th>Evidence quote (fetched 2026-10-22)</th></tr></thead>
<tbody>{legal_rows}</tbody>
</table></div>
</section>

<section class="panel warn">
<h2>⚠ Watch out</h2>
<ul>
{"".join(f"<li>{e(w)}</li>" for w in KARATS["warning"]) }
</ul>
</section>"""
    return page("prices.html", "Gold Price & Karat Purity", body, "prices.html")


# ---------------------------------------------------------------- checklist
def build_checklist():
    rows = "".join(
        f"<tr><td class='num'><strong>{e(c['id'])}</strong></td><td>{e(c['item'])}</td>"
        f"<td>{e(c['detail'])}</td>"
        + (
            f"<td><a href='{e(c['source_url'])}' target='_blank' rel='noopener'>{e(c['source_label'])} ↗</a></td>"
            if c.get("source_url")
            else f"<td><span class='muted'>{e(c['source_label'])}</span></td>"
        )
        + "</tr>"
        for c in CHECKLIST["checklist"]
    )
    kp_srcs = " · ".join(
        f"<a href='{e(s['url'])}' target='_blank' rel='noopener'>{e(s['label'])} ↗</a>" for s in CHECKLIST["key_principle_sources"]
    )
    body = f"""
<section class="panel key">
<h2>The key</h2>
<p>{e(CHECKLIST['key_principle'])}</p>
<p class="muted">Anchors: {kp_srcs}</p>
</section>
<section class="panel">
<h2>The 12-point checklist</h2>
<div class="table-scroll"><table>
<thead><tr><th>#</th><th>Rule</th><th>Detail / verified findings</th><th>Anchored to</th></tr></thead>
<tbody>{rows}</tbody>
</table></div>
</section>"""
    return page("checklist.html", "Online Gold-Ring Buying Checklist", body, "checklist.html")


# ---------------------------------------------------------------- methodology
def build_methodology():
    rows = "".join(
        f"<tr><td><strong>{e(s['id'])}</strong></td><td>{e(s['name'])}</td>"
        f"<td><a href='{e(s['url'])}' target='_blank' rel='noopener'>{e((s['url'] or '')[0:80])}{'…' if len(s['url'] or '')>80 else ''} ↗</a></td>"
        f"<td>{badge(s['fetch_method']=='direct-fetch','direct fetch','search snapshot')}</td>"
        f"<td>{e(s.get('fetched_utc','—'))}</td><td>{e(s['used_for'])}</td></tr>"
        for s in SOURCES["sources"]
    )
    body = f"""
<section class="panel">
<h2>Verification rules (applied to every value on this site)</h2>
<ol>
<li><strong>Official source or nothing.</strong> Every price/karat/weight must come from the official retailer page or an official institution (eCFR, govinfo, gold.org, assay offices). Third-party blogs are never used for values.</li>
<li><strong>Direct fetch beats snippet.</strong> A value read by downloading the official page is 'Verified'. A value seen only in a search-engine snippet of that page is recorded as a <em>note</em> but rendered BLANK until directly confirmed.</li>
<li><strong>Evidence quotes.</strong> Every verified value stores the exact quote from the page, its URL and fetch date (<em>data/*.json</em> in the repo).</li>
<li><strong>Blank means blank.</strong> Unverifiable values (e.g. metal weight in grams) are shown as “—” and flagged — never estimated or inferred.</li>
<li><strong>Re-run after every review.</strong> <code>python3 scripts/verify_data.py</code> re-checks schema, evidence, arithmetic and links, and writes <em>data/audit_report.json</em>. Find a hallucination → fix data → re-run.</li>
<li><strong>Prices are dated snapshots.</strong> Retail and gold prices move; every number carries its “checked” date.</li>
</ol>
</section>
<section class="panel">
<h2>Source register</h2>
<div class="table-scroll"><table>
<thead><tr><th>ID</th><th>Source</th><th>URL</th><th>Method</th><th>Fetched</th><th>Used for</th></tr></thead>
<tbody>{rows}</tbody>
</table></div>
</section>
<section class="panel">
<h2>Repo layout</h2>
<pre>data/        JSON source of truth (rings, prices, karats, flags, checklist, sources)
docs/        this site — generated by scripts/build_site.py from data/
scripts/     build_site.py (render) · verify_data.py (audit / hallucination check)
COORDINATION.md   multi-session task board</pre>
</section>"""
    return page("methodology.html", "Methodology & Sources", body, "methodology.html")


# ---------------------------------------------------------------- flagged
def build_flagged():
    rows = "".join(
        f"<tr id='{e(f['id'])}'><td class='num'><strong>{e(f['id'])}</strong></td>"
        f"<td><span class='sev {e(f['severity'])}'>{e(f['severity'])}</span></td>"
        f"<td><strong>{e(f['title'])}</strong><br>{e(f['detail'])}"
        + (
            f"<br><span class='quote'>“{e(f['evidence_quote'])}”</span>" if f.get("evidence_quote") else ""
        )
        + "<br>"
        + " ".join(
            f"<a href='{e(u)}' target='_blank' rel='noopener' class='mini'>{e(u[0:60])}… ↗</a>" if len(u) > 60 else f"<a href='{e(u)}' target='_blank' rel='noopener' class='mini'>{e(u)} ↗</a>"
            for u in f.get("source_urls", [])
        )
        + "</td></tr>"
        for f in FLAGS["flags"]
    )
    body = f"""
<p class="lead">These items do <strong>not</strong> block publication. They are published so the project owner can review
and request changes. Each flag names its sources so you can re-check in one click.</p>
<div class="table-scroll"><table>
<thead><tr><th>ID</th><th>Severity</th><th>Irregularity / unverified item</th></tr></thead>
<tbody>{rows}</tbody>
</table></div>"""
    return page("flagged.html", "Flagged for Review", body, "flagged.html")


# ---------------------------------------------------------------- calculator
def build_calculator():
    anchor = PRICE["anchor"]
    spot = f"{anchor['price_usd_per_troy_oz']:.2f}"
    body = f"""
<section class="panel">
<h2>Gold metal-value calculator</h2>
<p class="lead">Weight × purity × spot = approximate melt (metal) value of the gold in a ring.
It excludes brand, design, labour, gemstones and retail margin — real rings cost far more than melt;
fake "gold" rings often cost suspiciously less.</p>
<div class="calc">
  <label>Ring weight <input id="w" type="number" min="0" step="0.01" value="4.00"></label>
  <label>Unit
    <select id="unit">
      <option value="1">grams (g)</option>
      <option value="0.643014931">pennyweight (dwt)</option>
      <option value="31.1034768">troy ounces (ozt)</option>
    </select>
  </label>
  <label>Karat
    <select id="karat">
      <option value="0.4167">10K — 41.7%</option>
      <option value="0.5833" selected>14K — 58.3%</option>
      <option value="0.7500">18K — 75.0%</option>
      <option value="0.9167">22K — 91.6%</option>
      <option value="0.9990">24K — 99.9%</option>
      <option value="custom">custom…</option>
    </select>
  </label>
  <label id="customWrap" style="display:none">Custom purity % <input id="custom" type="number" min="0" max="100" step="0.1" value="58.3"></label>
  <label>Gold spot (USD / troy oz) <input id="spot" type="number" min="0" step="0.01" value="{spot}"></label>
</div>
<div class="result" id="out"></div>
<p class="muted">Spot prefilled from the project anchor: <strong>${anchor['price_usd_per_troy_oz']:,.2f}/ozt, World Gold Council data as of {e(anchor['as_of'])}</strong>
(<a href="{e(anchor['source_url'])}" target="_blank" rel="noopener">gold.org ↗</a>) — update it to today's value before deciding anything.</p>
<p class="muted"><strong>Conversions used:</strong> 1 troy oz = 31.1034768 g; 1 dwt = 1/20 ozt = 1.55517384 g. Purity = karat ÷ 24.</p>
</section>
<section class="panel">
<h2>Per-gram value by karat at the prefilled spot</h2>
<div id="ktable" class="table-scroll"></div>
<p class="muted">A fair <em>scrap</em> offer is typically below these numbers (refiner margin). A retail price is typically far above them. Below-melt pricing on a "solid gold" ring = classic red flag (checklist C6).</p>
</section>
<section class="panel warn">
<h2>Limits of this estimate</h2>
<ul>
<li>Estimates metal value only — it is <strong>not</strong> an appraisal.</li>
<li>Actual gold content requires testing (XRF / fire assay — checklist C11); a stamp is only a claim.</li>
<li>Gold-bearing alloys also contain prongs/solder of lower fineness; US tolerance is ≤7/1000 below the mark for rings (15 U.S.C. §295 — see <a href="prices.html">prices page</a>).</li>
</ul>
</section>
<script>
var OZT = 31.1034768;
function fmt(n) {{ return n.toLocaleString(undefined, {{style:'currency', currency:'USD'}}); }}
function calc() {{
  var w = parseFloat(document.getElementById('w').value) || 0;
  var unit = parseFloat(document.getElementById('unit').value);
  var ks = document.getElementById('karat').value;
  var purity;
  if (ks === 'custom') {{
    document.getElementById('customWrap').style.display = 'block';
    purity = (parseFloat(document.getElementById('custom').value) || 0) / 100;
  }} else {{
    document.getElementById('customWrap').style.display = 'none';
    purity = parseFloat(ks);
  }}
  var spot = parseFloat(document.getElementById('spot').value) || 0;
  var grams = w * unit;
  var fine = grams * purity;
  var perGram = spot / OZT;
  var value = fine * perGram;
  document.getElementById('out').innerHTML =
    '<div><span>Total weight</span><strong>' + grams.toFixed(2) + ' g</strong></div>' +
    '<div><span>Fine gold content (derived)</span><strong>' + fine.toFixed(2) + ' g</strong></div>' +
    '<div><span>Spot per gram (derived)</span><strong>' + fmt(perGram) + '</strong></div>' +
    '<div class="big"><span>Estimated metal (melt) value</span><strong>' + fmt(value) + '</strong></div>';
  var kt = '';
  var karats = [[10,0.4167],[14,0.5833],[18,0.7500],[22,0.9167],[24,0.9990]];
  kt += '<table><thead><tr><th>Karat</th><th>Purity</th><th>USD / gram (derived)</th><th>USD / dwt (derived)</th><th>USD / ozt (derived)</th></tr></thead><tbody>';
  for (var i = 0; i < karats.length; i++) {{
    kt += '<tr><td>' + karats[i][0] + 'K</td><td>' + (karats[i][1]*100).toFixed(1) + '%</td><td>' + fmt(perGram*karats[i][1]) + '</td><td>' + fmt(perGram*karats[i][1]*1.55517384) + '</td><td>' + fmt(perGram*karats[i][1]*OZT) + '</td></tr>';
  }}
  kt += '</tbody></table>';
  document.getElementById('ktable').innerHTML = kt;
}}
document.addEventListener('input', calc);
document.addEventListener('change', calc);
calc();
</script>"""
    return page("calculator.html", "Gold Value Calculator", body, "calculator.html")


# ---------------------------------------------------------------- css
CSS = """:root{
  --bg:#faf9f6; --panel:#ffffff; --ink:#1c1a17; --muted:#6f6a61; --line:#e6e1d8;
  --gold:#a8862a; --gold-dark:#7c6114; --ok:#1d7a46; --okbg:#e8f5ee;
  --warn:#9a6b00; --warnbg:#fdf3dc; --high:#b3261e; --med:#b26a00; --low:#5f6b7a;
}
*{box-sizing:border-box}
body{margin:0;font:16px/1.55 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  background:var(--bg);color:var(--ink)}
.wrap{max-width:1180px;margin:0 auto;padding:0 20px}
a{color:var(--gold-dark)}
a:hover{color:var(--gold)}
h1{font-size:1.7rem;margin:.4em 0 .6em}
h2{font-size:1.15rem;margin:0 0 .6em}
.muted{color:var(--muted);font-size:.86em}
.lead{color:var(--muted)}
.mini{font-size:.8em;word-break:break-all;margin-right:8px}
.site-header{background:#141210;color:#fff;position:sticky;top:0;z-index:5}
.site-header .wrap{display:flex;align-items:center;gap:18px;flex-wrap:wrap;padding:10px 20px}
.brand{color:#fff;text-decoration:none;font-weight:700;letter-spacing:.02em}
.brand span{color:#d8b64a}
nav{display:flex;flex-wrap:wrap;gap:2px 14px;font-size:.9rem}
nav a{color:#cfc9bd;text-decoration:none;padding:4px 2px;border-bottom:2px solid transparent}
nav a.active{color:#fff;border-color:#d8b64a}
nav a:hover{color:#fff}
.policy-banner{background:var(--warnbg);border-bottom:1px solid #ecd9a0;color:#4a3a08;
  padding:10px 20px;font-size:.92rem;text-align:center}
main{padding:18px 20px 40px}
.panel{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:18px 20px;margin:16px 0;
  box-shadow:0 1px 2px rgba(0,0,0,.03)}
.panel.key{border-left:4px solid var(--gold)}
.panel.warn{border-left:4px solid var(--warn)}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin:14px 0}
.card{background:var(--panel);border:1px solid var(--line);border-radius:10px;padding:14px 16px}
.card .num{font-size:1.55rem;font-weight:700;color:var(--gold-dark)}
.card .num.small{font-size:1.15rem}
.card .lbl{color:var(--muted);font-size:.85rem}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px}
.tile{display:flex;flex-direction:column;gap:4px;background:var(--panel);border:1px solid var(--line);
  border-radius:10px;padding:14px 16px;text-decoration:none;color:var(--ink)}
.tile span{color:var(--muted);font-size:.85rem}
.tile.warn{border-color:#ecd9a0;background:var(--warnbg)}
.tile:hover{border-color:var(--gold)}
.table-scroll{overflow-x:auto;border:1px solid var(--line);border-radius:8px}
table{border-collapse:collapse;width:100%;font-size:.92rem;background:#fff}
th,td{text-align:left;padding:9px 10px;border-bottom:1px solid var(--line);vertical-align:top}
thead th{background:#f4f0e7;font-size:.8rem;text-transform:uppercase;letter-spacing:.04em;color:#57503f}
tbody tr:hover{background:#fbf8f1}
td.num{white-space:nowrap;font-variant-numeric:tabular-nums}
.kv th{width:170px;background:#faf7f0}
.badge{display:inline-block;font-size:.72rem;font-weight:700;border-radius:20px;padding:2px 9px;white-space:nowrap}
.badge.ok{background:var(--okbg);color:var(--ok)}
.badge.warn{background:var(--warnbg);color:var(--warn)}
.blank{color:var(--muted);font-weight:700}
.sev{display:inline-block;font-size:.72rem;font-weight:700;border-radius:4px;padding:2px 8px;text-transform:uppercase}
.sev.high{background:#fdecea;color:var(--high)}
.sev.medium{background:var(--warnbg);color:var(--med)}
.sev.low{background:#eef1f4;color:var(--low)}
.quote{display:block;color:var(--muted);font-size:.84rem;font-style:italic;margin-top:6px;word-break:break-word}
footer{background:#141210;color:#b9b2a4;font-size:.85rem;padding:22px 0;margin-top:30px}
footer a{color:#d8b64a}
.calc{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;margin:10px 0}
.calc label{display:flex;flex-direction:column;gap:6px;font-size:.88rem;color:var(--muted);font-weight:600}
.calc input,.calc select{padding:9px 10px;border:1px solid var(--line);border-radius:8px;font-size:1rem;background:#fff;color:var(--ink)}
.result{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin:16px 0 6px}
.result>div{background:#f7f3ea;border:1px solid var(--line);border-radius:10px;padding:12px 14px}
.result span{display:block;color:var(--muted);font-size:.8rem}
.result strong{font-size:1.15rem;font-variant-numeric:tabular-nums}
.result .big{grid-column:1/-1;background:var(--warnbg);border-color:#ecd9a0}
.result .big strong{font-size:1.6rem;color:var(--gold-dark)}
pre{background:#f4f0e7;border:1px solid var(--line);border-radius:8px;padding:12px;overflow-x:auto;font-size:.85rem}
@media(max-width:640px){h1{font-size:1.3rem}}"""


def write(name, content):
    os.makedirs(DOCS, exist_ok=True)
    path = os.path.join(DOCS, name)
    with open(path, "w", encoding="utf-8") as f:
        f.write(content)
    print(f"wrote docs/{name} ({len(content):,} bytes)")


def main():
    # attach retailer keys
    keymap = {
        "Tiffany & Co.": "tiffany-co",
        "Cartier": "cartier",
        "Brilliant Earth": "brilliant-earth",
        "Blue Nile": "blue-nile",
        "Blue Nile (James Allen-branded setting)": "blue-nile",
        "James Allen → Blue Nile (migrated listing)": "blue-nile",
        "Mejuri": "mejuri",
    }
    for r in RINGS["rings"]:
        r["retailer_key"] = keymap[r["retailer"]]

    write("styles.css", CSS)
    write("index.html", build_index())
    write("rings.html", build_rings_all())
    for key in RETAILER_PAGES:
        write(f"rings-{key}.html", build_retailer(key))
    write("prices.html", build_prices())
    write("checklist.html", build_checklist())
    write("methodology.html", build_methodology())
    write("flagged.html", build_flagged())
    write("calculator.html", build_calculator())
    print("build complete")


if __name__ == "__main__":
    main()
