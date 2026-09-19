import { AppError } from '@/middleware/error.handler';
import { prisma } from "@/lib/prisma";
import { capStringFields } from "@/lib/capitalize";
import type { ClassListPdfData, TranscriptPdfData, TranscriptTermSection } from "@/lib/pdf";
import { titleCaseTerm } from "@/lib/pdf";
import { Prisma, EntityStatus, DepartureType, TreasuryClearanceStatus, FamilyDiscountRule } from "@prisma/client";
import { IStudentRepository } from "@/types/repositories";
import { StudentRepository } from "./student.repository";
import { formatInstitutionalId } from "@/utils";
import { academicYearOf, cohortForClass, formatStudentId } from "@/lib/student-id";
import { hashPassword } from "@/utils/hash";
import { parseStudentImportFile, type StudentImportError, type StudentImportUploadedFile } from "./student.import";
import { FinanceService } from "@/modules/finance/finance.service";
import { ENROLLMENT_UMBRELLA } from "@/lib/fee-allocation";
import { normalizeGuardianEmail, normalizeGuardianPhone } from "@/lib/guardian-contact";

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

type GuardianContactInput = {
  phone?: string | null;
  email?: string | null;
};

type FamilyMatchStudent = {
  id: string;
  studentId: string;
  studentName: string;
  className: string | null;
  familyGroupId: string | null;
  matchReason: string;
};

type ResolvedFamilyDiscount = {
  amount: number;
  rule: FamilyDiscountRule;
  academicYear: number;
  approvedBy: string | null;
  reason: string;
};

function phoneSearchValues(value: string): string[] {
  const trimmed = value.trim();
  const digits = value.replace(/\D/g, '');
  const canonical = normalizeGuardianPhone(value);
  const values = new Set<string>();
  for (const candidate of [trimmed, digits, canonical]) {
    if (candidate) values.add(candidate);
  }
  if (canonical.startsWith('233')) {
    values.add(`0${canonical.slice(3)}`);
    values.add(`+${canonical}`);
  }
  return [...values];
}

function guardianMatchWhere(input: GuardianContactInput): Prisma.GuardianWhereInput | null {
  const or: Prisma.GuardianWhereInput[] = [];
  const phoneValues = input.phone ? phoneSearchValues(input.phone) : [];
  const phoneNormalized = normalizeGuardianPhone(input.phone);
  if (phoneValues.length > 0) {
    or.push({
      OR: [
        { phoneNormalized },
        { phone: { in: phoneValues } },
      ],
    });
  }

  const email = normalizeGuardianEmail(input.email);
  if (email) {
    or.push({
      OR: [
        { emailNormalized: email },
        { email: { equals: email, mode: 'insensitive' } },
      ],
    });
  }

  return or.length > 0 ? { OR: or } : null;
}

