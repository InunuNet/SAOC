import vipSettings from './settings/vip.json';
import { validateDesign, type ShippedDesign } from './schema';

export { validateDesign, validateEmailDesign } from './schema';
export type { EmailDesign, PdfDesign, ShippedDesign } from './schema';

/** The values that reproduce the look of the renderers before the studio existed. */
export const DEFAULT_DESIGN: ShippedDesign = validateDesign({
  version: 1,
  slug: 'default',
  email: {
    accent: 'royal',
    headerGround: 'royal',
    typeStep: 'md',
    density: 'standard',
    footerMark: true,
    outerGround: 'gold-200',
    cardGround: 'gold-100',
    headerAlign: 'left',
    qrPx: 200,
    cardPosition: 'after-intro',
  },
  pdf: {
    accent: 'royal',
    headerGround: 'royal',
    typeStep: 'md',
    density: 'standard',
    footerMark: true,
    stubGround: 'gold-200',
    ruleColour: 'olive',
    qrMm: 55,
  },
});

// Static imports, validated at module load: a bad committed file fails the build, not a send.
const SHIPPED: Record<string, ShippedDesign> = {
  vip: validateDesign(vipSettings),
};

/** The committed design for a ticket type slug; types without a settings file use the default. */
export function loadShippedDesign(slug: string | undefined): ShippedDesign {
  return (slug !== undefined && Object.hasOwn(SHIPPED, slug) && SHIPPED[slug]) || DEFAULT_DESIGN;
}
