#!/usr/bin/env python3
"""SMS-007 (backend): PDFKit printable receipts.

Creates:
  sms-core-backend/src/lib/amount-in-words.ts      -- numeric -> words ("...Cedis, ...Pesewas Only")
  sms-core-backend/src/lib/pdf.ts                  -- A5 renderReceiptPdf(dto, opts) -> Promise<Buffer>
  sms-core-backend/src/__tests__/unit/lib/pdf.test.ts -- words suite + render smoke + service mapping/404

Edits (anchor-verified):
  src/types/repositories.ts            -- IFinanceRepository += findReceiptCollectionById
  src/modules/finance/finance.repository.ts -- += findReceiptCollectionById (class + student + billing include)
  src/modules/finance/finance.service.ts    -- import type ReceiptPdfData; += getReceiptForPdf (404-safe mapper)
  src/modules/finance/finance.controller.ts -- import renderReceiptPdf; += streamReceiptPdf (PDF headers + res.send)
  src/modules/finance/finance.routes.ts     -- GET /payments/:id/receipt.pdf under existing financeAccess guard

Prereq (RUN FIRST in sms-core-backend):
  npm install pdfkit && npm install -D @types/pdfkit

Run from ~/sms-monorepo:
  cd ~/sms-monorepo && python3 apply_sms007a.py
"""
from pathlib import Path

BACKEND = Path("sms-core-backend")


def replace_once(content: str, old: str, new: str, label: str) -> str:
    n = content.count(old)
    if n != 1:
        raise SystemExit(f"ABORT [{label}]: expected 1 anchor, found {n}. Patch NOT applied.")
    return content.replace(old, new, 1)


def edit(rel: str, old: str, new: str, label: str, skip_marker: str) -> None:
    p = BACKEND / rel
    if not p.is_file():
        raise SystemExit(f"ABORT: {p} not found. Run from ~/sms-monorepo.")
    c = p.read_text(encoding="utf-8")
    if skip_marker in c:
        print(f"SKIP: {rel} already patched ({label}).")
        return
    p.write_text(replace_once(c, old, new, label), encoding="utf-8")
    print(f"OK: {rel}  ({label})")


def create(rel: str, body: str) -> None:
    p = BACKEND / rel
    if p.exists():
        raise SystemExit(f"ABORT: {p} already exists. Refusing to overwrite.")
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(body, encoding="utf-8")
    print(f"OK: created {rel}")


# ── New file 1: amount-in-words utility ──────────────────────────────────────
AMOUNT_IN_WORDS = '''/**
 * SMS-007 -- converts a monetary amount to its English words representation,
 * denominated in Ghana Cedis / Pesewas (e.g. "One Thousand Two Hundred
 * Thirty-Four Cedis, Fifty-Six Pesewas Only"). Used on official receipts.
 */

const SMALL: readonly string[] = [
  'Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
  'Seventeen', 'Eighteen', 'Nineteen',
];

const TENS: readonly string[] = [
  '', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety',
];

const SCALES: ReadonlyArray<[number, string]> = [
  [1_000_000_000, 'Billion'],
  [1_000_000, 'Million'],
  [1_000, 'Thousand'],
];

function threeDigits(n: number): string {
  const parts: string[] = [];
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  if (hundreds > 0) parts.push(`${SMALL[hundreds]!} Hundred`);
  if (rest >= 20) {
    const tens = Math.floor(rest / 10);
    const unit = rest % 10;
    parts.push(unit > 0 ? `${TENS[tens]!}-${SMALL[unit]!}` : TENS[tens]!);
  } else if (rest > 0) {
    parts.push(SMALL[rest]!);
  }
  return parts.join(' ');
}

export function integerToWords(n: number): string {
  if (!Number.isInteger(n) || n < 0) throw new Error(`integerToWords: expected a non-negative integer, got ${n}`);
  if (n === 0) return 'Zero';
  let rest = n;
  const segments: string[] = [];
  for (const [value, name] of SCALES) {
    const quotient = Math.floor(rest / value);
    if (quotient > 0) {
      segments.push(`${integerToWords(quotient)} ${name}`);
      rest %= value;
    }
  }
  if (rest > 0) segments.push(threeDigits(rest));
  return segments.join(' ');
}

export function amountInWords(amount: string | number): string {
  const numeric = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (!Number.isFinite(numeric) || numeric < 0) {
    throw new Error(`amountInWords: invalid amount ${amount}`);
  }
  const totalPesewas = Math.round(numeric * 100);
  const cedis = Math.floor(totalPesewas / 100);
  const pesewas = totalPesewas % 100;
  const main = `${integerToWords(cedis)} Cedis`;
  const sub = pesewas > 0 ? `, ${integerToWords(pesewas)} Pesewas` : '';
  return `${main}${sub} Only`;
}
'''

