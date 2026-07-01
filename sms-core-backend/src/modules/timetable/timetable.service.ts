import { prisma } from "@/lib/prisma";
import { 
  TimetableConfiguration, 
  TimetablePeriod, 
  TimetableBreak, 
  SubjectAllocation 
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
    
    records.forEach((rec: TimetableConfiguration & { 
      periods: TimetablePeriod[]; 
      breaks: TimetableBreak[]; 
      subjects: SubjectAllocation[] 
    }) => {
      matrix[rec.sectionId] = {
        periodsCount: rec.periodsCount,
        periods: rec.periods.map((p: TimetablePeriod) => ({ 
          startTime: p.startTime, 
          endTime: p.endTime 
        })),
        breaks: rec.breaks.map((b: TimetableBreak) => ({ 
          id: b.id, 
          name: b.name, 
          startTime: b.startTime, 
          endTime: b.endTime 
        })),
        subjects: rec.subjects.map((s: SubjectAllocation) => ({ 
          id: s.id, 
          subjectName: s.subjectName, 
          teacherId: s.teacherId
        })),
      };
    });

    return matrix;
  }

  /**
   * Safely overwrites the entire timetable matrix inside a single atomic transaction.
   * 
   * Uses deleteMany + create to cleanly replace nested arrays. Because the Prisma 
   * schema uses `onDelete: Cascade`, deleting the parent configuration automatically 
   * wipes the linked periods, breaks, and subjects—making this 100% atomic.
   */
  async replaceGlobalMatrix(matrixData: Record<string, SectionTimeMatrix>): Promise<void> {
    await prisma.$transaction(async (tx) => {
      for (const [sectionId, data] of Object.entries(matrixData)) {
        // 1. Wipe the previous iteration configurations (Cascades to children automatically)
        await tx.timetableConfiguration.deleteMany({
          where: { sectionId: sectionId as string }
        });

        // 2. Insert the fresh configuration layout context
        await tx.timetableConfiguration.create({
          data: {
            sectionId: sectionId as string,
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
                // STRICT: Frontend must send the actual teacherId (e.g., TCH-SCI-456789)
                teacherId: s.teacherId, 
              })),
            },
          },
        });
      }
    });
  }
}