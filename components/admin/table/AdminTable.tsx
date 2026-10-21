import type { ColumnDef } from './columns';

// The 44px minimum is the touch-target floor.
const TOUCH_TARGET = 'min-h-[44px]';

const PRIORITY_CELL: Record<ColumnDef['priority'], string> = {
  1: '',
  2: '',
  3: 'hidden lg:table-cell',
};
const PRIORITY_COL: Record<ColumnDef['priority'], string> = {
  1: '',
  2: '',
  3: 'hidden lg:table-column',
};

export interface TableCard {
  title: string;
  status: React.ReactNode;
  fields: { label: string; value: string }[];
}

interface AdminTableProps<T> {
  caption: string;
  columns: readonly ColumnDef[];
  rows: readonly T[];
  getRowId: (row: T) => string;
  renderCell: (columnId: string, row: T) => React.ReactNode;
  /** Full text for the cell's title attribute, shown when the cell truncates. */
  cellTitle?: (columnId: string, row: T) => string | undefined;
  card: (row: T) => TableCard;
  /** When set, the whole card and the row's View control open the record. */
  onOpen?: (row: T) => void;
  emptyText: string;
}

function alignClass(column: ColumnDef): string {
  return column.align === 'right' ? 'text-right tabular-nums' : 'text-left';
}

/**
 * The one table every admin list uses (Codi ruling d): fixed layout so nothing can force a
 * horizontal scroll, priority-3 columns hiding below 1024, stacked cards below 640. Row order
 * is whatever the server sent — newest first — and is never re-sorted here.
 */
export function AdminTable<T>({
  caption,
  columns,
  rows,
  getRowId,
  renderCell,
  cellTitle,
  card,
  onOpen,
  emptyText,
}: AdminTableProps<T>) {
  if (rows.length === 0) {
    return (
      <div className="rounded-[2px] border border-rule bg-parchment px-6 py-16 text-center">
        <p className="font-sans text-[15px] text-muted">{emptyText}</p>
      </div>
    );
  }

  return (
    <>
      <div className="hidden rounded-[2px] border border-rule bg-parchment sm:block">
        <table className="w-full table-fixed border-collapse">
          <caption className="sr-only">{caption}</caption>
          <colgroup>
            {columns.map((column) => (
              <col
                key={column.id}
                style={{ width: column.width }}
                className={PRIORITY_COL[column.priority]}
              />
            ))}
          </colgroup>
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.id}
                  scope="col"
                  className={`sticky top-14 z-10 h-10 truncate border-b border-rule bg-bone px-3 font-mono text-[11px] font-medium uppercase tracking-[0.12em] text-muted lg:top-0 ${alignClass(column)} ${PRIORITY_CELL[column.priority]}`}
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={getRowId(row)} className="h-12 hover:bg-bone/50">
                {columns.map((column) => (
                  <td
                    key={column.id}
                    title={cellTitle?.(column.id, row)}
                    className={`truncate border-b border-rule-soft px-3 py-1 font-sans text-[14px] text-ink ${alignClass(column)} ${PRIORITY_CELL[column.priority]}`}
                  >
                    {renderCell(column.id, row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-col gap-3 sm:hidden">
        {rows.map((row) => {
          const content = card(row);
          const body = (
            <>
              <span className="flex items-start justify-between gap-3">
                <span className="min-w-0 break-words font-sans text-[15px] font-bold text-ink">
                  {content.title}
                </span>
                <span className="shrink-0">{content.status}</span>
              </span>
              <span className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
                {content.fields.map((field) => (
                  <span key={field.label} className="contents">
                    <span className="font-mono text-[11px] uppercase tracking-[0.12em] text-muted">
                      {field.label}
                    </span>
                    <span className="min-w-0 break-words text-right font-sans text-[13px] text-ink">
                      {field.value}
                    </span>
                  </span>
                ))}
              </span>
            </>
          );
          const cardClass = 'block w-full rounded-[2px] border border-rule bg-parchment p-4 text-left';
          return (
            <li key={getRowId(row)} data-admin-card>
              {onOpen ? (
                <button
                  type="button"
                  onClick={() => onOpen(row)}
                  className={`${cardClass} ${TOUCH_TARGET} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40`}
                >
                  {body}
                </button>
              ) : (
                <div className={cardClass}>{body}</div>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}
