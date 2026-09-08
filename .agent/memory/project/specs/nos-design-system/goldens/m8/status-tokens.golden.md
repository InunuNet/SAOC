# M8 golden — semantic status colour in the NOS layer (R8)

Binding reference for F23. Ruling text: `.agent/memory/project/design/nos-design-rulings.md` §R8.
Where this file and a memory of the ruling disagree, the ruling wins and this file is wrong.

---

## 0. The defect this closes

R6/1 said "semantic status colours are excluded from the palette shift". R8 records why
that guardrail was unenforceable: **no status tokens exist anywhere in this codebase.**
There is nothing to exclude. What ships instead is brand paint and raw Tailwind palette
doing a status job:

| site | what it paints | with | reachable headlessly? |
|---|---|---|---|
| `components/vendors/VendorApplyForm.tsx:148-149` | error banner (`role="alert"`) | brand `border-primary-800` + `text-primary-800` | **yes** — `/national-show/vendors/apply` |
| `components/vendors/VendorRegistrationCodeEntryForm.tsx:79` | error banner (`role="alert"`) | brand `border-primary-800` + `text-primary-800` | **yes** — `/national-show/vendors/register`, ungated branch |
| `components/vendors/VendorMarketingFieldset.tsx:62` | bio word-count validation state | raw Tailwind `text-red-700` | no — behind the registration token gate |
| `components/vendors/VendorMarketingUploadField.tsx:97` | upload error (`role="alert"`) | raw Tailwind `text-red-700` | no — behind the gate |
| `app/admin/settings/page.tsx` (×3) | status banner | raw Tailwind palette | out of scope |
| `components/events/SubmitEventForm.tsx` (×9) | validation state | raw Tailwind palette | out of scope |

The first four are in scope. The last two are **not** — see §6.

**The reachability column is load-bearing.** The two originally-audited sites
(`VendorMarketingFieldset`, `VendorMarketingUploadField`) live inside `VendorRegisterForm`,
which `app/(marketing)/national-show/vendors/register/page.tsx` renders **only** when a vendor
registration session token is usable; without one the route renders
`VendorRegistrationCodeEntryForm` instead. `VendorMarketingUploadField` additionally appears in
`VendorRegisterSuccess.tsx:35-46`, which is post-submission and equally unreachable. So a
headless verifier cannot render either one, and an assertion that pretended to would be
measuring nothing.

The two banner sites close that gap: same absence of a status token, both on **public** NOS
routes, both triggerable without a token. They are the rendered evidence for F23. `@dev` still
fixes all four — the gated pair is fixed by source edit and covered by a static assertion; the
ungated pair is fixed and then *measured*.

The four in-scope sites carry **two variants of the same defect**, and both are worth naming:

- the ungated banners paint status with **brand ink** (`primary-800`), so a palette shift
  silently recolours the error state;
- the gated pair paints it with **raw Tailwind `text-red-700`**, which is outside the palette
  altogether and sits in exactly the signal register R8/4 rejects — HSL saturation 0.74
  (Tailwind v3's `#b91c1c`) to 1.00 (v4's oklch red-700, ≈`#c10007`), against the ≤0.70 bound
  this golden sets, and lightness 0.38–0.42 against the ≤0.40 bound.

Neither is a status token. Both are replaced by `var(--status-error)`.

A brand colour used as status paint is the collision R8/1 names: recolour the palette and
the error state recolours with it, so the page stops warning anyone. It is latent today
only because NOS and SAOC brand ink happen to be similar enough to read as "emphasis".

---

## 1. Where the tokens live — and where they must not

| | |
|---|---|
| ✅ declare in | `app/(marketing)/national-show/nos-theme.css`, inside the `.nos-theme` block |
| ❌ never open | `app/globals.css` — the SAOC base layer |

R8/2 is explicit and this mission has no mandate to widen it. The base is not ours; a
token change there has a blast radius across every SAOC route. Declare in the NOS layer
now; **file the gap to the SAOC session as a finding with this audit attached.** When the
base eventually declares these names on `:root`, the NOS block collapses to a set of
overrides and nothing is stranded.

Nothing in this milestone edits `app/globals.css`. An assertion checks it.

## 2. The token set

Six values, three states, two grounds. R8/3: one value cannot clear 4.5:1 on both
`#fbfaf0` and `#1a1445`, so each state declares a pair.

```
--status-error-on-light:    #8f2834
--status-error-on-dark:     #e298a0
--status-warning-on-light:  #714a1e
--status-warning-on-dark:   #d6a164
--status-success-on-light:  #1f5c3e
--status-success-on-dark:   #8fb89c
```

Plus three **ground-resolved aliases**, which are what components actually consume:

```
.nos-theme            { --status-error: var(--status-error-on-light);  … }
.nos-theme .nos-on-dark { --status-error: var(--status-error-on-dark); … }
```

