import Link from 'next/link';
import Image from 'next/image';

export default function NotFound() {
  return (
    <section className="relative flex min-h-[640px] items-center overflow-hidden bg-primary">
      <Image
        src="/images/orchid-dark.jpg"
        alt=""
        fill
        priority
        className="object-cover opacity-20"
        sizes="100vw"
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-t from-primary/90 via-primary/50 to-transparent"
      />

      <div className="relative z-10 mx-auto w-full max-w-[1280px] px-8 py-24 text-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-accent mb-4">
          404 — Page not found
        </p>
        <h1 className="font-serif text-[clamp(42px,6vw,80px)] font-medium leading-[1.04] tracking-[-0.012em] text-ivory max-w-[20ch] mx-auto mb-6">
          This orchid has left the bench.
        </h1>
        <p className="font-sans text-[18px] leading-relaxed text-ivory/70 max-w-[46ch] mx-auto mb-10">
          The page you&rsquo;re looking for doesn&rsquo;t exist or may have moved. Start from the
          home page or find a society near you.
        </p>
        <div className="flex flex-wrap gap-4 justify-center">
          <Link
            href="/"
            className="font-mono text-[11px] uppercase tracking-[0.18em] bg-accent px-6 py-3 text-ivory transition-colors duration-150 hover:bg-accent-soft"
          >
            Go home
          </Link>
          <Link
            href="/societies"
            className="font-mono text-[11px] uppercase tracking-[0.18em] border border-ivory/40 px-6 py-3 text-ivory transition-colors duration-150 hover:bg-ivory/10"
          >
            Find a society
          </Link>
        </div>
      </div>
    </section>
  );
}
