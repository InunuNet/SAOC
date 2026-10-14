/**
 * Documented maximum lengths of outbound gateway fields (Ozow: https://ozow.com/integrations;
 * PayFast: https://developers.payfast.co.za/docs). Pure, no imports. Every Ozow outbound field
 * plus HashCheck has an entry so a field added later cannot escape the length check.
 */
export const OZOW_FIELD_MAX_LENGTH: Readonly<Record<string, number>> = {
  SiteCode: 50,
  CountryCode: 2,
  CurrencyCode: 3,
  Amount: 10,
  TransactionReference: 50,
  BankReference: 20,
  Optional1: 50,
  Optional2: 50,
  Optional3: 50,
  Optional4: 50,
  Optional5: 50,
  Customer: 100,
  // Ozow's main post-variable table prints CancelUrl as String(50) while another says 150; the
  // conservative reading is enforced because the true cap cannot be verified.
  CancelUrl: 50,
  ErrorUrl: 150,
  SuccessUrl: 150,
  NotifyUrl: 150,
  IsTest: 5,
  HashCheck: 250,
};

export const PAYFAST_FIELD_MAX_LENGTH: Readonly<Record<string, number>> = {
  item_name: 100,
  m_payment_id: 100,
};

export interface FieldLengthViolation {
  field: string;
  length: number;
  max: number;
}

export function findFieldLengthViolations(
  fields: Readonly<Record<string, string>>,
  limits: Readonly<Record<string, number>>,
): FieldLengthViolation[] {
  const violations: FieldLengthViolation[] = [];
  for (const [field, value] of Object.entries(fields)) {
    const max = limits[field];
    if (max !== undefined && value.length > max) {
      violations.push({ field, length: value.length, max });
    }
  }
  return violations;
}

/**
 * Truncates to at most `max` UTF-16 code units (the strictest reading of "String(n)": JS
 * `.length`, never more than a code-point count either gateway could use), without ever
 * splitting a surrogate pair.
 */
export function clampToMaxLength(value: string, max: number): string {
  if (value.length <= max) return value;
  let out = '';
  for (const codePoint of value) {
    if (out.length + codePoint.length > max) break;
    out += codePoint;
  }
  return out;
}
