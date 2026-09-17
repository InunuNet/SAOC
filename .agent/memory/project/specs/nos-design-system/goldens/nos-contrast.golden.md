# NOS palette — WCAG 2.1 contrast table (golden)

Computed 2026-09-07 with the WCAG 2.1 relative-luminance formula (sRGB, `(L1+0.05)/(L2+0.05)`).
Every ratio below is a measured value, not an estimate. Source: `execution/checks/nos_contrast.py`
(F1 deliverable) — the same function reproduces this table exactly.

Bars: **body text ≥ 4.5:1** (1.4.3) · **large text ≥ 3:1** (≥24px, or ≥18.66px bold) ·
**non-text UI / focus indicator ≥ 3:1** (1.4.11).

## Sanctioned palette

| Token | Hex | Role |
|---|---|---|
| `--nos-purple` | `#211A57` | Primary ink. Committee-approved. |
| `--nos-purple-deep` | `#0E0B24` | Night ground for full-bleed imagery. Purple-tinted, never true black. |
| `--nos-ink-muted` | `#55507E` | Muted body copy on light grounds. **Derived**, not from the design system — see note 3. |
| `--nos-olive` | `#A7A841` | Accent on dark grounds; **decorative rule only** on light. Committee-approved. |
| `--nos-olive-deep` | `#7F7D33` | Large text / meaningful UI boundary on light grounds. Committee-approved. |
| `--nos-gold` | `#F3F2D6` | Pale gold ground. Committee-approved. |
| `--nos-white` | `#FFFFFF` | Alternate ground. |
| `--nos-violet` | `#7E3F97` | Accent / link on light grounds. *Emblem-sampled, not committee-ratified.* |
| `--nos-lilac` | `#D8C9EC` | On-dark accent. *Emblem-sampled.* |
| `--nos-lilac-muted` | `#C7B8DE` | Muted copy on dark grounds. **Derived** — see note 3. |
| `--nos-lilac-pale` | `#EAE2F3` | Tint ground. *Emblem-sampled.* |

## Legal text pairings

### Ground: pale gold `#F3F2D6`

| Ink | Ratio | Body 4.5 | Large 3.0 | Verdict |
|---|---:|---|---|---|
| `--nos-purple` `#211A57` | **13.69** | PASS | PASS | Default body + headings |
| `--nos-purple-deep` `#0E0B24` | **16.93** | PASS | PASS | Legal |
| `--nos-ink-muted` `#55507E` | **6.52** | PASS | PASS | Muted copy, captions, meta |
| `--nos-violet` `#7E3F97` | **6.07** | PASS | PASS | Links, accents |
| `--nos-olive-deep` `#7F7D33` | 3.78 | **FAIL** | PASS | **Large text only (≥24px)** |
| `--nos-olive` `#A7A841` | 2.22 | **FAIL** | **FAIL** | **Decorative rule only — never text, never a meaningful border** |
| `--nos-white` `#FFFFFF` | 1.14 | FAIL | FAIL | Forbidden |
| `--nos-lilac` `#D8C9EC` | 1.37 | FAIL | FAIL | Forbidden |
| `--nos-lilac-pale` `#EAE2F3` | 1.11 | FAIL | FAIL | Forbidden |

### Ground: white `#FFFFFF`

| Ink | Ratio | Body 4.5 | Large 3.0 | Verdict |
|---|---:|---|---|---|
| `--nos-purple` `#211A57` | **15.55** | PASS | PASS | Default |
| `--nos-purple-deep` `#0E0B24` | **19.23** | PASS | PASS | Legal |
| `--nos-ink-muted` `#55507E` | **7.41** | PASS | PASS | Muted copy |
| `--nos-violet` `#7E3F97` | **6.90** | PASS | PASS | Links, accents |
| `--nos-olive-deep` `#7F7D33` | 4.30 | **FAIL** | PASS | **Large text only** |
| `--nos-olive` `#A7A841` | 2.52 | **FAIL** | **FAIL** | **Decorative rule only** |
| `--nos-gold` / `--nos-lilac*` | ≤1.56 | FAIL | FAIL | Forbidden |

### Ground: royal purple `#211A57`

| Ink | Ratio | Body 4.5 | Large 3.0 | Verdict |
|---|---:|---|---|---|
| `--nos-white` `#FFFFFF` | **15.55** | PASS | PASS | Legal |
| `--nos-gold` `#F3F2D6` | **13.69** | PASS | PASS | Default on-dark ink |
| `--nos-lilac-pale` `#EAE2F3` | **12.35** | PASS | PASS | Legal |
| `--nos-lilac` `#D8C9EC` | **9.99** | PASS | PASS | Legal |
| `--nos-lilac-muted` `#C7B8DE` | **8.40** | PASS | PASS | Muted on-dark copy |
| `--nos-olive` `#A7A841` | **6.16** | PASS | PASS | **On-dark eyebrows/accents — olive's one legal text use** |
| `--nos-olive-deep` `#7F7D33` | 3.62 | **FAIL** | PASS | Large text only |
| `--nos-violet` `#7E3F97` | 2.26 | FAIL | FAIL | **Forbidden — violet on purple is illegible** |

