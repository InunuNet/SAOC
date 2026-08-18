# Ticket Sales — Guide for Lee-Ann

This is a plain-language guide to managing ticket sales for the 2027 National Show. You don't need to know code — just where to find things in Studio and what each button does.

## Quick Start

1. Go to [http://localhost:3000/studio](http://localhost:3000/studio) (development) or the live Studio URL
2. Click **"Tickets Page"** in the left sidebar (under "Singletons")
3. Edit the copy you see on the screen (title, prices, messages, etc.)
4. Click **"Publish"** at the top right

Changes appear on the live website within 1 minute.

## What Is Happening Here?

When people visit saoc.co.za/tickets, they see:

- A heading and description (you control these)
- A list of ticket types with prices (you set the prices)
- A form to buy a ticket
- Messages like "Sold out" or "Tickets are not yet on sale" (you control these too)

This guide tells you how to change what they see.

## The Three Main Tasks

### 1. Turn Ticket Sales On or Off

When you want to open or close sales:

1. Click **"National Show"** in the left sidebar
2. Look for the **"Sales Open"** checkbox
3. **Check the box** to turn sales ON (visitors see the buy form)
4. **Uncheck the box** to turn sales OFF (visitors see a "not yet on sale" message)
5. Click **"Publish"** at the top right

**Important:** When you turn sales ON, real money starts moving. Make sure prices are correct before you do this.

When sales are OFF, visitors will see the message you set in the "Tickets Page" — see section 3 below.

### 2. Change Ticket Prices and Descriptions

1. Click **"Ticket Type"** in the left sidebar
2. You will see a list of five ticket categories:
   - Adult
   - Pensioner
   - Child
   - SAOC Member
   - Exhibitor
3. Click any of them to open it
4. Change the **"Price (ZAR)"** field to whatever the council has confirmed
5. (Optional) Edit the **"Description"** field if you want to add details
6. Click **"Publish"** at the top right

That's it. The website will show the new price within 1 minute.

**Important:** All prices currently say *"Provisional price — pending council confirmation."* in the description. Once the council confirms real prices, you can remove this note (or leave it if you want).

### 3. Edit Everything Visitors Read

All the words people see on the ticket pages are in one place: the **"Tickets Page"** document. Click it in the sidebar.

You will see sections for:

#### Buy Page (What people see when they arrive at /tickets)

- **"Buy Page Title"** — the big heading (currently "Get Your Tickets")
- **"Buy Page Intro"** — the description below the heading
- **"Buy Button Label"** — the text on the submit button (currently "Buy Ticket")
- **"Sold Out Message"** — shown when a ticket type is sold out (currently "Sold out")
- **"Sales Closed Message"** — the big notice people see when sales are OFF (currently "Tickets for the 2027 National Show are not yet on sale — check back soon.")
- **"Terms / Refund / Door-Entry Note"** — small text at the bottom

#### Confirmation Page (What people see after they pay)

This page appears after PayFast processes their payment:

- **"Confirmation — Pending Heading"** — shown while we're confirming the payment (currently "Confirming your payment")
- **"Confirmation — Pending Message"** — explanation while waiting (currently "We're still waiting for payment confirmation…")
- **"Confirmation — Success Heading"** — shown when payment is confirmed (currently "You're booked in")
- **"Confirmation — Success Message"** — the celebratory message
- **"Confirmation — Not Found Message"** — if the booking can't be found (currently "We couldn't find a booking for that reference…")
- **"What Your Ticket Includes"** — list of what they get with their ticket (currently "Your ticket includes full-day entry to the National Show floor, access to the judging galleries, and entry to all exhibitor stages.")

#### Cancellation Page (What people see if they cancel payment)

If a visitor clicks "Cancel" on the PayFast payment page, they land here:

- **"Cancelled — Heading"** — the heading (currently "Payment cancelled")
- **"Cancelled — Message"** — explanation (currently "No payment was taken. Your reservation has been left open…")
- **"Cancelled — Button Label"** — the "back to tickets" link text (currently "Back to tickets")

**Edit any of these fields, then click "Publish" at the top right. Changes appear within 1 minute.**

## Critical Safety Rules for Ticket Sales (F1)

Before you tick anything as "Active" or make any changes to the show dates/venue, read these two rules. Breaking either one will completely stop ticket sales for every buyer, with no warning shown in Studio.

### Rule 1: Only ONE Show Can Be Active at a Time

**Only one show document may have the "Active" checkbox ticked at any time.** If you accidentally try to tick a second show as active — even an old archived show — **Studio will stop you.**

**What you will see:**

When you try to Publish a show with "Active" ticked while another show is already active, Studio shows an error message like this:

> A show is already marked Active: "19th SAOC National Show" (2027). Only one show can be Active at a time — untick Active on "19th SAOC National Show" before ticking it here, or contact the site developer if you're not sure which show should be active.

This error message tells you exactly which show is currently active and what to do to fix it.

**How to fix it:**

If you see this error:

1. Read which show is already active (it will be named in the error message)
2. Go to that show document and **uncheck** its "Active" checkbox
3. **Publish** that change
4. Go back to the show you were trying to activate and click **"Publish"** again

Sales will resume within 1 minute.

**Why this matters:** The system prevents selling tickets against the wrong show. If multiple shows are active, the system cannot decide which one to sell against, so it refuses all sales.

### Rule 2: Show Dates and Venue Are Copied, Not Linked

The dates and venue on `show-19-2027` were **copied from** the `National Show` document. They are **not automatically linked** — editing one does not update the other.

**If the show dates or venue change:**

1. Update the `National Show` document (as you already do)
2. **Also edit `show-19-2027`** and manually update the same fields there
3. Publish both

If you don't update both, the dates and venue will be different in two places, which is confusing to visitors.

**Example:** If the venue changes from "The Hangar" to "Elsewhere", you must:
1. Update `National Show` venue ✓
2. Update `show-19-2027` venue ✓ (do not forget this)

## What Does "Provisional Price" Mean?

All the prices are currently invented by the development team, not confirmed by the council. Every ticket type's description says *"Provisional price — pending council confirmation."* to make this clear.

When the council tells you the real prices:

1. Edit each ticket type (see section 2 above)
2. Change the **"Price (ZAR)"** field
3. You can remove the word "Provisional" from the **"Description"** if you want
4. Publish

**Don't let the website go live with "Provisional" prices unless everyone agrees it's okay.**

## Things to Know

### Publishing Changes

After you edit anything, you **must click "Publish"** at the top right, or your changes won't appear on the website. You will see a blue "Publish" button if you have unsaved changes.

### When Do Changes Appear?

Most pages on the website check for new content every 60 seconds. So if you publish a change:

- It appears on the **ticket pages** within 1 minute
- It appears on other pages within 1 minute

### Show Status: Active vs. Archived

The website can have many shows in its archive (2012, 2015, 2018, 2021, 2024, 2027, etc.), but only **one show can be "Active" at a time** — that is the show people can currently buy tickets for.

When you tick a show as "Active":

1. The system displays that show's ticket types on /tickets
2. Visitors can buy tickets only for that show
3. All tickets sold are tagged with that show in the database

**Important:** See "Critical Safety Rules" above — only one show should ever be active.

When a show is finished:

1. Uncheck its "Active" checkbox
2. Publish
3. That show moves to the archive; `/national-show/archive/[year]` displays it
4. Visitors can no longer buy tickets for it

### Ticket Type: Hide vs. Sold Out

When all tickets of a type have been purchased:

1. Visitors see a "Sold out" badge next to that type
2. They can't buy that type anymore
3. You don't have to do anything — the system tracks this automatically

If you want to hide a type completely **for a currently active show** (without letting people buy it):

1. Click **"Ticket Type"** in the sidebar
2. Click the type you want to hide
3. **Uncheck** the **"Active"** checkbox (the ticket-type-level active, not the show-level active — confusing, sorry)
4. Click **"Publish"**

The type disappears from /tickets immediately. (You can turn it back on anytime.)

**Note:** Each ticket type references one show. If you change which show is active, the types linked to the old show automatically become unavailable, even if their "Active" checkbox is still ticked.

### Real Money

**Warning:** When you turn **"Sales Open"** to ON, visitors can buy tickets immediately and real money moves. Make absolutely sure:

- Ticket prices are correct
- You have confirmed the council approves those prices
- Test the flow yourself on a staging server first if possible

Once someone buys a ticket, the payment is final (unless the council approves a refund).

### Booking References

Each person who buys a ticket gets a **booking reference** like `SAOC-2027-123456`. They see this number in their confirmation and need to bring it to the door. Don't worry about creating or managing these — the system creates them automatically.

### Door Check-In

After F5 is built, each buyer will get an email with a QR code. At the door, staff scan that QR code to check people in. The scanning system looks for the booking reference, so every ticket is trackable.

(For now, the door scanner is set up and waiting for the QR codes to arrive via email — this is built later.)

## Questions?

If something doesn't work as expected:

- **Prices not showing up?** Click "Publish" again. Check that the ticket type is set to **"Active"** = true.
- **Can't find the Tickets Page?** Look in the left sidebar under **"Singletons"** (not "Ticket Type" — that's for individual ticket categories).
- **Sales Open toggle not working?** Make sure you're clicking "Publish" after you check or uncheck it. And make sure you're editing the **"National Show"** document, not the "Tickets Page."
- **Content looks wrong?** Clear your browser cache (Ctrl+Shift+Delete on Windows, Cmd+Shift+Delete on Mac) and refresh.

Anything else: contact the dev team with a screenshot of what you're seeing.

## The Technical Bit (If You're Curious)

**Skip this if you just want to edit content.**

When someone buys a ticket:

1. They fill in a form on /tickets with their name, email, and ticket type
2. They click "Buy Ticket"
3. They're sent to PayFast (a payment processor) to pay
4. PayFast takes their money and redirects them to a confirmation page
5. The confirmation page says "Your payment is confirmed" and shows their booking reference
6. An email with a QR code is sent to them (F5, not yet)
7. At the door, staff scan the QR code to check them in

**What you control:** All the words they see (sections 3 above), whether sales are open (section 1), and what the prices are (section 2).

**What you don't control:** The payment system, the QR code generation, the door scanner, or the booking reference format.

## Editing Tickets (Unlikely, but Possible)

If you need to correct someone's email or name after they've bought a ticket:

1. Tell the dev team the booking reference
2. They can look it up in the database and fix it
3. You don't edit tickets directly in Studio

(There's no "Tickets" document type in the sidebar — tickets live in a separate database that the website reads from.)

---

That's it! You now control:

- Whether sales are open
- What prices people see
- Every word they read on the ticket pages
- Which ticket types are visible

Good luck with the 2027 National Show tickets!
