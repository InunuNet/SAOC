---
source_filename: 13.1 Ticketing system details.docx
source_file_id: 15cRA-EmoqZVPLp8MJkBrD88OFRduJKFf
source_link: https://docs.google.com/document/d/15cRA-EmoqZVPLp8MJkBrD88OFRduJKFf/edit?usp=drivesdk&ouid=115127252756994166094&rtpof=true&sd=true
source_modified_time: 2026-09-03T21:38:16.965Z
snapshot_pulled: 2026-09-09
---

Note: this is the 700-line booking-system field/developer specification referenced in
`f1-coverage-map.json`'s `nos-13-registration-booking-tickets` notes as "13.1" — distinct
from "13.2 Vendor Form" (already snapshotted as
`2027-vendor-registration-form_2026-08-26.md`). This is Lee-Ann's own design of the
visitor booking system's fields and flow, not page copy — do not treat as authorised
public-facing copy without confirmation (openQuestion q7 covers the related Workshops/
Field-Trip line items).

Overview

National Orchid Show
Orchid Exhibition
Conferences


Visitors
Vendors
SAOC
Symposium
WOSA Conference

Events
Sunset Cocktails

Workshops
Field Trips


Orchid Exhibition
Visitors
Vendors
Details
Early Bird Ticket
Weekend Pass
VIP Ticket
Food Vendors
Exhibit Vendors
Day Visitor Ticket


Details


Conferences
SAOC
Symposium
WOSA Conference
Conferences
SAOC
Symposium
WOSA Conference
Conferences
SAOC
Symposium
WOSA Conference
Conferences
SAOC
Symposium
WOSA Conference


SAOC
Early Bird
WOSA
Normal ticket
SAOC
Normal tickets
WOSA
Early Bird

SAOC/WOSA
Early Bird Joint ticket
SAOC/WOSA
Normal
 Joint ticket



Details


Events
Workshops
Field Trips
Sunset Cocktails
Single Ticket
Couple
Several Workshops over all three days
Single Outing
All outings

Recommended booking structure
1. Visitor / Booking Details to be used for all bookings 1 - 5
	•	First name*
	•	Surname*
	•	Email address*
	•	Mobile number*
	•	Accessibility requirements
	•	Dietary requirements (only for events where there is a meal provided)
	•	How did you hear about the National Orchid Show?
	•	Consent to receive show-related communications
	•	Optional marketing consent

2. Orchid Exhibition Tickets
The visitor selects one or more:
	•	Early-Bird Exhibition Ticket 	-	R130.00	
-	Choose day: Friday/Saturday/Sunday
	•	Day Visitor Ticket 			-	R 150.00
-	Choose day: Friday/Saturday/Sunday
	•	Weekend Pass 			-	R 400.00
	•	VIP Ticket – Thursday 23rd September evening from 5pm to 6.30pm
-	R 300.00

3. Sunset Cocktails
	•	Single ticket 				-	R 800.00
	•	Couple ticket 			-	R 1500.00
Number of tickets		1/2/3/4/etc.
 Also include:
	•	Dietary requirements
	•	Special accessibility requirements
The cocktail event is age restricted: No Under 18's.

4. Workshops
Select the workshops you would like to attend
Then list each workshop with:
Workshop name | Date | Time | Duration | Price | Places available
For example:
	•	Workshop 1 – Orchid Repotting 		-	R 100.00		Date/Time
	•	Workshop 2 – Orchid Photography 	-	R 100.00		Date/Time
	•	Workshop 3 – Orchid Mounting 		-	R 100.00		Date/Time
	•	Workshop 4 – Orchid Conservation 	-	R 100.00		Date/Time
	•	Workshop 5					-	R 100.00		Date/Time
	•	Workshop 6					-	R 100.00		Date/Time
	•	Workshop 7					-	R 100.00		Date/Time
	•	Workshop 8					-	R 100.00		Date/Time
The system should automatically prevent someone from booking two workshops that overlap.
It should also show "Fully Booked" when capacity is reached.
These workshops details will be provided as they are confirmed.

