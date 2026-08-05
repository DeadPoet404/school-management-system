# Communication — Announcements & Notices (SMS-012)

Provider-agnostic broadcast of school-wide / per-class / per-student notices
over **SMS (Arkesel)**, **WhatsApp (Meta Cloud API)** and **email** (SMS-006
mailer), with a durable per-recipient delivery ledger and an in-process retry
worker (payments-sweeper pattern). The only schema change of the twelve.

## Roles

| Action | Roles |
|---|---|
| `POST /api/communication/announcements` (compose + send) | **ADMIN** |
| `GET /api/communication/announcements` (list + counts)   | ADMIN, **STAFF** (read-only) |
| `GET /api/communication/announcements/:id/deliveries`    | ADMIN, **STAFF** (read-only) |

## Environment

| Var | Adapter | Notes |
|---|---|---|
| `ARKESEL_API_KEY` | SMS | Arkesel console API key. Blank = SMS channel disabled. |
| `ARKESEL_SENDER_ID` | SMS | Max 11 chars; must be approved on the Arkesel account. |
| `META_WA_PHONE_NUMBER_ID` | WhatsApp | Cloud API phone-number id. |
| `META_WA_ACCESS_TOKEN` | WhatsApp | System-user token with `whatsapp_business_messaging`. |
| `META_WA_BUSINESS_ACCOUNT_ID` | WhatsApp | WABA id (verification gate; adapter requires all three). |
| `GMAIL_USER`, `GMAIL_APP_PASSWORD` | Email | Reused from SMS-006. |

**Ship state:** unset variables keep a channel disabled — deliveries on it
fail permanently with `error: channel-disabled` (the ledger tells the truth
rather than retrying into a vacuum). The worker only runs when at least one
adapter is configured.

> **WhatsApp caveat (frozen-spec constraint).** Business-initiated WhatsApp
> messages require an approved *template*; the adapter's freeform `text` body
> only delivers inside the 24h customer-service window. SMS ships first, and
> swapping the WhatsApp payload to a template call is a one-file change in
> `communication.adapters.ts` once Meta verification completes.

## Recipient resolution (ratified)

| Audience | Recipients |
|---|---|
| `SCHOOL_WIDE` | Guardians of every ACTIVE student |
| `CLASS` (`classId`) | Guardians via placements of the class |
| `STUDENTS` (`studentIds`) | Guardians of the named ACTIVE students |

Contact pick per channel: SMS/WHATSAPP → `Guardian.phone`;
EMAIL → `Guardian.email` **+ the student's portal email** (deduped per
channel+recipient; matches the SMS-006 receipt-recipient rule).

## Compose example

```json
POST /api/communication/announcements
{
  "title": "Reopening — Term 1",
  "body": "School reopens Mon Sep 7 at 07:30. Full fee schedule attached in the portal.",
  "audience": "CLASS",
  "classId": "242b5c22-f270-46d4-9712-350e95e108f2",
  "channels": ["SMS", "EMAIL"]
}
```

`201` → `{ announcementId, status, studentsResolved, recipientCount, channelCounts }`.
The worker is kicked immediately (non-blocking) in addition to its 60s sweep.

## Delivery ledger semantics

| Field | Values |
|---|---|
| `status` | `QUEUED -> SENT | FAILED` (announcement rolls `QUEUED -> SENDING -> COMPLETED`) |
| `attempts` | 5 tries max; backoff **1m -> 5m -> 15m -> 1h** (4h ladder cap) |
| `nextAttemptAt` | next eligibility instant for the 60s sweep |
| `providerMessageId` | Arkesel `data[0].id` / Meta `messages[0].id` / (email: none) |
| `error` | last failure reason (`channel-disabled`, provider HTTP summary, …) |

Phone numbers are passed through as stored — keep Guardian records in
international (`+233…`) or local (`0…`) form per the Arkesel account rules.
