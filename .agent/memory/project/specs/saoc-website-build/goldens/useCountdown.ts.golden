'use client';

import { useEffect, useState } from 'react';

export interface CountdownParts {
  days: string;
  hours: string;
  minutes: string;
  seconds: string;
}

const ZERO: CountdownParts = {
  days: '00',
  hours: '00',
  minutes: '00',
  seconds: '00',
};

function pad(n: number): string {
  return n.toString().padStart(2, '0');
}

function compute(target: Date): CountdownParts {
  const total = target.getTime() - Date.now();
  if (total <= 0) return ZERO;
  const days = Math.floor(total / (1000 * 60 * 60 * 24));
  const hours = Math.floor((total / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((total / (1000 * 60)) % 60);
  const seconds = Math.floor((total / 1000) % 60);
  return {
    days: pad(days),
    hours: pad(hours),
    minutes: pad(minutes),
    seconds: pad(seconds),
  };
}

/**
 * useCountdown
 *
 * Returns the remaining time until `targetDate` as zero-padded 2-digit strings.
 * Updates every 1000ms. When the target is reached or passed, returns all "00".
 * Cleans up its interval on unmount.
 *
 * Example:
 *   const { days, hours, minutes, seconds } = useCountdown(
 *     new Date('2027-09-18T09:00:00+02:00')
 *   );
 */
export function useCountdown(targetDate: Date): CountdownParts {
  const [parts, setParts] = useState<CountdownParts>(() => compute(targetDate));

  useEffect(() => {
    const id = setInterval(() => {
      setParts(compute(targetDate));
    }, 1000);
    return () => clearInterval(id);
  }, [targetDate]);

  return parts;
}
