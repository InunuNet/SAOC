#!/usr/bin/env node
// A1 - the events page shows only sourced events (just the National Show) or the honest empty state.
// Fails today: the page renders the 16 invented Sanity docs (and the static fallback behind them).
// Usage: BASE_URL=http://localhost:3002 node contracts/checks/launch-weekend/f4/check-a-events-page.mjs
import { get, inventedIn, KEEP, report, stripTags } from './_lib.mjs';

const problems = [];
const { text: html } = await get('/events');
const text = stripTags(html);

for (const t of inventedIn(html)) problems.push(`events page shows an invented event: ${t}`);

// Every event detail link must be the National Show's, nothing else.
const links = [...new Set([...html.matchAll(/href="\/events\/([^"/?#]+)"/g)].map((m) => m[1]))];
for (const s of links) if (s !== KEEP.slug) problems.push(`events page links to an unsourced event page: /events/${s}`);

// Honest state: either the National Show is listed, or the standard confirmation marker is rendered.
const showsNos = text.includes(KEEP.title);
const hasMarker = /data-confirmation-badge="pending"|data-exhibitor-marker="pending"/.test(html);
if (!showsNos && !hasMarker) problems.push('events page lists no event and renders no awaiting-copy StatusMarker');
if (!showsNos && !/No upcoming events scheduled\./.test(text)) problems.push('empty events page lacks the existing "No upcoming events scheduled." sentence');

report(problems, `events page honest (${showsNos ? 'National Show listed' : 'empty state with marker'})`);
