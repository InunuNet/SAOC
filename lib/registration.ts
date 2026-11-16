// Registration form for the SAOC Symposium, WOSA Conference and Cocktail evening tickets: one full
// form per ticket. Client-bundle-safe (no firebase-admin): the browser and the checkout route run
// the same rules. Option lists and labels come from Lee-Ann's sheet with Brad's typo fixes; see
// .agent/memory/project/specs/registration-forms/goldens/registration-fields.json.
import { MAX_LINE_ITEMS } from '@/lib/tickets-constants';

export const REGISTRATION_OPTIONS = {
  title: ['Mr', 'Mrs', 'Ms', 'Dr.', 'Sir', 'Hon.'],
  country: [
    'Afghanistan',
    'Albania',
    'Algeria',
    'Andorra',
    'Angola',
    'Antigua and Barbuda',
    'Argentina',
    'Armenia',
    'Australia',
    'Austria',
    'Azerbaijan',
    'Bahamas',
    'Bahrain',
    'Bangladesh',
    'Barbados',
    'Belarus',
    'Belgium',
    'Belize',
    'Benin',
    'Bhutan',
    'Bolivia',
    'Bosnia and Herzegovina',
    'Botswana',
    'Brazil',
    'Brunei',
    'Bulgaria',
    'Burkina Faso',
    'Burundi',
    'Cambodia',
    'Cameroon',
    'Canada',
    'Cape Verde',
    'Central African Republic',
    'Chad',
    'Chile',
    'China',
    'Colombia',
    'Comoros',
    'Costa Rica',
    "Cote d'Ivoire",
    'Croatia',
    'Cuba',
    'Cyprus',
    'Czech Republic',
    'Democratic Republic of the Congo',
    'Denmark',
    'Djibouti',
    'Dominica',
    'Dominican Republic',
    'Ecuador',
    'Egypt',
    'El Salvador',
    'Equatorial Guinea',
    'Eritrea',
    'Estonia',
    'Eswatini',
    'Ethiopia',
    'Fiji',
    'Finland',
    'France',
    'Gabon',
    'Gambia',
    'Georgia',
    'Germany',
    'Ghana',
    'Greece',
    'Grenada',
    'Guatemala',
    'Guinea',
    'Guinea-Bissau',
    'Guyana',
    'Haiti',
    'Holy See (Vatican City)',
    'Honduras',
    'Hungary',
    'Iceland',
    'India',
    'Indonesia',
    'Iran',
    'Iraq',
    'Ireland',
    'Israel',
    'Italy',
    'Jamaica',
    'Japan',
    'Jordan',
    'Kazakhstan',
    'Kenya',
    'Kiribati',
    'Kuwait',
    'Kyrgyzstan',
    'Laos',
    'Latvia',
    'Lebanon',
    'Lesotho',
    'Liberia',
    'Libya',
    'Liechtenstein',
    'Lithuania',
    'Luxembourg',
    'Madagascar',
    'Malawi',
    'Malaysia',
    'Maldives',
    'Mali',
    'Malta',
    'Marshall Islands',
    'Mauritania',
    'Mauritius',
    'Mexico',
    'Micronesia',
    'Moldova',
    'Monaco',
    'Mongolia',
    'Montenegro',
    'Morocco',
    'Mozambique',
    'Myanmar',
    'Namibia',
    'Nauru',
    'Nepal',
    'Netherlands',
    'New Zealand',
    'Nicaragua',
    'Niger',
    'Nigeria',
    'North Korea',
    'North Macedonia',
    'Norway',
    'Oman',
    'Pakistan',
    'Palau',
    'Palestine',
    'Panama',
    'Papua New Guinea',
    'Paraguay',
    'Peru',
    'Philippines',
    'Poland',
    'Portugal',
    'Qatar',
    'Republic of the Congo',
    'Romania',
    'Russia',
    'Rwanda',
    'Saint Kitts and Nevis',
    'Saint Lucia',
    'Saint Vincent and the Grenadines',
    'Samoa',
    'San Marino',
    'Sao Tome and Principe',
    'Saudi Arabia',
    'Senegal',
    'Serbia',
    'Seychelles',
    'Sierra Leone',
    'Singapore',
    'Slovakia',
    'Slovenia',
    'Solomon Islands',
    'Somalia',
    'South Africa',
    'South Korea',
    'South Sudan',
    'Spain',
    'Sri Lanka',
    'Sudan',
    'Suriname',
    'Sweden',
    'Switzerland',
    'Syria',
    'Taiwan',
    'Tajikistan',
    'Tanzania',
    'Thailand',
    'Timor-Leste',
    'Togo',
    'Tonga',
    'Trinidad and Tobago',
    'Tunisia',
    'Turkey',
    'Turkmenistan',
    'Tuvalu',
    'Uganda',
    'Ukraine',
    'United Arab Emirates',
    'United Kingdom',
    'United States',
    'Uruguay',
    'Uzbekistan',
    'Vanuatu',
    'Venezuela',
    'Vietnam',
    'Yemen',
    'Zambia',
    'Zimbabwe',
  ],
  province: [
    'Eastern Cape',
    'Free State',
    'Gauteng',
    'KwaZulu-Natal',
    'Limpopo',
    'Mpumalanga',
    'North West',
    'Northern Cape',
    'Western Cape',
  ],
  society: [
    'None',
    'Alfred County Orchid Society',
    'Border Orchid Society',
    'Cape Orchid Society',
    'Die Vlakte Orchid Society',
    'Eastern Province Orchid Society',
    'East Rand Orchid Society',
    'Gonubie Orchid Society',
    'Highway Orchid Society',
    'Lowveld Orchid Group',
    'Natal Orchid Society',
    'Northern Gauteng Orchid Society',
    'Orchid Society of the Southern Cape',
    'Phalaborwa Orchid Society',
    'Pietermaritzburg Orchid Society',
    'Plantae Orchid Group',
    'Rustenburg Orchid Society',
    'Tygerberg Orchid Group',
    'Walker Bay Orchid Society',
    'Witwatersrand Orchid Society',
    'Wolkberg Orchid Society',
    'Zululand Orchid Society',
    'Wild Orchids of Southern Africa',
    'Overseas visitor',
    'Independent Member',
  ],
  attending: [
    'Exhibit Entry - Early bird special',
    'Exhibit Entry - Friday',
    'Exhibit Entry - Saturday',
    'Exhibit Entry - Sunday',
    'Weekend Pass',
    'Sunset Cocktails',
    'SAOC Symposium Early Bird',
    'SAOC Symposium Normal Ticket',
    'SAOC Symposium Speaker',
    'SAOC Symposium Speaker Partner/Spouse',
    'WOSA Symposium Early Bird',
    'WOSA Symposium Normal Ticket',
    'WOSA Symposium Speaker',
    'WOSA Symposium Speaker Partner/Spouse',
  ],
  judgeYesNoNa: ['Yes', 'No', 'Not applicable'],
  judgeOrganisation: ['SAOC', 'AOS', 'Not applicable'],
  judgeDate: ['22-Sep', '23-Sep', '22 & 23 Sept', 'None', 'Not applicable'],
  dietary: ['None', 'Vegetarian', 'Halaal'],
} as const;

