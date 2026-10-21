# nos-critique-r8 F4 - P3s from the interim QA (Codi: surgical)

BASE = main 81490e7a (re-based from 8e1d31d7). Footprint: goldens/f4-footprint.json (VisitDisclosure.tsx, TravelRoutes.tsx, plan-your-visit page.tsx).

1. Attraction ids. `visit-attraction-${_key ?? index}` collides (a key "1" against index 1, duplicate keys) and carries whitespace or markup from the CMS key. Spec: id = `visit-attraction-${index}-${safe}` with the index FIRST and `safe` = the key lowercased with every run of characters outside [a-z0-9_-] replaced by "-" (empty or missing key: omit the suffix and the trailing dash). The index prefix makes ids unique even for duplicate keys. The link id stays `${id}-link`, aria-labelledby stays `${linkId} ${id}`. Fixture (props only): duplicate keys, a numeric key, whitespace, quotes and markup, empty and missing keys, in both the plain and disclosure states: every id unique, matching ^[A-Za-z][A-Za-z0-9_-]*$, and each link's aria-labelledby = its own link id + its own heading id, both existing.
2. TravelRoutes puts an h4 directly under the page's h2. Change the route heading to h3 (TravelRoutes is used only on plan-your-visit). Fixture: an h2 followed by TravelRoutes yields heading levels [2, 3, 3].
3. Stale comment at plan page.tsx:34: the "two aria-labels" sentence is out of date (the Getting-there label now lives in VisitDisclosure.tsx). Reword it so it still cites nos-v4/plan-your-visit.html and names only what the page still defines (the emergency label).

No new copy (static S4).
