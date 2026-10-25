// =============================================================
// SAOC — e2e/support/render-document-layout.tsx
// Server-renders DocumentLayout with a content aside for the props given as JSON in argv[2] and
// prints the markup. Run with tsx: Playwright's own transform wraps JSX for component testing,
// so the markup tests render out of process.
// =============================================================
import { renderToStaticMarkup } from 'react-dom/server';

import { DocumentLayout } from '@/components/ui/DocumentLayout';

const props = JSON.parse(process.argv[2] ?? '{}') as { asideFirst?: boolean; asideBare?: boolean };
process.stdout.write(
  renderToStaticMarkup(
    <DocumentLayout aside={<p>aside</p>} {...props}>
      body
    </DocumentLayout>,
  ),
);
