import { ROLES } from '@/middleware/rbac.middleware';

/**
 * Role-aware response projection (PR1 / issue 10).
 *
 * FACULTY receives academic roster fields only.
 * Sensitive finance, payroll, national-ID, SSNIT, bank, and medical data
 * are stripped before the response leaves the controller — including CSV export.
 *
 * Privileged operators (ADMIN, STAFF, ACCOUNTANT) retain full payloads.
 */

export type ViewerRole = string | undefined;

function isPrivilegedRegistryViewer(role: ViewerRole): boolean {
  return (
    role === ROLES.ADMIN ||
    role === ROLES.STAFF ||
    role === ROLES.ACCOUNTANT
  );
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Academic roster view of a student for FACULTY (and any non-privileged role).
 * Removes: medical notes, national ID, billing ledger, invoices, payments.
 * Keeps: identity, placement, basic demographics, guardian contact for ops.
 */
export function toStudentDtoForRole<T>(student: T, role: ViewerRole): T {
  if (student == null || isPrivilegedRegistryViewer(role)) {
    return student;
  }

  // FACULTY (and any other non-privileged caller) — strip sensitive trees
  const raw = student as unknown as Record<string, unknown>;
  const projected: Record<string, unknown> = { ...raw };

  // Nested demographics: drop medicalNotes
  if (isObject(raw.demographics)) {
    const { medicalNotes: _medicalNotes, ...safeDemo } = raw.demographics;
    projected.demographics = safeDemo;
  }

  // Nested compliance: drop nationalId (keep emergency contact names/phones
  // only if already present — still useful for classroom incidents; national ID is not)
  if (isObject(raw.compliance)) {
    const { nationalId: _nationalId, ...safeCompliance } = raw.compliance;
    projected.compliance = safeCompliance;
  }

  // Finance trees — never for faculty
  delete projected.billing;
  delete projected.invoices;
  delete projected.payments;
  delete projected.departures;

  // Top-level aliases some clients may mirror
  delete projected.medicalNotes;
  delete projected.nationalId;
  delete projected.currentBalance;
  delete projected.feeTierId;
  delete projected.initialDeposit;

  return projected as T;
}

export function toStudentListDtoForRole<T>(students: T[], role: ViewerRole): T[] {
  return students.map((s) => toStudentDtoForRole(s, role));
}

/**
 * Faculty-safe teacher DTO.
 * Removes: national ID, SSNIT, emergency contacts, full payroll/bank/salary.
 * Keeps: identity, department/subject placement, non-sensitive demographics.
 */
export function toTeacherDtoForRole<T>(teacher: T, role: ViewerRole): T {
  if (teacher == null || isPrivilegedRegistryViewer(role)) {
    return teacher;
  }

  const raw = teacher as unknown as Record<string, unknown>;
  const projected: Record<string, unknown> = { ...raw };

  // mapTeacher() nests compliance + payroll; also handle raw Prisma includes.
  if (isObject(raw.compliance)) {
    projected.compliance = {
      nationalId: null,
      ssnitNumber: null,
      emergencyName: null,
      emergencyPhone: null,
      // signal redaction without leaking values
      _redacted: true,
    };
  }

  if (isObject(raw.payroll)) {
    projected.payroll = {
      baseSalary: null,
      deductions: null,
      netPay: null,
      paymentRoute: null,
      bankName: null,
      bankAccount: null,
      salaryStatus: null,
      clearanceTier: null,
      _redacted: true,
    };
  }

  // Top-level leakage guards
  delete projected.nationalId;
  delete projected.ssnitNumber;
  delete projected.ssnit;
  delete projected.baseSalary;
  delete projected.bankAccount;
  delete projected.bankName;
  delete projected.netPay;
  delete projected.deductions;

  // Departures often include clearance remarks — hide from faculty peers
  delete projected.departures;

  return projected as T;
}

export function toTeacherListDtoForRole<T>(teachers: T[], role: ViewerRole): T[] {
  return teachers.map((t) => toTeacherDtoForRole(t, role));
}
