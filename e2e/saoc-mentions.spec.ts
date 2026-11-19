// Unit spec for lib/saoc-mentions.ts (runs under Playwright like the repo's other logic specs):
// mentions are linked once, and never inside a span that is already a link.
import { expect, test } from '@playwright/test';

import { SAOC_MENTION_MARK, linkSaocInBlocks } from '@/lib/saoc-mentions';

interface Span {
  _type: 'span';
  _key: string;
  text: string;
  marks?: string[];
}
interface Block {
  _type: 'block';
  _key: string;
  children: Span[];
  markDefs: { _key: string; _type: string; href?: string }[];
}

const LINK_KEY = 'l1';

function block(markDefs: Block['markDefs'], marks: string[]): Block {
  return {
    _type: 'block',
    _key: 'b0',
    markDefs,
    children: [{ _type: 'span', _key: 's0', text: 'Run by the SAOC.', marks }],
  };
}

test.describe('linkSaocInBlocks', () => {
  test('wraps a plain mention in a saocLink mark', () => {
    const [out] = linkSaocInBlocks([block([], [])]) as Block[];
    const linked = out.children.filter((c) => c.marks?.length);
    expect(linked.map((c) => c.text)).toEqual(['SAOC']);
    const key = linked[0].marks?.[0];
    expect(out.markDefs.find((d) => d._key === key)?._type).toBe(SAOC_MENTION_MARK);
  });

  test('leaves a span inside an existing link annotation untouched', () => {
    const input = block([{ _key: LINK_KEY, _type: 'link', href: 'https://example.org' }], [LINK_KEY]);
    const [out] = linkSaocInBlocks([input]) as Block[];
    expect(out.children).toEqual(input.children);
    expect(out.markDefs.some((d) => d._type === SAOC_MENTION_MARK)).toBe(false);
  });

  test('leaves a span that already carries a saocLink untouched (idempotent)', () => {
    const once = linkSaocInBlocks([block([], [])]);
    const twice = linkSaocInBlocks(once) as Block[];
    expect(twice[0].children).toEqual((once as Block[])[0].children);
  });

  test('still links a mention in a span that only has a non-link mark', () => {
    const input = block([], ['strong']);
    const [out] = linkSaocInBlocks([input]) as Block[];
    expect(out.markDefs.some((d) => d._type === SAOC_MENTION_MARK)).toBe(true);
  });
});
