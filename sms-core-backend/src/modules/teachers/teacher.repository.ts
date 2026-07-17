import { prisma } from "@/lib/prisma";
import { Prisma, EntityStatus } from "@prisma/client";
import { ITeacherRepository } from "@/types/repositories";

export class TeacherRepository implements ITeacherRepository {
  async findAllActive(skip?: number, take?: number, tx = prisma) {
    return tx.teacher.findMany({
      where: {
        status: { not: "DEPARTED" }
      },
      skip: skip ?? undefined,
      take: take ?? undefined,
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

  async countActive(tx = prisma) {
    return tx.teacher.count({
      where: { status: { not: "DEPARTED" } },
    });
  }

  async findByPublicId(teacherId: string, tx = prisma) {
    return tx.teacher.findUnique({
      where: { teacherId },
    });
  }

  async createNestedTeacher(data: Prisma.TeacherCreateInput, tx = prisma) {
    return tx.teacher.create({
      data,
      select: {
        id: true,
        teacherId: true,
        teacherName: true,
      }
    });
  }

  async createDepartureLog(data: Prisma.TeacherDepartureUncheckedCreateInput, tx = prisma) {
    return tx.teacherDeparture.create({ data });
  }

  async updateStatus(id: string, status: EntityStatus, tx = prisma) {
    return tx.teacher.update({
      where: { id },
      data: { status },
    });
  }

  async findById(id: string, tx = prisma) {
    return tx.teacher.findUnique({
      where: { id },
      include: { demographics: true, compliance: true, payroll: true, departures: true },
    });
  }

  async update(id: string, data: any, tx = prisma) {
    const updateData: any = {};
    if (data.teacherName) updateData.teacherName = data.teacherName;
    if (data.department) updateData.department = data.department;
    if (data.subject) updateData.subject = data.subject;
    if (data.employmentType) updateData.employmentType = data.employmentType;
    if (data.demographics) updateData.demographics = { update: data.demographics };
    if (data.compliance) updateData.compliance = { update: data.compliance };
    if (data.payroll) updateData.payroll = { update: data.payroll };
    return tx.teacher.update({
      where: { id },
      data: updateData,
      include: { demographics: true, compliance: true, payroll: true, departures: true },
    });
  }

}
