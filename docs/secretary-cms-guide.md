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
| **National Show** | The upcoming national show page (countdown, dates, info) |
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

## 7. Managing the National Show Page

The National Show page shows a countdown timer and show details. Update this before each national show.

1. Click **National Show** in the sidebar
2. There should be one document — click it to open
3. Update:

| Field | Notes |
|-------|-------|
| **Title** | e.g. "19th SAOC National Orchid Show 2027" |
| **Show Date** | Actual show date (used for display) |
| **Location** | Venue and city |
| **Hero Image** | Upload a large landscape photo (1200×600 or wider) |
| **Countdown Target Date** | The date the timer counts down to — usually the show opening date |
| **Exhibitor Stages** | Rich text — registration deadlines, staging schedule for exhibitors |

4. Click **Publish**

The countdown on the home page and national show page updates immediately.

---

## 8. Adding a Past Show to the Archive

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
4. **Countdown Target Date**: must match the National Show countdown date
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
