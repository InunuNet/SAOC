// The newsletter vocabulary shared by server and client code. No imports, so a client component
// can use it without pulling in lib/newsletter.ts (which needs node:crypto).

export const NEWSLETTER_TOPICS = ['saoc', 'nos'] as const;
export type NewsletterTopic = (typeof NEWSLETTER_TOPICS)[number];

export type NewsletterStatus = 'subscribed' | 'unsubscribed';

export const NEWSLETTER_REMOVAL_VIAS = ['link', 'one-click', 'self-service-form', 'admin'] as const;
export type NewsletterRemovalVia = (typeof NEWSLETTER_REMOVAL_VIAS)[number];

// One entry of the append-only audit: a topic taken off an address, when, how and by whom.
export interface NewsletterTopicRemoval {
  topic: NewsletterTopic;
  removedAt: Date;
  via: NewsletterRemovalVia;
  by: string | null;
}
