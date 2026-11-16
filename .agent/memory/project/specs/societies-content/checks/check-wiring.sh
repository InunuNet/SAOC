#!/usr/bin/env bash
# societies-content F1 — static wiring assertions. One subcommand per contract assertion; exit 0 = pass.
set -u
case "${1:-}" in
  schema-fields)
    f=sanity/schemas/documents/society.ts
    for n in listed contactEmail contactPhone committee committeeNote facebookUrl instagramUrl annualShow driveSource; do
      grep -q "name: '$n'" "$f" || { echo "society schema lacks $n"; exit 1; }
    done
    grep -q "societyCommitteeMember" sanity/schemas/index.ts || { echo "societyCommitteeMember not registered"; exit 1; }
    test -f sanity/schemas/objects/societyCommitteeMember.ts || { echo "object type file missing"; exit 1; }
    grep -Eq "initialValue: true" "$f" || { echo "listed needs initialValue: true"; exit 1; }
    ;;
  queries-filter-listed)
    for q in societyListQuery societyBySlugQuery societySlugsQuery; do
      awk "/export const $q /,/^\`\);/" sanity/queries.ts | grep -q 'listed != false' || { echo "$q does not filter listed != false"; exit 1; }
    done
    grep -q 'listed != false' scripts/refresh-llms.ts || { echo "refresh-llms society query does not filter listed"; exit 1; }
    ;;
  note-not-projected)
    for q in societyListQuery societyBySlugQuery; do
      awk "/export const $q /,/^\`\);/" sanity/queries.ts | grep -q 'committeeNote' && { echo "$q projects committeeNote"; exit 1; }
    done
    grep -rn "committeeNote" app components lib/data --include='*.ts' --include='*.tsx' && { echo "committeeNote referenced by a public surface"; exit 1; }
    exit 0
    ;;
  no-static-resurrection)
    # A hidden society must not come back through the hardcoded fallback when Sanity is configured, and a re-seed must not re-create the 19.
    for f in "app/(marketing)/societies/page.tsx" "app/(marketing)/societies/[slug]/page.tsx"; do
      grep -q "sanity/lib/client" "$f" || { echo "$f does not gate the static fallback on the configured client"; exit 1; }
    done
    grep -q "mapSocieties()" scripts/seed-sanity.ts && { echo "seed-sanity still seeds societies"; exit 1; }
    exit 0
    ;;
  no-literal-sentinel)
    grep -rn "Not supplied" app components --include='*.ts' --include='*.tsx' && { echo "sentinel text present in rendering code"; exit 1; }
    exit 0
    ;;
  no-new-visual-tokens)
    for f in components/societies/SocietyCommittee.tsx; do
      test -f "$f" || { echo "$f missing"; exit 1; }
      grep -En '#[0-9a-fA-F]{3,8}\b|rgb\(|hsl\(|font-\[' "$f" && { echo "$f introduces raw colour or font values"; exit 1; }
    done
    grep -q "SocietyCommittee" app/\(marketing\)/societies/\[slug\]/page.tsx || { echo "detail page does not render SocietyCommittee"; exit 1; }
    exit 0
    ;;
  parser-exports)
    f=lib/societies/drive-parse.ts
    for n in parseSocietiesMarkdown parseContactListMarkdown mergeSocieties CONTACT_LIST_ALIASES toDocFields DRIVE_SOURCE_TAGS; do
      grep -q "$n" "$f" || { echo "$f lacks $n"; exit 1; }
    done
    ;;
  script-safety)
    f=scripts/sync-societies-from-drive.ts
    test -f "$f" || { echo "$f missing"; exit 1; }
    grep -q "ifRevisionID" "$f" || { echo "no ifRevisionID"; exit 1; }
    grep -q "\-\-apply" "$f" || { echo "no --apply flag"; exit 1; }
    grep -q "\.tmp/sandbox/societies-content" "$f" || { echo "backup does not default to the project sandbox"; exit 1; }
    grep -Eq "\.delete\(|\.unpublish|delete:" "$f" && { echo "script deletes documents; hiding only (listed:false) is allowed"; exit 1; }
    grep -Eq "token.*console|console.*(token|TOKEN)" "$f" && { echo "script may print the token"; exit 1; }
    exit 0
    ;;
  *) echo "usage: check-wiring.sh <subcommand>"; exit 2 ;;
esac
