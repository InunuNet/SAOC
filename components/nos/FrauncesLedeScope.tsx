import localFont from 'next/font/local';

// The theme lede in the /symposium and /about heroes is italic 300. This face is that one weight and
// style of the italic Fraunces file, with its own generated family, so it preloads on those two
// routes and nowhere else (NOS Design, 2026-10-26). Only nos-theme.css's theme lede rule names the
// variable; the wrapper adds no box of its own.
const frauncesLedeItalic = localFont({
  src: [
    {
      path: '../../app/fonts/fraunces/Fraunces-latin-italic.woff2',
      weight: '300',
      style: 'italic',
    },
  ],
  variable: '--font-nos-fraunces-lede',
  display: 'swap',
  preload: true,
  adjustFontFallback: 'Times New Roman',
});

export function FrauncesLedeScope({ children }: { children: React.ReactNode }) {
  return (
    <div className={frauncesLedeItalic.variable} style={{ display: 'contents' }}>
      {children}
    </div>
  );
}
