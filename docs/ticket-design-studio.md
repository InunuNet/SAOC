# Ticket design studio

The studio lets you choose from the approved design options for a ticket type and watch the real confirmation email and ticket PDF update. It never changes wording and never sends mail. Every ticket type in `lib/ticket-email-copy.ts` is editable: pick one in the "Ticket type" list (VIP is selected first). Each type has its own settings file in `lib/ticket-design/settings/<key>.json` (`early-bird`, `day-visitor`, `weekend-pass`, `vip`, `sunset-cocktails`, `saoc-symposium`, `wosa-conference`, `saoc-wosa-joint`). All start on the same default design, so every email and ticket renders exactly as before the studio. Preview, save and export always act on the selected type, and unsaved changes are kept per type until you save or reset. A new key in `TICKET_EMAIL_COPY` needs a matching settings file, an import in `lib/ticket-design/index.ts` and a sample order in `scripts/ticket-email-sample-fixtures.ts`.

## Run it

1. Set `TICKET_STUDIO_ENABLED=1` in `.env.local`. Never set it in `apphosting.yaml`: without the flag every studio page and route returns 404.
2. Run `pnpm dev` and sign in to `/admin`.
3. Open `/admin/studio`.

Saving and exporting only work on a dev server. Both routes refuse when `NODE_ENV=production`.

## Controls

Every control is a closed list of choices from the approved handoff tokens. Nothing is free-form.

**Both (email and PDF)**

- Accent: royal, purple-700 or olive-700.
- Header ground: royal or purple-700.
- Type size: sm, md or lg.
- Density: compact, standard or relaxed spacing.
- Footer mark: on or off.

**Email only**

- Outer ground: gold-200, gold-100 or white.
- Card ground: gold-100, white or gold-200.
- Header alignment: left or centre.
- QR size: 160, 200 or 240 px.
- Ticket card position: after the intro, or at the top.

**Ticket PDF only**

- Stub ground: gold-200, gold-100 or white.
- Rule colour: olive or royal.
- QR size: 50, 55 or 60 mm.

The Contrast panel shows the WCAG ratio of each accent on its ground. The studio refuses to save a combination under 4.5:1. Reset returns the controls to the last saved settings.

The previews re-render 400 ms after your last change, using the same builders as the live send path and the sample fixtures.

## Where settings save

Save to settings file writes `lib/ticket-design/settings/<ticket-type>.json`. The file is validated first. Review the diff and commit it like any other change. There is no database and no runtime store.

## Export samples

Click Export samples (enabled when you have no unsaved changes). The route writes two PDFs for the selected type into `samples/ticket-emails/`, using the saved settings:

- `email-<ticket-type>.pdf`
- `ticket-<ticket-type>.pdf`

The page lists the paths written. The route has a session guard, accepts only studio-enabled types, and imports nothing that sends mail. To export from the command line, run `pnpm samples:ticket-emails` for every type.

## How a setting reaches the shipped template

1. You save a setting; it lands in `lib/ticket-design/settings/<ticket-type>.json`.
2. `lib/ticket-design/index.ts` imports and validates the file when the module loads. A bad file fails the build, not a send.
3. `buildTicketTypeEmail` and `buildTicketPdf` call `loadShippedDesign(<ticket-type>)` when you pass no design. A ticket type with no settings file uses the default, which reproduces the pre-studio look.
4. Any design you pass explicitly is validated again and rejected if invalid.
5. Once you commit and deploy the file, the live send path and the sample generator both render with it.

Copy comes from `lib/ticket-email-copy.ts` and stays read-only here.
