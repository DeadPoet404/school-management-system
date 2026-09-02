import { AppError } from '@/middleware/error.handler';
import { prisma } from "@/lib/prisma";
import type { TranscriptPdfData, TranscriptTermSection } from "@/lib/pdf";
import { Prisma, EntityStatus, DepartureType, TreasuryClearanceStatus } from "@prisma/client";
import { IStudentRepository } from "@/types/repositories";
import { StudentRepository } from "./student.repository";
import { formatInstitutionalId } from "@/utils";
import { hashPassword } from "@/utils/hash";
import { parseStudentImportFile, type StudentImportError, type StudentImportUploadedFile } from "./student.import";

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

interface StudentFilters {
  search?: string;
  status?: string;
  classId?: string;
  gender?: string;
  boardingStatus?: string;
  minGpa?: string;
  minAttendance?: string;
}

export class StudentService {
  constructor(private repo: IStudentRepository = new StudentRepository()) {}

  /**
   * SMS-005: Portal self-view profile. Portal-shaped DTO only -- compliance,
   * billing, invoice/payment, and departure internals are never selected.
   * Identity always comes from the verified session, never from parameters.
   */
  async getOwnProfile(studentId: string) {
    const student = await prisma.student.findUnique({
      where: { id: studentId },
      select: {
        id: true,
        studentId: true,
        studentName: true,
        enrollmentDate: true,
        status: true,
        currentGpa: true,
        attendanceRate: true,
        placement: {
          select: {
            academicTrack: true,
            boardingStatus: true,
            class: { select: { id: true, name: true, section: true } },
          },
        },
        demographics: { select: { dateOfBirth: true, gender: true } },
        guardians: {
          select: { name: true, relationship: true, phone: true, email: true },
        },
      },
    });

    if (!student) throw new AppError(404, 'Student not found.');
    return student;
  }

  /**
   * SMS-008: cumulative transcript DTO. Term sections ordered by term
   * startDate (subjects alphabetical inside), weighted GPA per term
   * (Σ gradePoints×creditHours / Σ creditHours), cumulative carried
   * from the service-maintained Student.currentGpa.
   */
  async getTranscriptForPdf(internalId: string): Promise<TranscriptPdfData> {
    const student = await prisma.student.findUnique({
      where: { id: internalId },
      select: {
        id: true,
        studentId: true,
        studentName: true,
        enrollmentDate: true,
        currentGpa: true,
        placement: { select: { class: { select: { name: true, section: true } } } },
      },
    });
    if (!student) throw new AppError(404, `Student not found with ID: ${internalId}`);

    const records = await prisma.gradeRecord.findMany({
      where: { studentId: internalId },
      include: {
        subject: { select: { name: true, code: true } },
        term: { select: { name: true, academicYear: true, startDate: true } },
      },
      orderBy: [{ term: { startDate: 'asc' } }, { subject: { name: 'asc' } }],
    });

    const terms: TranscriptTermSection[] = [];
    let current: TranscriptTermSection | null = null;
    let currentKey = '';
    for (const r of records) {
      const key = `${r.term.name}|${r.term.academicYear}`;
      if (!current || key !== currentKey) {
        current = { termName: r.term.name, academicYear: r.term.academicYear, rows: [], termGpa: 0, creditHours: 0 };
        terms.push(current);
        currentKey = key;
      }
      const section: TranscriptTermSection = current;
      const creditHours = r.creditHours;
      const gradePoints = Number(r.gradePoints);
      section.rows.push({
        subject: r.subject.name,
        code: r.subject.code,
        caScore: Number(r.continuousAssessment),
        examScore: Number(r.examination),
        finalScore: Number(r.finalScore),
        letterGrade: r.letterGrade,
        gradePoints,
        creditHours,
      });
      section.creditHours += creditHours;
      section.termGpa += gradePoints * creditHours;
    }
    for (const term of terms) {
      term.termGpa = term.creditHours > 0 ? parseFloat((term.termGpa / term.creditHours).toFixed(2)) : 0;
    }

    return {
      studentName: student.studentName,
      studentCode: student.studentId,
      className: student.placement?.class
        ? `${student.placement.class.name}${student.placement.class.section ? ` — Section ${student.placement.class.section}` : ''}`
        : null,
      enrollmentDate: student.enrollmentDate,
      dateOfIssue: new Date(),
      terms,
      cumulativeGpa: records.length === 0 ? null : parseFloat(Number(student.currentGpa).toFixed(2)),
    };
  }

  async getAll() {
    return this.repo.findAll();
  }

  async getPaginated(skip: number, take: number) {
    return this.getFilteredPaginated({}, skip, take);
  }

  async getAllFiltered(filters: StudentFilters) {
    const where = this.buildWhereClause(filters);
    return this.repo.findAllFiltered(where);
  }

