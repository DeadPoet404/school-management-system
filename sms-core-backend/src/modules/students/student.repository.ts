import { prisma } from "@/lib/prisma";
import { Prisma, EntityStatus } from "@prisma/client";
import { IStudentRepository } from "@/types/repositories";
import { normalizeGuardianEmail, normalizeGuardianPhone } from "@/lib/guardian-contact";

export class StudentRepository implements IStudentRepository {
  async findAll(skip?: number, take?: number, tx = prisma) {
    return tx.student.findMany({
      skip: skip ?? undefined,
      take: take ?? undefined,
      include: {
        account: { select: { id: true, studentId: true, portalEmail: true } },
        demographics: true,
        placement: { include: { class: true } },
        compliance: true,
        guardians: true,
        billing: { include: { feeTier: { select: { id: true, name: true, code: true, amount: true } } } },
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
        placement: { include: { class: true } },
        compliance: true,
        guardians: true,
        billing: { include: { feeTier: { select: { id: true, name: true, code: true, amount: true } } } },
        invoices: true,
        payments: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });
  }

  /**
   * Lightweight list for the registry — enough for overview + personal-info,
   * but avoids loading invoices/payments/billing full arrays (previous bottleneck).
   * Fees status is computed via aggregates in the service layer.
   */
  async findAllFilteredLight(where: Prisma.StudentWhereInput, skip?: number, take?: number, tx = prisma) {
    return tx.student.findMany({
      where,
      skip: skip ?? undefined,
      take: take ?? undefined,
      select: {
        id: true,
        studentId: true,
        studentName: true,
        enrollmentDate: true,
        status: true,
        currentGpa: true,
        attendanceRate: true,
        createdAt: true,
        account: { select: { portalEmail: true } },
        demographics: {
          select: {
            gender: true,
            dateOfBirth: true,
            residentialAddress: true,
            religion: true,
            formerSchool: true,
            bloodType: true,
          },
        },
        placement: { select: { class: { select: { name: true } } } },
        compliance: { select: { nationalId: true, emergencyPhone: true } },
        guardians: { select: { name: true, phone: true } },
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
        billing: { include: { feeTier: { select: { id: true, name: true, code: true, amount: true } } } },
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

    // Primary guardian: upsert the student's existing guardian record
    // (the app maintains one primary guardian per student).
    if (data.guardian) {
      const guardian = data.guardian as Record<string, unknown>;
      const email =
        typeof guardian.email === 'string' && guardian.email.trim() !== ''
          ? guardian.email.trim()
          : null;
      const values = {
        name: String(guardian.name),
        relationship: String(guardian.relationship),
        phone: String(guardian.phone),
        phoneNormalized: normalizeGuardianPhone(String(guardian.phone)),
        email,
        emailNormalized: normalizeGuardianEmail(email),
      };
      const existingGuardian = await tx.guardian.findFirst({
        where: { studentId: id },
        select: { id: true },
      });
      if (existingGuardian) {
        await tx.guardian.update({ where: { id: existingGuardian.id }, data: values });
      } else {
        await tx.guardian.create({ data: { ...values, studentId: id } });
      }
      delete data.guardian;
    }

    return tx.student.update({
      where: { id },
      data: updateData,
      include: {
        account: { select: { id: true, studentId: true, portalEmail: true } },
        demographics: true,
        placement: true,
        compliance: true,
        guardians: true,
        billing: { include: { feeTier: { select: { id: true, name: true, code: true, amount: true } } } },
        invoices: true,
        payments: true,
      },
    });
  }

}
