import { z } from "zod";

export const saveFeeMatrixSchema = z.object({
  data: z.record(z.string(), z.object({
    components: z.array(z.object({
      name: z.string().optional(),
      amount: z.union([z.string(), z.number()]).optional(),
      frequency: z.string().optional(),
      isMandatory: z.boolean().optional(),
    })),
    billingConfig: z.object({
      issueDate: z.union([z.string(), z.date()]).optional(),
      dueDate: z.union([z.string(), z.date()]).optional(),
      allowInstallments: z.boolean().optional(),
      lateFeeRate: z.union([z.string(), z.number()]).optional(),
    }),
  })),
});

// P2-10: amountPaid was z.string().min(1) which let "abc" pass validation.
// parseFloat("abc") returns NaN, silently falling back to 0 — recording
// a zero-value payment. Now uses z.coerce.number() which rejects non-numeric
// strings at the validation boundary.
export const commitInflowSchema = z.object({
  sectionId: z.string().min(1, "Section ID is required"),
  studentName: z.string().min(1, "Student name is required"),
  amountPaid: z.coerce.number({ message: "Amount paid must be a valid number" }).min(0, "Amount paid cannot be negative"),
  paymentMethod: z.string().min(1, "Payment method is required"),
  referenceNo: z.string().optional(),
  allocationTarget: z.string().min(1, "Allocation target is required"),
  studentInternalId: z.string().optional(),
});

export const generateInvoicesSchema = z.object({
  sectionId: z.string().min(1, "Section ID is required"),
});

// P2-10: Same fix — amount was z.string().min(1), now z.coerce.number()
export const createLedgerSchema = z.object({
  code: z.string().min(1, "Ledger code is required"),
  accountName: z.string().min(1, "Account name is required"),
  category: z.string().min(1, "Category is required"),
  amount: z.coerce.number({ message: "Amount must be a valid number" }).min(0, "Amount cannot be negative"),
  type: z.enum(["debit", "credit"], {
    message: "Type must be 'debit' or 'credit'",
  }),
});

export const disbursePayrollSchema = z.object({
  id: z.string().min(1, "Payroll record ID is required"),
});
