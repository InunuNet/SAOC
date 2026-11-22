import { ipv4ToHextets, parseIpv6 } from './client-ip';

/**
 * Address-free description of the X-Forwarded-For chain, for a one-off observation of how many
 * hops Firebase App Hosting adds and where its `x-fah-client-ip` header sits in the chain. The
 * result carries counts, positions and address families only, never an address. The two literals
 * are RFC 5737 documentation addresses that the prober sends itself.
 *
 * Input is bounded before any parsing: a header value longer than MAX_HEADER_CHARS is never split
 * or matched. An over-long x-forwarded-for yields hopCount 0 and no families; an over-long
 * x-fah-client-ip is treated as absent (fahPresent false). Either sets `oversize` to true.
 */
export const PROBE_FORWARDED_ADDRESS = '198.51.100.7';
export const PROBE_FAH_ADDRESS = '198.51.100.9';
export const MAX_HEADER_CHARS = 512;
/** hopFamilies keeps only the right-hand end of the chain, the part the platform writes. */
export const MAX_FAMILY_HOPS = 8;

export type HopFamily = 'v4' | 'v6' | 'other';

export interface ForwardedForShape {
  hopCount: number;
  oversize: boolean;
  fahPresent: boolean;
  fahMatchesHopFromEnd: number | null;
  probeMatchesHopFromEnd: number | null;
  fahEqualsProbe: boolean;
  /** Families of the last MAX_FAMILY_HOPS hops, in chain order. */
  hopFamilies: HopFamily[];
  realIpPresent: boolean;
}

interface HeaderReader {
  get(name: string): string | null;
}

/** Strict, linear: valid dotted IPv4 (octets 0-255) or a bare IPv6 literal, else 'other'. */
function familyOf(hop: string): HopFamily {
  if (ipv4ToHextets(hop) !== null) return 'v4';
  if (hop.includes(':') && parseIpv6(hop) !== null) return 'v6';
  return 'other';
}

/** 1-based position from the end of the last hop equal to `value`, or null. */
function positionFromEnd(hops: string[], value: string): number | null {
  if (value === '') return null;
  const index = hops.lastIndexOf(value);
  return index === -1 ? null : hops.length - index;
}

export function describeForwardedForShape(headers: HeaderReader): ForwardedForShape {
  const rawChain = headers.get('x-forwarded-for') ?? '';
  const rawFah = headers.get('x-fah-client-ip') ?? '';
  const chainOversize = rawChain.length > MAX_HEADER_CHARS;
  const fahOversize = rawFah.length > MAX_HEADER_CHARS;
  const hops = chainOversize
    ? []
    : rawChain
        .split(',')
        .map((hop) => hop.trim())
        .filter((hop) => hop !== '');
  const fah = fahOversize ? '' : rawFah.trim();
  return {
    hopCount: hops.length,
    oversize: chainOversize || fahOversize,
    fahPresent: fah !== '',
    fahMatchesHopFromEnd: positionFromEnd(hops, fah),
    probeMatchesHopFromEnd: positionFromEnd(hops, PROBE_FORWARDED_ADDRESS),
    fahEqualsProbe: fah === PROBE_FAH_ADDRESS,
    hopFamilies: hops.slice(-MAX_FAMILY_HOPS).map(familyOf),
    realIpPresent: (headers.get('x-real-ip') ?? '').trim() !== '',
  };
}

/** Counts down a fixed number of allowed log lines; once spent, tryTake stays false. */
export function createLogBudget(maxLines: number): { tryTake(): boolean } {
  let remaining = maxLines;
  return {
    tryTake(): boolean {
      if (remaining <= 0) return false;
      remaining -= 1;
      return true;
    },
  };
}
