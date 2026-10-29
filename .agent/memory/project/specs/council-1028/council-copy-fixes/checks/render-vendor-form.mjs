// Server-renders the vendor registration form (all fieldsets) to static HTML on stdout. Run through `pnpm exec tsx`. The live route is behind a
// vendor code, so the check renders the same component the gated page renders. Reads nothing, writes nothing.
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

const { VendorRegisterForm } = await import(pathToFileURL(resolve('components/vendors/VendorRegisterForm.tsx')).href);
process.stdout.write(renderToStaticMarkup(createElement(VendorRegisterForm)));