  async getFilteredPaginated(
    filters: StudentFilters,
    skip: number,
    take: number,
  ) {
    const where = this.buildWhereClause(filters);
    const [data, total] = await Promise.all([
      this.repo.findAllFiltered(where, skip, take),
      this.repo.countFiltered(where),
    ]);
    return { data, total };
  }

  private buildWhereClause(
    filters: StudentFilters,
  ): Prisma.StudentWhereInput {
    const where: Prisma.StudentWhereInput = {};

    if (filters.search?.trim()) {
      const term = filters.search.trim();
      const textFilter = {
        contains: term,
        mode: 'insensitive' as const,
      };

      where.OR = [
        { studentName: textFilter },
        { studentId: textFilter },
        {
          account: {
            is: { portalEmail: textFilter },
          },
        },
        {
          guardians: {
            some: {
              OR: [
                { name: textFilter },
                { phone: textFilter },
                { email: textFilter },
              ],
            },
          },
        },
        {
          placement: {
            is: {
              OR: [
                { academicTrack: textFilter },
                {
                  class: {
                    is: {
                      OR: [
                        { name: textFilter },
                        { section: textFilter },
                      ],
                    },
                  },
                },
              ],
            },
          },
        },
      ];
    }

    if (filters.status?.trim()) {
      const status = filters.status.trim().toUpperCase();
      const allowedStatuses = Object.values(EntityStatus) as string[];

      if (!allowedStatuses.includes(status)) {
        throw new AppError(400, 'Invalid student status filter.');
      }

      where.status = status as EntityStatus;
    }

    const placementFilter: Prisma.PlacementWhereInput = {};

    if (filters.classId?.trim()) {
      placementFilter.classId = filters.classId.trim();
    }

    if (filters.boardingStatus?.trim()) {
      const boardingStatus = filters.boardingStatus
        .trim()
        .toUpperCase();

      if (boardingStatus === 'DAY') {
        placementFilter.boardingStatus = {
          in: [
            'DAY',
            'Day',
            'DAY_STUDENT',
            'Day Student',
          ],
        };
      } else if (boardingStatus === 'BOARDING') {
        placementFilter.boardingStatus = {
          in: [
            'BOARDING',
            'Boarding',
            'BOARDING_STUDENT',
            'Boarding Student',
          ],
        };
      } else {
        throw new AppError(
          400,
          'Invalid boarding-status filter.',
        );
      }
    }

    if (Object.keys(placementFilter).length > 0) {
      where.placement = placementFilter;
    }

    if (filters.gender?.trim()) {
      const gender = filters.gender.trim();
      where.demographics = {
        gender: {
          equals: gender,
          mode: 'insensitive',
        },
      };
    }

    const minGpa = this.parseMinimumFilter(
      filters.minGpa,
      'minimum GPA',
      0,
      4,
    );

    if (minGpa !== undefined) {
      where.currentGpa = { gte: minGpa };
    }

    const minAttendance = this.parseMinimumFilter(
      filters.minAttendance,
      'minimum attendance',
      0,
      100,
    );

    if (minAttendance !== undefined) {
      where.attendanceRate = {
        gte: minAttendance,
      };
    }

    return where;
  }

  private parseMinimumFilter(
    raw: string | undefined,
    label: string,
    minimum: number,
    maximum: number,
  ): number | undefined {
    if (!raw?.trim()) return undefined;

    const value = Number(raw);

    if (
      !Number.isFinite(value) ||
      value < minimum ||
      value > maximum
    ) {
      throw new AppError(
        400,
        `Invalid ${label} filter.`,
      );
    }

    return value;
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
    // Frontend may send either the fee tier's UUID (id) or its code (code); try both.
    const feeTier =
      (await prisma.feeTier.findUnique({ where: { id: billing.feeTierId } })) ??
      (await prisma.feeTier.findUnique({ where: { code: billing.feeTierId } }));
    // D-05: a failed tier lookup must never silently default the tariff to 0.
    // Previously an unresolvable tier enrolled the student with a 0.00 balance
    // and returned 201, so the school never billed them. Fail loudly instead.
    if (!feeTier) {
      throw new AppError(400, `Unknown fee tier: ${billing.feeTierId}`);
    }
    if (!feeTier.isActive) {
      throw new AppError(400, `Fee tier ${feeTier.code} is inactive and cannot be assigned.`);
    }

    const initialDeposit = Number(billing.initialDeposit);
    if (!Number.isFinite(initialDeposit) || initialDeposit < 0) {
      throw new AppError(400, 'Initial deposit must be a non-negative number.');
    }

    const baseTariff = Number(feeTier.amount);
    if (!Number.isFinite(baseTariff)) {
      throw new AppError(500, `Fee tier ${feeTier.code} has a non-numeric amount.`);
    }
    const resolvedTierId = feeTier.id;
    const computedBalance = Math.max(0, baseTariff - initialDeposit);

    // Avoid prisma.$transaction here: Supabase transaction pooler (PgBouncer)
    // rejects interactive transactions (P2028), which surfaces as HTTP 500 on import.
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
      billing: { create: { feeTierId: resolvedTierId, initialDeposit: billing.initialDeposit, currentBalance: computedBalance } },
      compliance: { create: { nationalId: compliance?.nationalId ?? null, emergencyName: compliance?.emergencyContact?.name ?? null, emergencyPhone: compliance?.emergencyContact?.phone ?? null, emergencyRelation: compliance?.emergencyContact?.relationship ?? null } },
    };

