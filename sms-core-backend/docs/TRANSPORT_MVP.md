# Transport MVP

The first transport increment is available in the staff web application at
`/dashboard/transport`. It is a browser scanner simulator, not a replacement
for the production Android scanner.

## Contracts

All routes are under `/api/transport` and require an authenticated `ADMIN` or
`STAFF` session in this increment.

- `GET/POST /buses` — active bus registry.
- `GET/POST /routes` — active route registry. `GET` inlines each route's stops
  in sequence order so the control room needs no per-route follow-up request.
  A duplicate `code` returns **409** with an operator-readable message.
- `GET/PATCH /routes/:id` — route detail, and rename or retire. Routes are
  never hard-deleted while stops or assignments reference them (`RESTRICT`);
  retiring via `isActive: false` is how a route leaves service while its
  history stays reconcilable.
- `POST /routes/:id/stops` — append a stop. `sequence` is optional and defaults
  to one past the current last stop; an explicit `sequence` that is already
  taken on that route returns **409** naming the stop that holds it.
- `PATCH /stops/:id` — rename, reorder, add coordinates, or deactivate a stop.
- `GET /students` — active student/card directory used for setup and simulator fixtures.
- `POST /assignments` — effective-dated student-to-bus assignment, optionally
  to a stop. Passing `stopId` alone is enough: the route is **derived from the
  stop**, so the two can never disagree. Supplying both inconsistently returns
  **400**; a missing or inactive stop/route returns **404**. The stop leg is
  optional, so a bus-only assignment still works.

  Re-assigning a student at the *same* effective instant supersedes the prior
  open assignment rather than sitting alongside it. Without this a child could
  hold two open assignments on different buses and the roster would resolve
  them arbitrarily.
- `POST /cards` — issue or rotate an opaque, HMAC-signed QR token. The token
  contains only a random card id and version; it contains no personal data.
- `GET/POST /trips` — one `TO_SCHOOL` and one `FROM_SCHOOL` trip per bus and
  service date; the database unique constraint enforces this invariant.
  `POST` is idempotent while the trip is `OPEN`. Against a `CLOSED` or
  `CANCELLED` trip it returns **409** unless the body carries
  `reopen: true`, because reopening clears `endedAt` and must be deliberate.
  A trip may carry an optional `routeId`. Idempotency covers `status`,
  `startedAt` and `endedAt` only: re-POSTing an `OPEN` trip with a `routeId`
  binds the route without disturbing the live run, because choosing a route is
  an operator decision rather than a device retry. Omitting `routeId` leaves
  any existing binding untouched.
- `PATCH /trips/:id/status` — close or cancel a trip.
- `GET /roster` — bus/date/direction roster plus `rosterVersion`. A changed
  version is a warning, not a hard block. Each entry carries its `stop` (null
  for a bus-only assignment), and the response carries a `stopManifest` of
  per-stop headcounts.
  Ordering is direction-aware: `TO_SCHOOL` runs the stops in sequence order and
  `FROM_SCHOOL` runs the same list backwards, so there is only one stored order
  and the two directions cannot drift apart. Children with no stop sort last in
  both directions, and alphabetically within a stop. `rosterVersion` covers each
  child's `stopId`, so moving a child between stops invalidates a cached device
  roster instead of leaving the driver with a stale manifest.
- `POST /sync` — accepts up to 500 locally captured events in one request.
  `clientEventId` is unique, and retries return `DUPLICATE` rather than create
  a second boarding event. Wrong-bus scans are accepted with
  `assignmentStatus: UNASSIGNED` and a `WRONG_BUS` warning (the student holds
  an active assignment to a different bus) or a `NO_ACTIVE_ASSIGNMENT` warning
  (the student holds none). A roster version mismatch adds `ROSTER_STALE`.
  Both cases are accepted, never rejected — a child is not left stranded
  because the paperwork disagrees.
- `GET /exceptions` and `GET /reports/boardings` — synced boarding and
  wrong-bus/no-assignment reporting.

Boarding events are append-only at the application boundary. The event model
also keeps the device capture time, received time, source, roster version,
sync batch id, operator, and device association for reconciliation.

## Device-free test flow

1. Open **Transport** from the staff sidebar.
2. Create a bus if the registry is empty.
3. Optionally open **Routes & stops**, create a route, and append its stops in
   pickup order. Stops are optional throughout — a child assigned to a bus
   alone still boards and syncs exactly as before.
4. Select an active student, assign the student to the bus (and to a stop, if
   the route has them), and issue a QR card.
5. Open the service-date/direction trip and download its roster while online.
   The roster lists children in pickup order with the per-stop headcount above
   the table.
6. Switch **Offline mode** on. Use the roster quick-scan buttons, a wrong-bus
   test card, or manual boarding. Each scan is acknowledged locally and stays
   in a persisted browser queue; scanning does not call the API.
7. Refresh the page to verify queue recovery.
8. Switch online and press **Sync**. The browser sends one batch. Repeating a
   sync is safe because the same `clientEventId` values are reused.
9. Load **Exceptions & reports** after sync to verify accepted boardings and
   wrong-bus exceptions.

The native Android implementation can use the same roster, token, event, and
batch-sync contracts with encrypted local SQLite storage and device-specific
authentication added in the production device rollout.
