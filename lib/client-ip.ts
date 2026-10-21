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
