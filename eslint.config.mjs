// ESLint flat config for Next.js 16.
// eslint-config-next 16.x ships native flat-config exports (`eslint-config-next/core-web-vitals`,
// `eslint-config-next/typescript`) — FlatCompat is no longer needed to consume it (that shim
// was only required for Next 15.5's legacy shareable-config format; using it against the 16.x
// native flat config produced a circular-structure crash).
// `eslint-config-prettier` is applied last to disable stylistic rules that would otherwise
// conflict with Prettier formatting.

import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
import prettierConfig from 'eslint-config-prettier';

const config = [
  {
    ignores: ['.next/**', '**/.next/**', 'node_modules/**', 'public/**', 'next-env.d.ts', 'design/**', '.claude/**', '.claude/worktrees/**', '.firebase/**', 'Old SAOC Website Backup/**', '.agent/**', '.golden/**'],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  prettierConfig,
  {
    files: ['**/*.{js,mjs,cjs,jsx,ts,tsx}'],
    rules: {},
  },
];

export default config;
