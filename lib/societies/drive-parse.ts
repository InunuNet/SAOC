/**
 * societies-content F1 — pure parsers, merge and Sanity field mapper for Lee-Ann's two society
 * Drive documents. No I/O here: callers read the markdown and manifests.
 *
 *  (a) "All Society data and history" (21 Oct) — 12 societies, field-detailed. Wins per field.
 *  (b) "Society Contact list - Word" (12 Aug)  — 21 societies, one table cell. Fills only gaps.
 *
 * Lee-Ann's text is reproduced exactly (spellings, capitals, punctuation). The only edits are
 * mechanical: Markdown escapes undone, spreadsheet seconds dropped from times (`10:00:00 AM`),
 * `14H00` rewritten `14:00`, and the "Not supplied" sentinels turned into null.
 */

export interface CommitteeRoles {
  chair: string | null;
  secretary: string | null;
  treasurer: string | null;
  liaison: string | null;
}

export interface ParsedSociety {
  name: string;
  slug: string;
  contactEmail: string | null;
  contactPhone: string | null;
  meetingDay: string | null;
  meetingTime: string | null;
  venue: string | null;
  committee: CommitteeRoles;
  committeeNote: string | null;
  website: string | null;
  facebook: string | null;
  instagram: string | null;
  annualShow: string | null;
  history: string | null;
}

export interface ParseWarning {
  slug: string;
  field: 'website' | 'facebook' | 'instagram';
  reason: 'not-a-url';
  value: string;
}

export interface ContactListEntry {
  name: string;
  slug: string;
  venue: string | null;
  meeting: string | null;
  time: string | null;
  timeNote: string | null;
  email: string;
}

export type MergeSource = 'both' | 'contactList';

export interface MergedSociety extends ParsedSociety {
  sources: MergeSource;
}

export interface MergeReport {
  matched: { detailed: string; contactList: string; via: 'exact' | 'alias' }[];
  contactListOnly: string[];
  emailConflicts: { slug: string; field: 'contactEmail'; detailed: string; contactList: string }[];
  fills: { slug: string; field: string; value: string }[];
}

export interface CommitteeMemberDoc {
  _key: string;
  _type: 'societyCommitteeMember';
  role: string;
  name: string;
}

export interface SocietyDocFields {
  name: string;
  slug: { _type: 'slug'; current: string };
  listed: true;
  contactEmail: string | null;
  contactPhone: string | null;
  meets: string | null;
  venue: string | null;
  committee: CommitteeMemberDoc[] | null;
  committeeNote: string | null;
  website: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  annualShow: string | null;
  description: string | null;
  foundedPlaceholder: false;
  memberCountPlaceholder: false;
  meetPlaceholder: boolean;
  venuePlaceholder: boolean;
  driveSource: string;
}

export interface DriveSourceTags {
  detailed: string;
  contactList: string;
}

/** Contact-list name -> detailed-doc name. The only non-exact matches; flagged for Lee-Ann. */
export const CONTACT_LIST_ALIASES: Readonly<Record<string, string>> = {
  'Die Vlakte Orchid Society': 'Vlakte Orgideevereniging',
  'Pietermaritzburg Orchid Society': 'Pietermaritzberg Orchid Society',
};

/** `<file name>@v<version>#<md5>` for the two source documents, as in their manifests. */
export const DRIVE_SOURCE_TAGS: DriveSourceTags = {
  detailed: 'All Society data and history.docx@v1.0#ccc3d82558d31fd9abe009b323f940ee',
  contactList: 'Society Contact list - Word.docx@v1.0#21926d7550945fbb89e137996acabf90',
};

export interface DriveManifest {
  name: string;
  version: string;
  md5_checksum: string;
}

export function sourceTagFromManifest(manifest: DriveManifest): string {
  return `${manifest.name}@${manifest.version}#${manifest.md5_checksum}`;
}

const SECTIONS: Record<string, readonly string[]> = {
  'Public contact and meetings': [
    'Public contact email',
    'Public contact telephone',
    'Meeting day',
    'Meeting time',
    'Meeting venue',
  ],
  Committee: [
    'Chair/President',
    'Secretary',
    'Treasurer',
    'Liaison for communication',
    'Additional committee information / comments',
  ],
  'Online presence': ['Society website', 'Facebook page', 'Instagram page'],
  'Society history and profile': ['Annual show'],
};

