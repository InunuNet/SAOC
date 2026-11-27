// lib/site-routes.ts
// Which public paths belong to which site. proxy.ts routes by these sets (a SAOC-hosted path asked
// for on the NOS host redirects to SAOC, a show path asked for on SAOC redirects to NOS), and
// lib/link-target.ts reads the same sets to tell a cross-site link from a same-site one, so the
// two never disagree. Pure and edge-safe.
import { NOS_INTERNAL_PREFIX } from './nos-paths.ts';

export const MOI_PATH = '/memorandum-of-incorporation';
export const PLANT_ENTRY_PATH = '/plant-entry';

// SAOC-hosted trees: asked for on the NOS host they redirect to the SAOC origin.
export const SAOC_ONLY_EXACT: ReadonlySet<string> = new Set<string>(['/members', MOI_PATH, '/judging']);
export const SAOC_ONLY_PREFIXES: readonly string[] = ['/societies', '/events'];

// What the SAOC host hands to the NOS origin.
// /faq and /plant-entry are NOS-only pages that beta used to 404 on; they 308 like /tickets, query kept.
export const SHOW_PREFIXES: readonly string[] = [NOS_INTERNAL_PREFIX, '/tickets', '/vsp', '/faq', PLANT_ENTRY_PATH];

export function isUnder(pathname: string, base: string): boolean {
  return pathname === base || pathname.startsWith(`${base}/`);
}

export function isUnderAny(pathname: string, bases: readonly string[]): boolean {
  return bases.some((base) => isUnder(pathname, base));
}
