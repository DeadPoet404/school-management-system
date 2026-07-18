import { z } from "zod";

// Base account component found in all variants
const baseAccountSchema = z.object({
  fullName: z.string().min(1, "Full legal name is required."),
  email: z.string().email("A valid portal access email layout is mandatory."),
  password: z.string().min(6, "Temporary security token must be at least 6 characters."),
  enrollmentDate: z.string().min(1, "Official date assignment tag is required."),
});

// Student Enrollment Shape
export const studentEnrollmentSchema = z.object({
  account: baseAccountSchema,
  demographics: z.object({
    dateOfBirth: z.string().min(1, "Date of birth is required."),
    gender: z.string().min(1, "Gender identity selection is required."),
    residentialAddress: z.string().min(1, "Primary residential address is mandatory."),
    medicalNotes: z.string().nullable(),
    bloodType: z.string().nullable(),
    religion: z.string().nullable(),
    formerSchool: z.string().nullable(),
  }),
  placement: z.object({
    classId: z.string().min(1, "Assigned cohort class unit is required."),
    academicTrack: z.string().min(1, "Academic specialization track selection is required."),
    boardingStatus: z.string().min(1, "Institutional housing configuration is required."),
  }),
  compliance: z.object({
    nationalId: z.string().regex(/^GHA-\d{9}-\d$/, "National ID must match GHA-XXXXXXXXX-X").nullable(),
    emergencyContact: z.object({
      name: z.string().nullable(),
      phone: z.string().nullable(),
      relationship: z.string().nullable(),
    }),
  }),
  parent: z.object({
    name: z.string().min(1, "Primary guardian legal name is required."),
    relationship: z.string().min(1, "Guardian connection matrix selection is required."),
    phone: z.string().min(1, "Guardian primary contact phone number is mandatory."),
    email: z.string().nullable(),
  }).optional(), // Standardized to handle nested client structure
  billing: z.object({
    feeTierId: z.string().min(1, "Assigned billing tier configuration is required."),
    initialDeposit: z.number().nonnegative("Initial ledger deposit cannot fall below 0.00."),
  }),
});

// Teacher Enrollment Shape
export const teacherEnrollmentSchema = z.object({
  account: baseAccountSchema,
  demographics: z.object({
    dateOfBirth: z.string().min(1),
    gender: z.string().min(1),
    residentialAddress: z.string().min(1),
    phone: z.string().min(1, "Primary mobile contact number is mandatory."),
    bloodType: z.string().nullable(),
    religion: z.string().nullable(),
    formerSchool: z.string().nullable(),
  }),
  placement: z.object({
    departmentId: z.string().min(1, "Department assignment tag is required."),
    jobTitle: z.string().min(1, "Core academic designation title is required."),
    employmentType: z.string().min(1, "Employment type classification is mandatory."),
  }).optional(),
  compliance: z.object({
    nationalId: z.string().min(1, "Statutory ID registration reference is required."),
    ssnitNumber: z.string().min(1, "SSNIT registration parameters are mandatory."),
    emergencyContact: z.object({
      name: z.string().min(1),
      phone: z.string().min(1),
    }),
  }).optional(),
  payroll: z.object({
    clearanceTier: z.string().min(1),
    baseSalary: z.number().nonnegative(),
    bankName: z.string().min(1),
    bankAccount: z.string().min(1),
  }).optional(),
});

// Staff Enrollment Shape
export const staffEnrollmentSchema = z.object({
  account: baseAccountSchema.extend({ role: z.literal("STAFF") }),
  demographics: z.object({
    dateOfBirth: z.string().min(1),
    gender: z.string().min(1),
    residentialAddress: z.string().min(1),
    phone: z.string().min(1),
    bloodType: z.string().nullable(),
    religion: z.string().nullable(),
    formerSchool: z.string().nullable(),
  }),
  placement: z.object({
    departmentId: z.string().min(1),
    jobTitle: z.string().min(1),
    employmentType: z.string().min(1),
    shiftSchedule: z.string().min(1),
  }),
  compliance: z.object({
    nationalId: z.string().regex(/^GHA-\d{9}-\d$/, "National ID must match GHA-XXXXXXXXX-X").nullable(),
    ssnitNumber: z.string().nullable(),
    emergencyContact: z.object({
      name: z.string().nullable(),
      phone: z.string().nullable(),
    }),
  }),
  payroll: z.object({
    clearanceTier: z.string().min(1),
    baseSalary: z.number().nonnegative(),
    bankName: z.string().min(1),
    bankAccount: z.string().min(1),
  }),
});

// Student Lifecycle Offboarding Guard
export const studentDepartureSchema = z.object({
  studentId: z.string().min(1, "Target record reference key is required."),
  departureType: z.string().min(1, "Excision status categorization classification is required."),
  effectiveDate: z.string().min(1, "Effective deactivation timeline parameters are required."),
  disposition: z.object({
    destinationInstitution: z.string().default("N/A"),
    treasuryClearanceStatus: z.string().min(1, "Treasury financial ledger clearance evaluation is mandatory."),
    academicRecordsArchived: z.boolean(),
  }),
  remarks: z.string().optional(),
});

// Teacher Lifecycle Offboarding Guard
export const teacherDepartureSchema = z.object({
  teacherId: z.string().min(1, "Target faculty reference key is required."),
  departureType: z.string().min(1, "Departure categorization is required."),
  effectiveDate: z.string().min(1, "Effective execution date is required."),
  clearance: z.object({
    academic: z.string().min(1, "Academic roster portfolio handover status is mandatory."),
    treasury: z.string().min(1, "Treasury disbursement ledger verification status is required."),
  }),
  remarks: z.string().optional(),
});

// Staff Lifecycle Offboarding Guard
export const staffDepartureSchema = z.object({
  staffId: z.string().min(1, "Target staff member identity token is required."),
  departureType: z.string().min(1),
  effectiveDate: z.string().min(1),
  clearance: z.object({
    hr: z.string().min(1, "Human Resources exit check verification status is required."),
    itAssets: z.string().min(1, "IT hardware asset return tracking status is required."),
    treasury: z.string().min(1, "Treasury finance ledger clearance sign-off is mandatory."),
  }),
  remarks: z.string().optional(),
});