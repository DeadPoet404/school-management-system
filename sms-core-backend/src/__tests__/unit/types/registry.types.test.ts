/**
 * SMS-002 regression tests — teacher and staff onboarding payload/schema
 * alignment.
 *
 * Before this fix, the shared `baseAccountSchema` required `enrollmentDate`
 * for every registry while the teacher and staff add forms submit
 * `employmentDate`, so both onboarding flows failed Zod validation before
 * reaching the service layer. These tests pin the domain-specific account
 * date fields:
 *   - students -> account.enrollmentDate (unchanged)
 *   - teachers -> account.employmentDate
 *   - staff    -> account.employmentDate (persisted as Staff.appointmentDate)
 */
import { describe, it, expect } from 'vitest';
import {
  studentEnrollmentSchema,
  teacherEnrollmentSchema,
  staffEnrollmentSchema,
} from '@/types/registry.types';

// Mirrors the payload built by sms-core/src/app/teachers/add/page.tsx
const TEACHER_UI_PAYLOAD = {
  account: {
    fullName: 'Ama Mensah',
    email: 'ama.mensah@school.edu.gh',
    password: 'temp-pass-123',
    employmentDate: '2026-01-15',
    role: 'TEACHER',
  },
  demographics: {
    dateOfBirth: '1990-04-12',
    gender: 'Female',
    residentialAddress: '12 Independence Avenue, Accra',
    phone: '0244123456',
    bloodType: 'O+',
    religion: 'None',
    formerSchool: 'University of Ghana',
  },
  placement: {
    departmentId: 'dept-SCI',
    jobTitle: 'Integrated Science Teacher',
    employmentType: 'Full-Time',
    teachingSchedule: 'Standard Day',
  },
};

// Mirrors the payload built by sms-core/src/app/staff/add/page.tsx
const STAFF_UI_PAYLOAD = {
  account: {
    fullName: 'Kofi Owusu',
    email: 'kofi.owusu@school.edu.gh',
    password: 'temp-pass-123',
    employmentDate: '2026-02-01',
    role: 'STAFF',
  },
  demographics: {
    dateOfBirth: '1988-09-30',
    gender: 'Male',
    residentialAddress: '45 Ring Road, Accra',
    phone: '0206789012',
    bloodType: 'A+',
    religion: 'None',
    formerSchool: 'KNUST',
  },
  placement: {
    departmentId: 'dept-OPS',
    jobTitle: 'Records Officer',
    employmentType: 'Full-Time',
    shiftSchedule: 'Standard Day',
  },
  compliance: {
    nationalId: 'GHA-123456789-0',
    ssnitNumber: 'SSNIT-001122',
    emergencyContact: { name: 'Efua Owusu', phone: '0271112223' },
  },
  payroll: {
    clearanceTier: 'Level 1: Standard Staff Access',
    baseSalary: 2500,
    bankName: 'GCB Bank',
    bankAccount: '100100223344',
  },
};

// Mirrors the payload built by sms-core/src/app/students/add/page.tsx
const STUDENT_UI_PAYLOAD = {
  account: {
    fullName: 'Esi Arthur',
    email: 'esi.arthur@school.edu.gh',
    password: 'temp-pass-123',
    enrollmentDate: '2026-09-01',
  },
  demographics: {
    dateOfBirth: '2012-03-08',
    gender: 'Female',
    residentialAddress: '7 Marine Drive, Accra',
    medicalNotes: null,
    bloodType: 'B+',
    religion: 'None',
    formerSchool: 'Little Angels School',
  },
  placement: {
    classId: 'class-JHS1A',
    academicTrack: 'General',
    boardingStatus: 'Day',
  },
  compliance: {
    nationalId: 'GHA-987654321-0',
    emergencyContact: {
      name: 'Kwame Arthur',
      phone: '0244999888',
      relationship: 'Father',
    },
  },
  guardian: {
    name: 'Kwame Arthur',
    relationship: 'Father',
    phone: '0244999888',
    email: null,
  },
  billing: { feeTierId: 'TIER-A', initialDeposit: 200 },
};

const withoutKey = <T extends Record<string, unknown>>(obj: T, key: keyof T): Record<string, unknown> => {
  const copy: Record<string, unknown> = { ...obj };
  delete copy[key as string];
  return copy;
};

