import type { Metadata } from 'next';
import './globals.css';

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
    <html lang="en">
      <body>
        {/* TODO: Replace with design-handoff Header component */}
        <header className="border-b px-6 py-4">
          <nav className="mx-auto max-w-7xl flex items-center justify-between">
            <span className="font-semibold text-lg">SAOC</span>
            <ul className="flex gap-6 text-sm">
              <li><a href="/about">About</a></li>
              <li><a href="/societies">Societies</a></li>
              <li><a href="/judging">Judging</a></li>
              <li><a href="/events">Events</a></li>
              <li><a href="/national-show">National Show</a></li>
              <li><a href="/contact">Contact</a></li>
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
