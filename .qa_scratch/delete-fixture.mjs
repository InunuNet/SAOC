import { deleteAllowlistedFixtureUser } from '../contracts/checks/admin-auth-hardening/_shared.mjs';
import { readFileSync } from 'node:fs';
const { uid } = JSON.parse(readFileSync('.qa_scratch/session.json', 'utf8'));
await deleteAllowlistedFixtureUser(uid);
console.log('deleted', uid);
