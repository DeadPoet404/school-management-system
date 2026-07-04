import { prisma } from "@/lib/prisma";
import { Prisma, EntityStatus } from "@prisma/client";

// Extract Prisma's transaction client interface to replace 'any' contexts
type TransactionClient = Omit<
  Prisma.TransactionClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

export class StudentRepository {
  /**
   * Fetches full relational student graph rows from the database.
   * Pure data access — no transformation logic.
   */
  async findAll(tx: TransactionClient = prisma) {
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
  async findById(id: string, tx: TransactionClient = prisma) {
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
  async findWithFinancialData(tx: TransactionClient = prisma) {
    return tx.student.findMany({
      include: {
        account: true,
        invoices: true,
        payments: true,
      },
    });
  }

  /**
   * Looks up a student by their public ID (e.g., STU-2026-123456).
   */
  async findByPublicId(studentId: string, tx: TransactionClient = prisma) {
    return tx.student.findUnique({
      where: { studentId },
    });
  }

  /**
   * Executes the nested creation of the student and all related tables.
   */
  async createNestedStudent(data: Prisma.StudentCreateInput, tx: TransactionClient = prisma) {
    return tx.student.create({ 
      data,
      select: {
        id: true,
        studentId: true,
        studentName: true,
      }
    });
  }

  /**
   * Creates an immutable departure audit log.
   */
  async createDepartureLog(data: Prisma.StudentDepartureUncheckedCreateInput, tx: TransactionClient = prisma) {
    return tx.studentDeparture.create({ data });
  }

  /**
   * Updates the core student status inside the master registry.
   */
  async updateStatus(id: string, status: EntityStatus, tx: TransactionClient = prisma) {
    return tx.student.update({
      where: { id },
      data: { status },
    });
  }
}