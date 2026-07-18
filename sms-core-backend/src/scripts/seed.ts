/* eslint-disable no-console */
import { prisma } from "../lib/prisma";

async function seedDatabase() {
  console.log("🚀 Starting database seeding...");

  try {
    // ═══════════════════════════════════════════════════════
    // 1. DEPARTED RECORDS (Full relational mapping)
    // ═══════════════════════════════════════════════════════

    await prisma.student.create({
      data: {
        studentId: "STU-2025-998877",
        studentName: "Kofi Asante",
        enrollmentDate: new Date("2023-09-05"),
        status: "DEPARTED",
        account: { create: { portalEmail: "kofi.departed@student.edu.gh", passwordHash: "hashedpassword" } },
        demographics: { 
          create: { 
            dateOfBirth: new Date("2010-05-14"), 
            gender: "MALE", 
            residentialAddress: "12 Kokomlemle, Accra",
            bloodType: "A_PLUS",
            religion: "Christian",
            formerSchool: "St. Mary's Preparatory" 
          } 
        },
        placement: { create: { classId: "jhs-2", academicTrack: "General Arts", boardingStatus: "DAY" } },
        compliance: { 
          create: { 
            nationalId: "GHA-000000000-0", 
            emergencyName: "Kwame Asante Sr.", 
            emergencyPhone: "+233 24 000 0000" 
          } 
        },
        departures: {
          create: {
            departureType: "TRANSFER",
            effectiveDate: new Date("2025-12-15"),
            destinationInstitution: "Mfantsipim School",
            treasuryClearanceStatus: "FULLY_SETTLED",
            academicRecordsArchived: true,
            remarks: "Transferred by parents."
          }
        }
      }
    });

    // Note: Teachers now use sequential `create` instead of `createMany` so we can nest their new relational tables
    await prisma.teacher.create({
      data: {
        teacherId: "TCH-SCI-000000",
        teacherName: "Dr. Kwame Bannerman",
        department: "dept-sci",
        subject: "Physics",
        status: "DEPARTED",
        employmentType: "Full-Time",
        email: "dr.bannerman.departed@institution.edu.gh",
        demographics: { create: { dateOfBirth: new Date("1975-11-10"), gender: "MALE", residentialAddress: "Cantonments, Accra", phone: "+233 20 000 0001", bloodType: "O_PLUS", religion: "Christian", formerSchool: "University of Cape Coast" } },
        compliance: { create: { nationalId: "GHA-000000001-1", ssnitNumber: "N000000000001", emergencyName: "Mrs. Bannerman", emergencyPhone: "+233 20 000 0002" } },
        payroll: { create: { clearanceTier: "clear-fin", baseSalary: "8000.00", deductions: "1200.00", netPay: "6800.00", paymentRoute: "BANK_TRANSFER", bankName: "Stanbic Bank", bankAccount: "0000000001", salaryStatus: "DISBURSED" } },
        departures: {
          create: {
            departureType: "RESIGNATION",
            effectiveDate: new Date("2025-11-30"),
            academicClearanceStatus: "CLEARED",
            treasuryClearanceStatus: "CLEARED",
            remarks: "Resigned to take up a university lecturing position."
          }
        }
      }
    });

    await prisma.staff.create({
      data: {
        staffId: "STF-OPS-000000",
        staffName: "Emmanuel Poku",
        appointmentDate: new Date("2020-01-15"),
        status: "DEPARTED",
        account: { create: { email: "emmanuel.departed@institution.edu.gh", passwordHash: "hashedpassword" } },
        demographics: { 
          create: { 
            dateOfBirth: new Date("1985-05-10"), 
            gender: "MALE", 
            residentialAddress: "Madina, Accra", 
            phone: "+233 20 000 0000",
            bloodType: "O_MINUS",
            religion: "Islamic",
            formerSchool: "Accra Polytechnic"
          } 
        },
        placement: { create: { departmentId: "dept-ops", jobTitle: "Driver", employmentType: "FULL_TIME", shiftSchedule: "MORNING" } },
        compliance: { create: { nationalId: "GHA-000000002-2", emergencyName: "Kwame Poku", emergencyPhone: "+233 20 000 0003" } },
        payroll: { create: { clearanceTier: "clear-std", baseSalary: "2000.00", deductions: "0.00", netPay: "2000.00", paymentRoute: "MOBILE_MONEY", salaryStatus: "DISBURSED" } },
        departures: {
          create: {
            departureType: "TERMINATION",
            effectiveDate: new Date("2025-10-20"),
            hrClearanceStatus: "CLEARED",
            itAssetReturnStatus: "CLEARED",
            treasuryClearanceStatus: "CLEARED",
            remarks: "Terminated due to gross misconduct."
          }
        }
      }
    });

    // ═══════════════════════════════════════════════════════
    // 2. ACTIVE RECORDS
    // ═══════════════════════════════════════════════════════

    // --- ACTIVE STUDENT ---
    await prisma.student.create({
      data: {
        studentId: "STU-2026-112233",
        studentName: "Abena Darkwa",
        enrollmentDate: new Date("2024-09-10"),
        status: "ACTIVE",
        currentGpa: 3.8,
        attendanceRate: 99.2,
        account: { create: { portalEmail: "abena.darkwa@student.edu.gh", passwordHash: "hashedpassword" } },
        demographics: { 
          create: { 
            dateOfBirth: new Date("2009-08-22"), 
            gender: "FEMALE", 
            residentialAddress: "Hse 45, Trasacco Valley", 
            bloodType: "O_PLUS",
            religion: "Christian",
            formerSchool: "Alpine Prep School"
          } 
        },
        placement: { create: { classId: "jhs-1", academicTrack: "Science", boardingStatus: "BOARDING" } },
        compliance: { create: { nationalId: "GHA-123456789-1", emergencyName: "Nana Darkwa", emergencyPhone: "+233 24 555 0101" } },
        guardians: {
          create: [
            { name: "Nana Darkwa", relationship: "Father", phone: "+233 24 555 0101", email: "nana@parent.com" },
            { name: "Ama Darkwa", relationship: "Mother", phone: "+233 20 555 0202" }
          ]
        },
        billing: { create: { feeTierId: "tier-std", initialDeposit: "500.00", currentBalance: "2200.00" } },
        invoices: { create: { invoiceNo: "INV-2026-0001", description: "Term 1 Fees", amount: "2650.00", dueDate: new Date("2026-02-28") } },
        payments: { create: { receiptNo: "REC-2026-1001", description: "Partial Fee Payment", amount: "500.00", paymentType: "Mobile Money" } }
      }
    });

    // --- ACTIVE TEACHERS ---
    // Using Promise.all with create() because createMany doesn't support nested relational data
    await Promise.all([
      prisma.teacher.create({
        data: {
          teacherId: "TCH-SCI-456789",
          teacherName: "Mr. Ebenezer Appiah",
          department: "dept-sci",
          subject: "Mathematics",
          status: "ACTIVE",
          employmentType: "Full-Time",
          email: "e.appiah@institution.edu.gh",
          yearsOfExperience: 12,
          demographics: { create: { dateOfBirth: new Date("1985-02-14"), gender: "MALE", residentialAddress: "12 Asofa, Accra", phone: "+233 24 111 3344", bloodType: "B_PLUS", religion: "Christian", formerSchool: "University of Ghana" } },
          compliance: { create: { nationalId: "GHA-111111111-1", ssnitNumber: "N111111111111", emergencyName: "Grace Appiah", emergencyPhone: "+233 20 111 3355" } },
          payroll: { create: { clearanceTier: "clear-fin", baseSalary: "5000.00", deductions: "800.00", netPay: "4200.00", paymentRoute: "BANK_TRANSFER", bankName: "GCB Bank", bankAccount: "1011130004521", salaryStatus: "PENDING" } }
        }
      }),
      prisma.teacher.create({
        data: {
          teacherId: "TCH-LANG-123456",
          teacherName: "Ms. Adwoa Fordjour",
          department: "dept-lang",
          subject: "English Language",
          status: "ACTIVE",
          employmentType: "Full-Time",
          email: "a.fordjour@institution.edu.gh",
          yearsOfExperience: 5,
          demographics: { create: { dateOfBirth: new Date("1992-08-20"), gender: "FEMALE", residentialAddress: "East Legon, Accra", phone: "+233 50 222 3344", bloodType: "A_MINUS", religion: "Christian", formerSchool: "University of Education, Winneba" } },
          compliance: { create: { nationalId: "GHA-222222222-2", ssnitNumber: "N222222222222", emergencyName: "Kofi Fordjour", emergencyPhone: "+233 20 222 3355" } },
          payroll: { create: { clearanceTier: "clear-std", baseSalary: "4500.00", deductions: "600.00", netPay: "3900.00", paymentRoute: "BANK_TRANSFER", bankName: "Ecobank", bankAccount: "2021130004522", salaryStatus: "PENDING" } }
        }
      })
    ]);

    // --- ACTIVE STAFF ---
    await prisma.staff.create({
      data: {
        staffId: "STF-FIN-785347",
        staffName: "Samuel Osei Mensah",
        appointmentDate: new Date("2021-03-01"),
        status: "ACTIVE",
        account: { create: { email: "s.mensah@institution.edu.gh", passwordHash: "hashedpassword", role: "FINANCE_CLERK" } },
        demographics: { 
          create: { 
            dateOfBirth: new Date("1988-07-10"), 
            gender: "MALE", 
            residentialAddress: "17 Lapaz, Accra", 
            phone: "+233 50 111 2233",
            bloodType: "B_PLUS",
            religion: "Christian",
            formerSchool: "University of Ghana" 
          } 
        },
        placement: { create: { departmentId: "dept-fin", jobTitle: "Senior Treasury Accountant", employmentType: "FULL_TIME", shiftSchedule: "MORNING" } },
        compliance: { create: { nationalId: "GHA-987654321-2", ssnitNumber: "N123456789012", emergencyName: "Juliet Mensah", emergencyPhone: "+233 20 111 2244" } },
        // Added new deductions, netPay, and paymentRoute fields
        payroll: { create: { clearanceTier: "clear-fin", baseSalary: "4500.00", deductions: "300.00", netPay: "4200.00", paymentRoute: "BANK_TRANSFER", bankName: "GCB Bank", bankAccount: "1011130004521", salaryStatus: "PENDING" } }
      }
    });

    // --- TIMETABLE ---
    await prisma.timetableConfiguration.create({
      data: {
        sectionId: "jhs-1",
        periodsCount: 3,
        periods: { create: [{ periodNumber: 1, startTime: "08:00", endTime: "09:00" }, { periodNumber: 2, startTime: "09:00", endTime: "10:00" }] },
        breaks: { create: { name: "Morning Break", startTime: "10:00", endTime: "10:15" } },
        subjects: { create: [{ subjectName: "Mathematics", teacherId: "TCH-SCI-456789" }] }
      }
    });

    // --- FINANCE ---
    await prisma.feeStructureConfiguration.create({
      data: {
        sectionId: "jhs-1",
        issueDate: new Date("2026-01-10"),
        dueDate: new Date("2026-02-10"),
        components: { create: [{ name: "Tuition Fee", amount: "2500.00", frequency: "Per Term", isMandatory: true }] }
      }
    });

    console.log("✅ Mock data inserted successfully!");
    
  } catch (error) {
    console.error("❌ Error inserting mock data:", error);
  } finally {
    await prisma.$disconnect();
  }
}

seedDatabase();