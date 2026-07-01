import { PrismaClient } from "@prisma/client";
import process from "process"; // Add this line at the very top

const prisma = new PrismaClient();

async function main() {
  console.log("🚀 Starting database seeding...");

  // ═══════════════════════════════════════════════════════
  // 1. STANDALONE MODULES (No dependencies)
  // ═══════════════════════════════════════════════════════

  // --- LEDGER ACCOUNTS ---
  await prisma.ledgerAccount.createMany({
    data: [
      { code: "1010", accountName: "Cash at Bank", category: "Asset", debit: "15000.00", credit: "0.00" },
      { code: "4000", accountName: "Tuition Fee Revenue", category: "Revenue", debit: "0.00", credit: "25000.00" },
      { code: "5000", accountName: "Salaries & Wages", category: "Expense", debit: "12000.00", credit: "0.00" },
    ],
    skipDuplicates: true,
  });

  // --- TIMETABLE CONFIGURATION ---
  await prisma.timetableConfiguration.create({
    data: {
      sectionId: "jhs-1",
      periodsCount: 3,
      periods: {
        create: [
          { periodNumber: 1, startTime: "08:00", endTime: "09:00" },
          { periodNumber: 2, startTime: "09:00", endTime: "10:00" },
          { periodNumber: 3, startTime: "10:15", endTime: "11:15" },
        ],
      },
      breaks: {
        create: [
          { name: "Morning Break", startTime: "10:00", endTime: "10:15" },
        ],
      },
      subjects: {
        create: [
          { subjectName: "Mathematics", teacherId: "TCH-SCI-456789" }, // Matches teacher below
          { subjectName: "English Language", teacherId: "TCH-LANG-123456" },
        ],
      },
    },
  });

  // --- FEE STRUCTURES ---
  await prisma.feeStructureConfiguration.create({
    data: {
      sectionId: "jhs-1",
      issueDate: new Date("2026-01-10"),
      dueDate: new Date("2026-02-10"),
      allowInstallments: true,
      lateFeeRate: "5.00",
      components: {
        create: [
          { name: "Tuition Fee", amount: "2500.00", frequency: "Per Term", isMandatory: true },
          { name: "Science Lab Fee", amount: "150.00", frequency: "Per Term", isMandatory: true },
          { name: "PTA Dues", amount: "50.00", frequency: "Per Term", isMandatory: false },
        ],
      },
    },
  });

  // ═══════════════════════════════════════════════════════
  // 2. DEPARTED RECORDS (To test your new departure forms)
  // ═══════════════════════════════════════════════════════

  // --- DEPARTED STUDENT ---
  const departedStudent = await prisma.student.create({
    data: {
      studentId: "STU-2025-998877",
      studentName: "Kofi Asante",
      enrollmentDate: new Date("2023-09-05"),
      status: "DEPARTED",
      currentGpa: 2.1,
      attendanceRate: 85.5,
      account: { create: { portalEmail: "kofi.departed@student.edu.gh", passwordHash: "$2b$10$hashedpassword" } },
      demographics: { create: { dateOfBirth: new Date("2010-05-14"), gender: "MALE", residentialAddress: "12 Kokomlemle, Accra" } },
      placement: { create: { classId: "jhs-2", academicTrack: "General Arts", boardingStatus: "DAY" } },
      departures: {
        create: {
          departureType: "TRANSFER",
          effectiveDate: new Date("2025-12-15"),
          destinationInstitution: "Mfantsipim School",
          treasuryClearanceStatus: "FULLY_SETTLED",
          academicRecordsArchived: true,
          remarks: "Transferred by parents due to relocation to Cape Coast."
        }
      }
    }
  });

  // --- DEPARTED TEACHER ---
  const departedTeacher = await prisma.teacher.create({
    data: {
      teacherId: "TCH-SCI-000000",
      teacherName: "Dr. Kwame Bannerman",
      department: "dept-sci",
      subject: "Physics",
      status: "DEPARTED",
      employmentType: "Full-Time",
      email: "dr.bannerman.departed@institution.edu.gh",
      departures: {
        create: {
          departureType: "RESIGNATION",
          effectiveDate: new Date("2025-11-30"),
          academicClearanceStatus: "FINALIZED",
          treasuryClearanceStatus: "FINAL_PAY_PROCESSED",
          remarks: "Resigned to take up a university lecturing position."
        }
      }
    }
  });

  // --- DEPARTED STAFF ---
  const departedStaff = await prisma.staff.create({
    data: {
      staffId: "STF-OPS-000000",
      staffName: "Emmanuel Poku",
      appointmentDate: new Date("2020-01-15"),
      status: "DEPARTED",
      account: { create: { email: "emmanuel.departed@institution.edu.gh", passwordHash: "$2b$10$hashedpassword", role: "STAFF" } },
      departures: {
        create: {
          departureType: "TERMINATION",
          effectiveDate: new Date("2025-10-20"),
          hrClearanceStatus: "CLEARED",
          itAssetReturnStatus: "RETURNED",
          treasuryClearanceStatus: "FINAL_PAY_PROCESSED",
          remarks: "Terminated due to gross misconduct and policy violation."
        }
      }
    }
  });

  // ═══════════════════════════════════════════════════════
  // 3. ACTIVE RECORDS (Full relational mapping)
  // ═══════════════════════════════════════════════════════

  // --- ACTIVE STUDENT (With complex financials and 2 Guardians) ---
  const activeStudent = await prisma.student.create({
    data: {
      studentId: "STU-2026-112233",
      studentName: "Abena Darkwa",
      enrollmentDate: new Date("2024-09-10"),
      status: "ACTIVE",
      currentGpa: 3.8,
      attendanceRate: 99.2,
      account: { create: { portalEmail: "abena.darkwa@student.edu.gh", passwordHash: "$2b$10$hashedpassword" } },
      demographics: { 
        create: { 
          dateOfBirth: new Date("2009-08-22"), 
          gender: "FEMALE", 
          residentialAddress: "Hse 45, Trasacco Valley",
          bloodType: "O_PLUS",
          religion: "Christian"
        } 
      },
      placement: { create: { classId: "jhs-1", academicTrack: "Science", boardingStatus: "BOARDING" } },
      compliance: { create: { nationalId: "GHA-123456789-1", emergencyName: "Nana Darkwa", emergencyPhone: "+233 24 555 0101", emergencyRelation: "Father" } },
      guardians: {
        create: [
          { name: "Nana Darkwa", relationship: "Father", phone: "+233 24 555 0101", email: "nana.darkwa@parent.com" },
          { name: "Ama Darkwa", relationship: "Mother", phone: "+233 20 555 0202", email: "ama.darkwa@parent.com" }
        ]
      },
      billing: { create: { feeTierId: "tier-std", initialDeposit: "500.00", currentBalance: "2200.00" } },
      invoices: {
        create: {
          invoiceNo: "INV-2026-0001",
          description: "Term 1 Tuition & Lab Fees",
          amount: "2650.00",
          dueDate: new Date("2026-02-28")
        }
      },
      payments: {
        create: {
          receiptNo: "REC-2026-1001",
          description: "Partial Fee Payment",
          amount: "500.00",
          paymentType: "Mobile Money"
        }
      }
    }
  });

  // --- ACTIVE TEACHERS ---
  await prisma.teacher.createMany({
    data: [
      {
        teacherId: "TCH-SCI-456789",
        teacherName: "Mr. Ebenezer Appiah",
        department: "dept-sci",
        subject: "Mathematics",
        status: "ACTIVE",
        employmentType: "Full-Time",
        email: "e.appiah@institution.edu.gh",
        yearsOfExperience: 12
      },
      {
        teacherId: "TCH-LANG-123456",
        teacherName: "Ms. Adwoa Fordjour",
        department: "dept-lang",
        subject: "English Language",
        status: "ACTIVE",
        employmentType: "Full-Time",
        email: "a.fordjour@institution.edu.gh",
        yearsOfExperience: 5
      }
    ]
  });

  // --- ACTIVE STAFF (Full Profile) ---
  await prisma.staff.create({
    data: {
      staffId: "STF-FIN-785347",
      staffName: "Samuel Osei Mensah",
      appointmentDate: new Date("2021-03-01"),
      status: "ACTIVE",
      account: { create: { email: "s.mensah@institution.edu.gh", passwordHash: "$2b$10$hashedpassword", role: "FINANCE_CLERK" } },
      demographics: { create: { dateOfBirth: new Date("1988-07-10"), gender: "MALE", residentialAddress: "17 Lapaz, Accra", phone: "+233 50 111 2233" } },
      placement: { create: { departmentId: "dept-fin", jobTitle: "Senior Treasury Accountant", employmentType: "FULL_TIME", shiftSchedule: "MORNING" } },
      compliance: { create: { nationalId: "GHA-987654321-2", ssnitNumber: "N123456789012", emergencyName: "Juliet Mensah", emergencyPhone: "+233 20 111 2244" } },
      payroll: { create: { clearanceTier: "clear-fin", baseSalary: "4500.00", bankName: "GCB Bank", bankAccount: "1011130004521", salaryStatus: "PENDING" } }
    }
  });

  // --- PAYMENT COLLECTIONS ---
  await prisma.paymentCollection.createMany({
    data: [
      { receiptNumber: "COL-2026-001", sectionId: "jhs-1", studentName: "Kwame Mensah Bonsu", amountPaid: "1500.00", paymentMethod: "Cash", referenceNo: "N/A (Direct)", allocationTarget: "Tuition Fee" },
      { receiptNumber: "COL-2026-002", sectionId: "jhs-1", studentName: "Abena Darkwa", amountPaid: "500.00", paymentMethod: "Mobile Money", referenceNo: "MTN-REF-99882", allocationTarget: "Tuition Fee" }
    ]
  });

  console.log("✅ Database seeding completed successfully!");
  console.log("📋 Test Login Credentials:");
  console.log("   Student: abena.darkwa@student.edu.gh");
  console.log("   Staff:   s.mensah@institution.edu.gh");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });