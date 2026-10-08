import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Text,
} from '@react-email/components';

import type { VendorBoothType } from '@/types/index';

/** Never blank, never the literal word "undefined" -- see formatBoothNumber below. */
export const BOOTH_NUMBER_PENDING_LABEL = 'To be confirmed';

/** Never blank, never the literal word "undefined" -- see formatOptionalField below. */
export const LOGISTICS_NOT_SPECIFIED_LABEL = 'Not specified';

interface VendorApprovalConfirmationProps {
  businessName: string;
  contactPersonName: string;
  boothNumber?: string | null;
  boothType?: VendorBoothType | null;
  /** Deprecated-in-place (F1, vendor-form-copy-20261007): no fieldset on the live form collects
   *  this any more, but every pre-feature vendorSubmissions document still has it, and
   *  resolveStaffAttendanceDisplay below falls back to it ("stay readable", never removed). */
  staffPerDay?: number | null;
  /** F1 (vendor-form-copy-20261007) -- the 5-row per-day breakdown that replaces staffPerDay on
   *  the live form going forward. Additive only: see resolveStaffAttendanceDisplay below for
   *  the backward-compatible priority rule between this and staffPerDay. */
  staffCountSetupDay?: number | null;
  staffCountDay1?: number | null;
  staffCountDay2?: number | null;
  staffCountDay3?: number | null;
  staffCountBreakdownDay?: number | null;
  /** Nullable since vendor-gated-registration-flow M1: the application-approval call site has
   *  no logistics answers to report, and a non-nullable boolean forced it to assert a `false`
   *  the vendor was never asked for. Omitted/null renders LOGISTICS_NOT_SPECIFIED_LABEL. */
  powerRequired?: boolean | null;
  waterRequired?: boolean | null;
  loadInSlot?: string | null;
  loadOutSlot?: string | null;
  /** F6 (vendor-gated-registration-flow) -- when present, rendered as the convenience link to
   *  the full registration form. Omitted/undefined for the existing full-VendorSubmission
   *  approval call site, which renders exactly as before. Since M4/F24 this is a
   *  `?name=&code=` prefill link (replacing the old `?token=` link shape) -- the vendor still
   *  must submit through the rate-limited verify-code endpoint; the link is not itself a
   *  bypass. */
  registrationLink?: string | null;
  /** F24 (vendor-gated-registration-flow, M4) -- the 4-digit human-readable code, rendered
   *  read-aloud formatted (e.g. "4 8 2 1", never run together as "4821"). Only meaningful
   *  alongside registrationLink. */
  registrationCode?: string | null;
}

/**
 * Formats a 4-digit code for reading aloud -- space-grouped, one digit at a time (e.g.
 * "4 8 2 1"), never the unbroken run "4821". F24's call site always supplies a real code
 * alongside registrationLink, so missing/malformed input here would indicate an upstream data
 * bug -- rendered as an empty string (never the literal word "undefined", and deliberately NOT
 * LOGISTICS_NOT_SPECIFIED_LABEL, which is reserved for the unrelated full-registration
 * logistics recap and must never appear on the application-approval branch).
 */
export function formatRegistrationCodeForReadAloud(value: string | null | undefined): string {
  if (!value || !/^\d+$/.test(value)) {
    return '';
  }
  return value.split('').join(' ');
}

/**
 * Trims the value; a non-empty result is returned as-is. Anything else (missing, `null`,
 * empty, or whitespace-only) returns BOOTH_NUMBER_PENDING_LABEL -- NEVER a raw template-literal
 * interpolation of a possibly-undefined boothNumber, and NEVER the literal string "undefined".
 */
export function formatBoothNumber(value: string | null | undefined): string {
  const trimmed = value?.trim();
  return trimmed ? trimmed : BOOTH_NUMBER_PENDING_LABEL;
}

/**
 * `null`/`undefined`/empty-string -> LOGISTICS_NOT_SPECIFIED_LABEL; `boolean` -> 'Yes'/'No' (so
 * powerRequired/waterRequired never render as the literal words `true`/`false`); otherwise
 * `String(value)`. NEVER a bare `${value}` interpolation of a possibly-undefined field.
 */
