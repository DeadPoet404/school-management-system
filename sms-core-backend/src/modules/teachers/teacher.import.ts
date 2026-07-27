import { AppError } from "@/middleware/error.handler";
import * as XLSX from "xlsx";

export type TeacherImportUploadedFile = {
  buffer: Buffer;
  originalname: string;
  mimetype?: string;
  size?: number;
};

export type TeacherImportError = {
  row: number;
  field?: string;
  message: string;
};

export type TeacherImportPayload = {
  account: {
    fullName: string;
    email: string;
    password: string;
  };
  placement?: {
    departmentId?: string;
    jobTitle?: string;
    employmentType?: string;
  };
  demographics: {
    gender: string;
    dateOfBirth: string;
    phone: string;
    residentialAddress: string;
    bloodType?: string;
    religion?: string;
    formerSchool?: string;
  };
  compliance?: {
    nationalId?: string | null;
    ssnitNumber?: string | null;
    emergencyContact?: {
      name?: string | null;
      phone?: string | null;
    } | null;
  } | null;
  payroll?: {
    clearanceTier?: string | null;
    baseSalary?: number | null;
    bankName?: string | null;
    bankAccount?: string | null;
    paymentRoute?: string | null;
  } | null;
};

export type ParsedTeacherImportRow = {
  rowNumber: number;
  payload: TeacherImportPayload;
};

export type ParsedTeacherImportResult = {
  totalRows: number;
  rows: ParsedTeacherImportRow[];
  errors: TeacherImportError[];
};

const FIELD_ALIASES = {
  fullName: ["fullName", "full name", "teacherName", "teacher name", "facultyName", "faculty name", "name"],
  email: ["email", "portalEmail", "portal email", "teacherEmail", "teacher email", "facultyEmail", "faculty email"],
  password: ["password", "temporaryPassword", "temporary password", "tempPassword", "temp password"],
  dateOfBirth: ["dateOfBirth", "date of birth", "dob", "birthDate", "birth date"],
  gender: ["gender", "sex"],
  residentialAddress: ["residentialAddress", "residential address", "address", "homeAddress", "home address"],
  phone: ["phone", "phoneNumber", "phone number", "mobile", "mobileNumber", "mobile number"],
  departmentId: ["departmentId", "department id", "department", "departmentCode", "department code", "departmentName", "department name"],
  jobTitle: ["jobTitle", "job title", "subject", "subjectId", "subject id", "designation", "roleTitle", "role title"],
  employmentType: ["employmentType", "employment type", "type", "contractType", "contract type"],
  nationalId: ["nationalId", "national id", "ghanaCard", "ghana card"],
  ssnitNumber: ["ssnitNumber", "ssnit number", "ssnit"],
  emergencyName: ["emergencyName", "emergency name", "emergencyContactName", "emergency contact name"],
  emergencyPhone: ["emergencyPhone", "emergency phone", "emergencyContactPhone", "emergency contact phone"],
  clearanceTier: ["clearanceTier", "clearance tier", "accessLevel", "access level"],
  baseSalary: ["baseSalary", "base salary", "salary", "grossSalary", "gross salary"],
  bankName: ["bankName", "bank name"],
  bankAccount: ["bankAccount", "bank account", "accountNumber", "account number"],
  paymentRoute: ["paymentRoute", "payment route", "paymentMethod", "payment method"],
  bloodType: ["bloodType", "blood type"],
  religion: ["religion"],
  formerSchool: ["formerSchool", "former school", "previousSchool", "previous school"],
} as const;

type CanonicalField = keyof typeof FIELD_ALIASES;
type CanonicalRow = Partial<Record<CanonicalField, string>>;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SUPPORTED_EXTENSIONS = [".csv", ".xlsx", ".xls"];
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

