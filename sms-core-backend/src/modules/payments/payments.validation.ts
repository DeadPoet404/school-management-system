import { z } from 'zod';

export const createPaymentIntentSchema = z.object({
  studentId: z.string().uuid('Student ID must be a valid UUID.'),
  payerEmail: z.string().trim().email('A valid payer email address is required.'),
  amount: z.coerce.number().finite().positive('Amount must be greater than zero.'),
  channels: z
    .array(z.enum(['mobile_money', 'card', 'bank_transfer']))
    .optional(),
});

/**
 * Self-service schema. Deliberately omits `studentId` — the student is resolved
 * from the authenticated session, never trusted from the request body.
 */
export const createSelfPaymentIntentSchema = z.object({
  payerEmail: z.string().trim().email('A valid payer email address is required.'),
  amount: z.coerce.number().finite().positive('Amount must be greater than zero.'),
});
