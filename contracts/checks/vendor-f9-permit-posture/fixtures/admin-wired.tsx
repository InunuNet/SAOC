// FIXTURE — WIRED. Self-test golden for check-admin-permit-fields-rendered.mjs and
// check-admin-non-verification-note-adjacent.mjs. Must PASS both checks.
interface PermitFixtureRow {
  phytosanitaryPermitNumber?: string;
  citesPermitNumber?: string;
  foodHandlingCertificateNumber?: string;
}

function PermitDetails({ row }: { row: PermitFixtureRow }) {
  return (
    <div className="permit-block">
      <dl>
        <dt>Phytosanitary / import permit</dt>
        <dd>{row.phytosanitaryPermitNumber ?? '—'}</dd>
        <dt>CITES permit</dt>
        <dd>{row.citesPermitNumber ?? '—'}</dd>
        <dt>Food handling certificate</dt>
        <dd>{row.foodHandlingCertificateNumber ?? '—'}</dd>
      </dl>
      <p className="permit-note">
        Permit and certificate numbers are recorded as submitted and have not been verified by SAOC.
      </p>
    </div>
  );
}
