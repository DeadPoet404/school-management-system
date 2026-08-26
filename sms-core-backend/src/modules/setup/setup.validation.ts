import { z } from 'zod';

const schoolCodeSchema = z
  .string()
  .trim()
  .min(2, 'School code must be at least 2 characters.')
  .max(16, 'School code must be at most 16 characters.')
  .regex(
    /^[A-Za-z0-9][A-Za-z0-9_-]*$/,
    'School code may only contain letters, numbers, hyphens, and underscores.',
  )
  .transform((value) => value.toUpperCase());

const passwordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters.')
  .max(128, 'Password must be at most 128 characters.')
  .regex(/[A-Za-z]/, 'Password must include at least one letter.')
  .regex(/[0-9]/, 'Password must include at least one number.');

export const bootstrapSetupSchema = z.object({
  school: z.object({
    schoolName: z.string().trim().min(2).max(120),
    schoolCode: schoolCodeSchema,
    motto: z.string().trim().max(200).optional().nullable(),
    address: z.string().trim().max(500).optional().nullable(),
    phone: z.string().trim().max(40).optional().nullable(),
    email: z
      .string()
      .trim()
      .email('School email must be a valid email address.')
      .optional()
      .nullable()
      .or(z.literal('').transform(() => null)),
    country: z.string().trim().min(2).max(8).default('GH'),
    timezone: z.string().trim().min(1).max(64).default('Africa/Accra'),
    currency: z.string().trim().min(3).max(8).default('GHS'),
  }),
  admin: z.object({
    fullName: z.string().trim().min(2).max(120),
    email: z.string().trim().email('A valid admin email address is required.'),
    password: passwordSchema,
  }),
});

export type BootstrapSetupInput = z.infer<typeof bootstrapSetupSchema>;

const isoDateString = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Dates must use YYYY-MM-DD format.');

export const setupAcademicSchema = z
  .object({
    terms: z
      .array(
        z.object({
          name: z.string().trim().min(2).max(80),
          academicYear: z.string().trim().min(4).max(20),
          startDate: isoDateString,
          endDate: isoDateString,
          isActive: z.boolean().optional().default(true),
        }),
      )
      .min(1, 'Provide at least one academic term.')
      .max(12),
  })
  .superRefine((value, ctx) => {
    value.terms.forEach((term, index) => {
      if (new Date(term.endDate) < new Date(term.startDate)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Term "${term.name}" end date must be on or after its start date.`,
          path: ['terms', index, 'endDate'],
        });
      }
    });
  });

export type SetupAcademicInput = z.infer<typeof setupAcademicSchema>;

export const setupClassesSchema = z.object({
  classes: z
    .array(
      z.object({
        name: z.string().trim().min(1).max(80),
        section: z.string().trim().max(40).optional().nullable(),
        isActive: z.boolean().optional().default(true),
      }),
    )
    .min(1)
    .max(80),
});

export type SetupClassesInput = z.infer<typeof setupClassesSchema>;

export const setupCurriculumSchema = z.object({
  departments: z
    .array(
      z.object({
        name: z.string().trim().min(2).max(100),
        code: z
          .string()
          .trim()
          .min(2)
          .max(16)
          .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/)
          .transform((v) => v.toUpperCase()),
      }),
    )
    .min(1)
    .max(40),
  subjects: z
    .array(
      z.object({
        name: z.string().trim().min(2).max(100),
        code: z
          .string()
          .trim()
          .min(2)
          .max(24)
          .regex(/^[A-Za-z0-9][A-Za-z0-9_-]*$/)
          .transform((v) => v.toUpperCase()),
      }),
    )
    .min(1)
    .max(500),
});

export type SetupCurriculumInput = z.infer<typeof setupCurriculumSchema>;

export const setupLedgerSchema = z.object({
  useDefaults: z.boolean().optional().default(true),
  accounts: z
    .array(
      z.object({
        code: z.string().trim().min(3).max(16),
        accountName: z.string().trim().min(2).max(120),
        category: z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE']),
      }),
    )
    .max(100)
    .optional()
    .default([]),
});

export type SetupLedgerInput = z.infer<typeof setupLedgerSchema>;