5. Field Trips
Similarly:
Select your field trip(s)
For each trip:
	•	Field Trip 1	R 200.00	Date	Depart / Return	Meeting Point
	•	Field Trip 2	R 200.00	Date	Depart / Return	Meeting Point
	•	Field Trip 3	R 200.00	Date	Depart / Return	Meeting Point
	•	Field Trip 4	R 200.00	Date	Depart / Return	Meeting Point
	•	Field Trip 5	R 200.00	Date	Depart / Return	Meeting Point
	•	Difficulty/accessibility information
There should be a clear warning that field trips may involve walking over uneven terrain and/or exposure to weather conditions, where applicable. This information will be created and provided.
Again, the booking system should prevent double-booking overlapping activities.

6. Order Summary
Before payment, the visitor should see a complete summary:
Each ticket purchased	Price		Number of tickets		Total Price

Booking Information
	•	Name
	•	Email
	•	Mobile

And finally:
Payment
	•	EFT
	•	Online payment/card, if offered by the website
The system should generate a unique booking/reference number.

7. Confirmation
Once payment has been received, the visitor should automatically receive a confirmation email containing:
2027 SAOC National Orchid Show – Booking Confirmation
	•	Booking reference
	•	Visitor name
	•	Tickets purchased
	•	Dates, times, venues etc.
	•	Venue information
	•	Amount paid
	•	Payment status
	•	Important visitor information
	•	Contact information for enquiries
Ideally, the confirmation should also contain a QR code linked to the booking. This could eventually be scanned at the exhibition entrance, cocktail event, workshops and field trips.
2027 SAOC National Orchid Show
Visitor & Activity Booking Form — Developer Specification
1. FORM PURPOSE
This is the single master booking form for visitors attending the 2027 SAOC National Orchid Show.
One booking should allow a visitor to purchase any combination of:
	•	Orchid Exhibition tickets
	•	Sunset Cocktails
	•	Workshops
	•	Field Trips
The visitor enters their personal information once and then selects the tickets and activities they require.
The system must calculate the booking total automatically and generate a unique booking reference.

SECTION A — BOOKING CONTACT DETAILS
A1. Booking Contact
Field
Field Type
Required
Notes
First Name
Text
Yes
Main booking contact
Surname
Text
Yes
Main booking contact
Email Address
Email
Yes
Primary confirmation address
Mobile Number
Telephone
Yes
Include country code
Number of Adults
Number
Yes
Minimum 1
Number of Children
Number
No
If applicable
A2. Communication
How did you hear about the 2027 National Orchid Show?
Dropdown:
	•	Orchid Society
	•	Social Media
	•	Website
	•	Google/Search Engine
	•	Friend/Family
	•	Newspaper/Magazine
	•	Radio
	•	Tourism Organisation
	•	Previous Orchid Show
	•	Other
Would you like to receive future information about SAOC/WOSA orchid events?
	•	Yes
	•	No
This should be a separate marketing consent from the mandatory booking communications.

SECTION B — ORCHID EXHIBITION TICKETS
B1. Exhibition Attendance
Would you like to purchase admission to the Orchid Exhibition?
	•	Yes
	•	No
If Yes, display:
Orchid Exhibition Ticket Options
Ticket
Quantity
Price
Notes
Early-Bird Exhibition Ticket
Number
R130*
Limited availability
Day Visitor Ticket
Number
R150*
Select visiting day
Early Bird Weekend Pass
Number
R380*
Valid for Designated show days
Weekend Pass
Number
R400*
Valid for designated show days
VIP Ticket
Number
R300*
Includes VIP benefits Thursday only 5pm to 6.3pm
*Final prices to be confirmed in the website pricing configuration.
B2. Day Ticket
If Day Visitor Ticket is selected:
Which day will you attend?
	•	Friday
	•	Saturday
	•	Sunday
The system should record the selected day against each day-ticket quantity. Except for Weekend passes and VIP Tickets.
B3. Ticket Holder Information
I recommend not requiring individual names for every normal exhibition ticket unless this is required for security or ticket scanning.
Instead, the booking contact can purchase multiple tickets up to a maximum of 5 per booking contact.
For VIP tickets, however, I recommend collecting the names of each VIP attendee if VIP access is linked to individual identification.

