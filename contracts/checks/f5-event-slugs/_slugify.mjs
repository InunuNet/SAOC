// F5 (cms-activation-deploy): the ONE canonical slug-derivation algorithm. Both the
// check scripts (to compute expected values) and @dev's seeding script MUST use this
// exact algorithm — do not reimplement a slightly-different slugifier, or the contract
// checks will legitimately fail against @dev's own output.
//
// Base slug: NFKD-normalise (strips accents on future non-ASCII titles), lowercase,
// collapse every run of non [a-z0-9] characters (spaces, em dashes, punctuation) into
// a single hyphen, trim leading/trailing hyphens.
//
// Collision rule (titles are NOT guaranteed unique — e.g. an annual show recurring
// next year): process documents in a FIXED, deterministic order — date ascending,
// then _id ascending as a tiebreaker for same-date documents — and assign slugs one
// at a time against the set of already-assigned slugs (both pre-existing ones already
// in the dataset, and ones assigned earlier in the same run):
//   1. Try the bare base slug.
//   2. If taken, try `${base}-${year}` where year is the 4-digit year of the
//      document's `date` field (UTC).
//   3. If STILL taken (same title, same year — e.g. a duplicate document), append
//      `-2`, `-3`, ... to the year-qualified slug until free.
//
// Idempotency: a seeding script must only assign a slug to documents whose `slug`
// field is currently empty. Never re-derive or overwrite a slug that already exists —
// slugs are user-visible, effectively-permanent URLs. A second run therefore does
// nothing (every document already has a slug from run 1), which is exactly the
// "stable, no churn" property required.

export function slugifyBase(title) {
  return title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// docs: array of { id, title, date } (date: ISO string, first 4 chars = year).
// existingSlugs: iterable of slug strings already present in the dataset (from
// documents NOT in `docs`, i.e. already-seeded ones) — empty for a from-scratch run.
// Returns: Map<id, slug>.
export function deriveSlugs(docs, existingSlugs = []) {
  const taken = new Set(existingSlugs);
  const ordered = [...docs].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });

  const result = new Map();
  for (const doc of ordered) {
    const base = slugifyBase(doc.title);
    const year = String(doc.date).slice(0, 4);
    let candidate = base;
    if (taken.has(candidate)) {
      candidate = `${base}-${year}`;
    }
    let suffix = 2;
    while (taken.has(candidate)) {
      candidate = `${base}-${year}-${suffix}`;
      suffix += 1;
    }
    taken.add(candidate);
    result.set(doc.id, candidate);
  }
  return result;
}
