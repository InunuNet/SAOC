// =============================================================
// SAOC — components/societies/SocietyExpect.tsx
// Server Component — evergreen "What to expect" section, identical
// across all 21 society pages. It is true of SAOC-affiliated
// societies generally, so it is written as general guidance and is
// explicitly not presented as this society's own confirmed schedule.
// =============================================================

const EXPECTATIONS = [
  {
    heading: 'Regular meetings',
    body: 'Affiliated societies meet on a regular schedule — usually monthly — combining a plant table, a talk or workshop, and time to trade growing advice with other members.',
  },
  {
    heading: 'Shows and displays',
    body: 'Most societies hold at least one annual show, judged under SAOC’s national standards, and many exhibit at the biennial National Show alongside societies from across the country.',
  },
  {
    heading: 'Judging and accreditation',
    body: 'Members can put plants forward for SAOC judging and work toward accredited judge status through the same national training pathway used at every affiliated society.',
  },
  {
    heading: 'Beginners welcome',
    body: 'No experience is required to attend. Growers at every level — from a first orchid on a windowsill to decades on the show bench — are part of the community.',
  },
] as const;

export function SocietyExpect() {
  return (
    <section>
      <span className="eyebrow">What to expect</span>
      <h2 className="mt-3 max-w-2xl font-serif text-[clamp(26px,3vw,36px)] font-medium leading-[1.15] tracking-[-0.01em] text-primary">
        Life at an affiliated orchid society
      </h2>
      <ul className="mt-8 grid grid-cols-1 gap-8 sm:grid-cols-2">
        {EXPECTATIONS.map((item) => (
          <li key={item.heading}>
            <h3 className="font-serif text-[18px] font-medium text-ink">{item.heading}</h3>
            <p className="mt-2 font-sans text-[15px] leading-relaxed text-ink/70">{item.body}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
