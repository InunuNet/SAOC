import type { CSSProperties, ReactNode } from 'react';
import { Head, Html, Img, Preview } from '@react-email/components';

import { FOOTER_REG } from '@/components/chrome/footer-data';

/**
 * Shared email chrome (mission email-shell). Design source: Codi's final ruling, see
 * .agent/memory/project/specs/email-shell/goldens/design-ruling.md. Table layout, inline CSS,
 * one <style> (the <=620px stack and the Outlook.com dark guard).
 *
 *   A  Show transactional   NOS    royal header + footer with the reversed-gold logos
 *   B  Show message         NOS    same chrome as A
 *   C  Admin notice         NOS-light   4px royal top rule, no logo band, no <img>
 *   D  Council              SAOC   pending a Codi spec: accepted by the type, not usable yet
 */
export type EmailShellFamily = 'A' | 'B' | 'C' | 'D';
export type EmailShellUsableFamily = Exclude<EmailShellFamily, 'D'>;

export const ROYAL = '#211a57';
export const GOLD = '#f3f2d6';
export const GOLD_100 = '#fbfaf0';
export const INK_700 = '#3a3654';
export const RULE = '#e3e1c9';

const HEADING_FONT = 'Fraunces, Georgia, serif';
const BODY_FONT = 'Karla, Arial, Helvetica, sans-serif';

const CONTAINER_WIDTH = 600;
const STACK_BREAKPOINT = 620;
const GUTTER = 40;
const HEADER_LOGO_WIDTH = 280;
const HEADER_LOGO_HEIGHT = 69;
const FOOTER_LOCKUP_WIDTH = 120;
const FOOTER_LOCKUP_HEIGHT = 105;
const LOGO_ALT = 'National Orchid Show 2027';
const FOOTER_LINE = 'South African Orchid Council — saoc.co.za';

/** SITE_URL is only available at App Hosting runtime; same fallback as lib/confirmation-email.ts. */
const DEFAULT_SITE_URL = 'https://saoc.co.za';

function logoUrl(file: string): string {
  const origin = (process.env['SITE_URL'] ?? DEFAULT_SITE_URL).replace(/\/+$/, '');
  return `${origin}/images/email/${file}`;
}

const SHELL_CSS = `
  :root { color-scheme: light; supported-color-schemes: light; }
  @media only screen and (max-width: ${STACK_BREAKPOINT}px) {
    .shell-container { width: 100% !important; }
    .shell-gutter { padding-left: 20px !important; padding-right: 20px !important; }
    .shell-label, .shell-value { display: block !important; width: 100% !important; }
  }
  [data-ogsc] .shell-royal { background-color: ${ROYAL} !important; }
  [data-ogsc] .shell-card { background-color: ${GOLD_100} !important; }
  [data-ogsc] .shell-outer { background-color: ${GOLD} !important; }
  [data-ogsc] .shell-ink { color: ${INK_700} !important; }
`;

/** Legacy `bgcolor` attribute (Outlook/dark-mode clients), absent from React's HTML typings. */
const bgAttr = (hex: string): { bgcolor: string } => ({ bgcolor: hex });

const resetCell: CSSProperties = { margin: 0, padding: 0 };

interface EmailShellProps {
  family: EmailShellUsableFamily;
  /** Hidden inbox preheader. Each template passes its existing <Preview> text unchanged. */
  preview: string;
  children: ReactNode;
}

function Header() {
  return (
    <tr>
      <td
        className="shell-royal"
        {...bgAttr(ROYAL)}
        align="left"
        style={{ backgroundColor: ROYAL, padding: `28px ${GUTTER}px` }}
      >
        <Img
          src={logoUrl('nos-reversed-gold-horizontal-560.png')}
          alt={LOGO_ALT}
          width={HEADER_LOGO_WIDTH}
          height={HEADER_LOGO_HEIGHT}
          style={{ display: 'block', border: 0, width: `${HEADER_LOGO_WIDTH}px`, height: 'auto' }}
        />
      </td>
    </tr>
  );
}

