// LT-1 classifier: pure, so the sweep's pass/fail rule is testable without a browser. Input is one heading record from the page
// ({ serif, size, weight }); output is 'display-ok' | 'display-fail' | 'small-ok' | 'small-fail' | 'not-serif' | 'sans-light-fail'.
// A sans (Karla) heading at weight 300 is a failure too: Karla loads 400-700 only (components/nos-chrome/fonts.ts), so a 300 there means an LT-1 rule leaked onto a Karla label.
import { VALUES } from './_lib.mjs';

export function classify(h) {
  const v = VALUES.lt1;
  if (!h.serif) return h.weight === '300' ? 'sans-light-fail' : 'not-serif';
  if (h.size >= v.thresholdPx - v.epsilonPx) return h.weight === v.displayWeight ? 'display-ok' : 'display-fail';
  return h.weight === v.smallWeight ? 'small-ok' : 'small-fail';
}

export function selftest() {
  const bad = [];
  const expect = (name, got, want) => { if (got !== want) bad.push(`${name}: got ${got}, expected ${want}`); };
  expect('48px/400 serif (the ruling\'s /plan-your-visit h2 at 1280)', classify({ serif: true, size: 48, weight: '400' }), 'display-fail');
  expect('32px/400 serif (the ruling\'s h2 at 390)', classify({ serif: true, size: 32, weight: '400' }), 'display-fail');
  expect('32px/300 serif', classify({ serif: true, size: 32, weight: '300' }), 'display-ok');
  expect('31.9999px/300 float noise still counts as 32', classify({ serif: true, size: 31.9999, weight: '300' }), 'display-ok');
  expect('44px/600 serif', classify({ serif: true, size: 44, weight: '600' }), 'display-fail');
  expect('44px/400 serif (the NOS 404 h1 on the #76 head, NOS Design reading)', classify({ serif: true, size: 44, weight: '400' }), 'display-fail');
  expect('44px/300 serif (the NOS 404 h1 once fixed)', classify({ serif: true, size: 44, weight: '300' }), 'display-ok');
  expect('22px/400 serif card title', classify({ serif: true, size: 22, weight: '400' }), 'small-ok');
  expect('22px/300 serif (a light h3 would change a heading the ruling says stays 400)', classify({ serif: true, size: 22, weight: '300' }), 'small-fail');
  expect('48px/400 sans (a Karla label is not a display serif)', classify({ serif: false, size: 48, weight: '400' }), 'not-serif');
  expect('12px/600 sans eyebrow h2 is left alone', classify({ serif: false, size: 12, weight: '600' }), 'not-serif');
  expect('12px/300 sans eyebrow h2 (the LT-1 rule leaked onto a Karla label)', classify({ serif: false, size: 12, weight: '300' }), 'sans-light-fail');
  return bad;
}
