import localFont from 'next/font/local';

// The one declaration of the two NOS families: the chrome (outside `.nos-theme`) uses it directly
// and components/nos/NosThemeScope.tsx imports it, so each family is one next/font instance and
// one woff2. Fraunces is the display and menu-panel
// face (variable, opsz axis); Karla carries nav, body and labels. `preload: false` on both:
// the chrome is imported by the shared marketing layout, and a preload there would make every
// SAOC route fetch the NOS faces; they load on first use, which only NOS routes make.
export const fraunces = localFont({
  src: [
    { path: '../../app/fonts/fraunces/Fraunces-latin-normal.woff2', weight: '100 900', style: 'normal' },
    { path: '../../app/fonts/fraunces/Fraunces-latin-italic.woff2', weight: '100 900', style: 'italic' },
  ],
  variable: '--font-nos-fraunces',
  display: 'swap',
  preload: false,
  adjustFontFallback: 'Times New Roman',
});

export const karla = localFont({
  src: [
    { path: '../../app/fonts/karla/Karla-latin-normal.woff2', weight: '400 700', style: 'normal' },
  ],
  variable: '--font-nos-karla',
  display: 'swap',
  preload: false,
  adjustFontFallback: 'Arial',
});

/** Class names that define the two font variables on a chrome root element. */
export const nosChromeFontClass = `${fraunces.variable} ${karla.variable}`;
