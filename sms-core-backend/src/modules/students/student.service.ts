import { AppError } from '@/middleware/error.handler';
import { prisma } from "@/lib/prisma";
import type { TranscriptPdfData, TranscriptTermSection } from "@/lib/pdf";
import { Prisma, EntityStatus, DepartureType, TreasuryClearanceStatus } from "@prisma/client";
import { IStudentRepository } from "@/types/repositories";
import { StudentRepository } from "./student.repository";
import { formatInstitutionalId } from "@/utils";
import { academicYearOf, cohortForClass, formatStudentId } from "@/lib/student-id";
import { hashPassword } from "@/utils/hash";
import { parseStudentImportFile, type StudentImportError, type StudentImportUploadedFile } from "./student.import";

type StudentFinancialRow = Prisma.StudentGetPayload<{
  include: { account: true; invoices: true; payments: true; };
}>;

/**
 * New-enrollee fee bands (FIRST TERM 2026/27 schedule).
 *
 * When a NEW student is enrolled, the fee is derived from the selected
 * class: admission (one-time) + uniform (one-time) + termly tuition.
 * Students already enrolled keep their original term fee for this term and
 * move to these tuition amounts next term (a one-off tier bump, done at the
 * start of the term — not here).
 */
export const NEW_ENROLLEE_FEE_BANDS = [
  { key: 'EARLY_YEARS', pattern: /^(creche|nursery|kg\b|kindergarten)/i, admission: 700, uniform: 700, tuition: 450, tierCode: 'NEW-EARLYYEARS' },
  { key: 'BASIC', pattern: /^(grade|basic|primary|class\s*\d)/i, admission: 700, uniform: 700, tuition: 500, tierCode: 'NEW-BASIC1-6' },
  { key: 'JHS', pattern: /^(jhs|junior)/i, admission: 700, uniform: 840, tuition: 600, tierCode: 'NEW-JHS' },
] as const;

export type FeeBand = (typeof NEW_ENROLLEE_FEE_BANDS)[number];

