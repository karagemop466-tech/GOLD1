#!/usr/bin/env node
/**
 * Isolated post-union QA snapshot for T47. This is intentionally read-only with
 * respect to canonical data and site files; outputs stay under data/session-a4b3c19b/.
 * It checks source-link structure, preserves the independent R01-R10 audit, and
 * records which repository checks were reproduced in a disposable archive.
 * It does NOT fetch retailer pages or claim live product-price verification.
 */
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../', import.meta.url));
const ownDir = join(ROOT, 'data/session-a4b3c19b');
const load = async (file) => JSON.parse(await readFile(join(ROOT, file), 'utf8'));
const [catalog, retailerDoc, semanticAudit] = await Promise.all([
  load('data/rings.json'), load('data/retailers.json'), load('data/session-a4b3c19b/audit-5f363d57-snapshot.json')
]);
const retailers = new Map(retailerDoc.retailers.map((r) => [r.id, r]));
const rows = catalog.rows;
const duplicateIds = rows.map((r) => r.id).filter((id, i, all) => all.indexOf(id) !== i);
const sourceIssues = [];
const evidenceIssues = [];
const statusIssues = [];
for (const row of rows) {
  const host = (() => { try { return new URL(row.source_url).hostname.toLowerCase(); } catch { return ''; } })();
  const retailer = retailers.get(row.retailer_id);
  const domain = retailer?.domain?.toLowerCase();
  if (!host || !row.source_url.startsWith('https://') || !domain || !(host === domain || host.endsWith(`.${domain}`))) {
    sourceIssues.push({ row: row.id, url: row.source_url ?? null, retailer_domain: domain ?? null, host: host || null });
  }
  if (typeof row.evidence !== 'string' || !row.evidence.trim()) evidenceIssues.push(row.id);
  if (!['confirmed', 'partly_verified', 'withdrawn', 'withdrawn_source_mismatch', 'unverified'].includes(row.verification_status)) {
    statusIssues.push({ row: row.id, status: row.verification_status ?? null });
  }
}
const groupSummary = semanticAudit.groups.map((g) => ({
  id: g.id, name: g.name, passed: g.passed,
  findings: semanticAudit.findings.filter((f) => f.group === g.id).length
}));
const report = {
  task: 'T47 independent post-union reproducibility QA',
  session: 'arena/a4b3c19b-gold1',
  generated_at: new Date().toISOString(),
  mode: 'static-only; no seller pages or market feeds were fetched in this pass',
  canonical_snapshot: {
    dataset_generated_at: catalog.generated_at,
    rows: rows.length,
    retailer_count: retailerDoc.retailers.length,
    duplicate_ids: [...new Set(duplicateIds)],
    product_source_link_issues: sourceIssues,
    missing_evidence_ids: evidenceIssues,
    unexpected_verification_statuses: statusIssues
  },
  reproduced_check_results_in_disposable_archive: {
    npm_ci: 'PASS — 0 vulnerabilities reported by npm audit',
    npm_test: 'PASS — evidence, internal links, security, HTML validation, runtime, build parity',
    canonical_verifier: 'PASS — S01–S20, 6,922 assertions, P111, 0 failures',
    audit_0804e222: 'PASS — A01–A10, 1,966 assertions',
    audit_545688f3: 'PASS — H01–H13, 1,684 assertions',
    audit_dab93754: 'PASS — N01–N11, 1,567 assertions',
    semantic_audit_5f363d57: {
      status: semanticAudit.status,
      assertions: semanticAudit.summary.assertions,
      groups_passed: semanticAudit.summary.passed,
      groups_total: semanticAudit.summary.groups,
      finding_count: semanticAudit.summary.findings,
      groups: groupSummary,
      detailed_snapshot: 'data/session-a4b3c19b/audit-5f363d57-snapshot.json'
    },
    evidence_math_test: 'PASS — 38 assertions, rerun separately after the semantic audit returned nonzero.'
  },
  interpretation: [
    'The main structural verifier and security checks passed in an isolated copy of this exact branch snapshot.',
    'The independent semantic/provenance audit is explicitly NOT green: it reports 159 findings across R02–R07, R09 and R10. This reproduces the count already logged by the T44 owner; it is not an independent confirmation of each underlying product claim.',
    'No product, return-policy, hallmark, weight, or current gold-price source was re-opened in this pass. Stored prices are not represented as current or independently verified by this report.',
    'Source-link structure only establishes HTTPS URLs on the configured retailer domain; it does not prove the page still describes the listed product or that any price is current.'
  ]
};
await mkdir(ownDir, { recursive: true });
await writeFile(join(ownDir, 'qa-report.json'), JSON.stringify(report, null, 2) + '\n');
const priorityFindings = semanticAudit.findings.filter((f) => f.severity === 'high').slice(0, 10);
const md = [
  '# T47 independent post-union QA', '',
  `- Generated: ${report.generated_at} (UTC)`,
  `- Dataset snapshot: ${catalog.generated_at}; ${rows.length} rows, ${retailerDoc.retailers.length} retailers.`,
  '- Scope: static-only audit in a disposable archive; no live seller pages or spot-price feeds were fetched.',
  '',
  '## Check results', '',
  '| Check | Result |', '|---|---|',
  ...Object.entries(report.reproduced_check_results_in_disposable_archive)
    .filter(([, value]) => typeof value === 'string')
    .map(([key, value]) => `| ${key} | ${value} |`),
  `| Semantic audit | **${semanticAudit.summary.findings} findings; ${semanticAudit.summary.passed}/${semanticAudit.summary.groups} groups passed** |`,
  '', '### Semantic-audit groups', '',
  '| Group | Result | Findings |', '|---|---:|---:|',
  ...groupSummary.map((g) => `| ${g.id} — ${g.name} | ${g.passed ? 'PASS' : 'FAIL'} | ${g.findings} |`),
  '', '### First 10 high-severity detector findings (not independently re-verified)', '',
  '| Finding | Detector statement | Source links in preserved report |', '|---|---|---|',
  ...priorityFindings.map((f) => {
    const safe = String(f.message).replaceAll('|', '\\|');
    const links = (f.sources ?? []).filter((url) => /^https:\/\//i.test(url)).map((url, i) => `[source ${i + 1}](${url})`).join('<br>') || '—';
    return `| ${f.id} (${f.severity}) | ${safe} | ${links} |`;
  }),
  '', '## Important limits and irregularities', '',
  ...report.interpretation.map((item) => `- ${item}`),
  '',
  'Detailed, unmodified failed-audit finding snapshot: [`audit-5f363d57-snapshot.json`](audit-5f363d57-snapshot.json). Refer to each finding’s source URL for manual review; findings are not treated as verified facts solely because the static detector reported them.',
  ''
].join('\n');
await writeFile(join(ownDir, 'qa-report.md'), md);
console.log(`Wrote isolated QA report: ${rows.length} rows; ${sourceIssues.length} product source-link structure issues; ${evidenceIssues.length} missing evidence; semantic findings ${semanticAudit.summary.findings}.`);
