import { PrismaClient, EntityStatus, PayrollStatus, DepartureType, TreasuryClearanceStatus } from "@prisma/client";
import { hashPassword } from "@/utils/hash";

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("SEED PRODUCTION GUARD: Seed script cannot run in production.");
  }

  console.log("🚀 Starting database seeding...");

  // ═══════════════════════════════════════════════════════════
  // PHASE 0: CLEANUP — Delete in FK-safe order (children first)
  // ═══════════════════════════════════════════════════════════
  console.log("🧹 Cleaning existing data...");

  // Delete entities that reference students/teachers/staff
  await prisma.studentDeparture.deleteMany();
  await prisma.teacherDeparture.deleteMany();
  await prisma.staffDeparture.deleteMany();
  await prisma.paymentCollection.deleteMany();
  await prisma.attendanceRecord.deleteMany();
  await prisma.gradeRecord.deleteMany();
  await prisma.refreshToken.deleteMany();

  // Delete main entities (cascades handle nested children)
  await prisma.student.deleteMany();
  await prisma.teacher.deleteMany();
  await prisma.staff.deleteMany();

  // Delete reference/config data
  await prisma.ledgerAccount.deleteMany();
  await prisma.timetableConfiguration.deleteMany();
  await prisma.feeStructureConfiguration.deleteMany();
  await prisma.class.deleteMany();
  await prisma.feeTier.deleteMany();
  await prisma.department.deleteMany();
  await prisma.subject.deleteMany();

  const defaultPasswordHash = await hashPassword("SystemDefaultSecure2026!");

  // ═══════════════════════════════════════════════════════════
  // PHASE 1: REFERENCE / MASTER DATA
  // These must exist before any entity that references them.
  // ═══════════════════════════════════════════════════════════
  console.log("📚 Seeding reference data (classes, departments, subjects, fee tiers)...");

  // ── Classes ──
  const classJhs1 = await prisma.class.create({
    data: { name: "JHS 1", section: "A" },
  });
  const classJhs2 = await prisma.class.create({
    data: { name: "JHS 2", section: "A" },
  });
  const classJhs3 = await prisma.class.create({
    data: { name: "JHS 3", section: "A" },
  });

  // ── Departments ──
  const deptMath = await prisma.department.create({
    data: { name: "Mathematics & Data Science", code: "MATH" },
  });
  const deptScience = await prisma.department.create({
    data: { name: "Natural & Physical Sciences", code: "SCI" },
  });
  const deptFinance = await prisma.department.create({
    data: { name: "Finance & Treasury", code: "FIN" },
  });

  // ── Subjects ──
  const subjAlgebra = await prisma.subject.create({
    data: { name: "Advanced Statistical Algebra", code: "MATH-301" },
  });
  const subjBiochem = await prisma.subject.create({
    data: { name: "Biochemical Foundations", code: "SCI-201" },
  });

  // ── Fee Tiers ──
  const tierStandard = await prisma.feeTier.create({
    data: { name: "Standard Tuition", code: "STD", amount: 2500.00 },
  });
  const tierScholarship = await prisma.feeTier.create({
    data: { name: "Scholarship Exempt", code: "SCH", amount: 0.00 },
  });

  // ═══════════════════════════════════════════════════════════
  // PHASE 2A: LEDGER ACCOUNTS
  // ═══════════════════════════════════════════════════════════
  console.log("📊 Seeding ledger accounts...");
  await prisma.ledgerAccount.createMany({
    data: [
      { code: "1010", accountName: "Cash & Cash Equivalents (Treasury)", category: "ASSET", debit: 50000.00, credit: 0.00 },
      { code: "1200", accountName: "Accounts Receivable (Tuition Control)", category: "ASSET", debit: 12500.00, credit: 0.00 },
      { code: "4010", accountName: "Tuition Inflow Revenue Matrix", category: "REVENUE", debit: 0.00, credit: 62500.00 },
    ],
  });

  // ═══════════════════════════════════════════════════════════
  // PHASE 2B: STUDENTS
  // ═══════════════════════════════════════════════════════════
  console.log("🎓 Seeding students...");

  // Student 1: Active, Standard Tuition, Partial Payment
  await prisma.student.create({
    data: {
      studentId: "STU-2026-8841-A",
      studentName: "Kwame Mensah",
      enrollmentDate: new Date("2026-01-10"),
      status: EntityStatus.ACTIVE,
      currentGpa: 3.85,
      attendanceRate: 96.4,
      account: { create: { portalEmail: "k.mensah@sms-portal.edu.gh", passwordHash: defaultPasswordHash } },
      demographics: { create: { dateOfBirth: new Date("2011-04-15"), gender: "MALE", residentialAddress: "12 Anum Road, Legon, Accra", medicalNotes: "No known allergies.", bloodType: "O+", religion: "Christian", formerSchool: "Morning Star Prep School" } },
      placement: { create: { classId: classJhs1.id, academicTrack: "General Arts", boardingStatus: "DAY_STUDENT" } },
      compliance: { create: { nationalId: "GHA-771829102-4", emergencyName: "Comfort Mensah", emergencyPhone: "+233244111222", emergencyRelation: "MOTHER" } },
      guardians: { create: { name: "Emmanuel Mensah", relationship: "FATHER", phone: "+233204333444", email: "e.mensah@gmail.com" } },
      billing: { create: { feeTierId: tierStandard.id, initialDeposit: 1000.00, currentBalance: 1500.00 } },
      invoices: { create: { invoiceNo: "INV-2026-001", description: "Term 1 Academic Tuition Core Fees", amount: 2500.00, dueDate: new Date("2026-02-01"), status: "PARTIAL" } },
      payments: { create: { receiptNo: "REC-2026-001", description: "Initial Enrollment Deposit Clearance", amount: 1000.00, paymentType: "Mobile Money" } },
    },
  });

  // Student 2: Active, Scholarship Exempt, Fully Paid
  await prisma.student.create({
    data: {
      studentId: "STU-2026-1049-B",
      studentName: "Ama Serwaa Asare",
      enrollmentDate: new Date("2026-01-12"),
      status: EntityStatus.ACTIVE,
      currentGpa: 3.98,
      attendanceRate: 100.0,
      account: { create: { portalEmail: "a.asare@sms-portal.edu.gh", passwordHash: defaultPasswordHash } },
      demographics: { create: { dateOfBirth: new Date("2010-09-22"), gender: "FEMALE", residentialAddress: "Block G, Airport Residential Area, Accra", medicalNotes: null, bloodType: "A-", religion: "Christian", formerSchool: "Ridge Church School" } },
      placement: { create: { classId: classJhs3.id, academicTrack: "Science Lab Alpha", boardingStatus: "BOARDER" } },
      compliance: { create: { nationalId: "GHA-992102938-1", emergencyName: "Grace Asare", emergencyPhone: "+233244888999", emergencyRelation: "AUNT" } },
      guardians: { create: { name: "Dr. Kofi Asare", relationship: "FATHER", phone: "+233266555444", email: "k.asare@health.gov.gh" } },
      billing: { create: { feeTierId: tierScholarship.id, initialDeposit: 0.00, currentBalance: 0.00 } },
    },
  });

  // Student 3: Departed
  const departedStudent = await prisma.student.create({
    data: {
      studentId: "STU-2025-0042-X",
      studentName: "John Papa Yaw Osei",
      enrollmentDate: new Date("2025-01-15"),
      status: EntityStatus.DEPARTED,
      currentGpa: 2.10,
      attendanceRate: 74.2,
      account: { create: { portalEmail: "j.osei@sms-portal.edu.gh", passwordHash: defaultPasswordHash } },
      demographics: { create: { dateOfBirth: new Date("2009-12-05"), gender: "MALE", residentialAddress: "Plot 4, Spintex Road, Accra", medicalNotes: null, bloodType: "B+", religion: "Christian", formerSchool: "Tema International Prep" } },
      placement: { create: { classId: classJhs2.id, academicTrack: "Visual Arts", boardingStatus: "DAY_STUDENT" } },
      compliance: { create: { nationalId: "GHA-123456789-0", emergencyName: "Patricia Osei", emergencyPhone: "+233501234567", emergencyRelation: "MOTHER" } },
      guardians: { create: { name: "Robert Osei", relationship: "FATHER", phone: "+233244123456", email: "r.osei@spintex.com" } },
      billing: { create: { feeTierId: tierStandard.id, initialDeposit: 0.00, currentBalance: 2500.00 } },
      invoices: { create: { invoiceNo: "INV-2025-998", description: "Term 3 Outstanding Core Tuition Balance", amount: 2500.00, dueDate: new Date("2025-11-01"), status: "UNPAID" } },
    },
  });

  await prisma.studentDeparture.create({
    data: {
      studentInternalId: departedStudent.id,
      departureType: DepartureType.TRANSFER,
      effectiveDate: new Date("2026-05-01"),
      destinationInstitution: "Kumasi Academy Senior High",
      treasuryClearanceStatus: TreasuryClearanceStatus.OUTSTANDING_DEBT,
      academicRecordsArchived: true,
      remarks: "Student transferred due to family relocation.",
    },
  });

  // ═══════════════════════════════════════════════════════════
  // PHASE 2C: TEACHERS
  // Teacher.department and Teacher.subject are FK-constrained
  // to Department(id) and Subject(id) respectively.
  // ═══════════════════════════════════════════════════════════
  console.log("🍎 Seeding teachers...");

  await prisma.teacher.create({
    data: {
      teacherId: "TCH-2026-9941",
      teacherName: "Mr. Ebenezer Mensah Kojo",
      department: deptMath.id,
      subject: subjAlgebra.id,
      status: EntityStatus.ACTIVE,
      employmentType: "FULL_TIME",
      email: "e.kojo@sms-institution.edu.gh",
      yearsOfExperience: 8,
      demographics: { create: { dateOfBirth: new Date("1988-06-14"), gender: "MALE", residentialAddress: "Flat 4B, Ridge Court, Accra", phone: "+233244999888", bloodType: "O+", religion: "Christian", formerSchool: "Cape Coast University Faculty of Education" } },
      compliance: { create: { nationalId: "GHA-554102938-9", ssnitNumber: "N8806140001", emergencyName: "Sarah Kojo", emergencyPhone: "+233201223344" } },
      payroll: { create: { clearanceTier: "Level 1: Standard Faculty Access", baseSalary: 4500.00, deductions: 450.00, netPay: 4050.00, bankName: "Ecobank Ghana Ltd", bankAccount: "1441002938411" } },
    },
  });

  await prisma.teacher.create({
    data: {
      teacherId: "TCH-2026-1102",
      teacherName: "Mrs. Abena Boatemaa Boateng",
      department: deptScience.id,
      subject: subjBiochem.id,
      status: EntityStatus.ACTIVE,
      employmentType: "PART_TIME",
      email: "a.boateng@sms-institution.edu.gh",
      yearsOfExperience: 12,
      demographics: { create: { dateOfBirth: new Date("1982-11-30"), gender: "FEMALE", residentialAddress: "Akwapim Ridge Estates, Aburi", phone: "+233266112233", bloodType: "A+", religion: "Christian", formerSchool: "KNUST Faculty of Biochemistry" } },
      compliance: { create: { nationalId: "GHA-221093849-2", ssnitNumber: "N8211300002", emergencyName: "Kofi Boateng", emergencyPhone: "+233244667788" } },
      payroll: { create: { clearanceTier: "Level 2: Department Head / Lead Educator", baseSalary: 7200.00, deductions: 720.00, netPay: 6480.00, bankName: "Standard Chartered Bank", bankAccount: "0100293841900", salaryStatus: PayrollStatus.PENDING } },
    },
  });

  // ═══════════════════════════════════════════════════════════
  // PHASE 2D: STAFF (including bootstrap admin)
  // StaffPlacement.departmentId has NO FK constraint in the DB,
  // so a plain descriptive string is acceptable here.
  // ═══════════════════════════════════════════════════════════
  console.log("⚙️ Seeding staff...");

  await prisma.staff.create({
    data: {
      staffId: "STF-2026-4401",
      staffName: "Phyllis Afriyie",
      appointmentDate: new Date("2026-02-01"),
      status: EntityStatus.ACTIVE,
      account: { create: { email: "p.afriyie@sms-ops.edu.gh", passwordHash: defaultPasswordHash, role: "STAFF" } },
      demographics: { create: { dateOfBirth: new Date("1994-03-25"), gender: "FEMALE", residentialAddress: "Dzorwulu Highway Blocks, Accra", phone: "+233243555666", bloodType: "AB+", religion: "Christian", formerSchool: "University of Ghana Business School" } },
      placement: { create: { departmentId: deptFinance.id, jobTitle: "Senior Treasury Accountant", employmentType: "FULL_TIME", shiftSchedule: "Shift Alpha (08:00 - 17:00)" } },
      compliance: { create: { nationalId: "GHA-990325412-5", ssnitNumber: "S9403250001", emergencyName: "Francis Afriyie", emergencyPhone: "+233544123987" } },
      payroll: { create: { clearanceTier: "Level 2: Financial Ledger Access", baseSalary: 5500.00, deductions: 550.00, netPay: 4950.00, bankName: "Absa Bank Ghana", bankAccount: "509182736" } },
    },
  });

  // ── Bootstrap Admin ──
  // Creates an ADMIN-level staff account so the system is
  // immediately loginable after seeding without manual steps.
  const adminPasswordHash = await hashPassword("AdminDev2026!");

  await prisma.staff.create({
    data: {
      staffId: "STF-ADMIN-0001",
      staffName: "Platform Administrator",
      appointmentDate: new Date(),
      status: EntityStatus.ACTIVE,
      account: { create: { email: "admin@sms.local", passwordHash: adminPasswordHash, role: "ADMIN" } },
    },
  });

  console.log("✅ Seeding complete.");
  console.log("");
  console.log("╔═══════════════════════════════════════════════════╗");
  console.log("║  BOOTSTRAP ADMIN CREDENTIALS                     ║");
  console.log("║  Email:    admin@sms.local                       ║");
  console.log("║  Password: AdminDev2026!                         ║");
  console.log("║  Role:     ADMIN                                 ║");
  console.log("╚═══════════════════════════════════════════════════╝");
}

main()
  .catch((e) => {
    console.error("🚨 Seed failed:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