`.nos-on-dark` is applied by `@dev` to any NOS section whose composited ground is
`--primary`, `--primary-800` or `--night`.

### Why the alias indirection is safe here

The mission has been bitten three times by "`var()` resolves at the element that
**declares** the custom property, not the one that uses it" (nos-theme.css's own comment
block records it). That trap does **not** apply to this shape, and the distinction is
worth stating so nobody rewrites it out of caution:

- `--status-error: var(--status-error-on-light)` is a custom-property declaration, so it
  resolves at `.nos-theme` — against literals declared on that same element. Correct.
- `.nos-on-dark` redeclares it, resolving at `.nos-on-dark` — against the same inherited
  literals. Correct.
- A consumer writes `text-[var(--status-error)]`, which Tailwind emits as a **regular
  property** (`color: var(--status-error)`). Regular properties resolve at the using
  element, so the value picked up is whichever `--status-error` is in scope there. That
  is exactly the intended flip.

There is no `--color-*` hop, so there is nothing to resolve prematurely at `:root`.

### Consumption

`text-[var(--status-error)]`, `border-[var(--status-error)]`, and so on. Do **not** add
`--color-status-*` names: Tailwind v4 generates named utilities from the global `@theme`
at-rule only, and that at-rule is global — using it here is precisely the leak the top of
`nos-theme.css` warns against.

## 3. Measured contrast — the values are proposals, the constraints are the ruling

Every ratio below is WCAG 2.x relative-luminance, computed by
`.tmp/sandbox/m8-tokens/search.py`, and re-measured at the composited pixel by the
verifier. R8's last line is binding: *values are proposed against these constraints and
approved on a rendered swatch sheet over both grounds — not asserted from a colour picker.*

| token | value | ground | measured | on the opposite ground |
|---|---|---|---|---|
| `--status-error-on-light` | `#8f2834` | `#fbfaf0` | **7.95:1** | 2.0:1 |
| `--status-error-on-dark` | `#e298a0` | `#1a1445` | **7.51:1** | 2.2:1 |
| `--status-warning-on-light` | `#714a1e` | `#fbfaf0` | **7.42:1** | 2.1:1 |
| `--status-warning-on-dark` | `#d6a164` | `#1a1445` | **7.43:1** | 2.2:1 |
| `--status-success-on-light` | `#1f5c3e` | `#fbfaf0` | **7.54:1** | 2.0:1 |
| `--status-success-on-dark` | `#8fb89c` | `#1a1445` | **7.73:1** | 2.1:1 |

Two things this table is arguing:

1. **4.5:1 is the floor; these land near 7:1.** Same posture as R9/4 — a token that
   measures 4.6:1 is one ground-colour tweak away from failing.
2. **The opposite-ground column is the empirical case for R8/3.** Each member collapses to
   ~2:1 on the other ground. There is no single value that serves both, so the pair is not
   a convenience — it is the only shape that works.

Because the values may change under Codi's review of the swatch sheet, **the assertions
test measured ratio, measured hue constancy and measured saturation bound. They do not
test literal hex strings.** A substituted value that meets the constraints passes.

## 4. Hue constancy and the ink register

**R8/3 — hue held across the pair, lightness moves.** Each pair is generated at one hue;
lightness is what separates its two members. Back-measured from the rendered swatch, per
member rather than per state, because the pairs are not uniformly tight:

| state | member | hue | saturation | lightness |
|---|---|---|---|---|
| error (oxblood) | on-light | 353.0° | 0.56 | 0.36 |
| | on-dark | 353.5° | 0.56 | 0.74 |
| warning (umber) | on-light | 31.8° | 0.58 | 0.28 |
| | on-dark | 32.1° | 0.58 | 0.62 |
| success (moss) | on-light | 150.5° | 0.50 | 0.24 |
| | on-dark | 139.0° | 0.22 | 0.64 |

Error and warning hold hue to 0.5° and saturation exactly — the ideal shape. Success does
not, and that deviation is approved rather than tolerated. See the ruling below.

**Assertion tolerance: the two members of a pair must measure within ±15° of each other,
and register takes precedence within that tolerance.** The number is deliberately looser
than the ±4° this golden first specified. That figure was set to catch "we picked a
lighter red by eye", and it does — but it also rejects a value chosen *correctly*, on the
grounds of a quantity nobody perceives. Recognition is the job, not the number: a reader
must read the on-dark member as the same state as its on-light partner, and 11.5° of
hue does not break that where a wrong register does. Codi, ruling on `#8fb89c`: *a value
that satisfies the rule and looks wrong has satisfied the wrong thing.*

Two consequences worth stating plainly, so neither is discovered later as a surprise:

