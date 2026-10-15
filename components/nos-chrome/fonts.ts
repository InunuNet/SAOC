import { Fraunces, Karla } from 'next/font/google';

// The chrome sits outside `.nos-theme`, so it declares the same two families as
// app/(marketing)/national-show/layout.tsx with a character-identical config
// (next/font then emits one set of files). Fraunces is the display and menu-panel
// face (variable, opsz axis); Karla carries nav, body and labels. `preload: false` on both:
// the chrome is imported by the shared marketing layout, and a preload there would make every
// SAOC route fetch the NOS faces; they load on first use, which only NOS routes make.
const fraunces = Fraunces({
  subsets: ['latin'],
  axes: ['opsz'],
  style: ['normal', 'italic'],
  variable: '--font-nos-fraunces',
  display: 'swap',
  preload: false,
});

const karla = Karla({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-nos-karla',
  display: 'swap',
  preload: false,
});

/** Class names that define the two font variables on a chrome root element. */
export const nosChromeFontClass = `${fraunces.variable} ${karla.variable}`;
