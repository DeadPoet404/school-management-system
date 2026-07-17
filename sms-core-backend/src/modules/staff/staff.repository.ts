import { prisma } from "@/lib/prisma";
import { Prisma, EntityStatus } from "@prisma/client";
import { IStaffRepository } from "@/types/repositories";

export class StaffRepository implements IStaffRepository {
  async findAllActive(skip?: number, take?: number, tx = prisma) {
    return tx.staff.findMany({
      where: { status: { not: "DEPARTED" } },
      skip: skip ?? undefined,
      take: take ?? undefined,
      include: {
        account: { select: { email: true, role: true } },
        demographics: true,
        placement: true,
        compliance: true,
        payroll: true,
        departures: true,
      },
      orderBy: { createdAt: "desc" }
    });
  }

  async countActive(tx = prisma) {
    return tx.staff.count({
      where: { status: { not: "DEPARTED" } },
    });
  }

  async findByPublicId(staffId: string, tx = prisma) {
    return tx.staff.findUnique({ where: { staffId } });
  }

  async createNestedStaff(data: Prisma.StaffCreateInput, tx = prisma) {
    return tx.staff.create({
      data,
      select: { id: true, staffId: true, staffName: true }
    });
  }

  async createDepartureLog(data: Prisma.StaffDepartureUncheckedCreateInput, tx = prisma) {
    return tx.staffDeparture.create({ data });
  }

  async updateStatus(id: string, status: EntityStatus, tx = prisma) {
    return tx.staff.update({ where: { id }, data: { status } });
  }
}
