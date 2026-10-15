#!/usr/bin/env node
// A2 - security headers on page routes; CSP is report-only; no COOP; Studio and admin still served (runtime, BASE_URL).
import { fetchRaw, report } from './_lib.mjs';

const problems = [];
const must = (route, h, name, test, why) => {
  const v = h.get(name);
  if (v === null || !test(v)) problems.push(`${route}: ${name} ${v === null ? 'missing' : `wrong (${v})`} - ${why}`);
};

for (const route of ['/', '/about', '/studio', '/admin/login', '/national-show']) {
  const res = await fetchRaw(route);
  const h = res.headers;
  if (route === '/studio' || route === '/admin/login') {
    if (res.status >= 400) problems.push(`${route}: answered ${res.status}, must keep working`);
  }
  must(route, h, 'strict-transport-security', (v) => /max-age=(\d+)/.test(v) && Number(v.match(/max-age=(\d+)/)[1]) >= 31536000 && !/includeSubDomains|preload/i.test(v), 'max-age >= 1 year, no includeSubDomains or preload');
  must(route, h, 'x-content-type-options', (v) => v.toLowerCase() === 'nosniff', 'nosniff');
  must(route, h, 'referrer-policy', (v) => v === 'strict-origin-when-cross-origin', 'strict-origin-when-cross-origin');
  must(route, h, 'x-frame-options', (v) => v.toUpperCase() === 'SAMEORIGIN', 'SAMEORIGIN');
  must(route, h, 'permissions-policy', (v) => /camera=\(self\)/.test(v) && /microphone=\(\)/.test(v) && /geolocation=\(\)/.test(v), 'camera=(self) for the door scanner; microphone and geolocation off');
  must(route, h, 'content-security-policy-report-only', (v) => /default-src/.test(v) && /cdn\.sanity\.io/.test(v) && /payfast/.test(v) && /ozow/.test(v) && /googleapis|gstatic/.test(v), 'report-only policy naming Sanity, PayFast, Ozow and Google hosts');
  if (h.get('content-security-policy')) problems.push(`${route}: enforcing Content-Security-Policy present, must be Report-Only`);
  if (h.get('cross-origin-opener-policy')) problems.push(`${route}: COOP set, breaks Firebase Auth popups`);
}
report(problems, 'security headers present on 5 routes, CSP report-only, no COOP, /studio and /admin/login still served');
