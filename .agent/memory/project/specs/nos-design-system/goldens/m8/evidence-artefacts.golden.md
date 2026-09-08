# M8 golden — the two evidence artefacts for Codi

R8 closes with *values are proposed against these constraints and approved on a rendered swatch
sheet over both grounds — not asserted from a colour picker.* R9/4 makes the same demand of the
ring. Neither is satisfied by a table of hex codes in a markdown file, including the tables in
this milestone's own goldens.

So M8 ships two rendered artefacts. They are **deliverables, not diagnostics**: @dev produces
them, the gate checks they exist and are fresh, and Codi reviews the pixels.

Both are written by the same driver that runs the assertions, in the same run, from the same
build — an artefact generated separately is an artefact of a different tree.

---

## Artefact 1 — the status swatch sheet

**Path:** `.tmp/sandbox/nos-m8/evidence/status-swatches.png`
**Also:** `.tmp/sandbox/nos-m8/evidence/status-swatches.json` — the measurements, machine-readable.

### What it shows

A grid, rendered inside `.nos-theme`, two ground columns × three state rows, every cell
containing the same specimen so the eye compares like with like.

| | on light (`#fbfaf0`) | on dark (`#1a1445`, `.nos-on-dark`) |
|---|---|---|
| error | specimen | specimen |
| warning | specimen | specimen |
| success | specimen | specimen |

Each **specimen** carries, at the real rendered sizes the tokens will actually be used at:

1. a solid block of the token colour;
2. body-size text in the token colour — this is the case that actually has to clear 4.5:1;
3. a 1px border in the token colour around a neutral field — the banner case
   (`VendorApplyForm.tsx:148`) is a border *and* text, and a border is the thinner, harder case;
4. the state's word and its icon together, so R8/5 is visible rather than asserted;
5. the **measured** ratio printed beneath, read back from the rendered raster by the same
   contrast code the assertions use.

### Why the measurement is printed on the sheet

A swatch sheet with hand-typed ratios is a colour picker with extra steps — precisely what R8
rejects. The number under each cell must come from the raster of the cell above it. If the
value @dev declared and the value the page paints ever diverge, the sheet shows the divergence
instead of hiding it, and `status-swatches.json` carries the same numbers for the gate to grep.

### What Codi is being asked

Not "is 7.95:1 above 4.5:1" — the gate answers that. The sheet asks the questions a gate cannot:

- Is this the **ink register** R8/4 names — deep oxblood, umber, moss — or has something crept
  toward signal-red? Saturation ≤ 0.70 is a proxy for that judgment, not a substitute.
- Do the three states read as **one family**, or as three unrelated colours that each happened
  to pass?
- Does the on-dark member read as the *same state* as its on-light partner? The ±15° hue
  assertion is mechanical; whether the pair reads as one state is a perceptual call. This
  question has already overruled the assertion once: success-on-dark `#8fb89c` sits 11.5°
  off its partner, was approved on register, and the tolerance moved to fit it.
- Does any of this fight the botanical palette it sits inside?

**Codi may substitute values.** Every assertion in this contract tests measured ratio, hue
pairing, saturation and lightness — never a literal hex — so a substituted value that meets the
constraints passes the gate unchanged. That was a deliberate design of the assertion set, and it
is what makes this artefact a real review rather than a rubber stamp.

---

## Artefact 2 — the before/after focus captures

**Path:** `.tmp/sandbox/nos-m8/evidence/focus-390-before.png`, `focus-390-after.png`,
`focus-1280-before.png`, `focus-1280-after.png`
**Also:** `.tmp/sandbox/nos-m8/evidence/focus-measurements.json`.

### What "before" means

The **defect as it ships today**, not a mock of it: the same control, the same route, the same
viewport, captured with the pre-M8 treatment in place. The `ring-ink/40` ring at 2.43:1 has to
be visible as an image, because the argument R9/2 makes — *the colour was never the problem, the
`/40` cost six times the contrast* — is an argument about what a person can see.

@dev captures "before" from the pre-fix tree (`git stash` the M8 changes, capture, restore) or
from a checkout of the parent commit. It is not reconstructed by re-adding the defective class
to a fixed tree; that would be a rendering of the defect rather than the defect.

### What is in each frame

Four controls, chosen because each carries a distinct part of the ruling:

| control | route | what it evidences |
|---|---|---|
| a `VendorFormField` text input | `/national-show/vendors/apply` | Defect A, the nine-site shared class, on a pale ground |
| the apply form's submit button | same | the same defect on a filled control |
| the hero CTA (`Button variant="on-dark"`) | `/national-show` | Defect B — violet ring on `#1a1445`, 2.48:1, *in situ* |
| a `NosEventCard` link | `/national-show` | the double-ring hazard — one indicator before, one after |

Each control appears focused, at 2× device scale, cropped to its bounding box plus 24px so the
ring band and its ground are both in frame.

### Why both viewports

390 and 1280 are not two sizes of the same picture. At 390 the controls are full-width and
adjacent, so a 2px outline at 2px offset can collide with its neighbour; at 1280 they sit in a
row and the ring has room. A ring that is correct at one width and fouled at the other is a real
failure mode this project has already hit once (M7/A33, the pill-to-rectangle corner regression),
and it is invisible in a single-width capture.

### The claim these frames must support

Side by side, "after" must be visibly a focus ring and "before" must be visibly not much. If a
reviewer cannot tell the two apart at a glance, either the fix did not land or the capture is
not showing the focused state — and both of those are failures worth catching before the gate
reports green.

`focus-measurements.json` carries the composited ratio and the `mixFit` α for every control in
every frame, so the visual claim has a number behind it.

---

## Gate treatment

Both artefacts are asserted as **present and fresh**, never as correct. Correctness here is
Codi's judgment, and a gate that claimed to have made it would be lying about what it measured.

- existence: `test -f` on each of the five image paths and the two JSON paths;
- freshness: the JSON files record the `git rev-parse HEAD` they were rendered at, same
  mechanism as `A0_RESULTS_FRESH`, for the same reason — this repo runs no check
  automatically, so a stale artefact greps identically to a fresh one;
- the before-frames are asserted to record the **parent** commit, not HEAD. A "before" capture
  bearing the post-fix commit hash is a re-render of the fixed tree, which is the one way this
  artefact can quietly become worthless.

Nothing under `.tmp/` is ever deleted — see `.claude/rules/sandbox.md`. The evidence
accumulates across runs, which is the intent.
