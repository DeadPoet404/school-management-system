import { prisma } from "@/lib/prisma";
import { Prisma, EntityStatus } from "@prisma/client";

type TransactionClient = Omit<
  Prisma.TransactionClient,
  "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends"
>;

export class StaffRepository {
  /**
   * Fetches all operational staff lines with full nested relation profiles.
   * Direct exclusion guard for offboarded operational records.
   */
  async findAllActive(tx: TransactionClient = prisma) {
    return tx.staff.findMany({
      where: {
        status: { not: "DEPARTED" }
      },
      include: {
        account: {
          select: { email: true, role: true }
        },
        demographics: true,
        placement: true,
        compliance: true,
        payroll: true,
        departures: true,
      },
      orderBy: {
        createdAt: "desc"
      }
    });
  }

  /**
   * Looks up an individual administrative staff member by public corporate identifier (e.g., STF-2026-4401).
   */
  async findByPublicId(staffId: string, tx: TransactionClient = prisma) {
    return tx.staff.findUnique({
      where: { staffId }
    });
  }

  /**
   * Executes nested creation queries for staff sub-tables (Placement, Compliance, Payroll).
   */
  async createNestedStaff(data: Prisma.StaffCreateInput, tx: TransactionClient = prisma) {
    return tx.staff.create({
      data,
      select: {
        id: true,
        staffId: true,
        staffName: true,
      }
    });
  }

  /**
   * Appends an operational HR/IT audit trail log upon personnel separation.
   */
  async createDepartureLog(data: Prisma.StaffDepartureUncheckedCreateInput, tx: TransactionClient = prisma) {
    return tx.staffDeparture.create({ data });
  }

  /**
   * Transitions the master administrative directory access state.
   */
  async updateStatus(id: string, status: EntityStatus, tx: TransactionClient = prisma) {
    return tx.staff.update({
      where: { id },
      data: { status }
    });
  }
}