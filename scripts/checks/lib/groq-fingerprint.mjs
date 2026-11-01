// Identity of one GROQ query in the request-count log (PR #160 Codex finding P3). The counting
// preload tags every stubbed Sanity request with the hash of its whole `query` parameter, so the
// --live-reads check can match one named query exactly instead of a substring that another query
// could also contain. Whitespace runs are collapsed first: the source template literal and the
// request may indent differently, but no GROQ token depends on the amount of whitespace.
import { createHash } from 'node:crypto';

export const QUERY_HASH_FIELD = 'qh=';
const NO_QUERY = '-';
// Fixed position of the hash field: `<time> <host> qh=<hash> <query prefix...>`. Time and host
// never hold a space, and the field comes BEFORE the query text, so text inside a query (a GROQ
// comment reading `qh=<hash>`, say) can never be taken for it.
const HASH_FIELD_INDEX = 2;

export function normaliseGroq(text) {
  return text.replace(/\s+/g, ' ').trim();
}

export function queryFingerprint(text) {
  return createHash('sha256').update(normaliseGroq(text)).digest('hex');
}

// One count-log line for a stubbed Sanity request: time, API host, the exact-identity hash field,
// then the readable query prefix the golden substring fingerprints were written against.
export function formatCountLine(url, now = Date.now()) {
  const parsed = new URL(url);
  const query = parsed.searchParams.get('query');
  const hash = query === null ? NO_QUERY : queryFingerprint(query);
  const host = parsed.hostname.split('.').slice(-3).join('.');
  const prefix = decodeURIComponent(parsed.search).slice(0, 90).replace(/\s+/g, ' ');
  return `${now} ${host} ${QUERY_HASH_FIELD}${hash} ${prefix}\n`;
}

// How many count-log lines carry exactly this query hash in the hash field.
export function countQuery(lines, fingerprint) {
  const token = `${QUERY_HASH_FIELD}${fingerprint}`;
  return lines.filter((line) => line.split(' ')[HASH_FIELD_INDEX] === token).length;
}