export function feeBandForClass(className: string): FeeBand | null {
  const name = (className || '').trim();
  return NEW_ENROLLEE_FEE_BANDS.find((band) => band.pattern.test(name)) ?? null;
}

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
    return (await this.repo.findAll()).map((s: any) => this.normalizeMoney(s));
  }

  async getPaginated(skip: number, take: number) {
    return this.getFilteredPaginated({}, skip, take);
  }

  async getAllFiltered(filters: StudentFilters) {
    const where = this.buildWhereClause(filters);
    const data = await this.repo.findAllFiltered(where);
    return (data || []).map((s: any) => this.normalizeMoney(s));
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
    return { data: (data || []).map((s: any) => this.normalizeMoney(s)), total };
  }

  /**
   * Normalize Prisma Decimal money fields to plain numbers. Decimals
   * serialize to JSON as strings ("1610.00"); consumers (e.g. the student
   * registry Fees Info tab) do numeric math on them, so hand out numbers.
   * Mirrors the explicit Number() mapping already used in
   * payments.service.getSelfFeesSummary.
   */
  private normalizeMoney(student: any): any {
    if (!student) return student;
    return {
      ...student,
      invoices: (student.invoices || []).map((inv: any) => ({
        ...inv,
        amount: Number(inv.amount),
        paidAmount: Number(inv.paidAmount),
      })),
      payments: (student.payments || []).map((pay: any) => ({
        ...pay,
        amount: Number(pay.amount),
      })),
      billing: student.billing
        ? {
            ...student.billing,
            currentBalance: Number(student.billing.currentBalance),
            initialDeposit: Number(student.billing.initialDeposit),
          }
        : student.billing,
    };
  }

  private buildWhereClause(
    filters: StudentFilters,
  ): Prisma.StudentWhereInput {
    const where: Prisma.StudentWhereInput = {};

    if (filters.search?.trim()) {
      const term = filters.search.trim();
      // 2026-09: search targets the student's own name only — guardian
      // details, portal email, and class/section matching were removed so a
      // parent's name no longer surfaces their child's records here.
      where.studentName = { contains: term, mode: 'insensitive' };
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
    return this.normalizeMoney(student);
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
    guardian2?: { name: string; relationship: string; phone: string; email?: string | null } | null;
    billing: { feeTierId?: string; initialDeposit: number };
    compliance?: { nationalId?: string | null; emergencyContact?: { name?: string | null; phone?: string | null; relationship?: string | null } | null };
    legacyStudentId?: string | null;
  }) {
    const { account, demographics, placement, guardian, parent, guardian2, billing, compliance } = payload;
    const resolvedGuardian = guardian || parent;

    if (!resolvedGuardian) {
      throw new AppError(400, "Missing essential guardian contact relationships from structural payload.");
    }

    // Optional second guardian (enrollment UI allows up to two; the first is
    // the primary/default).
    const resolvedGuardian2 = guardian2 ?? null;
    if (
      resolvedGuardian2 &&
      (!resolvedGuardian2.name?.trim() ||
        !resolvedGuardian2.relationship ||
        !resolvedGuardian2.phone?.trim())
    ) {
      throw new AppError(400, "Second guardian requires a name, relationship and phone.");
    }

    const initialDeposit = Number(billing.initialDeposit);
    if (!Number.isFinite(initialDeposit) || initialDeposit < 0) {
      throw new AppError(400, 'Initial deposit must be a non-negative number.');
    }

    // ── FEE RESOLUTION ─────────────────────────────────────────────
    // Explicit feeTierId (legacy/import path): the tier amount IS the
    // full charge, exactly as before.
    // No feeTierId (enrollment UI): derive from the selected class's
    // fee band — admission + uniform + termly tuition for new enrollees.
    // Both branches below assign these before first use (or throw), so no
    // initializers — eslint no-useless-assignment.
    let feeTier: { id: string; code: string; amount: Prisma.Decimal; isActive: boolean };
    let totalCharge: number;
    let feeBreakdown: string | null = null;

    if (billing.feeTierId) {
      // Frontend may send either the fee tier's UUID (id) or its code (code); try both.
      const looked =
        (await prisma.feeTier.findUnique({ where: { id: billing.feeTierId } })) ??
        (await prisma.feeTier.findUnique({ where: { code: billing.feeTierId } }));
      // D-05: a failed tier lookup must never silently default the tariff to 0.
      // Previously an unresolvable tier enrolled the student with a 0.00 balance
      // and returned 201, so the school never billed them. Fail loudly instead.
      if (!looked) {
        throw new AppError(400, `Unknown fee tier: ${billing.feeTierId}`);
      }
      if (!looked.isActive) {
        throw new AppError(400, `Fee tier ${looked.code} is inactive and cannot be assigned.`);
      }
      feeTier = looked;
      totalCharge = Number(looked.amount);
      if (!Number.isFinite(totalCharge)) {
        throw new AppError(500, `Fee tier ${looked.code} has a non-numeric amount.`);
      }
    } else {
      const cls = await prisma.class.findUnique({
        where: { id: placement.classId },
        select: { name: true },
      });
      const band = feeBandForClass(cls?.name || '');
      if (!band) {
        throw new AppError(
          400,
          `Class "${cls?.name || placement.classId}" has no fee structure. Choose a class from the academic ladder.`,
        );
      }
      const bandTier = await prisma.feeTier.findUnique({ where: { code: band.tierCode } });
      if (!bandTier || !bandTier.isActive) {
        // Fail loudly rather than enrolling unbilled (D-05).
        throw new AppError(500, `Fee band tier ${band.tierCode} is missing or inactive — run the fee-band data script.`);
      }
      feeTier = bandTier;
      totalCharge = band.admission + band.uniform + band.tuition;
      feeBreakdown = `Admission ${band.admission} + Uniform ${band.uniform} + Termly Tuition ${band.tuition}`;
    }

    const resolvedTierId = feeTier.id;
    const computedBalance = Math.max(0, totalCharge - initialDeposit);

    // Cohort id: JCS-<2-digit JHS3 completion year>-<3-digit sequence>.
    // Derived from the class being enrolled into, so peers share a code and
    // the id never changes at promotion. Falls back to the legacy opaque key
    // only when the class is off-ladder, so enrollment can never hard-fail.
    const { studentId: uniqueStudentId, cohortYear: resolvedCohortYear } =
      await this.generateCohortStudentId(placement.classId, account.enrollmentDate);

    // Avoid prisma.$transaction here: Supabase transaction pooler (PgBouncer)
    // rejects interactive transactions (P2028), which surfaces as HTTP 500 on import.
    const hashedPassword = await hashPassword(account.password);

    const dbPayload = {
      studentId: uniqueStudentId,
      cohortYear: resolvedCohortYear,
      legacyStudentId: payload.legacyStudentId?.trim() || null,
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
      guardians: {
        create: [
          { name: resolvedGuardian.name, relationship: resolvedGuardian.relationship, phone: resolvedGuardian.phone, email: resolvedGuardian.email ?? null },
          ...(resolvedGuardian2
            ? [{ name: resolvedGuardian2.name, relationship: resolvedGuardian2.relationship, phone: resolvedGuardian2.phone, email: resolvedGuardian2.email ?? null }]
            : []),
        ],
      },
      billing: { create: { feeTierId: resolvedTierId, initialDeposit: billing.initialDeposit, currentBalance: computedBalance } },
      compliance: { create: { nationalId: compliance?.nationalId ?? null, emergencyName: compliance?.emergencyContact?.name ?? null, emergencyPhone: compliance?.emergencyContact?.phone ?? null, emergencyRelation: compliance?.emergencyContact?.relationship ?? null } },
    };

    // createNestedStudent accepts optional tx; omit tx → uses root prisma client.
    const created = await this.repo.createNestedStudent(dbPayload);

    // New-enrollee path: issue the FIRST TERM 2026/27 invoice for the full
    // band charge (admission + uniform + tuition) so collections and
    // receipts attach to it. Enrollment is deliberately not wrapped in
    // $transaction (PgBouncer P2028), so if invoicing fails the student
    // exists without an invoice — report the student id for manual
    // reconciliation rather than silently returning success.
    if (feeBreakdown) {
      const termStructure = await prisma.feeStructureConfiguration.findUnique({
        where: { sectionId: placement.classId },
        select: { dueDate: true },
      });
      const paidAmount = Math.min(initialDeposit, totalCharge);
      const status: 'UNPAID' | 'PARTIAL' | 'PAID' =
        paidAmount >= totalCharge ? 'PAID' : paidAmount > 0 ? 'PARTIAL' : 'UNPAID';
      try {
        await prisma.invoice.create({
          data: {
            invoiceNo: `INV-${created.studentId}-FT2627`,
            studentId: created.id,
            description: `FIRST TERM 2026/27 invoice | ${feeBreakdown}`,
            amount: totalCharge,
            paidAmount,
            status,
            dueDate: termStructure?.dueDate ?? new Date('2026-11-30'),
          },
        });
      } catch (err) {
        const detail = err instanceof Error ? err.message : 'unknown error';
        throw new AppError(
          500,
          `Student ${created.studentId} was enrolled but the first term invoice could not be issued (${detail}). Reconcile manually.`,
        );
      }
    }

    return created;
  }

  /**
   * Allocate the next cohort id for a student entering `classId`.
   *
   * The sequence is per-cohort and continues from the highest number already
   * issued, so it never reuses a departed student's id. Retries on the unique
   * constraint to survive two concurrent enrollments racing for the same
   * number. Returns the legacy opaque id when the class is off-ladder, so an
   * unmapped class degrades enrollment gracefully instead of blocking it.
   */
  async generateCohortStudentId(
    classId: string,
    enrollmentDate: string | Date
  ): Promise<{ studentId: string; cohortYear: number | null }> {
    const cls = await prisma.class.findUnique({
      where: { id: classId },
      select: { name: true },
    });
    if (!cls) {
      return {
        studentId: formatInstitutionalId("STU", String(new Date().getFullYear())),
        cohortYear: null,
      };
    }

    const year = academicYearOf(new Date(enrollmentDate));
    const cohort = cohortForClass(cls.name, year);
    if (cohort === null) {
      return {
        studentId: formatInstitutionalId("STU", String(new Date().getFullYear())),
        cohortYear: null,
      };
    }

    const prefix = formatStudentId(cohort, 0).slice(0, -3);
    for (let attempt = 0; attempt < 5; attempt++) {
      const peers = await prisma.student.findMany({
        where: { studentId: { startsWith: prefix } },
        select: { studentId: true },
      });
      let highest = 0;
      for (const p of peers) {
        const n = Number(p.studentId.slice(prefix.length));
        if (Number.isFinite(n) && n > highest) highest = n;
      }
      const candidate = formatStudentId(cohort, highest + 1 + attempt);
      const taken = await prisma.student.findUnique({
        where: { studentId: candidate },
        select: { id: true },
      });
      if (!taken) return { studentId: candidate, cohortYear: cohort };
    }

    throw new AppError(
      409,
      `Could not allocate a student id for cohort ${cohort} after 5 attempts.`
    );
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
