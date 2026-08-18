#!/usr/bin/env bash
# A10b -- this contract's own TypeScript fixtures/checks must be typed with no `any`, per the
# project rule (see coding.md) and the specific incident this contract was warned about
# ("lint must stay 0 errors... your fixtures too — typed, no any; this burned us today"). Scans
# every .ts/.mts file under this contract's checks directory (the .mjs check scripts are plain
# JS and not subject to strict typing, but any .ts fixture must be).
#
# Run as: bash contracts/checks/vendor-form-ui/check-no-any-in-fixtures.sh

set -euo pipefail

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

failures=0

while IFS= read -r -d '' file; do
  if grep -nE '(:\s*any\b|<any>|\bas any\b)' "$file"; then
    echo "FAIL: $file uses 'any'"
    failures=$((failures + 1))
  fi
done < <(find . -name '*.ts' -print0)

if [[ $failures -gt 0 ]]; then
  echo ""
  echo "$failures file(s) failed."
  exit 1
fi

echo "PASS: no 'any' in this contract's TypeScript fixtures."
exit 0
