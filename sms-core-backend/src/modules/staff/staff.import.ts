import { AppError } from "@/middleware/error.handler";

export type StaffImportUploadedFile = {
  buffer: Buffer;
  originalname: string;
  mimetype?: string;
  size?: number;
};

export type StaffImportError = {
  row: number;
  field?: string;
  message: string;
};

export type StaffImportPayload = {
  account: {
    fullName: string;
    email: string;
    password: string;
    employmentDate: string;
    role: string;
  };
  demographics: {
    dateOfBirth: string;
    gender: string;
    residentialAddress: string;
    phone: string;
    bloodType?: string | null;
    religion?: string | null;
    formerSchool?: string | null;
  };
  placement: {
    departmentId: string;
    jobTitle: string;
    employmentType: string;
    shiftSchedule: string;
  };
  compliance?: {
    nationalId?: string | null;
    ssnitNumber?: string | null;
    emergencyContact?: {
      name?: string | null;
      phone?: string | null;
    } | null;
  };
  payroll: {
    clearanceTier: string;
    baseSalary: number;
    bankName?: string | null;
    bankAccount?: string | null;
  };
};

export type ParsedStaffImportRow = {
  rowNumber: number;
  payload: StaffImportPayload;
};

export type ParsedStaffImportResult = {
  totalRows: number;
  rows: ParsedStaffImportRow[];
  errors: StaffImportError[];
};

const FIELD_ALIASES = {
  fullName: ["fullName", "full name", "staffName", "staff name", "employeeName", "employee name", "name"],
  email: ["email", "portalEmail", "portal email", "staffEmail", "staff email", "employeeEmail", "employee email"],
  password: ["password", "temporaryPassword", "temporary password", "tempPassword", "temp password"],
  employmentDate: ["employmentDate", "employment date", "appointmentDate", "appointment date", "hireDate", "hire date", "startDate", "start date"],
  dateOfBirth: ["dateOfBirth", "date of birth", "dob", "birthDate", "birth date"],
  gender: ["gender", "sex"],
  residentialAddress: ["residentialAddress", "residential address", "address", "homeAddress", "home address"],
  phone: ["phone", "phoneNumber", "phone number", "mobile", "mobileNumber", "mobile number"],
  departmentId: ["departmentId", "department id", "department", "departmentCode", "department code", "departmentName", "department name"],
  jobTitle: ["jobTitle", "job title", "title", "position", "designation"],
  employmentType: ["employmentType", "employment type", "type", "contractType", "contract type"],
  shiftSchedule: ["shiftSchedule", "shift schedule", "shift", "schedule"],
  nationalId: ["nationalId", "national id", "ghanaCard", "ghana card"],
  ssnitNumber: ["ssnitNumber", "ssnit number", "ssnit"],
  emergencyName: ["emergencyName", "emergency name", "emergencyContactName", "emergency contact name"],
  emergencyPhone: ["emergencyPhone", "emergency phone", "emergencyContactPhone", "emergency contact phone"],
  clearanceTier: ["clearanceTier", "clearance tier", "accessLevel", "access level"],
  baseSalary: ["baseSalary", "base salary", "salary", "grossSalary", "gross salary"],
  bankName: ["bankName", "bank name"],
  bankAccount: ["bankAccount", "bank account", "accountNumber", "account number"],
  bloodType: ["bloodType", "blood type"],
  religion: ["religion"],
  formerSchool: ["formerSchool", "former school", "previousSchool", "previous school"],
} as const;

type CanonicalField = keyof typeof FIELD_ALIASES;
type CanonicalRow = Partial<Record<CanonicalField, string>>;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GHANA_CARD_REGEX = /^GHA-\d{9}-\d$/;
const SUPPORTED_EXTENSIONS = [".csv"];
const DEFAULT_IMPORT_PASSWORD = process.env.DEFAULT_IMPORT_PASSWORD || "SystemDefaultSecure2026!";

