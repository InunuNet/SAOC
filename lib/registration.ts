// Registration form for the SAOC Symposium, WOSA Conference and Cocktail evening tickets.
// Client-bundle-safe (no firebase-admin): the browser and the checkout route run the same rules.
// Option lists and labels come from Lee-Ann's sheet with Brad's typo fixes; see
// .agent/memory/project/specs/registration-forms/goldens/registration-fields.json.

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
  dietary: ['None', 'Vegetarian', 'Halaal'],
} as const;

export type RegistrationRole = 'primary' | 'partner';

export interface RegistrationPerson {
  role: RegistrationRole;
  title: string;
  firstName: string;
  surname: string;
  preferredName: string;
  mobile: string;
  email: string;
  country: string;
  province?: string | null;
  societies?: string[] | null;
  dietary: string;
}

/** The map stored on the ticket doc: the person minus the email (kept in attendeeEmail). */
export interface RegistrationDoc {
  role: RegistrationRole;
  title: string;
  firstName: string;
  surname: string;
  preferredName: string;
  mobile: string;
  country: string;
  province: string | null;
  societies: string[] | null;
  dietary: string;
}

export type RegistrationValidation =
  | { ok: true; people: RegistrationPerson[] }
  | { ok: false; errors: Record<string, string> };

export const REGISTRATION_MAX_PEOPLE = 2;
export const SOUTH_AFRICA = 'South Africa';
export const SOCIETY_NONE = 'None';

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
  mobile: 'Mobile Number (include country code)',
  email: 'Email address',
  country: 'Country',
  province: 'If South African, select Province',
  societies: 'To which Society do you belong to?',
  dietary: 'Please select from the drop down list',
} as const;

export const REGISTRATION_SECTION_HEADINGS = {
  personal: 'PERSONAL INFORMATION',
  membership: 'MEMBERSHIP',
  dietary: 'DIETARY REQUIREMENTS',
  partner: 'TRAVELLING COMPANION INFORMATION',
} as const;

export const ADD_PARTNER_LABEL = 'Add spouse/partner';
export const REMOVE_PARTNER_LABEL = 'Remove spouse/partner';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type DropdownKey = 'title' | 'country' | 'province' | 'society' | 'dietary';

function isOption(key: DropdownKey, value: string): boolean {
  return (REGISTRATION_OPTIONS[key] as readonly string[]).includes(value);
}

