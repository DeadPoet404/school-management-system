/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import app from '@/app';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/utils/hash';
import {
  studentEnrollmentSchema,
  teacherEnrollmentSchema,
  staffEnrollmentSchema,
} from '@/types/registry.types';
import {
  saveFeeMatrixSchema,
  commitInflowSchema,
  generateInvoicesSchema,
} from '@/modules/finance/finance.validation';
import { submitSectionAttendanceSchema } from '@/modules/attendance/attendance.validation';
import { submitMarkSchema } from '@/modules/grades/grades.validation';

const request = supertest(app);

function getCookieString(res: any): string {
  const cookies = res.headers['set-cookie'];
  if (!cookies) return '';
  const arr = Array.isArray(cookies) ? cookies : [cookies];
  return arr.map((c: string) => c.split(';')[0]).join('; ');
}

describe('Release-Representative Real-DB Workflows (SMS-010)', () => {
  let isDbAvailable = false;
  let adminCookie = '';
  let facultyCookie = '';
  let studentCookie = '';

  let testClassId = '';
  let testDeptId = '';
  let testFeeTierId = '';
  let testTermId = '';
  let testSubjectId = '';
  let testStudentId = '';

  beforeAll(async () => {
    try {
      await prisma.$connect();
      await prisma.$queryRaw`SELECT 1`;
      isDbAvailable = true;
    } catch {
      console.warn('Real DB not available — skipping workflow assertions');
      return;
    }

    const staleClass = await prisma.class.findUnique({ where: { name: 'E2E Class 1A' } });
    if (staleClass) {
      const staleConfigs = await prisma.timetableConfiguration.findMany({
        where: { sectionId: staleClass.id }, select: { id: true },
      });
      const staleConfigIds = staleConfigs.map((c) => c.id);
      if (staleConfigIds.length > 0) {
        await prisma.subjectAllocation.deleteMany({ where: { configurationId: { in: staleConfigIds } } });
        await prisma.timetablePeriod.deleteMany({ where: { configurationId: { in: staleConfigIds } } });
        await prisma.timetableConfiguration.deleteMany({ where: { id: { in: staleConfigIds } } });
      }
    }
    await prisma.teacherAccount.deleteMany({ where: { email: { contains: '.e2e@sms.local' } } });
    await prisma.teacher.deleteMany({ where: { email: { contains: '.e2e@sms.local' } } });
    await prisma.staffAccount.deleteMany({ where: { email: { contains: '.e2e@sms.local' } } });
    await prisma.studentAccount.deleteMany({ where: { portalEmail: { contains: '.e2e@sms.local' } } });

    const testClass = await prisma.class.upsert({
      where: { name: 'E2E Class 1A' },
      update: {},
      create: { name: 'E2E Class 1A', section: 'A' },
    });
    testClassId = testClass.id;

    const testDept = await prisma.department.upsert({
      where: { code: 'E2E_SCI' },
      update: {},
      create: { name: 'E2E Science', code: 'E2E_SCI' },
    });
    testDeptId = testDept.id;

    const testFeeTier = await prisma.feeTier.upsert({
      where: { code: 'E2E_DAY' },
      update: {},
      create: { name: 'E2E Day Student', code: 'E2E_DAY', amount: 4800 },
    });
    testFeeTierId = testFeeTier.id;

    const testTerm = await prisma.term.upsert({
      where: { name: 'E2E Term 1' },
      update: {},
      create: {
        name: 'E2E Term 1',
        academicYear: '2025/2026',
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-04-01'),
      },
    });
    testTermId = testTerm.id;

    const testSubject = await prisma.subject.upsert({
      where: { code: 'E2E_MATH' },
      update: {},
      create: {
        name: 'E2E Math',
        code: 'E2E_MATH',
      },
    });
    testSubjectId = testSubject.id;

    const adminHash = await hashPassword('AdminDev2026!');
    await prisma.staff.upsert({
      where: { staffId: 'STF-E2E-ADMIN' },
      update: {},
      create: {
        staffId: 'STF-E2E-ADMIN',
        staffName: 'E2E Admin Staff',
        appointmentDate: new Date('2026-01-01'),
        status: 'ACTIVE',
        account: {
          create: {
            email: 'admin.e2e@sms.local',
            passwordHash: adminHash,
            role: 'ADMIN',
          },
        },
      },
    });

    const facultyHash = await hashPassword('FacultyDev2026!');
    const testFaculty = await prisma.teacher.upsert({
      where: { teacherId: 'TCH-E2E-FACULTY' },
      update: {},
      create: {
        teacherId: 'TCH-E2E-FACULTY',
        teacherName: 'E2E Faculty Teacher',
        email: 'faculty.e2e@sms.local',
        employmentType: 'FULL_TIME',
        status: 'ACTIVE',
        account: {
          create: {
            email: 'faculty.e2e@sms.local',
            passwordHash: facultyHash,
            role: 'FACULTY',
          },
        },
      },
    });

    await prisma.timetableConfiguration.upsert({
      where: { sectionId: testClass.id },
      update: {},
      create: {
        sectionId: testClass.id,
        periodsCount: 1,
        periods: {
          create: [
            {
              periodNumber: 1,
              dayOfWeek: 'MONDAY',
              startTime: '08:00',
              endTime: '08:45',
            },
          ],
        },
        subjects: {
          create: [
            {
              subjectName: testSubject.name,
              teacherId: testFaculty.id,
              dayOfWeek: 'MONDAY',
            },
          ],
        },
      },
    });



    const studentHash = await hashPassword('StudentDev2026!');
    const testStudent = await prisma.student.upsert({
      where: { studentId: 'STD-E2E-STUDENT' },
      update: {},
      create: {
        studentId: 'STD-E2E-STUDENT',
        studentName: 'E2E Student Test',
        enrollmentDate: new Date('2026-01-01'),
        status: 'ACTIVE',
        placement: {
          create: {
            classId: testClass.id,
            academicTrack: 'GENERAL_SCIENCE',
            boardingStatus: 'DAY_STUDENT',
          },
        },
        billing: {
          create: {
            feeTierId: testFeeTier.id,
            initialDeposit: 100,
            currentBalance: 0,
          },
        },
        demographics: {
          create: {
            gender: 'FEMALE',
            dateOfBirth: new Date('2010-01-01'),
            residentialAddress: '123 E2E Street',
          },
        },
        account: {
          create: {
            portalEmail: 'student.e2e@sms.local',
            passwordHash: studentHash,
          },
        },
      },
    });
    testStudentId = testStudent.id;
  });

  afterAll(async () => {
    if (isDbAvailable) {
      await prisma.studentAccount.deleteMany({ where: { portalEmail: { contains: '.e2e@sms.local' } } });
      await prisma.teacherAccount.deleteMany({ where: { email: { contains: '.e2e@sms.local' } } });
      await prisma.staffAccount.deleteMany({ where: { email: { contains: '.e2e@sms.local' } } });
      await prisma.student.deleteMany({ where: { studentId: { startsWith: 'STD-E2E-' } } });
      await prisma.teacher.deleteMany({ where: { email: { contains: '.e2e@sms.local' } } });
      await prisma.staff.deleteMany({ where: { staffId: { startsWith: 'STF-E2E-' } } });
      if (testClassId) {
        const configs = await prisma.timetableConfiguration.findMany({
          where: { sectionId: testClassId }, select: { id: true },
        });
        const configIds = configs.map((c) => c.id);
        if (configIds.length > 0) {
          await prisma.subjectAllocation.deleteMany({ where: { configurationId: { in: configIds } } });
          await prisma.timetablePeriod.deleteMany({ where: { configurationId: { in: configIds } } });
          await prisma.timetableConfiguration.deleteMany({ where: { id: { in: configIds } } });
        }
      }
      await prisma.$disconnect();
    }
  });

  describe('1. Auth Workflow (login, me, refresh, logout)', () => {
    it('POST /api/auth/login authenticates ADMIN and sets cookies', async () => {
      if (!isDbAvailable) return;
      const res = await request.post('/api/auth/login').send({
        email: 'admin.e2e@sms.local',
        password: 'AdminDev2026!',
      });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user.role).toBe('ADMIN');
      adminCookie = getCookieString(res);
      expect(adminCookie.length).toBeGreaterThan(0);
    });

    it('GET /api/auth/me returns current authenticated user', async () => {
      if (!isDbAvailable) return;
      const res = await request.get('/api/auth/me').set('Cookie', adminCookie);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      // GET /api/auth/me responds with { success, data: { user: {...} } }
      expect(res.body.data.user.email).toBe('admin.e2e@sms.local');
    });

    it('POST /api/auth/refresh rotates tokens', async () => {
      if (!isDbAvailable) return;
      const res = await request.post('/api/auth/refresh').set('Cookie', adminCookie);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      if (res.headers['set-cookie']) {
        adminCookie = getCookieString(res);
      }
    });

    it('POST /api/auth/login authenticates FACULTY', async () => {
      if (!isDbAvailable) return;
      const res = await request.post('/api/auth/login').send({
        email: 'faculty.e2e@sms.local',
        password: 'FacultyDev2026!',
      });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      facultyCookie = getCookieString(res);
    });

    it('POST /api/auth/login authenticates STUDENT', async () => {
      if (!isDbAvailable) return;
      const res = await request.post('/api/auth/login').send({
        email: 'student.e2e@sms.local',
        password: 'StudentDev2026!',
      });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      studentCookie = getCookieString(res);
    });
  });

  describe('2. Onboarding Workflows (student add, teacher add, staff add)', () => {
    it('POST /api/students enrolls a new student', async () => {
      if (!isDbAvailable) return;
      const payload = studentEnrollmentSchema.parse({
        account: {
          fullName: 'New E2E Student',
          email: 'new.student.e2e@sms.local',
          password: 'Password123!',
          enrollmentDate: '2026-01-15',
        },
        demographics: {
          dateOfBirth: '2012-05-10',
          gender: 'Female',
          residentialAddress: '123 E2E Street',
          medicalNotes: null,
          bloodType: null,
          religion: null,
          formerSchool: null,
          nationalId: null,
        },
        placement: {
          classId: testClassId,
          academicTrack: 'GENERAL_SCIENCE',
          boardingStatus: 'DAY',
        },
        compliance: {
          nationalId: null,
          emergencyContact: { name: null, phone: null, relationship: null },
        },
        guardian: {
          name: 'E2E Guardian',
          relationship: 'Mother',
          phone: '0240000000',
          email: null,
        },
        billing: {
          feeTierId: testFeeTierId,
          initialDeposit: 100,
        },
      });
      const res = await request.post('/api/students').set('Cookie', adminCookie).send(payload);
      expect([200, 201]).toContain(res.status);
      expect(res.body.success).toBe(true);
      const inDb = await prisma.studentAccount.findUnique({ where: { portalEmail: 'new.student.e2e@sms.local' } });
      expect(inDb).not.toBeNull();
    });

    it('POST /api/teachers enrolls a new teacher', async () => {
      if (!isDbAvailable) return;
      const payload = teacherEnrollmentSchema.parse({
        account: {
          fullName: 'New E2E Teacher',
          email: 'new.teacher.e2e@sms.local',
          password: 'Password123!',
          employmentDate: '2026-01-15',
        },
        demographics: {
          dateOfBirth: '1985-05-10',
          gender: 'Male',
          residentialAddress: '456 Teacher Street',
          phone: '0241111111',
          bloodType: null,
          religion: null,
          formerSchool: null,
        },
        placement: {
          departmentId: testDeptId,
          jobTitle: 'Senior Teacher',
          employmentType: 'FULL_TIME',
        },
        compliance: {
          nationalId: 'GHA-123456789-0',
          ssnitNumber: 'C123456789',
          emergencyContact: { name: 'Emergency Teacher', phone: '0242222222' },
        },
        payroll: {
          clearanceTier: 'TIER_1',
          baseSalary: 4000,
          bankName: 'Test Bank',
          bankAccount: '1234567890',
        },
      });
      const res = await request.post('/api/teachers').set('Cookie', adminCookie).send(payload);
      expect([200, 201]).toContain(res.status);
      expect(res.body.success).toBe(true);
      const inDb = await prisma.teacherAccount.findUnique({ where: { email: 'new.teacher.e2e@sms.local' } });
      expect(inDb).not.toBeNull();
    });

    it('POST /api/staff enrolls a new staff member', async () => {
      if (!isDbAvailable) return;
      const payload = staffEnrollmentSchema.parse({
        account: {
          fullName: 'New E2E Staff',
          email: 'new.staff.e2e@sms.local',
          password: 'Password123!',
          employmentDate: '2026-01-15',
          role: 'STAFF',
        },
        demographics: {
          dateOfBirth: '1990-05-10',
          gender: 'Female',
          residentialAddress: '789 Staff Street',
          phone: '0243333333',
          bloodType: null,
          religion: null,
          formerSchool: null,
        },
        placement: {
          departmentId: testDeptId,
          jobTitle: 'Administrative Assistant',
          employmentType: 'FULL_TIME',
          shiftSchedule: 'DAY_SHIFT',
        },
        compliance: {
          nationalId: 'GHA-987654321-0',
          ssnitNumber: 'S987654321',
          emergencyContact: { name: null, phone: null, relationship: null },
        },
        payroll: {
          clearanceTier: 'TIER_2',
          baseSalary: 2500,
          deductions: 200,
          netPay: 2300,
          paymentRoute: 'BANK_TRANSFER',
          bankName: 'Test Bank',
          bankAccount: '0987654321',
        },
      });
      const res = await request.post('/api/staff').set('Cookie', adminCookie).send(payload);
      expect([200, 201]).toContain(res.status);
      expect(res.body.success).toBe(true);
      const inDb = await prisma.staffAccount.findUnique({ where: { email: 'new.staff.e2e@sms.local' } });
      expect(inDb).not.toBeNull();
    });
  });

  describe('3. Authorization Workflows (attendance authorization, grade authorization)', () => {
    it('POST /api/attendance/section rejects ADMIN (FACULTY-only)', async () => {
      if (!isDbAvailable) return;
      const res = await request.post('/api/attendance/section').set('Cookie', adminCookie).send({
        date: '2026-01-20',
        classId: testClassId,
        records: [{ studentId: testStudentId, status: 'PRESENT' }],
      });
      expect(res.status).toBe(403);
    });

    it('POST /api/grades/submit rejects ADMIN (FACULTY-only)', async () => {
      if (!isDbAvailable) return;
      const res = await request.post('/api/grades/submit').set('Cookie', adminCookie).send({
        studentId: testStudentId,
        subjectId: testSubjectId,
        classId: testClassId,
        termId: testTermId,
        continuousAssessment: 25,
        examination: 65,
      });
      expect(res.status).toBe(403);
    });

    it('POST /api/attendance/section allows assigned FACULTY', async () => {
      if (!isDbAvailable) return;
      const payload = submitSectionAttendanceSchema.parse({
        date: '2026-01-20',
        classId: testClassId,
        records: [{ studentId: testStudentId, status: 'PRESENT' }],
      });
      const res = await request.post('/api/attendance/section').set('Cookie', facultyCookie).send(payload);
      expect([200, 201]).toContain(res.status);
    });

    it('POST /api/grades/submit allows assigned FACULTY', async () => {
      if (!isDbAvailable) return;
      const payload = submitMarkSchema.parse({
        studentId: testStudentId,
        subjectId: testSubjectId,
        classId: testClassId,
        termId: testTermId,
        continuousAssessment: 25,
        examination: 65,
      });
      const res = await request.post('/api/grades/submit').set('Cookie', facultyCookie).send(payload);
      expect([200, 201]).toContain(res.status);
    });
  });

  describe('4. Finance Workflow (fee matrix, generate invoices, collection happy path)', () => {
    it('POST /api/finance/fee-structures saves fee matrix', async () => {
      if (!isDbAvailable) return;
      const payload = saveFeeMatrixSchema.parse({
        data: {
          [testClassId]: {
            components: [
              { name: 'Tuition', amount: 1000, frequency: 'TERM', isMandatory: true },
            ],
            billingConfig: {
              issueDate: '2026-01-01',
              dueDate: '2026-02-01',
              allowInstallments: true,
              lateFeeRate: 5,
            },
          },
        },
      });
      const res = await request.post('/api/finance/fee-structures').set('Cookie', adminCookie).send(payload);
      expect([200, 201]).toContain(res.status);
      expect(res.body.success).toBe(true);
    });

    it('POST /api/finance/generate-invoices generates invoices for class', async () => {
      if (!isDbAvailable) return;
      const payload = generateInvoicesSchema.parse({
        sectionId: testClassId,
      });
      const res = await request.post('/api/finance/generate-invoices').set('Cookie', adminCookie).send(payload);
      expect([200, 201]).toContain(res.status);
      expect(res.body.success).toBe(true);
    });

    it('POST /api/finance/collections commits payment inflow', async () => {
      if (!isDbAvailable) return;
      const payload = commitInflowSchema.parse({
        sectionId: testClassId,
        studentName: 'E2E Student Test',
        amountPaid: 500,
        paymentMethod: 'CASH',
        referenceNo: 'REF-E2E-001',
        allocationTarget: 'Tuition',
        studentInternalId: testStudentId,
      });
      const res = await request.post('/api/finance/collections').set('Cookie', adminCookie).send(payload);
      expect([200, 201]).toContain(res.status);
      expect(res.body.success).toBe(true);
    });
  });

  describe('5. Protected Route Behavior and Logout', () => {
    it('GET /api/students returns 401 without cookie', async () => {
      const res = await request.get('/api/students');
      expect(res.status).toBe(401);
    });

    it('GET /api/finance/invoices returns 403 for STUDENT role', async () => {
      if (!isDbAvailable) return;
      const res = await request.get('/api/finance/invoices').set('Cookie', studentCookie);
      expect(res.status).toBe(403);
    });

    it('POST /api/auth/logout invalidates session', async () => {
      if (!isDbAvailable) return;
      const res = await request.post('/api/auth/logout').set('Cookie', adminCookie);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });
});