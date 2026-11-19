interface OptionGroupProps<T extends string | number | boolean> {
  legend: string;
  name: string;
  options: readonly T[];
  value: T;
  onChange: (next: T) => void;
}

const LABELS: Record<string, string> = {
  true: 'Show',
  false: 'Hide',
  'gold-200': 'Gold 200',
  'gold-100': 'Gold 100',
  'purple-700': 'Purple 700',
  'olive-700': 'Olive 700',
  'after-intro': 'After intro',
};

function label(option: string | number | boolean): string {
  const text = String(option);
  return LABELS[text] ?? text.charAt(0).toUpperCase() + text.slice(1);
}

/** One closed-enum control: a radio group over the schema's allowed values, nothing free-form. */
export function OptionGroup<T extends string | number | boolean>({
  legend,
  name,
  options,
  value,
  onChange,
}: OptionGroupProps<T>) {
  return (
    <fieldset className="border-0 p-0">
      <legend className="mb-1 font-sans text-[13px] font-semibold text-ink">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => (
          <label
            key={String(option)}
            className="flex min-h-[44px] cursor-pointer items-center gap-2 rounded-[2px] border px-3 font-sans text-[14px] text-ink has-[:checked]:border-primary has-[:checked]:bg-bone has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-[3px] has-[:focus-visible]:outline-primary border-rule"
          >
            <input
              type="radio"
              name={name}
              checked={option === value}
              onChange={() => onChange(option)}
              className="h-4 w-4"
            />
            {label(option)}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
