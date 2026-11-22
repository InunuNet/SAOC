/**
 * Address-free description of the X-Forwarded-For chain, for a one-off observation of how many
 * hops Firebase App Hosting adds and where its `x-fah-client-ip` header sits in the chain. The
 * result carries counts, positions and address families only, never an address. The two literals
 * are RFC 5737 documentation addresses that the prober sends itself.
 */
export const PROBE_FORWARDED_ADDRESS = '198.51.100.7';
export const PROBE_FAH_ADDRESS = '198.51.100.9';

export type HopFamily = 'v4' | 'v6' | 'other';

export interface ForwardedForShape {
  hopCount: number;
  fahPresent: boolean;
  fahMatchesHopFromEnd: number | null;
  probeMatchesHopFromEnd: number | null;
  fahEqualsProbe: boolean;
  hopFamilies: HopFamily[];
  realIpPresent: boolean;
}

interface HeaderReader {
  get(name: string): string | null;
}

const IPV4_PATTERN = /^\d{1,3}(\.\d{1,3}){3}$/;
const IPV6_PATTERN = /^[0-9a-f:.]*:[0-9a-f:.]*$/i;

function familyOf(hop: string): HopFamily {
  if (IPV4_PATTERN.test(hop)) return 'v4';
  if (IPV6_PATTERN.test(hop)) return 'v6';
  return 'other';
}

/** 1-based position from the end of the last hop equal to `value`, or null. */
function positionFromEnd(hops: string[], value: string): number | null {
  if (value === '') return null;
  const index = hops.lastIndexOf(value);
  return index === -1 ? null : hops.length - index;
}

export function describeForwardedForShape(headers: HeaderReader): ForwardedForShape {
  const hops = (headers.get('x-forwarded-for') ?? '')
    .split(',')
    .map((hop) => hop.trim())
    .filter((hop) => hop !== '');
  const fah = (headers.get('x-fah-client-ip') ?? '').trim();
  return {
    hopCount: hops.length,
    fahPresent: fah !== '',
    fahMatchesHopFromEnd: positionFromEnd(hops, fah),
    probeMatchesHopFromEnd: positionFromEnd(hops, PROBE_FORWARDED_ADDRESS),
    fahEqualsProbe: fah === PROBE_FAH_ADDRESS,
    hopFamilies: hops.map(familyOf),
    realIpPresent: (headers.get('x-real-ip') ?? '').trim() !== '',
  };
}
