import { AppError } from '@/middleware/error.handler';
import { prisma } from "@/lib/prisma";
import { Prisma, EntityStatus, DepartureType, TreasuryClearanceStatus } from "@prisma/client";
import { IStudentRepository } from "@/types/repositories";
import { StudentRepository } from "./student.repository";
import { formatInstitutionalId } from "@/utils";
import { hashPassword } from "@/utils/hash";

type StudentFinancialRow = Prisma.StudentGetPayload<{
  include: { account: true; invoices: true; payments: true; };
}>;

interface InvoiceType {
  invoiceNo: string;
  amount: Prisma.Decimal;
  createdAt: Date;
}

interface PaymentType {
  receiptNo: string;
  amount: Prisma.Decimal;
  paymentType: string;
  createdAt: Date;
}

export class StudentService {
  constructor(private repo: IStudentRepository = new StudentRepository()) {}

  async getAll() {
    return this.repo.findAll();
  }

  async getPaginated(skip: number, take: number) {
    return this.getFilteredPaginated({}, skip, take);
  }

  async getAllFiltered(filters: {
    search?: string;
    status?: string;
    classId?: string;
    gender?: string;
    boardingStatus?: string;
  }) {
    const where = this.buildWhereClause(filters);
    return this.repo.findAllFiltered(where);
  }

    async getFilteredPaginated(filters: {
    search?: string;
    status?: string;
    classId?: string;
    gender?: string;
    boardingStatus?: string;
  }, skip: number, take: number) {
    const where = this.buildWhereClause(filters);
    const [data, total] = await Promise.all([
      this.repo.findAllFiltered(where, skip, take),
      this.repo.countFiltered(where),
    ]);
    return { data, total };
  }

  private buildWhereClause(filters: {
    search?: string;
    status?: string;
    classId?: string;
    gender?: string;
    boardingStatus?: string;
  }): Prisma.StudentWhereInput {
    const where: Prisma.StudentWhereInput = {};

    if (filters.search?.trim()) {
      const term = filters.search.trim();
      where.OR = [
        { studentName: { contains: term, mode: 'insensitive' } },
        { studentId: { contains: term, mode: 'insensitive' } },
      ];
    }

    if (filters.status?.trim()) {
      where.status = filters.status.trim() as EntityStatus;
    }

    const placementFilter: Prisma.PlacementWhereInput = {};
    if (filters.classId?.trim()) {
      placementFilter.classId = filters.classId.trim();
    }
    if (filters.boardingStatus?.trim()) {
      placementFilter.boardingStatus = filters.boardingStatus.trim();
    }
    if (Object.keys(placementFilter).length > 0) {
      where.placement = placementFilter;
    }

    const demographicsFilter: Prisma.DemographicsWhereInput = {};
    if (filters.gender?.trim()) {
      demographicsFilter.gender = filters.gender.trim();
    }
    if (Object.keys(demographicsFilter).length > 0) {
      where.demographics = demographicsFilter;
    }

    return where;
  }

  async getById(id: string) {
    const student = await this.repo.findById(id);
    if (!student) throw new AppError(404, `Student not found with ID: ${id}`);
    return student;
  }

  async getFinancialMatrix() {
    const students = await this.repo.findWithFinancialData();

    const invoiceAggregates = await prisma.invoice.groupBy({
      by: ["studentId"],
      _sum: { amount: true },
    });

    const paymentAggregates = await prisma.payment.groupBy({
      by: ["studentId"],
      _sum: { amount: true },
    });

    const invoiceMap = new Map(
      invoiceAggregates.map((i) => [i.studentId, Number(i._sum.amount || 0)])
    );

    const paymentMap = new Map(
      paymentAggregates.map((p) => [p.studentId, Number(p._sum.amount || 0)])
    );

    return (students as StudentFinancialRow[]).map((student) => {
      const totalInvoiced = invoiceMap.get(student.id) || 0;
      const totalPaid = paymentMap.get(student.id) || 0;
      const balanceRemaining = Math.max(0, totalInvoiced - totalPaid);

      let feesStatus: "Paid" | "Partial" | "Unpaid" = "Unpaid";
      if (balanceRemaining <= 0 && totalPaid > 0) feesStatus = "Paid";
      else if (totalPaid > 0 && balanceRemaining > 0) feesStatus = "Partial";

      const invoices = (student.invoices || []) as InvoiceType[];
      const payments = (student.payments || []) as PaymentType[];
      const lastInvoice = invoices[invoices.length - 1];
      const lastPayment = payments[payments.length - 1];

      return {
        id: student.id,
        studentId: student.studentId,
        studentName: student.studentName,
        status: student.status,
        account: student.account,
        feesStatus,
        lastTransactionId: lastPayment?.receiptNo || lastInvoice?.invoiceNo || "—",
        lastTransactionDate: lastPayment?.createdAt || lastInvoice?.createdAt || "—",
        paymentType: lastPayment?.paymentType || (lastInvoice ? "Invoice" : "—"),
        amountPaid: totalPaid,
        balanceRemaining,
      };
    });
  }

