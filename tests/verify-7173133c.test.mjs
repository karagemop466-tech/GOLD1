/**
 * GOLD1 — sess-7173133c (T56/§29) tests for scripts/verify_7173133c.mjs (V01–V12).
 *
 * Positive: the real ledger + portal pass all 12 gates.
 * Negative: tampered copies (missing source URL, forged weight, XSS handler,
 * broken internal link) must each trip their gate — proving the gate works.
 *
 * Run: node --test tests/verify-7173133c.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, cp, readFile, writeFile, rm } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const VERIFIER = join(REPO, 'scripts', 'verify_7173133c.mjs');
const SESSION_REL = 'data/session-7173133c';

const runVerifier = (cwd) => spawnSync(process.execPath, [VERIFIER], { cwd, encoding: 'utf8' });

test('real ledger + portal pass all 12 gates', () => {
  const res = runVerifier(REPO);
  assert.equal(res.status, 0, `verifier failed:\n${res.stdout}\n${res.stderr}`);
  assert.match(res.stdout, /12\/12 gates passed/);
  const checks = JSON.parse(readFileSync(join(REPO, SESSION_REL, 'checks.json'), 'utf8'));
  assert.equal(checks.failure_count, 0);
  assert.equal(checks.results.length, 12);
  assert.equal(checks.session, 'sess-7173133c');
});

test('ledger coverage invariants: 71 canonical + 13 candidates, every row sourced', async () => {
  const v = JSON.parse(await readFile(join(REPO, SESSION_REL, 'verify-7173133c.json'), 'utf8'));
  assert.equal(v.canonical_rows.length, 71);
  assert.equal(v.candidate_rows.length, 13);
  for (const r of [...v.canonical_rows, ...v.candidate_rows]) {
    assert.match(r.source_url, /^https:\/\//, `${r.id} must link an official https source`);
    assert.ok(r.quote.length > 15, `${r.id} must carry a verbatim quote`);
  }
  // No weight may be claimed where the seller publishes none.
  for (const r of v.canonical_rows.filter((x) => x.weight_verdict === 'not_published')) {
    assert.equal(r.stored_weight_g, null);
    assert.equal(r.live_weight_g, null);
  }
});

test('sabotage: a row with its source URL stripped must fail V02', async () => {
  const tmp = await mkdtemp(join(tmpdir(), 'g717-'));
  try {
    await cp(join(REPO, SESSION_REL), join(tmp, SESSION_REL), { recursive: true });
    const p = join(tmp, SESSION_REL, 'verify-7173133c.json');
    const v = JSON.parse(await readFile(p, 'utf8'));
    delete v.canonical_rows[0].source_url;
    await writeFile(p, JSON.stringify(v));
    const res = runVerifier(tmp);
    assert.notEqual(res.status, 0, 'verifier must fail when a source URL is removed');
    assert.match(res.stdout, /\[FAIL\] V02/);
    assert.match(res.stdout, /rs-571221: missing\/invalid source_url/);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test('sabotage: a forged (non-live) weight must fail V04', async () => {
  const tmp = await mkdtemp(join(tmpdir(), 'g717-'));
  try {
    await cp(join(REPO, SESSION_REL), join(tmp, SESSION_REL), { recursive: true });
    const p = join(tmp, SESSION_REL, 'verify-7173133c.json');
    const v = JSON.parse(await readFile(p, 'utf8'));
    const row = v.canonical_rows.find((r) => r.weight_verdict === 'confirmed');
    row.live_weight_g = Number(row.live_weight_g) + 0.5; // forge a weight the page never printed
    await writeFile(p, JSON.stringify(v));
    const res = runVerifier(tmp);
    assert.notEqual(res.status, 0, 'verifier must fail on a forged weight');
    assert.match(res.stdout, /\[FAIL\] V04/);
    assert.match(res.stdout, new RegExp(`${row.id}: stored weight .* != live`));
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test('sabotage: an inline event handler injected into the portal must fail V10', async () => {
  const tmp = await mkdtemp(join(tmpdir(), 'g717-'));
  try {
    await cp(join(REPO, SESSION_REL), join(tmp, SESSION_REL), { recursive: true });
    const p = join(tmp, SESSION_REL, 'portal', 'index.html');
    const html = await readFile(p, 'utf8');
    await writeFile(p, html.replace('<main>', '<main><img src="data:image/gif;base64,R0lGOD" onerror="steal()">'));
    const res = runVerifier(tmp);
    assert.notEqual(res.status, 0, 'verifier must fail on an inline handler');
    assert.match(res.stdout, /\[FAIL\] V10/);
    assert.match(res.stdout, /index\.html: inline event handler/);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test('sabotage: a broken internal link must fail V09', async () => {
  const tmp = await mkdtemp(join(tmpdir(), 'g717-'));
  try {
    await cp(join(REPO, SESSION_REL), join(tmp, SESSION_REL), { recursive: true });
    const p = join(tmp, SESSION_REL, 'portal', 'rows.html');
    const html = await readFile(p, 'utf8');
    await writeFile(p, html.replace('href="index.html"', 'href="missing-page.html"'));
    const res = runVerifier(tmp);
    assert.notEqual(res.status, 0, 'verifier must fail on a broken internal link');
    assert.match(res.stdout, /\[FAIL\] V09/);
    assert.match(res.stdout, /broken internal link -> missing-page\.html/);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});

test('sabotage: dropping the top No-hallucinations banner must fail V01', async () => {
  const tmp = await mkdtemp(join(tmpdir(), 'g717-'));
  try {
    await cp(join(REPO, SESSION_REL), join(tmp, SESSION_REL), { recursive: true });
    const p = join(tmp, SESSION_REL, 'portal', 'index.html');
    const html = await readFile(p, 'utf8');
    await writeFile(p, html.replace(/<div class="banner"><strong>No hallucinations[^]*?<\/div>/, ''));
    const res = runVerifier(tmp);
    assert.notEqual(res.status, 0, 'verifier must fail when the banner is removed');
    assert.match(res.stdout, /\[FAIL\] V01/);
  } finally {
    await rm(tmp, { recursive: true, force: true });
  }
});
