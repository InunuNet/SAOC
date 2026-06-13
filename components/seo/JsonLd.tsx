type JsonLdProps = {
  data: Record<string, unknown>;
};

export function JsonLd({ data }: JsonLdProps) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export function organizationJsonLd() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'South African Orchid Council',
    alternateName: 'SAOC',
    url: 'https://saoc.co.za',
    description:
      'The South African Orchid Council (SAOC) — coordinating orchid societies across South Africa since 1968.',
    foundingDate: '1968',
    areaServed: 'ZA',
    contactPoint: {
      '@type': 'ContactPoint',
      contactType: 'general',
      url: 'https://saoc.co.za/contact',
    },
  };
}

type BreadcrumbItem = { name: string; url: string };

export function breadcrumbJsonLd(items: BreadcrumbItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

type EventJsonLdProps = {
  name: string;
  startDate: string;
  endDate?: string | null;
  location?: string | null;
  venue?: string | null;
  description?: string | null;
  organizer?: string | null;
  url: string;
};

export function eventJsonLd({
  name,
  startDate,
  endDate,
  location,
  venue,
  description,
  organizer,
  url,
}: EventJsonLdProps) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name,
    startDate,
    ...(endDate ? { endDate } : {}),
    ...(description ? { description } : {}),
    url,
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    location: {
      '@type': 'Place',
      name: venue ?? location ?? 'South Africa',
      ...(location ? { address: location } : {}),
    },
    organizer: {
      '@type': 'Organization',
      name: organizer ?? 'South African Orchid Council',
      url: 'https://saoc.co.za',
    },
  };
}
