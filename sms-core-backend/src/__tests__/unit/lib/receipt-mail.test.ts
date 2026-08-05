/**
 * SMS-006 suites — mailer transport + receipt-email orchestrator.
 *
 * Mocking strategy: mock nodemailer (the wire), prisma, lib/pdf, and the
 * logger — but exercise the REAL lib/mailer underneath. That keeps the
 * fail-soft contract ('sendMail never throws') under direct test instead of
 * mocking away the very unit under test.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const { mockTransportSend, mockCreateTransport, mockRenderReceiptPdf, mockLogger, prismaMock, DTO } =
  vi.hoisted(() => {
    const mockTransportSend = vi.fn();
    return {
      mockTransportSend,
      mockCreateTransport: vi.fn(() => ({ sendMail: mockTransportSend })),
      mockRenderReceiptPdf: vi.fn(),
      mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
      prismaMock: {
        student: { findUnique: vi.fn() },
        paymentCollection: { findUnique: vi.fn() },
      },
      DTO: {
        receiptNumber: 'REC-2026-0099',
        dateProcessed: new Date('2026-08-05T10:00:00.000Z'),
        studentName: 'Ama Yaw Osei',
        studentCode: 'HHA-2024-0001',
        className: 'JHS 1A — Section A',
        amountPaid: 1234.56,
        paymentMethod: 'CASH',
        referenceNo: 'N/A (Direct)',
        allocationTarget: 'Tuition - Term 1',
        outstandingBalance: 765.44,
      },
    };
  });

vi.mock('nodemailer', () => ({ default: { createTransport: mockCreateTransport } }));
vi.mock('@/lib/prisma', () => ({ prisma: prismaMock }));
vi.mock('@/lib/logger', () => ({ logger: mockLogger }));
vi.mock('@/lib/pdf', () => ({ renderReceiptPdf: mockRenderReceiptPdf }));
vi.mock('@/modules/finance/finance.service', () => ({
  FinanceService: class {
    async getReceiptForPdf() {
      return DTO;
    }
  },
}));

import { sendMail, __resetMailerForTesting } from '@/lib/mailer';
import { sendCollectionReceipt, resolveReceiptRecipients } from '@/lib/receipt-email';

describe('mailer transport (SMS-006)', () => {
  beforeEach(() => {
    __resetMailerForTesting();
    vi.clearAllMocks();
    mockTransportSend.mockResolvedValue({ messageId: 'msg-1' });
    delete process.env.GMAIL_USER;
    delete process.env.GMAIL_APP_PASSWORD;
  });

  it('is skipped and logged when Gmail credentials are unconfigured', async () => {
    const result = await sendMail({ to: 'a@b.c', subject: 's', text: 't', html: '<p>t</p>' });
    expect(result).toEqual({ sent: false, reason: 'unconfigured' });
    expect(mockCreateTransport).not.toHaveBeenCalled();
    expect(mockLogger.warn).toHaveBeenCalled();
  });

  it('sends through the Gmail transporter with a branded sender when configured', async () => {
    process.env.GMAIL_USER = 'school@gmail.com';
    process.env.GMAIL_APP_PASSWORD = 'app-password-16';
    const result = await sendMail({ to: 'a@b.c', subject: 'Hello', text: 't', html: '<p>t</p>' });
    expect(result.sent).toBe(true);
    expect(mockCreateTransport).toHaveBeenCalledWith(
      expect.objectContaining({ host: 'smtp.gmail.com', port: 465, secure: true }),
    );
    expect(mockTransportSend).toHaveBeenCalledWith(
      expect.objectContaining({ from: '"School Management System" <school@gmail.com>', to: 'a@b.c', subject: 'Hello' }),
    );
  });

  it('swallows SMTP failures and logs them (fail-soft, never throws)', async () => {
    process.env.GMAIL_USER = 'school@gmail.com';
    process.env.GMAIL_APP_PASSWORD = 'app-password-16';
    mockTransportSend.mockRejectedValue(new Error('535 Bad credentials'));
    const result = await sendMail({ to: 'a@b.c', subject: 's', text: 't', html: '<p>t</p>' });
    expect(result).toEqual({ sent: false, reason: '535 Bad credentials' });
    expect(mockLogger.error).toHaveBeenCalled();
  });
});

describe('receipt-email orchestrator (SMS-006)', () => {
  beforeEach(() => {
    __resetMailerForTesting();
    vi.clearAllMocks();
    process.env.GMAIL_USER = 'school@gmail.com';
    process.env.GMAIL_APP_PASSWORD = 'app-password-16';
    mockTransportSend.mockResolvedValue({ messageId: 'msg-2' });
    mockRenderReceiptPdf.mockResolvedValue(Buffer.from('%PDF-mock'));
    prismaMock.paymentCollection.findUnique.mockResolvedValue({ studentInternalId: 'stu-1' });
    prismaMock.student.findUnique.mockResolvedValue({
      account: { portalEmail: 'student001@horizon.local' },
      guardians: [
        { email: 'guardian1@example.com' },
        { email: null },
        { email: 'student001@horizon.local' }, // duplicate of portal email — must dedupe
      ],
    });
  });

  it('sends to portal email + guardian emails, deduplicated, with the PDF attached', async () => {
    await sendCollectionReceipt('col-1', 'CASH');
    expect(mockTransportSend).toHaveBeenCalledTimes(1);
    const mail = mockTransportSend.mock.calls[0]?.[0];
    expect(mail.from).toBe('"School Management System" <school@gmail.com>');
    expect(mail.to).toBe('student001@horizon.local, guardian1@example.com');
    expect(mail.subject).toContain('REC-2026-0099');
    expect(mail.subject).toContain('Cash counter collection');
    expect(mail.html).toContain('Ama Yaw Osei');
    expect(mail.text).toContain('GHS 1,234.56');
    expect(mail.attachments).toEqual([
      { filename: 'receipt-REC-2026-0099.pdf', content: expect.any(Buffer), contentType: 'application/pdf' },
    ]);
    expect(mockRenderReceiptPdf).toHaveBeenCalledWith(DTO);
  });

  it('renders the Paystack channel label for digital settlements', async () => {
    await sendCollectionReceipt('col-9', 'PAYSTACK');
    expect(mockTransportSend.mock.calls[0]?.[0].subject).toContain('Paystack digital payment');
  });

  it('skips and logs when the student has zero recipients on file', async () => {
    prismaMock.student.findUnique.mockResolvedValue({ account: null, guardians: [] });
    await sendCollectionReceipt('col-2', 'CASH');
    expect(mockTransportSend).not.toHaveBeenCalled();
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({ collectionId: 'col-2' }),
      expect.stringContaining('no recipients'),
    );
  });

  it('skips walk-in collections with no linked student', async () => {
    prismaMock.paymentCollection.findUnique.mockResolvedValue({ studentInternalId: null });
    await sendCollectionReceipt('col-4', 'CASH');
    expect(mockTransportSend).not.toHaveBeenCalled();
  });

  it('skips gracefully when the collection row is gone', async () => {
    prismaMock.paymentCollection.findUnique.mockResolvedValue(null);
    await sendCollectionReceipt('col-gone', 'CASH');
    expect(mockTransportSend).not.toHaveBeenCalled();
    expect(mockLogger.warn).toHaveBeenCalled();
  });

  it('does not send (and stays resolved) when Gmail is unconfigured', async () => {
    delete process.env.GMAIL_USER;
    delete process.env.GMAIL_APP_PASSWORD;
    __resetMailerForTesting();
    await expect(sendCollectionReceipt('col-6', 'CASH')).resolves.toBeUndefined();
    expect(mockTransportSend).not.toHaveBeenCalled();
    expect(mockLogger.warn).toHaveBeenCalled();
  });

  it('swallows unexpected orchestrator errors and logs them', async () => {
    mockRenderReceiptPdf.mockRejectedValue(new Error('pdf exploded'));
    await expect(sendCollectionReceipt('col-7', 'CASH')).resolves.toBeUndefined();
    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({ collectionId: 'col-7' }),
      expect.stringContaining('swallowed'),
    );
  });

  it('resolveReceiptRecipients returns portal + guardian emails in order', async () => {
    await expect(resolveReceiptRecipients('stu-1')).resolves.toEqual([
      'student001@horizon.local',
      'guardian1@example.com',
    ]);
    await expect(resolveReceiptRecipients(null)).resolves.toEqual([]);
  });
});
