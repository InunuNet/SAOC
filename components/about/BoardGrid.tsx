export interface SanityBoardMember {
  _id: string;
  name: string;
  role: string | null;
  email: string | null;
  order: number | null;
  /** True when this entry is our static fallback, not a Sanity-sourced document. */
  placeholder?: boolean;
}

export interface BoardGridProps {
  members: SanityBoardMember[];
}

export function BoardGrid({ members }: BoardGridProps) {
  if (members.length === 0) return null;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
      {members.map((m) => (
        <div
          key={m._id}
          data-placeholder={m.placeholder ? 'true' : undefined}
          className="border border-rule bg-parchment p-6"
        >
          <h3 className="font-serif text-[20px] font-semibold text-ink leading-snug">
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
              className="mt-3 inline-block font-sans text-[13px] text-ink/70 underline-offset-2 hover:underline"
            >
              {m.email}
            </a>
          ) : null}
          {m.placeholder ? (
            <p className="mt-3 inline-block border border-rule bg-bone px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
              Awaiting confirmation
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}
