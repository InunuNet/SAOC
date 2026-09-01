import type { VendorElectricalEquipmentEntryFormRow } from '@/lib/vendor-register-form-payload';

// M2 F14/F17 (vendor-gated-registration-flow) -- repeating-row editor for the "Equipment /
// Quantity / Wattage / Running time per day" electricity table, replacing the deprecated-in-
// place single electricalEquipmentList text input. Rendered only when
// isElectricalEquipmentApplicable(state) (powerRequired === 'true') is true -- see
// VendorBoothFieldset.tsx.
interface VendorElectricalEquipmentTableProps {
  value: VendorElectricalEquipmentEntryFormRow[];
  onChange: (rows: VendorElectricalEquipmentEntryFormRow[]) => void;
  disabled: boolean;
}

const EMPTY_ROW: VendorElectricalEquipmentEntryFormRow = {
  equipment: '',
  quantity: '',
  wattage: '',
  runningTimePerDay: '',
};

const legendClass = 'font-mono text-[11px] tracking-[0.16em] text-muted';
const labelClass = 'block font-mono text-[10.5px] tracking-[0.12em] text-muted';
const inputClass =
  'w-full rounded-sm border border-rule bg-ivory px-3 py-2 font-sans text-[14px] text-ink outline-none transition-colors focus:border-ink/40 focus-visible:ring-2 focus-visible:ring-ink/40 disabled:opacity-60';
const buttonClass =
  'rounded-sm border border-rule bg-ivory px-3 py-1.5 font-sans text-[13px] font-medium text-ink transition-colors hover:bg-bone focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/40 disabled:cursor-not-allowed disabled:opacity-50';

export function VendorElectricalEquipmentTable({
  value,
  onChange,
  disabled,
}: VendorElectricalEquipmentTableProps) {
  function updateRow(index: number, patch: Partial<VendorElectricalEquipmentEntryFormRow>) {
    onChange(value.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function removeRow(index: number) {
    onChange(value.filter((_, i) => i !== index));
  }

  return (
    <fieldset id="vendor-register-electricalEquipmentEntries" className="space-y-3">
      <legend className={legendClass}>Electrical equipment (equipment / quantity / wattage / running time per day)</legend>
      {value.map((row, index) => (
        <div key={index} className="grid grid-cols-1 gap-2 border border-rule-soft p-3 sm:grid-cols-4">
          <div>
            <label className={labelClass} htmlFor={`vendor-register-electricalEquipmentEntries-${index}-equipment`}>
              Equipment
            </label>
            <input
              id={`vendor-register-electricalEquipmentEntries-${index}-equipment`}
              type="text"
              value={row.equipment}
              onChange={(e) => updateRow(index, { equipment: e.target.value })}
              disabled={disabled}
              maxLength={200}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor={`vendor-register-electricalEquipmentEntries-${index}-quantity`}>
              Quantity
            </label>
            <input
              id={`vendor-register-electricalEquipmentEntries-${index}-quantity`}
              type="number"
              min={1}
              step={1}
              value={row.quantity}
              onChange={(e) => updateRow(index, { quantity: e.target.value })}
              disabled={disabled}
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass} htmlFor={`vendor-register-electricalEquipmentEntries-${index}-wattage`}>
              Wattage
            </label>
            <input
              id={`vendor-register-electricalEquipmentEntries-${index}-wattage`}
              type="text"
              value={row.wattage}
              onChange={(e) => updateRow(index, { wattage: e.target.value })}
              disabled={disabled}
              placeholder="e.g. 150W"
              maxLength={50}
              className={inputClass}
            />
          </div>
          <div>
            <label
              className={labelClass}
              htmlFor={`vendor-register-electricalEquipmentEntries-${index}-runningTimePerDay`}
            >
              Running time per day
            </label>
            <input
              id={`vendor-register-electricalEquipmentEntries-${index}-runningTimePerDay`}
              type="text"
              value={row.runningTimePerDay}
              onChange={(e) => updateRow(index, { runningTimePerDay: e.target.value })}
              disabled={disabled}
              placeholder="e.g. All day"
              maxLength={100}
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
        Add equipment row
      </button>
    </fieldset>
  );
}
