import { describe, it, expect } from 'vitest';
import {
  toStudentDtoForRole,
  toStudentListDtoForRole,
  toTeacherDtoForRole,
  toTeacherListDtoForRole,
} from '@/lib/role-dtos';

const FULL_STUDENT = {
  id: 'stu-1',
  studentId: 'STU-001',
  studentName: 'Ama Mensah',
  status: 'ACTIVE',
  demographics: {
    gender: 'Female',
    medicalNotes: 'Asthma — keep inhaler on file',
    bloodType: 'O+',
  },
  compliance: {
    nationalId: 'GHA-123456789-0',
    emergencyName: 'Kofi Mensah',
    emergencyPhone: '0550000000',
  },
  placement: { classId: 'class-1', academicTrack: 'Science' },
  guardians: [{ name: 'Kofi Mensah', phone: '0550000000' }],
  billing: { feeTierId: 'tier-a', currentBalance: 1500, initialDeposit: 500 },
  invoices: [{ invoiceNo: 'INV-1', amount: 2000 }],
  payments: [{ receiptNo: 'RCPT-1', amount: 500 }],
  departures: [],
};

const FULL_TEACHER = {
  id: 'tch-1',
  teacherId: 'TCH-001',
  teacherName: 'Yaw Boateng',
  email: 'yaw@school.com',
  department: 'Science',
  subject: 'Physics',
  account: { fullName: 'Yaw Boateng', email: 'yaw@school.com', role: 'FACULTY' },
  placement: { departmentId: 'Science', jobTitle: 'Physics', employmentType: 'Full-Time' },
  demographics: {
    phone: '0241111111',
    gender: 'Male',
    residentialAddress: 'Accra',
  },
  compliance: {
    nationalId: 'GHA-987654321-0',
    ssnitNumber: 'C123456789012',
    emergencyName: 'Ama Boateng',
    emergencyPhone: '0242222222',
  },
  payroll: {
    baseSalary: 4500,
    deductions: 200,
    netPay: 4300,
    paymentRoute: 'BANK_TRANSFER',
    bankName: 'GCB',
    bankAccount: '1234567890123',
    salaryStatus: 'PENDING',
    clearanceTier: 'Level 1',
  },
  departures: [{ id: 'dep-1' }],
};

describe('toStudentDtoForRole', () => {
  it('returns full student payload for ADMIN', () => {
    const result = toStudentDtoForRole(FULL_STUDENT, 'ADMIN');
    expect(result.billing).toEqual(FULL_STUDENT.billing);
    expect(result.invoices).toHaveLength(1);
    expect(result.payments).toHaveLength(1);
    expect(result.demographics.medicalNotes).toBe('Asthma — keep inhaler on file');
    expect(result.compliance.nationalId).toBe('GHA-123456789-0');
  });

  it('returns full student payload for STAFF and ACCOUNTANT', () => {
    for (const role of ['STAFF', 'ACCOUNTANT'] as const) {
      const result = toStudentDtoForRole(FULL_STUDENT, role);
      expect(result.billing).toBeDefined();
      expect(result.compliance.nationalId).toBe('GHA-123456789-0');
    }
  });

  it('strips medical, national ID, and finance fields for FACULTY', () => {
    const result = toStudentDtoForRole(FULL_STUDENT, 'FACULTY');

    expect(result.studentName).toBe('Ama Mensah');
    expect(result.placement).toEqual(FULL_STUDENT.placement);
    expect(result.guardians).toEqual(FULL_STUDENT.guardians);
    expect(result.demographics.gender).toBe('Female');
    expect(result.demographics).not.toHaveProperty('medicalNotes');
    expect(result.compliance).not.toHaveProperty('nationalId');
    expect(result.compliance.emergencyName).toBe('Kofi Mensah');
    expect(result).not.toHaveProperty('billing');
    expect(result).not.toHaveProperty('invoices');
    expect(result).not.toHaveProperty('payments');
    expect(result).not.toHaveProperty('departures');
  });

  it('does not mutate the original student object', () => {
    const copy = structuredClone(FULL_STUDENT);
    toStudentDtoForRole(copy, 'FACULTY');
    expect(copy.billing).toBeDefined();
    expect(copy.demographics.medicalNotes).toBeDefined();
    expect(copy.compliance.nationalId).toBeDefined();
  });

  it('maps lists through the same projection', () => {
    const list = toStudentListDtoForRole([FULL_STUDENT], 'FACULTY');
    expect(list).toHaveLength(1);
    expect(list[0]).not.toHaveProperty('billing');
  });
});

describe('toTeacherDtoForRole', () => {
  it('returns full teacher payload for ADMIN', () => {
    const result = toTeacherDtoForRole(FULL_TEACHER, 'ADMIN');
    expect(result.payroll.baseSalary).toBe(4500);
    expect(result.payroll.bankAccount).toBe('1234567890123');
    expect(result.compliance.nationalId).toBe('GHA-987654321-0');
    expect(result.compliance.ssnitNumber).toBe('C123456789012');
  });

  it('redacts payroll, bank, national ID, SSNIT, and emergency PII for FACULTY', () => {
    const result = toTeacherDtoForRole(FULL_TEACHER, 'FACULTY');

    expect(result.teacherName).toBe('Yaw Boateng');
    expect(result.placement.jobTitle).toBe('Physics');
    expect(result.demographics.phone).toBe('0241111111');

    expect(result.compliance.nationalId).toBeNull();
    expect(result.compliance.ssnitNumber).toBeNull();
    expect(result.compliance.emergencyName).toBeNull();
    expect(result.compliance.emergencyPhone).toBeNull();

    expect(result.payroll.baseSalary).toBeNull();
    expect(result.payroll.deductions).toBeNull();
    expect(result.payroll.netPay).toBeNull();
    expect(result.payroll.bankName).toBeNull();
    expect(result.payroll.bankAccount).toBeNull();
    expect(result.payroll.salaryStatus).toBeNull();

    expect(result).not.toHaveProperty('departures');
  });

  it('does not mutate the original teacher object', () => {
    const copy = structuredClone(FULL_TEACHER);
    toTeacherDtoForRole(copy, 'FACULTY');
    expect(copy.payroll.baseSalary).toBe(4500);
    expect(copy.compliance.nationalId).toBe('GHA-987654321-0');
  });

  it('maps teacher lists through the same projection', () => {
    const list = toTeacherListDtoForRole([FULL_TEACHER], 'FACULTY');
    expect(list[0]!.payroll.bankAccount).toBeNull();
  });
});
