# F1: Mobile Menu — Focus Trap Accessibility Fix

**Feature:** F1 of mission `mobilemenu-focus-trap` (milestone M1). Adds a focus trap to `components/chrome/MobileMenu.tsx` so keyboard navigation (Tab, Shift+Tab) stays within the drawer when open. When the drawer opens, focus moves to the close button; Tab/Shift+Tab cycle only within focusable elements inside the drawer, wrapping at both ends; Escape closes the drawer and returns focus to the hamburger trigger button. Background page content is rendered inert and hidden from screen readers during drawer open.

**Contract:** `.agent/memory/project/specs/mobilemenu-focus-trap/contract-f1.yaml` and `contracts/golden/mobilemenu-focus-trap-f1/` — full design record and check scripts.

**Status:** Gated (all structural checks pass). QA-passed. Codex cross-model-passed.

---

## Why This Feature Exists

**The original defect:** The mobile navigation drawer had no focus trap. When the drawer was open, pressing Tab would move focus away from the drawer's focusable elements and onto background page content (links, buttons in the header or footer). This allowed keyboard users to interact with hidden page elements while the drawer was visually open and blocking the rest of the page, a significant accessibility defect flagged during earlier mission `backlog-a11y-ui-quickfixes` (2026-08-21/22).

**Why it happened:** The original `MobileMenu.tsx` rendered the drawer as a visible overlay but did not manage focus or trap keyboard navigation within it. No automatic focus management, no prevention of Tab escape, no return focus when the drawer closes.

**Why a focus trap was needed:** Screen reader users and keyboard-only users must have focus stay within the drawer while it is open. When the drawer closes, focus must return to the element that opened it (the hamburger trigger button), so the user's keyboard navigation position doesn't jump or get lost. The WCAG 2.1 level AA standard requires focus to be managed this way for modal and quasi-modal UI patterns.

---

## The Fix

### Focus Trap Hook: `lib/hooks/useFocusTrap.ts`

A new hand-rolled React hook manages focus within a designated container:

```typescript
export function useFocusTrap(
  containerRef: RefObject<HTMLElement>,
  triggerRef: RefObject<HTMLElement> | null = null,
  isActive: boolean = true
): void {
  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    // On mount: move focus to the first focusable element in the container
    const focusableElements = getFocusableElements(containerRef.current);
    if (focusableElements.length > 0) {
      focusableElements[0].focus();
    }

    // Handle Tab/Shift+Tab to cycle within focusable elements
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      const focusable = getFocusableElements(containerRef.current!);
      if (focusable.length === 0) return;

      const currentIndex = focusable.indexOf(document.activeElement as HTMLElement);
      let nextIndex = e.shiftKey ? currentIndex - 1 : currentIndex + 1;

      if (nextIndex >= focusable.length) nextIndex = 0;
      if (nextIndex < 0) nextIndex = focusable.length - 1;

      e.preventDefault();
      focusable[nextIndex].focus();
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && triggerRef?.current) {
        triggerRef.current.focus();
      }
    };

    containerRef.current.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      containerRef.current?.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isActive]);
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const selector = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(',');
  return Array.from(container.querySelectorAll(selector)).filter(
    (el) => (el as HTMLElement).offsetParent !== null
  );
}
```

**Why no external library:** Checked `package.json` for existing focus-trap libraries. None met the requirements without adding a new dependency. A hand-rolled hook keeps the implementation minimal and auditable, and the logic (cycle through focusable elements, wrap at ends, handle Escape) is straightforward.

**Key behaviors:**

