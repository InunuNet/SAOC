import type {
  VendorRegisterFieldChangeHandler,
  VendorRegisterFormState,
} from '@/lib/vendor-register-form-payload';
import { VendorFormField } from './VendorFormField';

// Lee-Ann's 2026-10-07 source doc (F1, vendor-form-copy-20261007), "STAFF & EXHIBITOR PASSES"
// section -- a 2-column table (Day / Number of Staff), rows Setup Day/Day 1/Day 2/Day 3/
// Breakdown Day. Extracted out of VendorBoothUtilitiesFieldset.tsx, which previously rendered
// one combined per-day count field in this spot, to keep both components under this project's
// 150-line convention (see .claude/rules/coding.md). Wires onto the 5 already-validated
// staffCountSetupDay/Day1/Day2/Day3/BreakdownDay server fields (types/index.ts, lib/vendor-
// submissions.ts -- untouched by this feature). Mounted top-level in VendorRegisterForm.tsx,
// immediately after VendorBoothFieldset -- the structural assertion (check-f1-structural.sh)
// requires the mount to appear there; see this feature's handover note for the golden-prose
// ambiguity this resolves. Mirrors the source table: the "Number of Staff" column header is the
// group legend and each input's visible label is the source row's day text, verbatim.
interface VendorStaffPassesFieldsetProps {
  state: VendorRegisterFormState;
  onFieldChange: VendorRegisterFieldChangeHandler;
  disabled: boolean;
}

const legendClass = 'font-mono text-[11px] tracking-[0.16em] text-muted';

const STAFF_COUNT_FIELDS: Array<{
  key: keyof VendorRegisterFormState;
  label: string;
}> = [
  { key: 'staffCountSetupDay', label: 'Setup Day' },
  { key: 'staffCountDay1', label: 'Day 1' },
  { key: 'staffCountDay2', label: 'Day 2' },
  { key: 'staffCountDay3', label: 'Day 3' },
  { key: 'staffCountBreakdownDay', label: 'Breakdown Day' },
];

export function VendorStaffPassesFieldset({
  state,
  onFieldChange,
  disabled,
}: VendorStaffPassesFieldsetProps) {
  return (
    <fieldset id="vendor-register-staffCounts" className="space-y-3">
      <legend className={legendClass}>Number of Staff</legend>
      {STAFF_COUNT_FIELDS.map(({ key, label }) => (
        <VendorFormField
          key={key}
          fieldKey={key}
          label={label}
          htmlType="number"
          min={0}
          step={1}
          value={state[key] as string}
          onChange={(v) => onFieldChange(key, v)}
          disabled={disabled}
          required={false}
        />
      ))}
    </fieldset>
  );
}
