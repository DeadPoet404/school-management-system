import { z } from 'zod';

/**
 * Self-service schema. Deliberately omits `studentId` — the student is resolved
 * from the authenticated session, never trusted from the request body.
 */
export const createSelfPaymentIntentSchema = z.object({
  payerEmail: z.string().trim().email('A valid payer email address is required.'),
  amount: z.coerce.number().finite().positive('Amount must be greater than zero.'),
});
