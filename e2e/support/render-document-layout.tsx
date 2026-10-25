// =============================================================
// SAOC — e2e/support/render-document-layout.tsx
// Server-renders DocumentLayout with a content aside for the props given as JSON in argv[2] and
// prints the markup. Run with tsx: Playwright's own transform wraps JSX for component testing,
// so the markup tests render out of process. `links: true` puts one link in the aside and one in
// the body, for the focus-order test; it is not a DocumentLayout prop.
// =============================================================
import { renderToStaticMarkup } from 'react-dom/server';

import { DocumentLayout } from '@/components/ui/DocumentLayout';

const { links = false, ...props } = JSON.parse(process.argv[2] ?? '{}') as {
  links?: boolean;
  asideFirst?: boolean;
  asideBare?: boolean;
};
const aside = links ? <a href="#aside-link">aside</a> : <p>aside</p>;
const body = links ? <a href="#body-link">body</a> : 'body';
process.stdout.write(
  renderToStaticMarkup(
    <DocumentLayout aside={aside} {...props}>
      {body}
    </DocumentLayout>
  )
);
