import { readFile, writeFile } from 'node:fs/promises';
const rings = JSON.parse(await readFile('data/rings.json', 'utf8')).rows;
const gold = JSON.parse(await readFile('data/gold-price.json', 'utf8'));
const c = JSON.parse(await readFile('data/checklist.json', 'utf8'));

const spot = gold.primary.price_usd_per_ozt;
const gpo = gold.grams_per_troy_ounce ?? 31.1034768;
const ts = gold.primary.publisher_timestamp;
const perGram = spot / gpo;
const karat = (r) => {
  const m = /(\d{2})K/i.exec(r.karat || '');
  return m ? Number(m[1]) : null;
};
const weighted = rings.filter((r) => !r.withdrawn && r.weight_g_low != null && karat(r));
const mult = weighted.map((r) => {
  const w = r.weight_g_low;
  return { id: r.id, m: r.price_low / (w * (karat(r) / 24) * perGram) };
}).sort((a, b) => a.m - b.m);
const lo = mult[0];
const hi = mult[mult.length - 1];
const plain = mult.filter((x) => /^rs-/.test(x.id));
const fmt = (n) => n.toFixed(2) + '×';

c.items[5].finding =
  `Spot gold is pinned with the publisher's own timestamp (${ts}) at $${spot.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})}/ozt (${spot} USD/ozt exactly as the publisher prints it) — $${perGram.toFixed(2)}/g of 24K fine gold using NIST Handbook 130 § 2.17 exact ${gpo} g/ozt. ` +
  `Across the ${weighted.length} active rows that publish a metal gram weight, price-to-melt spans ${fmt(lo.m)} (${lo.id}) to ${fmt(hi.m)} (${hi.id}); the ${plain.length} plain and dome bands cluster at ${fmt(plain[0].m)}–${fmt(plain[plain.length - 1].m)}. ` +
  `Stone-set rows sit higher partly because the seller's gram figure includes the diamonds — that makes the multiple conservative, not generous. Automated check S06 flags any price below raw gold melt.`;

c.items[3].finding = c.items[3].finding.replace(
  /25 of 71 rows \([^)]*\)/,
  `25 of 71 rows (24 active + 1 withdrawn)`
);

const w = rings.filter((r) => r.weight_g_low != null);
const min = Math.min(...w.map((r) => r.weight_g_low));
const max = Math.max(...w.map((r) => r.weight_g_high ?? r.weight_g_low));
c.items[3].finding = c.items[3].finding.replace(/\(0\.3 g to [^)]*\)/, `(${min} g to ${max} g)`);
c.as_of = '2026-10-23';
await writeFile('data/checklist.json', JSON.stringify(c, null, 2) + '\n');
console.log('item 6:', c.items[5].finding);
console.log('item 4:', c.items[3].finding);
