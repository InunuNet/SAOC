import type { SchemaTypeDefinition } from 'sanity';

import { homePage } from './documents/homePage';
import { aboutPage } from './documents/aboutPage';
import { nationalShow } from './documents/nationalShow';
import { contactPage } from './documents/contactPage';
import { judgingPage } from './documents/judgingPage';
import { membersPage } from './documents/membersPage';
import { society } from './documents/society';
import { boardMember } from './documents/boardMember';
import { event } from './documents/event';
import { show } from './documents/show';
import { showClass } from './documents/showClass';
import { award } from './documents/award';
import { sponsor } from './documents/sponsor';
import { judge } from './documents/judge';
import { province } from './documents/province';

import { portableText } from './objects/portableText';

export const schemaTypes: SchemaTypeDefinition[] = [
  // Singletons
  homePage,
  aboutPage,
  nationalShow,
  contactPage,
  judgingPage,
  membersPage,
  // Collections
  society,
  boardMember,
  event,
  show,
  showClass,
  award,
  sponsor,
  judge,
  province,
  // Objects
  portableText,
];