# ── New file 2: PDF renderer ─────────────────────────────────────────────────
PDF_LIB = '''/**
 * SMS-007 -- PDFKit renderer for official cash-payment receipts.
 *
 * Buffer-first by design: the finance controller streams the buffer over HTTP
 * today; the SMS-006 mailer attaches the IDENTICAL buffer to receipt emails.
 * Receipts render on demand from live ledger data -- no stored blobs.
 */
import PDFDocument from 'pdfkit';
import { amountInWords } from './amount-in-words';

export interface ReceiptPdfData {
  receiptNumber: string;
  dateProcessed: Date | string;
  studentName: string;
  studentCode: string | null;   // e.g. HHA-2024-0001 (null when never linked)
  className: string | null;
  amountPaid: number;
  paymentMethod: string;        // 'CASH' per the SMS-002 contract
  referenceNo: string;
  allocationTarget: string;
  outstandingBalance: number | null;  // live ledger balance; null without a linked student
}

export interface RenderOptions {
  /** Disable deflate so tests can grep literal strings in the content stream. */
  compress?: boolean;
}

function formatMoney(n: number): string {
  return n.toFixed(2).replace(/\\B(?=(\\d{3})+(?!\\d))/g, ',');
}

function formatDate(d: Date | string): string {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function renderReceiptPdf(data: ReceiptPdfData, opts: RenderOptions = {}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A5', margin: 32, compress: opts.compress ?? true });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.info.Title = `Receipt ${data.receiptNumber}`;

    const left = doc.page.margins.left;
    const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    // ── Letterhead ──
    doc.fontSize(15).font('Helvetica-Bold').fillColor('#1a1a1a')
      .text('SCHOOL MANAGEMENT SYSTEM', { align: 'center' });
    doc.fontSize(8).font('Helvetica').fillColor('#555555')
      .text('Institutional Collections & Receipting Office', { align: 'center' });
    doc.moveDown(0.4);
    doc.moveTo(left, doc.y).lineTo(left + width, doc.y).lineWidth(1).strokeColor('#999999').stroke();
    doc.moveDown(0.7);
    doc.fontSize(12).font('Helvetica-Bold').fillColor('#000000')
      .text('OFFICIAL PAYMENT RECEIPT', { align: 'center' });
    doc.moveDown(0.9);

    // ── Receipt meta (two columns) ──
    const metaY = doc.y;
    doc.fontSize(9).font('Helvetica-Bold').text(`Receipt No: ${data.receiptNumber}`, left, metaY);
    doc.font('Helvetica')
      .text(`Date Issued: ${formatDate(data.dateProcessed)}`, left + width - 170, metaY, { width: 170, align: 'right' });
    doc.moveDown(0.9);

    // ── Student block ──
    doc.fontSize(9).font('Helvetica');
    doc.text(`Student: ${data.studentName}`, left);
    doc.text(`Student ID: ${data.studentCode ?? 'Not linked (walk-in entry)'}`, left);
    doc.text(`Class: ${data.className ?? 'N/A'}`, left);
    doc.moveDown(0.8);

    // ── Amount figures + words ──
    doc.fontSize(12).font('Helvetica-Bold')
      .text(`AMOUNT PAID: GHS ${formatMoney(data.amountPaid)}`, left);
    doc.fontSize(8.5).font('Helvetica-Oblique').fillColor('#333333')
      .text(amountInWords(data.amountPaid), left, doc.y, { width });
    doc.fillColor('#000000').moveDown(0.6);
    doc.fontSize(9).font('Helvetica');
    doc.text(`Payment Method: ${data.paymentMethod}`, left);
    doc.text(`Reference: ${data.referenceNo}`, left);
    doc.moveDown(0.8);

    // ── Allocation table ──
    const tableTop = doc.y;
    doc.font('Helvetica-Bold').fontSize(9);
    doc.text('Allocation Target', left, tableTop, { width: width - 90 });
    doc.text('Amount (GHS)', left + width - 90, tableTop, { width: 90, align: 'right' });
    doc.moveTo(left, tableTop + 12).lineTo(left + width, tableTop + 12).lineWidth(0.7).strokeColor('#666666').stroke();
    doc.font('Helvetica');
    doc.text(data.allocationTarget, left, tableTop + 16, { width: width - 90 });
    doc.text(formatMoney(data.amountPaid), left + width - 90, tableTop + 16, { width: 90, align: 'right' });
    const rowHeight = Math.max(14, doc.heightOfString(data.allocationTarget, { width: width - 90 }) + 4);
    doc.moveTo(left, tableTop + 16 + rowHeight).lineTo(left + width, tableTop + 16 + rowHeight)
      .lineWidth(0.4).strokeColor('#cccccc').stroke();
    doc.y = tableTop + 16 + rowHeight + 10;

    // ── Outstanding balance (live ledger read at print time) ──
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#000000').text(
      data.outstandingBalance === null
        ? 'Current Outstanding Balance: N/A (no linked student ledger)'
        : `Current Outstanding Balance: GHS ${formatMoney(data.outstandingBalance)}`,
      left,
    );
    doc.moveDown(2);

    // ── Receipt authority lines ──
    doc.fontSize(9).font('Helvetica');
    doc.text('Received by: ______________________________', left);
    doc.moveDown(1.2);
    doc.text('Signature & Stamp: ________________________', left);

    // ── Footer ──
    doc.fontSize(7).fillColor('#777777').text(
      `Generated on demand from live ledger data -- ${new Date().toISOString()}`,
      left,
      doc.page.height - doc.page.margins.bottom - 26,
      { width, align: 'center' },
    );

    doc.end();
  });
}
'''

