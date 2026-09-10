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
    expect(html).toContain('Payment allocation');
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

  it('waits for image loading before automatically opening print', () => {
    const html = renderReceiptPrintHtml(receipt);

    expect(html).toContain('waitForImage(schoolLogo');
    expect(html).toContain('waitForImage(studentPhoto');
    expect(html).toContain('Promise.all([schoolLogoTask, studentPhotoTask])');
    expect(html).toContain('window.setTimeout(() => window.print(), 180)');
    expect(html).toContain('onclick="window.print()"');
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
