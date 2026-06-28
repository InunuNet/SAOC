# Golden: package.json — scripts patch

Add one entry to the existing `"scripts"` object in `package.json`.
Match the existing two-space indentation and `tsx` invocation style already
used by the `seed` script. Add a trailing comma to the prior last entry (`seed`).

## Exact entry to add

```json
"refresh-llms": "tsx scripts/refresh-llms.ts"
```

## Resulting `scripts` block

```json
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "type-check": "tsc --noEmit",
    "seed": "tsx scripts/seed-sanity.ts",
    "refresh-llms": "tsx scripts/refresh-llms.ts"
  },
```

## Notes

- Do **not** add `tsx` as a dependency — it is already resolvable (the `seed`
  script uses it). Only the script entry changes.
- No other key in `package.json` changes.
