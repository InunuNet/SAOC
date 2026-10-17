import { Crimson_Pro, Manrope, JetBrains_Mono } from 'next/font/google';

// F19 (A26): the SAOC faces load only on the SAOC routes. They used to be declared in the root
// layout, so every National Show page declared and fetched them as well as its own Fraunces and
// Karla. The National Show routes sit outside this route group, so they never see these faces.
const crimsonPro = Crimson_Pro({
  subsets: ['latin'],
  variable: '--font-serif-loaded',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
});

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-sans-loaded',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono-loaded',
  display: 'swap',
  weight: ['400', '500'],
});

// The SAOC header, utility bar and footer are built in app/(marketing)/layout.tsx, above this
// layout, so a variable class on a wrapper here would not reach them. The variables are set on
// :root instead, from the same font objects, which is where the root layout's class put them.
const SAOC_FONT_VARIABLES = [
  `--font-serif-loaded: ${crimsonPro.style.fontFamily};`,
  `--font-sans-loaded: ${manrope.style.fontFamily};`,
  `--font-mono-loaded: ${jetBrainsMono.style.fontFamily};`,
].join(' ');

export default function SaocLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style href="saoc-font-variables" precedence="default">{`:root { ${SAOC_FONT_VARIABLES} }`}</style>
      {children}
    </>
  );
}
