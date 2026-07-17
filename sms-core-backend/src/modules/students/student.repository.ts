import { prisma } from "@/lib/prisma";
import { Prisma, EntityStatus } from "@prisma/client";
import { IStudentRepository } from "@/types/repositories";

export class StudentRepository implements IStudentRepository {
  async findAll(skip?: number, take?: number, tx = prisma) {
    return tx.student.findMany({
      skip: skip ?? undefined,
      take: take ?? undefined,
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

  async count(tx = prisma) {
    return tx.student.count();
  }

  async findById(id: string, tx = prisma) {
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

  async findWithFinancialData(tx = prisma) {
    return tx.student.findMany({
      include: {
        account: true,
        invoices: true,
        payments: true,
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

  async update(id: string, data: any, tx = prisma) {
    const updateData: any = {};
    if (data.studentName) updateData.studentName = data.studentName;
    if (data.demographics) updateData.demographics = { update: data.demographics };
    if (data.placement) updateData.placement = { update: data.placement };
    if (data.compliance) updateData.compliance = { update: data.compliance };

    return tx.student.update({
      where: { id },
      data: updateData,
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
    });
  }

}
