import {
  isAdjacentBoothVendorNameFieldApplicable,
  isElectricalEquipmentContinuousDetailsFieldApplicable,
  isElectricalLoadApplicable,
  isWastewaterDrainageDetailsFieldApplicable,
  isWaterIntendedUseFieldApplicable,
  type VendorRegisterFieldChangeHandler,
  type VendorRegisterFormState,
} from '@/lib/vendor-register-form-payload';
import { VendorFormField } from './VendorFormField';
import { VendorRadioGroupField } from './VendorRadioGroupField';
import { VendorBooleanRadioField } from './VendorBooleanRadioField';

// Lee-Ann's source form, section 3 ("Booth & logistics"), fields 17-27 -- labels verbatim
// from contracts/golden/vendor-form-ui/field-spec.golden.json (section: "booth"). F4
// (vendor-registration-form-rebuild) adds Section 4 (booth requirements) and Section 6
// (electricity & water) fields -- see contract-f4.yaml.
interface VendorBoothFieldsetProps {
  state: VendorRegisterFormState;
  onFieldChange: VendorRegisterFieldChangeHandler;
  disabled: boolean;
}

// F4 (vendor-registration-form-rebuild) -- 'standard' renamed to 'standard-in-row',
// 'no-preference' added, matching source 4.2's 4-option list. See contract-f4.yaml.
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
      {isElectricalLoadApplicable(state) ? (
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
      {isElectricalLoadApplicable(state) ? (
        <VendorFormField
          fieldKey="electricalEquipmentList"
          label="List of electrical equipment"
          htmlType="text"
          value={state.electricalEquipmentList}
          onChange={(v) => onFieldChange('electricalEquipmentList', v)}
          disabled={disabled}
          required={false}
          maxLength={1000}
        />
      ) : null}
      {isElectricalLoadApplicable(state) ? (
        <VendorBooleanRadioField
          fieldKey="electricalEquipmentContinuousOperation"
          label="Does equipment run continuously?"
          options={YES_NO_OPTIONS}
          value={state.electricalEquipmentContinuousOperation}
          onChange={(v) => onFieldChange('electricalEquipmentContinuousOperation', v)}
          disabled={disabled}
          required={false}
        />
      ) : null}
      {isElectricalEquipmentContinuousDetailsFieldApplicable(state) ? (
        <VendorFormField
          fieldKey="electricalEquipmentContinuousDetails"
          label="Continuous operation details"
          htmlType="text"
          value={state.electricalEquipmentContinuousDetails}
          onChange={(v) => onFieldChange('electricalEquipmentContinuousDetails', v)}
          disabled={disabled}
          required={false}
          maxLength={500}
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
