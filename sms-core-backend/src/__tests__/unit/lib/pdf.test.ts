import { describe, it, expect, vi } from 'vitest';
import { amountInWords, integerToWords } from '@/lib/amount-in-words';
import { renderReceiptPdf, type ReceiptPdfData } from '@/lib/pdf';
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

describe('renderReceiptPdf (SMS-007)', () => {
  const sample: ReceiptPdfData = {
    receiptNumber: 'REC-2026-0099',
    dateProcessed: new Date('2026-08-05T10:00:00.000Z'),
    studentName: 'Ama Yaw Osei',
    studentCode: 'HHA-2024-0001',
    className: 'JHS 1A — Section A',
    amountPaid: 1234.56,
    paymentMethod: 'CASH',
    referenceNo: 'N/A (Direct)',
    allocationTarget: 'Tuition - Term 1 Billing Cycle',
    outstandingBalance: 765.44,
  };

  it('produces a non-empty %PDF buffer', async () => {
    const buf = await renderReceiptPdf(sample);
    expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(buf.length).toBeGreaterThan(400);
  });

  // pdfkit 0.19 glyph-encodes the content stream (hex TJ arrays) even with
  // compress:false, so the greppable 'key strings' channel is the document
  // Info dictionary — which also makes receipts searchable in document stores.
  it('embeds key receipt strings as searchable PDF metadata', async () => {
    const text = (await renderReceiptPdf(sample)).toString('latin1');
    expect(text).toContain('OFFICIAL PAYMENT RECEIPT');
    expect(text).toContain('REC-2026-0099');
    expect(text).toContain('Ama Yaw Osei');
    expect(text).toContain('CASH');
    expect(text).toContain('Cedis');
  });

  it('stays null-safe for unlinked historical collections', async () => {
    const buf = await renderReceiptPdf({ ...sample, studentCode: null, className: null, outstandingBalance: null });
    expect(buf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(buf.length).toBeGreaterThan(400);
  });
});

describe('FinanceService.getReceiptForPdf (SMS-007)', () => {
  function stubService(record: unknown) {
    const findReceiptCollectionById = vi.fn().mockResolvedValue(record);
    const service = new FinanceService({ findReceiptCollectionById } as unknown as IFinanceRepository);
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
    student: { studentId: 'HHA-2024-0001', billing: { currentBalance: '765.44' } },
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
    const { service } = stubService({ ...linkedRecord, student: null, class: null });
    const dto = await service.getReceiptForPdf('col-1');
    expect(dto.studentCode).toBeNull();
    expect(dto.className).toBeNull();
    expect(dto.outstandingBalance).toBeNull();
  });

  it('throws 404 for an unknown collection id', async () => {
    const { service } = stubService(null);
    await expect(service.getReceiptForPdf('nope')).rejects.toMatchObject({ statusCode: 404 });
  });

  it('throws 404 for a soft-deleted collection', async () => {
    const { service } = stubService({ ...linkedRecord, deletedAt: new Date() });
    await expect(service.getReceiptForPdf('col-1')).rejects.toMatchObject({ statusCode: 404 });
  });
});
