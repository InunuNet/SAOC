// sponsor-enquiry-both-hosts RUN-AFTER-DEPLOY e2e (non-required, never a pre-deploy gate assertion).
// Submits ONE clearly test-marked enquiry per host to the DEPLOYED API, asserts the stored Firestore doc (source, null-coalesced
// optionals, status) and the admin notice (via read-only `gws gmail`), then deletes the test docs.
//
// WHAT IT TOUCHES (and nothing else):
//   Firestore collection `sponsorEnquiries` (the project in .env.local FIREBASE_ADMIN_*): ONLY documents whose contactName is exactly
//   `E2E-TEST sponsor-enquiry-both-hosts <nonce> saoc` or `... <nonce> nos` (two docs expected, one per host). It refuses to delete
//   if a query returns anything other than exactly one such doc.
//   Real emails: one admin notice per ADMIN_EMAIL_ALLOWLIST recipient per host, and one visitor acknowledgement per host to
//   e2e-test@example.com (reserved domain, undeliverable by design). Sent mail cannot be unsent; the subject/body carry the marker.
// Credentials: BETA_BASIC_AUTH_USER/PASSWORD and FIREBASE_ADMIN_* are read from the environment (.env.local) and never printed.
// Run as: node --env-file-if-exists=.env.local <this file>   (from the project root, after the change is deployed)
// Exit 0 PASS, 1 FAIL (a real finding), 77 inconclusive (credentials, beta unreachable, or gws unavailable): contract.py reads 77 as a skip.
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const HOSTS = [
  { site: 'saoc', origin: 'https://beta.saoc.co.za', subjectNeedle: /SAOC/, subjectForbidden: /National Orchid Show/ },
  { site: 'nos', origin: 'https://nos.saoc.co.za', subjectNeedle: /National Orchid Show/, subjectForbidden: /\bSAOC\b/ },
];
const COLLECTION = 'sponsorEnquiries';
const VISITOR_EMAIL = 'e2e-test@example.com';
const MAIL_WAIT_MS = 90000;
const MAIL_POLL_MS = 6000;

const user = process.env.BETA_BASIC_AUTH_USER;
const pass = process.env.BETA_BASIC_AUTH_PASSWORD;
const { FIREBASE_ADMIN_PROJECT_ID: projectId, FIREBASE_ADMIN_CLIENT_EMAIL: clientEmail } = process.env;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
if (!user || !pass || !projectId || !clientEmail || !privateKey) {
  console.error('INCONCLUSIVE: BETA_BASIC_AUTH_* or FIREBASE_ADMIN_* not set (run from the project root with .env.local)');
  process.exit(77);
}

const nonce = randomBytes(4).toString('hex');
const failures = [];
let inconclusive = false;
const fail = (m) => failures.push(m);
const markerFor = (site) => `E2E-TEST sponsor-enquiry-both-hosts ${nonce} ${site}`;

const app = getApps()[0] ?? initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
const db = getFirestore(app);
const auth = `Basic ${Buffer.from(`${user}:${pass}`).toString('base64')}`;

async function submit({ site, origin }) {
  const body = { contactName: markerFor(site), email: VISITOR_EMAIL, message: `${markerFor(site)}: automated post-deploy check, safe to ignore and delete.`, consent: true };
  let res;
  try {
    res = await fetch(`${origin}/api/sponsors/enquire`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: auth }, body: JSON.stringify(body), signal: AbortSignal.timeout(30000) });
  } catch (error) {
    inconclusive = true;
    console.error(`INCONCLUSIVE: could not reach ${origin} (${error.name})`);
    return false;
  }
  if (res.status !== 201) { fail(`${site}: POST ${origin}/api/sponsors/enquire returned ${res.status}, want 201`); return false; }
  return true;
}

async function docsFor(site) {
  const snap = await db.collection(COLLECTION).where('contactName', '==', markerFor(site)).get();
  return snap.docs;
}

function gws(args) {
  return JSON.parse(execFileSync('gws', args, { encoding: 'utf8', timeout: 30000 }));
}

async function findNotice(site) {
  const deadline = Date.now() + MAIL_WAIT_MS;
  while (Date.now() < deadline) {
    const list = gws(['gmail', 'users', 'messages', 'list', '--params', JSON.stringify({ userId: 'me', q: `subject:"New sponsorship enquiry" "${markerFor(site)}" newer_than:1d`, maxResults: 5 })]);
    const first = list.messages?.[0];
    if (first) {
      const msg = gws(['gmail', 'users', 'messages', 'get', '--params', JSON.stringify({ userId: 'me', id: first.id, format: 'metadata', metadataHeaders: ['Subject'] })]);
      return msg.payload?.headers?.find((h) => h.name.toLowerCase() === 'subject')?.value ?? '';
    }
    await new Promise((r) => setTimeout(r, MAIL_POLL_MS));
  }
  return null;
}

const submitted = [];
try {
  for (const host of HOSTS) if (await submit(host)) submitted.push(host);

  // Firestore: the stored doc records its site and null-coalesces the optionals.
  await new Promise((r) => setTimeout(r, 3000));
  for (const host of submitted) {
    const docs = await docsFor(host.site);
    if (docs.length !== 1) { fail(`${host.site}: expected exactly 1 ${COLLECTION} doc for the marker, found ${docs.length}`); continue; }
    const data = docs[0].data();
    if (data.source !== host.site) fail(`${host.site}: doc.source is ${JSON.stringify(data.source)}, want "${host.site}"`);
    if (data.status !== 'new') fail(`${host.site}: doc.status is ${JSON.stringify(data.status)}, want "new"`);
    for (const k of ['organisation', 'phone', 'website', 'level']) if (data[k] !== null) fail(`${host.site}: doc.${k} is ${JSON.stringify(data[k])}, want null`);
  }

  // Admin notice: the subject tells the two sites apart (read-only gws).
  try {
    execFileSync('gws', ['--version'], { stdio: 'ignore' });
    for (const host of submitted) {
      const subject = await findNotice(host.site);
      if (subject === null) fail(`${host.site}: no admin notice found in the inbox within ${MAIL_WAIT_MS / 1000}s`);
      else if (!host.subjectNeedle.test(subject) || host.subjectForbidden.test(subject)) fail(`${host.site}: admin notice subject "${subject}" does not identify the ${host.site} site`);
    }
  } catch (error) {
    inconclusive = true;
    console.error(`INCONCLUSIVE: gws unavailable or not authenticated (${error.name}); admin notice not asserted`);
  }
} finally {
  // Cleanup: delete ONLY the exact-marker docs, and only when each query returns exactly one.
  for (const host of HOSTS) {
    const docs = await docsFor(host.site).catch(() => []);
    if (docs.length === 1) await docs[0].ref.delete();
    else if (docs.length > 1) fail(`${host.site}: refused to delete, ${docs.length} docs matched the marker (expected 1)`);
  }
}

if (failures.length) { console.error(`FAIL (${failures.length}):\n- ${failures.join('\n- ')}`); process.exit(1); }
if (inconclusive) process.exit(77);
console.log(`PASS: both hosts stored a correctly sourced doc and sent a site-identifying admin notice (nonce ${nonce}); test docs deleted`);
