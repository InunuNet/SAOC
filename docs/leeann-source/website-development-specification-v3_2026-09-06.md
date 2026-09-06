---
source_filename: 1. Website Development SpecificationV3.docx
source_file_id: 1k02zzqII2XEAJw24QAnTjtRvT6qfFb_b
source_link: https://docs.google.com/document/d/1k02zzqII2XEAJw24QAnTjtRvT6qfFb_b/edit?usp=drivesdk&ouid=115127252756994166094&rtpof=true&sd=true
source_modified_time: 2026-09-03T20:20:15.772Z
snapshot_pulled: 2026-09-06
---

Section 1: Final Website Sitemap
This specification covers two separate websites: the permanent SAOC (South African Orchid Council) organisational website, and the dedicated 2027 National Show event website.
A. SAOC Website (Organisational Site)
	•	1. Home — banner, vision & mission, SAOC structure & directors, quick links, Join button, Members Portal link, newsletter signup, social links
	•	2. About — SAOC write-up, history, historical images, incorporation documents, NPO registration, banking details
	•	3. Societies — directory of affiliated societies (name, meeting date/place, contact)
	•	4. Calendar of Events — combined, year-round calendar of affiliated societies' shows
	•	5. Members Portal — member login; access to the Digital Journal
	•	6. Judging — Judges' Handbook; awards archive; learner judges' educational materials; possible learner judges' portal
B. 2027 National Show Website (Event Site)
	•	1. Home — evolving hub with quick links to every section below
	•	2. About the National Show
	•	3. What to Expect
	•	4. South African Exhibitors
	•	5. International Guests & Exhibitors
	•	6. SAOC Symposium
	•	7. WOSA Conference
	•	8. Judging & Awards
	•	9. Plant Exhibition & Sales (general visitor information)
	•	10. Plant Sales (nursery / vendor information)
	•	11. Programme
	•	12. Workshops
	•	13. Booking / Tickets
	•	14. Orchid Societies (map & directory) what is the purpose of this page when it is already on the SAOC page? This would be in case some people jump directly to the show pages. It will just be a small icon possibly or a button that directs them to the society pages.
	•	15. Sponsors
	•	16. Plan Your Visit
	•	17. FAQ
	•	18. Contact Us
Note: the Home page provides quick-link navigation to all sections below it; the Symposium and WOSA Conference are positioned as related but visually distinct sections within the Programme.

Section 2: Global Development Standards
The standards below apply to every page on both websites unless stated otherwise, and are intentionally not repeated page-by-page in Sections 3 and 4. Any page-level requirement that goes beyond these standards is called out individually.
2.1 Content Management System
A structured CMS (Sanity Studio — confirmed by INUNU) must allow authorised, non-technical SAOC users to edit text, images and structured data on every page without developer involvement, and without affecting page layout or site architecture.
	•	I would be careful of images – unless you have high resolution images it isn’t going to look good.  Also the size of the images would need to be the same – All images will need to be of an appropriate quality for the website. If we needed to add or change pictures anywhere it would need to fit into the framework of the website so would “I assume” be automatically sized to fit.
	•	Do they provide a full training manual? Brad has agreed to provide a training in person and a manual.
2.2 Responsive Design
Every page must be fully responsive and optimised for desktop, tablet and mobile devices (confirmed by INUNU as part of the overall website architecture).
2.3 Branding & Imagery
	•	Consistent use of the SAOC logo, National Show logo and official branding across every page, with alternate logo versions for light/dark backgrounds where required.
	•	CMS-managed image library supporting galleries, click-to-enlarge, captions and photographer credits where appropriate.
	•	A consistent page-banner style should be used site-wide.
