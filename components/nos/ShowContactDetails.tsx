// =============================================================
// NOS — components/nos/ShowContactDetails.tsx
// Server Component. The show's address and telephone number, exactly as Lee-Ann gave them in her
// Contact document (24 Oct 2026). No committee list and no email address: her committee list is held
// (Q-D6) and the show mailbox is unconfirmed (Q-D11). Constants live in lib/show-contact.ts.
// =============================================================

import {
  SHOW_ADDRESS_LINES,
  SHOW_OFFICE_CONTACT_LINE,
  SHOW_OFFICE_PHONE,
  SHOW_OFFICE_PHONE_HREF,
} from '@/lib/show-contact';

const HEADING_ADDRESS = 'Address of the show';
const HEADING_TELEPHONE = 'Telephone number';
// The same eyebrow the aside's "Looking for something else?" heading uses (nos-structure.css).
const LABEL_CLASS = 'nos-index-eyebrow border-b border-rule pb-4';
const BODY_CLASS = 'mt-3 font-sans text-[16px] leading-[1.55] text-ink/80';

export function ShowContactDetails() {
  return (
    <div data-show-contact-details="" className="mb-12 space-y-8">
      <section>
        <h2 className={LABEL_CLASS}>{HEADING_ADDRESS}</h2>
        {SHOW_ADDRESS_LINES.map((line) => (
          <p key={line} className={BODY_CLASS}>
            {line}
          </p>
        ))}
      </section>
      <section>
        <h2 className={LABEL_CLASS}>{HEADING_TELEPHONE}</h2>
        <p className={BODY_CLASS}>
          <a href={SHOW_OFFICE_PHONE_HREF} className="text-ink underline underline-offset-2">
            {SHOW_OFFICE_PHONE}
          </a>{' '}
          - {SHOW_OFFICE_CONTACT_LINE}
        </p>
      </section>
    </div>
  );
}
