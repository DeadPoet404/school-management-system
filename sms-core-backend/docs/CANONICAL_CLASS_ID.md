# Canonical Class Identifier (PR2)

## Invariant

**`classId` / timetable-finance `sectionId` === `Class.id` (UUID).**

| Field | Meaning |
|-------|---------|
| `Class.id` | Canonical identifier used by Placement, GradeRecord, TimetableConfiguration.sectionId, FeeStructureConfiguration.sectionId, PaymentCollection.sectionId, attendance `classId` |
| `Class.name` | Human label (e.g. `JHS 1A`) |
| `Class.section` | Optional grouping letter only (e.g. `A`). **Never** use as a join key to timetable/fees |

## Forbidden

- Frontend tokens: `jhs-1`, `grade-1`, `pre-school`, etc.
- Joining timetable allocation on `Class.section` (letter) instead of `Class.id`
- Inventing section strings that are not rows in `Class`

## API / UI contract

- Load classes from `GET /api/reference/classes`
- Send `Class.id` as `classId` or matrix/fee `sectionId` keys
- Faculty grade authorization matches `SubjectAllocation` via `TimetableConfiguration.sectionId = Class.id`
