import { validateDesign, type ShippedDesign } from './index';
import { isStudioPilotSlug } from './studio-samples';

/** Reads a studio POST body ({ design }) and returns the validated design; throws on anything else. */
export async function readStudioDesign(request: Request): Promise<ShippedDesign> {
  const body: unknown = await request.json();
  if (typeof body !== 'object' || body === null || !('design' in body)) {
    throw new Error('body must be { design }');
  }
  const design = validateDesign(body.design);
  if (!isStudioPilotSlug(design.slug)) {
    throw new Error(`ticket type "${design.slug}" is not in the studio pilot`);
  }
  return design;
}
