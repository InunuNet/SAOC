import { createContext, useContext } from 'react';
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
 *   D  Council              SAOC   parchment header/card, sage footer, bone outer
 */
export type EmailShellFamily = 'A' | 'B' | 'C' | 'D';

export const ROYAL = '#211a57';
export const GOLD = '#f3f2d6';
const GOLD_100 = '#fbfaf0';
const INK_700 = '#3a3654';
const NOS_RULE = '#e3e1c9';

const BONE = '#e8e6dc';
const PARCHMENT = '#f4f3ec';
const SAGE = '#384138';
const SAOC_RULE = '#d9d6ca';
// Codi's D opacities, pre-blended onto their backgrounds (email clients drop rgba/opacity):
// ink #171917 at 80% on parchment, parchment at 65% and 80% on sage.
const SAOC_INK_80 = '#434542';
const PARCHMENT_65_ON_SAGE = '#b2b5ad';
const PARCHMENT_80_ON_SAGE = '#cecfc8';

interface ShellTheme {
  outer: string;
  card: string;
  /** Header band fill (A/B royal, D parchment). C has no header band, only a top rule. */
  header: string;
  footer: string;
  accent: string;
  onAccent: string;
  ink: string;
  rule: string;
  radius: string;
  buttonRadius: string;
  headingFont: string;
  bodyFont: string;
  footerRegColor: string;
  footerLineColor: string;
}

const NOS_THEME: ShellTheme = {
  outer: GOLD,
  card: GOLD_100,
  header: ROYAL,
  footer: ROYAL,
  accent: ROYAL,
  onAccent: GOLD,
  ink: INK_700,
  rule: NOS_RULE,
  radius: '16px',
  buttonRadius: '10px',
  headingFont: 'Fraunces, Georgia, serif',
  bodyFont: 'Karla, Arial, Helvetica, sans-serif',
  footerRegColor: GOLD,
  footerLineColor: GOLD,
};

const SAOC_THEME: ShellTheme = {
  outer: BONE,
  card: PARCHMENT,
  header: PARCHMENT,
  footer: SAGE,
  accent: SAGE,
  onAccent: PARCHMENT,
  ink: SAOC_INK_80,
  rule: SAOC_RULE,
  radius: '2px',
  buttonRadius: '2px',
  headingFont: "'Crimson Pro', Georgia, serif",
  bodyFont: 'Manrope, Arial, Helvetica, sans-serif',
  footerRegColor: PARCHMENT_65_ON_SAGE,
  footerLineColor: PARCHMENT_80_ON_SAGE,
};

const ThemeContext = createContext<ShellTheme>(NOS_THEME);

const CONTAINER_WIDTH = 600;
const STACK_BREAKPOINT = 620;
const GUTTER = 40;
const HEADER_LOGO_WIDTH = 280;
const HEADER_LOGO_HEIGHT = 69;
const NOS_FOOTER_LOCKUP_WIDTH = 120;
const NOS_FOOTER_LOCKUP_HEIGHT = 105;
const SAOC_FOOTER_LOCKUP_WIDTH = 220;
const NOS_LOGO_ALT = 'National Orchid Show 2027';
const SAOC_LOGO_ALT = 'South African Orchid Council';
const FOOTER_LINE = 'South African Orchid Council — saoc.co.za';
/** D's REG line separates the two numbers with a middle dot; the numbers come from FOOTER_REG. */
const SAOC_FOOTER_REG = FOOTER_REG.replace(/\s{2,}/, ' · ');

/** SITE_URL is only available at App Hosting runtime; same fallback as lib/confirmation-email.ts. */
const DEFAULT_SITE_URL = 'https://saoc.co.za';

function logoUrl(file: string): string {
  const origin = (process.env['SITE_URL'] ?? DEFAULT_SITE_URL).replace(/\/+$/, '');
  return `${origin}/images/email/${file}`;
}

function shellCss(t: ShellTheme): string {
  return `
  :root { color-scheme: light; supported-color-schemes: light; }
  @media only screen and (max-width: ${STACK_BREAKPOINT}px) {
    .shell-container { width: 100% !important; }
    .shell-gutter { padding-left: 20px !important; padding-right: 20px !important; }
    .shell-label, .shell-value { display: block !important; width: 100% !important; }
  }
  [data-ogsc] .shell-header { background-color: ${t.header} !important; }
  [data-ogsc] .shell-footer, [data-ogsc] .shell-accent { background-color: ${t.footer} !important; }
  [data-ogsc] .shell-card { background-color: ${t.card} !important; }
  [data-ogsc] .shell-outer { background-color: ${t.outer} !important; }
  [data-ogsc] .shell-ink { color: ${t.ink} !important; }
`;
}

/** Legacy `bgcolor` attribute (Outlook/dark-mode clients), absent from React's HTML typings. */
const bgAttr = (hex: string): { bgcolor: string } => ({ bgcolor: hex });

