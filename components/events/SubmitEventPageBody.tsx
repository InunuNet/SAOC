import { SubmitEventForm } from '@/components/events/SubmitEventForm';
import { PageHero } from '@/components/ui/PageHero';

interface SubmitEventPageBodyProps {
  societies: ReadonlyArray<{ id: string; name: string }>;
}

export function SubmitEventPageBody({ societies }: SubmitEventPageBodyProps) {
  return (
    <>
      <PageHero
        image="/images/orchid-purple.jpg"
        eyebrow="Events"
        heading="Submit an event"
        lede="Your submission will be reviewed by the council before it appears on the site."
      />
      <section className="saoc-container py-16">
        <div className="mx-auto max-w-[640px]">
          <SubmitEventForm societies={societies} />
        </div>
      </section>
    </>
  );
}
