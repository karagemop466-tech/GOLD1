#!/usr/bin/env node
'use strict';

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'dist');
const port = Number(process.env.PORT || 4173);

if (!fs.existsSync(dist)) {
  console.error('dist/ is missing. Run npm run build before npm run serve.');
  process.exit(1);
}
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8' };
const headers = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"
};

http.createServer((request, response) => {
  if (!['GET', 'HEAD'].includes(request.method)) {
    response.writeHead(405, { ...headers, Allow: 'GET, HEAD' });
    response.end('Method not allowed');
    return;
  }
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url, 'http://preview.internal').pathname); }
  catch (_) { response.writeHead(400, headers); response.end('Bad request'); return; }
  if (pathname.includes('\0') || pathname.includes('\\')) {
    response.writeHead(400, headers); response.end('Bad request'); return;
  }
  let file = path.resolve(dist, `.${pathname}`);
  if (file !== dist && !file.startsWith(`${dist}${path.sep}`)) {
    response.writeHead(403, headers); response.end('Forbidden'); return;
  }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
    if (!pathname.endsWith('/')) {
      response.writeHead(308, { ...headers, Location: `${pathname}/` });
      response.end();
      return;
    }
    file = path.join(file, 'index.html');
  }
  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    response.writeHead(404, { ...headers, 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }
  const bytes = fs.readFileSync(file);
  response.writeHead(200, { ...headers, 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Content-Length': bytes.length });
  response.end(request.method === 'HEAD' ? undefined : bytes);
}).listen(port, '0.0.0.0', () => {
  console.log(`GOLD1 static preview listening on 0.0.0.0:${port}; serving audited dist/`);
});
