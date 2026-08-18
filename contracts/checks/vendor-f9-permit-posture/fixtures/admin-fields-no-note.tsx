// FIXTURE — fields present, note ABSENT entirely. Self-test golden for
// check-admin-non-verification-note-adjacent.mjs: must FAIL naming the missing-note failure
// (and must PASS check-admin-permit-fields-rendered.mjs, since the fields ARE rendered).
interface PermitFixtureRow {
  phytosanitaryPermitNumber?: string;
  citesPermitNumber?: string;
  foodHandlingCertificateNumber?: string;
}

function PermitDetails({ row }: { row: PermitFixtureRow }) {
  return (
    <dl>
      <dt>Phytosanitary / import permit</dt>
      <dd>{row.phytosanitaryPermitNumber ?? '—'}</dd>
      <dt>CITES permit</dt>
      <dd>{row.citesPermitNumber ?? '—'}</dd>
      <dt>Food handling certificate</dt>
      <dd>{row.foodHandlingCertificateNumber ?? '—'}</dd>
    </dl>
  );
}
