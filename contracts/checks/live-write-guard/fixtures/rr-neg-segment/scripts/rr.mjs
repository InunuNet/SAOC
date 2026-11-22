// fixture: a route-runner check; Firebase is stubbed only when preload.cjs is loaded (rrfixture-store)
import { store } from '../../../../../harness/route-runner/store.mjs';
await store.collection('x').doc('y').set({ a: 1 });
