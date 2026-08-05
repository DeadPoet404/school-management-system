/**
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
  return n.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
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
    // Searchable metadata channel (Info dict is stored as literal strings;
    // the content stream itself is glyph-encoded by modern pdfkit).
    doc.info.Subject = `OFFICIAL PAYMENT RECEIPT - ${data.studentName} - ${data.paymentMethod}`;
    doc.info.Keywords = amountInWords(data.amountPaid);

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
