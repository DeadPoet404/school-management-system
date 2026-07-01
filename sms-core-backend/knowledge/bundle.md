# KNOWLEDGE SYSTEM BUNDLE

Generated: Wed Jun 24 09:39:20 AM GMT 2026

========================
## SYSTEM
========================
# Global System Architecture Map

## Core Tech Stack
* **Runtime Environment:** Node.js (v20+ Long-Term Support)
* **Language Compiler:** TypeScript
* **Application Framework:** Express.js (REST API Pattern)
* **Database Engine:** PostgreSQL
* **Object-Relational Mapping:** Prisma ORM

## Project Directory Schema
The system enforces a clean, modular feature-slice framework:
```text
src/
├── app.ts                         # Server bootstrap & global middleware execution
├── lib/
│   └── prisma.ts                  # Shared PrismaClient singleton instance
├── services/
│   └── StudentDepartureService.ts # Specialized cross-cutting student excision engine
└── modules/
    └── students/                  # Isolated feature slice domain
        ├── student.routes.ts      # Domain-specific HTTP entry routing lines
        ├── student.controller.ts  # Input validation & semantic HTTP status handling
        └── student.service.ts     # Core database operations & data mapping pipelines
System Boundaries & Global Guardrails
Lexical Scope Protection: All controller actions must use explicit arrow function properties (methodName = async (req, res) => {}). Traditional class methods drop execution context when assigned directly to Express routers, causing TypeError runtime drops.

Single Responsibility Layering: Cross-cutting lifecycle state changes (like processing an exit and generating an audit trail) must live in dedicated domain services (StudentDepartureService) rather than standard CRUD services.


========================
## CORE (legacy)
========================
# Core Architecture Map

## Subsystems

### 1. Ingestion Pipeline (`ComprehensiveEnrollmentWizard`)
- **Intent**: Student onboarding, initial account provision, and demographic ingestion.
- **Data Footprint**: Accounts, demographics, placement matrices, guardian ties, and billing configurations.

### 2. Excision Pipeline (`StudentDepartureForm`)
- **Intent**: Processing irreversible student lifecycle termination, state changes, and compliance logging.
- **Data Footprint**: Updates core student status parameter via `StudentDepartureService` and saves an immutable history profile inside `StudentDeparture` tables.


========================
## ACTIVE WORK
========================
# Active Work: Student Departure Backend

## Current Feature Slice
- **Goal**: Implement backend database models, service layers, and route controllers for handling student departures matching frontend schema shapes.

## Current Status
- **Schema**: Production schema fully verified with `StudentDeparture` tracking pointers mapped to `Student.id`.
- **Service Layer (`StudentDepartureService`)**: Fully functional. Executes atomic `$transaction` block updates changing `Student.status` to match the exact departure category and appends an immutable archival log entry.
- **Route Controller Layer**: Active at `POST /api/students/departure` with strict validation hooks checking for explicit frontend layout properties (`disposition`, `effectiveDate`, `remarks`).
- **Integration Status**: Verified 100% green with the frontend `StudentDepartureForm` component execution path.

## Next Steps
- Idle. Awaiting next functional slice, reporting matrices, or system enhancement definition.


========================
## SHARED DATA MODEL
========================
# Shared Data Model Ledger

## Core Nexus Entity Pattern
The database topology anchors relational data matrices directly to a single master root record (Student) via tight 1:1 relational pairings configured with defensive cascade rules (onDelete: Cascade). 

Additive domain models like Faculty/Teachers exist as independent entities to map high-signal metrics for institutional resource tracking.

## Data Tables Matrix

### Student (Core Hub)
Tracks root parameters (id, unique public tracking string studentId, studentName, enrollmentDate, current state status, and performance aggregates like currentGpa and attendanceRate).

### Teacher (Faculty Registry)
Tracks operational institutional facilitators. Captures root identifiers (id, unique public tracking string teacherId, teacherName, department, subject assigned, employment type, active status state, and years of professional experience tracking).

### StudentAccount (Auth Matrix)
Stores encrypted access credentials (portalEmail, passwordHash).

### Demographics (Personal Profile)
Captures static traits and wizard metadata fields (dateOfBirth, gender, residentialAddress, medicalNotes, bloodType, religion, formerSchool).

### Placement (Institutional Track)
Maps operational layout fields (classId, track selections, and boardingStatus).

### Guardian (Next-of-Kin Link)
Emergency contact tracing properties (name, relationship, phone, email).

### BillingLedger (Treasury Ledger)
Tracks transactional fee structures (feeTierId, initialDeposit, and computed liability balance).

### StudentDeparture (Archival Audit Trail)
Immutable Log. Tracks complete exit audit histories (departureType, effectiveDate, destinationInstitution, treasuryClearanceStatus, academicRecordsArchived, remarks). Uses studentInternalId tracking pointers so the log remains intact even if active student records undergo maintenance.


========================
## DOMAINS
========================
_no domains found_
========================
## DECISIONS
========================
_no decisions found_
========================
## FEATURES (if any)
========================
### students
Student Domain Blueprint
API Specifications & Schema Contracts
GET /api/students
Purpose: Queries all database student rows, deeply includes all 5 sub-relations, and transforms the relational data into a flat JSON format tailored for frontend layout tables.
Fallback Contract: If optional metadata properties evaluate to null or undefined, the mapping layer injects predictable placeholders ('—', 'None', 'N/A') to defend UI components against rendering drops.
POST /api/students
Purpose: Atomic transaction ingestion layout. Executes concurrent, nested writes across 5 distinct tables from a single payload generated by the frontend creation wizard.
Identifier Generation: System automatically spins up custom tracking strings using format rules: STU-2026-[6-digit-random-suffix].
POST /api/students/departure
Purpose: Triggers the student extraction pipeline via StudentDepartureService. Runs an atomic $transaction block that switches a student's status flag while writing a permanent history line inside the audit ledger.
Developer Experience (DX) Seeding Protocols
To maintain high-signal frontend environments during development without running massive seed scripts, newly initialized student profiles auto-generate randomized baseline metrics:
GPA Range: Floating random values between $2.8$ and $4.0$ (fixed to 2 decimals).
Attendance Rate Range: Integers between $90\%$ and $100\%$.


### teachers
# Teacher Domain Blueprint

## API Specifications & Schema Contracts

### GET /api/teachers
- **Purpose**: Queries all database teacher rows and surfaces the dataset ordered by creation context.
- **Data Shape Flat Mapping**: Tailored directly for the `TeacherOverviewTable` frontend layout component lines.
- **Fallback Guardrails**: If structural parameter states evaluate to null or undefined, the query engine or UI layer defaults cleanly to safe primitives ('Active', 'N/A', 0) to defend layout grids against rendering drops.


========================
Bundle generated at: knowledge/bundle.md
