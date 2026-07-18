import {
  TimetableConfiguration,
  TimetablePeriod,
  TimetableBreak,
  SubjectAllocation,
} from "@prisma/client";
import { ITimetableRepository } from "@/types/repositories";
import { TimetableRepository } from "./timetable.repository";
import { prisma } from "@/lib/prisma";

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

  async replaceGlobalMatrix(
    matrixData: Record<string, SectionTimeMatrix>
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      for (const [sectionId, data] of Object.entries(matrixData)) {
        await this.repo.replaceSectionConfig(sectionId, data, tx);
      }
    });
  }
}