const resetCell: CSSProperties = { margin: 0, padding: 0 };

interface EmailShellProps {
  family: EmailShellFamily;
  /** Hidden inbox preheader. Each template passes its existing <Preview> text unchanged. */
  preview: string;
  children: ReactNode;
}

function Header({ family, theme: t }: { family: EmailShellFamily; theme: ShellTheme }) {
  const isSaoc = family === 'D';
  return (
    <tr>
      <td
        className="shell-header"
        {...bgAttr(t.header)}
        align="left"
        style={{ backgroundColor: t.header, padding: `28px ${GUTTER}px` }}
      >
        <Img
          src={logoUrl(
            isSaoc
              ? 'saoc-horizontal-colour-on-light-560.png'
              : 'nos-reversed-gold-horizontal-560.png',
          )}
          alt={isSaoc ? SAOC_LOGO_ALT : NOS_LOGO_ALT}
          width={HEADER_LOGO_WIDTH}
          height={isSaoc ? undefined : HEADER_LOGO_HEIGHT}
          style={{ display: 'block', border: 0, width: `${HEADER_LOGO_WIDTH}px`, height: 'auto' }}
        />
      </td>
    </tr>
  );
}

function BrandedFooter({ family, theme: t }: { family: EmailShellFamily; theme: ShellTheme }) {
  const isSaoc = family === 'D';
  const lockupWidth = isSaoc ? SAOC_FOOTER_LOCKUP_WIDTH : NOS_FOOTER_LOCKUP_WIDTH;
  return (
    <tr>
      <td
        className="shell-footer"
        {...bgAttr(t.footer)}
        align="center"
        style={{ backgroundColor: t.footer, padding: `28px ${GUTTER}px`, textAlign: 'center' }}
      >
        <Img
          src={logoUrl(
            isSaoc
              ? 'saoc-horizontal-colour-on-dark-440.png'
              : 'nos-reversed-gold-vertical-240.png',
          )}
          alt={isSaoc ? SAOC_LOGO_ALT : NOS_LOGO_ALT}
          width={lockupWidth}
          height={isSaoc ? undefined : NOS_FOOTER_LOCKUP_HEIGHT}
          style={{
            display: 'block',
            border: 0,
            margin: '0 auto',
            width: `${lockupWidth}px`,
            height: 'auto',
          }}
        />
        <p
          style={{
            margin: '24px 0 0',
            fontFamily: t.bodyFont,
            fontSize: '11px',
            lineHeight: '16px',
            color: t.footerRegColor,
          }}
        >
          {isSaoc ? SAOC_FOOTER_REG : FOOTER_REG}
        </p>
        <p
          style={{
            margin: '8px 0 0',
            fontFamily: t.bodyFont,
            fontSize: '13px',
            lineHeight: '18px',
            color: t.footerLineColor,
          }}
        >
          {FOOTER_LINE}
        </p>
      </td>
    </tr>
  );
}

function PlainFooter({ theme: t }: { theme: ShellTheme }) {
  return (
    <tr>
      <td
        className="shell-card shell-gutter"
        {...bgAttr(t.card)}
        style={{ backgroundColor: t.card, padding: `0 ${GUTTER}px 32px` }}
      >
        <p
          className="shell-ink"
          style={{
            margin: 0,
            fontFamily: t.bodyFont,
            fontSize: '13px',
            lineHeight: '18px',
            color: t.ink,
          }}
        >
          {FOOTER_LINE}
        </p>
      </td>
    </tr>
  );
}

export default function EmailShell({ family, preview, children }: EmailShellProps) {
  const t = family === 'D' ? SAOC_THEME : NOS_THEME;
  const branded = family !== 'C';

  return (
    <Html lang="en">
      <Head>
        <meta name="color-scheme" content="light" />
        <meta name="supported-color-schemes" content="light" />
        <style>{shellCss(t)}</style>
      </Head>
      <Preview>{preview}</Preview>
      <body
        {...bgAttr(t.outer)}
        style={{ ...resetCell, backgroundColor: t.outer, fontFamily: t.bodyFont, color: t.ink }}
      >
        <table
          data-email-shell={family}
          role="presentation"
          width="100%"
          cellPadding={0}
          cellSpacing={0}
          border={0}
          className="shell-outer"
          {...bgAttr(t.outer)}
          style={{ backgroundColor: t.outer, width: '100%' }}
        >
          <tbody>
            <tr>
              <td
                align="center"
                className="shell-outer"
                {...bgAttr(t.outer)}
                style={{ backgroundColor: t.outer, padding: '24px 12px' }}
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
                    borderRadius: t.radius,
                    overflow: 'hidden',
                  }}
                >
                  <tbody>
                    {branded ? (
                      <Header family={family} theme={t} />
                    ) : (
                      <tr>
                        <td
                          className="shell-header"
                          {...bgAttr(t.header)}
                          height={4}
                          style={{
                            backgroundColor: t.header,
                            height: '4px',
                            fontSize: '0',
                            lineHeight: '0',
                          }}
                        >
                          &nbsp;
                        </td>
                      </tr>
                    )}
                    <tr>
                      <td
                        className="shell-card shell-gutter"
                        {...bgAttr(t.card)}
                        align="left"
                        style={{
                          backgroundColor: t.card,
                          padding: `${GUTTER}px`,
                          fontFamily: t.bodyFont,
                          color: t.ink,
                        }}
                      >
                        <ThemeContext.Provider value={t}>{children}</ThemeContext.Provider>
                      </td>
                    </tr>
                    {branded ? (
                      <BrandedFooter family={family} theme={t} />
                    ) : (
                      <PlainFooter theme={t} />
                    )}
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