2.4 SEO & Social Sharing
Every page requires an editable SEO title, meta description and social-sharing image, manageable independently per page through the CMS.
2.5 External Links & Social Media
All external links and social media icons (Facebook, Instagram, YouTube) must open in a new browser tab.
2.6 Reusable, Structured Content
Wherever an entity — an exhibitor, guest, speaker, sponsor, judge, orchid, award, society or workshop — appears on more than one page, it must be created once in a structured database and referenced wherever it is needed, rather than re-entered. See Section 7 for the full shared-database model.
2.7 Bookings & Payments
A single, secure online booking and payment system (gateway integration confirmed by INUNU) must span General Admission, Symposium, WOSA Conference and Workshop bookings, with one checkout, automated confirmation and reminder emails, and live capacity management (“Fully Booked” states and waiting lists where required).  
	•	What about the cocktail and the various options that people can choose – refer my excel spreadsheet – 2nd tab with dropdown menus. – Yes, this still needs to be fully developed. We need to provide Brad with all the option and the write-up and ticket information for each one. We will definitely get this all on the board.
	•	What does ‘Fully Booked look like and is this just for the symposium, WOSA, cocktail party? We may have restrictions on our overall visitor numbers per day depending on what the Municipality rules are. But this would definitely apply to the Symposium, conference and cocktails. 
2.8 Ongoing Editability
Content that changes as the event approaches — news, exhibitors, sponsors, the programme and awards — must be editable by authorised SAOC users without developer assistance, with support for scheduled/future-dated publication.
2.9 Accessibility & Compliance
	•	Wheelchair accessibility information displayed where relevant.
	•	POPIA-compliant consent wording and privacy notices on all public forms.
	•	Spam protection (e.g. CAPTCHA) on all public-facing forms.
2.10 Platform Decisions Already Confirmed by INUNU
	•	Structured CMS (Sanity Studio) for content editing without developer involvement.
	•	Fully responsive website architecture.
	•	CMS-based image management across the site.
	•	Secure payment gateway integration for bookings.
	•	Support for external links within CMS-managed content.
	•	Structured/relational content types for databases such as Exhibitors, Guests, Sponsors and Awards.

Section 3: SAOC Website Requirements
The SAOC website is the Council's permanent organisational home, distinct from the 2027 National Show event site. It should read as a stable, credible institutional presence rather than an event microsite. Global standards in Section 2 (CMS, responsive design, SEO, imagery, external links) apply to every page below and are not repeated.
3.1 Home
Purpose: Primary entry point to the SAOC website, introducing the Council and directing visitors to key resources.
Content:
	•	Banner image and short vision/mission statement.
	•	Structure of SAOC, including photographs and names of Directors.
	•	Quick links to every other SAOC page.
	•	Join button for prospective members.
	•	Link to the Members Portal and a newsletter subscribe button.
	•	Links to the SAOC Facebook and Instagram accounts.
Functionality:
	•	Editable banner, structured director/leadership listing and site navigation, all managed through the CMS.
	•	Newsletter signup integration (confirm preferred provider with INUNU).
Cross-reference: Director and leadership records may later be reused on an “About” or governance page; keep this in mind when structuring the CMS fields.
3.2 About
Purpose: Establishes SAOC's credibility and provides governance transparency for members, societies and the public.
Content:
	•	Written history/overview of SAOC (a contribution has been requested from Shane Burns).
	•	Historical photographs, where available.
	•	Documents of incorporation and any amendments.
	•	NPO registration document.
	•	Banking details, where relevant to donations or subscriptions.
Functionality:
	•	Secure document library for downloadable governance documents (incorporation, NPO registration).
	•	Historical image gallery with captions.
Cross-reference: Shares its historical-image approach with the National Show's image galleries (Section 2.3).
3.3 Societies/Groups Yes
Purpose: Central directory connecting visitors and members to affiliated orchid societies/groups across South Africa.
Content:
	•	Name of each society.
	•	Date and place of the society's regular meeting.
	•	Contact details for each society.
	•	Can we include a logo? Absolutely
	•	Assuming contact details are email address only? We can add anything we want 
	•	Can we have the name of the elected officials? If they agree as per POPIA. We did do a roll out of POPIA in 2024 but we probably need to do this again as some societies management committees have changed.
Functionality:
	•	Structured, searchable society directory managed through the CMS.