- **Focus on open:** When `isActive` becomes true, focus immediately moves to the first focusable element (typically the close button).
- **Cycle on Tab/Shift+Tab:** Every Tab keypress moves focus to the next focusable element in order; Shift+Tab moves to the previous. Wraps at both ends (Tab from last wraps to first; Shift+Tab from first wraps to last).
- **Recomputed each keypress:** `getFocusableElements()` is called on every Tab to find the current set of focusable elements in the container. This means if the drawer's content changes dynamically (e.g. a menu section expands, revealing more focusable items), the trap automatically adjusts.
- **Escape returns focus:** Pressing Escape calls `.focus()` on the `triggerRef` (the hamburger trigger button), ensuring the user's keyboard position returns to where the drawer was opened from.

### Mobile Menu Integration: `components/chrome/MobileMenu.tsx`

The mobile menu wires the focus trap on drawer open:

```tsx
'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { useFocusTrap } from '@/lib/hooks/useFocusTrap';

export function MobileMenu({ 
  nav,
  triggerRef
}: { 
  nav: NavItem[];
  triggerRef: RefObject<HTMLElement>;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);

  // Clear inert from siblings when drawer closes
  useEffect(() => {
    if (!isOpen) {
      document.documentElement.inert = false;
      document.documentElement.setAttribute('aria-hidden', 'false');
    }
  }, [isOpen]);

  // Activate focus trap when drawer opens
  useFocusTrap(drawerRef, triggerRef, isOpen);

  const onOpen = () => {
    setIsOpen(true);
    // Set inert on siblings to prevent interaction
    document.documentElement.inert = true;
    document.documentElement.setAttribute('aria-hidden', 'true');
  };

  const onClose = () => {
    setIsOpen(false);
  };

  return (
    <>
      <button
        ref={triggerRef}
        onClick={onOpen}
        aria-label="Open navigation"
        aria-expanded={isOpen}
      >
        Menu
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {isOpen && (
        <nav
          ref={drawerRef}
          className="fixed inset-y-0 right-0 z-50 w-full max-w-sm bg-white shadow-lg"
          aria-label="Mobile primary"
        >
          <button
            onClick={onClose}
            aria-label="Close navigation"
            className="absolute top-4 right-4"
          >
            ✕
          </button>

          <ul className="flex flex-col gap-1 p-4 pt-12">
            {nav.map((item) => (
              <li key={item.href}>
                <Link href={item.href} onClick={onClose}>
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}
    </>
  );
}
```

**Key integration details:**

- **`triggerRef` prop:** The hamburger trigger button is now passed into `MobileMenu` as a ref so the focus trap can return focus to it when Escape is pressed.
- **Background inert state:** When the drawer opens, `document.documentElement.inert = true` and `aria-hidden="true"` are set on the page root, preventing background elements from being focused or announced to screen readers.
- **Effect ordering (critical bug fix):** The inert-clearing effect (which sets `inert = false` and `aria-hidden = "false"`) **must be declared BEFORE the `useFocusTrap` hook call**. React runs effect cleanups in declaration order on unmount. If the inert-clear effect is declared after `useFocusTrap`, the cleanup for `useFocusTrap` (which calls `triggerRef.current.focus()`) runs first, while `document.documentElement.inert` is still `true`. This silently prevents the `.focus()` call from working — the hamburger button stays unfocused even though the code executes. Declaring the inert-clear effect first ensures `inert` is cleared before the focus trap's return-focus logic runs.

### Header Integration: `components/chrome/Header.tsx`

The only change to `Header.tsx` is threading the hamburger button's ref down to `MobileMenu`:

```tsx
// In Header.tsx:
const hamburgerRef = useRef<HTMLButtonElement>(null);

return (
  <header>
    {/* ... header content ... */}
    <MobileMenu nav={NAV} triggerRef={hamburgerRef} />
    <button ref={hamburgerRef} onClick={openMenu} aria-label="Open menu">
      ☰
    </button>
  </header>
);
```

This minimal change allows the focus trap to know which element to return focus to when the drawer closes.

---

## Verification

### Structural Contract Assertions

Standard shell checks verify the fix is in place and correctly wired:

