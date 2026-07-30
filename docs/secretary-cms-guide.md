# SAOC Website — Secretary & Admin CMS Guide

**System:** Sanity Studio (the CMS)  
**Access URL:** `https://saoc.co.za/studio`  
**Who this is for:** SAOC Secretary, Webmaster, or any designated administrator

---

## 1. Logging In

1. Go to `https://saoc.co.za/studio`
2. Sign in with your Google account (the one registered with the SAOC Sanity project)
3. You will land on the Studio dashboard showing all content types in the left sidebar

If you cannot log in, contact the webmaster — access is granted per email address in the Sanity project settings.

---

## 2. Studio Overview

The left sidebar lists all content types you can manage:

| Item in sidebar | What it controls |
|----------------|-----------------|
| **Event** | Events calendar — shows, workshops, meetings |
| **Society** | The 21 affiliated orchid societies |
| **National Show** | Only one field here does anything right now — see Section 7 |
| **Show** | Past show records (archive, results, gallery) |
| **Judge** | Accredited judges directory |
| **Board Member** | SAOC executive committee listing |
| **Sponsor** | Sponsors page |
| **Home Page** | Hero images and mission text on the home page |
| **About Page** | About SAOC page body text |
| **Contact Page** | Contact page intro text |
| **Judging Page** | Judging overview page content |

---

## 3. Adding an Event

Events appear on the Events calendar page, grouped by month.

1. In the sidebar, click **Event**
2. Click **New document** (top right, pencil icon)
3. Fill in the fields:

| Field | Required | Notes |
|-------|----------|-------|
| **Title** | Yes | e.g. "Natal Orchid Society Monthly Meeting" |
| **Slug** | Yes | Click "Generate" — auto-fills from the title |
| **Date** | Yes | Start date and time |
| **End Date** | No | Leave blank for single-day events |
| **Kind** | No | e.g. "meeting", "show", "workshop" |
| **Description** | No | Short description shown on the calendar |
| **Venue** | No | Building or hall name |
| **Host Society** | No | Select the society hosting this event |
| **Location** | No | City or address |
| **Featured** | No | Tick to highlight the event at the top of the calendar |

4. Click **Publish** (green button, top right)

The event will appear on the website within a few seconds.

---

## 4. Editing or Removing an Event

1. Click **Event** in the sidebar
2. Find the event in the list (use the search bar at the top of the list)
3. Click it to open
4. Make your changes and click **Publish**

To remove an event: open it, click the three-dot menu (⋯) top right → **Delete**. Confirm the deletion. The event disappears from the website immediately.

---

## 5. Adding a New Society

Societies appear on the Societies page and each gets its own detail page at `/societies/[slug]`.

1. Click **Society** in the sidebar → **New document**
2. Fill in:

| Field | Notes |
|-------|-------|
| **Name** | Full society name |
| **Slug** | Click "Generate" — this becomes the URL (`/societies/natal-orchid-society`) |
| **Province** | e.g. "KwaZulu-Natal" |
| **Region** | e.g. "Durban" |
| **Year Founded** | Four-digit year |
| **Meeting Schedule** | e.g. "Second Tuesday of each month at 19:00" |
| **Venue** | Hall or venue name |
| **Member Count** | Approximate number |
| **Description** | Paragraph about the society |
| **Logo** | Upload a PNG or JPG logo (square preferred) |
| **Website** | Society's own website URL (if any) |
| **Mark Badge** | Tick if this society awards the SAOC Mark |

3. Click **Publish**

---

## 6. Updating Society Details

Meeting times, venues, and contact details change regularly. To update:

1. Click **Society** → find the society → click to open
2. Edit the relevant field(s)
3. Click **Publish**

No code changes are needed — the website updates automatically.

---

## 7. The "National Show" Document — Read This Before Editing

This is the one place in the Studio where you need to know exactly what does and doesn't work yet, so you don't spend time on something that has no effect.

1. Click **National Show** in the sidebar — there is one document, click it to open.
2. You'll see six fields: Title, Show Date, Location, Hero Image, Countdown Target Date, Exhibitor Stages.

**Only one of them currently does anything on the website: Countdown Target Date.**

- **Countdown Target Date** — this is real and live. It controls the countdown timer shown in the "Flagship Event" band on the **Home Page** (the four spinning numbers — days/hours/minutes/seconds). Change this to the actual show opening date and time, click **Publish**, and the home page countdown will update.
  - **Important:** the National Show page (`/national-show`) also shows its own "Opens in" countdown, near the top — that one has its own fixed date written directly into the page and will **not** change when you edit this field. If you edit Countdown Target Date and check the National Show page instead of the Home Page, it will look like nothing happened — your edit did work, you're just looking at the wrong page. Check the Home Page to see it take effect.
- **Title, Show Date, Location, Hero Image, Exhibitor Stages** — these fields exist and you can type into them, but **nothing on the live website reads them yet**. The National Show page (`/national-show`) currently shows its own fixed text, written directly into the page by a developer — editing these fields in the Studio will not change anything a visitor sees, on that page or anywhere else. This isn't a mistake you can fix by publishing again; the page simply isn't connected to these fields yet.

**What this means for you:** if you only need to update the show's countdown, use Countdown Target Date here and you're done. If you need the National Show page itself to show different dates, venue, or exhibitor information, that requires a developer to wire it up first — contact the webmaster (Section 16) rather than assuming a Studio edit will reach the page.

