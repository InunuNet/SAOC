import {
  isAdjacentBoothVendorNameFieldApplicable,
  type VendorRegisterFieldChangeHandler,
  type VendorRegisterFormState,
} from '@/lib/vendor-register-form-payload';
import { VendorFormField } from './VendorFormField';
import { VendorRadioGroupField } from './VendorRadioGroupField';
import { VendorBooleanRadioField } from './VendorBooleanRadioField';

// Booth type/position/table/chair fields, extracted out of VendorBoothFieldset.tsx to keep
// that component under this project's 150-line convention (see .claude/rules/coding.md) --
// boothSize itself and the 7 vehicle registration fields must stay in VendorBoothFieldset.tsx
// (A31/A32 grep the file directly), everything else here is free to move. M2 F17
// (vendor-gated-registration-flow) -- tableCount/chairCount are unchanged fields; the source
// doc's own per-table/chair rand rate was REMOVED entirely (Booth Fees section deleted) so no
// rate copy is rendered here -- see the M2 golden README's "Table/chair rate: council-blocked".
interface VendorBoothPositionFieldsetProps {
  state: VendorRegisterFormState;
  onFieldChange: VendorRegisterFieldChangeHandler;
  disabled: boolean;
}

const BOOTH_TYPE_OPTIONS = [
  { value: 'standard-in-row', label: 'Standard / In-row' },
  { value: 'corner', label: 'Corner' },
  { value: 'end-of-row', label: 'End-of-row' },
  { value: 'no-preference', label: 'No preference' },
];

const YES_NO_OPTIONS = [
  { value: 'true', label: 'Yes' },
  { value: 'false', label: 'No' },
];

export function VendorBoothPositionFieldset({
  state,
  onFieldChange,
  disabled,
}: VendorBoothPositionFieldsetProps) {
  return (
    <>
      <VendorRadioGroupField
        fieldKey="boothType"
        label="Booth position / row type preference"
        options={BOOTH_TYPE_OPTIONS}
        value={state.boothType}
        onChange={(v) => onFieldChange('boothType', v)}
        disabled={disabled}
        required={false}
      />
      <VendorFormField
        fieldKey="boothPositionRequest"
        label="Booth position request"
        htmlType="text"
        value={state.boothPositionRequest}
        onChange={(v) => onFieldChange('boothPositionRequest', v)}
        disabled={disabled}
        required={false}
        maxLength={300}
      />
      <VendorBooleanRadioField
        fieldKey="adjacentBoothRequested"
        label="Adjacent booth requested?"
        options={YES_NO_OPTIONS}
        value={state.adjacentBoothRequested}
        onChange={(v) => onFieldChange('adjacentBoothRequested', v)}
        disabled={disabled}
        required={false}
      />
      {isAdjacentBoothVendorNameFieldApplicable(state) ? (
        <VendorFormField
          fieldKey="adjacentBoothVendorName"
          label="Adjacent vendor's business name"
          htmlType="text"
          value={state.adjacentBoothVendorName}
          onChange={(v) => onFieldChange('adjacentBoothVendorName', v)}
          disabled={disabled}
          required={false}
          maxLength={200}
        />
      ) : null}
      <VendorFormField
        fieldKey="specialDisplayRequirements"
        label="Special display requirements"
        htmlType="text"
        value={state.specialDisplayRequirements}
        onChange={(v) => onFieldChange('specialDisplayRequirements', v)}
        disabled={disabled}
        required={false}
        maxLength={1000}
      />
      {/* @qa finding, 2026-09-01 (M2 fix pass): a charge applies to tables/chairs, but no rand
          figure exists anywhere in the source doc or this mission's scope (M2 golden README's
          "Table/chair rate: council-blocked, not provisional") -- disclose that a charge
          applies without inventing an amount. */}
      <p className="font-sans text-[13px] leading-relaxed text-ink/70">
        A charge applies for tables and chairs; the rate is to be confirmed by the Show
        Organising Committee.
      </p>
      <VendorFormField
        fieldKey="tableCount"
        label="Number of tables required"
        htmlType="number"
        min={0}
        step={1}
        value={state.tableCount}
        onChange={(v) => onFieldChange('tableCount', v)}
        disabled={disabled}
        required={false}
      />
      <VendorFormField
        fieldKey="chairCount"
        label="Number of chairs required"
        htmlType="number"
        min={0}
        step={1}
        value={state.chairCount}
        onChange={(v) => onFieldChange('chairCount', v)}
        disabled={disabled}
        required={false}
      />
    </>
  );
}