Cross-reference: Shares its data model with the National Show's “Orchid Societies” page (Section 4.14) — build once, reference in both places rather than duplicating the directory (see Section 7).
Not sure you need to have this in the show section. We do as we will have cross referencing banners, buttons etc on most pages that we only need to create once in the database. The pages then pull from the database depending on where the instructions are in the website. This is how I understand it.
3.4 Calendar of Events
Purpose: Single, year-round calendar advertising affiliated societies'/groups shows and SAOC events, so visitors always know what is coming up.
Content:
	•	Show dates and event details submitted by each affiliated society/group.
Functionality:
	•	Shared/joint calendar view, filterable by society/group or region.
	•	Ability for SAOC (or societies directly, pending confirmation with INUNU) to add and edit events through the CMS.
Cross-reference: Confirm with INUNU whether individual societies can be granted limited CMS access to manage their own entries (see Section 8).
Will there be too much information if we include the monthly meetngs? Do you mean the dates and time and venue of the meeting. I don’t think that is too much. 
3.5 Members Portal
Purpose: Restricted area for paid-up SAOC members, separate from the public-facing pages of the site.
Content:
	•	Member login credentials/authentication approach.
	•	Digital SAOC Journal issues for member access.
Functionality:
	•	Member authentication and account management.
	•	Digital publication library with member-only access control.
Cross-reference: Confirm with INUNU how membership status will be verified and kept in sync with SAOC's membership records (see Section 8).
Assuming that access to the journal will only be from the 2026 journal and no earlier? – We are hoping to have all journals that we have in digital format on the website as soon as we start this process. Eventually we may digitize all the journals. Everyone that is a member will have access to all digital journals.
What else would be available members portal?  Just the journal feels little – I have to log into the portal just to look at the journal – I realise that the journal is a member only publication.  They would have access to all SAOC awards as far back as we can go. This will be a great repository of images and judged criteria for all growers interested in having their plants judged. They can do comparisons on what the standards are. 
Over time we will also add more information. This could grow as big as we want it to.
3.6 Judging
Purpose: Central resource for accredited and aspiring orchid judges across South Africa.
Content:
	•	Judges' Handbook.
	•	Historical awards archive — photographs and awards received.
	•	Learner judges' educational materials.
	•	Possible learner judges' portal (scope to be confirmed).
Functionality:
	•	Document library for the Handbook and educational materials.
	•	Searchable awards archive, shared with the National Show's Judging & Awards database (Section 4.8 and Section 7).
Cross-reference: The scope and access-control requirements of a dedicated learner judges' portal should be confirmed with INUNU before development begins (see Section 8).
What about photographs of the current judges and with society/group they belong to?
Same with the learner judges. We could definitely do this.

The SAOC website is smaller in scope than the National Show site, but several of its components — the Societies directory, the awards archive and the Digital Journal library — are long-term assets that should be built with future National Shows and future SAOC administrations in mind, not just the 2027 event.

Section 4: National Show Website Requirements
The 2027 National Show website is a distinct event site built around the theme “From Wild Origins to Cultivated Excellence: The Future of Orchids.” Global standards in Section 2 apply throughout; only page-specific requirements and recommendations are listed below.
4.1 Home
Purpose: Primary gateway and evolving hub for the National Show, showcasing the event theme.
Key content:
	•	Hero banner or slideshow with editable title, subtitle and supporting text.
	•	SAOC and National Show logos, displayed consistently.
	•	Quick-link buttons to About, Book Tickets, Symposium, WOSA Conference, Programme, Workshops, Exhibitors, Sponsors, Plan Your Visit and Contact.
	•	Dynamic news and announcements section (speakers, exhibitors, sponsors, workshops, ticket releases, awards, volunteer opportunities).
	•	Image galleries from previous National Shows and rotating sponsor showcase.
Key functionality:
	•	News, exhibitors, sponsors, workshops and speakers should be drawn automatically from the shared databases (Section 7) rather than entered separately, keeping the homepage current with minimal admin.
	•	Homepage should evolve continuously as the Show approaches rather than remain a static landing page.
Recommendation: Use large, icon-led buttons for the homepage quick links to improve navigation on mobile.
4.2 About the National Show
Purpose: Visitor's introduction to the event and its theme; a secondary navigation gateway.
Key content:
	•	Overview of the National Show, its theme and WOSA's role.
	•	Venue details, dates and opening times, with a link to Plan Your Visit.
	•	Sponsor logos and acknowledgement wording.
	•	Promotional video, if produced.
