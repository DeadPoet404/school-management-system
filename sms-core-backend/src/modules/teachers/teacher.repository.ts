import { prisma } from "@/lib/prisma";

export class TeacherRepository {
  /**
   * Fetches all active teachers with their related data.
   * Returns raw database shape.
   */
  async findAllActive(tx: any = prisma) {
    return tx.teacher.findMany({
      where: { status: { not: "DEPARTED" } },
      include: {
        demographics: true,
        compliance: true,
        payroll: true,
      },
      orderBy: { id: "desc" },
    });
  }

  /**
   * Looks up a teacher by their public ID (e.g., TCH-SCI-456789).
   */
  async findByPublicId(teacherId: string, tx: any = prisma) {
    return tx.teacher.findUnique({
      where: { teacherId },
    });
  }

  /**
   * Creates a single teacher record (flat schema).
   */
  async createTeacher(data: any, tx: any = prisma) {
    return tx.teacher.create({ data });
  }

  /**
   * Creates an immutable departure audit log.
   */
  async createDepartureLog(data: any, tx: any = prisma) {
    return tx.teacherDeparture.create({ data });
  }

  /**
   * Updates the core teacher status.
   */
  async updateStatus(id: string, status: string, tx: any = prisma) {
    return tx.teacher.update({
      where: { id },
      data: { status },
    });
  }
}