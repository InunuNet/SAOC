// F3 (ticketing-conferences-and-events, M2) — DEFECT REPAIR follow-up. The null-category
// read-time fallback in `activeTicketTypesByCategoryQuery` (sanity/queries.ts) keeps
// /tickets non-empty regardless of migration timing, but a permanent, silent fallback risks
// masking a real future data bug forever. This safety valve logs a `console.warn` naming the
// affected slug whenever an admission-page product is relying on the fallback, so an operator
// watching server logs sees it — it never vanishes silently. See
// contracts/golden/ticketing-purchase-pages-f3/README.md, "Defect repair".

const ADMISSION_CATEGORY = 'admission';

interface CategorizableProduct {
  slug: string;
  category?: string | null;
}

/**
 * Warns (via console.warn) for every product in `products` that is missing its `category`
 * field — i.e. relying on the admission-only null-category read-time fallback — but only when
 * `requestedCategory` is `"admission"`, matching the fallback's own admission-only scope. A
 * no-op for every other requested category, and a no-op for any product that already carries
 * an explicit category.
 */
export function warnMissingCategoryFallback(
  products: readonly CategorizableProduct[],
  requestedCategory: string,
): void {
  if (requestedCategory !== ADMISSION_CATEGORY) return;

  for (const product of products) {
    if (product.category == null) {
      console.warn(
        `ticketType "${product.slug}" is missing its category field and is being shown on ` +
          `/tickets via the admission-only null-category fallback — run ` +
          `scripts/migrate-ticket-type-category.ts to backfill it permanently.`,
      );
    }
  }
}