export function formatOptionalField(value: string | number | boolean | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return LOGISTICS_NOT_SPECIFIED_LABEL;
  }
  if (typeof value === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  return String(value);
}

/** Input shape for resolveStaffAttendanceDisplay -- deliberately narrower than the full
 *  component props above (no booth/logistics fields), so the decision function can be
 *  exercised directly by a fixture without constructing an entire props object. */
export interface StaffAttendanceDisplayInput {
  staffPerDay?: number | null;
  staffCountSetupDay?: number | null;
  staffCountDay1?: number | null;
  staffCountDay2?: number | null;
  staffCountDay3?: number | null;
  staffCountBreakdownDay?: number | null;
}

export type StaffAttendanceDisplay =
  | { mode: 'breakdown'; days: Array<{ label: string; value: string }> }
  | { mode: 'legacy'; value: string }
  | { mode: 'none' };

const STAFF_COUNT_DAY_FIELDS: ReadonlyArray<{
  key: keyof Omit<StaffAttendanceDisplayInput, 'staffPerDay'>;
  label: string;
}> = [
  { key: 'staffCountSetupDay', label: 'Setup Day' },
  { key: 'staffCountDay1', label: 'Day 1' },
  { key: 'staffCountDay2', label: 'Day 2' },
  { key: 'staffCountDay3', label: 'Day 3' },
  { key: 'staffCountBreakdownDay', label: 'Breakdown Day' },
];

/**
 * F1 (vendor-form-copy-20261007) -- additive, backward-compatible staff-attendance display
 * decision, alongside this file's other formatting helpers (same convention: formatting logic
 * lives here, not in lib/vendor-approval-confirmation.ts, so it is exercised identically
 * whether the caller is sendVendorApprovalConfirmationEmail or a direct render() in a test).
 *
 * 'breakdown' wins whenever any staffCount* field is non-null -- the more granular, newer-
 * shaped data -- even when the legacy staffPerDay is also present (architect's priority rule:
 * this combination cannot arise from this feature's own write paths, but the function must
 * still answer it rather than fall through to undefined). Falls back to 'legacy' (the single
 * original "Staff per day" line) when only staffPerDay is set, and 'none' (the existing "Not
 * specified" behaviour, unchanged) when neither is populated.
 */
export function resolveStaffAttendanceDisplay(
  input: StaffAttendanceDisplayInput,
): StaffAttendanceDisplay {
  const hasBreakdown = STAFF_COUNT_DAY_FIELDS.some(
    ({ key }) => input[key] !== null && input[key] !== undefined,
  );
  if (hasBreakdown) {
    return {
      mode: 'breakdown',
      days: STAFF_COUNT_DAY_FIELDS.map(({ key, label }) => ({
        label,
        value: formatOptionalField(input[key]),
      })),
    };
  }
  if (input.staffPerDay !== null && input.staffPerDay !== undefined) {
    return { mode: 'legacy', value: formatOptionalField(input.staffPerDay) };
  }
  return { mode: 'none' };
}

/**
 * Vendor approval confirmation email (mission vendor-registration F8). Modelled on
 * emails/VendorRegistrationConfirmation.tsx -- no invented brand colours/typography (project
 * rule), no regulatory permit non-verification note (that is a later feature's concern, not
 * this one's). See contracts/golden/vendor-f8-approval-email/README.md.
 *
 * Every one of the seven logistics recap fields is routed through formatBoothNumber or
 * formatOptionalField before it reaches JSX text -- none is interpolated directly.
 */
