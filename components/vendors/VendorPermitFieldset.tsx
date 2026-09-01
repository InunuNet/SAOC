import {
  isCitesPermitNumberFieldApplicable,
  type VendorRegisterFieldChangeHandler,
  type VendorRegisterFormState,
} from '@/lib/vendor-register-form-payload';
import { VendorBooleanRadioField } from './VendorBooleanRadioField';
import { VendorFormField } from './VendorFormField';

// CITES/phytosanitary permit fields, extracted out of VendorCategoryFieldset.tsx to keep that
// component under this project's 150-line-per-component convention (see .claude/rules/
// coding.md). Rendered within the "Products & category" section -- no own <h2>.
interface VendorPermitFieldsetProps {
  state: VendorRegisterFormState;
  onFieldChange: VendorRegisterFieldChangeHandler;
  disabled: boolean;
}

const YES_NO_OPTIONS = [
  { value: 'true', label: 'Yes' },
  { value: 'false', label: 'No' },
];

export function VendorPermitFieldset({ state, onFieldChange, disabled }: VendorPermitFieldsetProps) {
  return (
    <>
      <VendorBooleanRadioField
        fieldKey="citesListedSpecies"
        label="Do you sell CITES-listed / protected species?"
        options={YES_NO_OPTIONS}
        value={state.citesListedSpecies}
        onChange={(v) => onFieldChange('citesListedSpecies', v)}
        disabled={disabled}
        required={false}
      />
      {isCitesPermitNumberFieldApplicable(state) ? (
        <VendorFormField
          fieldKey="citesPermitNumber"
          label="CITES permit number"
          htmlType="text"
          value={state.citesPermitNumber}
          onChange={(v) => onFieldChange('citesPermitNumber', v)}
          disabled={disabled}
          required={false}
          placeholder="Permit reference number, if issued"
          maxLength={100}
        />
      ) : null}
      <VendorFormField
        fieldKey="phytosanitaryPermitNumber"
        label="Phytosanitary certificate / import permit number (rare, exotic or imported plants)"
        htmlType="text"
        value={state.phytosanitaryPermitNumber}
        onChange={(v) => onFieldChange('phytosanitaryPermitNumber', v)}
        disabled={disabled}
        required={false}
        placeholder="Permit reference number, if issued"
        maxLength={100}
      />
    </>
  );
}
