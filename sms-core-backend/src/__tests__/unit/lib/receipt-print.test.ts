import { describe, expect, it } from 'vitest';
import {
  renderReceiptPrintHtml,
  type ReceiptPrintData,
} from '@/lib/receipt-print';

describe('renderReceiptPrintHtml', () => {
  const receipt: ReceiptPrintData = {
    receiptNumber: 'REC-2026-0099',
    dateProcessed: new Date('2026-09-10T00:00:00.000Z'),
    studentName: 'Ama Yaw Osei',
    studentCode: 'JCS-39-006',
    className: 'Creche',
    amountPaid: 500,
    paymentMethod: 'CASH',
    referenceNo: 'N/A (Direct)',
    allocationTarget: 'Tuition Baseline Core',
    outstandingBalance: 1200,
    institution: {
      schoolName: 'Jocomfy School',
      schoolCode: 'JCS',
      motto: 'Learning with purpose',
      address: 'Accra, Ghana',
      phone: '+233 20 000 0000',
      email: 'office@example.test',
      logoUrl: 'https://assets.example.test/jocomfy-school-logo.png',
      currency: 'GHS',
    },
  };

  it('renders a strict A5 navy-and-gold browser-print template', () => {
    const html = renderReceiptPrintHtml(receipt);

    expect(html).toContain('@page { size: A5 portrait; margin: 0; }');
    expect(html).toContain('width: 148mm;');
    expect(html).toContain('min-height: 210mm;');
    expect(html).toContain('--navy: #082a70;');
    expect(html).toContain('--gold: #e4b43c;');
    expect(html).toContain('What this payment covers');
    expect(html).not.toContain('A4');
  });

  it('moves student identity above the divider and keeps receipt information below it', () => {
    const html = renderReceiptPrintHtml(receipt);

    const studentIdentityPosition = html.indexOf('Student payment record');
    const dividerPosition = html.indexOf('class="identity-divider"');
    const receiptTitlePosition = html.indexOf('class="receipt-title"');

    expect(studentIdentityPosition).toBeGreaterThan(-1);
    expect(dividerPosition).toBeGreaterThan(studentIdentityPosition);
    expect(receiptTitlePosition).toBeGreaterThan(dividerPosition);
    expect(html).toContain('Ama Yaw Osei');
    expect(html).toContain('Index: JCS-39-006');
  });

  it('renders the fallback initials avatar when no student photo exists', () => {
    const html = renderReceiptPrintHtml({
      ...receipt,
      studentPhotoUrl: null,
    });

    expect(html).toContain('id="student-avatar"');
    expect(html).toContain('class="avatar-fallback"');
    expect(html).toContain('class="avatar-initials">AO</span>');
    expect(html).not.toContain('id="student-photo"');
  });

  it('renders an authorized student-photo URL when one is supplied', () => {
    const html = renderReceiptPrintHtml({
      ...receipt,
      studentPhotoUrl: 'https://storage.example.test/signed/student-photo.png',
    });

    expect(html).toContain('id="student-photo"');
    expect(html).toContain(
      'src="https://storage.example.test/signed/student-photo.png"',
    );
    expect(html).toContain('student-avatar has-photo');
  });

  it('uses the supplied official Jocomfy receipt contact defaults', () => {
    const html = renderReceiptPrintHtml({
      ...receipt,
      institution: {
        ...receipt.institution!,
        phone: null,
        email: null,
      },
    });

    expect(html).toContain('jocomfyschool@gmail.com');
    expect(html).toContain('+233 55 818 6259 · +233 24 263 8801');
    expect(html).toContain('jocomfy.com');
  });

  it('opens print with a bounded wait on the photo only', () => {
    const html = renderReceiptPrintHtml(receipt);

    expect(html).toContain('waitForImage(studentPhoto');
    expect(html).not.toContain('waitForImage(schoolLogo');
    expect(html).toContain('window.setTimeout(() => window.print(), 60)');
    expect(html).toContain('onclick="window.print()"');
  });

  it('bounds the image wait so the print dialog opens even when the photo is slow', () => {
    const html = renderReceiptPrintHtml(receipt);

    // Admin 2026-09: receipts must display faster — 900ms photo cap + 60ms delay.
    expect(html).toContain('const PHOTO_WAIT_MS = 900;');
    expect(html).not.toContain('LOGO_WAIT_MS');
    expect(html).toContain('window.setTimeout(() => settle(true), timeoutMs)');
    expect(html).not.toContain('window.addEventListener("load"');
  });

  it('renders one fee line (the umbrella label) for deposit receipts, with balance + received kept', () => {
    const html = renderReceiptPrintHtml({
      ...receipt,
      allocationTarget: 'First Term Enrollment (Admission + Uniform + Tuition)',
    });

    expect(html).toContain('>First Term Enrollment (Admission + Uniform + Tuition)</span>');
    // One allocation row only — no fee breakdown.
    expect(html).not.toContain('First-term fee structure');
    expect(html).not.toContain('Admission Fee');
    // The important totals stay.
    expect(html).toContain('Outstanding balance');
    expect(html).toContain('Amount received');
    expect(html).toContain('GHS 500.00');
  });

  it('uses the general heading for every receipt and keeps the allocation line', () => {
    const html = renderReceiptPrintHtml(receipt);

    expect(html).toContain('What this payment covers');
    expect(html).toContain('>Tuition Baseline Core</span>');
  });

  it('uses tighter (1mm) corners on the fee box and the balance/received box', () => {
    const html = renderReceiptPrintHtml(receipt);

    expect(html).toContain('.payment-table {\n      overflow: hidden;\n      /* Admin 2026-09: tighter corners on the fee box. */\n      border-radius: 1mm;');
    expect(html).toContain('.totals {\n      overflow: hidden;\n      /* Admin 2026-09: tighter corners on the balance/received box. */\n      border-radius: 1mm;');
    expect(html).not.toContain('border-radius: 4mm');
    expect(html).not.toContain('border-radius: 3mm');
  });

  it('always uses the bundled same-origin school logo, overriding any stored logoUrl', () => {
    const html = renderReceiptPrintHtml(receipt);

    expect(html).toContain('src="/branding/jocomfy-school-logo.png"');
    expect(html).not.toContain('https://assets.example.test/jocomfy-school-logo.png');
  });

  it('uses a square student photo frame and fallback (not circular)', () => {
    const html = renderReceiptPrintHtml(receipt);

    const avatarRule = html.split('.student-avatar {')[1]?.split('}')[0];

    expect(avatarRule).toContain('border-radius: 2mm;');
    expect(avatarRule).not.toContain('border-radius: 50%');
  });

  it('escapes dynamic payment and student fields before printing', () => {
    const html = renderReceiptPrintHtml({
      ...receipt,
      studentName: '<img src=x onerror=alert(1)>',
      allocationTarget: 'Fees & <arrears>',
    });

    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
    expect(html).toContain('Fees &amp; &lt;arrears&gt;');
    expect(html).not.toContain('<img src=x onerror=alert(1)>');
  });
});