SECTION C — SUNSET COCKTAILS
C1. Sunset Cocktails
Would you like to attend the Sunset Cocktails event?
	•	Yes
	•	No
If Yes, display:
Sunset Cocktails Ticket
Option
Quantity
Price
Single
Number
R 800.00
Couple
Number
R1500.00
The system must calculate:
Quantity × ticket price = subtotal
C2. Cocktail Attendee Information
For each booking:
	•	Guest 1 Name
	•	Guest 2 Name — required for Couple booking
C3. Dietary Requirements
Please note that complex dietary requirements cannot be accommodated. Vegetarian and Gluten free options will be made available.
	•	No
	•	Yes
If Yes:
Please select:
	•	Vegetarian
	•	Gluten free
C4. Accessibility
Do you or any guest have accessibility requirements we should be aware of?
	•	No
	•	Yes
If Yes:
Free text.

SECTION D — WORKSHOPS
D1. Workshop Booking
Would you like to attend one or more workshops?
	•	Yes
	•	No
If Yes, display the available workshops.
Each workshop should be configured in the website's Workshop Database, rather than hard-coded into the form.
Workshop Record
Each workshop should contain:
	•	Workshop ID
	•	Workshop Name
	•	Description
	•	Date
	•	Start Time
	•	End Time
	•	Duration
	•	Venue
	•	Price
	•	Maximum Capacity
	•	Remaining Capacity
	•	Minimum Age, if applicable
	•	Accessibility information
	•	Status
Visitor Display
Each available workshop should display:
WORKSHOP NAME
Date: Time: Duration: Price: Places remaining:
Number of places required: [0]
The visitor can select multiple workshops.
Important system rule
The system must check for time conflicts.
If a visitor selects:
Workshop A — 10:00–11:00
the system must prevent them from selecting:
Workshop B — 10:30–12:00
and display:
"These workshops overlap. Please select another workshop."
The same conflict check should apply to field trips.

SECTION E — FIELD TRIPS
E1. Field Trip Booking
Would you like to participate in a field trip?
	•	Yes
	•	No
If Yes, display available field trips.
Each field trip should have its own database record containing:
	•	Field Trip ID
	•	Field Trip Name
	•	Description
	•	Date
	•	Departure Time
	•	Return Time
	•	Meeting Point
	•	Transport Information
	•	Price
	•	Maximum Capacity
	•	Remaining Capacity
	•	Difficulty Level
	•	Minimum Age
	•	What to bring
	•	Accessibility information
	•	Weather/cancellation information
	•	Status
Visitor Display
For example:
FIELD TRIP: [NAME]
Date: Departure: Return: Meeting point: Price: Places remaining:
Number of places: [0]
Field Trip Conditions
Before booking, display:
Field trips may involve walking over uneven terrain and exposure to outdoor conditions. Participants should ensure that they are appropriately prepared for the requirements of the selected field trip.
The actual wording can be finalised once the individual field trips have been confirmed.

SECTION F — ADDITIONAL INFORMATION
This section should be available to all visitors.
F1. Accessibility
Do you have any accessibility requirements?
	•	No
	•	Yes
If yes:
Please provide details.

F2. Dietary Requirements
Do you have any dietary requirements?
	•	No
	•	Yes
If yes:
Please provide details.
This information should be particularly flagged for:
	•	Sunset Cocktails
	•	Symposium/conference catering if later added to this booking system.

F3. Emergency Contact
I recommend collecting this particularly because of the field trips.
Emergency Contact Name
Required if field trip selected.
Relationship
Emergency Contact Telephone Number
Required if field trip selected.

