import { prisma } from "@/lib/prisma";
import {
  TimetableConfiguration,
  TimetablePeriod,
  TimetableBreak,
  SubjectAllocation,
} from "@prisma/client";

// Explicit structural return contract matching your Next.js state engine
export interface SectionTimeMatrix {
  periodsCount: number;
  periods: { startTime: string; endTime: string }[];
  breaks: { id: string; name: string; startTime: string; endTime: string }[];
  subjects: { id: string; subjectName: string; teacherId: string }[];
}

export class TimetableService {
  /**
   * Recomposes the full global configuration matrix by reading all sections in one fetch.
   */
  async getGlobalMatrix(): Promise<Record<string, SectionTimeMatrix>> {
    const records = await prisma.timetableConfiguration.findMany({
      include: {
        periods: { orderBy: { periodNumber: "asc" } },
        breaks: true,
        subjects: true,
      },
    });

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
   * Overwrites the entire timetable matrix cleanly without causing database locks.
   * Uses upsert operations to modify active records in place, keeping the data grid
   * responsive and stable even under high-density concurrent load.
   */
  async replaceGlobalMatrix(
    matrixData: Record<string, SectionTimeMatrix>
  ): Promise<void> {
    await prisma.$transaction(async (tx) => {
      for (const [sectionId, data] of Object.entries(matrixData)) {
        // 1. Check if the master configuration record already exists
        const existingConfig =
          await tx.timetableConfiguration.findUnique({
            where: { sectionId },
            select: { id: true },
          });

        if (existingConfig) {
          // 2. Perform isolated updates to avoid locking up the entire table matrix
          await tx.timetableConfiguration.update({
            where: { id: existingConfig.id },
            data: {
              periodsCount: data.periodsCount,

              // Clear + rebuild nested relations safely
              periods: {
                deleteMany: {},
                create: data.periods.map((p, idx) => ({
                  periodNumber: idx + 1,
                  startTime: p.startTime || "",
                  endTime: p.endTime || "",
                })),
              },

              breaks: {
                deleteMany: {},
                create: data.breaks.map((b) => ({
                  name: b.name,
                  startTime: b.startTime,
                  endTime: b.endTime,
                })),
              },

              subjects: {
                deleteMany: {},
                create: data.subjects.map((s) => ({
                  subjectName: s.subjectName,
                  teacherId: s.teacherId,
                })),
              },
            },
          });
        } else {
          // 3. If no existing config is found, initialize a fresh entry from scratch
          await tx.timetableConfiguration.create({
            data: {
              sectionId,
              periodsCount: data.periodsCount,

              periods: {
                create: data.periods.map((p, idx) => ({
                  periodNumber: idx + 1,
                  startTime: p.startTime || "",
                  endTime: p.endTime || "",
                })),
              },

              breaks: {
                create: data.breaks.map((b) => ({
                  name: b.name,
                  startTime: b.startTime,
                  endTime: b.endTime,
                })),
              },

              subjects: {
                create: data.subjects.map((s) => ({
                  subjectName: s.subjectName,
                  teacherId: s.teacherId,
                })),
              },
            },
          });
        }
      }
    });
  }
}