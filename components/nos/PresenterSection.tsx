import Link from 'next/link';

import { GuestRoleFilter } from '@/components/nos/PresenterGrid';
import { TICKET_PRODUCTS } from '@/lib/data/ticket-presentation';
import type { GuestProfile, PresenterEvent } from '@/lib/view-models/load-presenters';
import { parseBio } from '@/lib/view-models/presenter-bio';
import { orderPresenters } from '@/lib/view-models/presenter-order';

// PR-1 (NOS Design, 2026-10-25): ONE editorial profile for every guest, on /international-guests,
// /symposium and /wosa-conference. Never a card grid. The portrait sits left at 320 and is shown only
// when its source is at least twice that wide (lib/view-models/load-presenters.ts); below that the
// head and text keep column 2 and no placeholder tile stands in. Country, organisation and the event
// a guest appears at render only when they have a value: there is no fallback and nothing is inferred.

type HeadingLevel = 2 | 3;

const EVENTS: Readonly<
  Record<PresenterEvent, { label: string; href: string; product: 'symposium' | 'wosa' }>
> = {
  'saoc-symposium': { label: 'Symposium', href: '/symposium', product: 'symposium' },
  'wosa-conference': { label: 'WOSA Conference', href: '/wosa-conference', product: 'wosa' },
};

function Portrait({ profile }: { profile: GuestProfile }) {
  const { portrait } = profile;
  if (!portrait) return null;
  return (
    <div data-guest-portrait="" className="nos-pr-photo">
      {/* eslint-disable-next-line @next/next/no-img-element -- Sanity CDN crop, sized by the 320px box */}
      <img
        src={portrait.src}
        srcSet={portrait.srcSet}
        sizes="(max-width: 767px) 132px, 320px"
        alt={profile.name}
        width={portrait.width}
        height={portrait.height}
        loading="lazy"
      />
    </div>
  );
}

function Facts({ profile, showAppearing }: { profile: GuestProfile; showAppearing: boolean }) {
  const event = showAppearing && profile.event ? EVENTS[profile.event] : null;
  const cells = [
    profile.country ? (
      <div key="country">
        <dt>Country</dt>
        <dd>{profile.country}</dd>
      </div>
    ) : null,
    profile.organisation ? (
      <div key="organisation">
        <dt>Organisation</dt>
        <dd>{profile.organisation}</dd>
      </div>
    ) : null,
    event ? (
      <div key="appearing">
        <dt>Appearing</dt>
        <dd>
          <Link href={event.href}>{event.label}</Link>
          <span className="when">{TICKET_PRODUCTS[event.product].when}</span>
        </dd>
      </div>
    ) : null,
  ].filter(Boolean);

  return cells.length > 0 ? <dl className="nos-pr-facts">{cells}</dl> : null;
}

function Bio({ profile }: { profile: GuestProfile }) {
  const blocks = parseBio(profile.bio);
  const [lead, ...rest] = blocks;
  if (!lead) return null;

  return (
    <>
      {lead.kind === 'p' ? <p className="nos-pr-lead">{lead.text}</p> : null}
      {rest.length > 0 ? (
        <details className="nos-pr-more">
          <summary>
            Read full bio<span className="sr-only"> of {profile.name}</span>
          </summary>
          <div className="nos-pr-rest">
            {rest.map((block, index) =>
              block.kind === 'p' ? (
                <p key={index}>{block.text}</p>
              ) : (
                <ul key={index}>
                  {block.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ),
            )}
          </div>
        </details>
      ) : null}
    </>
  );
}

export function PresenterProfile({
  profile,
  level,
  showAppearing,
}: {
  profile: GuestProfile;
  level: HeadingLevel;
  showAppearing: boolean;
}) {
  const Heading = level === 2 ? 'h2' : 'h3';
  const headingId = `guest-${profile.id}`;
  return (
    <article
      data-guest-profile=""
      data-presenter-id={profile.id}
      data-role={profile.kind}
      className={profile.portrait ? 'nos-pr' : 'nos-pr no-photo'}
      aria-labelledby={headingId}
    >
      <Portrait profile={profile} />
      <header className="nos-pr-head">
        <p data-guest-role="" className="nos-pr-role">
          {profile.kind}
        </p>
        <Heading id={headingId}>{profile.name}</Heading>
        {profile.title ? <p className="nos-pr-title">{profile.title}</p> : null}
      </header>
      <div className="nos-pr-text">
        <Facts profile={profile} showAppearing={showAppearing} />
        <Bio profile={profile} />
      </div>
    </article>
  );
}

/** The guests in order (a set `order` wins, then the sample sequence by _id, then the rest), one profile each. */
export function PresenterList({
  profiles,
  level,
  showAppearing,
}: {
  profiles: readonly GuestProfile[];
  level: HeadingLevel;
  showAppearing: boolean;
}) {
  const ordered = orderPresenters(profiles);
  const roles = [...new Set(ordered.map((profile) => profile.kind))];
  return (
    <GuestRoleFilter roles={roles}>
      <div className="nos-pr-list">
        {ordered.map((profile) => (
          <PresenterProfile
            key={profile.id}
            profile={profile}
            level={level}
            showAppearing={showAppearing}
          />
        ))}
      </div>
    </GuestRoleFilter>
  );
}

const PRESENTERS_HEADING = 'Presenters';

/** The event pages' section: h2 "Presenters" over the shared profiles, names as h3. Nothing without presenters. */
export function PresenterSection({ presenters }: { presenters: readonly GuestProfile[] }) {
  if (presenters.length === 0) return null;
  return (
    <section aria-labelledby="presenters-h">
      <header className="nos-pr-section-head">
        <h2 id="presenters-h">{PRESENTERS_HEADING}</h2>
      </header>
      <PresenterList profiles={presenters} level={3} showAppearing={false} />
    </section>
  );
}