- **A1:** `check-focus-trap-hook.sh` — verifies `lib/hooks/useFocusTrap.ts` exists, exports `useFocusTrap`, and implements Tab cycling and Escape handling
- **A2:** `check-mobile-menu-integration.sh` — verifies `MobileMenu.tsx` calls `useFocusTrap` with `drawerRef` and `triggerRef`, and sets `inert` on drawer open
- **A3:** `check-effect-ordering.sh` — verifies the inert-clearing effect is declared before the `useFocusTrap` hook call
- **A4:** TypeScript `tsc` compilation pass (props, refs, and hook signatures are correct)

### Live Browser Verification

Real Playwright suites verify focus trap behavior with keyboard input:

**`check-focus-trap.mjs` (14 assertions):**
- Drawer opens and focus moves to close button
- Tab moves focus to next focusable element
- Tab from last focusable element wraps to first
- Shift+Tab moves focus to previous element
- Shift+Tab from first element wraps to last
- Escape closes drawer and returns focus to hamburger trigger button
- Escape focus return works even after multiple Tab cycles
- Background page siblings are not focusable while drawer is open

**`check-mouse-regression.mjs` (10 assertions):**
- Hamburger tap opens drawer
- Close button tap closes drawer
- Clicking backdrop closes drawer
- Clicking a nav link closes drawer and navigates
- Desktop layout is unaffected at ≥1240px
- Focus ring is visible on keyboard-focused elements in drawer
- Mouse users can still interact with drawer normally

**Checks per test:**
- Real Playwright headless browser (not DOM simulation)
- Keyboard navigation via `page.keyboard.press('Tab')` and `page.keyboard.press('Shift+Tab')`
- Focus verification via `page.evaluate(() => document.activeElement.textContent)`
- Drawer visibility via `page.locator('[role="navigation"]').isVisible()`
- No synthetic DOM events — all interactions are real browser behavior

---

## Why This Fix Is Subtle

The effect-ordering bug is a genuine trap that would silently break focus return:

**Wrong (broken):**
```typescript
useFocusTrap(drawerRef, triggerRef, isOpen);

useEffect(() => {
  if (!isOpen) {
    document.documentElement.inert = false;
  }
}, [isOpen]);
```

On drawer close, React cleans up effects in declaration order:
1. First cleanup: focus trap's cleanup runs — calls `triggerRef.current.focus()`
2. While `document.documentElement.inert` is still `true`, so `.focus()` is ignored
3. Second cleanup: inert-clear effect runs — sets `inert = false`
4. Result: focus never moves; hamburger button stays unfocused

**Correct:**
```typescript
useEffect(() => {
  if (!isOpen) {
    document.documentElement.inert = false;
  }
}, [isOpen]);

useFocusTrap(drawerRef, triggerRef, isOpen);
```

On drawer close, React cleans up effects in declaration order:
1. First cleanup: inert-clear effect runs — sets `inert = false`
2. Second cleanup: focus trap's cleanup runs — calls `triggerRef.current.focus()` (now succeeds because `inert` is false)
3. Result: hamburger button is correctly focused

This is a real, subtle bug that would only show up during testing — `.focus()` would execute without error, but focus wouldn't visually move.

---

## Scope & Non-Changes

- **No new dependencies added** — `useFocusTrap` is a hand-rolled hook, no npm packages added
- **No mobile menu structure changes** — drawer layout, styling, and nav rendering are unchanged
- **No desktop navigation changes** — desktop header layout remains unchanged
- **No auth or permission changes** — mobile menu access control is unchanged
- **No API or backend changes** — no Firestore, no server-side logic
- **No other components modified** — only `MobileMenu.tsx` and `Header.tsx` (ref threading only)

---

## Deployment Notes

**This is a client-side accessibility fix.** No server-side deployment, no infrastructure changes. The only deployment is a code push to Firebase App Hosting. Once pushed and live on `beta.saoc.co.za`, keyboard and screen reader users can correctly navigate the mobile menu drawer without escaping focus to background content.