const issuePaths = (error: { issues: Array<{ path: Array<PropertyKey> }> }): string[] =>
  error.issues.map((issue) => issue.path.join('.'));

describe('SMS-002: registry enrollment account date fields', () => {
  describe('teacherEnrollmentSchema', () => {
    it('accepts the teacher add-form payload carrying account.employmentDate', () => {
      const result = teacherEnrollmentSchema.safeParse(TEACHER_UI_PAYLOAD);
      expect(result.success).toBe(true);
    });

    it('no longer requires account.enrollmentDate for teachers', () => {
      const result = teacherEnrollmentSchema.safeParse({
        ...TEACHER_UI_PAYLOAD,
        account: {
          fullName: 'Ama Mensah',
          email: 'ama.mensah@school.edu.gh',
          password: 'temp-pass-123',
          enrollmentDate: '2026-01-15',
        },
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(issuePaths(result.error)).toContain('account.employmentDate');
        expect(issuePaths(result.error)).not.toContain('account.enrollmentDate');
      }
    });

    it('reports a clear field-level error when employmentDate is missing or empty', () => {
      // Missing field: identified by its path (Zod reports the offending key).
      const missing = teacherEnrollmentSchema.safeParse({
        ...TEACHER_UI_PAYLOAD,
        account: withoutKey(TEACHER_UI_PAYLOAD.account, 'employmentDate'),
      });
      expect(missing.success).toBe(false);
      if (!missing.success) {
        expect(issuePaths(missing.error)).toContain('account.employmentDate');
      }

      // Empty field: identified by path plus a human-readable message.
      const empty = teacherEnrollmentSchema.safeParse({
        ...TEACHER_UI_PAYLOAD,
        account: { ...TEACHER_UI_PAYLOAD.account, employmentDate: '' },
      });
      expect(empty.success).toBe(false);
      if (!empty.success) {
        const employmentIssue = empty.error.issues.find(
          (issue) => issue.path.join('.') === 'account.employmentDate',
        );
        expect(employmentIssue).toBeDefined();
        expect(employmentIssue?.message).toBe('Employment date is required.');
      }
    });
  });

  describe('staffEnrollmentSchema', () => {
    it('accepts the staff add-form payload carrying account.employmentDate', () => {
      const result = staffEnrollmentSchema.safeParse(STAFF_UI_PAYLOAD);
      expect(result.success).toBe(true);
    });

    it('reports a clear field-level error when employmentDate is missing or empty', () => {
      // Missing field: identified by its path (Zod reports the offending key).
      const missing = staffEnrollmentSchema.safeParse({
        ...STAFF_UI_PAYLOAD,
        account: withoutKey(STAFF_UI_PAYLOAD.account, 'employmentDate'),
      });
      expect(missing.success).toBe(false);
      if (!missing.success) {
        expect(issuePaths(missing.error)).toContain('account.employmentDate');
      }

      // Empty field: identified by path plus a human-readable message.
      const empty = staffEnrollmentSchema.safeParse({
        ...STAFF_UI_PAYLOAD,
        account: { ...STAFF_UI_PAYLOAD.account, employmentDate: '' },
      });
      expect(empty.success).toBe(false);
      if (!empty.success) {
        const employmentIssue = empty.error.issues.find(
          (issue) => issue.path.join('.') === 'account.employmentDate',
        );
        expect(employmentIssue).toBeDefined();
        expect(employmentIssue?.message).toBe('Employment date is required.');
      }
    });

    it('still pins the staff account role to the STAFF literal', () => {
      const result = staffEnrollmentSchema.safeParse({
        ...STAFF_UI_PAYLOAD,
        account: { ...STAFF_UI_PAYLOAD.account, role: 'ADMIN' },
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(issuePaths(result.error)).toContain('account.role');
      }
    });
  });

  describe('studentEnrollmentSchema (unchanged behavior)', () => {
    it('still accepts account.enrollmentDate for students', () => {
      const result = studentEnrollmentSchema.safeParse(STUDENT_UI_PAYLOAD);
      expect(result.success).toBe(true);
    });

    it('still requires account.enrollmentDate for students', () => {
      const result = studentEnrollmentSchema.safeParse({
        ...STUDENT_UI_PAYLOAD,
        account: withoutKey(STUDENT_UI_PAYLOAD.account, 'enrollmentDate'),
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(issuePaths(result.error)).toContain('account.enrollmentDate');
      }
    });
  });
});
