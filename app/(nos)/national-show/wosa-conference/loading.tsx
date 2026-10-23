// nos-flash-scroll: route-level fallback for a dynamic NOS route. Renders the existing NOS hero
// geometry (nos-theme.css `.nos-hero`) with an empty copy block, so the first frame is the dark
// hero rather than a grey skeleton. No text, no new tokens.
export default function Loading() {
  return (
    <section
      data-nos-hero="inner"
      data-nos-hero-variant="type"
      aria-busy="true"
      className="nos-on-dark nos-hero nos-hero-inner nos-hero-type"
    >
      <div className="nos-hero-copy" />
    </section>
  );
}
