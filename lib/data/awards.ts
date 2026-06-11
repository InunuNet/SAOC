import type { Award } from '@/types';

export const awards: Award[] = [
  {
    code: 'AM/SAOC',
    name: 'Award of Merit',
    threshold: '80–89 pts',
    description:
      'Recognises a plant of superior quality — exceptional form, colour, size, and cultural condition.',
  },
  {
    code: 'FCC/SAOC',
    name: 'First Class Certificate',
    threshold: '90+ pts',
    description:
      'The highest flower-quality award — reserved for plants of truly outstanding merit.',
  },
  {
    code: 'HCC/SAOC',
    name: 'Highly Commended Certificate',
    threshold: '75–79 pts',
    description: 'A plant worthy of recognition, a step below Award of Merit.',
  },
  {
    code: 'CCM/SAOC',
    name: 'Certificate of Cultural Merit',
    threshold: '80+ pts',
    description: 'Awarded to the grower for exceptional cultivation — specimen plant quality.',
  },
  {
    code: 'CBR/SAOC',
    name: 'Certificate of Botanical Recognition',
    threshold: '—',
    description: 'For the first exhibition of a rare or unusual species.',
  },
  {
    code: 'JC/SAOC',
    name: "Judges' Commendation",
    threshold: '—',
    description: 'For a distinctive characteristic not covered by standard criteria.',
  },
];
