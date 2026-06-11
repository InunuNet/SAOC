import type { Metadata } from 'next';
import Link from 'next/link';
import { Crimson_Pro, Manrope, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const crimsonPro = Crimson_Pro({
  subsets: ['latin'],
  variable: '--font-serif',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
});

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
  weight: ['400', '500', '600', '700'],
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
  weight: ['400', '500'],
});

export const metadata: Metadata = {
  title: {
    template: '%s | South African Orchid Council',
    default: 'South African Orchid Council',
  },
  description:
    'The South African Orchid Council (SAOC) — coordinating orchid societies across South Africa since 1968.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${crimsonPro.variable} ${manrope.variable} ${jetBrainsMono.variable}`}>
      <body>
        {/* TODO: Replace with design-handoff Header component */}
        <header className="border-b px-6 py-4">
          <nav className="mx-auto max-w-7xl flex items-center justify-between">
            <span className="font-semibold text-lg">SAOC</span>
            <ul className="flex gap-6 text-sm">
              <li><Link href="/about">About</Link></li>
              <li><Link href="/societies">Societies</Link></li>
              <li><Link href="/judging">Judging</Link></li>
              <li><Link href="/events">Events</Link></li>
              <li><Link href="/national-show">National Show</Link></li>
              <li><Link href="/contact">Contact</Link></li>
            </ul>
          </nav>
        </header>

        <main>{children}</main>

        {/* TODO: Replace with design-handoff Footer component */}
        <footer className="border-t px-6 py-8 mt-16">
          <div className="mx-auto max-w-7xl text-sm text-gray-500">
            <p>© {new Date().getFullYear()} South African Orchid Council. All rights reserved.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
