'use client';

import { useRef, useState } from 'react';

interface ForewordExpandableProps {
  label: string;
  heading: string;
  paragraphs: readonly string[];
  introCount: number;
}

const COLLAPSED_LABEL = 'Continue reading';
const EXPANDED_LABEL = 'Show less';

export function ForewordExpandable({
  label,
  heading,
  paragraphs,
  introCount,
}: ForewordExpandableProps) {
  const [open, setOpen] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const controls = Array.from(
    { length: Math.max(paragraphs.length - introCount, 0) },
    (_, offset) => `home-foreword-p-${introCount + offset + 1}`,
  ).join(' ');

  function toggle() {
    const next = !open;
    setOpen(next);
    if (!next) {
      headingRef.current?.scrollIntoView({ block: 'nearest' });
    }
  }

  return (
    <div className="grid lg:grid-cols-[5fr_7fr] gap-x-16 gap-y-6">
      <div className="lg:sticky lg:top-[121px] lg:self-start">
        <div className="mb-5">
          <span className="eyebrow">{label}</span>
        </div>
        <h2
          ref={headingRef}
          id="home-foreword-heading"
          className="font-serif font-normal min-[942px]:font-light text-[clamp(28px,3.4vw,46px)] leading-[1.08] tracking-[-0.015em] text-primary"
        >
          {heading}
        </h2>
        <button
          type="button"
          aria-expanded={open}
          aria-controls={controls}
          onClick={toggle}
          className="mt-6 inline-flex min-h-11 items-center font-mono text-[11px] uppercase tracking-[0.18em] text-primary hover:text-primary-800 transition-colors duration-150 outline-primary focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-primary focus-visible:outline-offset-[3px]"
        >
          {open ? EXPANDED_LABEL : COLLAPSED_LABEL}
        </button>
      </div>

      <div className="doc-prose">
        {paragraphs.map((paragraph, index) => (
          <p
            key={paragraph}
            id={`home-foreword-p-${index + 1}`}
            hidden={!open && index >= introCount}
          >
            {paragraph}
          </p>
        ))}
      </div>
    </div>
  );
}
