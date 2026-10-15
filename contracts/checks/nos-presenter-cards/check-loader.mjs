// nos-presenter-cards F1 — loader + view model (golden §3). Static source check.
//   - null Sanity `order` stays null (the base mapped it to 0, which hid "unset");
//   - the GROQ query also reads the photo asset _ref the crop table is keyed on, and keeps
//     the event filter and order(order asc) the conference-workshop-tickets-f6 checks pin;
//   - the loader builds `photo` through presenterPhoto(); `photoUrl` leaves the view model.
//
// Run as: node contracts/checks/nos-presenter-cards/check-loader.mjs
import { finish, readRepoFile } from './_lib.mjs';

const LOADER = 'lib/view-models/load-presenters.ts';
const VM = 'lib/view-models/ticket-card.ts';
const failures = [];
const expect = (ok, msg) => {
  if (!ok) failures.push(msg);
};

const loader = readRepoFile(LOADER);
const vm = readRepoFile(VM);
if (!loader || !vm) finish('check-loader.mjs', [`missing ${!loader ? LOADER : VM}`]);

expect(!/order:\s*doc\.order\s*\?\?\s*0\b/.test(loader), `${LOADER} still maps a null order to 0`);
expect(/order:\s*doc\.order\s*\?\?\s*null\b/.test(loader), `${LOADER} must map order as \`order: doc.order ?? null\``);
expect(/"photoAssetRef"\s*:\s*photo\.asset\._ref/.test(loader), `${LOADER} GROQ must project "photoAssetRef": photo.asset._ref`);
expect(/"photoUrl"\s*:\s*photo\.asset->url/.test(loader), `${LOADER} GROQ must still project "photoUrl": photo.asset->url (the crop base URL)`);
expect(/event\s*==\s*\$event/.test(loader) && /order\(order asc\)/.test(loader), `${LOADER} must keep the event filter and order(order asc)`);
expect(/from '\.\/presenter-photo\.ts'/.test(loader), `${LOADER} must import presenterPhoto from './presenter-photo.ts' (relative + .ts, like its other imports)`);
expect(/photo:\s*presenterPhoto\(\s*doc\.photoUrl\s*,\s*doc\.photoAssetRef\s*\)/.test(loader), `${LOADER} must map \`photo: presenterPhoto(doc.photoUrl, doc.photoAssetRef)\``);
expect(/catch\s*\(error\)\s*\{\s*console\.error\('\[load-presenters\]/.test(loader), `${LOADER} must keep its never-throw catch (A30)`);

const iface = vm.match(/export interface PresenterCardViewModel\s*\{([\s\S]*?)\n\}/)?.[1] ?? '';
expect(iface.length > 0, `${VM} must export interface PresenterCardViewModel`);
expect(/\border:\s*number\s*\|\s*null;/.test(iface), 'PresenterCardViewModel.order must be `number | null`');
expect(/\bphoto:\s*PresenterPhoto\s*\|\s*null;/.test(iface), 'PresenterCardViewModel must have `photo: PresenterPhoto | null`');
expect(!/\bphotoUrl\b/.test(iface), 'PresenterCardViewModel must drop `photoUrl` (replaced by `photo`)');
expect(/\brole:\s*string\s*\|\s*null;/.test(iface) && /\bbioExcerpt:\s*string\s*\|\s*null;/.test(iface), 'PresenterCardViewModel keeps role and bioExcerpt as string | null');

finish('check-loader.mjs', failures, 'loader keeps null order, reads the photo asset ref, and builds `photo` via presenterPhoto().');
