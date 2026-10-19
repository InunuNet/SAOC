// A3 - the switch and the collapse, exercised on the real module (run with cwd = the implementation tree:
// pnpm exec tsx contracts/checks/launch-weekend/f8/check-d-gap-logic.mts).
const problems: string[] = [];
const mod = await import(`${process.cwd()}/lib/data/show-pages.ts`).catch((e: unknown) => { console.error(`INFRA: import failed: ${String(e)}`); process.exit(2); });
type WallEnv = { SHOW_PLACEHOLDER_PREVIEW?: string; SITE_PUBLIC_LAUNCH?: string; BETA_BASIC_AUTH_USER?: string; BETA_BASIC_AUTH_PASSWORD?: string };
type Notice = { label: string; text: string; tone: string; gap?: boolean };
type Section = { sectionKey: string; heading: string | null; kind: string; body: object; notice: Notice | null };
type GapModule = {
  withholdPlaceholderProse?: (env: WallEnv) => boolean;
  buildAbsentShowPage?: (pageKey: string, fallback: { label: string; purpose: string }, settings: null) => { sections: Section[] };
  applyContentGaps?: (sections: Section[], withhold: boolean) => Section[];
  FALLBACK_PLACEHOLDER_NOTICE: string;
  ABSENT_SHOW_PAGE_FIXED_SENTENCE: string;
};
// The module is loaded dynamically, so its shape is asserted here and the two functions are checked at runtime below.
const { withholdPlaceholderProse, buildAbsentShowPage, applyContentGaps, FALLBACK_PLACEHOLDER_NOTICE, ABSENT_SHOW_PAGE_FIXED_SENTENCE } = mod as GapModule;
if (typeof withholdPlaceholderProse !== 'function' || typeof applyContentGaps !== 'function') {
  console.error('FAIL: lib/data/show-pages.ts must export withholdPlaceholderProse and applyContentGaps');
  process.exit(1);
}
const eq = (name: string, got: unknown, want: unknown) => { if (got !== want) problems.push(`${name}: got ${String(got)}, want ${String(want)}`); };
// Switch: withhold unless the preview is opted into AND the wall is up (creds configured, not launched). Exact-match, fail closed.
const creds = { BETA_BASIC_AUTH_USER: 'u', BETA_BASIC_AUTH_PASSWORD: 'p' };
eq('default', withholdPlaceholderProse({}), true);
eq('preview true, wall up', withholdPlaceholderProse({ SHOW_PLACEHOLDER_PREVIEW: 'true', ...creds }), false);
eq('preview true, launched', withholdPlaceholderProse({ SHOW_PLACEHOLDER_PREVIEW: 'true', SITE_PUBLIC_LAUNCH: 'true', ...creds }), true);
eq('preview true, creds unset', withholdPlaceholderProse({ SHOW_PLACEHOLDER_PREVIEW: 'true' }), true);
eq('preview true, creds empty', withholdPlaceholderProse({ SHOW_PLACEHOLDER_PREVIEW: 'true', BETA_BASIC_AUTH_USER: '', BETA_BASIC_AUTH_PASSWORD: '' }), true);
eq('preview true, password empty', withholdPlaceholderProse({ SHOW_PLACEHOLDER_PREVIEW: 'true', BETA_BASIC_AUTH_USER: 'u', BETA_BASIC_AUTH_PASSWORD: '' }), true);
eq('preview true, user empty', withholdPlaceholderProse({ SHOW_PLACEHOLDER_PREVIEW: 'true', BETA_BASIC_AUTH_USER: '', BETA_BASIC_AUTH_PASSWORD: 'p' }), true);
eq('preview TRUE', withholdPlaceholderProse({ SHOW_PLACEHOLDER_PREVIEW: 'TRUE', ...creds }), true);
eq('preview 1', withholdPlaceholderProse({ SHOW_PLACEHOLDER_PREVIEW: '1', ...creds }), true);
eq('preview empty', withholdPlaceholderProse({ SHOW_PLACEHOLDER_PREVIEW: '', ...creds }), true);

const warn = { label: 'Placeholder copy', text: FALLBACK_PLACEHOLDER_NOTICE, tone: 'warning' };
const muted = { label: 'Not yet confirmed', text: 'r', tone: 'muted' };
const mk = (key: string, notice: Notice | null, heading: string | null = key): Section => ({ sectionKey: key, heading, kind: 'prose', body: {}, notice });
const input = [mk('a', null), mk('b', warn), mk('c', muted), mk('d', warn), mk('e', warn)];
const out = applyContentGaps(input, true) ;
eq('collapsed length', out.length, 3);
eq('order kept', out.map((s) => s.sectionKey === 'b' ? 'GAP' : s.sectionKey).join(','), 'a,GAP,c');
const gap = out[1];
eq('gap heading null', gap?.heading, null);
eq('gap flag', gap?.notice?.gap, true);
eq('gap label', gap?.notice?.label, 'To be confirmed by the show committee');
eq('gap text', gap?.notice?.text, ABSENT_SHOW_PAGE_FIXED_SENTENCE);
eq('gap tone not warning', gap?.notice?.tone === 'warning', false);
eq('gap omits AI wording', /AI-generated|placeholder/i.test(`${gap?.notice?.label} ${gap?.notice?.text}`), false);
eq('untouched a', out[0], input[0]);
eq('untouched c', out[2], input[2]);
const off = applyContentGaps(input, false) as unknown[];
eq('withhold=false is identity', off.length === input.length && off.every((s, i) => s === input[i]), true);
const clean = [mk('a', null), mk('c', muted)];
eq('no warnings is identity', (applyContentGaps(clean, true) as unknown[]).every((s, i) => s === clean[i]), true);
// Absent-doc fallback: keeps its manifest purpose block, shows the gap notice once, never the AI wording.
if (typeof buildAbsentShowPage !== 'function') {
  problems.push('buildAbsentShowPage is not exported');
} else {
  const { createElement } = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { ShowPageProse } = await import(`${process.cwd()}/components/nos/ShowPageProse.tsx`);
  const purpose = 'The overall schedule of sessions across the four show days.';
  const page = buildAbsentShowPage('11-programme', { label: 'Programme', purpose }, null);
  const html = page.sections.map((s) => renderToStaticMarkup(createElement(ShowPageProse, { section: s }))).join('');
  const text = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
  const count = (needle: string) => text.split(needle).length - 1;
  eq('fallback keeps purpose', count(purpose), 1);
  eq('fallback gap sentence once', count(ABSENT_SHOW_PAGE_FIXED_SENTENCE), 1);
  eq('fallback pending chip once', count('To be confirmed by the show committee'), 1);
  eq('fallback gap marker', html.includes('data-nos-content-gap'), true);
  eq('fallback has no AI wording', /AI-generated|Placeholder copy/i.test(text), false);
}
if (problems.length) { console.error(`FAIL (${problems.length}):\n- ${problems.join('\n- ')}`); process.exit(1); }
console.log('PASS: switch is exact-match fail-closed and applyContentGaps collapses only warning-toned sections');