function RoyalFooter() {
  return (
    <tr>
      <td
        className="shell-royal"
        {...bgAttr(ROYAL)}
        align="center"
        style={{ backgroundColor: ROYAL, padding: `28px ${GUTTER}px`, textAlign: 'center' }}
      >
        <Img
          src={logoUrl('nos-reversed-gold-vertical-240.png')}
          alt={LOGO_ALT}
          width={FOOTER_LOCKUP_WIDTH}
          height={FOOTER_LOCKUP_HEIGHT}
          style={{
            display: 'block',
            border: 0,
            margin: '0 auto',
            width: `${FOOTER_LOCKUP_WIDTH}px`,
            height: 'auto',
          }}
        />
        <p
          style={{
            margin: '24px 0 0',
            fontFamily: BODY_FONT,
            fontSize: '11px',
            lineHeight: '16px',
            color: GOLD,
          }}
        >
          {FOOTER_REG}
        </p>
        <p
          style={{
            margin: '8px 0 0',
            fontFamily: BODY_FONT,
            fontSize: '13px',
            lineHeight: '18px',
            color: GOLD,
          }}
        >
          {FOOTER_LINE}
        </p>
      </td>
    </tr>
  );
}

function PlainFooter() {
  return (
    <tr>
      <td
        className="shell-card shell-gutter"
        {...bgAttr(GOLD_100)}
        style={{ backgroundColor: GOLD_100, padding: `0 ${GUTTER}px 32px` }}
      >
        <p
          className="shell-ink"
          style={{
            margin: 0,
            fontFamily: BODY_FONT,
            fontSize: '13px',
            lineHeight: '18px',
            color: INK_700,
          }}
        >
          {FOOTER_LINE}
        </p>
      </td>
    </tr>
  );
}

export default function EmailShell({ family, preview, children }: EmailShellProps) {
  const branded = family !== 'C';

  return (
    <Html lang="en">
      <Head>
        <meta name="color-scheme" content="light" />
        <meta name="supported-color-schemes" content="light" />
        <style>{SHELL_CSS}</style>
      </Head>
      <Preview>{preview}</Preview>
      <body
        {...bgAttr(GOLD)}
        style={{ ...resetCell, backgroundColor: GOLD, fontFamily: BODY_FONT, color: INK_700 }}
      >
        <table
          data-email-shell={family}
          role="presentation"
          width="100%"
          cellPadding={0}
          cellSpacing={0}
          border={0}
          className="shell-outer"
          {...bgAttr(GOLD)}
          style={{ backgroundColor: GOLD, width: '100%' }}
        >
          <tbody>
            <tr>
              <td
                align="center"
                className="shell-outer"
                {...bgAttr(GOLD)}
                style={{ backgroundColor: GOLD, padding: '24px 12px' }}
              >
                <table
                  role="presentation"
                  className="shell-container"
                  width={CONTAINER_WIDTH}
                  cellPadding={0}
                  cellSpacing={0}
                  border={0}
                  style={{
                    width: `${CONTAINER_WIDTH}px`,
                    maxWidth: `${CONTAINER_WIDTH}px`,
                    borderCollapse: 'separate',
                    borderRadius: '16px',
                    overflow: 'hidden',
                  }}
                >
                  <tbody>
                    {branded ? (
                      <Header />
                    ) : (
                      <tr>
                        <td
                          className="shell-royal"
                          {...bgAttr(ROYAL)}
                          height={4}
                          style={{ backgroundColor: ROYAL, height: '4px', fontSize: '0', lineHeight: '0' }}
                        >
                          &nbsp;
                        </td>
                      </tr>
                    )}
                    <tr>
                      <td
                        className="shell-card shell-gutter"
                        {...bgAttr(GOLD_100)}
                        align="left"
                        style={{
                          backgroundColor: GOLD_100,
                          padding: `${GUTTER}px`,
                          fontFamily: BODY_FONT,
                          color: INK_700,
                        }}
                      >
                        {children}
                      </td>
                    </tr>
                    {branded ? <RoyalFooter /> : <PlainFooter />}
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </body>
    </Html>
  );
}

const headingStyle: CSSProperties = {
  margin: '0 0 20px',
  fontFamily: HEADING_FONT,
  fontSize: '28px',
  lineHeight: '34px',
  fontWeight: 600,
  color: ROYAL,
};

export function ShellHeading({ children }: { children: ReactNode }) {
  return <h1 style={headingStyle}>{children}</h1>;
}

