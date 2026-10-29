// lib/view-models/load-presenters.ts
//
// F6 (conference-workshop-tickets, M4) — server-side loader for the presenters. See
// .agent/memory/project/specs/conference-workshop-tickets/goldens/f3-ui-render-states.golden.md
// §2. GROQ-only; no Firestore/Firebase Admin import — a presenter is pure Sanity content,
// no capacity/pricing to count. Returns an empty array (never throws) when none are seeded
// — the real, current state today — leaving how to render that to the caller.
//
// nos-content-standard (PR-1 / IG-G1): every loader returns the one GuestProfile shape the shared
// profile renders (components/nos/PresenterSection.tsx), whether the guest is a conference presenter
// or an international nursery.
// Relative import with an explicit `.ts` extension — see load-ticket-card.ts's own header
// comment for why (this feature's contracts/checks/*.mjs scripts load this file via a bare
// tsx/esm/api register(), where `@/` alias specifiers never resolve).
import { sanityFetch } from '../../sanity/lib/fetch.ts';

import { PRESENTER_PHOTO_CROPS } from './presenter-photo.ts';

export type PresenterEvent = 'saoc-symposium' | 'wosa-conference';
export type GuestKind = 'Speaker' | 'Exhibitor';

/** One responsive portrait: a 4:5 crop at three widths, never wider than the source it is cut from. */
export interface GuestPortrait {
  src: string;
  srcSet: string;
  width: number;
  height: number;
}

export interface GuestProfile {
  id: string; // Sanity document _id
  name: string;
  kind: GuestKind;
  title: string | null; // the record's own title line, e.g. "Manager, Breeder, Operations Director"
  country: string | null;
  organisation: string | null;
  bio: string | null; // raw text, parsed by the renderer
  portrait: GuestPortrait | null; // null when there is no photo, or the source is under 2x the box
  event: PresenterEvent | null; // the event a presenter appears at; null for an exhibitor
  order: number | null; // null means "Lee-Ann has not set it"
}

interface SanityPresenterDoc {
  _id: string;
  name: string;
  role: string | null;
  bio: string | null;
  country: string | null;
  organisation: string | null;
  photoUrl: string | null;
  photoAssetRef: string | null;
  event: PresenterEvent;
  order: number | null;
}

interface SanityNurseryDoc {
  _id: string;
  name: string;
  country: string | null;
  bio: string | null;
  history: string | null;
}

const PRESENTER_FIELDS = `
  _id,
  name,
  role,
  bio,
  country,
  organisation,
  "photoUrl": photo.asset->url,
  "photoAssetRef": photo.asset._ref,
  event,
  order
`;

const PRESENTERS_BY_EVENT_QUERY = `
  *[_type == "conferencePresenter" && event == $event] | order(order asc) {${PRESENTER_FIELDS}}
`;

// IG-G1: every profile with a country set and not South Africa, whatever its type. No country, no listing.
const INTERNATIONAL_PRESENTERS_QUERY = `
  *[_type == "conferencePresenter" && defined(country) && country != "South Africa"] | order(order asc) {${PRESENTER_FIELDS}}
`;

const INTERNATIONAL_NURSERIES_QUERY = `
  *[_type == "vendorNursery" && defined(country) && country != "South Africa"] | order(name asc) {
    _id,
    name,
    country,
    bio,
    history
  }
`;

// PR-1: the portrait box is 320 CSS px wide, so a photo is shown only when its source is at least 2x that.
const PORTRAIT_WIDTHS = [320, 640, 960] as const;
const MIN_SOURCE_WIDTH = 640;
const ASPECT_WIDTH = 4;
const ASPECT_HEIGHT = 5;
const ASSET_DIMENSIONS = /-(\d+)x(\d+)-[a-z]+$/;

interface CropRect {
  x0: number;
  y0: number;
  width: number;
  height: number;
}

