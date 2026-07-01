# Core Architecture Map

## Subsystems

### 1. Ingestion Pipeline (`ComprehensiveEnrollmentWizard`)
- **Intent**: Student onboarding, initial account provision, and demographic ingestion.
- **Data Footprint**: Accounts, demographics, placement matrices, guardian ties, and billing configurations.

### 2. Excision Pipeline (`StudentDepartureForm`)
- **Intent**: Processing irreversible student lifecycle termination, state changes, and compliance logging.
- **Data Footprint**: Updates core student status parameter via `StudentDepartureService` and saves an immutable history profile inside `StudentDeparture` tables.
