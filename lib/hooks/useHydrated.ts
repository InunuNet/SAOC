import { useSyncExternalStore } from 'react';

const subscribeNever = () => () => {};

/**
 * False on the server and during the first client render, true once React has hydrated.
 * Gate a form's submit button on it so a pre-hydration submit can never fall through to a
 * native form submission.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribeNever, () => true, () => false);
}
