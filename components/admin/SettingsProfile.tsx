import { CARD_CLASS } from '@/components/admin/tokens';

export interface SettingsProfileProps {
  name: string | null;
  email: string | null;
  providerLabel: string;
  roleLines: string[];
  signOutLabel: string;
  signOutHelp: string;
  signOutControl: React.ReactNode;
}

/** Presentational profile card: every value arrives already derived from the verified token. */
export function SettingsProfile(props: SettingsProfileProps) {
  const { name, email, providerLabel, roleLines, signOutLabel, signOutHelp, signOutControl } = props;
  return (
    <section className={CARD_CLASS} aria-labelledby="settings-profile-heading">
      <h2 id="settings-profile-heading" className="font-serif text-[20px] font-semibold text-ink">
        Profile
      </h2>
      <dl className="mt-4 flex flex-col gap-4 font-sans text-[15px] text-ink">
        {name ? <Row label="Name">{name}</Row> : null}
        <Row label="Email">{email ?? '—'}</Row>
        <Row label="Sign-in provider">{providerLabel}</Row>
        <Row label="Roles and scope">
          <ul className="flex flex-col gap-1">
            {roleLines.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </Row>
        <Row label={signOutLabel}>
          <p className="mb-2 text-[13px] text-muted">{signOutHelp}</p>
          {signOutControl}
        </Row>
      </dl>
    </section>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="font-mono text-[11px] uppercase tracking-[0.1em] text-muted">{label}</dt>
      <dd className="mt-1">{children}</dd>
    </div>
  );
}
