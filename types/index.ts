export type Society = {
  name: string;
  region: string;
  province: string;
  founded: number;
  meet: string;
  venue: string;
  members?: number;
  city?: string;
  slug?: string;
  email?: string;
  chairName?: string;
  websiteUrl?: string;
};

export type SocietyEvent = {
  id: number;
  date: string;
  endDate?: string;
  title: string;
  host: string;
  venue: string;
  kind: string;
  province: string;
  description?: string;
};

export type NationalShow = {
  edition: number;
  year: number;
  month: string;
  host: string;
  venue: string;
  status: 'upcoming' | 'past';
  days?: number;
  entries?: number;
  visitors?: number;
  trophies?: number;
  heroImage?: string;
  grandChampion?: ShowWinner;
  reserveChampion?: ShowWinner;
  categoryWinners?: ShowWinner[];
  note?: string;
};

export type ShowWinner = {
  category: string;
  plantName: string;
  ownerName: string;
  imageUrl?: string;
};

export type Award = {
  code: string;
  name: string;
  threshold: string;
  description: string;
};

export type BoardMember = {
  name: string;
  role: string;
  society: string;
  tenure: string;
};

export type HeroImage = {
  name: string;
  path: string;
  alt: string;
};

export type Partner = {
  name: string;
  url?: string;
  logoUrl?: string;
};

export type Province = {
  code: string;
  name: string;
};

export type ShowClass = {
  id: string;
  code: string;
  name: string;
  group: string;
  description: string;
};

export type SanityEvent = {
  _id: string;
  title: string;
  slug: string;
  date: string;
  endDate?: string | null;
  kind?: string | null;
  description?: string | null;
  venue?: string | null;
  location?: string | null;
  isFeatured?: boolean | null;
  hostSociety?: {
    _id: string;
    name: string;
    slug: string;
  } | null;
};

export type ContactSubmission = {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  submittedAt: string;
  status: 'new' | 'read' | 'replied';
};