---

## 8. Adding a Past Show to the Archive

**Before you add one: this is only half-connected right now.** A show you add here will appear as a card on the Archive list page (`/national-show/archive`) — that part works. But each past show is also supposed to get its own individual page with the full write-up, gallery, and results (e.g. `/national-show/archive/2025`) — those individual pages only exist today for the shows already built into the site, not for anything you add in the Studio. If a visitor somehow reaches the address for a show you added, they'll get a "page not found" error rather than your write-up and gallery. This needs a developer to finish connecting before it's fully safe to use — check with the webmaster (Section 16) first if you're about to add a new one.

After each national show, add a record to the show archive.

1. Click **Show** → **New document**
2. Fill in:

| Field | Notes |
|-------|-------|
| **Title** | e.g. "18th SAOC National Orchid Show 2025" |
| **Slug** | Click "Generate" |
| **Year** | Calendar year (e.g. 2025) |
| **Date** | Show date |
| **Location** | Venue |
| **Status** | Select "past" for archived shows |
| **Hero Image** | Best photo from the show |
| **Entries / Exhibitors / Awards** | Statistics for the archive listing |
| **Summary** | Rich text — write-up of the show |
| **Gallery** | Upload multiple photos — click "Add item" for each |
| **Results (PDF)** | Upload the results PDF if available |

3. Click **Publish**

---

## 9. Managing Judges

Judges appear on the Judging page directory.

1. Click **Judge** → **New document**
2. Fill in Name, Region (e.g. "Gauteng"), Year Accredited, and optionally upload a photo
3. Click **Publish**

To update a judge's details: click **Judge**, find the judge, edit, and publish.

---

## 10. Managing Board Members

Board members appear on the About page.

1. Click **Board Member** → **New document**
2. Fill in Name, Role (e.g. "President"), Email, Photo, and Display Order
3. **Display Order** controls the sort order on the page — use 1 for President, 2 for Vice-President, etc.
4. Click **Publish**

When a committee changes at the AGM, update all affected board member records and remove any outgoing members (three-dot menu → Delete).

---

## 11. Managing Sponsors

Sponsors appear on the Sponsors page, grouped by tier.

1. Click **Sponsor** → **New document**
2. Fill in:

| Field | Notes |
|-------|-------|
| **Name** | Sponsor's trading name |
| **Tier** | Choose from: Title, Gold, Silver, Supporting |
| **Logo** | Upload their logo (PNG with transparent background preferred) |
| **Website** | Sponsor's website URL |
| **Description** | One or two sentences about the sponsor |
| **Active** | Tick for current sponsors; untick to hide without deleting |

3. Click **Publish**

To deactivate a sponsor at year-end without deleting: untick **Active** and publish.

---

## 12. Updating the Home Page

The home page hero carousel and mission statement are editable.

1. Click **Home Page** — there is one document
2. **Hero Images**: click "Add item" to add a photo, or drag to reorder. At least 3 photos recommended.
3. **Mission Text**: the short paragraph below the hero
4. **Countdown Target Date**: you will see this field on the Home Page document, but it is **not connected to anything on the website** — changing it has no effect on any countdown timer visitors see. To change the countdown shown to visitors, go to the **National Show** document instead (Section 7) and change its **Countdown Target Date** field — that's the one that actually drives the countdown banner on the home page. Leave this field on the Home Page document as it is.
5. Click **Publish**

---

## 13. Uploading Images — Best Practice

| Use | Recommended size | Format |
|-----|-----------------|--------|
| Hero / banner | 1600×900 px or wider | JPG (compressed) |
| Society logo | 400×400 px (square) | PNG (transparent background) |
| Sponsor logo | 600×200 px (landscape) | PNG (transparent background) |
| Judge / board photo | 400×400 px (square) | JPG |
| Gallery photos | Any, at least 1200px wide | JPG |

Sanity compresses and serves images via CDN — you do not need to resize before uploading, but smaller files upload faster on slower connections.

---

## 14. Publish vs Draft

- Every document in Sanity has a **Published** state and optionally a **Draft** state.
- Clicking **Publish** makes the content live on the website.
- If you want to prepare content in advance without it going live, make your edits and click **Save** (not Publish). The website will show the previously published version until you publish the draft.
- A blue dot next to a document name in the list means it has unpublished changes.

---

## 15. Troubleshooting

**Content not showing on the website after publishing:**  
Wait 30 seconds and refresh the page. The website caches content for a short period. If it still does not appear after 2 minutes, contact the webmaster.

**Cannot find a field I expect to see:**  
Some fields are only shown when relevant (e.g. End Date is optional). Scroll down in the document — all fields are present, some may be collapsed.

**Accidentally deleted something:**  
Contact the webmaster immediately. Sanity keeps a history of all changes; deleted documents can be restored within 30 days.

**Forgot to publish:**  
If a visitor reports missing content, check the Studio and look for a document with a blue "draft" indicator. Open it and click Publish.

---

## 16. Contact for Technical Help

Any issues with the CMS, website errors, or content that is not updating should be directed to:

- **Webmaster:** Brad Jasper — brad@inunu.net
- **Emergency (site down):** Same contact — include "SAOC SITE DOWN" in the subject
