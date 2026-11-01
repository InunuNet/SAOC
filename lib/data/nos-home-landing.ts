// =============================================================
// NOS — lib/data/nos-home-landing.ts
// Sourced module for the /national-show home bands that mission nos-home-restore brings back
// (intro + figures, judging groups, plant entry). Every string is Lee-Ann's text from the
// National Orchid Show Website landing-page document v1.0 (Drive: National Show / 1. Home),
// verbatim, typos included ("can be judges", no full stop after "12pm"). Her editorial notes
// to us are never copy and are not here. Nothing in this file is ours; add no words of your own
// (docs/rules/no-invention.md). Two Brad-sanctioned exceptions (2026-10-31, Lee-Ann approved the
// page): the judging heading reads "Thirteen judging groups" (her doc says "Ten"), and the visit
// band is removed from the home (the sub-nav carries those links). See docs/nos-home-restore.md.
// =============================================================

export interface LandingFigure {
  value: string;
  label: string;
}

export interface JudgingGroup {
  n: number;
  name: string;
  /** Null where her document gives the group a name and nothing else (groups 11 to 13). */
  description: string | null;
  /** The runs of `description` she set in italics (species and section names), in order. */
  italics: string[];
}

export interface PlantEntryStage {
  stage: string;
  title: string;
  description: string;
}

export const LANDING_INTRO = {
  tagline: 'Three years in the making, four days on the bench',
  paragraphs: [
    'The National Orchid Show is the country’s premier orchid event. Held every three years, it brings together growers, hybridisers, judges and collectors for four days of Orchid exhibits, sales, education, and community.',
    'Every plant submitted for judging is assessed by accredited SAOC judges and if requested can be judges for an SAOC Award. The Show Grand Champion is selected from the best on show and chosen by secret ballot by the accredited SAOC Judges.',
  ],
} as const;

export const LANDING_FIGURES: readonly LandingFigure[] = [
  {
    value: '3',
    label: 'Years',
  },
  {
    value: '13',
    label: 'Judging Groups',
  },
  {
    value: '18',
    label: 'National Show Editions',
  },
];

// Departs from her doc v1.0 ("Ten judging groups") by Brad's instruction of 2026-10-31.
export const JUDGING_GROUPS_HEADING = 'Thirteen judging groups';

export const JUDGING_GROUPS: readonly JudgingGroup[] = [
  {
    n: 1,
    name: 'Laeliinae Species',
    description:
      'Cattleya (large-flowered, cluster bifoliates, miniature, and rupiculous), Laelia, Myrmecophila, reed-stem Epidendrums, Oerstedella, Encyclia, Prosthechea, and Brassavola.',
    italics: [],
  },
  {
    n: 2,
    name: 'Cymbidiinae Species',
    description:
      'Cymbidium (standards, intermediate, miniature, Chinese, and Australian) and closely related genera—strictly excluding African/Mascarene species.',
    italics: [],
  },
  {
    n: 3,
    name: 'Dendrobiinae Species',
    description:
      'Dendrobium sections (including Callista, Formosae, Spatulata, Phalaenanthe, Latouria, Dendrocoryne, Pedilonum, Oxyglossum), and any other genus in the Dendrobiinae subtribe.',
    italics: [
      'Callista, Formosae, Spatulata, Phalaenanthe, Latouria, Dendrocoryne, Pedilonum, Oxyglossum',
    ],
  },
  {
    n: 4,
    name: 'Oncidiinae Species',
    description:
      'Brassia, Miltonia, Miltoniopsis, Rossioglossum, Gomesa, Oncidium, Trichocentrum, Tolumnia, Psychopsis, and Rhynchostele.',
    italics: [],
  },
  {
    n: 5,
    name: 'Cypripedioideae Species',
    description:
      'Paphiopedilum (sections Barbata, Brachypetalum, Parvisepalum, Coryopedilum, Cochlopetalum, Pardalopetalum) and Phragmipedium (including Micropetalum types).',
    italics: [
      'Barbata, Brachypetalum, Parvisepalum, Coryopedilum, Cochlopetalum, Pardalopetalum',
      'Micropetalum',
    ],
  },
  {
    n: 6,
    name: 'Phalaenopsis Species',
    description:
      'Phalaenopsis (large-flowered, single-flowered/sequential types, and miniature species).',
    italics: [],
  },
  {
    n: 7,
    name: 'Vandeae Species',
    description: 'Vanda, Rhynchostylis, Renanthera, and Aerides.',
    italics: [],
  },
  {
    n: 8,
    name: 'Pleurothallidinae Species',
    description:
      'Masdevallia (large and small-flowered) and related genera in the Pleurothallidinae subtribe.',
    italics: [],
  },
  {
    n: 9,
    name: 'Miscellaneous Exotic Species',
    description:
      'Jewel Orchids (Anoectochilus, Ludisia, Macodes), Coelogyne, Dendrochilum, Pleione, Calanthe, Phaius, Spathoglottis, Stanhopea, Gongora, Coryanthes, Zygopetalum, Catasetum, Cycnoches, Mormodes, Lycaste, Maxillaria, and Bulbophyllum.',
    italics: [
      'Anoectochilus, Ludisia, Macodes',
      'Coelogyne, Dendrochilum, Pleione, Calanthe, Phaius, Spathoglottis, Stanhopea, Gongora, Coryanthes, Zygopetalum, Catasetum, Cycnoches, Mormodes, Lycaste, Maxillaria',
      'Bulbophyllum',
    ],
  },
  {
    n: 10,
    name: 'South African, African & Mascarene Species',
    description:
      'Disa, Satyrium, Bonatea, Habenaria, Stenoglottis, Gastrorchis, Ansellia, Eulophia, Oeceoclades, Polystachya, Aerangis, and Angraecum.',
    italics: [
      'Disa, Satyrium, Bonatea, Habenaria, Stenoglottis, Gastrorchis',
      'Ansellia',
      'Eulophia, Oeceoclades, Polystachya, Aerangis',
      'Angraecum',
    ],
  },
  {
    n: 11,
    name: 'SA Bred',
    description: null,
    italics: [],
  },
  {
    n: 12,
    name: 'First Flowering',
    description: null,
    italics: [],
  },
  {
    n: 13,
    name: 'Most Fragrant',
    description: null,
    italics: [],
  },
];

export const PLANT_ENTRY_HEADING = 'Plant Entry for SAOC Members';

export const PLANT_ENTRY_STAGES: readonly PlantEntryStage[] = [
  {
    stage: '01',
    title: 'Register',
    description:
      'Submit your plants for judging and exhibition at the Western Cape 2027 Show in Stellenbosch.',
  },
  {
    stage: '02',
    title: 'Confirm entry and classes',
    description:
      'Submit your entry form with plant list and class selections. Entries reviewed against current SAOC judging standards. All entries are accepted at the discretion of the Judges.',
  },
  {
    stage: '03',
    title: 'Preparation and Drop Off',
    description:
      'Arrive at the venue for drop-off from early morning. All plants must be in place and labelled before the close of submissions. Judging begins on Wednesday at 12pm',
  },
  {
    stage: '04',
    title: 'Judging and awards',
    description:
      'SAOC accredited judges assess each class, finalizing show award and choosing the Best Specimen Plant Overall, Grand Champion, 1st Reserve Champion, 2nd Reserve Champion. The National Show Committee will move plants to the exhibit, and the show will open to the public.',
  },
];

export const LANDING_CTA = {
  startPlanning: 'Start planning your entry now.',
  registerHere: 'Register Here',
  openingSentence: 'The 19th National Orchid Show opens on 23rd September 2027 in Stellenbosch.',
} as const;