Key functionality:
	•	Must link out to every major section (Exhibitors, Symposium, WOSA, Judging, Sales, Booking) so it functions as onward navigation rather than a dead end.
	•	Page should become increasingly detailed as the event approaches.
Recommendation: Present activities as interactive cards linking directly to their full pages, rather than as plain text.
4.3 What to Expect
Purpose: Practical visitor orientation page covering the essentials of attending.
Key content:
	•	Opening dates and hours, venue and parking.
	•	Ticket prices, family tickets and pensioner discounts (if applicable).
	•	Online booking and tickets-at-the-door options.
	•	Food and refreshments, photography policy, cloakroom/plant holding area, wheelchair accessibility.
Key functionality:
	•	Content must be quickly editable during the event itself for last-minute or emergency updates.
Recommendation: Display temporary notices (e.g. parking changes) prominently during the event period.
4.4 South African Exhibitors
Purpose: Showcases local growers, nurseries and societies exhibiting at the Show.
Key content:
	•	Per exhibitor: nursery logo, country, owner, short history , specialities, plants to be brought, website and social media.
	•	Categories of products available (species orchids, hybrids, miniatures, growing supplies, etc.).
Key functionality:
	•	Built as a searchable, filterable exhibitor database rather than static pages.
	•	Filter by product category and country; mark exhibitors as Confirmed, Coming Soon or Awaiting Confirmation.
Recommendation: Treat this as one of the website's key databases so the same records can be reused on the Home page, in Plant Sales and in search results (see Section 7).
	•	What is the maximum number of words for the short history? I don’t have a minimum or maximum at this stage.
	•	Will this section be in a table format layout? In the backend of the website yes. But it will look like an article on the front end as far as I understand.
4.5 International Guests & Exhibitors
Purpose: Profiles international speakers, judges, exhibitors and researchers attending the Show.
Key content:
	•	Photograph, full name and title, country of origin, organisation represented.
	•	Biography and description of each guest's role (speaker, exhibitor, judge, conservationist, researcher). 
	•	Confirmation status and, where applicable, the sessions in which each guest will appear.
	•	What is the maximum number of words for the profiles? Same as above
	•	Will this section be in a table format layout? Same as above
Key functionality:
	•	Same reusable-profile model as South African Exhibitors — one profile can serve multiple roles (e.g. speaker and judge) and appear across Symposium, Workshops, Judging and Home.
Recommendation: Allow guests with more than one role to be filtered by role (Speaker, Judge, Exhibitor, Researcher, Conservationist).
4.6 SAOC Symposium
Purpose: Programme and registration hub for the SAOC Symposium.
Key content:
	•	Final programme with speaker biographies, photographs and presentation abstracts. 
	•	Schedule by day, time and venue; registration fees and ticket categories.
	•	CPD/attendance certificates and downloadable presentation notes, where offered. 
Key functionality:
	•	Online registration integrated with the central booking system, with capacity limits and waiting-list support.
	•	Speaker profiles reused from the shared database rather than re-entered.
Recommendation: Allow delegates to view the programme in both list and calendar formats, with filters by day, topic or speaker.
What is the maximum number of words – Not at this stage
Will we be uploading presentations onto the website?  If yes, when do they go up? If we get permission from the presenter it would be added some time after the conference and would only be available to members. We Could make it a paywall so that we can continue to receive revenue from this for a fixed period of time. E.g. 12 or 24 months then it can be made available for free. Great Question!

4.7 WOSA Conference
Purpose: Dedicated section for the Wild Orchids of Southern Africa Conference, reinforcing the “wild origins” strand of the event theme.
Key content:
	•	WOSA branding and background information, subject to approval.
	•	Speaker profiles, abstracts and a searchable programme.
	•	Photo galleries of indigenous orchids, habitats and fieldwork; conservation partner acknowledgements.
Key functionality:
	•	Built on the same reusable Speaker, Presentation and Programme structures as the Symposium to avoid duplicate development.
	•	Registration integrated with the booking system if run separately from the Symposium.
