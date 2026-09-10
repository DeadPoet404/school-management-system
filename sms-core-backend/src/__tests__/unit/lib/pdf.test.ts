import { describe, expect, it, vi } from 'vitest';
import { amountInWords, integerToWords } from '@/lib/amount-in-words';
import {
  renderReceiptPdf,
  resolveReceiptPaperSize,
  type ReceiptPdfData,
} from '@/lib/pdf';
import { FinanceService } from '@/modules/finance/finance.service';
import type { IFinanceRepository } from '@/types/repositories';

describe('amountInWords (SMS-007)', () => {
  it('renders zero', () => expect(amountInWords(0)).toBe('Zero Cedis Only'));
  it('renders single digits', () => expect(amountInWords(7)).toBe('Seven Cedis Only'));
  it('renders teens', () => expect(amountInWords(13)).toBe('Thirteen Cedis Only'));
  it('renders round tens', () => expect(amountInWords(40)).toBe('Forty Cedis Only'));
  it('hyphenates compound tens', () => expect(amountInWords(56)).toBe('Fifty-Six Cedis Only'));
  it('renders round hundreds', () => expect(amountInWords(100)).toBe('One Hundred Cedis Only'));
  it('renders hundreds with remainder', () => expect(amountInWords(115)).toBe('One Hundred Fifteen Cedis Only'));
  it('renders thousands with pesewas', () =>
    expect(amountInWords(1234.56)).toBe('One Thousand Two Hundred Thirty-Four Cedis, Fifty-Six Pesewas Only'));
  it('renders round thousands', () => expect(amountInWords(2000)).toBe('Two Thousand Cedis Only'));
  it('renders millions', () => expect(amountInWords(1_000_000)).toBe('One Million Cedis Only'));
  it('renders pesewas-only amounts', () => expect(amountInWords(0.05)).toBe('Zero Cedis, Five Pesewas Only'));
  it('accepts decimal strings', () =>
    expect(amountInWords('350.50')).toBe('Three Hundred Fifty Cedis, Fifty Pesewas Only'));
  it('rejects negative amounts', () => expect(() => amountInWords(-1)).toThrow());
  it('rejects non-numeric input', () => expect(() => amountInWords('abc')).toThrow());
  it('integerToWords guards non-integers', () => expect(() => integerToWords(1.5)).toThrow());
});

describe('receipt paper selection (SMS-014)', () => {
  it('defaults to A5 and accepts A4 explicitly', () => {
    expect(resolveReceiptPaperSize(undefined)).toBe('A5');
    expect(resolveReceiptPaperSize(null)).toBe('A5');
    expect(resolveReceiptPaperSize('A5')).toBe('A5');
    expect(resolveReceiptPaperSize('A4')).toBe('A4');
  });

  it('falls back safely to A5 for an unsupported value', () => {
    expect(resolveReceiptPaperSize('LETTER')).toBe('A5');
  });
});

describe('renderReceiptPdf (SMS-014)', () => {
  const sample: ReceiptPdfData = {
    receiptNumber: 'REC-2026-0099',
    dateProcessed: new Date('2026-08-05T10:00:00.000Z'),
    studentName: 'Ama Yaw Osei',
    studentCode: 'HHA-2024-0001',
    className: 'JHS 1A - Section A',
    amountPaid: 1234.56,
    paymentMethod: 'CASH',
    referenceNo: 'N/A (Direct)',
    allocationTarget: 'Tuition - Term 1 Billing Cycle',
    outstandingBalance: 765.44,
    institution: {
      schoolName: 'Jocomfy Academy',
      schoolCode: 'JCA',
      motto: 'Learning with purpose',
      address: 'Accra, Ghana',
      phone: '+233 20 000 0000',
      email: 'office@example.test',
    },
  };

  it('produces a non-empty A5 PDF buffer by default', async () => {
    const buffer = await renderReceiptPdf(sample);

    expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(buffer.length).toBeGreaterThan(400);
  });

  it('produces a distinct A4 PDF buffer for office printing', async () => {
    const a5Buffer = await renderReceiptPdf(sample, {
      compress: false,
      paperSize: 'A5',
    });
    const a4Buffer = await renderReceiptPdf(sample, {
      compress: false,
      paperSize: 'A4',
    });

    expect(a4Buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(a4Buffer.length).toBeGreaterThan(400);
    expect(a4Buffer.equals(a5Buffer)).toBe(false);
    expect(a4Buffer.toString('latin1')).toContain('paper:A4');
    expect(a5Buffer.toString('latin1')).toContain('paper:A5');
  });

  it('embeds searchable receipt, institution, student, and payment metadata', async () => {
    const text = (
      await renderReceiptPdf(sample, { compress: false })
    ).toString('latin1');

    expect(text).toContain('PAYMENT RECEIPT');
    expect(text).toContain('REC-2026-0099');
    expect(text).toContain('Jocomfy Academy');
    expect(text).toContain('Ama Yaw Osei');
    expect(text).toContain('CASH');
    expect(text).toContain('Cedis');
  });

  it('uses a safe generic identity if system configuration is unavailable', async () => {
    const buffer = await renderReceiptPdf(
      {
        ...sample,
        institution: null,
        studentCode: null,
        className: null,
        outstandingBalance: null,
      },
      { compress: false },
    );

    const text = buffer.toString('latin1');

    expect(buffer.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(text).toContain('School Management System');
  });
});

describe('FinanceService.getReceiptForPdf (SMS-007)', () => {
  function stubService(record: unknown) {
    const findReceiptCollectionById = vi.fn().mockResolvedValue(record);
    const service = new FinanceService({
      findReceiptCollectionById,
    } as unknown as IFinanceRepository);

    return { service, findReceiptCollectionById };
  }

  const linkedRecord = {
    id: 'col-1',
    deletedAt: null,
    receiptNumber: 'REC-2026-0001',
    dateProcessed: new Date('2026-08-01T00:00:00.000Z'),
    studentName: 'Ama Yaw Osei',
    amountPaid: '1234.56',
    paymentMethod: 'CASH',
    referenceNo: 'N/A (Direct)',
    allocationTarget: 'Tuition',
    class: { name: 'JHS 1A', section: 'A' },
    student: {
      studentId: 'HHA-2024-0001',
      billing: { currentBalance: '765.44' },
    },
  };

  it('maps the collection record to the receipt DTO', async () => {
    const { service } = stubService(linkedRecord);
    const dto = await service.getReceiptForPdf('col-1');

    expect(dto.receiptNumber).toBe('REC-2026-0001');
    expect(dto.studentCode).toBe('HHA-2024-0001');
    expect(dto.className).toBe('JHS 1A — Section A');
    expect(dto.amountPaid).toBe(1234.56);
    expect(dto.outstandingBalance).toBe(765.44);
  });

  it('is null-safe when no student/class is linked', async () => {
    const { service } = stubService({
      ...linkedRecord,
      student: null,
      class: null,
    });
    const dto = await service.getReceiptForPdf('col-1');

    expect(dto.studentCode).toBeNull();
    expect(dto.className).toBeNull();
    expect(dto.outstandingBalance).toBeNull();
  });

  it('throws 404 for an unknown collection id', async () => {
    const { service } = stubService(null);

    await expect(service.getReceiptForPdf('nope')).rejects.toMatchObject({
      statusCode: 404,
    });
  });

  it('throws 404 for a soft-deleted collection', async () => {
    const { service } = stubService({
      ...linkedRecord,
      deletedAt: new Date(),
    });

    await expect(service.getReceiptForPdf('col-1')).rejects.toMatchObject({
      statusCode: 404,
    });
  });
});
