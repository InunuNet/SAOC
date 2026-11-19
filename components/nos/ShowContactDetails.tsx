// =============================================================
// NOS — components/nos/ShowContactDetails.tsx
// Server Component. The show's address, as Lee-Ann gave it in her Contact document (24 Oct 2026).
// The telephone number was removed on 19 Nov 2026 (Brad, meeting with Lee-Ann). No email address is
// printed: the show mailbox is unconfirmed (Q-D11). Constants live in lib/show-contact.ts.
// =============================================================

import { SHOW_ADDRESS_LINES } from '@/lib/show-contact';

const HEADING_ADDRESS = 'Address of the show';
// The card's sentence-case label, shared with the gateway heading (nos-structure.css).
const LABEL_CLASS = 'nos-ct-label';
// The first address line is the place's name (CT-G1: Fraunces 400, 22px); the second is the address.
const PLACE_CLASS = 'nos-ct-place';
const BODY_CLASS = 'mt-3 font-sans text-[16px] leading-[1.55] text-ink/80';

export function ShowContactDetails() {
  return (
    <div data-show-contact-details="" className="mb-12 space-y-8">
      <section>
        <h2 className={LABEL_CLASS}>{HEADING_ADDRESS}</h2>
        {SHOW_ADDRESS_LINES.map((line, index) => (
          <p key={line} className={index === 0 ? PLACE_CLASS : BODY_CLASS}>
            {line}
          </p>
        ))}
      </section>
    </div>
  );
}
