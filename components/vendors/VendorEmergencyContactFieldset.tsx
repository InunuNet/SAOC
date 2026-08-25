import type {
  VendorRegisterFieldChangeHandler,
  VendorRegisterFormState,
} from '@/lib/vendor-register-form-payload';
import { VendorFormField } from './VendorFormField';

// Lee-Ann's source form, section 2 ("Emergency contact") -- entirely new, see contract-f2.yaml.
interface VendorEmergencyContactFieldsetProps {
  state: VendorRegisterFormState;
  onFieldChange: VendorRegisterFieldChangeHandler;
  disabled: boolean;
}

export function VendorEmergencyContactFieldset({
  state,
  onFieldChange,
  disabled,
}: VendorEmergencyContactFieldsetProps) {
  return (
    <div className="space-y-5">
      <h2 className="font-serif text-[20px] font-semibold text-ink">Emergency contact</h2>
      <p className="font-sans text-[14px] text-muted">
        The emergency contact should preferably be someone other than the primary vendor contact.
      </p>

      <VendorFormField
        fieldKey="emergencyContactName"
        label="Emergency contact full name"
        htmlType="text"
        value={state.emergencyContactName}
        onChange={(v) => onFieldChange('emergencyContactName', v)}
        disabled={disabled}
        required
        maxLength={150}
      />
      <VendorFormField
        fieldKey="emergencyContactRelationship"
        label="Relationship to vendor"
        htmlType="text"
        value={state.emergencyContactRelationship}
        onChange={(v) => onFieldChange('emergencyContactRelationship', v)}
        disabled={disabled}
        required={false}
        maxLength={100}
      />
      <VendorFormField
        fieldKey="emergencyContactCellPhone"
        label="Emergency contact cell phone number"
        htmlType="tel"
        value={state.emergencyContactCellPhone}
        onChange={(v) => onFieldChange('emergencyContactCellPhone', v)}
        disabled={disabled}
        required
        maxLength={30}
        pattern="^(?=.*[0-9])[0-9+\-() ]{7,20}$"
      />
    </div>
  );
}
