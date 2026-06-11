'use client';

// =============================================================
// SAOC — components/chrome/NewsletterForm.tsx
// Client subcomponent for the Footer newsletter subscription form.
// No live API — form submission is a no-op placeholder.
// =============================================================

export function NewsletterForm() {
  return (
    <form className="flex flex-col gap-2" onSubmit={(e) => e.preventDefault()}>
      <input
        type="email"
        placeholder="your@email.co.za"
        required
        className="w-full rounded-sm border border-ivory/20 bg-primary-700 px-3 py-2 font-sans text-[14px] text-ivory placeholder:text-ivory/40 outline-none focus:border-ivory/40 transition-colors duration-150"
      />
      <button
        type="submit"
        className="w-full rounded-sm bg-accent px-4 py-2 font-sans text-[14px] font-medium text-ivory hover:bg-accent-soft transition-colors duration-150"
      >
        Subscribe
      </button>
    </form>
  );
}
