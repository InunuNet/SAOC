import { defineConfig } from 'sanity';
import { structureTool } from 'sanity/structure';
// Vision (GROQ scratchpad) is dev-only to keep the production Studio bundle small.
// @sanity/vision is ESM-only (package.json: "type": "module", no CJS entry) -- it must be
// imported, never require()'d (see contracts/golden/sanity-vision-esm-fix/README.md).
// This static import is safe to keep at the top level: @sanity/vision's package.json
// marks its non-CSS files side-effect-free, so when the conditional below evaluates to a
// statically-false expression at production-build time, webpack's dead-branch pruning +
// tree-shaking drop the reference (and the module) from the production bundle -- the same
// bundle-size guarantee the original require()-based approach was trying (and failing) to
// provide.
import { visionTool } from '@sanity/vision';
import { schemaTypes } from './sanity/schemas';
import { structure, filterNewDocumentOptions } from './sanity/structure';

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? '';
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production';

const plugins = [
  structureTool({ structure }),
  ...(process.env.NODE_ENV === 'development' ? [visionTool()] : []),
];

export default defineConfig({
  name: 'saoc',
  title: 'South African Orchid Council',
  basePath: '/studio',
  projectId,
  dataset,
  plugins,
  schema: {
    types: schemaTypes,
  },
  document: {
    newDocumentOptions: filterNewDocumentOptions,
  },
});
