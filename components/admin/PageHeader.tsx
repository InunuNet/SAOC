interface PageShellProps {
  children: React.ReactNode;
}

/** Content wrapper: 32px padding (16px below 640), max-width 1280. */
export function PageShell({ children }: PageShellProps) {
  return <div className="mx-auto w-full max-w-[1280px] p-4 sm:p-8">{children}</div>;
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

/** H1 (Crimson Pro 600, 32px), a one-line 14px muted subtitle, actions right-aligned and
 *  wrapping under the title below 768. */
export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <h1 className="font-serif text-[32px] font-semibold leading-tight text-ink">{title}</h1>
        {subtitle ? <p className="mt-1 font-sans text-[14px] text-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-3">{actions}</div> : null}
    </div>
  );
}
