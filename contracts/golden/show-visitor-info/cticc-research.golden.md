# CTICC research — verified facts and provenance

Every fact below was fetched and read on **2026-08-11** while authoring this contract. It is
recorded here so `@dev` seeds verified values instead of inventing plausible ones, and so a
future reader can tell what was checked from what was assumed.

**All of it is `research` status, not `confirmed`.** CTICC is Brad's working assumption
(2026-08-11): "If we guessed wrong, they'll have to correct us and then we'll put the new venue
in." Nothing here has been confirmed by the show committee.

## Venue — verified against cticc.co.za/contact-us

| Field | Value |
|-------|-------|
| Name | Cape Town International Convention Centre |
| CTICC 1 address | Convention Square, 1 Lower Long Street, Cape Town, 8001 |
| CTICC 1 GPS | `-33.915141, 18.425657` |
| CTICC 2 address | Corner of Heerengracht & Rua Bartholomeu Dias, Foreshore, Cape Town, 8001 |
| CTICC 2 GPS | `-33.91747, 18.42908` |
| Switchboard | +27 (0)21 410 5000 |
| Email | info@cticc.co.za |
| Postal | P.O. Box 8120, Roggebaai, Cape Town, 8001 |

Source: <https://www.cticc.co.za/contact-us/>, retrieved 2026-08-11.

Seed the **CTICC 1** address — it is the main convention building and the one a visitor
navigating to "the CTICC" reaches. Which building the show actually occupies is a committee
decision; the address field is editable and the status stays `research`.

## Getting there — Cape Town International Airport (CPT)

- Approximately **22 km**, typically **25–40 minutes** by road depending on traffic, via the N2
  toward the city and the Eastern Boulevard / Foreshore off-ramps.
- **MyCiTi bus route A01**, Airport ↔ Civic Centre, is the scheduled public-transport link.
  Departures roughly every 20 minutes in peak (05:30–08:30 and 16:00–19:00), around hourly
  off-peak; journey time about **30 minutes** to Civic Centre.
- Civic Centre station is on **Hertzog Boulevard**, roughly **600 m** — a 7–8 minute walk —
  from the CTICC.
- Metered taxis and e-hailing operate from the airport's designated ranks.

Sources: <https://www.myciti.org.za/en/routes-stops/airport-services/>,
<https://www.myciti.org.za/docs/route-timetables/A01-timetable.pdf>, retrieved 2026-08-11.

Distances and drive times are stated as approximate on purpose. Do not seed a precise
minute figure as if it were a timetable.

## Other national airports

South Africa's other major airports have **no practical road route** to Cape Town — OR Tambo
(Johannesburg) is ~1,400 km, King Shaka (Durban) ~1,650 km. The honest content is not a driving
distance; it is: fly into Cape Town International, then follow the CPT guidance above. Seed
`airportRoutes` with three entries — CPT (road/bus detail), OR Tambo (connect by air, ~2h
flight), King Shaka (connect by air, ~2h flight) — so a visitor from any national airport finds
their starting point on the page, which is exactly what Brad asked for.

## Accommodation — grouped by distance band

The mission requires grouping **by distance from the venue**, so the schema carries a
`distanceBand` enum rather than free text. Seeded entries are well-known Foreshore / city-bowl
properties near the CTICC and are `research` status.

| Band | Meaning |
|------|---------|
| `walking` | Under 1 km — walk to the venue |
| `nearby` | 1–3 km — short drive, taxi or MyCiTi hop |
| `city` | 3–10 km — wider city bowl and Atlantic seaboard |
| `further` | Over 10 km |

Seed a small set (4–6), each with name, area, band and a note. **Do not seed prices, star
ratings, booking links to third-party aggregators, or any claim of a negotiated show rate** —
none of that is verified, and a fabricated rate is a commercial statement SAOC has not made.

## Emergency contacts

National South African emergency numbers are stable public facts and safe to seed:

| Service | Number |
|---------|--------|
| Police (national) | 10111 |
| Ambulance / fire (national) | 10177 |
| All emergencies from a mobile phone | 112 |

Venue-specific numbers (CTICC security, on-site first aid, the show's own duty contact) are
**committee-supplied and must seed as `pending` placeholders**, not invented. Do not put the
CTICC switchboard forward as an emergency number.

## The line this file draws

Verified and seedable as `research`: venue address, GPS, airport distance/route, MyCiTi A01,
walking distance from Civic Centre, generic accommodation areas, national emergency numbers.

**Not verified, seed as `pending` placeholders:** show dates, opening hours, admission
conditions and concessions, on-site parking rates and capacity, wheelchair-access specifics,
photography policy, cloakroom / plant-holding arrangements, catering, and every FAQ answer that
depends on any of the above.
