import { prisma } from "@/lib/prisma";
import { Prisma, EntityStatus } from "@prisma/client";
import { ITeacherRepository } from "@/types/repositories";

export class TeacherRepository implements ITeacherRepository {
  async findAllActive(tx = prisma) {
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
}