export default function VendorApprovalConfirmation({
  businessName,
  contactPersonName,
  boothNumber,
  boothType,
  staffPerDay,
  staffCountSetupDay,
  staffCountDay1,
  staffCountDay2,
  staffCountDay3,
  staffCountBreakdownDay,
  powerRequired,
  waterRequired,
  loadInSlot,
  loadOutSlot,
  registrationLink,
  registrationCode,
}: VendorApprovalConfirmationProps) {
  return (
    <Html>
      <Head />
      <Preview>
        {registrationLink
          ? 'Your SAOC vendor application has been approved'
          : 'Your SAOC vendor registration has been approved'}
      </Preview>
      <Body style={{ fontFamily: 'sans-serif', backgroundColor: '#f9f9f9', margin: '0', padding: '0' }}>
        <Container style={{ maxWidth: '600px', margin: '0 auto', padding: '24px', backgroundColor: '#ffffff' }}>
          <Heading style={{ fontSize: '24px', color: '#1a1a1a' }}>
            {registrationLink ? 'Vendor Application Approved' : 'Vendor Registration Approved'}
          </Heading>
          <Text style={{ fontSize: '16px', color: '#333' }}>
            Dear {contactPersonName},
          </Text>
          {registrationLink ? (
            <>
              <Text style={{ fontSize: '16px', color: '#333' }}>
                Good news -- your vendor application for <strong>{businessName}</strong> at the
                SAOC National Show has been approved.
              </Text>
              <Heading as="h2" style={{ fontSize: '18px', color: '#1a1a1a' }}>
                Your registration code
              </Heading>
              <Text style={{ fontSize: '24px', color: '#1a1a1a', letterSpacing: '2px' }}>
                {businessName}-{formatRegistrationCodeForReadAloud(registrationCode)}
              </Text>
              <Text style={{ fontSize: '16px', color: '#333' }}>
                Go to the full registration form and enter your business name and this 4-digit
                code to continue. Keep this code -- you (or the show office) may need to read it
                aloud.
              </Text>
              <Text style={{ fontSize: '16px', color: '#333' }}>
                <a href={registrationLink}>{registrationLink}</a>
              </Text>
              <Hr />
            </>
          ) : (
            <>
              <Text style={{ fontSize: '16px', color: '#333' }}>
                Good news -- your vendor registration for <strong>{businessName}</strong> at the
                SAOC National Show has been approved.
              </Text>
              <Text style={{ fontSize: '16px', color: '#333' }}>
                Your booth number: <strong>{formatBoothNumber(boothNumber)}</strong>
              </Text>
              <Hr />
              <Heading as="h2" style={{ fontSize: '18px', color: '#1a1a1a' }}>
                Your submitted logistics (please verify)
              </Heading>
              <Text style={{ fontSize: '16px', color: '#333' }}>
                Please check the details below against what you submitted, and let us know as
                soon as possible if anything needs correcting before show day.
              </Text>
              <Text style={{ fontSize: '16px', color: '#333' }}>
                Booth number: {formatBoothNumber(boothNumber)}
              </Text>
              <Text style={{ fontSize: '16px', color: '#333' }}>
                Booth type: {formatOptionalField(boothType)}
              </Text>
              {(() => {
                const staffAttendance = resolveStaffAttendanceDisplay({
                  staffPerDay,
                  staffCountSetupDay,
                  staffCountDay1,
                  staffCountDay2,
                  staffCountDay3,
                  staffCountBreakdownDay,
                });
                if (staffAttendance.mode === 'breakdown') {
                  return staffAttendance.days.map((day) => (
                    <Text key={day.label} style={{ fontSize: '16px', color: '#333' }}>
                      Staff per day — {day.label}: {day.value}
                    </Text>
                  ));
                }
                return (
                  <Text style={{ fontSize: '16px', color: '#333' }}>
                    Staff per day:{' '}
                    {staffAttendance.mode === 'legacy'
                      ? staffAttendance.value
                      : LOGISTICS_NOT_SPECIFIED_LABEL}
                  </Text>
                );
              })()}
              <Text style={{ fontSize: '16px', color: '#333' }}>
                Power required: {formatOptionalField(powerRequired)}
              </Text>
              <Text style={{ fontSize: '16px', color: '#333' }}>
                Water required: {formatOptionalField(waterRequired)}
              </Text>
              <Text style={{ fontSize: '16px', color: '#333' }}>
                Load-in slot: {formatOptionalField(loadInSlot)}
              </Text>
              <Text style={{ fontSize: '16px', color: '#333' }}>
                Load-out slot: {formatOptionalField(loadOutSlot)}
              </Text>
              <Hr />
            </>
          )}
          <Text style={{ fontSize: '12px', color: '#999', marginTop: '24px' }}>
            South African Orchid Council — saoc.co.za
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
