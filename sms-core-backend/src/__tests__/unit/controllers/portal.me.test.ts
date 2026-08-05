/* eslint-disable @typescript-eslint/no-explicit-any -- controller/service test doubles */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/prisma', () => ({
  prisma: {
    student: { findUnique: vi.fn() },
    timetableConfiguration: { findUnique: vi.fn() },
    teacher: { findMany: vi.fn() },
  },
}));

import { prisma } from '@/lib/prisma';
import { StudentController } from '@/modules/students/student.controller';
import { GradesController } from '@/modules/grades/grades.controller';
import { AttendanceController } from '@/modules/attendance/attendance.controller';
import { TimetableController } from '@/modules/timetable/timetable.controller';
import { StudentService } from '@/modules/students/student.service';
import { TimetableService } from '@/modules/timetable/timetable.service';
import { JwtPayload } from '@/types/auth.types';

const studentSession = (): JwtPayload => ({
  sub: 'acc-stu-1',
  email: 'student001@horizon.local',
  role: 'STUDENT',
  entityType: 'STUDENT',
  entityInternalId: 'stu-internal-1',
});

const facultySession = (): JwtPayload => ({
  sub: 'acc-tch-1',
  email: 'faculty01@horizon.local',
  role: 'FACULTY',
  entityType: 'TEACHER',
  entityInternalId: 'tch-internal-1',
});

function mockRes() {
  const res: any = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  return res;
}

/** A request carrying attacker-controlled spoof attempts in params AND query. */
function spoofedReq(user: JwtPayload): any {
  return {
    user,
    params: { studentId: 'stu-OTHER', id: 'stu-OTHER' },
    query: { studentId: 'stu-OTHER' },
  };
}

