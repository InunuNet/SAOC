import {
  HOME_FOREWORD_HEADING,
  HOME_FOREWORD_INTRO_COUNT,
  HOME_FOREWORD_LABEL,
  HOME_FOREWORD_PARAGRAPHS,
} from '@/lib/data/home-foreword';
import { ForewordExpandable } from './ForewordExpandable';

/** Renders HOME_FOREWORD_HEADING ("Forward by Douglas McMurtry"); edit the text in lib/data/home-foreword.ts. */
export function ForewordSection() {
  return (
    <section
      className="py-12 lg:py-16 bg-ivory border-t border-rule"
      aria-labelledby="home-foreword-heading"
    >
      <div className="saoc-container">
        <ForewordExpandable
          label={HOME_FOREWORD_LABEL}
          heading={HOME_FOREWORD_HEADING}
          paragraphs={HOME_FOREWORD_PARAGRAPHS}
          introCount={HOME_FOREWORD_INTRO_COUNT}
        />
      </div>
    </section>
  );
}