const ALIAS_LOOKUP = new Map<string, CanonicalField>();

for (const field of Object.keys(FIELD_ALIASES) as CanonicalField[]) {
  for (const alias of FIELD_ALIASES[field]) {
    ALIAS_LOOKUP.set(normalizeKey(alias), field);
  }
}

function normalizeKey(value: string): string {
  return value
    .replace(/^\uFEFF/, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function valueToString(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
}

function parseCsvRows(csv: string): unknown[][] {
  const rows: unknown[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];

    if (character === '"') {
      if (quoted && csv[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }

    if (character === "," && !quoted) {
      row.push(field);
      field = "";
      continue;
    }

    if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && csv[index + 1] === "\n") index += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      continue;
    }

    field += character;
  }

  if (field || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function readWorksheetRows(file: StaffImportUploadedFile): unknown[][] {
  const lowerName = file.originalname.toLowerCase();

  if (!lowerName.endsWith(".csv")) {
    throw new AppError(400, "Only CSV student import files are supported.");
  }

  return parseCsvRows(file.buffer.toString("utf8").replace(/^\uFEFF/, ""));
}

function canonicalizeRow(headers: unknown[], values: unknown[]): CanonicalRow {
  const canonical: CanonicalRow = {};

  headers.forEach((header, index) => {
    const field = ALIAS_LOOKUP.get(normalizeKey(valueToString(header)));

    if (!field) return;

    const value = valueToString(values[index]);

    if (value || canonical[field] === undefined) {
      canonical[field] = value;
    }
  });

  return canonical;
}

function isEmptyRow(row: CanonicalRow): boolean {
  return Object.values(row).every((value) => !value?.trim());
}

function getValue(row: CanonicalRow, field: CanonicalField): string {
  return row[field]?.trim() || "";
}

function optionalValue(row: CanonicalRow, field: CanonicalField): string | null {
  return getValue(row, field) || null;
}

function requiredValue(
  row: CanonicalRow,
  field: CanonicalField,
  label: string,
  rowNumber: number,
  errors: StaffImportError[],
): string {
  const value = getValue(row, field);

  if (!value) {
    errors.push({ row: rowNumber, field, message: `${label} is required.` });
  }

  return value;
}

function normalizeDateValue(
  value: string,
  label: string,
  rowNumber: number,
  errors: StaffImportError[],
  fallback?: string,
): string {
  const resolved = value || fallback || "";

  if (!resolved) {
    errors.push({ row: rowNumber, message: `${label} is required.` });
    return "";
  }

  const parsed = new Date(resolved);

  if (Number.isNaN(parsed.getTime())) {
    errors.push({ row: rowNumber, message: `${label} must be a valid date.` });
    return "";
  }

  return parsed.toISOString();
}

function parseNonNegativeAmount(
  value: string,
  label: string,
  rowNumber: number,
  errors: StaffImportError[],
): number {
  if (!value) return 0;

  const cleaned = value.replace(/,/g, "").replace(/[^0-9.-]/g, "");
  const amount = Number(cleaned);

  if (!Number.isFinite(amount)) {
    errors.push({ row: rowNumber, message: `${label} must be a valid number.` });
    return 0;
  }

  if (amount < 0) {
    errors.push({ row: rowNumber, message: `${label} cannot be negative.` });
    return 0;
  }

  return amount;
}

export function parseStaffImportFile(file: StaffImportUploadedFile): ParsedStaffImportResult {
  const matrix = readWorksheetRows(file);

  if (matrix.length < 2) {
    throw new AppError(400, "The import file must contain a header row and at least one staff row.");
  }

  const headers = matrix[0] || [];
  const hasRecognizedHeader = headers.some((header) => ALIAS_LOOKUP.has(normalizeKey(valueToString(header))));

  if (!hasRecognizedHeader) {
    throw new AppError(
      400,
      "The import header row did not include any recognized staff columns. Include columns like fullName, email, dateOfBirth, gender, phone, residentialAddress, department, jobTitle, employmentType, and baseSalary.",
    );
  }

  const rows: ParsedStaffImportRow[] = [];
  const errors: StaffImportError[] = [];
  let totalRows = 0;

  for (let index = 1; index < matrix.length; index += 1) {
    const rowNumber = index + 1;
    const canonical = canonicalizeRow(headers, matrix[index] || []);

    if (isEmptyRow(canonical)) {
      continue;
    }

    totalRows += 1;

    const rowErrors: StaffImportError[] = [];

    const fullName = requiredValue(canonical, "fullName", "Staff full name", rowNumber, rowErrors);
    const email = requiredValue(canonical, "email", "Staff email", rowNumber, rowErrors).toLowerCase();
    const dateOfBirthRaw = requiredValue(canonical, "dateOfBirth", "Date of birth", rowNumber, rowErrors);
    const gender = requiredValue(canonical, "gender", "Gender", rowNumber, rowErrors);
    const phone = requiredValue(canonical, "phone", "Phone", rowNumber, rowErrors);
    const residentialAddress = requiredValue(canonical, "residentialAddress", "Residential address", rowNumber, rowErrors);
    const departmentId = requiredValue(canonical, "departmentId", "Department", rowNumber, rowErrors);
    const jobTitle = requiredValue(canonical, "jobTitle", "Job title", rowNumber, rowErrors);

    if (email && !EMAIL_REGEX.test(email)) {
      rowErrors.push({ row: rowNumber, field: "email", message: "Staff email must be valid." });
    }

    const password = getValue(canonical, "password") || DEFAULT_IMPORT_PASSWORD;

    if (password.length < 6) {
      rowErrors.push({ row: rowNumber, field: "password", message: "Password must be at least 6 characters." });
    }

    const nationalId = optionalValue(canonical, "nationalId");

    if (nationalId && !GHANA_CARD_REGEX.test(nationalId)) {
      rowErrors.push({
        row: rowNumber,
        field: "nationalId",
        message: "National ID must match GHA-XXXXXXXXX-X.",
      });
    }

    const dateOfBirth = normalizeDateValue(dateOfBirthRaw, "Date of birth", rowNumber, rowErrors);
    const employmentDate = normalizeDateValue(
      getValue(canonical, "employmentDate"),
      "Employment date",
      rowNumber,
      rowErrors,
      new Date().toISOString(),
    );
    const baseSalary = parseNonNegativeAmount(getValue(canonical, "baseSalary"), "Base salary", rowNumber, rowErrors);

    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
      continue;
    }

    rows.push({
      rowNumber,
      payload: {
        account: {
          fullName,
          email,
          password,
          employmentDate,
          role: "STAFF",
        },
        demographics: {
          dateOfBirth,
          gender,
          phone,
          residentialAddress,
          bloodType: optionalValue(canonical, "bloodType"),
          religion: optionalValue(canonical, "religion"),
          formerSchool: optionalValue(canonical, "formerSchool"),
        },
        placement: {
          departmentId,
          jobTitle,
          employmentType: getValue(canonical, "employmentType") || "Full-Time",
          shiftSchedule: getValue(canonical, "shiftSchedule") || "Standard Day",
        },
        compliance: {
          nationalId,
          ssnitNumber: optionalValue(canonical, "ssnitNumber"),
          emergencyContact: {
            name: optionalValue(canonical, "emergencyName"),
            phone: optionalValue(canonical, "emergencyPhone"),
          },
        },
        payroll: {
          clearanceTier: getValue(canonical, "clearanceTier") || "Level 1: Standard Staff Access",
          baseSalary,
          bankName: optionalValue(canonical, "bankName") || "Unconfigured Bank",
          bankAccount: optionalValue(canonical, "bankAccount") || "—",
        },
      },
    });
  }

  if (totalRows === 0) {
    throw new AppError(400, "No staff records were found in the import file.");
  }

  return { totalRows, rows, errors };
}
