import type { SchemaTypeDefinition } from 'sanity';

import { homePage } from './documents/homePage';
import { aboutPage } from './documents/aboutPage';
import { nationalShow } from './documents/nationalShow';
import { contactPage } from './documents/contactPage';
import { society } from './documents/society';
import { boardMember } from './documents/boardMember';
import { event } from './documents/event';
import { showClass } from './documents/showClass';
import { award } from './documents/award';
import { sponsor } from './documents/sponsor';
import { judge } from './documents/judge';

import { portableText } from './objects/portableText';

export const schemaTypes: SchemaTypeDefinition[] = [
  // Singletons
  homePage,
  aboutPage,
  nationalShow,
  contactPage,
  // Collections
  society,
  boardMember,
  event,
  showClass,
  award,
  sponsor,
  judge,
  // Objects
  portableText,
];