    // createNestedStudent accepts optional tx; omit tx → uses root prisma client.
    return this.repo.createNestedStudent(dbPayload);
  }

  async importStudentsFromFile(file: StudentImportUploadedFile) {
    const parsed = parseStudentImportFile(file);
    const errors: StudentImportError[] = [...parsed.errors];
    const createdStudents: Array<{ row: number; id: string; studentId: string; studentName: string }> = [];
    const seenEmails = new Set<string>();
    const classCache = new Map<string, string>();
    const feeTierCache = new Map<string, string>();

    for (const row of parsed.rows) {
      try {
        const emailKey = row.payload.account.email.trim().toLowerCase();

        if (seenEmails.has(emailKey)) {
          throw new AppError(409, `Duplicate email ${row.payload.account.email} appears more than once in the import file.`);
        }

        seenEmails.add(emailKey);

        const existingAccount = await prisma.studentAccount.findUnique({
          where: { portalEmail: row.payload.account.email },
        });

        if (existingAccount) {
          throw new AppError(409, `Student account email already exists: ${row.payload.account.email}`);
        }

        const classId = await this.resolveImportClassId(row.payload.placement.classId, classCache);
        const feeTierId = await this.resolveImportFeeTierId(row.payload.billing.feeTierId, feeTierCache);

        const created = await this.createStudent({
          ...row.payload,
          placement: {
            ...row.payload.placement,
            classId,
          },
          billing: {
            ...row.payload.billing,
            feeTierId,
          },
        });

        createdStudents.push({
          row: row.rowNumber,
          id: created.id,
          studentId: created.studentId,
          studentName: created.studentName,
        });
      } catch (error) {
        errors.push({
          row: row.rowNumber,
          message: error instanceof Error ? error.message : "Student import failed for this row.",
        });
      }
    }

    const failedRows = new Set(errors.map((error) => error.row));

    return {
      totalRows: parsed.totalRows,
      attemptedRows: parsed.rows.length,
      created: createdStudents.length,
      failed: failedRows.size,
      errors,
      createdStudents,
    };
  }

  private async resolveImportClassId(value: string, cache: Map<string, string>): Promise<string> {
    const lookup = value.trim();
    const cacheKey = lookup.toLowerCase();
    const cached = cache.get(cacheKey);

    if (cached) return cached;

    const byId = await prisma.class.findFirst({
      where: { id: lookup, deletedAt: null, isActive: true },
      select: { id: true },
    });

    const found = byId ?? await prisma.class.findFirst({
      where: {
        deletedAt: null,
        isActive: true,
        name: { equals: lookup, mode: "insensitive" },
      },
      select: { id: true },
    });

    if (!found) {
      throw new AppError(400, `Unknown active class: ${lookup}`);
    }

    cache.set(cacheKey, found.id);
    return found.id;
  }

  private async resolveImportFeeTierId(value: string, cache: Map<string, string>): Promise<string> {
    const lookup = value.trim();
    const cacheKey = lookup.toLowerCase();
    const cached = cache.get(cacheKey);

    if (cached) return cached;

    const byId = await prisma.feeTier.findFirst({
      where: { id: lookup, deletedAt: null, isActive: true },
      select: { id: true },
    });

    const found = byId ?? await prisma.feeTier.findFirst({
      where: {
        deletedAt: null,
        isActive: true,
        OR: [
          { code: { equals: lookup, mode: "insensitive" } },
          { name: { equals: lookup, mode: "insensitive" } },
        ],
      },
      select: { id: true },
    });

    if (!found) {
      throw new AppError(400, `Unknown active fee tier: ${lookup}`);
    }

    cache.set(cacheKey, found.id);
    return found.id;
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

  async update(id: string, payload: Record<string, unknown>) {
    const student = await this.repo.findById(id);
    if (!student) throw new AppError(404, `Student not found with ID: ${id}`);
    if (student.status === 'DEPARTED') throw new AppError(409, 'Cannot update a departed student.');

    const data: Record<string, unknown> = { ...payload };
    const demo = data.demographics as Record<string, unknown> | undefined;
    if (demo?.dateOfBirth && typeof demo.dateOfBirth === 'string') {
      demo.dateOfBirth = new Date(demo.dateOfBirth);
    }

    return this.repo.update(id, data);
  }

}
