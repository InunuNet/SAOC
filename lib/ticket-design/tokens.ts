/**
 * ticket-design-studio (F1) — the closed token table. Every hex here is already in the approved
 * repo (goldens/token-allowlist.json); adding one needs Brad's instruction. Settings files hold
 * token NAMES, never a hex.
 */
export const TOKENS = {
  royal: '#211a57',
  'purple-700': '#33296f',
  'gold-200': '#f3f2d6',
  'gold-100': '#fbfaf0',
  white: '#ffffff',
  olive: '#a7a841',
  'olive-700': '#6a6829',
  ink: '#3a3654',
  muted: '#6a6780',
  'muted-email': '#55507e',
  rule: '#e3e1c9',
} as const;

export type TokenName = keyof typeof TOKENS;

/** Own-property-safe lookup: 'toString' and other prototype keys throw instead of resolving. */
export function tokenHex(name: string): string {
  if (!Object.hasOwn(TOKENS, name)) throw new Error(`unknown design token "${name}"`);
  return TOKENS[name as TokenName]; // checked as an own key of TOKENS on the line above
}

/** typeStep -> email body px (--body-sm/md/lg) and PDF text scale. */
export const TYPE_STEP_EMAIL_PX = { sm: 14, md: 16, lg: 18 } as const;
export const TYPE_STEP_PDF_SCALE = { sm: 0.875, md: 1, lg: 1.125 } as const;

/** density -> multiplier over the existing spacing constants. */
export const DENSITY_MULTIPLIER = { compact: 0.75, standard: 1, relaxed: 1.25 } as const;
