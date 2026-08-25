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
    schoolName: z
      .string()
      .trim()
      .min(2, 'School name must be at least 2 characters.')
      .max(120, 'School name must be at most 120 characters.'),
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
    fullName: z
      .string()
      .trim()
      .min(2, 'Admin full name must be at least 2 characters.')
      .max(120, 'Admin full name must be at most 120 characters.'),
    email: z.string().trim().email('A valid admin email address is required.'),
    password: passwordSchema,
  }),
});

export type BootstrapSetupInput = z.infer<typeof bootstrapSetupSchema>;
