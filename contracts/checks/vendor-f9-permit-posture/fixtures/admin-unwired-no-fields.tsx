// FIXTURE — UNWIRED (no permit fields at all, no note). Self-test golden: check-admin-permit
// -fields-rendered.mjs and check-admin-non-verification-note-adjacent.mjs must both FAIL and
// name the missing-fields failure.
interface UnwiredFixtureRow {
  businessName: string;
  contactPersonName: string;
  status: string;
}

function Row({ row }: { row: UnwiredFixtureRow }) {
  return (
    <tr>
      <td>{row.businessName}</td>
      <td>{row.contactPersonName}</td>
      <td>{row.status}</td>
    </tr>
  );
}
