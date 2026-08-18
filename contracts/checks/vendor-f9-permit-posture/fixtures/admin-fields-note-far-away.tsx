// FIXTURE — fields present, note text present SOMEWHERE in the file but not co-located with
// the permit fields (e.g. a stray comment near the top). Self-test golden for
// check-admin-non-verification-note-adjacent.mjs: must FAIL naming the not-adjacent failure
// (and must PASS check-admin-permit-fields-rendered.mjs).

// unrelated note, 40+ lines away from the fields it should sit beside:
// Permit and certificate numbers are recorded as submitted and have not been verified by SAOC.
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
//
function PermitDetails({ row }: { row: any }) {
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
