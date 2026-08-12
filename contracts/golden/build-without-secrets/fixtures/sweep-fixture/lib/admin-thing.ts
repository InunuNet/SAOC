import { getFirestore } from 'firebase-admin/firestore';
export function doAdminThing() { return getFirestore(); }
