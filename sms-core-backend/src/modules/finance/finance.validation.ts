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

export const commitInflowSchema = z.object({
  sectionId: z.string().min(1, "Section ID is required"),
  studentName: z.string().min(1, "Student name is required"),
  amountPaid: z.string().min(1, "Amount paid is required"),
  paymentMethod: z.string().min(1, "Payment method is required"),
  referenceNo: z.string().optional(),
  allocationTarget: z.string().min(1, "Allocation target is required"),
  studentInternalId: z.string().optional(),
});

export const generateInvoicesSchema = z.object({
  sectionId: z.string().min(1, "Section ID is required"),
});

export const createLedgerSchema = z.object({
  code: z.string().min(1, "Ledger code is required"),
  accountName: z.string().min(1, "Account name is required"),
  category: z.string().min(1, "Category is required"),
  amount: z.string().min(1, "Amount is required"),
  type: z.enum(["debit", "credit"], {
    message: "Type must be 'debit' or 'credit'",
  }),
});

export const disbursePayrollSchema = z.object({
  id: z.string().min(1, "Payroll record ID is required"),
});
