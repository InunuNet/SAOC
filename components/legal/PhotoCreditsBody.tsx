import { PHOTO_CREDITS, type PhotoCredit } from '@/lib/data/photo-credits';

function isCommonsCredit(
  credit: PhotoCredit,
): credit is PhotoCredit & { licence: string; licenceUrl: string; sourceUrl: string } {
  return credit.licence !== null && credit.licenceUrl !== null && credit.sourceUrl !== null;
}

export function PhotoCreditsBody() {
  const commonsCredits = PHOTO_CREDITS.filter(isCommonsCredit);
  const hasHendrikCredits = PHOTO_CREDITS.some((credit) => credit.author === 'Hendrik Schoeman');
  const linkClass = 'text-ink underline underline-offset-2';

  return (
    <div className="doc-prose">
      <ul className="list-disc space-y-2 pl-5">
        {commonsCredits.map((credit) => (
          <li key={credit.image}>
            {credit.author},{' '}
            <a className={linkClass} href={credit.licenceUrl}>
              {credit.licence}
            </a>
            ,{' '}
            <a className={linkClass} href={credit.sourceUrl}>
              Wikimedia Commons
            </a>
            {credit.changed ? ' · cropped' : null}
          </li>
        ))}
      </ul>
      {hasHendrikCredits ? <p>Other photographs: Hendrik Schoeman.</p> : null}
    </div>
  );
}
