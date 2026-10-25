// =============================================================
// SAOC — e2e/document-layout-aside-props.spec.ts
// DocumentLayout's opt-in aside props (asideFirst, asideBare), off by default. The markup half
// renders the component on the server and proves the default output is byte-identical to the
// pre-prop markup and that each prop adds only its own class. The rendered half applies those
// classes to a real page's layout (/sponsors, content aside) and measures the CSS.
// =============================================================
import { execFileSync } from 'node:child_process';

import { expect, test, type Page } from '@playwright/test';

const ASIDE_CAP_PX = 440;

function markup(props: Record<string, boolean>): string {
  const args = ['e2e/support/render-document-layout.tsx', JSON.stringify(props)];
  return execFileSync('node_modules/.bin/tsx', args, { encoding: 'utf8' });
}

test.describe('DocumentLayout aside props: markup', () => {
  test('default render is unchanged', () => {
    const expected =
      '<div data-doc-layout="true" class="doc-layout saoc-container"><div data-doc-main="true">body</div>' +
      '<aside data-doc-aside="true" data-doc-aside-kind="content" class="doc-aside"><p>aside</p></aside></div>';
    expect(markup({})).toBe(expected);
    expect(markup({ asideFirst: false, asideBare: false })).toBe(expected);
  });

  test('asideFirst adds only its layout class and keeps DOM order', () => {
    const html = markup({ asideFirst: true });
    expect(html).toContain('class="doc-layout saoc-container doc-layout--aside-first"');
    expect(html).toContain('class="doc-aside"');
    expect(html.indexOf('data-doc-main')).toBeLessThan(html.indexOf('<aside'));
  });

  test('asideBare adds only its aside class', () => {
    const html = markup({ asideBare: true });
    expect(html).toContain('class="doc-layout saoc-container"');
    expect(html).toContain('class="doc-aside doc-aside--bare"');
  });
});

async function sponsors(page: Page, width: number, layoutClass: string, asideClass: string) {
  await page.setViewportSize({ width, height: 900 });
  await page.goto('/sponsors');
  return page.evaluate(
    ({ layoutClass, asideClass }) => {
      const layout = document.querySelector('[data-doc-layout]') as HTMLElement;
      const aside = layout.querySelector(':scope > [data-doc-aside]') as HTMLElement;
      const main = layout.querySelector(':scope > [data-doc-main]') as HTMLElement;
      if (layoutClass) layout.classList.add(layoutClass);
      if (asideClass) aside.classList.add(asideClass);
      const cs = getComputedStyle(aside);
      const a = aside.getBoundingClientRect();
      const m = main.getBoundingClientRect();
      return {
        asideTop: a.top, mainTop: m.top, asideLeft: a.left, mainRight: m.right, asideWidth: a.width,
        background: cs.backgroundColor, padding: cs.paddingTop, shadow: cs.boxShadow,
        position: cs.position, top: cs.top,
      };
    },
    { layoutClass, asideClass },
  );
}

test.describe('DocumentLayout aside props: rendered', () => {
  test('default: aside after the prose below 1024 and wider than the cap', async ({ page }) => {
    const m = await sponsors(page, 800, '', '');
    expect(m.asideTop).toBeGreaterThan(m.mainTop);
    expect(m.asideWidth).toBeGreaterThan(ASIDE_CAP_PX);
  });

  test('asideFirst: aside above the prose and capped below 1024, right column from 1024', async ({ page }) => {
    const narrow = await sponsors(page, 800, 'doc-layout--aside-first', '');
    expect(narrow.asideTop).toBeLessThan(narrow.mainTop);
    expect(narrow.asideWidth).toBeLessThanOrEqual(ASIDE_CAP_PX);
    const wide = await sponsors(page, 1440, 'doc-layout--aside-first', '');
    expect(wide.asideLeft).toBeGreaterThanOrEqual(wide.mainRight);
    expect(wide.position).toBe('sticky');
  });

  test('asideBare: no card, capped below 1024, sticky top unchanged from 1024', async ({ page }) => {
    const narrow = await sponsors(page, 800, '', 'doc-aside--bare');
    expect(narrow.asideWidth).toBeLessThanOrEqual(ASIDE_CAP_PX);
    const plain = await sponsors(page, 1440, '', '');
    const wide = await sponsors(page, 1440, '', 'doc-aside--bare');
    expect(wide.background).toBe('rgba(0, 0, 0, 0)');
    expect(wide.padding).toBe('0px');
    expect(wide.shadow).toBe('none');
    expect(wide.position).toBe('sticky');
    expect(wide.top).toBe(plain.top);
  });
});
