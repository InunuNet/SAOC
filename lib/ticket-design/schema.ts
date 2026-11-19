import type { TokenName } from './tokens';

/**
 * ticket-design-studio (F1) — the shipped design object and its closed-enum validator. The enums
 * mirror goldens/design-schema.json exactly; nothing free-form (no hex, px, font or copy) exists.
 */
export const DESIGN_ENUMS = {
  shared: {
    accent: ['royal', 'purple-700', 'olive-700'],
    headerGround: ['royal', 'purple-700'],
    typeStep: ['sm', 'md', 'lg'],
    density: ['compact', 'standard', 'relaxed'],
    footerMark: [true, false],
  },
  email: {
    outerGround: ['gold-200', 'gold-100', 'white'],
    cardGround: ['gold-100', 'white', 'gold-200'],
    headerAlign: ['left', 'centre'],
    qrPx: [160, 200, 240],
    cardPosition: ['after-intro', 'top'],
  },
  pdf: {
    stubGround: ['gold-200', 'gold-100', 'white'],
    ruleColour: ['olive', 'royal'],
    qrMm: [50, 55, 60],
  },
} as const;

interface SharedDesign {
  accent: 'royal' | 'purple-700' | 'olive-700';
  headerGround: 'royal' | 'purple-700';
  typeStep: 'sm' | 'md' | 'lg';
  density: 'compact' | 'standard' | 'relaxed';
  footerMark: boolean;
}

export interface EmailDesign extends SharedDesign {
  outerGround: Extract<TokenName, 'gold-200' | 'gold-100' | 'white'>;
  cardGround: Extract<TokenName, 'gold-200' | 'gold-100' | 'white'>;
  headerAlign: 'left' | 'centre';
  qrPx: 160 | 200 | 240;
  cardPosition: 'after-intro' | 'top';
}

export interface PdfDesign extends SharedDesign {
  stubGround: Extract<TokenName, 'gold-200' | 'gold-100' | 'white'>;
  ruleColour: 'olive' | 'royal';
  qrMm: 50 | 55 | 60;
}

export interface ShippedDesign {
  version: 1;
  slug: string;
  email: EmailDesign;
  pdf: PdfDesign;
}

type EnumTable = Record<string, readonly (string | number | boolean)[]>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function checkBlock(name: string, block: unknown, table: EnumTable): void {
  if (!isRecord(block)) throw new Error(`design.${name} is not an object`);
  const expected = Object.keys(table).sort();
  const actual = Object.keys(block).sort();
  if (expected.join() !== actual.join()) {
    throw new Error(`design.${name} keys [${actual}] != [${expected}]`);
  }
  for (const key of expected) {
    const value = block[key];
    if (!table[key].some((allowed) => allowed === value)) {
      throw new Error(`design.${name}.${key}=${JSON.stringify(value)} is not an allowed value`);
    }
  }
}

/** Throws on any unknown key or value; returns the same object, typed, when it is valid. */
export function validateDesign(input: unknown): ShippedDesign {
  if (!isRecord(input)) throw new Error('design is not an object');
  const keys = Object.keys(input).sort().join();
  if (keys !== 'email,pdf,slug,version') throw new Error(`design top-level keys [${keys}]`);
  if (input.version !== 1) throw new Error('design.version must be 1');
  if (typeof input.slug !== 'string' || input.slug === '') {
    throw new Error('design.slug must be a non-empty string');
  }
  checkBlock('email', input.email, { ...DESIGN_ENUMS.shared, ...DESIGN_ENUMS.email });
  checkBlock('pdf', input.pdf, { ...DESIGN_ENUMS.shared, ...DESIGN_ENUMS.pdf });
  // Every key and value was checked against the closed enums above, so the shape is ShippedDesign.
  return input as unknown as ShippedDesign;
}
