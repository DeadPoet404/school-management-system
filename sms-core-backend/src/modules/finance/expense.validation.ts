import { z } from "zod";

export const createExpenseSchema = z.object({
  vendorName: z.string().min(1, "Vendor name is required."),
  category: z.string().min(1, "Expense category is required."),
  description: z.string().min(1, "Description is required."),
  amount: z.coerce.number().positive("Amount must be a positive number."),
  paymentMethod: z.string().min(1, "Payment method is required."),
  expenseDate: z.string().min(1, "Expense date is required."),
});

export const updateExpenseStatusSchema = z.object({
  status: z.enum(["PENDING_APPROVAL", "CLEARED", "REJECTED"], {
    message: "status must be one of PENDING_APPROVAL, CLEARED, REJECTED",
  }),
});
