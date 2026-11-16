'use client';

import { useEffect, useRef, useState } from 'react';
import { TicketFieldAlert } from '@/components/tickets/TicketFormField';
import { REGISTRATION_LABELS, REGISTRATION_OPTIONS } from '@/lib/registration';

const CHECKBOX_CLASS = 'size-6 shrink-0 accent-primary outline-none focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-primary focus-visible:outline-offset-[3px] disabled:opacity-60';
const LABEL_CLASS = 'flex min-h-11 items-center gap-2 font-sans text-[15px] text-ink';

export function SocietyDropdown({ id, value, error, disabled, onChange }: {
  id: string; value: string[]; error?: string; disabled: boolean;
  onChange: (option: string, checked: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const panelId = `${id}-panel`;
  const labelId = `${id}-label`;
  useEffect(() => {
    if (!open) return;
    const outside = (event: MouseEvent) => {
      if (root.current && !root.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', outside);
    return () => document.removeEventListener('mousedown', outside);
  }, [open]);
  return <div ref={root} onBlur={(event) => {
    if (root.current && !root.current.contains(event.relatedTarget as Node | null)) setOpen(false);
  }} className="space-y-1.5">
    <div id={labelId} className="font-sans text-[14px] font-medium text-[var(--ink-700)]">{REGISTRATION_LABELS.societies}</div>
    <button ref={button} id={id} type="button" disabled={disabled} aria-expanded={open} aria-controls={panelId}
      aria-labelledby={`${labelId} ${id}-value`} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined}
      onClick={() => setOpen(!open)} onKeyDown={(event) => { if (event.key === 'Escape') { setOpen(false); button.current?.focus(); } }}
      className="w-full min-h-11 rounded-sm border border-rule bg-ivory px-3.5 py-2.5 text-left font-sans text-[15px] text-ink">
      <span id={`${id}-value`}>{value.length === 0 ? 'Select all that apply' : value.length === 1 ? value[0] : `${value.length} selected`}</span>
    </button>
    {open ? <div id={panelId} role="group" aria-labelledby={labelId} onKeyDown={(event) => {
      if (event.key === 'Escape') { event.preventDefault(); setOpen(false); button.current?.focus(); }
    }} className="max-h-72 overflow-y-auto border border-rule bg-ivory px-3.5">
      {REGISTRATION_OPTIONS.society.map((option) => {
        const optionId = `${id}-${option.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
        return <label key={option} htmlFor={optionId} className={LABEL_CLASS}>
          <input id={optionId} type="checkbox" name={id} value={option} checked={value.includes(option)}
            onChange={(event) => onChange(option, event.target.checked)} disabled={disabled} className={CHECKBOX_CLASS} />{option}
        </label>;
      })}
    </div> : null}
    {error ? <TicketFieldAlert id={`${id}-error`}>{error}</TicketFieldAlert> : null}
  </div>;
}