function familyMatchKey(input: GuardianContactInput): string {
  const phone = input.phone ? normalizeGuardianPhone(input.phone) : '';
  if (phone) return `phone:${phone}`;
  const email = input.email?.trim().toLowerCase() || '';
  return `email:${email}`;
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
  constructor(
    private repo: IStudentRepository = new StudentRepository(),
    private readonly financeService: FinanceService = new FinanceService(),
  ) {}

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

  /**
   * SMS-009: roster data for the printable class-list PDF.
   * Active students only (departed students stay off the list), A–Z by name.
   */
  async getClassListForPdf(classId: string): Promise<ClassListPdfData> {
    const cls = await prisma.class.findFirst({
      where: { id: classId, deletedAt: null },
      select: { name: true },
    });
    if (!cls) throw new AppError(404, 'Class not found.');

    // 2026-09: selectable print columns need date of birth, the primary
    // guardian, and the current fee balance. A class roster is small, so
    // fetching the extras unconditionally is cheaper than conditional
    // queries and keeps the print payload complete for any column mix.
    const students = await prisma.student.findMany({
      where: { status: EntityStatus.ACTIVE, placement: { classId } },
      include: {
        demographics: { select: { gender: true, dateOfBirth: true } },
        guardians: { select: { name: true, phone: true } },
        billing: { select: { currentBalance: true } },
      },
      orderBy: { studentName: 'asc' },
    });

    const term = await prisma.term.findFirst({
      where: { isActive: true, deletedAt: null },
      select: { name: true, academicYear: true },
    });

    return {
      className: cls.name,
      termName: term ? titleCaseTerm(term.name) : 'First Term',
      academicYear: term?.academicYear ?? '2026/2027',
      dateOfIssue: new Date(),
      students: students.map((s) => ({
        name: s.studentName,
        studentId: s.studentId,
        gender: s.demographics?.gender?.trim() || null,
        dob: s.demographics?.dateOfBirth ? s.demographics.dateOfBirth.toISOString() : null,
        guardian: s.guardians[0]?.name?.trim() || null,
        guardianPhone: s.guardians[0]?.phone?.trim() || null,
        feesOwed: s.billing ? Number(s.billing.currentBalance) : null,
      })),
    };
  }

  async getAll() {
    return (await this.repo.findAll()).map((s: any) => this.normalizeMoney(s));
  }

  /**
   * Find possible existing wards using the primary guardian contact.
   * Matching is deliberately advisory: this method never creates a family,
   * changes a student, or applies a discount. Staff must confirm the result
   * during enrollment before the new student is attached to a family group.
   */
  async getFamilyMatches(phone?: string, email?: string) {
    const contact = { phone: phone?.trim() || null, email: email?.trim() || null };
    const where = guardianMatchWhere(contact);
    if (!where) {
      throw new AppError(400, 'A guardian phone number or email address is required for family matching.');
    }

    const students = await prisma.student.findMany({
      where: {
        status: { not: EntityStatus.DEPARTED },
        guardians: { some: where },
      },
      select: {
        id: true,
        studentId: true,
        studentName: true,
        familyGroupId: true,
        guardians: { where, select: { phone: true, phoneNormalized: true, email: true, emailNormalized: true } },
        placement: { select: { class: { select: { name: true } } } },
      },
      orderBy: { studentName: 'asc' },
    });

    const familyGroupIds = [...new Set(students.map((student) => student.familyGroupId).filter((id): id is string => Boolean(id)))];
    let currentWardCount = students.length;
    let familyGroupId: string | null = familyGroupIds.length === 1 ? familyGroupIds[0]! : null;

    if (familyGroupId) {
      currentWardCount = await prisma.student.count({
        where: { familyGroupId, status: { not: EntityStatus.DEPARTED } },
      });
    }

    return {
      familyGroupId,
      currentWardCount,
      projectedWardCount: currentWardCount + 1,
      matches: students.map<FamilyMatchStudent>((student) => ({
        id: student.id,
        studentId: student.studentId,
        studentName: student.studentName,
        className: student.placement?.class?.name ?? null,
        familyGroupId: student.familyGroupId,
        matchReason: [
          ...(contact.phone && student.guardians.some((guardian) =>
            guardian.phoneNormalized === normalizeGuardianPhone(contact.phone) ||
            phoneSearchValues(contact.phone!).includes(guardian.phone.trim())
          ) ? ['phone'] : []),
          ...(contact.email && student.guardians.some((guardian) =>
            guardian.emailNormalized === normalizeGuardianEmail(contact.email) ||
            guardian.email?.trim().toLowerCase() === contact.email?.trim().toLowerCase()
          ) ? ['email'] : []),
        ].join(' + ') || 'contact',
      })),
    };
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
            creditBalance: Number(student.billing.creditBalance),
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

  private async resolveConfirmedFamily(input: {
    guardian: GuardianContactInput & { name: string };
    confirmed: boolean;
    startNewFamily: boolean;
    matchedStudentIds: string[];
  }): Promise<{
    familyGroupId: string | null;
    matchedStudentIds: string[];
    currentWardCount: number;
    projectedWardCount: number;
  }> {
    const uniqueStudentIds = [...new Set(input.matchedStudentIds.filter(Boolean))];

    if (input.confirmed && input.startNewFamily) {
      throw new AppError(400, 'Choose either the confirmed existing family or the new family-group action, not both.');
    }

    if (!input.confirmed && !input.startNewFamily) {
      if (uniqueStudentIds.length > 0) {
        throw new AppError(409, 'Possible family matches require an explicit staff decision before enrollment can continue.');
      }
      return {
        familyGroupId: null,
        matchedStudentIds: [],
        currentWardCount: 0,
        projectedWardCount: 1,
      };
    }

    if (input.startNewFamily && uniqueStudentIds.length > 0) {
      throw new AppError(409, 'Starting a new family group cannot include existing matched students. Confirm the existing family instead.');
    }

    const where = guardianMatchWhere(input.guardian);
    if (!where) {
      throw new AppError(400, 'Family confirmation requires a guardian phone number or email address.');
    }

    if (input.startNewFamily) {
      const possibleExistingMatches = await prisma.student.count({
        where: {
          status: { not: EntityStatus.DEPARTED },
          guardians: { some: where },
        },
      });
      if (possibleExistingMatches > 0) {
        throw new AppError(409, 'Existing students match this guardian contact. Confirm the existing family instead of starting a new group.');
      }

      const matchKey = familyMatchKey(input.guardian);
      const familyGroup = await prisma.familyGroup.upsert({
        where: { matchKey },
        update: {
          familyName: input.guardian.name.trim() || null,
          primaryPhone: input.guardian.phone?.trim() || null,
          primaryEmail: normalizeGuardianEmail(input.guardian.email),
        },
        create: {
          matchKey,
          familyName: input.guardian.name.trim() || null,
          primaryPhone: input.guardian.phone?.trim() || null,
          primaryEmail: normalizeGuardianEmail(input.guardian.email),
        },
      });
      const currentWardCount = await prisma.student.count({
        where: { familyGroupId: familyGroup.id, status: { not: EntityStatus.DEPARTED } },
      });
      return {
        familyGroupId: familyGroup.id,
        matchedStudentIds: [],
        currentWardCount,
        projectedWardCount: currentWardCount + 1,
      };
    }

    if (uniqueStudentIds.length === 0) {
      throw new AppError(400, 'Staff family confirmation requires at least one matched existing student.');
    }

    // Re-check both the selected ids and the contact match server-side. The
    // browser result is only a prompt and must not be trusted as confirmation.
    const matchedStudents = await prisma.student.findMany({
      where: {
        id: { in: uniqueStudentIds },
        status: { not: EntityStatus.DEPARTED },
        guardians: { some: where },
      },
      select: { id: true, familyGroupId: true },
    });

    if (matchedStudents.length !== uniqueStudentIds.length) {
      throw new AppError(409, 'One or more selected family matches changed or no longer match the guardian contact. Search again before confirming.');
    }

    const existingGroupIds = [...new Set(matchedStudents.map((student) => student.familyGroupId).filter((id): id is string => Boolean(id)))];
    if (existingGroupIds.length > 1) {
      throw new AppError(409, 'The selected students belong to different family groups. Resolve the existing family records before enrolling this ward.');
    }

    const matchKey = familyMatchKey(input.guardian);
    const familyGroup = existingGroupIds.length === 1
      ? await prisma.familyGroup.update({
          where: { id: existingGroupIds[0]! },
          data: {
            familyName: input.guardian.name.trim() || null,
            primaryPhone: input.guardian.phone?.trim() || null,
            primaryEmail: normalizeGuardianEmail(input.guardian.email),
          },
        })
      : await prisma.familyGroup.upsert({
          where: { matchKey },
          update: {
            familyName: input.guardian.name.trim() || null,
            primaryPhone: input.guardian.phone?.trim() || null,
            primaryEmail: normalizeGuardianEmail(input.guardian.email),
          },
          create: {
            matchKey,
            familyName: input.guardian.name.trim() || null,
            primaryPhone: input.guardian.phone?.trim() || null,
            primaryEmail: normalizeGuardianEmail(input.guardian.email),
          },
        });

    // Do not attach any other possible match implicitly. Only the student ids
    // explicitly confirmed by staff are added to this group.
    await prisma.student.updateMany({
      where: { id: { in: uniqueStudentIds } },
      data: { familyGroupId: familyGroup.id },
    });

    const currentWardCount = await prisma.student.count({
      where: { familyGroupId: familyGroup.id, status: { not: EntityStatus.DEPARTED } },
    });

    return {
      familyGroupId: familyGroup.id,
      matchedStudentIds: uniqueStudentIds,
      currentWardCount,
      projectedWardCount: currentWardCount + 1,
    };
  }

  private async resolveFamilyDiscount(input: {
    requested: boolean;
    familyGroupId: string | null;
    projectedWardCount: number;
    academicYear: number;
    approvedBy?: string | null;
    reason?: string | null;
  }): Promise<ResolvedFamilyDiscount | null> {
    if (!input.requested) return null;

    if (!input.familyGroupId) {
      throw new AppError(400, 'A confirmed family group is required before a family discount can be applied.');
    }

    const reason = input.reason?.trim() || '';
    if (!reason) {
      throw new AppError(400, 'A staff reason is required when applying a family discount.');
    }

    let rule: FamilyDiscountRule;
    let amount: number;
    if (input.projectedWardCount === 3) {
      rule = FamilyDiscountRule.THREE_WARDS;
      amount = 300;
    } else if (input.projectedWardCount >= 4) {
      rule = FamilyDiscountRule.FOUR_PLUS_WARDS;
      amount = 700;
    } else {
      throw new AppError(400, 'The family discount is available only for a third or fourth-plus active ward.');
    }

    const existing = await prisma.familyDiscountApplication.findUnique({
      where: {
        familyGroupId_academicYear: {
          familyGroupId: input.familyGroupId,
          academicYear: input.academicYear,
        },
      },
      select: { id: true },
    });
    if (existing) {
      throw new AppError(409, `A family discount has already been applied to this family for academic year ${input.academicYear}.`);
    }

    return {
      amount,
      rule,
      academicYear: input.academicYear,
      approvedBy: input.approvedBy ?? null,
      reason,
    };
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
    familyMatchConfirmed?: boolean;
    familyMatchStudentIds?: string[];
    familyGroupStartConfirmed?: boolean;
    applyFamilyDiscount?: boolean;
    familyDiscountReason?: string | null;
    approvedBy?: string | null;
  }) {
    const {
      account,
      demographics,
      placement,
      guardian,
      parent,
      guardian2,
      billing,
      compliance,
      familyMatchConfirmed = false,
      familyMatchStudentIds = [],
      familyGroupStartConfirmed = false,
      applyFamilyDiscount = false,
      familyDiscountReason = null,
      approvedBy = null,
    } = payload;
    const resolvedGuardian = guardian || parent;

    if (!resolvedGuardian) {
      throw new AppError(400, "Missing essential guardian contact relationships from structural payload.");
    }

    // 2026-09 "no small letters" rule: entered text is stored in capitals.
    // Emails are excluded everywhere — they are matched case-sensitively
    // for logins and the fees portal.
    capStringFields(account, ['fullName']);
    capStringFields(demographics, ['residentialAddress', 'medicalNotes', 'bloodType', 'religion', 'formerSchool', 'gender']);
    capStringFields(placement, ['academicTrack', 'boardingStatus']);
    capStringFields(payload, ['legacyStudentId']);
    capStringFields(resolvedGuardian, ['name', 'relationship']);
    if (guardian2) capStringFields(guardian2, ['name', 'relationship']);
    if (compliance) {
      capStringFields(compliance, ['nationalId']);
      if (compliance.emergencyContact) capStringFields(compliance.emergencyContact, ['name', 'relationship']);
    }

    // Portal email must never collide with a staff/teacher account (a
    // collision makes the staff/teacher unable to log in, because account
    // lookup prefers the student row) or with another student's portal.
    const portalEmail = account.email.trim().toLowerCase();
    const [staffCollision, teacherCollision, studentCollision] = await Promise.all([
      prisma.staffAccount.findUnique({ where: { email: portalEmail }, select: { id: true } }),
      prisma.teacherAccount.findUnique({ where: { email: portalEmail }, select: { id: true } }),
      prisma.studentAccount.findUnique({ where: { portalEmail }, select: { id: true } }),
    ]);
    if (staffCollision) {
      throw new AppError(409, "That portal email is already in use by a staff account — the enrollment form auto-generates one from the student's name; pick a different address.");
    }
    if (teacherCollision) {
      throw new AppError(409, "That portal email is already in use by a teacher account — the enrollment form auto-generates one from the student's name; pick a different address.");
    }
    if (studentCollision) {
      throw new AppError(409, "That portal email is already in use by another student — pick a different address.");
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

    // Cohort id: JCS-<2-digit JHS3 completion year>-<3-digit sequence>.
    // Derived from the class being enrolled into, so peers share a code and
    // the id never changes at promotion. Falls back to the legacy opaque key
    // only when the class is off-ladder, so enrollment can never hard-fail.
    const { studentId: uniqueStudentId, cohortYear: resolvedCohortYear } =
      await this.generateCohortStudentId(placement.classId, account.enrollmentDate);

    // Avoid prisma.$transaction here: Supabase transaction pooler (PgBouncer)
    // rejects interactive transactions (P2028), which surfaces as HTTP 500 on import.
    const hashedPassword = await hashPassword(account.password);

    const familyEnrollment = await this.resolveConfirmedFamily({
      guardian: resolvedGuardian,
      confirmed: familyMatchConfirmed,
      startNewFamily: familyGroupStartConfirmed,
      matchedStudentIds: familyMatchStudentIds,
    });

    if (applyFamilyDiscount && !feeBreakdown) {
      throw new AppError(400, 'Family discounts can only be applied to a new enrollment invoice.');
    }

    const familyDiscount = await this.resolveFamilyDiscount({
      requested: applyFamilyDiscount,
      familyGroupId: familyEnrollment.familyGroupId,
      projectedWardCount: familyEnrollment.projectedWardCount,
      academicYear: academicYearOf(new Date(account.enrollmentDate)),
      approvedBy,
      reason: familyDiscountReason,
    });
    const invoiceAmount = feeBreakdown
      ? Math.max(0, totalCharge - (familyDiscount?.amount ?? 0))
      : totalCharge;
    // Band path (enrollment UI): the ledger opens at the invoice amount and
    // the deposit is processed below as a real collection, so the same cash
    // can never be counted twice. Legacy imports retain their old behavior.
    const computedBalance = feeBreakdown ? invoiceAmount : Math.max(0, totalCharge - initialDeposit);

    const dbPayload = {
      studentId: uniqueStudentId,
      cohortYear: resolvedCohortYear,
      legacyStudentId: payload.legacyStudentId?.trim() || null,
      studentName: account.fullName,
      enrollmentDate: new Date(account.enrollmentDate),
      status: "ACTIVE" as const,
      currentGpa: 0.0,
      attendanceRate: 100.0,
      ...(familyEnrollment.familyGroupId
        ? { familyGroup: { connect: { id: familyEnrollment.familyGroupId } } }
        : {}),
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
          {
            name: resolvedGuardian.name,
            relationship: resolvedGuardian.relationship,
            phone: resolvedGuardian.phone,
            phoneNormalized: normalizeGuardianPhone(resolvedGuardian.phone),
            email: resolvedGuardian.email ?? null,
            emailNormalized: normalizeGuardianEmail(resolvedGuardian.email),
          },
          ...(resolvedGuardian2
            ? [{
                name: resolvedGuardian2.name,
                relationship: resolvedGuardian2.relationship,
                phone: resolvedGuardian2.phone,
                phoneNormalized: normalizeGuardianPhone(resolvedGuardian2.phone),
                email: resolvedGuardian2.email ?? null,
                emailNormalized: normalizeGuardianEmail(resolvedGuardian2.email),
              }]
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
    let depositReceipt: { receiptNumber: string; collectionId: string } | null = null;

    if (feeBreakdown) {
      const termStructure = await prisma.feeStructureConfiguration.findUnique({
        where: { sectionId: placement.classId },
        select: { dueDate: true },
      });
      const invoiceNo = `INV-${created.studentId}-FT2627`;
      let invoice: { id: string };
      try {
        // The invoice opens at zero paid: every payment applied to it
        // (including the initial deposit below) flows through the standard
        // collection pipeline exactly once.
        invoice = await prisma.invoice.create({
          data: {
            invoiceNo,
            studentId: created.id,
            description: `FIRST TERM 2026/27 invoice | ${feeBreakdown}${familyDiscount ? ` | Family discount ${familyDiscount.amount}` : ''}`,
            amount: invoiceAmount,
            discountAmount: familyDiscount?.amount ?? 0,
            discountDescription: familyDiscount
              ? `Family discount: ${familyDiscount.rule === FamilyDiscountRule.THREE_WARDS ? '3 wards' : '4+ wards'}`
              : null,
            paidAmount: 0,
            status: 'UNPAID',
            dueDate: termStructure?.dueDate ?? new Date('2026-11-30'),
          },
          select: { id: true },
        });
      } catch (err) {
        const detail = err instanceof Error ? err.message : 'unknown error';
        throw new AppError(
          500,
          `Student ${created.studentId} was enrolled but the first term invoice could not be issued (${detail}). Reconcile manually.`,
        );
      }

      if (familyDiscount) {
        try {
          await prisma.familyDiscountApplication.create({
            data: {
              familyGroupId: familyEnrollment.familyGroupId!,
              studentId: created.id,
              invoiceId: invoice.id,
              academicYear: familyDiscount.academicYear,
              amount: familyDiscount.amount,
              rule: familyDiscount.rule,
              approvedBy: familyDiscount.approvedBy,
              reason: familyDiscount.reason,
            },
          });
        } catch (err) {
          const detail = err instanceof Error ? err.message : 'unknown error';
          throw new AppError(
            500,
            `Student ${created.studentId} was enrolled and invoiced, but the family discount audit record could not be saved (${detail}). Reconcile manually.`,
          );
        }
      }

      // An initial deposit is real cash on hand: process it through the
      // standard collection pipeline (receipt + payment + ledger decrement
      // + invoice application) so it is counted exactly once — and the
      // receipt system is triggered just like for any other payment.
      // Baking it into invoice.paidAmount/ledger here (previous behavior)
      // made the same cash double-counted when the deposit was later
      // recorded to produce its receipt, flipping the invoice to PAID
      // while the balance was still owed.
      if (initialDeposit > 0) {
        try {
          const collection = await this.financeService.processInflowCollection({
            sectionId: placement.classId,
            studentName: created.studentName,
            amountPaid: Math.min(initialDeposit, invoiceAmount),
            paymentMethod: 'CASH',
            referenceNo: invoiceNo,
            // The umbrella label marks this as a first-term enrollment
            // payment: its receipt renders the class fee breakdown
            // (Admission + Uniform + Termly Tuition), not a single line.
            allocationTarget: ENROLLMENT_UMBRELLA,
            studentInternalId: created.id,
          });
          depositReceipt = { receiptNumber: collection.receiptNumber, collectionId: collection.id };
        } catch (err) {
          const detail = err instanceof Error ? err.message : 'unknown error';
          throw new AppError(
            500,
            `Student ${created.studentId} was enrolled but the initial deposit could not be recorded (${detail}). Reconcile manually.`,
          );
        }
      }
    }

    return {
      ...created,
      depositReceipt,
      familyEnrollment: {
        ...familyEnrollment,
        discount: familyDiscount
          ? {
              amount: familyDiscount.amount,
              rule: familyDiscount.rule,
              academicYear: familyDiscount.academicYear,
            }
          : null,
      },
    };
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

    // 2026-09 "no small letters" rule (see createStudent). Emails excluded.
    capStringFields(data, ['studentName']);
    if (demo) capStringFields(demo, ['residentialAddress', 'medicalNotes', 'bloodType', 'religion', 'formerSchool', 'gender']);
    if (data.placement) capStringFields(data.placement as Record<string, unknown>, ['academicTrack', 'boardingStatus']);
    if (data.compliance) capStringFields(data.compliance as Record<string, unknown>, ['nationalId', 'emergencyName', 'emergencyRelation']);
    if (data.guardian) capStringFields(data.guardian as Record<string, unknown>, ['name', 'relationship']);

    return this.repo.update(id, data);
  }

}