export type RegistrationShareSection = 'contact' | 'membership';

/** One attendee's registration as validated: every sheet field, plus the email. */
export interface RegistrationPerson {
  attendeeNumber: number;
  title: string;
  firstName: string;
  surname: string;
  preferredName: string;
  mobile: string;
  email: string;
  country: string;
  province: string | null;
  societies: string[];
  attending: string;
  judgeAccredited: string;
  judgeOrganisation: string;
  judgeAvailable: string;
  judgeDate: string;
  judgeCommunication: string;
  judgeForum: string;
  dietary: string;
  sameAsAttendee1: RegistrationShareSection[];
}

/** The map stored on every ticket doc: the person minus the email (kept in attendeeEmail). */
export type RegistrationDoc = Omit<RegistrationPerson, 'email'>;

export type RegistrationValidation =
  | { ok: true; people: RegistrationPerson[] }
  | { ok: false; errors: Record<string, string> };

export const SOUTH_AFRICA = 'South Africa';
export const SOCIETY_NONE = 'None';
export const SAME_AS_ABOVE_LABEL = 'Same as above';

export const ATTENDING_BY_TICKET: Record<string, string> = {
  'saoc-symposium': 'SAOC Symposium Normal Ticket',
  'wosa-conference': 'WOSA Symposium Normal Ticket',
  'sunset-cocktails-single': 'Sunset Cocktails',
};

/** Which fields each "Same as above" section covers. */
export const SHARE_SECTION_FIELDS: Record<RegistrationShareSection, readonly string[]> = {
  contact: ['mobile', 'country', 'province'],
  membership: ['societies'],
};
export const SHARE_SECTIONS: readonly RegistrationShareSection[] = ['contact', 'membership'];

