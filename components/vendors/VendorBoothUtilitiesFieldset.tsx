import {
  isElectricalEquipmentApplicable,
  isGasEquipmentApplicable,
  isWastewaterDrainageDetailsFieldApplicable,
  isWaterIntendedUseFieldApplicable,
  type VendorRegisterFieldChangeHandler,
  type VendorRegisterFormState,
} from '@/lib/vendor-register-form-payload';
import { VendorFormField } from './VendorFormField';
import { VendorBooleanRadioField } from './VendorBooleanRadioField';
import { VendorElectricalEquipmentTable } from './VendorElectricalEquipmentTable';
import { VendorGasEquipmentTable } from './VendorGasEquipmentTable';

// Power/water/wastewater/staffing fields, extracted out of VendorBoothFieldset.tsx to keep
// that component under this project's 150-line convention (see .claude/rules/coding.md). M2
// F14/F17 (vendor-gated-registration-flow) -- electricalEquipmentEntries/gasEquipmentEntries
// replace the deprecated-in-place scalar electrical* fields with repeating tables; gas is
// gated isGasEquipmentApplicable (isFoodRetailer) per the golden README's "Gas equipment
// gating" judgement call, not powerRequired.
interface VendorBoothUtilitiesFieldsetProps {
  state: VendorRegisterFormState;
  onFieldChange: VendorRegisterFieldChangeHandler;
  disabled: boolean;
}

const YES_NO_OPTIONS = [
  { value: 'true', label: 'Yes' },
  { value: 'false', label: 'No' },
];

export function VendorBoothUtilitiesFieldset({
  state,
  onFieldChange,
  disabled,
}: VendorBoothUtilitiesFieldsetProps) {
  return (
    <>
      <VendorBooleanRadioField
        fieldKey="powerRequired"
        label="Power required?"
        options={YES_NO_OPTIONS}
        value={state.powerRequired}
        onChange={(v) => onFieldChange('powerRequired', v)}
        disabled={disabled}
        required
      />
      {isElectricalEquipmentApplicable(state) ? (
        <VendorFormField
          fieldKey="electricalOutletsRequired"
          label="Number of electrical outlets required"
          htmlType="number"
          min={0}
          step={1}
          value={state.electricalOutletsRequired}
          onChange={(v) => onFieldChange('electricalOutletsRequired', v)}
          disabled={disabled}
          required={false}
        />
      ) : null}
      {isElectricalEquipmentApplicable(state) ? (
        <VendorElectricalEquipmentTable
          value={state.electricalEquipmentEntries}
          onChange={(rows) => onFieldChange('electricalEquipmentEntries', rows)}
          disabled={disabled}
        />
      ) : null}
      {isGasEquipmentApplicable(state) ? (
        <VendorGasEquipmentTable
          value={state.gasEquipmentEntries}
          onChange={(rows) => onFieldChange('gasEquipmentEntries', rows)}
          disabled={disabled}
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
      {isWaterIntendedUseFieldApplicable(state) ? (
        <VendorFormField
          fieldKey="waterIntendedUse"
          label="Intended use of water"
          htmlType="text"
          value={state.waterIntendedUse}
          onChange={(v) => onFieldChange('waterIntendedUse', v)}
          disabled={disabled}
          required={false}
          maxLength={300}
        />
      ) : null}
      <VendorBooleanRadioField
        fieldKey="wastewaterDrainageRequired"
        label="Wastewater / drainage requirement?"
        options={YES_NO_OPTIONS}
        value={state.wastewaterDrainageRequired}
        onChange={(v) => onFieldChange('wastewaterDrainageRequired', v)}
        disabled={disabled}
        required={false}
      />
      {isWastewaterDrainageDetailsFieldApplicable(state) ? (
        <VendorFormField
          fieldKey="wastewaterDrainageDetails"
          label="Wastewater / drainage details"
          htmlType="text"
          value={state.wastewaterDrainageDetails}
          onChange={(v) => onFieldChange('wastewaterDrainageDetails', v)}
          disabled={disabled}
          required={false}
          maxLength={500}
        />
      ) : null}
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
    </>
  );
}