SECTION G — TERMS & CONDITIONS
The visitor must agree to the relevant terms before payment.
2027 SAOC NATIONAL ORCHID SHOW
TICKET PURCHASE – TERMS & CONDITIONS
By purchasing a ticket or booking a workshop, field trip, conference, symposium or other activity associated with the 2027 SAOC National Orchid Show, the purchaser agrees to the following Terms & Conditions.
1. Tickets and Bookings
Tickets and bookings are valid only for the event, activity, date and ticket type specified at the time of purchase. Please check your booking carefully before completing payment.
Tickets may not be duplicated, altered or resold without the prior permission of the Organising Committee.
2. Payment
Bookings are confirmed only once full payment has been received. Tickets and booking confirmations will be issued electronically where applicable.
The purchaser is responsible for providing correct contact and booking information.
3. Cancellations and Refunds
Show admission tickets, including Early Bird, Day Visitor, Weekend and VIP tickets, are non-refundable once purchased.
Cancellations may be requested for workshops, field trips, symposiums and conferences up to 60 days before the scheduled date of the relevant activity. Cancellations received within this period will qualify for a full refund.
No refunds will be provided for cancellations received less than 60 days before the relevant workshop, field trip, symposium or conference. This is necessary as arrangements for venues, catering, transport, facilitators, speakers and other services will have been finalised by this stage.
Failure to attend a booked activity does not constitute a cancellation and will not qualify for a refund.
Where the Organising Committee cancels an activity, or is unable to provide the activity as advertised, participants will be offered an appropriate refund or alternative arrangement.
4. Changes to the Programme
The Organising Committee reserves the right to make reasonable changes to the programme, speakers, venues, activities or schedules where circumstances require. Every effort will be made to notify registered participants of significant changes.
5. Workshops and Special Activities
Places for workshops, field trips, conferences, symposiums and other limited-capacity activities are subject to availability and are confirmed only upon receipt of payment.
Participants are required to arrive on time and comply with any instructions provided by the organiser, facilitator, guide or venue.
6. Participation and Personal Risk
Participation in the National Orchid Show, workshops, field trips, demonstrations, social events and all other associated activities is at the participant's own risk.
Participants are responsible for taking reasonable care of their own health, safety and personal belongings and must comply with all reasonable safety instructions issued by the Organising Committee, venue, facilitator, guide or activity leader.
Field trips and outdoor activities may involve uneven ground, changing weather conditions and other natural or environmental hazards. Participants should ensure that they are appropriately prepared for the activity.
7. Dietary Requirements
Where catering is provided, reasonable efforts will be made to accommodate dietary requirements or allergies notified at the time of booking.
Accommodation of specific dietary requirements is subject to the facilities, caterers and suppliers available and cannot always be guaranteed. Participants with severe allergies or highly specialised dietary requirements are encouraged to contact the Organising Committee before booking.
8. Photography and Filming
Photography and filming may take place during the National Orchid Show and associated events for archival, promotional, educational and social-media purposes.
By attending the event, participants acknowledge that they may appear incidentally in photographs or recordings of the event.
9. Personal Belongings
Participants remain responsible for their personal belongings, valuables, equipment and property while attending the event. The Organising Committee accepts no responsibility for loss or damage except where liability cannot lawfully be excluded.
10. Conduct
The Organising Committee reserves the right to refuse admission to, or remove from the event, any person whose behaviour is disruptive, threatening, unsafe or otherwise inappropriate, or who fails to comply with the reasonable rules of the event or venue.
11. Acceptance of Terms
Completion of a booking and payment constitutes acceptance of these Terms & Conditions.
The Organising Committee reserves the right to amend these Terms & Conditions where reasonably necessary, provided that any changes will not affect rights already acquired by a participant under a completed booking.
2027 SAOC National Orchid Show South African Orchid Council and the 2027 National Show Organising Committee



Mandatory
☐ I confirm that the information provided in this booking is correct.
☐ I agree to the 2027 SAOC National Orchid Show booking terms and conditions.
☐ I understand that bookings for workshops and field trips are subject to availability and that spaces are limited.
☐ I understand that cancellation and refund policies apply to the tickets and activities selected.
Optional
☐ I would like to receive information about future SAOC/WOSA events and activities.
The marketing consent must not be pre-selected.

SECTION H — BOOKING SUMMARY
Before payment, the system should display:
Your Booking
Booking Contact
Name: Email: Mobile:
Exhibition Tickets
Ticket
Quantity
Amount
Early-Bird
0
R
Weekend Pass
0
R
Sunset Cocktails
Ticket
Quantity
Amount
Single
Couple

R___
Workshops
Workshop
Places
Amount
Workshop Name

R___
Field Trips
Field Trip
Places
Amount
Field Trip Name
1
R___
SUBTOTAL: R_____
TOTAL PAYABLE: R_____