Recommendation: Build WOSA as its own dedicated section rather than a sub-page of the Symposium, to strengthen its distinct identity.
4.8 Judging & Awards
Purpose: Presents the judging programme and, after the Show, the award results.
Key content:
	•	Award categories, judging rules and criteria.
	•	Judge profiles with biographies, photographs and accreditation.
	•	Award-winning orchid photographs and results linking each orchid to its exhibitor, judge and category.
Key functionality:
	•	Built as a relational database (Orchid ↔ Exhibitor ↔ Judge ↔ Category ↔ Photo ↔ Show Year) so results form a permanent, searchable archive across future National Shows.
	•	Results should feed exhibitor profiles and the Home page automatically.
Recommendation: Maintain this as a permanent historical archive so future National Shows build on it rather than starting again.
4.9 Plant Exhibition & Sales (Visitor Info)
Purpose: General-admission visitor information, distinct from Symposium and WOSA delegate needs.
Key content:
	•	Opening dates and hours, venue and parking.
	•	Admission, family and concession pricing; accessibility information.
	•	Photography policy, food vendors and cloakroom/plant holding information.
Key functionality:
	•	Quick-edit capability during the Show for temporary or emergency notices.
Recommendation: Display an “Open Today” indicator during the event itself.
4.10 Plant Sales
Purpose: Practical buying information for the nursery sales area, complementing rather than duplicating the Exhibitors page.
Key content:
	•	Participating nurseries, linked to the Exhibitor database.
	•	Payment methods, ATM/cash facilities and plant-wrapping information. 
	•	Courier providers, phytosanitary requirements for international buyers, and featured rare/collector plants.
Key functionality:
	•	Reuse exhibitor records rather than duplicating them; filter by product category (species, hybrids, miniatures, growing supplies).
Recommendation: Feature rare or collector plants ahead of the Show to build anticipation.
Why ATM? Should it not say Yoko given that it seems most vendors have them? This is just an option that was generated in the AI model. It could be possible to partner with Capitec or one of the smaller retailers to have an onsite ATM. I personally prefer a cashless environment.

4.11 Programme
Purpose: Master timetable across all National Show activities.
Key content:
	•	Dates, daily timetable, speaker allocations and venue allocations.
	•	Session descriptions, expandable for more detail.
Key functionality:
	•	Generated dynamically from the shared session/speaker database rather than maintained as a static page.
	•	List and calendar views, filterable by day or speaker.
Recommendation: Highlight recently updated sessions so returning visitors can see what has changed.
4.12 Workshops
Purpose: Detailed, bookable workshop listings.
Key content:
	•	Per workshop: title, description, skill level, duration and maximum participants.
	•	What is included and what attendees should bring; cost; linked presenter profile.
Key functionality:
	•	Structured, bookable database records with automatic capacity closure.
	•	Integration with the Booking page and the Programme.
Recommendation: Colour-code skill levels (Beginner, Intermediate, Advanced) for quick visual scanning.
Who is looking after these workshops to ensure that they happen? – We need someone to do this. There are still a few portfolios that need to be filled and work needs to be done.

4.13 Booking / Tickets
Purpose: Single, unified booking and payment experience across all ticketed elements.
Key content:
	•	Ticket categories: General Admission, Symposium, WOSA Conference, Workshops.
	•	Pricing, terms and conditions, cancellation/refund rules.
	•	Booking confirmation and reminder emails; QR-code or electronic tickets.
Key functionality:
	•	One booking platform so visitor details are entered once across all ticket types.
	•	Live workshop and Symposium availability, with automatic “Fully Booked” states.
Recommendation: Consider Apple Wallet / Google Wallet ticket support if the payment platform allows it.
Would it be possible for an email to be sent to me /Bee (Symposium)/you (WOSA) when people register for the symposium or WOSA conference?  Can just provide name & surname and email address so that we know someone has registered.  The email subject line can be what they have registered for.  We can then go into the system for the rest of the details on that person. – I have asked brad to create a couple of email addresses that will be used specifically for each area of the show and go to the person handling that area. We will find out exactly what the process is to get the info. Either a login to the system to download info when and if required or updated via email.

4.14 Orchid Societies/Groups
Purpose: Public-facing directory and map of affiliated societies, with lasting value beyond the Show itself.
Key content:
	•	Interactive map of South Africa showing society locations.
	•	Per-society contact details, region and meeting dates; logos where available.
Key functionality:
	•	Filterable by province; shares its data model with the SAOC website's own Societies page (Section 3.3) rather than duplicating the directory (see Section 7).
Recommendation: This page has ongoing value after the Show ends and should become the central directory for South African orchid societies.
Not sure why we will have this page – it should remain at the SAOC section. As much as it is important information, it is not relevant to the actual reason for the show. – Answered above
4.15 Sponsors
Purpose: Recognises headline and supporting sponsors and donors.
Key content:
	•	Sponsor logo, short profile and support statement for each sponsor.
	•	Sponsorship level (Gold, Silver, Bronze, Conservation Partner, Donor) and website link.
Key functionality:
	•	Sponsor records reused across Home, Booking, Symposium and other pages rather than re-entered.
	•	Rotating sponsor showcase / carousel.
Recommendation: Archive expired sponsors rather than deleting them, to preserve a historical record.
What is the maximum number of words – Not decided at this stage

4.16 Plan Your Visit
Purpose: Positions the National Show as a destination event rather than a single-day exhibition.
Key content:
	•	Accommodation recommendations, grouped by distance from the venue.
	•	Local attractions, restaurants, maps and directions, parking information.
	•	Suggested itineraries; public transport or airport information; emergency contacts.
Key functionality:
	•	Downloadable itinerary guides; integration with Google Maps for route planning.
Recommendation: Create one-day, two-day and family itinerary suggestions to appeal to different visitor types.

4.17 FAQ
Purpose: Reduces repetitive enquiries with a living, searchable resource.
Key content:
	•	Categorised questions and approved answers (General, Tickets, Workshops, Symposium, Plant Sales, Accessibility).
	•	Emergency or last-minute visitor notices, where applicable.
	•	“Still have a question?” link through to Contact Us.
Key functionality:
	•	Accordion-style layout for easy navigation; searchable for longer FAQ lists.
	•	Cross-linked to Booking, Workshops, Plant Sales, Plan Your Visit and Contact Us to reduce duplication.
Recommendation: Display the date each FAQ answer was last updated, to build visitor confidence in the information.

4.18 Contact Us
Purpose: Central enquiry point, routed efficiently to the right committee member.
Key content:
	•	Official contact details, phone numbers and postal address (if applicable).
	•	Venue address and directions; social media links.
	•	Contact form with Privacy Policy and POPIA consent wording; temporary event-period contact details.
Key functionality:
	•	Category-based enquiry routing (General, Bookings, Sponsorship, Media, Exhibitors).
	•	Spam-protected form and POPIA-compliant consent checkbox.
Recommendation: Route enquiries automatically to the correct committee member wherever possible, to reduce administrative work.


Section 5: Master SAOC Requirements Register
Consolidated register of what SAOC must supply and what INUNU must develop for the SAOC website. Global standards in Section 2 (CMS, responsive design, SEO, imagery) apply throughout and are not repeated below. The source planning notes did not record INUNU sign-off for the SAOC site, so every item is marked Pending Confirmation until agreed with INUNU.
Page
SAOC to Provide
INUNU to Develop
Status
Home
Banner imagery and vision/mission text
Editable homepage banner managed through the CMS
Pending confirmation
Home
Director names and photographs
Structured director/leadership listing
Pending confirmation
Home
Social media links (Facebook, Instagram)
CMS-managed navigation and social links
Pending confirmation
About
History write-up (requested from Shane Burns)
Editable content page within the CMS
Pending confirmation
About
Historical photographs, where available
Historical image gallery
Pending confirmation
About
Incorporation documents and amendments; NPO registration
Secure downloadable document library
Pending confirmation
About
Banking details
Display within the CMS-managed page content
Pending confirmation
Societies
List of affiliated societies with meeting/contact details
Searchable society directory
Pending confirmation
Calendar of Events
Society show dates and details
Combined/joint calendar view, CMS-editable
Pending confirmation
Members Portal
Member login / authentication approach
Member authentication and account management
Pending confirmation
Members Portal
Digital Journal issues
Digital publication library, member-only access
Pending confirmation
Judging
Judges' Handbook and learner judge materials
Document library within the CMS
Pending confirmation
Judging
Historical awards archive content
Searchable archive, shared with National Show database
Pending confirmation
Judging
Learner judges' portal scope and content
Restricted-access learner portal, if confirmed
Pending confirmation
All pages
Final approved copy for every page
CMS-managed content editing without developer assistance
Pending confirmation
All pages
Logos and brand assets
Consistent branding across desktop, tablet and mobile
Pending confirmation
Once INUNU confirms feasibility for each row above, update the Status column to Confirmed so this register can be tracked alongside Section 6 during development.

