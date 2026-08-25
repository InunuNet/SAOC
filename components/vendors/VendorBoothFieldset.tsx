import {
  isElectricalLoadApplicable,
  type VendorRegisterFieldChangeHandler,
  type VendorRegisterFormState,
} from '@/lib/vendor-register-form-payload';
import { VendorFormField } from './VendorFormField';
import { VendorRadioGroupField } from './VendorRadioGroupField';
import { VendorBooleanRadioField } from './VendorBooleanRadioField';

// Lee-Ann's source form, section 3 ("Booth & logistics"), fields 17-27 -- labels verbatim
// from contracts/golden/vendor-form-ui/field-spec.golden.json (section: "booth").
interface VendorBoothFieldsetProps {
  state: VendorRegisterFormState;
  onFieldChange: VendorRegisterFieldChangeHandler;
  disabled: boolean;
}

const BOOTH_TYPE_OPTIONS = [
  { value: 'standard', label: 'Standard' },
  { value: 'corner', label: 'Corner' },
  { value: 'end-of-row', label: 'End-of-row' },
];

const YES_NO_OPTIONS = [
  { value: 'true', label: 'Yes' },
  { value: 'false', label: 'No' },
];

export function VendorBoothFieldset({ state, onFieldChange, disabled }: VendorBoothFieldsetProps) {
  return (
    <div className="space-y-5">
      <h2 className="font-serif text-[20px] font-semibold text-ink">Booth &amp; logistics</h2>

      <VendorFormField
        fieldKey="boothCount"
        label="Number of booths required"
        htmlType="number"
        min={1}
        step={1}
        value={state.boothCount}
        onChange={(v) => onFieldChange('boothCount', v)}
        disabled={disabled}
        required
      />
      <VendorRadioGroupField
        fieldKey="boothType"
        label="Booth size / type preference"
        options={BOOTH_TYPE_OPTIONS}
        value={state.boothType}
        onChange={(v) => onFieldChange('boothType', v)}
        disabled={disabled}
        required={false}
      />
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
      <VendorBooleanRadioField
        fieldKey="powerRequired"
        label="Power required?"
        options={YES_NO_OPTIONS}
        value={state.powerRequired}
        onChange={(v) => onFieldChange('powerRequired', v)}
        disabled={disabled}
        required
      />
      {isElectricalLoadApplicable(state) ? (
        <VendorFormField
          fieldKey="electricalLoad"
          label="Electrical load required (watts/amps)"
          htmlType="text"
          value={state.electricalLoad}
          onChange={(v) => onFieldChange('electricalLoad', v)}
          disabled={disabled}
          required={false}
          placeholder="e.g. 15A / 3.5kW"
          maxLength={100}
        />
      ) : null}
      <VendorBooleanRadioField
        fieldKey="waterRequired"
        label="Water access required?"
        options={YES_NO_OPTIONS}
        value={state.waterRequired}
        onChange={(v) => onFieldChange('waterRequired', v)}
        disabled={disabled}
        required={false}
      />
      <VendorFormField
        fieldKey="staffPerDay"
        label="Number of staff attending per day"
        htmlType="number"
        min={0}
        step={1}
        value={state.staffPerDay}
        onChange={(v) => onFieldChange('staffPerDay', v)}
        disabled={disabled}
        required={false}
      />
      <VendorFormField
        fieldKey="vehicleRegistrations"
        label="Vehicle registration number(s)"
        htmlType="text"
        value={state.vehicleRegistrations}
        onChange={(v) => onFieldChange('vehicleRegistrations', v)}
        disabled={disabled}
        required={false}
        placeholder="e.g. CA 123-456"
        maxLength={150}
      />
      <VendorFormField
        fieldKey="loadInSlot"
        label="Preferred load-in time slot"
        htmlType="text"
        value={state.loadInSlot}
        onChange={(v) => onFieldChange('loadInSlot', v)}
        disabled={disabled}
        required={false}
        placeholder="e.g. Friday 14:00–16:00"
        maxLength={100}
      />
      <VendorFormField
        fieldKey="loadOutSlot"
        label="Preferred load-out time slot"
        htmlType="text"
        value={state.loadOutSlot}
        onChange={(v) => onFieldChange('loadOutSlot', v)}
        disabled={disabled}
        required={false}
        placeholder="e.g. Sunday 16:00–18:00"
        maxLength={100}
      />
    </div>
  );
}
