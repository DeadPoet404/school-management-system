import {
  TimetableConfiguration,
  TimetablePeriod,
  TimetableBreak,
  SubjectAllocation,
} from "@prisma/client";
import { ITimetableRepository } from "@/types/repositories";
import { TimetableRepository } from "./timetable.repository";
import { prisma } from "@/lib/prisma";
import { AppError } from "@/middleware/error.handler";

export interface SectionTimeMatrix {
  periodsCount: number;
  periods: { startTime: string; endTime: string }[];
  breaks: { id: string; name: string; startTime: string; endTime: string }[];
  subjects: { id: string; subjectName: string; teacherId: string }[];
}

export class TimetableService {
  constructor(private repo: ITimetableRepository = new TimetableRepository()) {}

  async getGlobalMatrix(): Promise<Record<string, SectionTimeMatrix>> {
    const records = await this.repo.findAllConfigurations();

    const matrix: Record<string, SectionTimeMatrix> = {};

    records.forEach(
      (
        rec: TimetableConfiguration & {
          periods: TimetablePeriod[];
          breaks: TimetableBreak[];
          subjects: SubjectAllocation[];
        }
      ) => {
        matrix[rec.sectionId] = {
          periodsCount: rec.periodsCount,
          periods: rec.periods.map((p: TimetablePeriod) => ({
            startTime: p.startTime,
            endTime: p.endTime,
          })),
          breaks: rec.breaks.map((b: TimetableBreak) => ({
            id: b.id,
            name: b.name,
            startTime: b.startTime,
            endTime: b.endTime,
          })),
          subjects: rec.subjects.map((s: SubjectAllocation) => ({
            id: s.id,
            subjectName: s.subjectName,
            teacherId: s.teacherId,
          })),
        };
      }
    );

    return matrix;
  }

  /**
   * SMS-005: The session student's class schedule for the portal.
   * Placement -> TimetableConfiguration (sectionId == Class.id, canonical).
   * Teacher names are resolved in one batched lookup. When the class has no
   * configuration yet, `timetable` is null rather than an error -- the portal
   * can render an empty state.
   */
  async getOwnTimetable(studentId: string) {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: {
        studentName: true,
        placement: {
          select: {
            classId: true,
            class: { select: { id: true, name: true } },
          },
        },
      },
    });

    if (!student) throw new AppError(404, 'Student not found.');

    const classInfo = student.placement?.class ?? null;
    if (!student.placement?.classId || !classInfo) {
      throw new AppError(404, 'No class placement found for this student.');
    }

    const config = await prisma.timetableConfiguration.findUnique({
      where: { sectionId: student.placement.classId },
      include: {
        periods: { orderBy: { periodNumber: 'asc' } },
        breaks: true,
        subjects: true,
      },
    });

    if (!config) {
      return { class: classInfo, timetable: null };
    }

    // Batch-resolve teacher names for the subject allocations.
    const teacherIds = [...new Set(config.subjects.map((s) => s.teacherId))];
    const teachers = await prisma.teacher.findMany({
      where: { id: { in: teacherIds } },
      select: { id: true, teacherName: true },
    });
    const teacherNameById = new Map(teachers.map((t) => [t.id, t.teacherName]));

    return {
      class: classInfo,
      timetable: {
        periodsCount: config.periodsCount,
        periods: config.periods.map((p) => ({
          periodNumber: p.periodNumber,
          dayOfWeek: p.dayOfWeek,
          startTime: p.startTime,
          endTime: p.endTime,
        })),
        breaks: config.breaks.map((b) => ({
          name: b.name,
          dayOfWeek: b.dayOfWeek,
          startTime: b.startTime,
          endTime: b.endTime,
        })),
        subjects: config.subjects.map((s) => ({
          subjectName: s.subjectName,
          teacherName: teacherNameById.get(s.teacherId) ?? null,
          dayOfWeek: s.dayOfWeek,
        })),
      },
    };
  }

  /**
   * SMS-010: feed projection for one class (option A mapping — the app
   * matrix is an unslotted weekday template, so subjects round-robin
   * into period slots and every event recurs MO-FR until term end).
   */
  async getCalendarEventsForClass(classId: string) {
    const classRow = await prisma.class.findUnique({
      where: { id: classId },
      select: { id: true, name: true, section: true, deletedAt: true },
    });
    if (!classRow || classRow.deletedAt) throw new AppError(404, `Class not found: ${classId}`);

    const config = await prisma.timetableConfiguration.findUnique({
      where: { sectionId: classId },
      include: {
        periods: { orderBy: { periodNumber: 'asc' } },
        breaks: { orderBy: { startTime: 'asc' } },
        subjects: { orderBy: { subjectName: 'asc' } },
      },
    });
    if (!config) throw new AppError(404, `No timetable configured for class ${classRow.name}.`);

    const activeTerm = await prisma.term.findFirst({
      where: { isActive: true, deletedAt: null },
      orderBy: { startDate: 'desc' },
    });
    const termStart = activeTerm?.startDate ?? new Date();
    const termEnd = activeTerm?.endDate ?? new Date(termStart.getTime() + 90 * 86400000);

    const teacherIds = [...new Set(config.subjects.map((s) => s.teacherId))];
    const teachers = await prisma.teacher.findMany({
      where: { id: { in: teacherIds } },
      select: { id: true, teacherName: true },
    });
    const teacherNames = new Map(teachers.map((t) => [t.id, t.teacherName]));

    const events = config.periods.map((period, index) => {
      const subject = config.subjects.length > 0 ? config.subjects[index % config.subjects.length]! : null;
      const teacher = subject ? teacherNames.get(subject.teacherId) : null;
      return {
        summary: subject
          ? `${subject.subjectName}${teacher ? ` — ${teacher}` : ''} (P${period.periodNumber})`
          : `Period ${period.periodNumber}`,
        description: `${classRow.name} timetable period ${period.periodNumber} — generated class feed`,
        startHHmm: period.startTime,
        endHHmm: period.endTime,
      };
    });
    for (const b of config.breaks) {
      events.push({ summary: `Break — ${b.name}`, description: 'Scheduled break', startHHmm: b.startTime, endHHmm: b.endTime });
    }

    const classLabel = `${classRow.name}${classRow.section ? ` — Section ${classRow.section}` : ''}`;
    return { calendarName: `SMS Timetable — ${classLabel}`, events, termStart, termEnd };
  }

  async replaceGlobalMatrix(
    matrixData: Record<string, SectionTimeMatrix>
  ): Promise<void> {
    const sectionIds = Object.keys(matrixData);
    if (sectionIds.length > 0) {
      const existing = await prisma.class.findMany({
        where: { id: { in: sectionIds }, deletedAt: null },
        select: { id: true },
      });
      const existingSet = new Set(existing.map((c) => c.id));
      const unknown = sectionIds.filter((id) => !existingSet.has(id));
      if (unknown.length > 0) {
        throw new AppError(
          400,
          `Unknown class id(s) in timetable matrix (sectionId must equal Class.id): ${unknown.join(', ')}`,
        );
      }
    }

    await prisma.$transaction(async (tx) => {
      for (const [sectionId, data] of Object.entries(matrixData)) {
        await this.repo.replaceSectionConfig(sectionId, data, tx);
      }
    });
  }
}
