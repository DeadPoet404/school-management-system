import { prisma } from "@/lib/prisma";

export class StudentRepository {
  /**
   * Fetches full relational student graph rows from the database.
   * Pure data access — no transformation logic.
   */
  async findAll(tx: any = prisma) {
    return tx.student.findMany({
      include: {
        account: true,
        demographics: true,
        placement: true,
        compliance: true,
        guardians: true,
        billing: true,
        invoices: true,
        payments: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  /**
   * Looks up an individual student with all localized profile structures.
   */
  async findById(id: string, tx: any = prisma) {
    return tx.student.findUnique({
      where: { id },
      include: {
        account: true,
        demographics: true,
        placement: true,
        compliance: true,
        guardians: true,
        billing: true,
        departures: true,
        invoices: true,
        payments: true,
      },
    });
  }

  /**
   * Fetches students with only their financial relations for ledger processing.
   */
  async findWithFinancialData(tx: any = prisma) {
    return tx.student.findMany({
      include: {
        account: true,
        invoices: true,
        payments: true,
      },
    });
  }

  // =========================================================================
  // NEW: Extracted from StudentService to complete the Repository pattern
  // =========================================================================

  /**
   * Looks up a student by their public ID (e.g., STU-2026-123456).
   */
  async findByPublicId(studentId: string, tx: any = prisma) {
    return tx.student.findUnique({
      where: { studentId },
    });
  }

  /**
   * Executes the nested creation of the student and all related tables.
   */
  async createNestedStudent(data: any, tx: any = prisma) {
    return tx.student.create({ data });
  }

  /**
   * Creates an immutable departure audit log.
   */
  async createDepartureLog(data: any, tx: any = prisma) {
    return tx.studentDeparture.create({ data });
  }

  /**
   * Updates the core student status.
   */
  async updateStatus(id: string, status: "ACTIVE" | "INACTIVE" | "SUSPENDED" | "DEPARTED", tx: any = prisma) {
    return tx.student.update({
      where: { id },
      data: { status },
    });
  }
}