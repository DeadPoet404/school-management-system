import { z } from "zod";

export const createExpenseSchema = z.object({
  vendorName: z.string().min(1, "Vendor name is required"),
  category: z.string().min(1, "Category is required"),
  description: z.string().min(1, "Description is required"),
  amount: z.coerce.number({ message: "Amount must be a valid number" }).min(0, "Amount cannot be negative"),
  paymentMethod: z.string().min(1, "Payment method is required"),
  status: z.enum(["CLEARED", "PENDING_APPROVAL", "REJECTED"]).optional(),
  expenseDate: z.string().optional(),
});
