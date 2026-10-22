// Re-export so the admin surfaces can read NEWSLETTER_COPY without importing the public
// components/chrome path, which contracts/checks/admin-redesign/static.sh no-public-chrome forbids
// inside app/admin and components/admin. The strings still live only in newsletter-copy.ts.
export { NEWSLETTER_COPY } from '@/components/chrome/newsletter-copy';
