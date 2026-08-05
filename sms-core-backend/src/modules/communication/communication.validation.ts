import { z } from 'zod';

export const composeAnnouncementSchema = z
  .object({
    title: z.string().trim().min(1, 'Title is required.').max(200),
    body: z.string().trim().min(1, 'Body is required.').max(4000),
    audience: z.enum(['SCHOOL_WIDE', 'CLASS', 'STUDENTS']),
    classId: z.string().uuid().optional(),
    studentIds: z.array(z.string().uuid()).max(200).optional(),
    channels: z
      .array(z.enum(['SMS', 'WHATSAPP', 'EMAIL']))
      .min(1, 'Pick at least one channel.'),
  })
  .superRefine((value, ctx) => {
    if (value.audience === 'CLASS' && !value.classId) {
      ctx.addIssue({
        code: 'custom',
        path: ['classId'],
        message: 'classId is required for CLASS announcements.',
      });
    }
    if (value.audience === 'STUDENTS' && (!value.studentIds || value.studentIds.length === 0)) {
      ctx.addIssue({
        code: 'custom',
        path: ['studentIds'],
        message: 'studentIds must name at least one student for STUDENTS announcements.',
      });
    }
  });
