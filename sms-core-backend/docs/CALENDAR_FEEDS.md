# Calendar Feeds (SMS-010) — Deployment Checklist

Per-class `.ics` feeds let staff subscribe whole timetables in Google
Calendar (or any RFC 5545 client).

## What ships

| Piece | Detail |
|---|---|
| Mint (authenticated) | `POST /api/timetable/calendar/:classId/token` — ADMIN + FACULTY. Returns `{ token, path }`. |
| Public feed | `GET /api/timetable/calendar/:classId.ics?token=…` — token-authenticated (no JWT); `text/calendar`; read-only; rate-limited by the global limiter. |
| Env | `CALENDAR_FEED_SECRET` — unset keeps feeds disabled (503 everywhere). |
| UI | Timetable & Scheduling module: Copy link / Subscribe via Google / Regenerate. |

## Operational notes (ratified at backlog freeze)

1. **Public reachability.** Google fetches the feed URL from *its* servers —
   the URL's host must be publicly reachable (a `localhost`/LAN URL subscribes
   for you locally but Google cannot poll it). The compose frontend proxies
   `/api/*`, so feeds work through the frontend origin too.
2. **Refresh lag.** Google's subscription refresh lags hours; timetable edits
   are never instant in subscribers' calendars. Term boundaries (RRULE UNTIL)
   apply automatically.
3. **Token rotation.** Tokens are stateless HMAC (`v1.<classId>.<iat>` +
   signature). Regenerating a link re-signs instantly; rotating
   `CALENDAR_FEED_SECRET` invalidates ALL outstanding links at once (version
   prefix exists for staged rotations).
4. **Mapping limitation (option A).** The app matrix is a weekday template,
   so subjects are round-robined into slots and every event recurs MO–FR
   until term end. Ghana time (Africa/Accra, no DST) is emitted as UTC.
