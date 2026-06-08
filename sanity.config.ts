import { defineConfig } from 'sanity';
import { structureTool } from 'sanity/structure';
import { schemaTypes } from './sanity/schemas';

const projectId = process.env.NEXT_PUBLIC_SANITY_PROJECT_ID ?? '';
const dataset = process.env.NEXT_PUBLIC_SANITY_DATASET ?? 'production';

const plugins = [structureTool()];

if (process.env.NODE_ENV === 'development') {
  // Vision (GROQ scratchpad) is dev-only to keep the production Studio bundle small.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { visionTool } = require('@sanity/vision');
  plugins.push(visionTool());
}

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
});