- **The pair-saturation claim is a description, not a rule.** Success's members measure
  0.22 and 0.50. Nothing asserts equal saturation across a pair, and nothing should — the
  binding saturation constraint is R8/4's ceiling below, which 0.22 clears comfortably.
  Earlier wording here said each pair holds "one fixed HSL saturation"; that was true of
  the values then in hand, not a constraint, and it is no longer true.
- **±15° is a ceiling, not a target.** Error and warning sit at 0.5°. A new pair arriving
  at 14° should be questioned on register before it is accepted on tolerance.

This ruling exists because @dev, applying the approved value, measured the conflict against
this golden and surfaced it instead of nudging the hex back on-hue to make the assertion
pass. That is the behaviour the mission wants: an implementer who finds the spec and the
approved value disagreeing raises it, because exactly one of the two is wrong and it is not
the implementer's call which. Had the value been quietly corrected to ~150°, the swatch
Codi approved and the token shipped would have silently diverged.

**R8/4 — ink, not signal.** Deep oxblood, umber and moss: saturated enough to mean
something, dark enough to belong in a botanical, faintly formal system. Two mechanical
consequences, both asserted:

- HSL saturation ≤ **0.70** on every member. `#ef4444` (Tailwind red-500) is ~0.84 and is
  the register this ruling rejects.
- The on-light member's HSL lightness ≤ **0.40**. "Deep oxblood rather than fluorescent
  red" is a lightness claim as much as a hue one.

## 5. Never colour alone (R8/5)

A state is carried by a **word or an icon** as well as by hue. This is not decoration: it
is what makes a drifted hue degrade to ugly rather than to silent, and it is the only
reason a status system survives a future palette change at all.

Concretely, every element painted with a status token must satisfy at least one of:

- its own visible text is non-empty (the word carries the state), **or**
- it contains an `svg` or `[data-status-icon]` descendant.

Error messaging additionally carries `role="alert"` so the state reaches a screen reader
without depending on visual salience at all.

An element whose only difference from its neighbours is its colour is a defect under this
golden, however good its contrast ratio.

## 6. Non-goals — stated so they are not quietly absorbed

| out of scope | why |
|---|---|
| `app/globals.css` | R8/2. The SAOC base is not this mission's to open. |
| `components/tickets/CategoryTicketsPage.tsx` | Explicitly excluded by the dispatch brief. |
| `components/events/SubmitEventForm.tsx` (×9) | Not a NOS route. |
| `app/admin/settings/page.tsx` (×3), `app/admin/**` | Not under `.nos-theme`. |

The last three are **real defects of the same class** and are recorded here so the audit
that goes to the SAOC session is complete. They are not fixed by this milestone, and a
`@dev` that fixes them anyway has widened a mandate rather than honoured one.

## 7. Verification (R8/6)

**Captured triggered, at 390 and 1280, never at rest.** A status state nobody rendered is
a state nobody checked, and the whole point of this milestone is that the collision was
latent for eight routes.

The verifier must therefore:

1. Assert zero status-bearing elements at rest — proving the trigger did something.
2. Trigger the state (submit the form with required fields empty).
3. Measure every rendered status element at the composited pixel, at both viewports.

### The trigger, exactly

`/national-show/vendors/apply` → click submit with every field empty.

- The `<form>` carries `noValidate` (`VendorApplyForm.tsx:146`), so the browser does not block
  the submission and the handler runs.
- `POST /api/vendors/apply` validates **before** it writes: `validateVendorApplicationInput`
  at `app/api/vendors/apply/route.ts:49` returns 400 with `fieldErrors` at line 51; the
  Firestore `.add()` is line 63-64, downstream of that return. **An empty submission therefore
  writes nothing.** This is deliberate — the verifier must never leave rows behind, and a
  trigger that depended on a successful write would be both destructive and dependent on
  credentials the gate does not have.
- The banner then renders at `VendorApplyForm.tsx:147-157`.

Do **not** trigger via the honeypot branch (`VendorApplyForm.tsx:85-89`). It works, but it
reaches into a field that is `hidden` and `aria-hidden`, so the test would depend on an
anti-spam implementation detail rather than on the ordinary validation path a real vendor hits.

`/national-show/vendors/register` (ungated, no token) is the secondary surface: submitting a
bogus code renders the same banner shape at `VendorRegistrationCodeEntryForm.tsx:79`. Treat it
as a second sample of the same fix, not as an independent case.

Contrast is **never** obtained by regex-parsing `getComputedStyle()`. Tailwind v4
serialises opacity-modified colours as `oklab()`/`color()`, so that returns plausible,
wrong numbers — filed as InunuNet/SAOC#3. Measure the composited pixel, with a negative
control proving the metric can report a failure. Identification of *which* token painted
an element is done by fitting the composited pixel to the ground→token line (the `mixFit`
technique from the R6 probe), not by reading a colour string.

Full harness contract: `verifier-contract.golden.md`.
