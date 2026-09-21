# Transport MVP

The first transport increment is available in the staff web application at
`/dashboard/transport`. It is a browser scanner simulator, not a replacement
for the production Android scanner.

## Contracts

All routes are under `/api/transport` and require an authenticated `ADMIN` or
`STAFF` session in this increment.

- `GET/POST /buses` — active bus registry.
- `GET /students` — active student/card directory used for setup and simulator fixtures.
- `POST /assignments` — effective-dated student-to-bus assignment.
- `POST /cards` — issue or rotate an opaque, HMAC-signed QR token. The token
  contains only a random card id and version; it contains no personal data.
- `GET/POST /trips` — one `TO_SCHOOL` and one `FROM_SCHOOL` trip per bus and
  service date; the database unique constraint enforces this invariant.
- `PATCH /trips/:id/status` — close or cancel a trip.
- `GET /roster` — bus/date/direction roster plus `rosterVersion`. A changed
  version is a warning, not a hard block.
- `POST /sync` — accepts up to 500 locally captured events in one request.
  `clientEventId` is unique, and retries return `DUPLICATE` rather than create
  a second boarding event. Wrong-bus scans are accepted with
  `assignmentStatus: UNASSIGNED` and a `WRONG_BUS` warning.
- `GET /exceptions` and `GET /reports/boardings` — synced boarding and
  wrong-bus/no-assignment reporting.

Boarding events are append-only at the application boundary. The event model
also keeps the device capture time, received time, source, roster version,
sync batch id, operator, and device association for reconciliation.

## Device-free test flow

1. Open **Transport** from the staff sidebar.
2. Create a bus if the registry is empty.
3. Select an active student, assign the student to the bus, and issue a QR card.
4. Open the service-date/direction trip and download its roster while online.
5. Switch **Offline mode** on. Use the roster quick-scan buttons, a wrong-bus
   test card, or manual boarding. Each scan is acknowledged locally and stays
   in a persisted browser queue; scanning does not call the API.
6. Refresh the page to verify queue recovery.
7. Switch online and press **Sync**. The browser sends one batch. Repeating a
   sync is safe because the same `clientEventId` values are reused.
8. Load **Exceptions & reports** after sync to verify accepted boardings and
   wrong-bus exceptions.

The native Android implementation can use the same roster, token, event, and
batch-sync contracts with encrypted local SQLite storage and device-specific
authentication added in the production device rollout.