function cropRectFor(assetRef: string): CropRect | null {
  const known = PRESENTER_PHOTO_CROPS[assetRef];
  if (known) {
    return { x0: known.x0, y0: known.y0, width: known.x1 - known.x0, height: known.y1 - known.y0 };
  }
  // A photo with no hand-set crop: the widest 4:5 rectangle, centred across and kept to the top.
  const dimensions = ASSET_DIMENSIONS.exec(assetRef);
  if (!dimensions) return null;
  const sourceWidth = Number(dimensions[1]);
  const sourceHeight = Number(dimensions[2]);
  const width = Math.min(sourceWidth, Math.floor((sourceHeight * ASPECT_WIDTH) / ASPECT_HEIGHT));
  const height = Math.floor((width * ASPECT_HEIGHT) / ASPECT_WIDTH);
  return { x0: Math.floor((sourceWidth - width) / 2), y0: 0, width, height };
}

function portraitHeight(width: number): number {
  return Math.round((width * ASPECT_HEIGHT) / ASPECT_WIDTH);
}

/** The srcset for a presenter photo, or null under the P1 rule (source narrower than 640px, or no photo). */
export function portraitFor(url: string | null, assetRef: string | null): GuestPortrait | null {
  if (!url || !assetRef) return null;
  const crop = cropRectFor(assetRef);
  if (!crop || crop.width < MIN_SOURCE_WIDTH) return null;

  const rect = `rect=${crop.x0},${crop.y0},${crop.width},${crop.height}`;
  const candidate = (width: number) =>
    `${url}?${rect}&w=${width}&h=${portraitHeight(width)}&auto=format`;
  const widths = PORTRAIT_WIDTHS.filter((width) => width <= crop.width);
  const largest = widths[widths.length - 1];
  return {
    src: candidate(largest),
    srcSet: widths.map((width) => `${candidate(width)} ${width}w`).join(', '),
    width: largest,
    height: portraitHeight(largest),
  };
}

function profileOfPresenter(doc: SanityPresenterDoc): GuestProfile {
  return {
    id: doc._id,
    name: doc.name,
    kind: 'Speaker',
    title: doc.role ?? null,
    country: doc.country ? doc.country : null,
    organisation: doc.organisation ? doc.organisation : null,
    bio: doc.bio ?? null,
    portrait: portraitFor(doc.photoUrl, doc.photoAssetRef),
    event: doc.event,
    order: doc.order ?? null,
  };
}

function profileOfNursery(doc: SanityNurseryDoc): GuestProfile {
  return {
    id: doc._id,
    name: doc.name,
    kind: 'Exhibitor',
    title: null,
    country: doc.country ? doc.country : null,
    organisation: null,
    bio: doc.bio ?? doc.history ?? null,
    portrait: null,
    event: null,
    order: null,
  };
}

// A30 (added 2026-10-07, Codex finding, relayed by team-lead): a Sanity failure here must never
// throw past this boundary — the pages that call this have nothing to do with ticket purchasing and
// must never 500 for unrendered presenter data. Logged, then an empty array, never a rethrow and
// never a silent swallow with no log.
const PRESENTER_TAGS = ['conferencePresenter', 'vendorNursery', 'sanity'];

async function fetchDocs<T>(query: string, params: Record<string, string>): Promise<T[]> {
  try {
    return (
      (await sanityFetch<T[]>({
        query,
        params,
        tags: PRESENTER_TAGS,
        propagateErrors: true,
      })) ?? []
    );
  } catch (error) {
    console.error('[load-presenters] sanityFetch failed:', error);
    return [];
  }
}

export async function loadPresenterViewModels(event: PresenterEvent): Promise<GuestProfile[]> {
  const docs = await fetchDocs<SanityPresenterDoc>(PRESENTERS_BY_EVENT_QUERY, { event });
  return docs.map(profileOfPresenter);
}

/** Every international guest: presenters first (in their own order), then nurseries by name. */
export async function loadInternationalGuests(): Promise<GuestProfile[]> {
  const [presenters, nurseries] = await Promise.all([
    fetchDocs<SanityPresenterDoc>(INTERNATIONAL_PRESENTERS_QUERY, {}),
    fetchDocs<SanityNurseryDoc>(INTERNATIONAL_NURSERIES_QUERY, {}),
  ]);
  return [...presenters.map(profileOfPresenter), ...nurseries.map(profileOfNursery)];
}
