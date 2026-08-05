# Portal API -- External School Website Integration Contract

> Status: V1 | Audience: external school website developers
> Base URL: https://<sms-host>/api | Response envelope:
> `{ "success": boolean, "data"?: ..., "message"?: string }`

The website authenticates parents AS THE STUDENT via Google sign-in
(SMS-004), then drives the existing student self-service payment contract.
Digital payments auto-reconcile through the Paystack webhook pipeline -- no
polling required beyond the optional on-demand status verify.

## 1. Authentication -- Google token exchange

`POST /api/auth/google`

```json
// Request
{ "credential": "<Google ID token from Google Identity Services>" }

// 200 Response
{
  "success": true,
  "data": {
    "user": {
      "email": "student001@gmail.com",
      "role": "STUDENT",
      "entityType": "STUDENT",
      "entityInternalId": "9c3f1c2e-..."
    },
    "accessToken": "<JWT, 15 min>",
    "refreshToken": "<JWT, 7 days, rotating>"
  }
}
```

- ID token is verified against GOOGLE_CLIENT_ID; matched to
  StudentAccount.portalEmail. STUDENT sessions only.
- Errors: 400 missing credential | 401 invalid/expired token, unverified
  Google email, unknown email, inactive student | 429 rate limit (15/min/IP)
  | 503 GOOGLE_CLIENT_ID not configured.

Two session modes:
- Cookies -- response sets httpOnly access_token + refresh_token. Cross-site
  delivery requires COOKIE_SAME_SITE=none + COOKIE_SECURE=true (HTTPS).
- Bearer -- use the body tokens: Authorization: Bearer <accessToken>. Rotate
  with POST /api/auth/refresh; on 401, re-authenticate via Google.

## 2. Self-service payment endpoints (existing, STUDENT role)

| Method | Path | Body / Params | Notes |
|---|---|---|---|
| GET | /payments/fees/me | -- | Balance, invoices, payment history, pending intent |
| POST | /payments/intents/me | { "payerEmail", "amount" } | 201 -> { reference, authorizationUrl, ... }; one active intent per student (same amount resumes, else replaces) |
| GET | /payments/intents/:reference/status | ?verify=true optional | Owner-student or staff only |
| POST | /payments/intents/:reference/cancel | -- | Cancel a pending intent |

Redirect the parent to authorizationUrl; Paystack returns them to
PAYSTACK_CALLBACK_URL (point it at the WEBSITE's confirmation page). The
webhook credits the payment and issues receiptNo automatically; the on-demand
?verify=true status check is a backstop, not the primary path.

## 3. Deployment checklist

- [ ] GOOGLE_CLIENT_ID set (Google Cloud -> OAuth 2.0 Client IDs; website origin authorized)
- [ ] Website origin appended to CORS_ORIGINS
- [ ] Cookies: COOKIE_SAME_SITE=none + COOKIE_SECURE=true, OR Bearer mode
- [ ] PAYSTACK_CALLBACK_URL -> website payment-confirmation page
- [ ] Paystack webhook (POST /api/payments/webhooks/paystack) publicly reachable

## 4. Roadmap hooks (frozen backlog -- sections land as items ship)

- SMS-005 -- SHIPPED: the session-resolved /me family is live. See section 5.
- SMS-006/007 -- receipts emailed on reconciliation + printable PDF
  (GET /finance/payments/:id/receipt.pdf)
- SMS-008 -- GET /students/me/transcript.pdf

## 5. The /me self-service family (SMS-005)

All four endpoints are STUDENT-only (staff roles get 403). The student is
resolved from the verified session -- ids are never read from params, query,
or body, so spoofed ?studentId= values are ignored by construction.

### GET /students/me

Portal profile DTO (no compliance/billing internals):

```json
{
  "success": true,
  "data": {
    "id": "stu-internal-1",
    "studentId": "S001",
    "studentName": "Ama Serwaa",
    "enrollmentDate": "2025-09-01T00:00:00.000Z",
    "status": "ACTIVE",
    "currentGpa": 3.21,
    "attendanceRate": 96.4,
    "placement": {
      "academicTrack": "General",
      "boardingStatus": "DAY",
      "class": { "id": "class-1", "name": "JHS 1", "section": "A" }
    },
    "demographics": { "dateOfBirth": "2012-05-04T00:00:00.000Z", "gender": "F" },
    "guardians": [
      { "name": "Mum Serwaa", "relationship": "Mother", "phone": "0244000000", "email": null }
    ]
  }
}
```

### GET /grades/me?termId=

Same payload as `GET /grades/student/:studentId` (the transcript source),
resolved from the session. Optional termId filter.

### GET /attendance/me?from=&to=&limit=

Same payload as `GET /attendance/student/:studentId` including summary
metrics, resolved from the session. limit defaults to 50, max 200.

### GET /timetable/me

The session student's class schedule. 404 when the student has no class
placement; `timetable` is null until the school configures one for the class.

```json
{
  "success": true,
  "data": {
    "class": { "id": "class-1", "name": "JHS 1" },
    "timetable": {
      "periodsCount": 2,
      "periods": [
        { "periodNumber": 1, "dayOfWeek": null, "startTime": "08:00", "endTime": "08:45" }
      ],
      "breaks": [
        { "name": "Break", "dayOfWeek": null, "startTime": "10:15", "endTime": "10:35" }
      ],
      "subjects": [
        { "subjectName": "Mathematics", "teacherName": "Teacher X", "dayOfWeek": null }
      ]
    }
  }
}
```

