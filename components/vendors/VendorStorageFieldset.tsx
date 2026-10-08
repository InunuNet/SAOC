import type {
  VendorRegisterFieldChangeHandler,
  VendorRegisterFormState,
} from '@/lib/vendor-register-form-payload';
import { VendorCheckboxField } from './VendorCheckboxField';

// Lee-Ann's 2026-10-07 source doc (F1, vendor-form-copy-20261007), "STORAGE & SECURITY"
// section -- entirely missing from the live form before this feature. storageRiskAcknowledged
// wires onto the already-validated, already-optional server field (types/index.ts:715-716,
// "NOT forced true" -- untouched by this feature, matching the source's own lack of an
// asterisk on this acknowledgement).
interface VendorStorageFieldsetProps {
  state: VendorRegisterFormState;
  onFieldChange: VendorRegisterFieldChangeHandler;
  disabled: boolean;
}

export function VendorStorageFieldset({
  state,
  onFieldChange,
  disabled,
}: VendorStorageFieldsetProps) {
  return (
    <div className="space-y-5">
      <h2 className="font-serif text-[20px] font-semibold text-ink">Storage &amp; security</h2>

      <VendorCheckboxField
        fieldKey="storageRiskAcknowledged"
        label="All plants and products can be left in your booth overnight. Security will be provided on the premises. However, the organizers of the event cannot be held liable for any losses incurred."
        value={state.storageRiskAcknowledged}
        onChange={(v) => onFieldChange('storageRiskAcknowledged', v)}
        disabled={disabled}
        required={false}
      />
    </div>
  );
}
