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
const collectionShareSchema = z.object({
  studentInternalId: z.string().min(1, "Each share needs a student"),
  amount: z.coerce.number({ message: "Each share must be a valid amount" }).positive("Each share must be greater than zero"),
});

function toCents(value: number): number {
  return Math.round(value * 100);
}

export const commitInflowSchema = z.object({
  sectionId: z.string().min(1, "Section ID is required"),
  studentName: z.string().min(1, "Student name is required"),
  amountPaid: z.coerce.number({ message: "Amount paid must be a valid number" }).min(0, "Amount paid cannot be negative"),
  // SMS-002: manual counter collections are cash-only. Digital channels
  // (MoMo / card / bank transfer) arrive exclusively via Paystack reconciliation.
  paymentMethod: z.literal("CASH", { message: "Only CASH payments can be recorded manually" }),
  referenceNo: z.string().optional(),
  allocationTarget: z.string().min(1, "Allocation target is required"),
  studentInternalId: z.string().optional(),
  // Printed in place of a single student name when one cash payment is split.
  receiptName: z.string().max(80, "Receipt name must be 80 characters or less").optional(),
  // Counter choice: print outstanding balances, or leave them off the receipt.
  showOutstanding: z.boolean().optional(),
  shares: z.array(collectionShareSchema).min(2, "A split payment needs at least two students").max(8, "A receipt can cover at most 8 students").optional(),
}).superRefine((value, ctx) => {
  if (!value.shares) return;

  const receiptName = value.receiptName?.trim() ?? "";
  if (receiptName.length < 2) {
    ctx.addIssue({
      code: "custom",
      path: ["receiptName"],
      message: "Enter the name to print on the receipt",
    });
  }

  if (!value.studentInternalId) {
    ctx.addIssue({
      code: "custom",
      path: ["studentInternalId"],
      message: "Choose the first student before splitting a payment",
    });
  }

  const ids = value.shares.map((share) => share.studentInternalId);
  if (new Set(ids).size !== ids.length) {
    ctx.addIssue({
      code: "custom",
      path: ["shares"],
      message: "Each student can only appear once on a receipt",
    });
  }

  if (value.studentInternalId && !ids.includes(value.studentInternalId)) {
    ctx.addIssue({
      code: "custom",
      path: ["shares"],
      message: "The first student must be included in the split",
    });
  }

  const paid = toCents(value.amountPaid);
  const split = value.shares.reduce((sum, share) => sum + toCents(share.amount), 0);
  if (paid !== split) {
    ctx.addIssue({
      code: "custom",
      path: ["shares"],
      message: "The split amounts must add up to the amount received",
    });
  }
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
