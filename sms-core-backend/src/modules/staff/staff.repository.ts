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

  async findAllFiltered(where: Prisma.StaffWhereInput, skip?: number, take?: number, tx = prisma) {
    return tx.staff.findMany({
      where,
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

  async countFiltered(where: Prisma.StaffWhereInput, tx = prisma) {
    return tx.staff.count({ where });
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

  async findById(id: string, tx = prisma) {
    return tx.staff.findUnique({
      where: { id },
      include: {
        account: { select: { email: true, role: true } },
        demographics: true,
        placement: true,
        compliance: true,
        payroll: true,
        departures: true,
      },
    });
  }

  async update(id: string, data: any, tx = prisma) {
    const updateData: any = {};
    if (data.staffName) updateData.staffName = data.staffName;
    if (data.demographics) updateData.demographics = { update: data.demographics };
    if (data.placement) updateData.placement = { update: data.placement };
    if (data.compliance) updateData.compliance = { update: data.compliance };
    if (data.payroll) updateData.payroll = { update: data.payroll };
    return tx.staff.update({
      where: { id },
      data: updateData,
      include: {
        account: { select: { email: true, role: true } },
        demographics: true,
        placement: true,
        compliance: true,
        payroll: true,
        departures: true,
      },
    });
  }

}
