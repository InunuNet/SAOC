# event-submit-validation goldens

Date contract: `date` and `endDate` must match `^\d{4}-\d{2}-\d{2}$` AND round-trip as a real calendar day
(`2027-02-30` rejected). The form's `<input type="date">` already sends exactly this shape. Error strings
unchanged ("Date must be a valid date in the future", "End date must be on or after start date").

Slug contract: `buildEventSlug(title, date, draftId)` = `${slugify(title)}-${date.slice(0,10)}-${first 8 hex chars of the UUID inside draftId}`,
empty parts dropped, joined with `-`. Same title+date, different draft id => different slug.
Idiom cited: the route already mints `crypto.randomUUID()` for the draft `_id` (app/api/events/submit/route.ts step 6) as its
collision avoidance; no slug-uniqueness lookup/isUnique exists anywhere in app/, lib/ or sanity/ (grepped origin/main). Reusing the
draft UUID needs no extra query and has no check-then-write race.