SECTION I — PAYMENT
The booking system should create the booking before payment, with a status of:
Payment Pending
The visitor then proceeds to the selected payment method.
Payment methods
These should be configured by the website developer according to the payment gateway selected for the National Show.
Possible statuses:
	•	Payment Pending
	•	Payment Successful
	•	Payment Failed
	•	Payment Cancelled
	•	Payment Refunded
	•	Partially Refunded
The system must not confirm limited-capacity workshops or field trips as final bookings until payment has been successfully confirmed, unless the organisers specifically decide to allow unpaid reservations.

SECTION J — BOOKING CONFIRMATION
After successful payment:
Generate
Unique Booking Reference
For example:
SAOC27-000123
The booking confirmation should contain:
	•	Booking reference
	•	Date of booking
	•	Visitor name
	•	Email
	•	Mobile
	•	Tickets purchased
	•	Activities booked
	•	Dates
	•	Times
	•	Venues/meeting points
	•	Quantity
	•	Amount paid
	•	Payment status
	•	Important information
	•	Cancellation/refund information
A QR code should be generated for the booking.

BACK-END INFORMATION TO CAPTURE
This is particularly important for the developer.
Every booking should create a database record containing:
Data
Required
Booking ID
Automatic
Booking Reference
Automatic
Booking Date/Time
Automatic
First Name
Yes
Surname
Yes
Email
Yes
Mobile
Yes
Adults
Yes
Children
No
Exhibition Tickets
If selected
Exhibition Day
If applicable
VIP Tickets
If selected
Cocktail Tickets
If selected
Workshops
If selected
Field Trips
If selected
Dietary Requirements
If provided
Accessibility Requirements
If provided
Emergency Contact
If field trip selected
Marketing Consent
Yes/No
Terms Accepted
Yes
Total Amount
Automatic
Payment Status
Automatic
Payment Reference
Automatic
QR Code
Automatic
Booking Status
Automatic

ADMINISTRATION / REPORTING
This is something I strongly recommend including in the developer specification now rather than adding it later.
The administrator should be able to filter and export bookings by:
Tickets
	•	Early Bird
	•	Day Visitor
	•	Weekend Pass
	•	VIP
Activities
	•	Sunset Cocktails
	•	Individual Workshop
	•	Individual Field Trip
Date
	•	Booking date
	•	Exhibition attendance date
	•	Workshop date
	•	Field trip date
Payment
	•	Paid
	•	Pending
	•	Failed
	•	Refunded
Operational information
	•	Dietary requirements
	•	Accessibility requirements
	•	Emergency contacts
Reports should be exportable to Excel/CSV.

VERY IMPORTANT: DON'T PUT THE PRICES INTO THE FORM CODE
Create a Ticket & Activity Management area in the website backend.
That means you can change:
Early Bird — R100
to:
Early Bird — R120
without having to ask the developer to rebuild the form.
The same applies to:
	•	Ticket availability
	•	Workshop prices
	•	Workshop capacity
	•	Field-trip capacity
	•	Cocktail prices
	•	Dates
	•	Times
	•	Descriptions
	•	"Sold Out" status

RECOMMENDED USER JOURNEY
The visitor experience should be:
STEP 1 — Your Details
↓
STEP 2 — Exhibition Tickets
↓
STEP 3 — Sunset Cocktails
↓
STEP 4 — Workshops
↓
STEP 5 — Field Trips
↓
STEP 6 — Additional Requirements
↓
STEP 7 — Review Booking
↓
STEP 8 — Payment
↓
STEP 9 — Confirmation + QR Code


The WOSA Conference and SAOC Symposium registrations will be separate from this visitor booking form, even though they could technically be incorporated into it. Those are fundamentally conference registrations, with different information requirements and potentially different delegates.
The visitor form can, however, later be expanded to allow an ordinary show visitor to add a workshop or field trip without having to create another account.
This gives you a clean structure of:
VISITOR BOOKING → Exhibition + Cocktails + Workshops + Field Trips
CONFERENCE REGISTRATION → SAOC Conference + WOSA Conference + Symposium
VENDOR REGISTRATION → Vendor booking and requirements
That separation will make your administration and reporting considerably easier.
