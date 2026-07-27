import { AppError } from "@/middleware/error.handler";
import * as XLSX from "xlsx";

export type StudentImportUploadedFile = {
  buffer: Buffer;
  originalname: string;
  mimetype?: string;
  size?: number;
};

export type StudentImportError = {
  row: number;
  field?: string;
  message: string;
};

export type StudentImportPayload = {
  account: {
    fullName: string;
    email: string;
    password: string;
    enrollmentDate: string;
  };
  demographics: {
    dateOfBirth: string;
    gender: string;
    residentialAddress: string;
    medicalNotes: string | null;
    bloodType: string | null;
    religion: string | null;
    formerSchool: string | null;
  };
  placement: {
    classId: string;
    academicTrack: string;
    boardingStatus: string;
  };
  compliance: {
    nationalId: string | null;
    emergencyContact: {
      name: string | null;
      phone: string | null;
      relationship: string | null;
    };
  };
  guardian: {
    name: string;
    relationship: string;
    phone: string;
    email: string | null;
  };
  billing: {
    feeTierId: string;
    initialDeposit: number;
  };
};

export type ParsedStudentImportRow = {
  rowNumber: number;
  payload: StudentImportPayload;
};

export type ParsedStudentImportResult = {
  totalRows: number;
  rows: ParsedStudentImportRow[];
  errors: StudentImportError[];
};

const FIELD_ALIASES = {
  fullName: ["fullName", "full name", "studentName", "student name", "name"],
  email: ["email", "portalEmail", "portal email", "studentEmail", "student email"],
  password: ["password", "temporaryPassword", "temporary password", "tempPassword", "temp password"],
  enrollmentDate: ["enrollmentDate", "enrollment date", "admissionDate", "admission date", "dateOfEnrollment", "date of enrollment"],
  dateOfBirth: ["dateOfBirth", "date of birth", "dob", "birthDate", "birth date"],
  gender: ["gender", "sex"],
  residentialAddress: ["residentialAddress", "residential address", "address", "homeAddress", "home address"],
  classId: ["classId", "class id", "class", "className", "class name", "grade", "gradeLevel", "grade level"],
  academicTrack: ["academicTrack", "academic track", "track", "program", "stream"],
  boardingStatus: ["boardingStatus", "boarding status", "boarding", "housing", "dayBoarding", "day boarding"],
  guardianName: ["guardianName", "guardian name", "parentName", "parent name"],
  guardianRelationship: ["guardianRelationship", "guardian relationship", "relationship", "parentRelationship", "parent relationship"],
  guardianPhone: ["guardianPhone", "guardian phone", "parentPhone", "parent phone", "phone"],
  guardianEmail: ["guardianEmail", "guardian email", "parentEmail", "parent email"],
  feeTierId: ["feeTierId", "fee tier id", "feeTier", "fee tier", "feeTierCode", "fee tier code", "feeTierName", "fee tier name", "billingTier", "billing tier"],
  initialDeposit: ["initialDeposit", "initial deposit", "deposit", "amountPaid", "amount paid", "openingDeposit", "opening deposit"],
  nationalId: ["nationalId", "national id", "ghanaCard", "ghana card"],
  emergencyName: ["emergencyName", "emergency name", "emergencyContactName", "emergency contact name"],
  emergencyPhone: ["emergencyPhone", "emergency phone", "emergencyContactPhone", "emergency contact phone"],
  emergencyRelationship: ["emergencyRelationship", "emergency relationship", "emergencyContactRelationship", "emergency contact relationship"],
  medicalNotes: ["medicalNotes", "medical notes", "medical"],
  bloodType: ["bloodType", "blood type"],
  religion: ["religion"],
  formerSchool: ["formerSchool", "former school", "previousSchool", "previous school"],
} as const;

type CanonicalField = keyof typeof FIELD_ALIASES;
type CanonicalRow = Partial<Record<CanonicalField, string>>;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GHANA_CARD_REGEX = /^GHA-\d{9}-\d$/;
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

