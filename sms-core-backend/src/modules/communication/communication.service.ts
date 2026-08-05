/**
 * SMS-012 — communication service: recipient resolution + compose + ledger reads.
 *
 * Resolution matrix (ratified):
 *   audience SCHOOL_WIDE -> guardians of every ACTIVE student
 *   audience CLASS       -> guardians via placements of that class
 *   audience STUDENTS    -> guardians of the explicitly named students
 * Contact pick per channel (ratified):
 *   SMS / WHATSAPP -> Guardian.phone (required field)
 *   EMAIL          -> Guardian.email (when set) + the student's portal email
 * Dedupe per (channel, recipient); recipients resolved outside the create
 * transaction to keep the write window minimal.
 */
import { prisma } from '@/lib/prisma';
import { AppError } from '@/middleware/error.handler';
import type { Channel } from './communication.adapters';

export interface ComposeInput {
  title: string;
  body: string;
  audience: 'SCHOOL_WIDE' | 'CLASS' | 'STUDENTS';
  classId?: string;
  studentIds?: string[];
  channels: Channel[];
}

export interface ComposeActor {
  id: string;
  email: string;
}

interface RecipientRow {
  channel: Channel;
  recipient: string;
  recipientLabel: string;
  studentId: string | null;
}

const studentSelect = {
  id: true,
  studentId: true,
  studentName: true,
  guardians: { select: { name: true, phone: true, email: true } },
  account: { select: { portalEmail: true } },
} as const;

type StudentWithContacts = {
  id: string;
  studentId: string;
  studentName: string;
  guardians: { name: string; phone: string; email: string | null }[];
  account: { portalEmail: string } | null;
};

export class CommunicationService {
  private async resolveStudents(input: ComposeInput): Promise<StudentWithContacts[]> {
    if (input.audience === 'SCHOOL_WIDE') {
      return prisma.student.findMany({
        where: { status: 'ACTIVE' },
        select: studentSelect,
      });
    }

    if (input.audience === 'CLASS') {
      const classRow = await prisma.class.findUnique({
        where: { id: input.classId },
        select: { id: true, name: true, deletedAt: true },
      });
      if (!classRow || classRow.deletedAt) {
        throw new AppError(404, `Class not found: ${input.classId}`);
      }
      const placements = await prisma.placement.findMany({
        where: { classId: classRow.id },
        select: { student: { select: studentSelect } },
      });
      return placements.map((placement) => placement.student);
    }

    const students = await prisma.student.findMany({
      where: { id: { in: input.studentIds ?? [] }, status: 'ACTIVE' },
      select: studentSelect,
    });
    if (students.length === 0) {
      throw new AppError(400, 'No matching ACTIVE students for the given studentIds.');
    }
    return students;
  }

  /** Guardians per audience; EMAIL adds the portal email (ratified). */
  buildRecipients(students: StudentWithContacts[], channels: Channel[]): RecipientRow[] {
    const wants = new Set(channels);
    const seen = new Set<string>();
    const rows: RecipientRow[] = [];

    const push = (channel: Channel, recipient: string | null, label: string, studentId: string) => {
      if (!recipient) return;
      const key = `${channel}|${recipient}`;
      if (seen.has(key)) return;
      seen.add(key);
      rows.push({ channel, recipient, recipientLabel: label, studentId });
    };

    for (const student of students) {
      for (const guardian of student.guardians) {
        if (wants.has('SMS')) push('SMS', guardian.phone, guardian.name, student.id);
        if (wants.has('WHATSAPP')) push('WHATSAPP', guardian.phone, guardian.name, student.id);
        if (wants.has('EMAIL')) push('EMAIL', guardian.email, guardian.name, student.id);
      }
      if (wants.has('EMAIL')) {
        push('EMAIL', student.account?.portalEmail ?? null, student.studentName, student.id);
      }
    }
    return rows;
  }

  async compose(input: ComposeInput, actor: ComposeActor) {
    const students = await this.resolveStudents(input);
    const recipients = this.buildRecipients(students, input.channels);
    if (recipients.length === 0) {
      throw new AppError(
        400,
        'Audience resolved to zero recipients (no guardians/emails on record for the selected scope).',
      );
    }

    const announcement = await prisma.$transaction(async (tx) => {
      const created = await tx.announcement.create({
        data: {
          title: input.title,
          body: input.body,
          audience: input.audience,
          classId: input.audience === 'CLASS' ? input.classId ?? null : null,
          studentIds: input.audience === 'STUDENTS' ? input.studentIds ?? [] : [],
          channels: input.channels,
          status: 'QUEUED',
          createdBy: actor.id,
          createdByEmail: actor.email,
        },
      });
      await tx.notificationDelivery.createMany({
        data: recipients.map((row) => ({
          announcementId: created.id,
          channel: row.channel,
          recipient: row.recipient,
          recipientLabel: row.recipientLabel,
          studentId: row.studentId,
        })),
      });
      return created;
    });

    const channelCounts: Record<string, number> = {};
    for (const row of recipients) {
      channelCounts[row.channel] = (channelCounts[row.channel] ?? 0) + 1;
    }

    return {
      announcementId: announcement.id,
      status: announcement.status,
      audience: announcement.audience,
      studentsResolved: students.length,
      recipientCount: recipients.length,
      channelCounts,
    };
  }

  async listAnnouncements() {
    const rows = await prisma.announcement.findMany({
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: {
        id: true,
        title: true,
        audience: true,
        channels: true,
        status: true,
        createdByEmail: true,
        createdAt: true,
        deliveries: { select: { status: true } },
      },
    });

    return rows.map((row) => {
      const counts = { queued: 0, sent: 0, failed: 0 };
      for (const delivery of row.deliveries) {
        if (delivery.status === 'SENT') counts.sent += 1;
        else if (delivery.status === 'FAILED') counts.failed += 1;
        else counts.queued += 1;
      }
      return {
        id: row.id,
        title: row.title,
        audience: row.audience,
        channels: row.channels,
        status: row.status,
        createdByEmail: row.createdByEmail,
        createdAt: row.createdAt.toISOString(),
        deliveryCounts: { ...counts, total: row.deliveries.length },
      };
    });
  }

  async getDeliveries(announcementId: string) {
    const announcement = await prisma.announcement.findUnique({
      where: { id: announcementId },
      select: { id: true, title: true, status: true },
    });
    if (!announcement) throw new AppError(404, `Announcement not found: ${announcementId}`);

    const deliveries = await prisma.notificationDelivery.findMany({
      where: { announcementId: announcement.id },
      orderBy: { createdAt: 'desc' },
      take: 500,
      select: {
        id: true,
        channel: true,
        recipient: true,
        recipientLabel: true,
        status: true,
        attempts: true,
        providerMessageId: true,
        error: true,
        sentAt: true,
        updatedAt: true,
      },
    });

    return {
      announcement,
      deliveries: deliveries.map((row) => ({
        ...row,
        sentAt: row.sentAt ? row.sentAt.toISOString() : null,
        updatedAt: row.updatedAt.toISOString(),
      })),
    };
  }
}
