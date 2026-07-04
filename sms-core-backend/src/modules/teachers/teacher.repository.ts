import { prisma } from "@/lib/prisma";
import { Prisma, EntityStatus } from "@prisma/client";

type TransactionClient = Omit<
  Prisma.TransactionClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

export class TeacherRepository {
  /**
   * Fetches all active or suspended teachers with their complete relational datasets.
   * Filters out DEPARTED records for the directory view grid.
   */
  async findAllActive(tx: TransactionClient = prisma) {
    return tx.teacher.findMany({
      where: { 
        status: { not: "DEPARTED" } 
      },
      include: {
        demographics: true,
        compliance: true,
        payroll: true,
        departures: true,
      },
      orderBy: { 
        createdAt: "desc" 
      },
    });
  }

  /**
   * Looks up an individual faculty member by their public institutional identifier (e.g., TCH-2026-9941).
   */
  async findByPublicId(teacherId: string, tx: TransactionClient = prisma) {
    return tx.teacher.findUnique({
      where: { teacherId },
    });
  }

  /**
   * Commits an atomic multi-table nested query block to ingest new faculty lines.
   */
  async createNestedTeacher(data: Prisma.TeacherCreateInput, tx: TransactionClient = prisma) {
    return tx.teacher.create({ 
      data,
      select: {
        id: true,
        teacherId: true,
        teacherName: true,
      }
    });
  }

  /**
   * Appends an immutable historical offboarding log into the faculty ledger.
   */
  async createDepartureLog(data: Prisma.TeacherDepartureUncheckedCreateInput, tx: TransactionClient = prisma) {
    return tx.teacherDeparture.create({ data });
  }

  /**
   * Modifies a teacher's master directory state flag within isolated transactions.
   */
  async updateStatus(id: string, status: EntityStatus, tx: TransactionClient = prisma) {
    return tx.teacher.update({
      where: { id },
      data: { status },
    });
  }
}