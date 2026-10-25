'use strict';
// Preloaded into the gate server (NODE_OPTIONS --require): while the fixture is in use, no Sanity GROQ API request may leave the process.
// Blocked: apicdn.sanity.io and <project>.apicdn.sanity.io (the CDN whose quota ran out), and <project>.api.sanity.io unless SANITY_NET_ALLOW=api
// (the capture run goes through the API host). Allowed and only counted: cdn.sanity.io (the asset/image CDN, a separate quota) -> _assets.log.
// Every blocked attempt is appended to $SANITY_FIXTURE_LOGDIR/_net.log, which the gate proof requires to be empty.
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const https = require('node:https');

const LOGDIR = process.env.SANITY_FIXTURE_LOGDIR;
const ALLOW_API = process.env.SANITY_NET_ALLOW === 'api';

function log(file, line) {
  if (!LOGDIR) return;
  try { fs.mkdirSync(LOGDIR, { recursive: true }); fs.appendFileSync(path.join(LOGDIR, file), `${new Date().toISOString()} ${line}\n`); } catch { /* the proof reports a missing log */ }
}
function classify(host) {
  const h = String(host || '').toLowerCase().replace(/:\d+$/, '');
  if (h === 'apicdn.sanity.io' || h.endsWith('.apicdn.sanity.io')) return 'blocked';
  if (h.endsWith('.api.sanity.io') || h === 'api.sanity.io') return ALLOW_API ? 'allowed' : 'blocked';
  if (h === 'cdn.sanity.io') return 'asset';
  return 'other';
}
function check(host, how) {
  const k = classify(host);
  if (k === 'blocked') {
    log('_net.log', `${how} ${host}`);
    const e = new TypeError(`[block-sanity-net] ${host} is blocked while the Sanity fixture is in use`);
    throw e;
  }
  if (k === 'asset') log('_assets.log', `${how} ${host}`);
}
function hostOf(args) {
  const a = args[0];
  if (typeof a === 'string') { try { return new URL(a).host; } catch { return ''; } }
  if (a instanceof URL) return a.host;
  if (a && typeof a === 'object') return a.hostname || (a.host ? String(a.host).replace(/:\d+$/, '') : '');
  return '';
}

for (const mod of [http, https]) {
  for (const fn of ['request', 'get']) {
    const orig = mod[fn];
    mod[fn] = function patched(...args) { check(hostOf(args), `${mod === https ? 'https' : 'http'}.${fn}`); return orig.apply(this, args); };
  }
}
if (typeof globalThis.fetch === 'function') {
  const origFetch = globalThis.fetch;
  globalThis.fetch = function patchedFetch(input, init) {
    let host = '';
    try { host = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url).host; } catch { /* relative: not a Sanity host */ }
    check(host, 'fetch');
    return origFetch.call(this, input, init);
  };
}
