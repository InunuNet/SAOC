import { notFound } from 'next/navigation';

// R63: an unmatched /national-show/* URL never reaches national-show/not-found.tsx on its own.
// Static routes always win over a catch-all, so this only receives URLs no real page owns, and
// hands them to the NOS-scoped not-found (NOS chrome, HTTP 404).
export default function NationalShowCatchAll(): never {
  notFound();
}