function readWorksheetRows(file: TeacherImportUploadedFile): unknown[][] {
  const lowerName = file.originalname.toLowerCase();

  if (!SUPPORTED_EXTENSIONS.some((extension) => lowerName.endsWith(extension))) {
    throw new AppError(400, "Only CSV, XLSX, and XLS teacher import files are supported.");
  }

  const workbook = lowerName.endsWith(".csv")
    ? XLSX.read(file.buffer.toString("utf8"), { type: "string", raw: false })
    : XLSX.read(file.buffer, { type: "buffer", cellDates: false, raw: false });

  const sheetName = workbook.SheetNames[0];

  if (!sheetName) {
    throw new AppError(400, "The import file does not contain a worksheet.");
  }

  const sheet = workbook.Sheets[sheetName];

  if (!sheet) {
    throw new AppError(400, "The import worksheet could not be read.");
  }

  return XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    raw: false,
    blankrows: false,
  }) as unknown[][];
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
  errors: TeacherImportError[],
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
  errors: TeacherImportError[],
): string {
  if (!value) {
    errors.push({ row: rowNumber, message: `${label} is required.` });
    return "";
  }

  const parsed = new Date(value);

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
  errors: TeacherImportError[],
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

export function parseTeacherImportFile(file: TeacherImportUploadedFile): ParsedTeacherImportResult {
  const matrix = readWorksheetRows(file);

  if (matrix.length < 2) {
    throw new AppError(400, "The import file must contain a header row and at least one teacher row.");
  }

  const headers = matrix[0] || [];
  const hasRecognizedHeader = headers.some((header) => ALIAS_LOOKUP.has(normalizeKey(valueToString(header))));

  if (!hasRecognizedHeader) {
    throw new AppError(
      400,
      "The import header row did not include any recognized teacher columns. Include columns like fullName, email, dateOfBirth, gender, phone, residentialAddress, department, employmentType, and baseSalary.",
    );
  }

  const rows: ParsedTeacherImportRow[] = [];
  const errors: TeacherImportError[] = [];
  let totalRows = 0;

  for (let index = 1; index < matrix.length; index += 1) {
    const rowNumber = index + 1;
    const canonical = canonicalizeRow(headers, matrix[index] || []);

    if (isEmptyRow(canonical)) {
      continue;
    }

    totalRows += 1;

    const rowErrors: TeacherImportError[] = [];

    const fullName = requiredValue(canonical, "fullName", "Teacher full name", rowNumber, rowErrors);
    const email = requiredValue(canonical, "email", "Teacher email", rowNumber, rowErrors).toLowerCase();
    const dateOfBirthRaw = requiredValue(canonical, "dateOfBirth", "Date of birth", rowNumber, rowErrors);
    const gender = requiredValue(canonical, "gender", "Gender", rowNumber, rowErrors);
    const phone = requiredValue(canonical, "phone", "Phone", rowNumber, rowErrors);
    const residentialAddress = requiredValue(canonical, "residentialAddress", "Residential address", rowNumber, rowErrors);
    const password = getValue(canonical, "password") || DEFAULT_IMPORT_PASSWORD;

    if (email && !EMAIL_REGEX.test(email)) {
      rowErrors.push({ row: rowNumber, field: "email", message: "Teacher email must be valid." });
    }

    if (password.length < 6) {
      rowErrors.push({ row: rowNumber, field: "password", message: "Password must be at least 6 characters." });
    }

    const dateOfBirth = normalizeDateValue(dateOfBirthRaw, "Date of birth", rowNumber, rowErrors);
    const baseSalary = parseNonNegativeAmount(getValue(canonical, "baseSalary"), "Base salary", rowNumber, rowErrors);

    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
      continue;
    }

    const departmentId = optionalValue(canonical, "departmentId");
    const jobTitle = getValue(canonical, "jobTitle") || "Teacher";
    const employmentType = getValue(canonical, "employmentType") || "Full-Time";

    rows.push({
      rowNumber,
      payload: {
        account: {
          fullName,
          email,
          password,
        },
        placement: {
          departmentId: departmentId ?? undefined,
          jobTitle,
          employmentType,
        },
        demographics: {
          gender,
          dateOfBirth,
          phone,
          residentialAddress,
          bloodType: optionalValue(canonical, "bloodType") ?? undefined,
          religion: optionalValue(canonical, "religion") ?? undefined,
          formerSchool: optionalValue(canonical, "formerSchool") ?? undefined,
        },
        compliance: {
          nationalId: optionalValue(canonical, "nationalId"),
          ssnitNumber: optionalValue(canonical, "ssnitNumber"),
          emergencyContact: {
            name: optionalValue(canonical, "emergencyName"),
            phone: optionalValue(canonical, "emergencyPhone"),
          },
        },
        payroll: {
          clearanceTier: optionalValue(canonical, "clearanceTier") || "Level 1: Standard Faculty Access",
          baseSalary,
          bankName: optionalValue(canonical, "bankName") || "Unconfigured Bank",
          bankAccount: optionalValue(canonical, "bankAccount") || "—",
          paymentRoute: optionalValue(canonical, "paymentRoute") || "BANK_TRANSFER",
        },
      },
    });
  }

  if (totalRows === 0) {
    throw new AppError(400, "No teacher records were found in the import file.");
  }

  return { totalRows, rows, errors };
}
