// Reproduces the real repo's shape: a TYPE-ONLY import from firebase-admin,
// erased at compile time — must NOT create a false-positive runtime edge.
import type { Timestamp } from 'firebase-admin/firestore';
export type Foo = { at: Timestamp };