const NAME_MAX_LENGTH = 100;
const MOBILE_MAX_LENGTH = 30;
const EMAIL_MAX_LENGTH = 254;
const MOBILE_MIN_DIGITS = 7;
const MOBILE_MAX_DIGITS = 15;
const MOBILE_CHARACTERS = /^[\d\s+\-()]+$/;

/** Field labels, verbatim from the sheet with Brad's typo fixes (goldens/registration-fields.json). */
export const REGISTRATION_LABELS = {
  title: 'Title',
  firstName: 'First Name (as per your identity document or passport)',
  surname: 'Surname (as per your identity document or passport)',
  preferredName: 'Preferred name',
  email: 'Email address',
  mobile: 'Mobile Number (include country code)',
  country: 'Country',
  province: 'If South African, select Province',
  societies: 'To which Society do you belong to?',
  attending: 'Please select from the dropdown',
  judgeAccredited: 'Are you an accredited Orchid Judge',
  judgeOrganisation: 'With which Orchid Organisation',
  judgeAvailable: 'Will you be available as a Show Judge at the Show',
  judgeDate: 'Which date would you be available?',
  judgeCommunication: 'Will you be attending the Judges Communication?',
  judgeForum: 'Will you be attending the Judges Forum?',
  dietary: 'Please select from the drop down list',
} as const;

export const REGISTRATION_SECTION_HEADINGS = {
  personal: 'PERSONAL INFORMATION',
  membership: 'MEMBERSHIP',
  booking: 'NATIONAL SHOW BOOKING OPTIONS',
  judges: 'JUDGES EVENTS',
  dietary: 'DIETARY REQUIREMENTS',
} as const;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type OptionKey = keyof typeof REGISTRATION_OPTIONS;
type DropdownField =
  | 'title'
  | 'country'
  | 'attending'
  | 'judgeAccredited'
  | 'judgeOrganisation'
  | 'judgeAvailable'
  | 'judgeDate'
  | 'judgeCommunication'
  | 'judgeForum'
  | 'dietary';

const DROPDOWN_OPTIONS: Record<DropdownField, OptionKey> = {
  title: 'title',
  country: 'country',
  attending: 'attending',
  judgeAccredited: 'judgeYesNoNa',
  judgeOrganisation: 'judgeOrganisation',
  judgeAvailable: 'judgeYesNoNa',
  judgeDate: 'judgeDate',
  judgeCommunication: 'judgeYesNoNa',
  judgeForum: 'judgeYesNoNa',
  dietary: 'dietary',
};
const JUDGE_FIELDS = [
  'judgeAccredited',
  'judgeOrganisation',
  'judgeAvailable',
  'judgeDate',
  'judgeCommunication',
  'judgeForum',
] as const;

type Errors = Record<string, string>;
type Raw = Record<string, unknown>;

function isOption(key: OptionKey, value: string): boolean {
  return (REGISTRATION_OPTIONS[key] as readonly string[]).includes(value);
}