export function ShellHeading({ children }: { children: ReactNode }) {
  const t = useContext(ThemeContext);
  return (
    <h1
      style={{
        margin: '0 0 20px',
        fontFamily: t.headingFont,
        fontSize: '28px',
        lineHeight: '34px',
        fontWeight: 600,
        color: t.accent,
      }}
    >
      {children}
    </h1>
  );
}

export function ShellSubheading({ children }: { children: ReactNode }) {
  const t = useContext(ThemeContext);
  return (
    <h2
      style={{
        margin: '0 0 20px',
        fontFamily: t.headingFont,
        fontSize: '20px',
        lineHeight: '26px',
        fontWeight: 600,
        color: t.accent,
      }}
    >
      {children}
    </h2>
  );
}

const BODY_SIZE = { lead: '16px', small: '14px' } as const;

export function ShellText({
  children,
  size = 'lead',
}: {
  children: ReactNode;
  size?: keyof typeof BODY_SIZE;
}) {
  const t = useContext(ThemeContext);
  return (
    <p
      className="shell-ink"
      style={{
        margin: '0 0 16px',
        fontFamily: t.bodyFont,
        fontSize: BODY_SIZE[size],
        lineHeight: size === 'lead' ? '24px' : '21px',
        color: t.ink,
      }}
    >
      {children}
    </p>
  );
}

const LABEL_COLUMN_WIDTH = 150;

/** One label/value detail row with a 1px rule beneath it. Put the colon in the label. */
export function ShellDetailRow({ label, children }: { label: ReactNode; children: ReactNode }) {
  const t = useContext(ThemeContext);
  return (
    <table
      role="presentation"
      width="100%"
      cellPadding={0}
      cellSpacing={0}
      border={0}
      style={{ width: '100%', borderBottom: `1px solid ${t.rule}` }}
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
              fontFamily: t.bodyFont,
              fontSize: '14px',
              lineHeight: '20px',
              fontWeight: 700,
              color: t.accent,
            }}
          >
            {label}
          </td>
          <td
            className="shell-value shell-ink"
            valign="top"
            style={{
              padding: '10px 0',
              fontFamily: t.bodyFont,
              fontSize: '14px',
              lineHeight: '20px',
              color: t.ink,
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
  const t = useContext(ThemeContext);
  return <hr style={{ margin: '24px 0', border: 0, borderTop: `1px solid ${t.rule}`, height: 0 }} />;
}

/** Reference card: optional label then a heading-font 28px value with .08em tracking. */
export function ShellCodeBlock({ label, children }: { label?: ReactNode; children: ReactNode }) {
  const t = useContext(ThemeContext);
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
            {...bgAttr(t.outer)}
            style={{
              backgroundColor: t.outer,
              padding: '16px 20px',
              borderRadius: '12px',
              textAlign: 'left',
            }}
          >
            {label !== undefined && (
              <div
                style={{
                  fontFamily: t.bodyFont,
                  fontSize: '14px',
                  lineHeight: '20px',
                  fontWeight: 700,
                  color: t.accent,
                }}
              >
                {label}
              </div>
            )}
            <div
              style={{
                fontFamily: t.headingFont,
                fontSize: '28px',
                lineHeight: '36px',
                letterSpacing: '0.08em',
                color: t.accent,
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

/** Bulletproof button: accent fill, on-accent text, 48px tall. */
export function ShellButton({ href, children }: { href: string; children: ReactNode }) {
  const t = useContext(ThemeContext);
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
            className="shell-accent"
            {...bgAttr(t.accent)}
            height={BUTTON_HEIGHT}
            align="center"
            style={{
              backgroundColor: t.accent,
              borderRadius: t.buttonRadius,
              height: `${BUTTON_HEIGHT}px`,
            }}
          >
            <a
              href={href}
              style={{
                display: 'inline-block',
                padding: '0 28px',
                lineHeight: `${BUTTON_HEIGHT}px`,
                fontFamily: t.bodyFont,
                fontSize: '16px',
                fontWeight: 700,
                color: t.onAccent,
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
  const t = useContext(ThemeContext);
  return (
    <a href={href} style={{ color: t.accent, textDecoration: 'underline' }}>
      {children}
    </a>
  );
}
