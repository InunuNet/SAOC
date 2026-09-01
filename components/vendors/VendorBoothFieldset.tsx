import type {
  VendorRegisterFieldChangeHandler,
  VendorRegisterFormState,
} from '@/lib/vendor-register-form-payload';
import { VendorFormField } from './VendorFormField';
import { VendorRadioGroupField } from './VendorRadioGroupField';
import { VendorBoothPositionFieldset } from './VendorBoothPositionFieldset';
import { VendorBoothUtilitiesFieldset } from './VendorBoothUtilitiesFieldset';

// Lee-Ann's 26 Aug source form, "BOOTH & LOGISTICS" section. M2 F17 (vendor-gated-registration-
// flow) -- boothSize (fixed 3-value radio: single/double/triple, source doc's own "1 Single
// Booth - 2.5m x 3m" / "2 Booths (Double) - 5m x 3m" / "3 Booths (Triple) - 7m x 3m") replaces
// the deprecated-in-place free-numeric boothCount input; 7 discrete vehicle registration inputs
// replace the single vehicleRegistrations free-text field. Both must stay in THIS file --
// A31/A32 grep it directly, not any extracted sub-component. Everything else (booth position,
// table/chair, power/water/gas, load slots) is extracted into VendorBoothPositionFieldset.tsx
// and VendorBoothUtilitiesFieldset.tsx to keep this file under this project's 150-line
// convention. No table/chair rand rate is rendered anywhere -- the source doc's Booth Fees
// section was removed entirely; see the M2 golden README's "Table/chair rate: council-blocked".
interface VendorBoothFieldsetProps {
  state: VendorRegisterFormState;
  onFieldChange: VendorRegisterFieldChangeHandler;
  disabled: boolean;
}

const BOOTH_SIZE_OPTIONS = [
  { value: 'single', label: '1 Single Booth — 2.5m x 3m' },
  { value: 'double', label: '2 Booths (Double) — 5m x 3m' },
  { value: 'triple', label: '3 Booths (Triple) — 7m x 3m' },
];

// M2 F14/F17 -- 7 discrete vehicle registration fields, replacing the single
// vehicleRegistrations free-text field (deprecated in place). Data-driven so the fieldKeys
// stay literal string values (grep-visible for A32) while keeping this file under this
// project's 150-line convention.
const VEHICLE_REGISTRATION_FIELDS: Array<{
  key: keyof VendorRegisterFormState;
  label: string;
}> = [
  { key: 'carRegistrationNumber', label: 'Car registration number' },
  { key: 'suvBakkieRegistrationNumber', label: 'SUV / bakkie registration number' },
  { key: 'panelVanRegistrationNumber', label: 'Panel van registration number' },
  { key: 'deliveryVanRegistrationNumber', label: 'Delivery van registration number' },
  { key: 'truckRegistrationNumber', label: 'Truck registration number' },
  { key: 'trailerRegistrationNumber', label: 'Trailer registration number' },
  { key: 'otherVehicleRegistrationNumber', label: 'Other vehicle registration number' },
];

export function VendorBoothFieldset({ state, onFieldChange, disabled }: VendorBoothFieldsetProps) {
  return (
    <div className="space-y-5">
      <h2 className="font-serif text-[20px] font-semibold text-ink">Booth &amp; logistics</h2>

      <VendorRadioGroupField
        fieldKey="boothSize"
        label="Booth size required"
        options={BOOTH_SIZE_OPTIONS}
        value={state.boothSize}
        onChange={(v) => onFieldChange('boothSize', v)}
        disabled={disabled}
        required
      />

      <VendorBoothPositionFieldset state={state} onFieldChange={onFieldChange} disabled={disabled} />
      <VendorBoothUtilitiesFieldset state={state} onFieldChange={onFieldChange} disabled={disabled} />

      {/* M2 F14/F17 -- 7 discrete vehicle registration inputs, replacing the single
          vehicleRegistrations free-text field (deprecated in place). Must stay inline in this
          file -- A32 greps VendorBoothFieldset.tsx directly. */}
      {VEHICLE_REGISTRATION_FIELDS.map(({ key, label }) => (
        <VendorFormField
          key={key}
          fieldKey={key}
          label={label}
          htmlType="text"
          value={state[key] as string}
          onChange={(v) => onFieldChange(key, v)}
          disabled={disabled}
          required={false}
          placeholder="e.g. CA 123-456"
          maxLength={30}
        />
      ))}
      <VendorFormField
        fieldKey="otherVehicleDescription"
        label="Other vehicle description"
        htmlType="text"
        value={state.otherVehicleDescription}
        onChange={(v) => onFieldChange('otherVehicleDescription', v)}
        disabled={disabled}
        required={false}
        maxLength={200}
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
