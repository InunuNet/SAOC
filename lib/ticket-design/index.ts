import dayVisitorSettings from './settings/day-visitor.json';
import earlyBirdSettings from './settings/early-bird.json';
import saocSymposiumSettings from './settings/saoc-symposium.json';
import saocWosaJointSettings from './settings/saoc-wosa-joint.json';
import sunsetCocktailsSettings from './settings/sunset-cocktails.json';
import vipSettings from './settings/vip.json';
import weekendPassSettings from './settings/weekend-pass.json';
import wosaConferenceSettings from './settings/wosa-conference.json';
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
  'early-bird': validateDesign(earlyBirdSettings),
  'day-visitor': validateDesign(dayVisitorSettings),
  'weekend-pass': validateDesign(weekendPassSettings),
  vip: validateDesign(vipSettings),
  'sunset-cocktails': validateDesign(sunsetCocktailsSettings),
  'saoc-symposium': validateDesign(saocSymposiumSettings),
  'wosa-conference': validateDesign(wosaConferenceSettings),
  'saoc-wosa-joint': validateDesign(saocWosaJointSettings),
};

/** The committed design for a ticket type slug; every ticket type has a settings file; an unknown slug uses the default. */
export function loadShippedDesign(slug: string | undefined): ShippedDesign {
  return (slug !== undefined && Object.hasOwn(SHIPPED, slug) && SHIPPED[slug]) || DEFAULT_DESIGN;
}
