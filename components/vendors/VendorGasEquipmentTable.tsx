import type { VendorGasEquipmentEntryFormRow } from '@/lib/vendor-register-form-payload';

// M2 F14/F17 (vendor-gated-registration-flow) -- repeating-row editor for the "Equipment type /
// Gas type / Cylinder size / Cylinder count" gas table. Rendered only when
// isGasEquipmentApplicable(state) is true -- see VendorBoothFieldset.tsx.
interface VendorGasEquipmentTableProps {
  value: VendorGasEquipmentEntryFormRow[];
  onChange: (rows: VendorGasEquipmentEntryFormRow[]) => void;
  disabled: boolean;
}

const EMPTY_ROW: VendorGasEquipmentEntryFormRow = {
  equipmentType: '',
  gasType: '',
  cylinderSize: '',
  cylinderCount: '',
};

const legendClass = 'font-mono text-[11px] tracking-[0.16em] text-muted';
const labelClass = 'block font-mono text-[10.5px] tracking-[0.12em] text-muted';
const inputClass =
  'w-full rounded-sm border border-rule bg-ivory px-3 py-2 font-sans text-[14px] text-ink outline-none transition-colors focus:border-ink/40 focus-visible:ring-2 focus-visible:ring-ink/40 disabled:opacity-60';
const buttonClass =
  'rounded-sm border border-rule bg-ivory px-3 py-1.5 font-sans text-[13px] font-medium text-ink transition-colors hover:bg-bone focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 disabled:cursor-not-allowed disabled:opacity-50';

export function VendorGasEquipmentTable({ value, onChange, disabled }: VendorGasEquipmentTableProps) {
  function updateRow(index: number, patch: Partial<VendorGasEquipmentEntryFormRow>) {
    onChange(value.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function removeRow(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  return (
    <fieldset id="vendor-register-gasEquipmentEntries" className="space-y-3">
      <legend className={legendClass}>Gas equipment (equipment type / gas type / cylinder size / cylinder count)</legend>
      {value.map((row, index) => (
        <div key={index} className="grid grid-cols-1 gap-2 border border-rule-soft p-3 sm:grid-cols-4">
          <div>
            <label className={labelClass} htmlFor={`vendor-register-gasEquipmentEntries-${index}-equipmentType`}>
              Equipment type
            </label>
            <input
              id={`vendor-register-gasEquipmentEntries-${index}-equipmentType`}
              type="text"
              value={row.equipmentType}
              onChange={(e) => updateRow(index, { equipmentType: e.target.value })}
              disabled={disabled}
              maxLength={200}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor={`vendor-register-gasEquipmentEntries-${index}-gasType`}>
              Gas type
            </label>
            <input
              id={`vendor-register-gasEquipmentEntries-${index}-gasType`}
              type="text"
              value={row.gasType}
              onChange={(e) => updateRow(index, { gasType: e.target.value })}
              disabled={disabled}
              placeholder="e.g. LPG"
              maxLength={100}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor={`vendor-register-gasEquipmentEntries-${index}-cylinderSize`}>
              Cylinder size
            </label>
            <input
              id={`vendor-register-gasEquipmentEntries-${index}-cylinderSize`}
              type="text"
              value={row.cylinderSize}
              onChange={(e) => updateRow(index, { cylinderSize: e.target.value })}
              disabled={disabled}
              placeholder="e.g. 9kg"
              maxLength={50}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor={`vendor-register-gasEquipmentEntries-${index}-cylinderCount`}>
              Cylinder count
            </label>
            <input
              id={`vendor-register-gasEquipmentEntries-${index}-cylinderCount`}
              type="number"
              min={1}
              step={1}
              value={row.cylinderCount}
              onChange={(e) => updateRow(index, { cylinderCount: e.target.value })}
              disabled={disabled}
              className={inputClass}
            />
          </div>
          <button
            type="button"
            onClick={() => removeRow(index)}
            disabled={disabled}
            className={`${buttonClass} sm:col-span-4 sm:w-fit`}
          >
            Remove row
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={() => onChange([...value, { ...EMPTY_ROW }])}
        disabled={disabled}
        className={buttonClass}
      >
        Add gas equipment row
      </button>
    </fieldset>
  );
}
