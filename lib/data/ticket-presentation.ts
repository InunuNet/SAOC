// =============================================================
// NOS — lib/data/ticket-presentation.ts
// The static presentation of each keepsake ticket product and every fixed string of the
// approved v13 ticket design (goldens/f18b: HANDOFF.md section 2, v13-copy.json). Nothing here
// changes with stock: a product's name, date line, stub numeral and photograph are content,
// while price, state and counts come only from the view models (ticket-card-view-models.ts).
// The stub field colours and the two palette steps the theme lacks are the design's own
// values; they reach the page as CSS variables on the `.nos-theme` scope (TICKET_THEME_VARS).
// =============================================================

export type TicketProductId =
  | 'vip'
  | 'sunset'
  | 'weekend'
  | 'day'
  | 'symposium'
  | 'wosa'
  | 'workshops';

export type TicketProductKind = 'event' | 'pass' | 'programme' | 'workshop';

export interface TicketProduct {
  id: TicketProductId;
  kind: TicketProductKind;
  /** The design's own product name; the CMS ticket-type name overrides it when supplied. */
  name: string;
  when: string;
  meta: string | null;
  theme: string | null;
  numeral: string;
  caption: string;
  /** One of the five rights-cleared production photographs; null renders the field colour. */
  photo: string | null;
  /** CSS object-position of the photograph inside the stub. */
  focus: string;
  /** Name of the CSS variable that holds this product's stub field colour. */
  fieldVar: string;
  slugs: readonly string[];
  /** The other half of an early-bird pool pair ("Shared with the <partner>"). */
  partner: string | null;
  /** Workshops are priced per session. */
  each: boolean;
}

export const TICKET_PRODUCT_ORDER: readonly TicketProductId[] = [
  'vip',
  'sunset',
  'weekend',
  'day',
  'symposium',
  'wosa',
  'workshops',
];

/** The four products of the hero fan, left to right on one arc. */
export const TICKET_FAN_ORDER: readonly TicketProductId[] = ['vip', 'sunset', 'weekend', 'day'];

export const TICKET_PRODUCTS: Record<TicketProductId, TicketProduct> = {
  vip: {
    id: 'vip',
    kind: 'event',
    name: 'VIP Opening',
    when: 'Thursday 23 September',
    meta: '16h00 to 19h00',
    theme: null,
    numeral: '23',
    caption: 'Thursday',
    photo: '/images/orchid-dark.jpg',
    focus: '62% 45%',
    fieldVar: '--ticket-field-vip',
    slugs: ['vip'],
    partner: null,
    each: false,
  },
  sunset: {
    id: 'sunset',
    kind: 'event',
    name: 'Sunset Cocktails',
    when: 'Thursday 23 September',
    meta: '18h00 to 21h00',
    theme: null,
    numeral: '23',
    caption: 'Thursday',
    photo: '/images/orchid-yellow.jpg',
    focus: '45% 50%',
    fieldVar: '--ticket-field-sunset',
    slugs: ['sunset-cocktails-single'],
    partner: null,
    each: false,
  },
  weekend: {
    id: 'weekend',
    kind: 'pass',
    name: 'Weekend Pass',
    when: 'Friday 24 to Sunday 26 September',
    meta: 'Entry on all three show days',
    theme: null,
    numeral: '24',
    caption: 'to 26 Sept',
    photo: '/images/orchid-purple.jpg',
    focus: '50% 40%',
    fieldVar: '--ticket-field-weekend',
    slugs: ['weekend-pass-early-bird', 'weekend-pass'],
    partner: 'Day Pass',
    each: false,
  },
  day: {
    id: 'day',
    kind: 'pass',
    name: 'Day Pass',
    when: 'Friday, Saturday or Sunday',
    meta: 'Entry on the day you choose',
    theme: null,
    numeral: '',
    caption: '',
    photo: '/images/orchid-pink.jpg',
    focus: '50% 30%',
    fieldVar: '--ticket-field-day',
    slugs: ['early-bird', 'day-visitor'],
    partner: 'Weekend Pass',
    each: false,
  },
  symposium: {
    id: 'symposium',
    kind: 'programme',
    name: 'National Orchid Show Symposium',
    when: 'Dates to follow',
    meta: null,
    theme: 'From Wild Origins to Cultivated Excellence',
    numeral: 'XIX',
    caption: '19th Show',
    photo: null,
    focus: '50% 50%',
    fieldVar: '--ticket-field-symposium',
    slugs: ['saoc-symposium'],
    partner: null,
    each: false,
  },
  wosa: {
    id: 'wosa',
    kind: 'programme',
    name: 'WOSA Conference',
    when: 'Dates to follow',
    meta: null,
    theme: 'With Wild Orchids of Southern Africa',
    numeral: 'XIX',
    caption: '19th Show',
    photo: null,
    focus: '50% 50%',
    fieldVar: '--ticket-field-wosa',
    slugs: ['wosa-conference'],
    partner: null,
    each: false,
  },
  workshops: {
    id: 'workshops',
    kind: 'workshop',
    name: 'Workshops',
    when: 'Schedule to follow',
    meta: '10 places in each session',
    theme: null,
    numeral: '10',
    caption: 'places a session',
    photo: '/images/orchid-violet.jpg',
    focus: '40% 50%',
    fieldVar: '--ticket-field-workshops',
    slugs: ['workshops'],
    partner: null,
    each: true,
  },
};

