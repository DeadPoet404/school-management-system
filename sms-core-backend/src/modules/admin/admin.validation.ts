import { z } from "zod";

export const institutionUpdateSchema = z
  .object({
    schoolName: z.string().min(1).max(120).optional(),
    schoolCode: z
      .string()
      .min(3)
      .max(20)
      .regex(/^[A-Za-z0-9-]+$/, "School code may only contain letters, numbers and dashes.")
      .optional(),
    motto: z.string().max(200).nullable().optional(),
    address: z.string().max(1000).nullable().optional(),
    phone: z.string().max(40).nullable().optional(),
    email: z.string().email().max(120).nullable().optional(),
    logoUrl: z.string().max(500).nullable().optional(),
    country: z.string().min(2).max(2).toUpperCase().optional(),
    timezone: z.string().min(1).max(64).optional(),
    currency: z
      .string()
      .regex(/^[A-Z]{3}$/, "Currency must be a 3-letter ISO code (e.g. GHS).")
      .optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Provide at least one field to update.",
  });

export type InstitutionUpdateInput = z.infer<typeof institutionUpdateSchema>;

export const dataWipeSchema = z.object({
  scope: z.enum(["students", "personnel", "financial", "all"]),
  confirm: z
    .string()
    .min(1, "Type the school code exactly to confirm the wipe."),
});

export type DataWipeInput = z.infer<typeof dataWipeSchema>;