function trimmed(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function validateText(
  raw: Record<string, unknown>,
  key: 'firstName' | 'surname' | 'preferredName',
  max: number,
  errors: Record<string, string>,
  prefix: string
): string {
  const value = trimmed(raw[key]);
  if (value === '') errors[`${prefix}.${key}`] = 'This field is required.';
  else if (value.length > max)
    errors[`${prefix}.${key}`] = `Please use ${max} characters or fewer.`;
  return value;
}

function validateDropdown(
  raw: Record<string, unknown>,
  key: 'title' | 'country' | 'dietary',
  optionKey: DropdownKey,
  errors: Record<string, string>,
  prefix: string
): string {
  const value = trimmed(raw[key]);
  if (value === '') errors[`${prefix}.${key}`] = 'Please choose an option.';
  else if (!isOption(optionKey, value)) errors[`${prefix}.${key}`] = 'Please choose from the list.';
  return value;
}

function validateMobile(value: string, errors: Record<string, string>, prefix: string): void {
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
}

function validateEmail(value: string, errors: Record<string, string>, prefix: string): void {
  if (value === '') errors[`${prefix}.email`] = 'This field is required.';
  else if (value.length > EMAIL_MAX_LENGTH) {
    errors[`${prefix}.email`] = `Please use ${EMAIL_MAX_LENGTH} characters or fewer.`;
  } else if (!EMAIL_PATTERN.test(value)) {
    errors[`${prefix}.email`] = 'Please enter a valid email address.';
  }
}

function validateProvince(
  raw: Record<string, unknown>,
  country: string,
  errors: Record<string, string>,
  prefix: string
): string | null {
  const given = raw.province;
  if (country !== SOUTH_AFRICA) {
    if (given !== null && given !== undefined) {
      errors[`${prefix}.province`] = 'Province applies to South Africa only.';
    }
    return null;
  }
  const value = trimmed(given);
  if (value === '') errors[`${prefix}.province`] = 'Please choose a province.';
  else if (!isOption('province', value))
    errors[`${prefix}.province`] = 'Please choose from the list.';
  return value === '' ? null : value;
}

function validateSocieties(
  raw: Record<string, unknown>,
  role: RegistrationRole,
  errors: Record<string, string>,
  prefix: string
): string[] | null {
  const key = `${prefix}.societies`;
  const given = raw.societies;
  if (role === 'partner') {
    if (given !== null && given !== undefined)
      errors[key] = 'Membership is asked of the buyer only.';
    return null;
  }
  if (!Array.isArray(given) || given.length === 0) {
    errors[key] = 'Please choose at least one option.';
    return null;
  }
  const chosen = given.map((entry) => trimmed(entry));
  if (chosen.some((entry) => !isOption('society', entry))) {
    errors[key] = 'Please choose from the list.';
  } else if (chosen.includes(SOCIETY_NONE) && chosen.length > 1) {
    errors[key] = 'None cannot be combined with a society.';
  }
  return chosen;
}

function validatePerson(
  entry: unknown,
  index: number,
  errors: Record<string, string>
): RegistrationPerson | null {
  const prefix = `people.${index}`;
  if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) {
    errors[prefix] = 'Registration details are required.';
    return null;
  }
  const raw = entry as Record<string, unknown>; // each field is type-checked below
  const role: RegistrationRole = index === 0 ? 'primary' : 'partner';
  if (raw.role !== role) errors[`${prefix}.role`] = `Person ${index + 1} must be the ${role}.`;

  const title = validateDropdown(raw, 'title', 'title', errors, prefix);
  const firstName = validateText(raw, 'firstName', NAME_MAX_LENGTH, errors, prefix);
  const surname = validateText(raw, 'surname', NAME_MAX_LENGTH, errors, prefix);
  const preferredName = validateText(raw, 'preferredName', NAME_MAX_LENGTH, errors, prefix);
  const mobile = trimmed(raw.mobile);
  validateMobile(mobile, errors, prefix);
  const email = trimmed(raw.email);
  validateEmail(email, errors, prefix);
  const country = validateDropdown(raw, 'country', 'country', errors, prefix);
  const province = validateProvince(raw, country, errors, prefix);
  const societies = validateSocieties(raw, role, errors, prefix);
  const dietary = validateDropdown(raw, 'dietary', 'dietary', errors, prefix);

  return {
    role,
    title,
    firstName,
    surname,
    preferredName,
    mobile,
    email,
    country,
    province,
    societies,
    dietary,
  };
}

/**
 * Pure and client-bundle-safe: the same rules run in the browser before the POST and in the
 * checkout route before any Firestore write. One or two people only; the first is the buyer.
 */
export function validateRegistrationGroup(people: unknown): RegistrationValidation {
  if (!Array.isArray(people) || people.length < 1 || people.length > REGISTRATION_MAX_PEOPLE) {
    return {
      ok: false,
      errors: { quantity: 'Registration is for one person, or one person plus a spouse/partner.' },
    };
  }
  const errors: Record<string, string> = {};
  const checked: RegistrationPerson[] = [];
  people.forEach((entry, index) => {
    const person = validatePerson(entry, index, errors);
    if (person) checked.push(person);
  });
  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return { ok: true, people: checked };
}

/** The stored map, keys in the golden order; every optional is null, never undefined. */
export function buildRegistrationDoc(person: RegistrationPerson): RegistrationDoc {
  return {
    role: person.role,
    title: person.title,
    firstName: person.firstName,
    surname: person.surname,
    preferredName: person.preferredName,
    mobile: person.mobile,
    country: person.country,
    province: person.province ?? null,
    societies: person.societies ? [...person.societies] : null,
    dietary: person.dietary,
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
