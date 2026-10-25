import type { Metadata } from 'next';

import { requireMediaKitAccess } from '@/lib/media-kit-gate';

import { MediaKitPageBody } from './MediaKitPageBody';

export const metadata: Metadata = {
  title: 'Media Kit',
  description: 'Media resources and press information for the South African Orchid Council.',
};

export default async function MediaKitPage() {
  await requireMediaKitAccess('/media-kit');
  return <MediaKitPageBody />;
}