function readWorksheetRows(file: StudentImportUploadedFile): unknown[][] {
  const lowerName = file.originalname.toLowerCase();

  if (!SUPPORTED_EXTENSIONS.some((extension) => lowerName.endsWith(extension))) {
    throw new AppError(400, "Only CSV, XLSX, and XLS student import files are supported.");
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
  errors: StudentImportError[],
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
  errors: StudentImportError[],
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

function parseNonNegativeAmount(value: string, label: string, rowNumber: number, errors: StudentImportError[]): number {
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

export function parseStudentImportFile(file: StudentImportUploadedFile): ParsedStudentImportResult {
  const matrix = readWorksheetRows(file);

  if (matrix.length < 2) {
    throw new AppError(400, "The import file must contain a header row and at least one student row.");
  }

  const headers = matrix[0] || [];
  const hasRecognizedHeader = headers.some((header) => ALIAS_LOOKUP.has(normalizeKey(valueToString(header))));

  if (!hasRecognizedHeader) {
    throw new AppError(
      400,
      "The import header row did not include any recognized student columns. Include columns like fullName, email, dateOfBirth, class, guardianName, feeTier, and initialDeposit.",
    );
  }

  const rows: ParsedStudentImportRow[] = [];
  const errors: StudentImportError[] = [];
  let totalRows = 0;

  for (let index = 1; index < matrix.length; index += 1) {
    const rowNumber = index + 1;
    const canonical = canonicalizeRow(headers, matrix[index] || []);

    if (isEmptyRow(canonical)) {
      continue;
    }

    totalRows += 1;

    const rowErrors: StudentImportError[] = [];

    const fullName = requiredValue(canonical, "fullName", "Student full name", rowNumber, rowErrors);
    const email = requiredValue(canonical, "email", "Student email", rowNumber, rowErrors).toLowerCase();
    const dateOfBirthRaw = requiredValue(canonical, "dateOfBirth", "Date of birth", rowNumber, rowErrors);
    const gender = requiredValue(canonical, "gender", "Gender", rowNumber, rowErrors);
    const residentialAddress = requiredValue(canonical, "residentialAddress", "Residential address", rowNumber, rowErrors);
    const classRef = requiredValue(canonical, "classId", "Class", rowNumber, rowErrors);
    const feeTierRef = requiredValue(canonical, "feeTierId", "Fee tier", rowNumber, rowErrors);
    const guardianName = requiredValue(canonical, "guardianName", "Guardian name", rowNumber, rowErrors);
    const guardianRelationship = requiredValue(canonical, "guardianRelationship", "Guardian relationship", rowNumber, rowErrors);
    const guardianPhone = requiredValue(canonical, "guardianPhone", "Guardian phone", rowNumber, rowErrors);

    if (email && !EMAIL_REGEX.test(email)) {
      rowErrors.push({ row: rowNumber, field: "email", message: "Student email must be valid." });
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
    const enrollmentDate = normalizeDateValue(
      getValue(canonical, "enrollmentDate"),
      "Enrollment date",
      rowNumber,
      rowErrors,
      new Date().toISOString(),
    );
    const initialDeposit = parseNonNegativeAmount(
      getValue(canonical, "initialDeposit"),
      "Initial deposit",
      rowNumber,
      rowErrors,
    );

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
          password: getValue(canonical, "password") || DEFAULT_IMPORT_PASSWORD,
          enrollmentDate,
        },
        demographics: {
          dateOfBirth,
          gender,
          residentialAddress,
          medicalNotes: optionalValue(canonical, "medicalNotes"),
          bloodType: optionalValue(canonical, "bloodType"),
          religion: optionalValue(canonical, "religion"),
          formerSchool: optionalValue(canonical, "formerSchool"),
        },
        placement: {
          classId: classRef,
          academicTrack: getValue(canonical, "academicTrack") || "General",
          boardingStatus: getValue(canonical, "boardingStatus") || "Day",
        },
        compliance: {
          nationalId,
          emergencyContact: {
            name: optionalValue(canonical, "emergencyName"),
            phone: optionalValue(canonical, "emergencyPhone"),
            relationship: optionalValue(canonical, "emergencyRelationship"),
          },
        },
        guardian: {
          name: guardianName,
          relationship: guardianRelationship,
          phone: guardianPhone,
          email: optionalValue(canonical, "guardianEmail"),
        },
        billing: {
          feeTierId: feeTierRef,
          initialDeposit,
        },
      },
    });
  }

  if (totalRows === 0) {
    throw new AppError(400, "No student records were found in the import file.");
  }

  return { totalRows, rows, errors };
}