// A null, undefined or empty value counts as missing.
function trimmed(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function textField(raw: Raw, key: string, max: number, errors: Errors, prefix: string): string {
  const value = trimmed(raw[key]);
  if (value === '') errors[`${prefix}.${key}`] = 'This field is required.';
  else if (value.length > max)
    errors[`${prefix}.${key}`] = `Please use ${max} characters or fewer.`;
  return value;
}

function dropdownField(raw: Raw, key: DropdownField, errors: Errors, prefix: string): string {
  const value = trimmed(raw[key]);
  if (value === '') errors[`${prefix}.${key}`] = 'Please choose an option.';
  else if (!isOption(DROPDOWN_OPTIONS[key], value)) {
    errors[`${prefix}.${key}`] = 'Please choose from the list.';
  }
  return value;
}

function mobileField(raw: Raw, errors: Errors, prefix: string): string {
  const value = trimmed(raw.mobile);
  const digits = value.replace(/\D/g, '').length;
  if (value === '') errors[`${prefix}.mobile`] = 'This field is required.';
  else if (value.length > MOBILE_MAX_LENGTH) {
    errors[`${prefix}.mobile`] = `Please use ${MOBILE_MAX_LENGTH} characters or fewer.`;
  } else if (
    !MOBILE_CHARACTERS.test(value) ||
    digits < MOBILE_MIN_DIGITS ||
    digits > MOBILE_MAX_DIGITS
  ) {
    errors[`${prefix}.mobile`] = 'Please enter a valid mobile number, including the country code.';
  }
  return value;
}

function emailField(raw: Raw, errors: Errors, prefix: string): string {
  const value = trimmed(raw.email);
  if (value === '') errors[`${prefix}.email`] = 'This field is required.';
  else if (value.length > EMAIL_MAX_LENGTH) {
    errors[`${prefix}.email`] = `Please use ${EMAIL_MAX_LENGTH} characters or fewer.`;
  } else if (!EMAIL_PATTERN.test(value)) {
    errors[`${prefix}.email`] = 'Please enter a valid email address.';
  }
  return value;
}

function provinceField(raw: Raw, country: string, errors: Errors, prefix: string): string | null {
  const value = trimmed(raw.province);
  if (country !== SOUTH_AFRICA) {
    if (value !== '') errors[`${prefix}.province`] = 'Province applies to South Africa only.';
    return null;
  }
  if (value === '') errors[`${prefix}.province`] = 'Please choose a province.';
  else if (!isOption('province', value))
    errors[`${prefix}.province`] = 'Please choose from the list.';
  return value === '' ? null : value;
}

function societiesField(raw: Raw, errors: Errors, prefix: string): string[] {
  const key = `${prefix}.societies`;
  const given = raw.societies;
  if (!Array.isArray(given) || given.length === 0) {
    errors[key] = 'Please choose at least one option.';
    return [];
  }
  const chosen = given.map((entry) => trimmed(entry));
  if (chosen.some((entry) => !isOption('society', entry))) {
    errors[key] = 'Please choose from the list.';
  } else if (chosen.includes(SOCIETY_NONE) && chosen.length > 1) {
    errors[key] = 'None cannot be combined with a society.';
  }
  return chosen;
}

// The sections this person copies from attendee 1. Attendee 1 has nothing to copy from.
function sharedSections(raw: Raw, index: number, errors: Errors): RegistrationShareSection[] {
  const given = raw.sameAsAttendee1;
  if (given === undefined) return [];
  const valid =
    Array.isArray(given) &&
    given.every((entry) => SHARE_SECTIONS.includes(entry as RegistrationShareSection));
  if (!valid || (index === 0 && given.length > 0)) {
    errors[`people.${index}.sameAsAttendee1`] = 'Please choose from the list.';
    return [];
  }
  return SHARE_SECTIONS.filter((section) => given.includes(section));
}

function validatePerson(
  entry: unknown,
  index: number,
  ticketType: string,
  first: RegistrationPerson | null,
  errors: Errors
): RegistrationPerson | null {
  const prefix = `people.${index}`;
  if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
    errors[prefix] = 'Registration details are required.';
    return null;
  }
  const raw = entry as Raw; // each field is type-checked below
  const shared = sharedSections(raw, index, errors);
  // A section ticked "Same as above" is copied from attendee 1; whatever was sent is overwritten.
  const copyContact = first !== null && shared.includes('contact');
  const copyMembership = first !== null && shared.includes('membership');

  const title = dropdownField(raw, 'title', errors, prefix);
  const firstName = textField(raw, 'firstName', NAME_MAX_LENGTH, errors, prefix);
  const surname = textField(raw, 'surname', NAME_MAX_LENGTH, errors, prefix);
  const preferredName = textField(raw, 'preferredName', NAME_MAX_LENGTH, errors, prefix);
  const email = emailField(raw, errors, prefix);
  const mobile = copyContact ? first.mobile : mobileField(raw, errors, prefix);
  const country = copyContact ? first.country : dropdownField(raw, 'country', errors, prefix);
  const province = copyContact ? first.province : provinceField(raw, country, errors, prefix);
  const societies = copyMembership ? [...first.societies] : societiesField(raw, errors, prefix);
  const attending = dropdownField(raw, 'attending', errors, prefix);
  if (attending !== '' && attending !== ATTENDING_BY_TICKET[ticketType]) {
    errors[`${prefix}.attending`] = 'This must match the ticket being bought.';
  }
  const judges = Object.fromEntries(
    JUDGE_FIELDS.map((key) => [key, dropdownField(raw, key, errors, prefix)])
  ) as Pick<RegistrationPerson, (typeof JUDGE_FIELDS)[number]>;
  const dietary = dropdownField(raw, 'dietary', errors, prefix);

  return {
    attendeeNumber: index + 1,
    title,
    firstName,
    surname,
    preferredName,
    mobile,
    email,
    country,
    province,
    societies,
    attending,
    ...judges,
    dietary,
    sameAsAttendee1: shared,
  };
}

