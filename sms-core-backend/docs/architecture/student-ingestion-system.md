# Technical Specification: Student Ingestion & Personal Records System

## 1. Architectural Overview
The student enrollment pipeline utilizes a decoupled frontend wizard architecture backed by an atomic transaction-safe layer via Prisma and a relational database. This system supports high-density demographic tracking, clinical health profiling, next-of-kin linking, and financial ledger initialization without data loss or intermediate sync drop-offs.

---

## 2. Global System Data Flow


[Frontend Wizard] ──(Multi-step Structured JSON)──> [API Route / HTTP POST]
│
[StudentService Layer]
│
(Prisma Atomic Transaction)
│
▼
[PostgreSQL Database]
(Account, Demographics, Billing, etc.)
│
[Universal Data Table] <──(Populated Relations)─── [API Route / HTTP GET]

---

## 3. Data Dictionary & Contract Mapping

When transferring values across system boundaries, fields map explicitly to guarantee relational persistence integrity across tables:

| Frontend State Hook / Field | JSON Transmission Path | Backend Prisma Database Target |
| :--- | :--- | :--- |
| `fullName` | `account.fullName` | `Student.studentName` |
| `email` | `account.email` | `UserAccount.portalEmail` |
| `password` | `account.password` | `UserAccount.passwordHash` |
| `enrollmentDate` | `account.enrollmentDate` | `Student.enrollmentDate` |
| `dateOfBirth` | `demographics.dateOfBirth` | `StudentDemographics.dateOfBirth` |
| `gender` | `demographics.gender` | `StudentDemographics.gender` |
| `residentialAddress` | `demographics.residentialAddress` | `StudentDemographics.residentialAddress` |
| `bloodType` | `demographics.bloodType` | `StudentDemographics.bloodType` |
| `religion` | `demographics.religion` | `StudentDemographics.religion` |
| `formerSchool` | `demographics.formerSchool` | `StudentDemographics.formerSchool` |
| `medicalNotes` | `demographics.medicalNotes` | `StudentDemographics.medicalNotes` |
| `classId` | `placement.classId` | `AcademicPlacement.classId` |
| `academicTrack` | `placement.academicTrack` | `AcademicPlacement.academicTrack` |
| `boardingStatus` | `placement.boardingStatus` | `AcademicPlacement.boardingStatus` |
| `guardianName` | `guardian.name` | `GuardianLinkage.name` |
| `guardianRelationship` | `guardian.relationship` | `GuardianLinkage.relationship` |
| `guardianPhone` | `guardian.phone` | `GuardianLinkage.phone` |
| `guardianEmail` | `guardian.email` | `GuardianLinkage.email` |
| `feeTierId` | `billing.feeTierId` | `TreasuryLedger.feeTierId` |
| `initialDeposit` | `billing.initialDeposit` | `TreasuryLedger.initialDeposit` |

---

## 4. Component Interfaces Spec

### 📑 Enrollment Wizard (`app/students/enroll/page.tsx`)
* **Role:** Multi-step transactional record input engine.
* **Validation Rules:** Enforces minimum 6-character strings on temporary security tokens (`password`), exact validation on historical date limits (`type="date"`), and HTML5 required attribute validation prior to ledger ingest tracking.
* **UX Strategy:** Displays continuous system feedback status alerts and offers dual resolution forks once ingestion succeeds: immediate system access configuration via identity activation or retention as a standard applicant.

### 📊 Clinical Profile Matrix Table (`components/student-personal-info-table.tsx`)
* **Role:** High-density read view optimizing data scannability for administrators and medical staff.
* **Defensive Mapping Strategy:** Implements normalization lookups to parse variant data payloads:
```typescript
  const medical = student.medicalConditions || student.medicalNotes || d.medicalNotes || "None";
  const cleanBloodType = rawBloodType !== "—" ? rawBloodType.replace('_PLUS', '+').replace('_MINUS', '-').toUpperCase() : "—";

Visual Presentation Classes: Uses distinct theme colors (Blue/Purple badges for gender lines) and striking high-contrast borders for critical medical configurations to enable quick assessments in emergency scenarios.
⚙️ Core Service Ingestion Engine (src/modules/students/student.service.ts)
Role: The atomic data layer controller.
Eager Loading Constraints: Explicitly includes deep model relations inside queries to prevent incomplete json responses over API endpoints:
TypeScript
 include: { placement: true, billing: true, guardian: true, account: true, demographics: true }

Calculated Values: Handles automated server-side identifier assignments (STU-2026-XXXXXX), sets up baseline performance metrics (GPAs and random mock attendance tracking coefficients), and automates balances on billing tables based on assigned fee tier limits.
5. Maintenance & Troubleshooting Diagnostic Guide
Symmetric Field Blanks / Dashing Checklist
If demographic or personal info column grids render empty lines (—) despite data existing in the database:
Verify that findAllStudents() in student.service.ts includes the relation inside the database query block (include: { demographics: true, account: true }).
Verify that the map return statement cleanly maps the database record variables onto the response body fields payload (portalEmail, medicalNotes, bloodType, etc.).
Confirm that the client-side mapping variables in student-personal-info-table.tsx check both the base array objects and nested database properties (d.bloodType) safely.
Automatic Balance Calculations Engine Reference
Initial balances are derived programmatically using the following configuration patterns before writing to storage nodes:
tier-std (Standard Tuition) $\rightarrow$ Base Tariff: GH₵ 2,500
tier-aid (Financial Aid Subsidized) $\rightarrow$ Base Tariff: GH₵ 1,250
tier-sch (Full Scholarship Exempt) $\rightarrow$ Base Tariff: GH₵ 0
$$\text{Current Balance} = \max(0, \text{Base Tariff} - \text{Initial Deposit})$$
