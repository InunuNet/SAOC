import type { Metadata } from 'next';

import { SHOW_TITLE } from '@/lib/show-title';
import { NOS_TITLE_DEFAULT } from '@/lib/site-metadata';
import { TICKETING_TEST_TITLE_PREFIX, isTicketingTestMode } from '@/lib/ticketing-test-mode';

// Mission committee-testing F1 -- prefixes every ticketing page title while payments are not
// live. Mounted by exactly one layout per ticketing route chain, so the prefix never doubles.
export function ticketingTestMetadata(testMode = isTicketingTestMode()): Metadata {
  if (!testMode) return {};
  return {
    title: {
      template: `${TICKETING_TEST_TITLE_PREFIX} %s | ${SHOW_TITLE}`,
      default: `${TICKETING_TEST_TITLE_PREFIX} ${NOS_TITLE_DEFAULT}`,
    },
  };
}

// Next applies a layout's title.template to child segments only, never to the page.tsx in the same
// segment. Pages that sit beside one of the ticketing layouts prefix their own title with this.
export function withTicketingTestTitle(
  metadata: Metadata,
  testMode = isTicketingTestMode()
): Metadata {
  if (!testMode || typeof metadata.title !== 'string') return metadata;
  return { ...metadata, title: { absolute: `${TICKETING_TEST_TITLE_PREFIX} ${metadata.title} | ${SHOW_TITLE}` } };
}
