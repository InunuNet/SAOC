import type { Timestamp } from 'firebase-admin/firestore';

export type Society = {
  id: string;
  name: string;
  slug: string;
  province: string;
  city: string;
  venue: string;
  meetingDay: string;
  meetingTime: string;
  email: string;
  chairName?: string;
  websiteUrl?: string;
  foundedYear?: number;
};

export type SocietyEvent = {
  id: string;
  societyId: string;
  title: string;
  startDate: Timestamp;
  endDate: Timestamp;
  venue: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  description?: string;
};

export type ShowWinner = {
  category: string;
  plantName: string;
  ownerName: string;
  imageUrl?: string;
};

export type NationalShow = {
  id: string;
  edition: number;
  year: number;
  hostSociety: string;
  venue: string;
  startDate: Timestamp;
  endDate: Timestamp;
  heroImage?: string;
  description?: string;
  grandChampion?: ShowWinner;
  reserveChampion?: ShowWinner;
  categoryWinners?: ShowWinner[];
  galleryImages?: string[];
};

export type ContactSubmission = {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  submittedAt: Timestamp;
  status: 'new' | 'read' | 'replied';
};
