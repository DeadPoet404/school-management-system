import {
  AttendanceStatus,
  DepartureType,
  EntityStatus,
  ExpenseStatus,
  InvoiceStatus,
  PayrollStatus,
  Prisma,
  PrismaClient,
  TreasuryClearanceStatus,
} from "@prisma/client"
import { hashPassword } from "@/utils/hash"

const prisma = new PrismaClient()

const maleNames = [
  "Kwame",
  "Kofi",
  "Kojo",
  "Yaw",
  "Kwaku",
  "Daniel",
  "Emmanuel",
  "Isaac",
  "Samuel",
  "Michael",
] as const

const femaleNames = [
  "Ama",
  "Akosua",
  "Abena",
  "Adwoa",
  "Esi",
  "Yaa",
  "Efua",
  "Grace",
  "Mabel",
  "Priscilla",
] as const

const surnames = [
  "Mensah",
  "Asare",
  "Osei",
  "Boateng",
  "Owusu",
  "Adjei",
  "Agyeman",
  "Appiah",
  "Darko",
  "Frimpong",
  "Gyasi",
  "Amankwah",
  "Boadi",
  "Quaye",
  "Tetteh",
] as const

const locations = [
  "East Legon, Accra",
  "Adenta, Accra",
  "Madina, Accra",
  "Dansoman, Accra",
  "Dzorwulu, Accra",
  "Legon, Accra",
  "Tema Community 8",
  "Spintex Road, Accra",
  "Airport Residential Area, Accra",
  "Kasoa, Central Region",
] as const

const banks = [
  "Ecobank Ghana",
  "Absa Bank Ghana",
  "GCB Bank",
  "Stanbic Bank Ghana",
  "Fidelity Bank Ghana",
  "CalBank",
] as const

const paymentMethods = [
  "Mobile Money",
  "Bank Transfer",
  "Cash",
  "POS",
] as const

const weekdays = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
] as const

const pick = <T,>(items: readonly T[], index: number): T => {
  if (items.length === 0) {
    throw new Error("Cannot select an item from an empty array.")
  }

  return items[((index % items.length) + items.length) % items.length]!
}

const daysAgo = (days: number): Date => {
  const date = new Date()
  date.setDate(date.getDate() - days)
  date.setHours(10, 0, 0, 0)
  return date
}

const schoolDaysBack = (count: number): Date[] => {
  const dates: Date[] = []
  let offset = 1

  while (dates.length < count) {
    const date = daysAgo(offset)
    const day = date.getDay()

    if (day !== 0 && day !== 6) {
      dates.push(date)
    }

    offset += 1
  }

  return dates.reverse()
}

const gradeFromScore = (score: number) => {
  if (score >= 80) return { letterGrade: "A", gradePoints: 4 }
  if (score >= 75) return { letterGrade: "B+", gradePoints: 3.5 }
  if (score >= 70) return { letterGrade: "B", gradePoints: 3 }
  if (score >= 65) return { letterGrade: "C+", gradePoints: 2.5 }
  if (score >= 60) return { letterGrade: "C", gradePoints: 2 }
  if (score >= 55) return { letterGrade: "D+", gradePoints: 1.5 }
  if (score >= 50) return { letterGrade: "D", gradePoints: 1 }
  return { letterGrade: "E", gradePoints: 0 }
}