# ── New file 3: tests ────────────────────────────────────────────────────────
PDF_TESTS = '''import { describe, it, expect, vi } from 'vitest';
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

  it('embeds key receipt strings in the uncompressed content stream', async () => {
    const text = (await renderReceiptPdf(sample, { compress: false })).toString('latin1');
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
'''


def main() -> None:
    if not BACKEND.is_dir():
        raise SystemExit("ABORT: sms-core-backend/ not found. Run from ~/sms-monorepo.")

    create("src/lib/amount-in-words.ts", AMOUNT_IN_WORDS)
    create("src/lib/pdf.ts", PDF_LIB)
    create("src/__tests__/unit/lib/pdf.test.ts", PDF_TESTS)

    edit(
        "src/types/repositories.ts",
        "  createCollection(data: CollectionCreateData, tx?: TransactionClient): Promise<any>;\n",
        "  createCollection(data: CollectionCreateData, tx?: TransactionClient): Promise<any>;\n"
        "  // SMS-007: receipt rendering reads\n"
        "  findReceiptCollectionById(collectionId: string, tx?: TransactionClient): Promise<any>;\n",
        "IFinanceRepository receipt reads",
        "findReceiptCollectionById",
    )

    edit(
        "src/modules/finance/finance.repository.ts",
        "  async createCollection(data: CollectionCreateData, tx: TransactionClient = prisma) {\n"
        "    return tx.paymentCollection.create({ data });\n"
        "  }\n",
        "  async createCollection(data: CollectionCreateData, tx: TransactionClient = prisma) {\n"
        "    return tx.paymentCollection.create({ data });\n"
        "  }\n\n"
        "  // SMS-007: full receipt projection (class + linked student + live balance)\n"
        "  async findReceiptCollectionById(collectionId: string, tx: TransactionClient = prisma) {\n"
        "    return tx.paymentCollection.findUnique({\n"
        "      where: { id: collectionId },\n"
        "      include: {\n"
        "        class: { select: { name: true, section: true } },\n"
        "        student: { select: { studentId: true, billing: { select: { currentBalance: true } } } },\n"
        "      },\n"
        "    });\n"
        "  }\n",
        "FinanceRepository.findReceiptCollectionById",
        "findReceiptCollectionById",
    )

    edit(
        "src/modules/finance/finance.service.ts",
        'import { FinanceRepository } from "./finance.repository";\n',
        'import { FinanceRepository } from "./finance.repository";\n'
        'import type { ReceiptPdfData } from "@/lib/pdf";\n',
        "service receipt DTO import",
        'from "@/lib/pdf"',
    )

    edit(
        "src/modules/finance/finance.service.ts",
        "  async getStudentsBySection(sectionId: string) {\n",
        "  // SMS-007: project a collection row into the printable receipt DTO.\n"
        "  async getReceiptForPdf(collectionId: string): Promise<ReceiptPdfData> {\n"
        "    const record = await this.repo.findReceiptCollectionById(collectionId);\n"
        "    if (!record || record.deletedAt) {\n"
        "      throw new AppError(404, `No payment collection found for id: ${collectionId}`);\n"
        "    }\n"
        "    return {\n"
        "      receiptNumber: record.receiptNumber,\n"
        "      dateProcessed: record.dateProcessed,\n"
        "      studentName: record.studentName,\n"
        "      studentCode: record.student?.studentId ?? null,\n"
        "      className: record.class\n"
        "        ? `${record.class.name}${record.class.section ? ` — Section ${record.class.section}` : ''}`\n"
        "        : null,\n"
        "      amountPaid: parseDecimal(record.amountPaid),\n"
        "      paymentMethod: record.paymentMethod,\n"
        "      referenceNo: record.referenceNo,\n"
        "      allocationTarget: record.allocationTarget,\n"
        "      outstandingBalance: record.student?.billing ? parseDecimal(record.student.billing.currentBalance) : null,\n"
        "    };\n"
        "  }\n\n"
        "  async getStudentsBySection(sectionId: string) {\n",
        "FinanceService.getReceiptForPdf",
        "getReceiptForPdf",
    )

    edit(
        "src/modules/finance/finance.controller.ts",
        "import { toCSV, respondCSV } from '@/utils/export';\n",
        "import { toCSV, respondCSV } from '@/utils/export';\n"
        "import { renderReceiptPdf } from '@/lib/pdf';\n",
        "controller pdf import",
        "renderReceiptPdf",
    )

    edit(
        "src/modules/finance/finance.controller.ts",
        "  commitInflow = async (req: Request, res: Response, next: NextFunction) => {\n"
        "    try {\n"
        "      const record = await this.financeService.processInflowCollection(req.body);\n"
        "      return res.status(201).json({ success: true, data: record });\n"
        "    } catch (error) { next(error); }\n"
        "  };\n",
        "  commitInflow = async (req: Request, res: Response, next: NextFunction) => {\n"
        "    try {\n"
        "      const record = await this.financeService.processInflowCollection(req.body);\n"
        "      return res.status(201).json({ success: true, data: record });\n"
        "    } catch (error) { next(error); }\n"
        "  };\n\n"
        "  // SMS-007: GET /api/finance/payments/:id/receipt.pdf -- print-ready A5 receipt\n"
        "  streamReceiptPdf = async (req: Request, res: Response, next: NextFunction) => {\n"
        "    try {\n"
        "      const data = await this.financeService.getReceiptForPdf(req.params.id!);\n"
        "      const pdfBuffer = await renderReceiptPdf(data);\n"
        "      res.setHeader('Content-Type', 'application/pdf');\n"
        "      res.setHeader('Content-Disposition', `inline; filename=\"receipt-${data.receiptNumber}.pdf\"`);\n"
        "      return res.send(pdfBuffer);\n"
        "    } catch (error) { next(error); }\n"
        "  };\n",
        "FinanceController.streamReceiptPdf",
        "streamReceiptPdf",
    )

    edit(
        "src/modules/finance/finance.routes.ts",
        "router.get('/invoices', financeAccess, controller.getInvoices);\n",
        "router.get('/invoices', financeAccess, controller.getInvoices);\n\n"
        "// SMS-007: on-demand printable receipt (finance-access roles: ADMIN + ACCOUNTANT)\n"
        "router.get('/payments/:id/receipt.pdf', financeAccess, controller.streamReceiptPdf);\n",
        "receipt.pdf route",
        "receipt.pdf",
    )

    print()
    print("SMS-007 backend applied. Next: gates (lint/test/build), then the docker rebuild + PDF smoke.")


if __name__ == "__main__":
    main()
