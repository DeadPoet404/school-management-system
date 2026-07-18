import { prisma } from "@/lib/prisma";
import { Prisma, EntityStatus } from "@prisma/client";
import { IStudentRepository } from "@/types/repositories";

export class StudentRepository implements IStudentRepository {
  async findAll(skip?: number, take?: number, tx = prisma) {
    return tx.student.findMany({
      skip: skip ?? undefined,
      take: take ?? undefined,
      include: {
        account: { select: { id: true, studentId: true, portalEmail: true } },
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

  async count(tx = prisma) {
    return tx.student.count();
  }

  async findAllFiltered(where: Prisma.StudentWhereInput, skip?: number, take?: number, tx = prisma) {
    return tx.student.findMany({
      where,
      skip: skip ?? undefined,
      take: take ?? undefined,
      include: {
        account: { select: { id: true, studentId: true, portalEmail: true } },
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

  async countFiltered(where: Prisma.StudentWhereInput, tx = prisma) {
    return tx.student.count({ where });
  }

  async findById(id: string, tx = prisma) {
    return tx.student.findUnique({
      where: { id },
      include: {
        account: { select: { id: true, studentId: true, portalEmail: true } },
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

  async findWithFinancialData(tx = prisma) {
    return tx.student.findMany({
      include: {
        account: { select: { id: true, studentId: true, portalEmail: true } },
        invoices: { orderBy: { createdAt: 'desc' }, take: 1 },
        payments: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
  }

  async findByPublicId(studentId: string, tx = prisma) {
    return tx.student.findUnique({
      where: { studentId },
    });
  }

  async createNestedStudent(data: Prisma.StudentCreateInput, tx = prisma) {
    return tx.student.create({
      data,
      select: {
        id: true,
        studentId: true,
        studentName: true,
      }
    });
  }

  async createDepartureLog(data: Prisma.StudentDepartureUncheckedCreateInput, tx = prisma) {
    return tx.studentDeparture.create({ data });
  }

  async updateStatus(id: string, status: EntityStatus, tx = prisma) {
    return tx.student.update({
      where: { id },
      data: { status },
    });
  }

    async update(id: string, data: Record<string, unknown>, tx = prisma) {
    const updateData: Record<string, unknown> = {};
    if (data.studentName) updateData.studentName = data.studentName;
    if (data.demographics) updateData.demographics = { update: data.demographics };
    if (data.placement) updateData.placement = { update: data.placement };
    if (data.compliance) updateData.compliance = { update: data.compliance };

    return tx.student.update({
      where: { id },
      data: updateData,
      include: {
        account: { select: { id: true, studentId: true, portalEmail: true } },
        demographics: true,
        placement: true,
        compliance: true,
        guardians: true,
        billing: true,
        invoices: true,
        payments: true,
      },
    });
  }

}