type StudentRow = {
  id: string
  name: string
  classId: string
  feeAmount: number
  status: EntityStatus
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("SEED PRODUCTION GUARD: Seed script cannot run in production.")
  }

  console.log("🚀 Seeding Horizon Heights Academy rich test data...")

  console.log("🧹 Removing old data...")

  await prisma.auditLog.deleteMany()
  await prisma.refreshToken.deleteMany()
  await prisma.studentDeparture.deleteMany()
  await prisma.teacherDeparture.deleteMany()
  await prisma.staffDeparture.deleteMany()
  await prisma.paymentCollection.deleteMany()
  await prisma.attendanceRecord.deleteMany()
  await prisma.gradeRecord.deleteMany()
  await prisma.expense.deleteMany()
  await prisma.invoice.deleteMany()
  await prisma.payment.deleteMany()
  await prisma.student.deleteMany()
  await prisma.teacher.deleteMany()
  await prisma.staff.deleteMany()
  await prisma.feeComponent.deleteMany()
  await prisma.feeStructureConfiguration.deleteMany()
  await prisma.timetableConfiguration.deleteMany()
  await prisma.ledgerAccount.deleteMany()
  await prisma.term.deleteMany()
  await prisma.class.deleteMany()
  await prisma.feeTier.deleteMany()
  await prisma.department.deleteMany()
  await prisma.subject.deleteMany()

  const defaultPasswordHash = await hashPassword("SystemDefaultSecure2026!")
  const adminPasswordHash = await hashPassword("AdminDev2026!")

  console.log("🏫 Creating academic reference data...")

  const classDefinitions: Array<[string, string]> = [
    ["JHS 1A", "A"],
    ["JHS 1B", "B"],
    ["JHS 2A", "A"],
    ["JHS 2B", "B"],
    ["JHS 3A", "A"],
    ["JHS 3B", "B"],
    ["SHS 1A", "A"],
    ["SHS 1B", "B"],
    ["SHS 2A", "A"],
    ["SHS 2B", "B"],
    ["SHS 3A", "A"],
    ["SHS 3B", "B"],
  ]

  const sections = await Promise.all(
    classDefinitions.map(([name, section]) =>
      prisma.class.create({
        data: { name, section },
      })
    )
  )

  const departmentDefinitions: Array<[string, string]> = [
    ["Mathematics Department", "MATH"],
    ["Science Department", "SCI"],
    ["Languages Department", "LANG"],
    ["Humanities Department", "HUM"],
    ["Business Department", "BUS"],
    ["Administration and Finance", "ADMIN"],
  ]

  const departments = await Promise.all(
    departmentDefinitions.map(([name, code]) =>
      prisma.department.create({
        data: { name, code },
      })
    )
  )

  const subjectDefinitions: Array<[string, string]> = [
    ["Mathematics", "MATH-101"],
    ["Integrated Science", "SCI-101"],
    ["English Language", "ENG-101"],
    ["Social Studies", "SOC-101"],
    ["Computing", "ICT-101"],
    ["French", "FRE-101"],
    ["Economics", "ECO-201"],
    ["Financial Accounting", "ACC-201"],
    ["Biology", "BIO-201"],
    ["Physics", "PHY-201"],
    ["Chemistry", "CHE-201"],
    ["Government", "GOV-201"],
  ]

  const subjects = await Promise.all(
    subjectDefinitions.map(([name, code]) =>
      prisma.subject.create({
        data: { name, code },
      })
    )
  )

  const [dayTier, boardingTier, scholarshipTier] = await Promise.all([
    prisma.feeTier.create({
      data: { name: "Standard Day Student", code: "DAY", amount: 4800 },
    }),
    prisma.feeTier.create({
      data: { name: "Boarding Student", code: "BOARD", amount: 7800 },
    }),
    prisma.feeTier.create({
      data: { name: "Academic Scholarship", code: "SCH", amount: 1800 },
    }),
  ])

  const [termOne, termTwo, termThree] = await Promise.all([
    prisma.term.create({
      data: {
        name: "2026 Term 1",
        academicYear: "2025/2026",
        startDate: new Date("2026-01-12"),
        endDate: new Date("2026-04-02"),
      },
    }),
    prisma.term.create({
      data: {
        name: "2026 Term 2",
        academicYear: "2025/2026",
        startDate: new Date("2026-04-20"),
        endDate: new Date("2026-07-24"),
      },
    }),
    prisma.term.create({
      data: {
        name: "2026 Term 3",
        academicYear: "2025/2026",
        startDate: new Date("2026-09-07"),
        endDate: new Date("2026-12-18"),
      },
    }),
  ])

  await prisma.ledgerAccount.createMany({
    data: [
      {
        code: "1010",
        accountName: "Cash and Bank Balances",
        category: "ASSET",
        debit: 428500,
        credit: 0,
      },
      {
        code: "1100",
        accountName: "Mobile Money Clearing",
        category: "ASSET",
        debit: 45200,
        credit: 0,
      },
      {
        code: "1200",
        accountName: "Student Fee Receivables",
        category: "ASSET",
        debit: 286400,
        credit: 0,
      },
      {
        code: "2010",
        accountName: "Payroll Liabilities",
        category: "LIABILITY",
        debit: 0,
        credit: 86500,
      },
      {
        code: "4010",
        accountName: "Tuition and Academic Fees",
        category: "REVENUE",
        debit: 0,
        credit: 1184000,
      },
      {
        code: "4020",
        accountName: "Boarding and Hostel Fees",
        category: "REVENUE",
        debit: 0,
        credit: 326000,
      },
      {
        code: "5010",
        accountName: "Academic Operations Expense",
        category: "EXPENSE",
        debit: 242600,
        credit: 0,
      },
      {
        code: "5020",
        accountName: "Staff Payroll Expense",
        category: "EXPENSE",
        debit: 612000,
        credit: 0,
      },
    ],
  })

  console.log("👩🏾‍🏫 Creating teachers and faculty accounts...")

  const teachers: Array<{ id: string }> = []

  for (let index = 0; index < 30; index += 1) {
    const female = index % 2 === 0
    const firstName = female
      ? pick(femaleNames, index)
      : pick(maleNames, index)
    const surname = pick(surnames, index + 3)
    const department = pick(departments.slice(0, 5), index)
    const subject = pick(subjects, index)
    const baseSalary = 4200 + (index % 8) * 650
    const deductions = Math.round(baseSalary * 0.11)

    const teacher = await prisma.teacher.create({
      data: {
        teacherId: `TCH-2026-${String(index + 1).padStart(4, "0")}`,
        teacherName: `${female ? "Mrs." : "Mr."} ${firstName} ${surname}`,
        department: department.id,
        subject: subject.id,
        status: index >= 28 ? EntityStatus.INACTIVE : EntityStatus.ACTIVE,
        employmentType: index % 5 === 0 ? "PART_TIME" : "FULL_TIME",
        email: `${firstName.toLowerCase()}.${surname.toLowerCase()}${index + 1}@horizon.edu.gh`,
        yearsOfExperience: 2 + (index % 18),
        account: {
          create: {
            email: `faculty${String(index + 1).padStart(2, "0")}@horizon.local`,
            passwordHash: defaultPasswordHash,
            role: "FACULTY",
          },
        },
        demographics: {
          create: {
            dateOfBirth: new Date(1978 + (index % 18), index % 12, 4 + (index % 20)),
            gender: female ? "FEMALE" : "MALE",
            residentialAddress: pick(locations, index),
            phone: `+23324${String(2000000 + index * 173).padStart(7, "0")}`,
            bloodType: pick(["O+", "A+", "B+", "AB+", "O-"], index),
            religion: pick(["Christian", "Muslim"], index),
            formerSchool: pick(["University of Ghana", "KNUST", "UEW", "UCC"], index),
          },
        },
        compliance: {
          create: {
            nationalId: `GHA-T-${String(100000000 + index).slice(-9)}`,
            ssnitNumber: `SSN-T-2026-${String(index + 1).padStart(4, "0")}`,
            emergencyName: `${pick(femaleNames, index + 3)} ${pick(surnames, index + 6)}`,
            emergencyPhone: `+23320${String(3000000 + index * 61).padStart(7, "0")}`,
          },
        },
        payroll: {
          create: {
            clearanceTier: index % 6 === 0 ? "Level 2: Department Lead" : "Level 1: Faculty",
            baseSalary,
            deductions,
            netPay: baseSalary - deductions,
            paymentRoute: "BANK_TRANSFER",
            bankName: pick(banks, index),
            bankAccount: `10${String(582100000 + index * 941)}`,
            salaryStatus:
              index % 4 === 0 ? PayrollStatus.DISBURSED : PayrollStatus.PENDING,
          },
        },
      },
    })

    teachers.push({ id: teacher.id })
  }

  console.log("🧑🏾‍💼 Creating staff and operations records...")

  const staffRoles = [
    "Finance Officer",
    "Accounts Assistant",
    "Admissions Officer",
    "ICT Support Officer",
    "Librarian",
    "School Nurse",
    "Procurement Officer",
    "HR Officer",
    "Security Supervisor",
    "Facilities Coordinator",
    "Administrative Assistant",
    "Transport Coordinator",
  ] as const

  for (let index = 0; index < 35; index += 1) {
    const female = index % 2 !== 0
    const firstName = female
      ? pick(femaleNames, index + 5)
      : pick(maleNames, index + 5)
    const surname = pick(surnames, index + 8)
    const baseSalary = 2600 + (index % 7) * 450
    const deductions = Math.round(baseSalary * 0.1)

    await prisma.staff.create({
      data: {
        staffId: `STF-2026-${String(index + 1).padStart(4, "0")}`,
        staffName: `${firstName} ${surname}`,
        appointmentDate: daysAgo(180 + index * 20),
        status: index >= 33 ? EntityStatus.INACTIVE : EntityStatus.ACTIVE,
        account: {
          create: {
            email: `staff${String(index + 1).padStart(2, "0")}@horizon.local`,
            passwordHash: defaultPasswordHash,
            role: index < 4 ? "ACCOUNTANT" : "STAFF",
          },
        },
        demographics: {
          create: {
            dateOfBirth: new Date(1981 + (index % 17), index % 12, 3 + (index % 20)),
            gender: female ? "FEMALE" : "MALE",
            residentialAddress: pick(locations, index + 2),
            phone: `+23354${String(4000000 + index * 83).padStart(7, "0")}`,
            bloodType: pick(["O+", "A+", "B+", "AB+"], index),
            religion: pick(["Christian", "Muslim"], index + 1),
            formerSchool: pick(["UG", "KNUST", "UCC", "UPSA"], index),
          },
        },
        placement: {
          create: {
            departmentId: pick(departments, index).id,
            jobTitle: pick(staffRoles, index),
            employmentType: index % 6 === 0 ? "CONTRACT" : "FULL_TIME",
            shiftSchedule:
              index % 5 === 0
                ? "Shift B (12:00 - 21:00)"
                : "Shift A (08:00 - 17:00)",
          },
        },
        compliance: {
          create: {
            nationalId: `GHA-S-${String(200000000 + index).slice(-9)}`,
            ssnitNumber: `SSN-S-2026-${String(index + 1).padStart(4, "0")}`,
            emergencyName: `${pick(maleNames, index + 4)} ${pick(surnames, index + 7)}`,
            emergencyPhone: `+23350${String(5000000 + index * 47).padStart(7, "0")}`,
          },
        },
        payroll: {
          create: {
            clearanceTier: "Level 1: Operations",
            baseSalary,
            deductions,
            netPay: baseSalary - deductions,
            paymentRoute: "BANK_TRANSFER",
            bankName: pick(banks, index + 2),
            bankAccount: `20${String(760000000 + index * 733)}`,
            salaryStatus:
              index % 3 === 0 ? PayrollStatus.DISBURSED : PayrollStatus.PENDING,
          },
        },
      },
    })
  }

  await prisma.staff.create({
    data: {
      staffId: "STF-ADMIN-0001",
      staffName: "Platform Administrator",
      appointmentDate: new Date("2026-01-01"),
      status: EntityStatus.ACTIVE,
      account: {
        create: {
          email: "admin@sms.local",
          passwordHash: adminPasswordHash,
          role: "ADMIN",
        },
      },
    },
  })

  console.log("🎓 Creating 300 students, guardians, billing, and departures...")

  const students: StudentRow[] = []

  for (let index = 0; index < 300; index += 1) {
    const female = index % 2 === 0
    const firstName = female
      ? pick(femaleNames, index)
      : pick(maleNames, index)
    const surname = pick(surnames, index + 2)
    const section = pick(sections, index)
    const departed = index >= 282
    const boarder = index % 4 === 0
    const scholarship = index % 14 === 0
    const feeTier = scholarship
      ? scholarshipTier
      : boarder
        ? boardingTier
        : dayTier
    const feeAmount = scholarship ? 1800 : boarder ? 7800 : 4800
    const balance =
      departed || index % 5 === 0
        ? feeAmount
        : index % 5 === 1
          ? Math.round(feeAmount * 0.45)
          : 0

    const student = await prisma.student.create({
      data: {
        studentId: `HHA-${2024 + (index % 3)}-${String(index + 1).padStart(4, "0")}`,
        studentName: `${firstName}${index % 4 === 0 ? ` ${pick(maleNames, index + 3)}` : ""} ${surname}`,
        enrollmentDate: daysAgo(40 + (index % 850)),
        status: departed ? EntityStatus.DEPARTED : EntityStatus.ACTIVE,
        currentGpa: Number((1.6 + ((index * 19) % 240) / 100).toFixed(2)),
        attendanceRate: Number((72 + ((index * 7) % 280) / 10).toFixed(1)),
        account: {
          create: {
            portalEmail: `student${String(index + 1).padStart(3, "0")}@horizon.local`,
            passwordHash: defaultPasswordHash,
          },
        },
        demographics: {
          create: {
            dateOfBirth: new Date(2007 + (index % 7), index % 12, 2 + (index % 25)),
            gender: female ? "FEMALE" : "MALE",
            residentialAddress: pick(locations, index),
            medicalNotes: index % 19 === 0 ? "Asthma inhaler kept with school nurse." : null,
            bloodType: pick(["O+", "A+", "B+", "AB+", "O-"], index),
            religion: pick(["Christian", "Muslim"], index),
            formerSchool: pick(
              ["Bright Future Academy", "Morning Star School", "St. Paul Preparatory"],
              index
            ),
          },
        },
        placement: {
          create: {
            classId: section.id,
            academicTrack: section.name.startsWith("SHS")
              ? pick(["General Science", "General Arts", "Business"], index)
              : "Junior High Core",
            boardingStatus: boarder ? "BOARDER" : "DAY_STUDENT",
          },
        },
        compliance: {
          create: {
            nationalId: `GHA-ST-${String(300000000 + index).slice(-9)}`,
            emergencyName: `${pick(femaleNames, index + 6)} ${pick(surnames, index + 5)}`,
            emergencyPhone: `+23324${String(6000000 + index * 29).padStart(7, "0")}`,
            emergencyRelation: pick(["MOTHER", "FATHER", "AUNT", "UNCLE"], index),
          },
        },
        guardians: {
          create: [
            {
              name: `${pick(maleNames, index + 2)} ${surname}`,
              relationship: "FATHER",
              phone: `+23320${String(7000000 + index * 31).padStart(7, "0")}`,
              email: `guardian${String(index + 1).padStart(3, "0")}@example.test`,
            },
            {
              name: `${pick(femaleNames, index + 4)} ${surname}`,
              relationship: "MOTHER",
              phone: `+23355${String(7100000 + index * 19).padStart(7, "0")}`,
              email: null,
            },
          ],
        },
        billing: {
          create: {
            feeTierId: feeTier.id,
            initialDeposit: feeAmount - balance,
            currentBalance: balance,
          },
        },
      },
    })

    students.push({
      id: student.id,
      name: student.studentName,
      classId: section.id,
      feeAmount,
      status: departed ? EntityStatus.DEPARTED : EntityStatus.ACTIVE,
    })

    if (departed) {
      await prisma.studentDeparture.create({
        data: {
          studentInternalId: student.id,
          departureType:
            index % 2 === 0
              ? DepartureType.TRANSFER
              : DepartureType.GRADUATION,
          effectiveDate: daysAgo(25 + index),
          destinationInstitution:
            index % 2 === 0
              ? "New Dawn Academy"
              : "Completed programme",
          treasuryClearanceStatus:
            index % 3 === 0
              ? TreasuryClearanceStatus.OUTSTANDING_DEBT
              : TreasuryClearanceStatus.FULLY_SETTLED,
          academicRecordsArchived: true,
          remarks: "Fictional development-data departure record.",
        },
      })
    }
  }

  console.log("💳 Creating financial history...")

  const invoices: Prisma.InvoiceCreateManyInput[] = []
  const payments: Prisma.PaymentCreateManyInput[] = []
  const collections: Prisma.PaymentCollectionCreateManyInput[] = []

  for (const [index, student] of students.entries()) {
    for (let termIndex = 0; termIndex < 2; termIndex += 1) {
      const amount = student.feeAmount
      const paidAmount =
        index % 5 === 0
          ? 0
          : index % 5 === 1
            ? Math.round(amount * 0.55)
            : amount

      const invoiceNo = `INV-2026-${String(index * 2 + termIndex + 1).padStart(5, "0")}`

      invoices.push({
        invoiceNo,
        studentId: student.id,
        description: `2026 Term ${termIndex + 1} Academic and Student Services Fees`,
        amount,
        paidAmount,
        dueDate: daysAgo(100 - termIndex * 65),
        status:
          paidAmount === 0
            ? InvoiceStatus.UNPAID
            : paidAmount < amount
              ? InvoiceStatus.PARTIAL
              : InvoiceStatus.PAID,
      })

      if (paidAmount > 0) {
        const receiptNo = `REC-2026-${String(index * 2 + termIndex + 1).padStart(5, "0")}`

        payments.push({
          receiptNo,
          studentId: student.id,
          description: `Payment against ${invoiceNo}`,
          amount: paidAmount,
          paymentType: pick(paymentMethods, index + termIndex),
          createdAt: daysAgo(95 - termIndex * 55 - (index % 20)),
        })

        collections.push({
          receiptNumber: `COL-2026-${String(index * 2 + termIndex + 1).padStart(5, "0")}`,
          sectionId: student.classId,
          studentName: student.name,
          amountPaid: paidAmount,
          paymentMethod: pick(paymentMethods, index + termIndex),
          referenceNo: `HHA-PAY-${String(index * 11 + termIndex).padStart(6, "0")}`,
          allocationTarget: invoiceNo,
          dateProcessed: daysAgo(95 - termIndex * 55 - (index % 20)),
          studentInternalId: student.id,
        })
      }
    }
  }

  await prisma.invoice.createMany({ data: invoices })
  await prisma.payment.createMany({ data: payments })
  await prisma.paymentCollection.createMany({ data: collections })

  await prisma.expense.createMany({
    data: Array.from({ length: 100 }, (_, index) => ({
      expenseNo: `EXP-2026-${String(index + 1).padStart(4, "0")}`,
      vendorName: pick(
        [
          "Ghana Education Supplies Ltd",
          "Accra Utilities",
          "TechBridge Ghana",
          "Prime Catering Services",
          "Metro Transport Services",
        ],
        index
      ),
      category: pick(
        ["Utilities", "Learning Materials", "ICT", "Transport", "Catering", "Maintenance"],
        index
      ),
      description: "Fictional development expense for finance dashboard testing.",
      amount: 450 + ((index * 379) % 12400),
      paymentMethod: pick(paymentMethods, index),
      status:
        index % 8 === 0
          ? ExpenseStatus.PENDING_APPROVAL
          : ExpenseStatus.CLEARED,
      expenseDate: daysAgo(index % 90),
      processedBy: "admin@sms.local",
    })),
  })

  console.log("📚 Creating grades and attendance history...")

  const activeStudents = students.filter(
    (student) => student.status === EntityStatus.ACTIVE
  )

  const grades: Prisma.GradeRecordCreateManyInput[] = []

  for (const [studentIndex, student] of activeStudents.entries()) {
    for (let subjectIndex = 0; subjectIndex < 8; subjectIndex += 1) {
      for (const term of [termOne, termTwo, termThree]) {
        const continuousAssessment =
          42 + ((studentIndex * 7 + subjectIndex * 11) % 48)
        const examination =
          38 + ((studentIndex * 13 + subjectIndex * 5) % 58)
        const finalScore = Number(
          (continuousAssessment * 0.4 + examination * 0.6).toFixed(2)
        )
        const grade = gradeFromScore(finalScore)

        grades.push({
          studentId: student.id,
          subjectId: pick(subjects, subjectIndex).id,
          classId: student.classId,
          termId: term.id,
          continuousAssessment,
          examination,
          finalScore,
          letterGrade: grade.letterGrade,
          gradePoints: grade.gradePoints,
          creditHours: subjectIndex < 5 ? 3 : 2,
        })
      }
    }
  }

  await prisma.gradeRecord.createMany({ data: grades })

  const attendanceDates = schoolDaysBack(35)
  const attendance: Prisma.AttendanceRecordCreateManyInput[] = []

  for (const [studentIndex, student] of activeStudents.entries()) {
    for (const [dateIndex, date] of attendanceDates.entries()) {
      const selector = (studentIndex * 17 + dateIndex * 7) % 100

      attendance.push({
        studentId: student.id,
        date,
        status:
          selector < 87
            ? AttendanceStatus.PRESENT
            : selector < 93
              ? AttendanceStatus.LATE
              : selector < 97
                ? AttendanceStatus.EXCUSED
                : AttendanceStatus.ABSENT,
        remarks: selector >= 97 ? "Parent notified of absence." : null,
      })
    }
  }

  await prisma.attendanceRecord.createMany({ data: attendance })

  console.log("🗓️ Creating timetables and fee structures...")

  for (const [sectionIndex, section] of sections.entries()) {
    await prisma.timetableConfiguration.create({
      data: {
        sectionId: section.id,
        periodsCount: 7,
        periods: {
          create: Array.from({ length: 7 }, (_, periodIndex) => ({
            periodNumber: periodIndex + 1,
            dayOfWeek: "MONDAY",
            startTime: `${String(8 + periodIndex).padStart(2, "0")}:00`,
            endTime: `${String(8 + periodIndex).padStart(2, "0")}:45`,
          })),
        },
        breaks: {
          create: [
            {
              name: "Morning Break",
              dayOfWeek: "MONDAY",
              startTime: "10:30",
              endTime: "10:50",
            },
          ],
        },
        subjects: {
          create: subjects.slice(0, 8).map((subject, subjectIndex) => ({
            subjectName: subject.name,
            teacherId: pick(teachers, sectionIndex + subjectIndex).id,
            dayOfWeek: pick(weekdays, subjectIndex),
          })),
        },
      },
    })

    await prisma.feeStructureConfiguration.create({
      data: {
        sectionId: section.id,
        issueDate: new Date("2026-04-20"),
        dueDate: new Date("2026-05-20"),
        allowInstallments: true,
        lateFeeRate: 3.5,
        components: {
          create: [
            {
              name: "Academic Tuition",
              amount: section.name.startsWith("SHS") ? 3200 : 2200,
              frequency: "TERM",
              isMandatory: true,
            },
            {
              name: "Examination and Assessment",
              amount: 450,
              frequency: "TERM",
              isMandatory: true,
            },
            {
              name: "ICT and Digital Learning",
              amount: 350,
              frequency: "TERM",
              isMandatory: true,
            },
          ],
        },
      },
    })
  }

  console.log("✅ Rich fictional test data seed complete.")
  console.log("")
  console.log("════════════════════════════════════════════════════")
  console.log("ADMIN LOGIN")
  console.log("Email:    admin@sms.local")
  console.log("Password: AdminDev2026!")
  console.log("")
  console.log("FACULTY LOGIN")
  console.log("Email:    faculty01@horizon.local")
  console.log("Password: SystemDefaultSecure2026!")
  console.log("")
  console.log("STAFF LOGIN")
  console.log("Email:    staff01@horizon.local")
  console.log("Password: SystemDefaultSecure2026!")
  console.log("════════════════════════════════════════════════════")
}

main()
  .catch((error) => {
    console.error("🚨 Rich seed failed:", error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })