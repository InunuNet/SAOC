# Drive photo rename — brief (Brad 2026-11-09)

Brad, verbatim: "Can we set up a little mission and try and rename the photos in the Google Drive that they have shared? It's really hard to work with pictures when they aren't named properly. Could we have an agent look at each photo, identify the orchid that's in it, and then rename it?"
Then: "We can make a copy of the folders, the photos folder, and we can work on a copy and leave the original as is. I'm happy to download it locally and then re-upload it once we've attempted a rename. Then we will ask Leanne to get somebody to double check it."

## Scope
125 photos in Lee-Ann's "Docs for Brad" Drive folder (1rZJVrYwrWM92vqmPw2c9E_HABQKEQoGa):
- National Show / Photos Supplied / Hedrik Schoeman (82)
- National Show / Previous Shows / 2006 - Nat Show (43)
Speaker headshots and logo files are already named and out of scope.

## Hard rules
- Originals in Drive are never renamed, moved or deleted. Read-only on Drive until F3.
- F3 creates a NEW folder and uploads renamed copies plus the rename map. Nothing else is written.
- Work in .tmp/sandbox/photo-rename/ (manifest.json; orig/ = full-size downloads; small/ = 1024px copies for viewing).
- Identification is a best guess and is labelled so: a person Lee-Ann nominates checks every name.

## Name format
`<Subject> - <date or source> - <original tag>.jpg`
- Subject, most-confident evidence first:
  1. A readable plant label or tag in the photo: its text exactly as written (e.g. "Paphiopedilum Maudiae").
  2. A confident species: "Disa uniflora".
  3. A confident genus only: "Cymbidium hybrid" or "Cymbidium".
  4. Not confident: prefix "CHECK - " with the best genus guess or "Orchid unidentified".
  5. Not one orchid: "Show display - <genus or mixed>", "Venue", "People", "Award ribbon", "Other - <2 words>".
- Date: shot date from the original name (IMG-20250429-WA0001 → 2025-04-29; 20250608_101827 → 2025-06-08). For the Previous Shows WhatsApp images (names carry only the 2026-11-04 send date), use "Previous show" instead of a date.
- Original tag: a short unique piece of the original name (WA0001, 101827, 174507-12) so every file traces back.
- Drive-safe: no / \ ? * : " < > | characters, at most 120 characters.

## Output per photo (JSON lines)
pid, original name, proposed name, evidence (label | species | genus | none), confidence (high | medium | low), south_african_native (yes | no | unknown), banner_quality (good | ok | poor — sharp, well lit, one clear subject), one-line note.
