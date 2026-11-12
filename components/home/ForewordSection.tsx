import {
  HOME_FOREWORD_HEADING,
  HOME_FOREWORD_LABEL,
  HOME_FOREWORD_PARAGRAPHS,
} from '@/lib/data/home-foreword';

/** Renders HOME_FOREWORD_HEADING ("Forward by Douglas McMurtry"); edit the text in lib/data/home-foreword.ts. */
export function ForewordSection() {
  return (
    <section className="py-24 bg-ivory border-t border-rule" aria-labelledby="home-foreword-heading">
      <div className="saoc-container">
        <div className="grid md:grid-cols-[5fr_7fr] gap-x-16 gap-y-10">
          <div>
            <div className="mb-5">
              <span className="eyebrow">{HOME_FOREWORD_LABEL}</span>
            </div>
            <h2
              id="home-foreword-heading"
              className="font-serif font-normal min-[942px]:font-light text-[clamp(28px,3.4vw,46px)] leading-[1.08] tracking-[-0.015em] text-primary"
            >
              {HOME_FOREWORD_HEADING}
            </h2>
          </div>

          <div className="doc-prose">
            {HOME_FOREWORD_PARAGRAPHS.map((paragraph) => (
              <p key={paragraph}>{paragraph}</p>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
