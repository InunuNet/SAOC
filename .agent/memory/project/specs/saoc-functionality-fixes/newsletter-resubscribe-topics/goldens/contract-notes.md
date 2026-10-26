# newsletter-resubscribe-topics goldens

Rule (consent): a subscriber whose stored status is `unsubscribed` and who submits again gets exactly the topics in the new
request (`subscriberTopics(input.topics, input.source)`), never a union with the topics stored before they unsubscribed.
Unchanged: a doc that is still `subscribed` keeps union-on-add and the null no-op; a first-time subscriber stores the
requested topics; re-subscribe keeps `source`, `unsubscribeToken`, resets `status`, `unsubscribedAt`, sets `subscribedAt = now`.
Only `applySubscribe` in lib/newsletter.ts changes.
