import type {
  VendorRegisterFieldChangeHandler,
  VendorRegisterFormState,
} from '@/lib/vendor-register-form-payload';
import { VendorBusinessIdentityFieldset } from './VendorBusinessIdentityFieldset';
import { VendorFormField } from './VendorFormField';
import { VendorPrimaryContactFieldset } from './VendorPrimaryContactFieldset';

// Lee-Ann's source form, section 1 ("Contact & business details"), fields 1-17 -- reordered to
// follow the source document's own structure; see the F2 golden's "Files touched" #5 for the
// reorder judgement call. M2 F16 (vendor-gated-registration-flow) -- gains the 5 Online
// Presence fields and absorbs VendorEmergencyContactFieldset.tsx's 3 fields inline (no separate
// "Emergency contact" <h2> -- see the M2 golden README). Business identity/address fields are
// extracted into VendorBusinessIdentityFieldset.tsx to keep this component under this
// project's 150-line convention.
interface VendorContactFieldsetProps {
  state: VendorRegisterFormState;
  onFieldChange: VendorRegisterFieldChangeHandler;
  disabled: boolean;
}

export function VendorContactFieldset({ state, onFieldChange, disabled }: VendorContactFieldsetProps) {
  return (
    <div className="space-y-5">
      <h2 className="font-serif text-[20px] font-semibold text-ink">Contact &amp; business details</h2>

      <VendorBusinessIdentityFieldset state={state} onFieldChange={onFieldChange} disabled={disabled} />

      <VendorPrimaryContactFieldset state={state} onFieldChange={onFieldChange} disabled={disabled} />

      <VendorFormField
        fieldKey="website"
        label="Website"
        htmlType="url"
        value={state.website}
        onChange={(v) => onFieldChange('website', v)}
        disabled={disabled}
        required={false}
        maxLength={300}
      />

      {/* M2 F16 (vendor-gated-registration-flow) -- Online Presence, replacing the single
          socialMediaHandle input (deprecated in place on VendorSubmission). The source doc's
          own platform spelling for this row is a typo, corrected here per the M2 golden
          README's own note on that typo -- the field/label reads "TikTok". */}
      <VendorFormField
        fieldKey="facebookHandle"
        label="Facebook"
        htmlType="text"
        value={state.facebookHandle}
        onChange={(v) => onFieldChange('facebookHandle', v)}
        disabled={disabled}
        required={false}
        maxLength={200}
      />
      <VendorFormField
        fieldKey="instagramHandle"
        label="Instagram"
        htmlType="text"
        value={state.instagramHandle}
        onChange={(v) => onFieldChange('instagramHandle', v)}
        disabled={disabled}
        required={false}
        maxLength={200}
      />
      <VendorFormField
        fieldKey="tiktokHandle"
        label="TikTok"
        htmlType="text"
        value={state.tiktokHandle}
        onChange={(v) => onFieldChange('tiktokHandle', v)}
        disabled={disabled}
        required={false}
        maxLength={200}
      />
      <VendorFormField
        fieldKey="youtubeHandle"
        label="YouTube"
        htmlType="text"
        value={state.youtubeHandle}
        onChange={(v) => onFieldChange('youtubeHandle', v)}
        disabled={disabled}
        required={false}
        maxLength={200}
      />
      <VendorFormField
        fieldKey="otherSocialMediaHandle"
        label="Other social media handle/link"
        htmlType="text"
        value={state.otherSocialMediaHandle}
        onChange={(v) => onFieldChange('otherSocialMediaHandle', v)}
        disabled={disabled}
        required={false}
        maxLength={200}
      />

      {/* M2 F16 -- Emergency contact fields absorbed inline (no standalone "Emergency contact"
          <h2> section any more), matching the 26 Aug doc's fold-in. Field type/optionality is
          unchanged from VendorEmergencyContactFieldset.tsx, now deleted. */}
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
