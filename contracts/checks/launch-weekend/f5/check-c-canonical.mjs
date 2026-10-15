#!/usr/bin/env node
// A3 - every page has exactly one canonical equal to the production origin plus its own path,
// query strings ignored; pages that set their own canonical via buildPageMetadata are not doubled (runtime, BASE_URL).
import { getPage, report, CANONICAL_ORIGIN } from './_lib.mjs';

const problems = [];
const routes = ['/', '/about', '/societies', '/judging', '/events', '/contact', '/national-show', '/national-show/about', '/national-show/faq'];
const sitemap = (await getPage('/sitemap.xml')).text;
const society = (sitemap.match(/\/societies\/([a-z0-9-]+)</) || [])[1];
if (society) routes.push(`/societies/${society}`);

for (const route of [...routes, '/about?utm_source=x&ref=y']) {
  const { text } = await getPage(route);
  const links = [...text.matchAll(/<link\b[^>]*rel="canonical"[^>]*>/g)].map((m) => m[0]);
  if (links.length !== 1) { problems.push(`${route}: ${links.length} canonical links, expected 1`); continue; }
  const href = (links[0].match(/href="([^"]+)"/) || [])[1];
  const path = route.split('?')[0];
  const want = path === '/' ? [CANONICAL_ORIGIN, `${CANONICAL_ORIGIN}/`] : [`${CANONICAL_ORIGIN}${path}`];
  if (!want.includes(href)) problems.push(`${route}: canonical ${href}, expected ${want[0]}`);
}
report(problems, `${routes.length + 1} routes each carry one correct canonical`);
