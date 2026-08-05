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
