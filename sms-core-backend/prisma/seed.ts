import { PrismaClient, EntityStatus, PayrollStatus, DepartureType, PersonnelDepartureType, TreasuryClearanceStatus } from "@prisma/client";
import { hashPassword } from "../src/utils/hash"; // Adjust this path if necessary to resolve your utility engine

const prisma = new PrismaClient();

async function main() {
  console.log("🚀 Starting comprehensive database matrix seeding execution...");

  // Clear existing records to ensure idempotent execution environment
  await prisma.ledgerAccount.deleteMany();
  await prisma.timetableConfiguration.deleteMany();
  await prisma.feeStructureConfiguration.deleteMany();
  await prisma.paymentCollection.deleteMany();
  await prisma.student.deleteMany();
  await prisma.teacher.deleteMany();
  await prisma.staff.deleteMany();  

  const defaultPasswordHash = await hashPassword("SystemDefaultSecure2026!");

  // ═══════════════════════════════════════════════════════════
  // 1. SEED GENERAL LEDGER CHARTS OF ACCOUNTS
  // ═══════════════════════════════════════════════════════════
  console.log("📊 Seeding operational ledger account charts...");
  await prisma.ledgerAccount.createMany({
    data: [
      { code: "1010", accountName: "Cash & Cash Equivalents (Treasury)", category: "ASSET", debit: 50000.00, credit: 0.00 },
      { code: "1200", accountName: "Accounts Receivable (Tuition Control)", category: "ASSET", debit: 12500.00, credit: 0.00 },
      { code: "4010", accountName: "Tuition Inflow Revenue Matrix", category: "REVENUE", debit: 0.00, credit: 62500.00 },
    ],
  });

  // ═══════════════════════════════════════════════════════════
  // 2. SEED SAMPLE STUDENTS (ACTIVE & DEPARTED SPECIMENS)
  // ═══════════════════════════════════════════════════════════
  console.log("🎓 Seeding multi-tiered student registry graphs...");

  // Student 1: Active, Standard Tuition Rate, Partial Payment
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
      placement: { create: { classId: "cls-1", academicTrack: "General Arts", boardingStatus: "DAY_STUDENT" } },
      compliance: { create: { nationalId: "GHA-771829102-4", emergencyName: "Comfort Mensah", emergencyPhone: "+233244111222", emergencyRelation: "MOTHER" } },
      guardians: { create: { name: "Emmanuel Mensah", relationship: "FATHER", phone: "+233204333444", email: "e.mensah@gmail.com" } },
      billing: { create: { feeTierId: "tier-std", initialDeposit: 1000.00, currentBalance: 1500.00 } },
      invoices: {
        create: { invoiceNo: "INV-2026-001", description: "Term 1 Academic Tuition Core Fees", amount: 2500.00, dueDate: new Date("2026-02-01"), status: "PARTIAL" }
      },
      payments: {
        create: { receiptNo: "REC-2026-001", description: "Initial Enrollment Deposit Clearance", amount: 1000.00, paymentType: "Mobile Money" }
      }
    }
  });

  // Student 2: Active, Scholarship Exempt Rate, Fully Paid
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
      placement: { create: { classId: "cls-3", academicTrack: "Science Lab Alpha", boardingStatus: "BOARDER" } },
      compliance: { create: { nationalId: "GHA-992102938-1", emergencyName: "Grace Asare", emergencyPhone: "+233244888999", emergencyRelation: "AUNT" } },
      guardians: { create: { name: "Dr. Kofi Asare", relationship: "FATHER", phone: "+233266555444", email: "k.asare@health.gov.gh" } },
      billing: { create: { feeTierId: "tier-sch", initialDeposit: 0.00, currentBalance: 0.00 } }
    }
  });

  // Student 3: Departed (Offboarded Historical Specimen)
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
      placement: { create: { classId: "cls-2", academicTrack: "Visual Arts", boardingStatus: "DAY_STUDENT" } },
      compliance: { create: { nationalId: "GHA-123456789-0", emergencyName: "Patricia Osei", emergencyPhone: "+233501234567", emergencyRelation: "MOTHER" } },
      guardians: { create: { name: "Robert Osei", relationship: "FATHER", phone: "+233244123456", email: "r.osei@spintex.com" } },
      billing: { create: { feeTierId: "tier-std", initialDeposit: 0.00, currentBalance: 2500.00 } },
      invoices: {
        create: { invoiceNo: "INV-2025-998", description: "Term 3 Outstanding Core Tuition Balance", amount: 2500.00, dueDate: new Date("2025-11-01"), status: "UNPAID" }
      }
    }
  });

  // Seed departure record log linking to internal identifier
  await prisma.studentDeparture.create({
    data: {
      studentInternalId: departedStudent.id,
      departureType: DepartureType.TRANSFER,
      effectiveDate: new Date("2026-05-01"),
      destinationInstitution: "Kumasi Academy Senior High",
      treasuryClearanceStatus: TreasuryClearanceStatus.OUTSTANDING_DEBT,
      academicRecordsArchived: true,
      remarks: "Student transferred due to family relocation out of the Greater Accra Region cluster zones."
    }
  });

  // ═══════════════════════════════════════════════════════════
  // 3. SEED FACULTY MATRIX (TEACHERS)
  // ═══════════════════════════════════════════════════════════
  console.log("🍎 Seeding active faculty nodes...");
  
  await prisma.teacher.create({
    data: {
      teacherId: "TCH-2026-9941",
      teacherName: "Mr. Ebenezer Mensah Kojo",
      department: "Mathematics & Data Science",
      subject: "Advanced Statistical Algebra",
      status: EntityStatus.ACTIVE,
      employmentType: "FULL_TIME",
      email: "e.kojo@sms-institution.edu.gh",
      yearsOfExperience: 8,
      demographics: { create: { dateOfBirth: new Date("1988-06-14"), gender: "MALE", residentialAddress: "Flat 4B, Ridge Court, Accra", phone: "+233244999888", bloodType: "O+", religion: "Christian", formerSchool: "Cape Coast University Faculty of Education" } },
      compliance: { create: { nationalId: "GHA-554102938-9", ssnitNumber: "N8806140001", emergencyName: "Sarah Kojo", emergencyPhone: "+233201223344" } },
      payroll: { create: { clearanceTier: "Level 1: Standard Faculty Access", baseSalary: 4500.00, deductions: 450.00, netPay: 4050.00, bankName: "Ecobank Ghana Ltd", bankAccount: "1441002938411" } }
    }
  });

  await prisma.teacher.create({
    data: {
      teacherId: "TCH-2026-1102",
      teacherName: "Mrs. Abena Boatemaa Boateng",
      department: "Natural & Physical Sciences",
      subject: "Biochemical Foundations",
      status: EntityStatus.ACTIVE,
      employmentType: "PART_TIME",
      email: "a.boateng@sms-institution.edu.gh",
      yearsOfExperience: 12,
      demographics: { create: { dateOfBirth: new Date("1982-11-30"), gender: "FEMALE", residentialAddress: "Akwapim Ridge Estates, Aburi", phone: "+233266112233", bloodType: "A+", religion: "Christian", formerSchool: "KNUST Faculty of Biochemistry" } },
      compliance: { create: { nationalId: "GHA-221093849-2", ssnitNumber: "N8211300002", emergencyName: "Kofi Boateng", emergencyPhone: "+233244667788" } },
      payroll: { create: { clearanceTier: "Level 2: Department Head / Lead Educator", baseSalary: 7200.00, deductions: 720.00, netPay: 6480.00, bankName: "Standard Chartered Bank", bankAccount: "0100293841900", salaryStatus: PayrollStatus.PENDING } }
    }
  });

  // ═══════════════════════════════════════════════════════════
  // 4. SEED OPERATIONAL PERSONNEL (STAFF)
  // ═══════════════════════════════════════════════════════════
  console.log("⚙️ Seeding corporate campus staff ledgers...");
  
  await prisma.staff.create({
    data: {
      staffId: "STF-2026-4401",
      staffName: "Phyllis Afriyie",
      appointmentDate: new Date("2026-02-01"),
      status: EntityStatus.ACTIVE,
      account: { create: { email: "p.afriyie@sms-ops.edu.gh", passwordHash: defaultPasswordHash, role: "STAFF" } },
      demographics: { create: { dateOfBirth: new Date("1994-03-25"), gender: "FEMALE", residentialAddress: "Dzorwulu Highway Blocks, Accra", phone: "+233243555666", bloodType: "AB+", religion: "Christian", formerSchool: "University of Ghana Business School" } },
      placement: { create: { departmentId: "dept-fin", jobTitle: "Senior Treasury Accountant", employmentType: "FULL_TIME", shiftSchedule: "Shift Alpha (08:00 - 17:00)" } },
      compliance: { create: { nationalId: "GHA-990325412-5", ssnitNumber: "S9403250001", emergencyName: "Francis Afriyie", emergencyPhone: "+233544123987" } },
      payroll: { create: { clearanceTier: "Level 2: Financial Ledger Access", baseSalary: 5500.00, deductions: 550.00, netPay: 4950.00, bankName: "Absa Bank Ghana", bankAccount: "509182736" } }
    }
  });

  console.log("✨ Database initialization and matrix pipeline seeding complete.");
}

main()
  .catch((e) => {
    console.error("🚨 Critical failure encountered during execution of seed routines:", e);
    throw new Error("Seed runner pipeline halted execution naturally via fallback interceptor.");
  })
  .finally(async () => {
    await prisma.$disconnect();
  });