/** The product whose early-bird pool each pass product shares (its CMS name reads "Shared with the ..."). */
export const POOL_PARTNER_IDS: Partial<Record<TicketProductId, TicketProductId>> = {
  weekend: 'day',
  day: 'weekend',
};

/** The CMS name of the pool partner of a pass product, or null when it has none or no card. */
export function partnerNameOf(
  id: TicketProductId,
  cards: Partial<Record<TicketProductId, { name: string | null }>>
): string | null {
  const partnerId = POOL_PARTNER_IDS[id];
  return partnerId ? (cards[partnerId]?.name ?? null) : null;
}

/** The ticket type slug that stands for the Workshops product card (sessions carry their own). */
export const WORKSHOPS_PRODUCT_SLUG = 'workshops';

const PRODUCT_BY_SLUG: Record<string, TicketProductId> = Object.fromEntries(
  TICKET_PRODUCT_ORDER.flatMap((id) => TICKET_PRODUCTS[id].slugs.map((slug) => [slug, id]))
);

export function productIdForSlug(slug: string): TicketProductId | null {
  return PRODUCT_BY_SLUG[slug] ?? null;
}

/** The two early-bird SKUs of one pass pair and the regular SKU that replaces each at zero. */
export const PASS_SKUS: Record<'weekend' | 'day', { earlyBird: string; regular: string }> = {
  weekend: { earlyBird: 'weekend-pass-early-bird', regular: 'weekend-pass' },
  day: { earlyBird: 'early-bird', regular: 'day-visitor' },
};

export const TICKET_EMBLEM = '/images/nos/disa-graminifolia-emblem.svg';

export const TICKET_COPY = {
  admit: 'Admit one',
  admitSession: 'One place',
  buy: 'Buy ticket',
  buyHint: 'Choose at least one ticket',
  dayPassFrom: 'Day Pass from',
  salesClosedLabel: 'Sales closed',
  salesClosedLink: 'Be the first to know',
  chooseSession: 'Choose a session',
  fewLeft: 'Few left',
  soldOutStamp: 'Sold out',
  soldOutLine: 'This ticket has sold out.',
  pricePending: 'Price to follow',
  chip: 'To be confirmed',
  pendingNote: 'The Council has not confirmed this price yet. Booking opens once it has.',
  earlyBirdEnded: 'Early bird ended',
  earlyBirdSoldOut: 'Early bird sold out',
  earlyBirdPriceStruck: 'Early-bird price',
  sharedWith: 'Shared with the',
  chooseDay: 'Choose a day',
  stepperLabelSuffix: 'quantity',
  fewer: 'One fewer',
  more: 'One more',
  poolTitle: 'Early-bird tickets left',
  poolTitleNoCount: 'Early-bird tickets',
  unconfirmed: 'Not yet confirmed',
  poolOutTitle: 'Early bird sold out',
  sessionNotOpen: 'Booking for this session is not open yet.',
  timeTba: 'Time to be announced',
  each: 'each',
  workshopStubCaption: 'Workshop',
  places: 'places',
  presenterWith: 'With',
  sections: {
    thursday: 'Thursday evening',
    passes: 'Show passes',
    programme: 'Programme',
    sessions: 'Workshop sessions',
  },
  beforeYouVisit: 'Before you visit',
} as const;

/** The pool wording quotes the real stored total, never the design's sample 500 (R7). */
export function poolText(total: number): string {
  return `One pool of ${total} early-bird tickets is shared by the Weekend Pass and the Day Pass. The early bird ends when the pool sells out.`;
}

export const POOL_TEXT_NO_COUNT =
  'One pool of early-bird tickets is shared by the Weekend Pass and the Day Pass. The early bird ends when the pool sells out.';

export const POOL_OUT_TEXT_NO_COUNT =
  'All early-bird tickets, shared by the Weekend Pass and the Day Pass, have sold. Both passes are now at their normal price.';

export function poolOutText(total: number): string {
  return `All ${total} early-bird tickets, shared by the Weekend Pass and the Day Pass, have sold. Both passes are now at their normal price.`;
}

/** The "Before you visit" destinations of the hub masthead (labels come from nav-config). */
export const BEFORE_YOU_VISIT_HREFS: readonly string[] = [
  '/national-show/about',
  '/national-show/what-to-expect',
  '/national-show/plan-your-visit',
  '/national-show/faq',
];

/**
 * CSS variables the keepsake tickets read from the `.nos-theme` scope: the seven stub field
 * colours of the design, plus the two palette steps (royal 600, olive 700) the theme does not
 * declare. Applied as an inline style on the scope element (NosThemeScope).
 */
export const TICKET_THEME_VARS: Record<string, string> = {
  '--ticket-field-vip': '#0B0A14',
  '--ticket-field-sunset': '#7E3F97',
  '--ticket-field-weekend': '#211A57',
  '--ticket-field-day': '#7F7D33',
  '--ticket-field-symposium': '#4A3D8C',
  '--ticket-field-wosa': '#6A6829',
  '--ticket-field-workshops': '#33296F',
  '--primary-600': '#4A3D8C',
  '--olive-700': '#6A6829',
};

// The products whose card name links to the page that describes them.
export const TICKET_DETAIL_HREFS: Partial<Record<TicketProductId, string>> = {
  symposium: '/national-show/symposium',
  wosa: '/national-show/wosa-conference',
};
