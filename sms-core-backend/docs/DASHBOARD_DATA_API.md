# Dashboard Data API (SMS-011)

Nine granular aggregation endpoints for the product-owner-owned dashboard
designs (main + finance). Each is a `GET` under `/api/analytics`, guarded by
the incumbent matrix **`requireRole(ADMIN, ACCOUNTANT, STAFF)`** (JWT cookies),
returning the standard envelope `{ "success": true, "data": <payload> }`.

## Conventions

| Convention | Detail |
|---|---|
| Money | Numbers rounded to 2dp, in the school's operating currency (GHS). |
| Months | `YYYY-MM` UTC buckets. `?months=` defaults to **12**, clamped **3–24**; every window includes the current month and is zero-filled. |
| Percentages | Whole percents (e.g. `ratePct: 75`). |
| `present` | `PRESENT` OR `LATE` (same convention as `/api/analytics/dashboard`). |
| Envelope errors | Non-allowlisted roles get `403` (plus `401` unauthenticated). |

---

## 1. `GET /api/analytics/collections-by-channel?months=`

Cash vs MoMo/card/bank split + monthly trend (source: `PaymentCollection`, soft-deletes excluded).

```json
{
  "generatedAt": "2026-08-05T09:00:00.000Z",
  "window": { "months": 12, "startMonth": "2025-09", "endMonth": "2026-08" },
  "channels": [
    { "channel": "CASH", "total": 48250.5, "count": 132 },
    { "channel": "MOBILE_MONEY", "total": 12075.0, "count": 21 }
  ],
  "monthly": [
    { "month": "2026-07", "total": 5400.0, "byChannel": { "CASH": 5400.0 } },
    { "month": "2026-08", "total": 2675.0, "byChannel": { "CASH": 1675.0, "MOBILE_MONEY": 1000.0 } }
  ]
}
```

- `channels` sorted by `total` desc; `UNKNOWN` bucket if a legacy row lacks a method.

## 2. `GET /api/analytics/expense-breakdown?months=`

Expenses by category, monthly series, revenue-vs-expense net position.
**Spend basis: `CLEARED` only.** `PENDING_APPROVAL` surfaced as meta; `REJECTED` excluded.

```json
{
  "spendBasis": "CLEARED",
  "categories": [{ "category": "UTILITIES", "total": 3200.0, "count": 8 }],
  "monthly": [{ "month": "2026-08", "expenses": 400.0 }],
  "pendingApproval": { "total": 1150.0, "count": 3 },
  "netPosition": [{ "month": "2026-08", "collections": 5400.0, "expenses": 400.0, "net": 5000.0 }]
}
```

(`generatedAt` + `window` also present, same shape as endpoint 1.)

## 3. `GET /api/analytics/receivables-aging`

Open invoices (`UNPAID`/`PARTIAL`, outstanding = `amount − paidAmount > 0`)
bucketed against **today (UTC)** by `dueDate`.

```json
{
  "asOf": "2026-08-05",
  "totalOutstanding": 1400.0,
  "buckets": {
    "current":    { "count": 1, "amount": 500.0 },
    "days1to30":  { "count": 1, "amount": 300.0 },
    "days31to60": { "count": 1, "amount": 200.0 },
    "over60":     { "count": 1, "amount": 400.0 }
  }
}
```

- `current` = not yet due (due today or later). Always all four keys.

## 4. `GET /api/analytics/attendance-by-class?date=YYYY-MM-DD&range=day|week`

Attendance rate per class via `AttendanceRecord → Student → Placement → Class`.
Default: today, `range=day`. `range=week` = trailing 7 days ending `date`.

```json
{
  "date": "2026-08-05",
  "range": "week",
  "windowStart": "2026-07-30",
  "classes": [
    { "classId": "242b5c22-…", "className": "JHS 1A", "present": 19, "total": 22, "ratePct": 86 }
  ],
  "skippedUnassigned": 1
}
```

- `skippedUnassigned` = records whose student has no active class placement.

## 5. `GET /api/analytics/enrollment-distribution`

Students per class + gender split (ACTIVE students, via Placement; gender from Demographics).

```json
{
  "total": 5,
  "classes": [
    { "classId": "…", "className": "JHS 1A", "students": 3, "male": 1, "female": 1, "other": 1 },
    { "classId": null, "className": "Unassigned", "students": 1, "male": 0, "female": 1, "other": 0 }
  ]
}
```

- Sorted by `students` desc; the `Unassigned` bucket (null/inactive class) is appended last and only if non-empty.

## 6. `GET /api/analytics/academic-performance?termId=`

School average GPA (ACTIVE students), per-class averages, per-subject pass
rates (**pass = letterGrade ≠ "F9"**), GPA distribution. Optional `termId`
narrows the grade-record slices (the GPA figures stay student-level).

```json
{
  "termId": null,
  "schoolAverageGpa": 2.0,
  "activeStudents": 4,
  "perClass": [{ "classId": "…", "className": "JHS 1A", "records": 3, "averagePoints": 1.0, "averageScore": 56.67 }],
  "perSubject": [{ "subjectId": "…", "subjectName": "Mathematics", "code": "MATH", "records": 3, "passRatePct": 67 }],
  "gpaDistribution": [
    { "bucket": "0-1", "students": 1 },
    { "bucket": "1-2", "students": 1 },
    { "bucket": "2-3", "students": 1 },
    { "bucket": "3-4", "students": 1 }
  ]
}
```

## 7. `GET /api/analytics/payroll-summary`

Standing monthly obligation (`Σ netPay` over TeacherPayroll + StaffPayroll rows)
alongside **this calendar month's** collections.

```json
{
  "month": "2026-08",
  "teachers": { "headcount": 2, "netPayTotal": 5500.0, "byStatus": { "PAID": 1, "PENDING": 1 } },
  "staff": { "headcount": 1, "netPayTotal": 2000.0, "byStatus": { "PENDING": 1 } },
  "monthlyObligation": 7500.0,
  "collectionsThisMonth": 10000.0,
  "collectionTransactions": 6,
  "netPosition": 2500.0,
  "coverageRatio": 1.33
}
```

- `coverageRatio` = collections ÷ obligation (`null` when no payroll rows exist).

## 8. `GET /api/analytics/top-debtors?limit=N`

Server-side top-N by outstanding `BillingLedger.currentBalance`. `limit`
default **10**, clamped **1–50**.

```json
{
  "limit": 1,
  "debtors": [
    {
      "studentInternalId": "12c84b0a-…",
      "studentId": "HHA-2024-0001",
      "studentName": "Ama Yaw Osei",
      "className": "JHS 1A",
      "balance": 1250.0
    }
  ]
}
```

## 9. `GET /api/analytics/activity-feed?limit=N`

Recent `AuditLog` events, newest first. `limit` default **20**, clamped
**1–100**. `requestBody` is deliberately excluded; `entity` is derived from the
request path (`/api/students/…` → `students`).

```json
{
  "limit": 20,
  "events": [
    {
      "id": "cm…",
      "at": "2026-08-05T08:41:12.000Z",
      "actor": { "id": "…", "email": "admin@sms.local", "role": "ADMIN" },
      "action": "CREATE_STUDENT",
      "method": "POST",
      "entity": "students",
      "path": "/api/students",
      "status": 201
    }
  ]
}
```
