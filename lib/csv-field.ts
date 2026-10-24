// CSV cell escaping shared by every CSV export. Pure.

const FORMULA_LEADERS = ['=', '+', '-', '@', '\t', '\r'];

/**
 * A leading formula character gets a single quote so a spreadsheet reads the cell as text, then a
 * field containing a quote, comma or line break is double-quoted with inner quotes doubled.
 */
export function csvField(value: string): string {
  const safe = FORMULA_LEADERS.includes(value.charAt(0)) ? `'${value}` : value;
  if (/[",\r\n]/.test(safe)) return `"${safe.replace(/"/g, '""')}"`;
  return safe;
}