describe('SMS-005 /me controllers — session-resolved identity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('students/me calls the service with the session id, ignoring spoofed params', async () => {
    const service: any = { getOwnProfile: vi.fn().mockResolvedValue({ studentName: 'Ama' }) };
    const controller = new StudentController(service);
    const res = mockRes();
    const next = vi.fn();

    await controller.getOwnProfile(spoofedReq(studentSession()), res, next);

    expect(service.getOwnProfile).toHaveBeenCalledWith('stu-internal-1');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(next).not.toHaveBeenCalled();
  });

  it('grades/me resolves the gradebook via the session id only', async () => {
    const service: any = { getStudentGradebook: vi.fn().mockResolvedValue({ records: [] }) };
    const controller = new GradesController(service);
    const res = mockRes();
    const next = vi.fn();

    await controller.getOwnGradebook(spoofedReq(studentSession()), res, next);

    expect(service.getStudentGradebook).toHaveBeenCalledWith('stu-internal-1', undefined);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('attendance/me resolves history via the session id only', async () => {
    const service: any = {
      getStudentHistory: vi.fn().mockResolvedValue({ records: [], summary: {} }),
    };
    const controller = new AttendanceController(service);
    const res = mockRes();
    const next = vi.fn();

    await controller.getOwnHistory(spoofedReq(studentSession()), res, next);

    expect(service.getStudentHistory).toHaveBeenCalledWith('stu-internal-1', {
      from: undefined,
      to: undefined,
      limit: 50,
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('timetable/me resolves the schedule via the session id only', async () => {
    const service: any = { getOwnTimetable: vi.fn().mockResolvedValue({ class: { name: 'JHS 1' } }) };
    const controller = new TimetableController(service);
    const res = mockRes();
    const next = vi.fn();

    await controller.getOwnTimetable(spoofedReq(studentSession()), res, next);

    expect(service.getOwnTimetable).toHaveBeenCalledWith('stu-internal-1');
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('non-student sessions are rejected with 403 on all four handlers', async () => {
    const studentCtrl = new StudentController({ getOwnProfile: vi.fn() } as any);
    const gradesCtrl = new GradesController({ getStudentGradebook: vi.fn() } as any);
    const attendanceCtrl = new AttendanceController({ getStudentHistory: vi.fn() } as any);
    const timetableCtrl = new TimetableController({ getOwnTimetable: vi.fn() } as any);

    const handlers = [
      (n: any) => studentCtrl.getOwnProfile(spoofedReq(facultySession()), mockRes(), n),
      (n: any) => gradesCtrl.getOwnGradebook(spoofedReq(facultySession()), mockRes(), n),
      (n: any) => attendanceCtrl.getOwnHistory(spoofedReq(facultySession()), mockRes(), n),
      (n: any) => timetableCtrl.getOwnTimetable(spoofedReq(facultySession()), mockRes(), n),
    ];

    for (const invoke of handlers) {
      const next = vi.fn();
      await invoke(next);
      expect(next).toHaveBeenCalledTimes(1);
      expect(next.mock.calls[0]?.[0]).toMatchObject({ statusCode: 403 });
    }
  });
});

describe('StudentService.getOwnProfile (SMS-005)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns the portal-shaped DTO for the session student', async () => {
    (prisma.student.findUnique as any).mockResolvedValue({
      id: 'stu-internal-1',
      studentId: 'S001',
      studentName: 'Ama Serwaa',
      enrollmentDate: new Date('2025-09-01'),
      status: 'ACTIVE',
      currentGpa: 3.21,
      attendanceRate: 96.4,
      placement: {
        academicTrack: 'General',
        boardingStatus: 'DAY',
        class: { id: 'class-1', name: 'JHS 1', section: 'A' },
      },
      demographics: { dateOfBirth: new Date('2012-05-04'), gender: 'F' },
      guardians: [{ name: 'Mum Serwaa', relationship: 'Mother', phone: '0244000000', email: null }],
    });

    const service = new StudentService({} as any);
    const profile = await service.getOwnProfile('stu-internal-1');

    expect(prisma.student.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 'stu-internal-1' } }),
    );
    expect(profile.studentName).toBe('Ama Serwaa');
    expect(profile.currentGpa).toBeCloseTo(3.21);
    expect(profile.attendanceRate).toBeCloseTo(96.4);
    expect(profile.guardians).toHaveLength(1);
  });

  it('throws 404 when the student does not exist', async () => {
    (prisma.student.findUnique as any).mockResolvedValue(null);
    const service = new StudentService({} as any);
    await expect(service.getOwnProfile('nope')).rejects.toMatchObject({ statusCode: 404 });
  });
});

describe('TimetableService.getOwnTimetable (SMS-005)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('maps the class configuration with teacher names resolved in batch', async () => {
    (prisma.student.findUnique as any).mockResolvedValue({
      studentName: 'Ama',
      placement: { classId: 'class-1', class: { id: 'class-1', name: 'JHS 1' } },
    });
    (prisma.timetableConfiguration.findUnique as any).mockResolvedValue({
      periodsCount: 2,
      periods: [
        { periodNumber: 1, dayOfWeek: null, startTime: '08:00', endTime: '08:45' },
        { periodNumber: 2, dayOfWeek: null, startTime: '08:45', endTime: '09:30' },
      ],
      breaks: [{ name: 'Break', dayOfWeek: null, startTime: '10:15', endTime: '10:35' }],
      subjects: [
        { subjectName: 'Mathematics', teacherId: 'tch-1', dayOfWeek: null },
        { subjectName: 'English', teacherId: 'tch-2', dayOfWeek: null },
      ],
    });
    (prisma.teacher.findMany as any).mockResolvedValue([
      { id: 'tch-1', teacherName: 'Teacher X' },
      { id: 'tch-2', teacherName: 'Teacher Y' },
    ]);

    const service = new TimetableService({} as any);
    const result = await service.getOwnTimetable('stu-internal-1');

    expect(prisma.timetableConfiguration.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { sectionId: 'class-1' } }),
    );
    expect(result.class.name).toBe('JHS 1');
    expect(result.timetable!.periodsCount).toBe(2);
    expect(result.timetable!.periods).toHaveLength(2);
    expect(result.timetable!.periods[0]!.periodNumber).toBe(1);
    expect(result.timetable!.breaks).toHaveLength(1);
    expect(result.timetable!.subjects[0]).toMatchObject({
      subjectName: 'Mathematics',
      teacherName: 'Teacher X',
    });
    expect(result.timetable!.subjects[1]).toMatchObject({
      subjectName: 'English',
      teacherName: 'Teacher Y',
    });
  });

  it('returns timetable: null when the class has no configuration yet', async () => {
    (prisma.student.findUnique as any).mockResolvedValue({
      studentName: 'Ama',
      placement: { classId: 'class-1', class: { id: 'class-1', name: 'JHS 1' } },
    });
    (prisma.timetableConfiguration.findUnique as any).mockResolvedValue(null);

    const service = new TimetableService({} as any);
    const result = await service.getOwnTimetable('stu-internal-1');

    expect(result.class.name).toBe('JHS 1');
    expect(result.timetable).toBeNull();
  });

  it('throws 404 when the student has no class placement', async () => {
    (prisma.student.findUnique as any).mockResolvedValue({
      studentName: 'Ama',
      placement: null,
    });

    const service = new TimetableService({} as any);
    await expect(service.getOwnTimetable('stu-internal-1')).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});
