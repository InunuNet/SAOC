'use client';

import { useEffect, useState } from 'react';

const TARGET_MS = new Date('2027-09-18T09:00:00+02:00').getTime();

function compute() {
  const diff = Math.max(0, TARGET_MS - Date.now());
  return {
    days: Math.floor(diff / 86_400_000),
    hours: Math.floor((diff % 86_400_000) / 3_600_000),
    minutes: Math.floor((diff % 3_600_000) / 60_000),
    seconds: Math.floor((diff % 60_000) / 1_000),
  };
}

export function ShowCountdown() {
  const [remain, setRemain] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    setRemain(compute());
    const id = setInterval(() => setRemain(compute()), 1000);
    return () => clearInterval(id);
  }, []);

  const units = [
    { label: 'Days', value: remain.days },
    { label: 'Hours', value: remain.hours },
    { label: 'Min', value: remain.minutes },
    { label: 'Sec', value: remain.seconds },
  ];

  return (
    <div className="flex gap-6" aria-label="Countdown to 19th National Show">
      {units.map(({ label, value }) => (
        <div key={label} className="text-center">
          <div className="font-serif text-[42px] leading-none text-accent-soft">
            {String(value).padStart(2, '0')}
          </div>
          <div className="mt-1 font-mono text-[11px] uppercase tracking-[0.18em] text-ivory/60">
            {label}
          </div>
        </div>
      ))}
    </div>
  );
}
