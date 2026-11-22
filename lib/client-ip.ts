/**
 * Client address from an X-Forwarded-For header on Firebase App Hosting. Google's front end
 * appends the client IP, so the header reads `<client-supplied...>, <client-ip>, <lb-ip>`:
 * the first entries are attacker-controlled and the last is the shared load-balancer address.
 * One entry is used as-is; two or more yield the second-to-last. Null when absent or empty.
 */
export function clientIpFromForwardedFor(header: string | null | undefined): string | null {
  const hops = (header ?? '')
    .split(',')
    .map((hop) => hop.trim())
    .filter((hop) => hop !== '');
  if (hops.length === 0) return null;
  if (hops.length === 1) return hops[0] ?? null;
  return hops[hops.length - 2] ?? null;
}

const IPV6_GROUPS = 8;
const IPV6_PREFIX_GROUPS = 4;
const IPV4_OCTETS = 4;
const MAX_OCTET = 255;
const IPV4_MAPPED_MARKER = 0xffff;
const HEXTET_PATTERN = /^[0-9a-f]{1,4}$/i;
const IPV4_PATTERN = /^\d{1,3}(\.\d{1,3}){3}$/;

/** Dotted IPv4 to two hextets (high, low), or null when malformed or an octet is out of range. */
export function ipv4ToHextets(dotted: string): number[] | null {
  if (!IPV4_PATTERN.test(dotted)) return null;
  const octets = dotted.split('.').map(Number);
  if (octets.length !== IPV4_OCTETS || octets.some((o) => o > MAX_OCTET)) return null;
  const [a = 0, b = 0, c = 0, d = 0] = octets;
  return [a * 256 + b, c * 256 + d];
}

/** One side of a `::` split as hextet values; an embedded IPv4 tail becomes two hextets. */
function parseHextets(part: string, allowV4Tail: boolean): number[] | null {
  if (part === '') return [];
  const pieces = part.split(':');
  const out: number[] = [];
  for (const [i, piece] of pieces.entries()) {
    if (allowV4Tail && i === pieces.length - 1 && piece.includes('.')) {
      const tail = ipv4ToHextets(piece);
      if (!tail) return null;
      out.push(...tail);
    } else if (HEXTET_PATTERN.test(piece)) {
      out.push(parseInt(piece, 16));
    } else {
      return null;
    }
  }
  return out;
}

/** Eight 16-bit groups of an IPv6 literal (no brackets, zone or port), or null if invalid. */
export function parseIpv6(text: string): number[] | null {
  const halves = text.split('::');
  if (halves.length > 2) return null;
  const head = parseHextets(halves[0] ?? '', halves.length === 1);
  const tail = halves.length === 2 ? parseHextets(halves[1] ?? '', true) : [];
  if (!head || !tail) return null;
  if (halves.length === 1) return head.length === IPV6_GROUPS ? head : null;
  const missing = IPV6_GROUPS - head.length - tail.length;
  if (missing < 1) return null;
  return [...head, ...new Array<number>(missing).fill(0), ...tail];
}

/** Strips `[...]` brackets (and any `:port` after them) and a `%zone` suffix. */
function unwrapIpv6Literal(value: string): string {
  let text = value;
  if (text.startsWith('[')) {
    const close = text.indexOf(']');
    if (close === -1) return text;
    text = text.slice(1, close);
  }
  const zone = text.indexOf('%');
  return zone === -1 ? text : text.slice(0, zone);
}

/**
 * Rate-limit bucket for a client address. IPv4 is kept as-is. IPv6 collapses to its /64 prefix
 * (`2001:db8:0:1::/64`: first four hextets, lowercase hex, no zero padding) because one
 * subscriber normally controls a whole /64 and could otherwise rotate addresses past the limit.
 * IPv4-mapped IPv6 (`::ffff:1.2.3.4` or `::ffff:102:304`) yields the embedded IPv4 address.
 * Anything unparseable is returned trimmed and unchanged; null/empty gives null. Never throws.
 */
export function rateLimitKeyForIp(ip: string | null | undefined): string | null {
  const trimmed = (ip ?? '').trim();
  if (trimmed === '') return null;
  if (IPV4_PATTERN.test(trimmed)) return trimmed;
  const groups = parseIpv6(unwrapIpv6Literal(trimmed));
  if (!groups) return trimmed;
  const mapped = groups.slice(0, 5).every((g) => g === 0) && groups[5] === IPV4_MAPPED_MARKER;
  if (mapped) {
    const hi = groups[6] ?? 0;
    const lo = groups[7] ?? 0;
    return `${hi >> 8}.${hi & 0xff}.${lo >> 8}.${lo & 0xff}`;
  }
  const prefix = groups.slice(0, IPV6_PREFIX_GROUPS).map((g) => g.toString(16));
  return `${prefix.join(':')}::/64`;
}

/** Limiter key for the request's X-Forwarded-For header; same hop choice as the helper above. */
export function rateLimitKeyFromForwardedFor(header: string | null | undefined): string | null {
  return rateLimitKeyForIp(clientIpFromForwardedFor(header));
}
