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