  async createStudent(payload: {
    account: { fullName: string; email: string; password: string; enrollmentDate: string };
    demographics: { dateOfBirth: string; gender: string; residentialAddress: string; medicalNotes?: string | null; bloodType?: string | null; religion?: string | null; formerSchool?: string | null };
    placement: { classId: string; academicTrack: string; boardingStatus: string };
    guardian?: { name: string; relationship: string; phone: string; email?: string | null };
    parent?: { name: string; relationship: string; phone: string; email?: string | null };
    billing: { feeTierId: string; initialDeposit: number };
    compliance?: { nationalId?: string | null; emergencyContact?: { name?: string | null; phone?: string | null; relationship?: string | null } | null };
  }) {
    const { account, demographics, placement, guardian, parent, billing, compliance } = payload;
    const resolvedGuardian = guardian || parent;

    if (!resolvedGuardian) {
      throw new AppError(400, "Missing essential guardian contact relationships from structural payload.");
    }

    const uniqueStudentId = formatInstitutionalId("STU", String(new Date().getFullYear()));
    const feeTier = await prisma.feeTier.findUnique({ where: { code: billing.feeTierId } });
    const baseTariff = feeTier ? Number(feeTier.amount) : 0;
    const computedBalance = Math.max(0, baseTariff - billing.initialDeposit);

    return await prisma.$transaction(async (tx) => {
      const hashedPassword = await hashPassword(account.password);

      const dbPayload = {
        studentId: uniqueStudentId,
        studentName: account.fullName,
        enrollmentDate: new Date(account.enrollmentDate),
        status: "ACTIVE" as const,
        currentGpa: 0.0,
        attendanceRate: 100.0,
        account: { create: { portalEmail: account.email, passwordHash: hashedPassword } },
        demographics: {
          create: {
            dateOfBirth: new Date(demographics.dateOfBirth),
            gender: demographics.gender,
            residentialAddress: demographics.residentialAddress,
            medicalNotes: demographics.medicalNotes ?? null,
            bloodType: demographics.bloodType ?? null,
            religion: demographics.religion ?? null,
            formerSchool: demographics.formerSchool ?? null,
          },
        },
        placement: { create: { classId: placement.classId, academicTrack: placement.academicTrack, boardingStatus: placement.boardingStatus } },
        guardians: { create: { name: resolvedGuardian.name, relationship: resolvedGuardian.relationship, phone: resolvedGuardian.phone, email: resolvedGuardian.email ?? null } },
        billing: { create: { feeTierId: billing.feeTierId, initialDeposit: billing.initialDeposit, currentBalance: computedBalance } },
        compliance: { create: { nationalId: compliance?.nationalId ?? null, emergencyName: compliance?.emergencyContact?.name ?? null, emergencyPhone: compliance?.emergencyContact?.phone ?? null, emergencyRelation: compliance?.emergencyContact?.relationship ?? null } },
      };

      return this.repo.createNestedStudent(dbPayload, tx);
    });
  }

  async processDeparture(payload: {
    studentId: string;
    departureType: string;
    effectiveDate: string;
    disposition: { destinationInstitution?: string; treasuryClearanceStatus: string; academicRecordsArchived: boolean };
    remarks: string;
  }) {
    const { studentId, departureType, effectiveDate, disposition, remarks } = payload;
    const studentRecord = await this.repo.findByPublicId(studentId);

    if (!studentRecord) {
      throw new AppError(404, `Target student registry lookup failed. No active record found for ID: ${studentId}`);
    }
    if (studentRecord.status === "DEPARTED") {
      throw new AppError(409, `System conflict: Student ${studentId} has already been processed for departure.`);
    }

    return await prisma.$transaction(async (tx) => {
      const departureLog = await this.repo.createDepartureLog(
        {
          studentInternalId: studentRecord.id,
          departureType: departureType as DepartureType,
          effectiveDate: new Date(effectiveDate),
          destinationInstitution: disposition.destinationInstitution || "N/A",
          treasuryClearanceStatus: disposition.treasuryClearanceStatus as TreasuryClearanceStatus,
          academicRecordsArchived: disposition.academicRecordsArchived,
          remarks,
        },
        tx
      );
      await this.repo.updateStatus(studentRecord.id, "DEPARTED", tx);
      return departureLog;
    });
  }

  async update(id: string, payload: any) {
    const student = await this.repo.findById(id);
    if (!student) throw new AppError(404, `Student not found with ID: ${id}`);
    if (student.status === 'DEPARTED') throw new AppError(409, 'Cannot update a departed student.');

    const data: any = { ...payload };
    if (data.demographics?.dateOfBirth) {
      data.demographics.dateOfBirth = new Date(data.demographics.dateOfBirth);
    }

    return this.repo.update(id, data);
  }

}