About – Banking details – what is this for? Is this for the SAOC fee only?  

Section 6: Master 2027 National Show Requirements Register
Consolidated register of page-specific requirements only; global standards from Section 2 apply throughout and are not repeated below. Status reflects the confirmations already recorded by INUNU during earlier discussions.
Page
SAOC to Provide (Key Items)
Development Status
Home
Headline & banner imagery; homepage quick links
Confirmed — CMS, responsive design, image management, navigation
Home
News, announcements and updates
Confirmed — dynamic, editable news section
About the National Show
Approved page copy; hero imagery; sponsor logos
Confirmed — CMS, responsive, image management
What to Expect
Dates/hours, pricing, parking, accessibility, photography policy
Pending — quick-edit workflow during event to be confirmed
South African Exhibitors
Exhibitor list, logos, bios, product categories
Confirmed — structured content types
International Guests & Exhibitors
Guest list, photographs, biographies, roles
Confirmed — structured content, image management
SAOC Symposium
Programme, speaker bios, abstracts, fees
Confirmed — CMS; payment gateway integration
WOSA Conference
Programme, WOSA branding, speaker bios, photos, fees?
Confirmed — structured content, image management
Judging & Awards
Award categories, judge bios, results data
Confirmed — structured content, image management
Plant Exhibition & Sales
Visitor info: dates, pricing, parking, accessibility
Confirmed — payment integration for pricing display
Plant Sales
Nursery list; payment/courier/phytosanitary info
Pending confirmation
Programme
Final programme; session data; venue allocations
Confirmed — CMS editing
Workshops
Workshop details; pricing; presenter links
Confirmed — payment gateway integration
Booking / Tickets
Ticket categories & pricing; T&Cs; confirmation wording
Confirmed — payment gateway; secure process
Orchid Societies/Groups
Society/group list; contact/region/meeting data
Confirmed — CMS structured content
Sponsors
Sponsor logos, profiles, categories
Confirmed — images and content CMS-managed
Plan Your Visit
Accommodation, attractions, transport information
Confirmed — CMS-editable structured content
FAQ
Question/answer content by category
Confirmed — structured content
Contact Us
Contact details; form requirements; POPIA wording
Confirmed — editable via CMS
Section 7: Shared Databases & Reusable Content Model
Each entity below should be created once in the CMS and referenced wherever it needs to appear, reducing duplicate data entry and keeping both websites consistent as new National Shows occur.
Entity
Key Fields
Reused On
Exhibitors (SA & International)
Name/logo, country, bio, specialities, products, role(s), confirmation status
Exhibitor pages, Plant Sales, Home features, Awards
Speakers / Guests
Name, photo, bio, organisation, role(s), sessions
Symposium, WOSA, Workshops, Judging, Home
Sponsors
Logo, profile, sponsorship level, website link
Sponsors page, Home, Booking, Symposium
Judges
Bio, photo, accreditation
Judging & Awards, Symposium
Awards / Orchids
Orchid ↔ Exhibitor ↔ Judge ↔ Category ↔ Photo ↔ Show Year
Judging & Awards, exhibitor profiles, future show archives
Workshops
Title, description, skill level, capacity, presenter link, price
Workshops, Programme, Booking
Orchid Societies/Groups
Name, region, contact, meeting details
SAOC website & National Show website (shared record)
News / Announcements
Title, summary, photo, date, link
Home (both sites), relevant sub-pages


