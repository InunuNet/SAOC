// =============================================================
// SAOC — components/about/Timeline.tsx
// Server Component — renders the founding-to-present timeline used
// as the "Our history" fallback when the aboutPage Sanity document's
// `timelineNodes` portable-text field has no content yet.
// =============================================================

export interface TimelineNode {
  year: string;
  heading: string;
  body: string;
  /** True when this specific node's detail is invented, not council-confirmed. */
  placeholder?: boolean;
}

export interface TimelineProps {
  nodes: TimelineNode[];
}

export function Timeline({ nodes }: TimelineProps) {
  if (nodes.length === 0) return null;

  return (
    <ol className="space-y-10">
      {nodes.map((node, i) => (
        <li
          key={`${node.year}-${i}`}
          data-placeholder={node.placeholder ? 'true' : undefined}
          className="border-l-2 border-accent/50 pl-6"
        >
          <p className="font-mono text-[13px] font-medium tracking-[0.1em] text-primary">
            {node.year}
          </p>
          <h3 className="mt-1 font-serif text-[19px] font-medium leading-snug text-ink">
            {node.heading}
          </h3>
          <p className="mt-2 max-w-2xl font-sans text-[15px] leading-relaxed text-ink/75">
            {node.body}
          </p>
          {node.placeholder ? (
            <p className="mt-3 inline-block border border-rule bg-bone px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.16em] text-muted">
              Detail pending confirmation
            </p>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
