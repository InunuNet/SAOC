// F1 static: every public form posts, and cannot submit before React has attached onSubmit.
// Reference pattern: components/vendors/VendorRegisterForm.tsx:35,45-47,147 (method="post" plus a
// useSyncExternalStore `hydrated` flag, client true / server false, in the submit button's disabled).
// F1 factors that pattern into lib/hooks/useHydrated.ts so six forms do not each copy it.
// Run as: node contracts/checks/polish-wave-2026-10-25/f1-forms-static.mjs   (POLISH_ROOT optional)
import { finish, read, tags } from './_lib.mjs';

const FORMS = [
  'components/vendors/VendorApplyForm.tsx',
  'components/vendors/VendorRegistrationCodeEntryForm.tsx',
  'components/contact/ContactForm.tsx',
  'components/members/SuggestionForm.tsx',
  'components/events/SubmitEventForm.tsx',
  'components/tickets/TicketPurchaseForm.tsx',
];
const failures = [];

let hook = '';
try { hook = read('lib/hooks/useHydrated.ts'); } catch (e) { failures.push(e.message); }
if (hook && !/export function useHydrated\(\)/.test(hook)) failures.push('lib/hooks/useHydrated.ts does not export function useHydrated()');
if (hook && !/useSyncExternalStore\([^)]*,\s*\(\) => true,\s*\(\) => false\s*\)/s.test(hook)) {
  failures.push('useHydrated is not useSyncExternalStore(subscribe, () => true, () => false)');
}

for (const rel of FORMS) {
  let src;
  try { src = read(rel); } catch (e) { failures.push(e.message); continue; }
  const forms = tags(src, 'form');
  if (forms.length !== 1) { failures.push(`${rel}: expected exactly one <form>, found ${forms.length}`); continue; }
  if (!/\bmethod="post"/.test(forms[0])) failures.push(`${rel}: <form> has no method="post"`);
  if (!/import \{ useHydrated \} from '@\/lib\/hooks\/useHydrated'/.test(src)) failures.push(`${rel}: does not import useHydrated from '@/lib/hooks/useHydrated'`);
  if (!/const hydrated = useHydrated\(\)/.test(src)) failures.push(`${rel}: no \`const hydrated = useHydrated()\``);
  const submits = [...tags(src, 'button'), ...tags(src, 'Button')].filter((t) => /\btype="submit"/.test(t));
  if (submits.length !== 1) { failures.push(`${rel}: expected exactly one type="submit" button, found ${submits.length}`); continue; }
  if (!/disabled=\{[^}]*!hydrated[^}]*\}/.test(submits[0])) failures.push(`${rel}: the submit button's disabled expression does not include !hydrated`);
}
finish('f1-forms-static', failures);
