// Static Server Component — no props. Lee-Ann's verbatim "South African Exhibitors" copy
// (Google Drive file 1UKUdzZ9NAJHsqWHSV0mN9tnTrp6NE8I4, word/document.xml lines 1-7), gated
// word-for-word against contracts/checks/vendor-f3-showcase-page/fixtures/intro-prose.golden.json
// (A5). Not to be rewritten, paraphrased, or "improved" — see
// contracts/golden/vendor-f3-showcase-page/README.md, "Judgement call 1".
//
// Paragraphs are static, hardcoded, trusted copy (no user input, nothing dynamic) rendered
// via dangerouslySetInnerHTML rather than JSX text children: react-dom/server always encodes
// a plain straight apostrophe in text content as `&#x27;`, which would silently diverge from
// the golden fixture's literal apostrophe on every render — this keeps the served markup a
// byte-for-byte match of Lee-Ann's copy instead.
const HEADING = 'Showcasing the Finest in South African Orchid Growing';

const PARAGRAPHS = [
  "The 2027 South African National Orchid Show will proudly showcase the country's leading " +
    'orchid growers, specialist nurseries, orchid societies and commercial exhibitors, ' +
    "bringing together an exceptional collection of South Africa's finest orchids under one " +
    'roof.',
  'Visitors will have the opportunity to meet the passionate individuals and organisations ' +
    "whose dedication, knowledge and years of experience have helped shape South Africa's " +
    'vibrant orchid community. From internationally recognised breeders and award-winning ' +
    'exhibitors to specialist species growers and emerging enthusiasts, the exhibition ' +
    'celebrates the remarkable diversity and excellence of orchid cultivation across the ' +
    'country.',
  'Exhibitors will present stunning displays of species and hybrid orchids, compete for ' +
    'prestigious national awards, and share their expertise through demonstrations, ' +
    'discussions and informal conversations throughout the event. The plant sales area will ' +
    'offer visitors the opportunity to purchase exceptional orchids, growing media, pots, ' +
    "accessories and specialist products directly from many of South Africa's most respected " +
    'orchid nurseries.',
  'Whether you are building your first orchid collection or searching for a rare specimen to ' +
    'complete an established collection, the South African Exhibitors Pavilion offers a ' +
    "unique opportunity to learn from the country's leading growers while celebrating the " +
    'innovation, craftsmanship and horticultural excellence that continue to place South ' +
    'African orchid growing on the international stage.',
];

export function VendorIntro() {
  return (
    <section className="max-w-3xl">
      <h2
        className="font-serif text-[28px] font-medium leading-snug text-ink"
        dangerouslySetInnerHTML={{ __html: HEADING }}
      />
      <div className="mt-5 space-y-4 font-sans text-[16px] leading-relaxed text-ink/80">
        {PARAGRAPHS.map((paragraph, index) => (
          <p key={index} dangerouslySetInnerHTML={{ __html: paragraph }} />
        ))}
      </div>
    </section>
  );
}
