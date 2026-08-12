#!/usr/bin/env node
// Fetches http://localhost:3333/ and prints ONLY the "In collaboration with"
// partners section's HTML to stdout, so assertions can grep it without
// false hits from unrelated chrome (e.g. Footer.tsx's own WOSA link).
//
// Usage: node extract-partners-html.mjs [url]

const url = process.argv[2] || 'http://localhost:3333/';

const res = await fetch(url);
if (!res.ok) {
  console.error(`fetch failed: ${res.status} ${res.statusText}`);
  process.exit(2);
}
const html = await res.text();

const marker = 'In collaboration with';
const markerIdx = html.indexOf(marker);
if (markerIdx === -1) {
  console.error('marker "In collaboration with" not found in rendered HTML');
  process.exit(2);
}

const sectionStart = html.lastIndexOf('<section', markerIdx);
if (sectionStart === -1) {
  console.error('no enclosing <section> found before marker');
  process.exit(2);
}

const sectionEndTag = html.indexOf('</section>', markerIdx);
if (sectionEndTag === -1) {
  console.error('no closing </section> found after marker');
  process.exit(2);
}

const sectionEnd = sectionEndTag + '</section>'.length;
const sectionHtml = html.slice(sectionStart, sectionEnd);

if (process.argv[3] === '--text') {
  // Crude tag-stripping text extraction, sufficient for a length proxy
  // (are the cards more than bare names?) — not used for exact-copy assertions.
  const text = sectionHtml
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  process.stdout.write(text);
} else if (process.argv[3] === '--assert-anchor-attrs') {
  // Exit 0 iff an <a> tag whose href contains argv[4] also carries both
  // target="_blank" and rel="noopener noreferrer". Exit 1 otherwise
  // (anchor missing entirely, or missing either attribute).
  const hrefFragment = process.argv[4];
  const tagMatch = sectionHtml.match(new RegExp(`<a[^>]*${hrefFragment.replace(/\./g, '\\.')}[^>]*>`));
  if (!tagMatch) {
    console.error(`no <a> tag found with href containing "${hrefFragment}"`);
    process.exit(1);
  }
  const tag = tagMatch[0];
  const hasTargetBlank = tag.includes('target="_blank"');
  const hasRelNoopener = tag.includes('rel="noopener noreferrer"');
  if (!hasTargetBlank || !hasRelNoopener) {
    console.error(`anchor missing required attrs (target_blank=${hasTargetBlank}, rel_noopener=${hasRelNoopener}): ${tag}`);
    process.exit(1);
  }
  process.exit(0);
} else {
  process.stdout.write(sectionHtml);
}
