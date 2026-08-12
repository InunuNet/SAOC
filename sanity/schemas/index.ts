import type { SchemaTypeDefinition } from 'sanity';

import { homePage } from './documents/homePage';
import { aboutPage } from './documents/aboutPage';
import { nationalShow } from './documents/nationalShow';
import { contactPage } from './documents/contactPage';
import { judgingPage } from './documents/judgingPage';
import { membersPage } from './documents/membersPage';
import { ticketsPage } from './documents/ticketsPage';
import { society } from './documents/society';
import { boardMember } from './documents/boardMember';
import { event } from './documents/event';
import { show } from './documents/show';
import { showClass } from './documents/showClass';
import { award } from './documents/award';
import { sponsor } from './documents/sponsor';
import { judge } from './documents/judge';
import { province } from './documents/province';
import { ticketType } from './documents/ticketType';
import { showVisitorInfo } from './documents/showVisitorInfo';
import { showFaq } from './documents/showFaq';
import { showExhibitorInfo } from './documents/showExhibitorInfo';
import { showExhibitorStep } from './documents/showExhibitorStep';

import { portableText } from './objects/portableText';
import { showVenue } from './objects/showVenue';
import { travelRoute } from './objects/travelRoute';
import { accommodationOption } from './objects/accommodationOption';
import { attraction } from './objects/attraction';
import { emergencyContact } from './objects/emergencyContact';
import { openingHoursEntry } from './objects/openingHoursEntry';
import { confirmationStatuses } from './objects/confirmationStatuses';
import { exhibitorSection } from './objects/exhibitorSection';
import { showExhibitorDate } from './objects/showExhibitorDate';
import { exhibitorQuestion } from './objects/exhibitorQuestion';
import { exhibitorConfirmationStatuses } from './objects/exhibitorConfirmationStatuses';

export const schemaTypes: SchemaTypeDefinition[] = [
  // Singletons
  homePage,
  aboutPage,
  nationalShow,
  contactPage,
  judgingPage,
  membersPage,
  ticketsPage,
  // F1 (show-visitor-info)
  showVisitorInfo,
  // F1 (show-exhibitor-info)
  showExhibitorInfo,
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
  showFaq,
  showExhibitorStep,
  // Ticketing
  ticketType,
  // Objects
  portableText,
  showVenue,
  travelRoute,
  accommodationOption,
  attraction,
  emergencyContact,
  openingHoursEntry,
  confirmationStatuses,
  // F1 (show-exhibitor-info) objects
  exhibitorSection,
  showExhibitorDate,
  exhibitorQuestion,
  exhibitorConfirmationStatuses,
];