export function ShellSubheading({ children }: { children: ReactNode }) {
  return <h2 style={{ ...headingStyle, fontSize: '20px', lineHeight: '26px' }}>{children}</h2>;
}

const BODY_SIZE = { lead: '16px', small: '14px' } as const;

export function ShellText({
  children,
  size = 'lead',
}: {
  children: ReactNode;
  size?: keyof typeof BODY_SIZE;
}) {
  return (
    <p
      className="shell-ink"
      style={{
        margin: '0 0 16px',
        fontFamily: BODY_FONT,
        fontSize: BODY_SIZE[size],
        lineHeight: size === 'lead' ? '24px' : '21px',
        color: INK_700,
      }}
    >
      {children}
    </p>
  );
}

const LABEL_COLUMN_WIDTH = 150;

/** One label/value detail row with a 1px rule beneath it. Put the colon in the label. */
export function ShellDetailRow({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <table
      role="presentation"
      width="100%"
      cellPadding={0}
      cellSpacing={0}
      border={0}
      style={{ width: '100%', borderBottom: `1px solid ${RULE}` }}
    >
      <tbody>
        <tr>
          <td
            className="shell-label"
            width={LABEL_COLUMN_WIDTH}
            valign="top"
            style={{
              width: `${LABEL_COLUMN_WIDTH}px`,
              padding: '10px 12px 10px 0',
              fontFamily: BODY_FONT,
              fontSize: '14px',
              lineHeight: '20px',
              fontWeight: 700,
              color: ROYAL,
            }}
          >
            {label}
          </td>
          <td
            className="shell-value shell-ink"
            valign="top"
            style={{
              padding: '10px 0',
              fontFamily: BODY_FONT,
              fontSize: '14px',
              lineHeight: '20px',
              color: INK_700,
            }}
          >
            {children}
          </td>
        </tr>
      </tbody>
    </table>
  );
}

export function ShellRule() {
  return (
    <hr style={{ margin: '24px 0', border: 0, borderTop: `1px solid ${RULE}`, height: 0 }} />
  );
}

/** Gold reference card: optional label then a Fraunces 28px value with .08em tracking. */
export function ShellCodeBlock({ label, children }: { label?: ReactNode; children: ReactNode }) {
  return (
    <table
      role="presentation"
      width="100%"
      cellPadding={0}
      cellSpacing={0}
      border={0}
      style={{ width: '100%', margin: '0 0 16px' }}
    >
      <tbody>
        <tr>
          <td
            {...bgAttr(GOLD)}
            style={{
              backgroundColor: GOLD,
              padding: '16px 20px',
              borderRadius: '12px',
              textAlign: 'left',
            }}
          >
            {label !== undefined && (
              <div
                style={{
                  fontFamily: BODY_FONT,
                  fontSize: '14px',
                  lineHeight: '20px',
                  fontWeight: 700,
                  color: ROYAL,
                }}
              >
                {label}
              </div>
            )}
            <div
              style={{
                fontFamily: HEADING_FONT,
                fontSize: '28px',
                lineHeight: '36px',
                letterSpacing: '0.08em',
                color: ROYAL,
                wordBreak: 'break-all',
              }}
            >
              {children}
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

const BUTTON_HEIGHT = 48;

/** Bulletproof button: royal fill, gold text, 10px radius, 48px tall. */
export function ShellButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <table
      role="presentation"
      cellPadding={0}
      cellSpacing={0}
      border={0}
      style={{ margin: '0 0 16px' }}
    >
      <tbody>
        <tr>
          <td
            className="shell-royal"
            {...bgAttr(ROYAL)}
            height={BUTTON_HEIGHT}
            align="center"
            style={{ backgroundColor: ROYAL, borderRadius: '10px', height: `${BUTTON_HEIGHT}px` }}
          >
            <a
              href={href}
              style={{
                display: 'inline-block',
                padding: `0 28px`,
                lineHeight: `${BUTTON_HEIGHT}px`,
                fontFamily: BODY_FONT,
                fontSize: '16px',
                fontWeight: 700,
                color: GOLD,
                textDecoration: 'none',
              }}
            >
              {children}
            </a>
          </td>
        </tr>
      </tbody>
    </table>
  );
}

export function ShellLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <a href={href} style={{ color: ROYAL, textDecoration: 'underline' }}>
      {children}
    </a>
  );
}
