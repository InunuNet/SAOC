// FIXTURE — UNWIRED (no permit fields at all, no note). Self-test golden: check-admin-permit
// -fields-rendered.mjs and check-admin-non-verification-note-adjacent.mjs must both FAIL and
// name the missing-fields failure.
function Row({ row }: { row: any }) {
  return (
    <tr>
      <td>{row.businessName}</td>
      <td>{row.contactPersonName}</td>
      <td>{row.status}</td>
    </tr>
  );
}
