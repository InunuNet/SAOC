// F6(b) wiring: the show reference reaches buildHubCards from every caller, and the hub query selects it.
//   - sanity/queries.ts activeTicketTypesByCategoryQuery selects `show`
//   - HubCmsTicketType carries `show`, BuildHubCardsInput carries `activeShowId`, buildHubCards filters with
//     ticketTypeMatchesActiveShow (not a second copy of the rule)
//   - both callers (the hub loader and the National Show page's JSON-LD) pass activeShowId, resolved with
//     resolveActiveShow from the active-show query the page already uses elsewhere
// Run as: node contracts/checks/polish-wave-2-2026-10-25/f6-onsale-static.mjs   (POLISH_ROOT optional)
import { finish, read } from './_lib.mjs';

const failures = [];
const q = read('sanity/queries.ts');
const hubQuery = q.match(/export const activeTicketTypesByCategoryQuery = defineQuery\(`([\s\S]*?)`\)/);
if (!hubQuery) failures.push('activeTicketTypesByCategoryQuery not found');
else if (!/^\s*show,?\s*$/m.test(hubQuery[1])) failures.push('activeTicketTypesByCategoryQuery does not select `show`');

const src = read('lib/data/ticket-hub-source.ts');
if (!/interface HubCmsTicketType\s*\{[^}]*\bshow\?:/.test(src)) failures.push('HubCmsTicketType has no `show?` field');
if (!/interface BuildHubCardsInput\s*\{[^}]*\bactiveShowId:\s*string \| null/.test(src)) failures.push('BuildHubCardsInput has no `activeShowId: string | null`');
if (!/ticketTypeMatchesActiveShow/.test(src)) failures.push('buildHubCards does not use ticketTypeMatchesActiveShow from @/lib/ticket-on-sale');

const loader = read('lib/data/admission-availability.ts');
if (!/buildHubCards\(\{[\s\S]*?activeShowId/.test(loader)) failures.push('loadTicketCardViewModels does not pass activeShowId to buildHubCards');

const page = read('app/(nos)/national-show/page.tsx');
if (!/buildHubCards\(\{[\s\S]*?activeShowId/.test(page)) failures.push('buildShowOffers does not pass activeShowId to buildHubCards');
if (!/resolveActiveShow/.test(page) || !/activeShowWindowQuery/.test(page)) failures.push('the National Show page does not resolve the active show (resolveActiveShow over activeShowWindowQuery)');
if (/^import[^\n]*firebase-admin/m.test(page)) failures.push('the prerendered National Show page must not import firebase-admin');
finish('f6-onsale-static', failures);