Exhibitors (SA & International) – should a contact name or email address also be added – not for public use but so that we connect exhibitor with a warm bellybutton?  We can add any information we feel is relevant keeping POPIA in mind.


Section 8: Questions for INUNU
CMS & Content
	•	Can committee members reorder/manage homepage and page content blocks without developer help?
	•	Can content (news, programme, awards, FAQs) be scheduled for future/automatic publication?
	•	Can individual societies/grous be granted limited CMS access to manage their own Calendar of Events entries?
Search, Filter & Cross-Linking
	•	Can exhibitors, guests and workshops be filtered by category, country, role or skill level?
	•	Can one profile (speaker/judge/exhibitor) automatically appear on every page relevant to their role?
Bookings & Payments
	•	Can visitors book multiple ticket types (General Admission, Symposium, WOSA, Workshops) in a single transaction?
	•	Can workshop/symposium capacities close automatically, with waiting lists where required?
	•	Can attendees receive automated confirmation and reminder emails, and amend bookings without admin help?
	•	Can committee members (where applicable) receive emails once visitors book for symposium, WOSA or workshops? Basic information only – name & surname, event booked? Answered above
Notifications & Media
	•	Can registered delegates be notified automatically of programme changes?
	•	Will presentation videos/notes be embedded or linked, and can downloads be restricted to registered delegates?
Archiving & Future Shows
	•	Can award results and WOSA/Symposium proceedings form a permanent, searchable archive for future National Shows?
	•	Can the same platform and data structures be reused for future National Show websites without rebuilding?

Section 9: Future Enhancements
Homepage & Content
	•	Rotating hero slideshow; live countdown timer; seasonal banner updates; urgent-notice banner.
Exhibitors, Sponsors & Guests
	•	Country filters as international directories expand; rotating sponsor carousel; alternate logo versions for light/dark backgrounds.
Bookings
	•	Apple/Google Wallet ticket support; discount/promo codes; multi-delegate single bookings.
Accessibility & Reach
	•	CPD/attendance certificate automation; multilingual support if international attendance grows; downloadable Visitor Information Guide closer to the event.

Appendix: Content Collection Checklist
SAOC Website
☐ Homepage banner image(s) + vision/mission text
☐ Director names & photographs
☐ SAOC history write-up (Shane Burns) + historical photos
☐ Incorporation documents, NPO registration, banking details
☐ Affiliated society/group list (name, meeting date/place, contact)
☐ Calendar of society/group events
☐ Members Portal login list; digital Journal issues
☐ Judges' Handbook; awards archive photos; learner judge materials; name and photograph of current judges
2027 National Show Website
☐ Approved homepage headline & hero imagery
☐ About / What to Expect copy: venue, dates, pricing, accessibility, parking
☐ SA & International exhibitor lists, logos, profiles, photos
☐ Symposium & WOSA programme, speaker profiles/photos, fees
☐ Judging categories, judge profiles, award results & photos
☐ Workshop details (description, skill level, capacity, cost, presenter)
☐ Ticket categories, pricing & terms and conditions
☐ Society/Group directory data (shared with SAOC site)
☐ Sponsor logos, profiles & sponsorship levels
☐ Plan Your Visit content (accommodation, transport, attractions)
☐ FAQ content by category
☐ Contact details, department emails, POPIA wording

Email: info Collection Checklist
Email address
Password
Owner of address
Alternative contact email address
info@saoc.co.za
Gooseberry#1
Lee-Ann McCleland
saoctreasurer@gmail.com
treasurer-secretary@saoc.co.za
Gooseberry#123
Lee-Ann McCleland
saoctreasurer@gmail.com
ngos@saoc.co.za
 
North Gauteng Orchid Society
 
president@saoc.co.za
 
Lee Farrington
 
show@saoc.co.za
 
Possibly Tinus Oberholzer
Has not been used since 2020. We can possibly archive this.

