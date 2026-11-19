import type { ShippedDesign } from './schema';

/** Key order and line grouping of the committed settings files, so a save diffs as values only. */
const EMAIL_LINES = [
  ['accent', 'headerGround', 'typeStep', 'density'],
  ['footerMark', 'outerGround', 'cardGround'],
  ['headerAlign', 'qrPx', 'cardPosition'],
] as const;
const PDF_LINES = [
  ['accent', 'headerGround', 'typeStep', 'density'],
  ['footerMark', 'stubGround', 'ruleColour', 'qrMm'],
] as const;

function block(values: Record<string, unknown>, lines: readonly (readonly string[])[]): string {
  const rows = lines.map(
    (keys) =>
      '    ' + keys.map((key) => `${JSON.stringify(key)}: ${JSON.stringify(values[key])}`).join(', ')
  );
  return `{\n${rows.join(',\n')}\n  }`;
}

/** Serialises a validated design exactly as the committed settings files are laid out. */
export function formatSettings(design: ShippedDesign): string {
  return (
    '{\n' +
    `  "version": ${design.version},\n` +
    `  "slug": ${JSON.stringify(design.slug)},\n` +
    `  "email": ${block({ ...design.email }, EMAIL_LINES)},\n` +
    `  "pdf": ${block({ ...design.pdf }, PDF_LINES)}\n` +
    '}\n'
  );
}
