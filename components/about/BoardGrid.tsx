export interface SanityBoardMember {
  _id: string;
  name: string;
  role: string | null;
  email: string | null;
  order: number | null;
  /** True when this entry is our static fallback, not a Sanity-sourced document; the page never passes one to BoardGrid. */
  placeholder?: boolean;
}

export interface BoardGridProps {
  members: SanityBoardMember[];
}

export function BoardGrid({ members }: BoardGridProps) {
  if (members.length === 0) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
      {members.map((m) => (
        <div
          key={m._id}
          className="border border-rule bg-parchment p-6"
        >
          <h3 className="font-serif font-normal text-[20px] text-ink leading-snug">
            {m.name}
          </h3>
          {m.role ? (
            <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.18em] text-muted">
              {m.role}
            </p>
          ) : null}
          {m.email ? (
            <a
              href={`mailto:${m.email}`}
              className="mt-3 inline-block font-sans text-[13px] text-ink/70 underline-offset-2 hover:underline outline-primary focus-visible:outline-2 focus-visible:outline-solid focus-visible:outline-primary focus-visible:outline-offset-[3px]"
            >
              {m.email}
            </a>
          ) : null}
        </div>
      ))}
    </div>
  );
}
