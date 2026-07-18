import { prisma } from '@/lib/prisma';
import { ITimetableRepository, TransactionClient } from "@/types/repositories";

export class TimetableRepository implements ITimetableRepository {
  async findAllConfigurations(tx: TransactionClient = prisma) {
    return tx.timetableConfiguration.findMany({
      include: {
        periods: { orderBy: { periodNumber: "asc" } },
        breaks: true,
        subjects: true,
      },
    });
  }

  async replaceSectionConfig(
    sectionId: string,
    data: {
      periodsCount: number;
      periods: Array<{ startTime: string; endTime: string }>;
      breaks: Array<{ name: string; startTime: string; endTime: string }>;
      subjects: Array<{ subjectName: string; teacherId: string }>;
    },
    tx: TransactionClient = prisma
  ) {
    const existing = await tx.timetableConfiguration.findUnique({
      where: { sectionId },
      select: { id: true },
    });

    const nestedData = {
      periodsCount: data.periodsCount,
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
    };

    if (existing) {
      return tx.timetableConfiguration.update({
        where: { id: existing.id },
        data: nestedData,
      });
    }

    return tx.timetableConfiguration.create({
      data: { sectionId, ...nestedData },
    });
  }
}
