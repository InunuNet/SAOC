import Link from 'next/link';
import {
  ClipboardList,
  BadgeCheck,
  Mail,
  ShoppingBag,
  Ticket,
  type LucideIcon,
} from 'lucide-react';

import { formatAdminDate } from '@/lib/admin-format';
import type { DashboardData, PendingApplicationSummary } from '@/lib/admin-dashboard';
import { CARD_CLASS, FOCUS_RING, STAT_TILE_CLASS, STAT_TILE_PENDING_CLASS } from '../tokens';

const APPLICATIONS_HREF = '/admin/vendors/applications';
const NO_VALUE = '—';

interface StatCard {
  id: string;
  label: string;
  value: number | null;
  href: string;
  icon: LucideIcon;
  highlight?: boolean;
}

export interface StatCardOptions {
  canReviewVendors: boolean;
  showNewsletter: boolean;
}

function buildStatCards(data: DashboardData, options: StatCardOptions): StatCard[] {
  const cards: StatCard[] = [
    {
      id: 'tickets',
      label: 'Tickets sold',
      value: data.ticketsSold,
      href: '/admin/tickets',
      icon: Ticket,
    },
    {
      id: 'orders',
      label: 'Orders',
      value: data.orders,
      href: '/admin/tickets',
      icon: ShoppingBag,
    },
  ];
  if (options.canReviewVendors) {
    cards.push(
      {
        id: 'pending',
        label: 'Applications pending review',
        value: data.pendingApplications,
        href: APPLICATIONS_HREF,
        icon: ClipboardList,
        highlight: (data.pendingApplications ?? 0) > 0,
      },
      {
        id: 'approved',
        label: 'Vendors approved',
        value: data.vendorsApproved,
        href: APPLICATIONS_HREF,
        icon: BadgeCheck,
      }
    );
  }
  if (options.showNewsletter) {
    cards.push({
      id: 'newsletter',
      label: 'Newsletter subscribers',
      value: data.newsletterSubscribers,
      href: '/admin/newsletter',
      icon: Mail,
    });
  }
  return cards;
}

// 2 across from 640, 1 below, and from 1440 one row of equal columns whatever the count.
// Each card is one link to its list.
export function StatCards({ data, options }: { data: DashboardData; options: StatCardOptions }) {
  const cards = buildStatCards(data, options);
  return (
    <ul
      className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 min-[90rem]:[grid-template-columns:repeat(var(--stat-count),minmax(0,1fr))]"
      style={{ '--stat-count': cards.length } as React.CSSProperties} // custom property is not in CSSProperties
    >
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <li key={card.id}>
            <Link
              href={card.href}
              className={`flex h-full min-h-[88px] items-start gap-4 ${CARD_CLASS} hover:bg-bone/50 ${FOCUS_RING}`}
            >
              <span
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-[2px] ${
                  card.highlight ? STAT_TILE_PENDING_CLASS : STAT_TILE_CLASS
                }`}
              >
                <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-serif text-[32px] font-semibold leading-none tabular-nums text-ink">
                  {card.value ?? NO_VALUE}
                </span>
                <span className="mt-1 block text-[13px] text-muted">{card.label}</span>
              </span>
              <span aria-hidden="true" className="text-[18px] text-muted">
                →
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

export function DashboardPanel({ children }: { children: React.ReactNode }) {
  return <section className={CARD_CLASS}>{children}</section>;
}

export const PANEL_HEADING_CLASS = 'mb-4 font-serif text-[22px] font-semibold text-ink';

const ACTION_ROW_CLASS = `flex min-h-[44px] items-center justify-between gap-3 border-b border-rule-soft py-2 font-sans text-[14px] font-medium text-ink last:border-b-0 hover:text-primary ${FOCUS_RING}`;

export interface QuickActionOptions {
  canReviewVendors: boolean;
  canManagePaymentSettings: boolean;
}

export function QuickActionList({ options }: { options: QuickActionOptions }) {
  return (
    <ul>
      <li>
        <a href="/api/admin/export-csv" className={ACTION_ROW_CLASS}>
          Download tickets CSV
          <span aria-hidden="true">→</span>
        </a>
      </li>
      <li>
        <Link href="/admin/door" className={ACTION_ROW_CLASS}>
          Open door scanner
          <span aria-hidden="true">→</span>
        </Link>
      </li>
      {options.canReviewVendors ? (
        <li>
          <Link href={APPLICATIONS_HREF} className={ACTION_ROW_CLASS}>
            Review applications
            <span aria-hidden="true">→</span>
          </Link>
        </li>
      ) : null}
      {options.canManagePaymentSettings ? (
        <li>
          <Link href="/admin/settings" className={ACTION_ROW_CLASS}>
            Payment settings
            <span aria-hidden="true">→</span>
          </Link>
        </li>
      ) : null}
    </ul>
  );
}

export function NeedsAttentionList({ items }: { items: PendingApplicationSummary[] }) {
  return (
    <ul>
      {items.map((item) => (
        <li
          key={item.id}
          className="flex min-h-[48px] items-center justify-between gap-3 border-b border-rule-soft py-1 last:border-b-0"
        >
          <span className="min-w-0 flex-1">
            <span
              className="block truncate font-sans text-[14px] font-medium text-ink"
              title={item.businessName}
            >
              {item.businessName}
            </span>
            <span className="block text-[13px] tabular-nums text-muted">
              {formatAdminDate(item.submittedAt)}
            </span>
          </span>
          <Link
            href={`${APPLICATIONS_HREF}?view=${encodeURIComponent(item.id)}`}
            aria-label={`View ${item.businessName}`}
            className={`flex min-h-[44px] items-center px-2 font-sans text-[14px] font-semibold text-primary underline decoration-accent underline-offset-4 ${FOCUS_RING}`}
          >
            View
          </Link>
        </li>
      ))}
    </ul>
  );
}