const HISTORY_SECTION = 'Society history and profile';
const NOT_SUPPLIED = /^not supplied$/i;
const HISTORY_NOT_SUPPLIED = /^a society history or profile was not supplied in the form\.?$/i;
const LABEL_LINE = /^\*\*(.+?):\*\*\s*(.*)$/;
const SPREADSHEET_TIME = /^(\d{1,2}:\d{2}):00 (AM|PM)$/;
const CONTACT_TIME = /^(\d{1,2})[Hh](\d{2})$/;
const CLOCK_TIME = /^\d{1,2}:\d{2}$/;
const MARKDOWN_ESCAPE = /\\([\\`*_{}[\]()#+\-.!])/g;

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function unescapeMarkdown(text: string): string {
  return text.replace(MARKDOWN_ESCAPE, '$1');
}

function valueOrNull(raw: string): string | null {
  const value = unescapeMarkdown(raw.trim());
  if (value === '' || NOT_SUPPLIED.test(value)) return null;
  return value;
}

function normaliseSpreadsheetTime(value: string | null): string | null {
  if (value === null) return null;
  const match = SPREADSHEET_TIME.exec(value);
  return match ? `${match[1]} ${match[2]}` : value;
}

/** Link normalisation shared by the parse warnings and the doc mapper. */
export function normaliseLink(
  field: 'website' | 'facebook' | 'instagram',
  value: string | null,
): string | null {
  if (value === null) return null;
  if (/^https?:\/\//i.test(value)) return value;
  if (field === 'website' && /^www\./i.test(value)) return `https://${value}`;
  if (field === 'instagram') {
    const handle = /^@([A-Za-z0-9._]+)$/.exec(value);
    if (handle) return `https://www.instagram.com/${handle[1]}/`;
  }
  return null;
}

interface DraftSociety {
  name: string;
  fields: Record<string, string | null>;
  historyParagraphs: string[];
}

const FIELD_KEYS: Record<string, string> = {
  'Public contact email': 'contactEmail',
  'Public contact telephone': 'contactPhone',
  'Meeting day': 'meetingDay',
  'Meeting time': 'meetingTime',
  'Meeting venue': 'venue',
  'Chair/President': 'chair',
  Secretary: 'secretary',
  Treasurer: 'treasurer',
  'Liaison for communication': 'liaison',
  'Additional committee information / comments': 'committeeNote',
  'Society website': 'website',
  'Facebook page': 'facebook',
  'Instagram page': 'instagram',
  'Annual show': 'annualShow',
};

function finishSociety(draft: DraftSociety, warnings: ParseWarning[]): ParsedSociety {
  const f = (key: string): string | null => draft.fields[key] ?? null;
  const slug = slugify(draft.name);
  for (const field of ['website', 'facebook', 'instagram'] as const) {
    const value = f(field);
    if (value !== null && normaliseLink(field, value) === null) {
      warnings.push({ slug, field, reason: 'not-a-url', value });
    }
  }
  const historyText = draft.historyParagraphs.join('\n\n');
  const history = historyText === '' || HISTORY_NOT_SUPPLIED.test(historyText) ? null : historyText;
  return {
    name: draft.name,
    slug,
    contactEmail: f('contactEmail'),
    contactPhone: f('contactPhone'),
    meetingDay: f('meetingDay'),
    meetingTime: normaliseSpreadsheetTime(f('meetingTime')),
    venue: f('venue'),
    committee: {
      chair: f('chair'),
      secretary: f('secretary'),
      treasurer: f('treasurer'),
      liaison: f('liaison'),
    },
    committeeNote: f('committeeNote'),
    website: f('website'),
    facebook: f('facebook'),
    instagram: f('instagram'),
    annualShow: f('annualShow'),
    history,
  };
}

/** Parse the detailed society doc (a). Throws on an unknown section, label or duplicate slug. */
export function parseSocietiesMarkdown(md: string): {
  societies: ParsedSociety[];
  warnings: ParseWarning[];
} {
  const societies: ParsedSociety[] = [];
  const warnings: ParseWarning[] = [];
  const seen = new Set<string>();
  let draft: DraftSociety | null = null;
  let section: string | null = null;

  const flush = (): void => {
    if (draft) societies.push(finishSociety(draft, warnings));
  };

  for (const rawLine of md.split('\n')) {
    const line = rawLine.trim();
    if (line.startsWith('# ')) {
      flush();
      const name = unescapeMarkdown(line.slice(2).trim());
      const slug = slugify(name);
      if (seen.has(slug)) throw new Error(`duplicate society slug "${slug}" (${name})`);
      seen.add(slug);
      draft = { name, fields: {}, historyParagraphs: [] };
      section = null;
      continue;
    }
    if (!draft || line === '') continue;
    if (line.startsWith('## ')) {
      section = line.slice(3).trim();
      if (!(section in SECTIONS)) {
        throw new Error(`unknown section "${section}" under "${draft.name}"`);
      }
      continue;
    }
    if (section === null) throw new Error(`text outside a section under "${draft.name}": ${line}`);
    const label = LABEL_LINE.exec(line);
    if (label) {
      const [, labelText, rawValue] = label;
      if (!SECTIONS[section].includes(labelText)) {
        throw new Error(`unknown label "${labelText}" in section "${section}" under "${draft.name}"`);
      }
      draft.fields[FIELD_KEYS[labelText]] = valueOrNull(rawValue);
    } else if (section === HISTORY_SECTION) {
      draft.historyParagraphs.push(unescapeMarkdown(line));
    } else {
      throw new Error(`unexpected text in section "${section}" under "${draft.name}": ${line}`);
    }
  }
  flush();
  if (societies.length === 0) throw new Error('no societies found in the detailed document');
  return { societies, warnings };
}

function normaliseContactTime(raw: string, name: string): string {
  const spaced = CONTACT_TIME.exec(raw);
  if (spaced) return `${spaced[1]}:${spaced[2]}`;
  if (CLOCK_TIME.test(raw)) return raw;
  throw new Error(`unrecognised time "${raw}" for "${name}" in the contact list`);
}

const EMAIL_TAIL = '(\\S+@\\S+)';
const SHAPE_FULL = new RegExp(
  `^Venue: (.+?) Meeting: (.+?) \\| Time: (\\S+)(?: (.+?))? ${EMAIL_TAIL}$`,
);
const SHAPE_NO_TIME = new RegExp(`^Venue: (.+?) Meeting: (.+?) ${EMAIL_TAIL}$`);
const SHAPE_EMAIL_ONLY = new RegExp(`^${EMAIL_TAIL}$`);

function parseContactBody(name: string, body: string): ContactListEntry {
  const slug = slugify(name);
  const full = SHAPE_FULL.exec(body);
  if (full) {
    return {
      name,
      slug,
      venue: full[1],
      meeting: full[2],
      time: normaliseContactTime(full[3], name),
      timeNote: full[4] ?? null,
      email: full[5],
    };
  }
  const noTime = SHAPE_NO_TIME.exec(body);
  if (noTime) {
    return {
      name,
      slug,
      venue: noTime[1],
      meeting: noTime[2],
      time: null,
      timeNote: null,
      email: noTime[3],
    };
  }
  const emailOnly = SHAPE_EMAIL_ONLY.exec(body);
  if (emailOnly) {
    return { name, slug, venue: null, meeting: null, time: null, timeNote: null, email: emailOnly[1] };
  }
  throw new Error(`contact-list entry "${name}" fits no known shape: ${body}`);
}

/** Parse the contact-list doc (b): one table cell holding every society. */
export function parseContactListMarkdown(md: string): { entries: ContactListEntry[] } {
  const row = md.split('\n').find((l) => l.startsWith('| ') && !l.startsWith('| ---') && /\*\*/.test(l));
  if (!row) throw new Error('contact list: no societies table row found');
  const text = row
    .replace(/^\|\s*/, '')
    .replace(/\s*\|$/, '')
    .replace(/ /g, ' ');
  const parts = text.split(/\*\*(.+?)\*\*/);
  if (parts[0].trim() !== '') throw new Error(`contact list: text before the first society: ${parts[0]}`);
  const entries: ContactListEntry[] = [];
  const seen = new Set<string>();
  for (let i = 1; i < parts.length; i += 2) {
    const name = parts[i].replace(/\s+/g, ' ').trim();
    const body = (parts[i + 1] ?? '').replace(/\s+/g, ' ').trim().replace(/ \|$/, '').trim();
    const entry = parseContactBody(name, body);
    if (seen.has(entry.slug)) throw new Error(`contact list: duplicate society slug "${entry.slug}"`);
    seen.add(entry.slug);
    entries.push(entry);
  }
  if (entries.length === 0) throw new Error('contact list: no societies found in the table');
  return { entries };
}

function contactMeetingTime(entry: ContactListEntry): string | null {
  const parts = [entry.time, entry.timeNote].filter((p): p is string => p !== null);
  return parts.length > 0 ? parts.join(' ') : null;
}

function noCommittee(): CommitteeRoles {
  return { chair: null, secretary: null, treasurer: null, liaison: null };
}

function fromContactOnly(entry: ContactListEntry): MergedSociety {
  return {
    name: entry.name,
    slug: entry.slug,
    contactEmail: entry.email,
    contactPhone: null,
    meetingDay: entry.meeting,
    meetingTime: contactMeetingTime(entry),
    venue: entry.venue,
    committee: noCommittee(),
    committeeNote: null,
    website: null,
    facebook: null,
    instagram: null,
    annualShow: null,
    history: null,
    sources: 'contactList',
  };
}

function findContactMatch(
  society: ParsedSociety,
  entries: readonly ContactListEntry[],
  aliases: Readonly<Record<string, string>>,
): { entry: ContactListEntry; via: 'exact' | 'alias' } {
  const exact = entries.find((e) => e.name === society.name);
  if (exact) return { entry: exact, via: 'exact' };
  const aliased = entries.find((e) => aliases[e.name] === society.name);
  if (aliased) return { entry: aliased, via: 'alias' };
  throw new Error(`no contact-list entry matches the detailed society "${society.name}"`);
}

/**
 * Merge (a) over (b): (a) wins per field, (b) only fills a field (a) left null. Output order is
 * the detailed societies in doc order, then the contact-list-only ones in list order. Throws when
 * a detailed society has no contact-list entry, or two map to the same entry.
 */
export function mergeSocieties(
  detailed: readonly ParsedSociety[],
  contacts: readonly ContactListEntry[],
  aliases: Readonly<Record<string, string>> = CONTACT_LIST_ALIASES,
): { societies: MergedSociety[]; report: MergeReport } {
  const report: MergeReport = { matched: [], contactListOnly: [], emailConflicts: [], fills: [] };
  const used = new Set<string>();
  const societies: MergedSociety[] = [];

  for (const society of detailed) {
    const { entry, via } = findContactMatch(society, contacts, aliases);
    if (used.has(entry.name)) throw new Error(`contact-list entry "${entry.name}" matched twice`);
    used.add(entry.name);
    report.matched.push({ detailed: society.name, contactList: entry.name, via });

    const merged: MergedSociety = { ...society, sources: 'both' };
    const fill = (field: 'contactEmail' | 'meetingDay' | 'meetingTime' | 'venue', value: string | null) => {
      if (merged[field] === null && value !== null) {
        merged[field] = value;
        report.fills.push({ slug: society.slug, field, value });
      }
    };
    fill('contactEmail', entry.email);
    fill('meetingDay', entry.meeting);
    fill('meetingTime', contactMeetingTime(entry));
    fill('venue', entry.venue);
    if (
      society.contactEmail !== null &&
      society.contactEmail.toLowerCase() !== entry.email.toLowerCase()
    ) {
      report.emailConflicts.push({
        slug: society.slug,
        field: 'contactEmail',
        detailed: society.contactEmail,
        contactList: entry.email,
      });
    }
    societies.push(merged);
  }

  for (const entry of contacts) {
    if (used.has(entry.name)) continue;
    report.contactListOnly.push(entry.name);
    societies.push(fromContactOnly(entry));
  }
  const slugs = new Set(societies.map((s) => s.slug));
  if (slugs.size !== societies.length) throw new Error('duplicate slug in the merged society set');
  return { societies, report };
}

const COMMITTEE_ROLES: readonly { key: keyof CommitteeRoles; role: string; id: string }[] = [
  { key: 'chair', role: 'Chair/President', id: 'chair-president' },
  { key: 'secretary', role: 'Secretary', id: 'secretary' },
  { key: 'treasurer', role: 'Treasurer', id: 'treasurer' },
  { key: 'liaison', role: 'Liaison for communication', id: 'liaison' },
];

function committeeDocs(roles: CommitteeRoles): CommitteeMemberDoc[] | null {
  const members: CommitteeMemberDoc[] = [];
  for (const { key, role, id } of COMMITTEE_ROLES) {
    const name = roles[key];
    if (name !== null) members.push({ _key: id, _type: 'societyCommitteeMember', role, name });
  }
  return members.length > 0 ? members : null;
}

/** Map a merged society to the Sanity `society` fields (no `_id`/`_type`; every optional is null). */
export function toDocFields(merged: MergedSociety, tags: DriveSourceTags): SocietyDocFields {
  const meetsParts = [merged.meetingDay, merged.meetingTime].filter((p): p is string => p !== null);
  const meets = meetsParts.length > 0 ? meetsParts.join(', ') : null;
  return {
    name: merged.name,
    slug: { _type: 'slug', current: merged.slug },
    listed: true,
    contactEmail: merged.contactEmail,
    contactPhone: merged.contactPhone,
    meets,
    venue: merged.venue,
    committee: committeeDocs(merged.committee),
    committeeNote: merged.committeeNote,
    website: normaliseLink('website', merged.website),
    facebookUrl: normaliseLink('facebook', merged.facebook),
    instagramUrl: normaliseLink('instagram', merged.instagram),
    annualShow: merged.annualShow,
    description: merged.history,
    foundedPlaceholder: false,
    memberCountPlaceholder: false,
    meetPlaceholder: meets === null,
    venuePlaceholder: merged.venue === null,
    driveSource:
      merged.sources === 'both' ? `${tags.detailed} + ${tags.contactList}` : tags.contactList,
  };
}
