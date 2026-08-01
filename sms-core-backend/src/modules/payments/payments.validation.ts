import { z } from 'zod';

export const createPaymentIntentSchema = z.object({
  studentId: z.string().uuid('Student ID must be a valid UUID.'),
  payerEmail: z.string().trim().email('A valid payer email address is required.'),
  amount: z.coerce.number().finite().positive('Amount must be greater than zero.'),
});
