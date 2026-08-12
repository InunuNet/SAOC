# Province Filter — Guide for Lee-Ann

This is a plain-language guide to the province buttons on the Societies page
(saoc.co.za/societies — the row of buttons like "WC", "EC", "KZN" that visitors click
to filter societies by province). You don't need to know code — just what one field
does and what happens if you leave it blank.

## What You'll See in Studio

1. Go to Studio and click **"Province"** in the left sidebar
2. You'll see 9 entries — one per South African province
3. Click any one to open it. You'll see:
   - **Name** — the full province name (e.g. "Western Cape")
   - **Code** — the short code shown on the button (e.g. "WC")
   - **Slug** — used internally, you shouldn't need to touch this
   - **Chip Order** — explained below

## What "Chip Order" Does

The province buttons on the website appear in a specific left-to-right order — currently
roughly south-west to north-east across the country, not alphabetical. **Chip Order** is
the number that controls this. A lower number appears further left.

You will not normally need to change this. It's already set correctly for all 9
provinces.

**If you ever leave Chip Order blank on a province** (for example, if a new province
document is ever added without filling it in): that province's button doesn't disappear
and doesn't break the page. It just gets pushed to the **end** of the row, after every
province that does have a number. Nothing else on the site is affected.

## What You Control Here

- The full name of each province (shown to screen readers and in Studio)
- The short code shown on the button
- The left-to-right order of the buttons (Chip Order)

## What You Don't Control Here

- The "All" button — it always appears first and can't be edited or removed. It's part
  of the page itself, not a Studio document.
- Which societies belong to which province — that's set on each individual Society
  document, not here.

## Publishing Changes

As with everything else in Studio: after you edit a province, click **Publish** at the
top right. Changes appear on the live website within about a minute.

Anything else: contact the dev team with a screenshot of what you're seeing.
