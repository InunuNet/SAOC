// Block data for the legal and company documents, one source file per document under content/legal/.
// Text carries a deliberately tiny inline subset of her formatting: **bold** and <https://link>.
export type LegalBlock =
  | { kind: 'h2'; text: string }
  | { kind: 'h3'; text: string }
  | { kind: 'p'; text: string }
  | { kind: 'lines'; lines: string[] }
  | { kind: 'list'; items: string[] };

export interface LegalDocument {
  blocks: LegalBlock[];
}

/** A document that opens with her own title line(s), rendered by the page hero (the page's one h1). */
export interface TitledLegalDocument extends LegalDocument {
  title: string;
  /** Her second title line, where she gave one. */
  subtitle?: string;
}