/**
 * Pure and client-bundle-safe: the same rules run in the browser before the POST and in the
 * checkout route before any Firestore write. One person per ticket; attendee 1 is the first. A
 * section ticked "Same as above" is copied from attendee 1 here, whatever the caller sent.
 */
export function validateRegistrationGroup(
  people: unknown,
  ticketType: string
): RegistrationValidation {
  if (!Array.isArray(people) || people.length < 1 || people.length > MAX_LINE_ITEMS) {
    return {
      ok: false,
      errors: { quantity: `Registration is for between 1 and ${MAX_LINE_ITEMS} attendees.` },
    };
  }
  if (!(ticketType in ATTENDING_BY_TICKET)) {
    return { ok: false, errors: { ticketType: 'This ticket does not take a registration.' } };
  }
  const errors: Errors = {};
  const checked: RegistrationPerson[] = [];
  let first: RegistrationPerson | null = null;
  for (const [index, entry] of people.entries()) {
    const person: RegistrationPerson | null = validatePerson(
      entry,
      index,
      ticketType,
      first,
      errors
    );
    if (index === 0) first = person;
    if (person) checked.push(person);
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, people: checked };
}

/** The stored map, keys in the golden order; every optional is null, never undefined. */
export function buildRegistrationDoc(person: RegistrationPerson): RegistrationDoc {
  return {
    attendeeNumber: person.attendeeNumber,
    title: person.title,
    firstName: person.firstName,
    surname: person.surname,
    preferredName: person.preferredName,
    mobile: person.mobile,
    country: person.country,
    province: person.province ?? null,
    societies: [...person.societies],
    attending: person.attending,
    judgeAccredited: person.judgeAccredited,
    judgeOrganisation: person.judgeOrganisation,
    judgeAvailable: person.judgeAvailable,
    judgeDate: person.judgeDate,
    judgeCommunication: person.judgeCommunication,
    judgeForum: person.judgeForum,
    dietary: person.dietary,
    sameAsAttendee1: [...person.sameAsAttendee1],
  };
}

/** The ticket's attendee fields, derived from the registration and never from the client. */
export function registrationAttendee(person: RegistrationPerson): {
  attendeeName: string;
  attendeeEmail: string;
} {
  return {
    attendeeName: `${person.firstName} ${person.surname}`.trim(),
    attendeeEmail: person.email.trim().toLowerCase(),
  };
}

interface RegistrationLineItem {
  ticketType: string;
  attendeeName: string;
  attendeeEmail: string;
  registration?: unknown;
}

export type RegisteredLineItem<T extends RegistrationLineItem> = Omit<T, 'registration'> & {
  registration?: RegistrationPerson;
};

/**
 * The raw `registration` values of each flagged ticket type's line items, in cart order, keyed
 * by ticket type slug. The caller validates every group with validateRegistrationGroup().
 */
export function registrationGroups(
  lineItems: RegistrationLineItem[],
  requiresRegistrationByType: Record<string, boolean>
): Map<string, unknown[]> {
  const groups = new Map<string, unknown[]>();
  for (const item of lineItems) {
    if (requiresRegistrationByType[item.ticketType] !== true) continue;
    groups.set(item.ticketType, [...(groups.get(item.ticketType) ?? []), item.registration]);
  }
  return groups;
}

/**
 * Applies validated groups to the cart. A flagged item's attendee name and email are replaced by
 * its registration's, whatever the client sent; a `registration` on an unflagged item is dropped.
 */
export function applyRegistrations<T extends RegistrationLineItem>(
  lineItems: T[],
  validatedByType: Map<string, RegistrationPerson[]>
): RegisteredLineItem<T>[] {
  const cursor = new Map<string, number>();
  return lineItems.map((item) => {
    const { registration: sent, ...rest } = item;
    // A registration sent for an unflagged type is dropped, never stored.
    void sent;
    const people = validatedByType.get(item.ticketType);
    if (!people) return rest;
    const position = cursor.get(item.ticketType) ?? 0;
    cursor.set(item.ticketType, position + 1);
    const person = people[position];
    return { ...rest, ...registrationAttendee(person), registration: person };
  });
}
