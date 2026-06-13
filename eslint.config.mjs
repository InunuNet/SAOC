// ESLint 9 flat config for Next.js 15.5
// Uses FlatCompat to consume the legacy `eslint-config-next` shareable config
// (Next 15.5 does not yet ship a native flat-config export).
// `eslint-config-prettier` is applied last to disable stylistic rules that
// would otherwise conflict with Prettier formatting.

import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const config = [
  {
    ignores: ['.next/**', 'node_modules/**', 'public/**', 'next-env.d.ts', 'design/**', '.claude/**'],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  ...compat.extends('prettier'),
  {
    files: ['**/*.{js,mjs,cjs,jsx,ts,tsx}'],
    rules: {},
  },
];

export default config;
