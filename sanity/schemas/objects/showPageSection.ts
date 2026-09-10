import { defineField, defineType } from 'sanity';

// F1 (national-show-ia-alignment, M1) — one section within a showPage document.
//
// `provenance` is THE MISSION ASSERTION. See
// .agent/memory/project/specs/national-show-ia-alignment/goldens/m1/provenance-gate.golden.md.
// Three values, no more, no fewer — and deliberately NO initialValue. Sanity's
// required-field validation then blocks publication until an editor makes an
// explicit, conscious choice; there is no state in which the system guesses on the
// council's behalf. Contrast sanity/schemas/documents/society.ts's placeholder
// booleans, every one `initialValue: false` — a safe-looking default that in fact
// asserts "confirmed fact" for any document created without deliberately setting it.
//
// `kind` DOES carry an initialValue ('prose'), and that is fine — `kind` is a
// rendering selector, not a truth claim about the copy. Do not read the two fields
// as needing the same treatment.

// The only two trees a council source may live under — mirrors
// lib/data/show-pages.ts's identically-named function. This half runs inside Sanity
// Studio's browser bundle (schema validation), so it is a pure string check with no
// `fs`/`path` import: it rejects a malformed path at entry, but cannot prove the file
// exists (that needs disk access, which the schema doesn't have). The loader's copy
// re-checks well-formedness AND existence AND resolved-path containment at render —
// neither layer trusts the other. Fixes the hole Codex's cross-model review found:
// a bare "does this string start with the right prefix" check does not stop
// "content/drive-source/../../../etc/hosts", which starts with the right prefix and
// then walks straight out of it.
function isWellFormedSourcePath(value: string): boolean {
  const isAbsolute = value.startsWith('/') || /^[a-zA-Z]:[\\/]/.test(value);
  if (isAbsolute) return false;
  if (value.split(/[\\/]/).some((segment) => segment === '..')) return false;
  const allowedRoots = ['content/drive-source', 'content/drive-recovered'];
  return allowedRoots.some((root) => value === root || value.startsWith(`${root}/`));
}

export const showPageSection = defineType({
  name: 'showPageSection',
  title: 'Show Page Section',
  type: 'object',
  fields: [
    defineField({
      name: 'sectionKey',
      title: 'Section Key',
      type: 'string',
      description: 'Stable, lowercase-kebab, unique within the page. The seed script keys off it.',
      validation: (Rule) => Rule.required(),
    }),
    defineField({
      name: 'heading',
      title: 'Heading',
      type: 'string',
      description: 'Optional. Leave blank for the section to render without its own heading.',
    }),
    defineField({
      name: 'kind',
      title: 'Kind',
      type: 'string',
      options: {
        list: [
          { title: 'Prose', value: 'prose' },
          { title: 'Entity list (M2)', value: 'entityList' },
          { title: 'Programme (M2)', value: 'programme' },
        ],
      },
      initialValue: 'prose',
      validation: (Rule) => Rule.required(),
      description:
        'M1 implements only "prose". "entityList" and "programme" are reserved for M2 ' +
        '(exhibitor/guest directories and session programmes) and render nothing yet.',
    }),
    defineField({
      name: 'body',
      title: 'Body',
      type: 'portableText',
      validation: (Rule) =>
        Rule.custom((value, context) => {
          const parent = context.parent as { kind?: string } | undefined;
          if (parent?.kind === 'prose' && (!value || (Array.isArray(value) && value.length === 0))) {
            return 'Body is required for prose sections.';
          }
          return true;
        }),
    }),
    defineField({
      name: 'provenance',
      title: 'Provenance',
      type: 'string',
      options: {
        list: [
          { title: 'Council-supplied', value: 'council-supplied' },
          { title: 'Research (verified, not council-confirmed)', value: 'research' },
          { title: 'Placeholder (AI-generated)', value: 'placeholder-ai' },
        ],
      },
      // NO initialValue. See the file header — this is the whole safety property.
      validation: (Rule) => Rule.required(),
      description:
        'Did the council write these words, or did we? Required — Sanity will not let this ' +
        'publish unset. See provenance-gate.golden.md.',
    }),
    defineField({
      name: 'sourcePath',
      title: 'Source Path',
      type: 'string',
      description:
        'Repo-relative path under content/drive-source/ or content/drive-recovered/ naming the ' +
        'council document this copy came from. Required when provenance is council-supplied. ' +
        'No absolute path and no ".." traversal — this is a security boundary, not a style rule.',
      validation: (Rule) =>
        Rule.custom((value, context) => {
          const parent = context.parent as { provenance?: string } | undefined;
          if (parent?.provenance !== 'council-supplied') return true;
          if (!value) {
            return 'sourcePath is required when provenance is council-supplied.';
          }
          if (!isWellFormedSourcePath(value)) {
            return (
              'sourcePath must be a repo-relative path under content/drive-source/ or ' +
              'content/drive-recovered/ — no absolute path, no ".." traversal.'
            );
          }
          return true;
        }),
    }),
    defineField({
      name: 'seedHash',
      title: 'Seed Hash',
      type: 'string',
      hidden: true,
      readOnly: true,
      description:
        'Written by scripts/seed-show-pages.ts only. Holds a hash of the body the script last ' +
        'wrote, so a re-run can tell "we wrote this and nobody has touched it" from "a human ' +
        'edited this". Never read by the site.',
    }),
  ],
  preview: {
    select: { title: 'heading', subtitle: 'provenance', key: 'sectionKey' },
    prepare: ({ title, subtitle, key }) => ({
      title: title || key || 'Untitled section',
      subtitle: subtitle ? `provenance: ${subtitle}` : 'provenance: (unset)',
    }),
  },
});