### Ground: night `#0E0B24`

| Ink | Ratio | Body 4.5 | Large 3.0 | Verdict |
|---|---:|---|---|---|
| `--nos-white` `#FFFFFF` | **19.23** | PASS | PASS | Legal |
| `--nos-gold` `#F3F2D6` | **16.93** | PASS | PASS | Default on-night ink |
| `--nos-lilac-pale` `#EAE2F3` | **15.27** | PASS | PASS | Legal |
| `--nos-lilac` `#D8C9EC` | **12.35** | PASS | PASS | Legal |
| `--nos-lilac-muted` `#C7B8DE` | **10.38** | PASS | PASS | Muted on-night copy |
| `--nos-olive` `#A7A841` | **7.62** | PASS | PASS | Eyebrows/accents |
| `--nos-olive-deep` `#7F7D33` | 4.47 | **FAIL** | PASS | Large text only |
| `--nos-violet` `#7E3F97` | 2.79 | FAIL | FAIL | Forbidden |

### Ground: pale lilac `#EAE2F3`

| Ink | Ratio | Body 4.5 | Large 3.0 | Verdict |
|---|---:|---|---|---|
| `--nos-purple` | **12.35** | PASS | PASS | Default |
| `--nos-purple-deep` | **15.27** | PASS | PASS | Legal |
| `--nos-violet` | **5.47** | PASS | PASS | Links |
| `--nos-ink-muted` `#55507E` | **5.88** | PASS | PASS | Muted copy |
| `--nos-olive-deep` | 3.41 | **FAIL** | PASS | Large text only |
| `--nos-olive` | 2.00 | FAIL | FAIL | Decorative only |

### Ground: olive `#A7A841` (use as a fill behind text is discouraged)

Only `--nos-purple` (6.16) and `--nos-purple-deep` (7.62) are legal inks. Everything else fails,
including white (2.52) and gold (2.22). **Do not place white or gold text on an olive fill.**

## Focus indicators (1.4.11, ≥3:1 against the adjacent ground)

| Ring | Ground | Ratio | Verdict |
|---|---|---:|---|
| `--nos-purple` | pale gold | **13.69** | PASS |
| `--nos-purple` | white | **15.55** | PASS |
| `--nos-gold` | royal purple | **13.69** | PASS |
| `--nos-gold` | night | **16.93** | PASS |

`--nos-focus-ring` therefore flips by context: purple by default, gold inside `.nos-on-night`.
A single fixed ring colour cannot pass on both grounds — this flip is mandatory, not cosmetic.

## Notes — read before using this table

1. **Olive is the trap this table exists for.** `#A7A841` on `#F3F2D6` is **2.22:1**. It fails
   body text, fails large text, and fails even the 3:1 non-text bar — so it is not legal as a
   meaningful border, divider that conveys state, or icon on pale gold either. It is legal on
   light grounds *only* as a purely decorative rule (WCAG 1.4.11 exempts decoration). Its one
   genuinely good text use is **on dark**: 6.16 on purple, 7.62 on night.

2. **Violet is direction-sensitive.** Excellent on light grounds (6.07 gold / 6.90 white), and
   *illegible* on purple (2.26). Never carry a violet accent from a light band into a dark one.

3. **Two derived colours.** `--nos-ink-muted` `#55507E` and `--nos-lilac-muted` `#C7B8DE` are not
   in the committee palette. They exist because the design system supplies no muted-copy value
   that clears 4.5:1, and inventing one is better than shipping olive as body text. Both sit in
   the purple/lilac family and were chosen as the first candidates clearing 4.5:1 on *both*
   grounds in their class. Flag them at design review — they are the two values most likely to be
   revised by the committee.

4. **Any colour not in the sanctioned table is forbidden in NOS CSS.** Contract assertion A6
   enforces this mechanically: every 6-digit hex literal in `nos-theme.css` must be a member of
   the sanctioned set. Adding a colour means coming back to @architect, not editing the stylesheet.

5. Scrims and shadows use `rgba()` decimal notation (purple-tinted, never black) and are
   deliberately outside the hex allowlist. A scrim over photography must be dense enough that the
   text above it clears 4.5:1 against the *composited* result — assert visually in F12, not here.
