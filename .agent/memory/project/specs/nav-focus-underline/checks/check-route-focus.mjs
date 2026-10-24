// nav-focus-underline -- lib/route-focus.ts core with fake DOM objects (no jsdom). Run: npx tsx <this file>
import { shouldMoveRouteFocus, focusRouteTarget, ROUTE_FOCUS_ATTRIBUTE, ROUTE_FOCUS_WAIT_MS } from '../../../../../../lib/route-focus.ts';

const failures = [];
const eq = (name, got, want) => {
  if (JSON.stringify(got) !== JSON.stringify(want)) failures.push(`${name}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
};

// shouldMoveRouteFocus: not on first render, not on an unchanged path, not on a hash navigation.
eq('first render', shouldMoveRouteFocus({ previousPath: null, nextPath: '/about', hash: '' }), false);
eq('first render undefined', shouldMoveRouteFocus({ previousPath: undefined, nextPath: '/about', hash: '' }), false);
eq('unchanged path', shouldMoveRouteFocus({ previousPath: '/about', nextPath: '/about', hash: '' }), false);
eq('changed path', shouldMoveRouteFocus({ previousPath: '/about', nextPath: '/events', hash: '' }), true);
eq('changed path with hash', shouldMoveRouteFocus({ previousPath: '/tickets', nextPath: '/events', hash: '#ticket-day' }), false);
eq('next path null', shouldMoveRouteFocus({ previousPath: '/about', nextPath: null, hash: '' }), false);

// Fakes.
function fakeEl(name, attrs = {}) {
  const el = {
    name, attrs: { ...attrs }, focused: false, focusOptions: null, listeners: [], children: [],
    getAttribute(n) { return n in el.attrs ? el.attrs[n] : null; },
    setAttribute(n, v) { el.attrs[n] = String(v); },
    removeAttribute(n) { delete el.attrs[n]; },
    focus(o) { el.focused = true; el.focusOptions = o ?? null; },
    contains(other) { return other === el || el.children.includes(other); },
    addEventListener(type, fn) { el.listeners.push({ type, fn }); },
  };
  return el;
}
function fakeDoc({ main, h1, active = null }) {
  if (main && h1) main.children.push(h1);
  return {
    activeElement: active,
    querySelector(sel) {
      if (sel === '#main-content h1') return h1 ?? null;
      if (sel === '#main-content') return main ?? null;
      return null;
    },
  };
}

// h1 present: focused with preventScroll, tabindex=-1 added, marker set, result 'h1'.
{
  const main = fakeEl('main', { tabindex: '-1' });
  const h1 = fakeEl('h1');
  const link = fakeEl('a');
  const result = focusRouteTarget(fakeDoc({ main, h1, active: link }));
  eq('h1 result', result, 'h1');
  eq('h1 focused', h1.focused, true);
  eq('h1 preventScroll', h1.focusOptions, { preventScroll: true });
  eq('h1 tabindex', h1.getAttribute('tabindex'), '-1');
  eq('h1 marker attribute set', h1.getAttribute(ROUTE_FOCUS_ATTRIBUTE) !== null, true);
  eq('main not focused when h1 exists', main.focused, false);
  eq('blur listener registered', h1.listeners.some((l) => l.type === 'blur'), true);
  // The marker is removed again on blur.
  for (const l of h1.listeners.filter((x) => x.type === 'blur')) l.fn();
  eq('h1 marker removed on blur', h1.getAttribute(ROUTE_FOCUS_ATTRIBUTE), null);
}
// An existing tabindex on the h1 is respected, not overwritten.
{
  const h1 = fakeEl('h1', { tabindex: '0' });
  focusRouteTarget(fakeDoc({ main: fakeEl('main', { tabindex: '-1' }), h1 }));
  eq('existing tabindex kept', h1.getAttribute('tabindex'), '0');
}
// No h1: falls back to <main>.
{
  const main = fakeEl('main', { tabindex: '-1' });
  const result = focusRouteTarget(fakeDoc({ main, active: fakeEl('a') }));
  eq('main fallback result', result, 'main');
  eq('main focused', main.focused, true);
  eq('main marker attribute set', main.getAttribute(ROUTE_FOCUS_ATTRIBUTE) !== null, true);
}
// No <main> at all: nothing happens, no throw.
eq('no main', focusRouteTarget(fakeDoc({})), 'none');
// Focus already inside <main> on some other element (autofocus, a late user action): never stolen.
{
  const main = fakeEl('main', { tabindex: '-1' });
  const h1 = fakeEl('h1');
  const input = fakeEl('input');
  main.children.push(input);
  const result = focusRouteTarget(fakeDoc({ main, h1, active: input }));
  eq('kept result', result, 'kept');
  eq('kept: h1 not focused', h1.focused, false);
}
// Focus sitting on <main> itself (the fallback landed there) does not count as 'kept': the h1 can still take it.
{
  const main = fakeEl('main', { tabindex: '-1' });
  const h1 = fakeEl('h1');
  const result = focusRouteTarget(fakeDoc({ main, h1, active: main }));
  eq('main-active does not block h1', result, 'h1');
}
eq('wait constant is a positive number', typeof ROUTE_FOCUS_WAIT_MS === 'number' && ROUTE_FOCUS_WAIT_MS > 0, true);

if (failures.length) { console.error('FAIL', failures); process.exit(1); }
console.log('route-focus checks pass');
