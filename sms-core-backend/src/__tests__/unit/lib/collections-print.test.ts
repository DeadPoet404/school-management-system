import { describe, expect, it } from 'vitest';
import { renderCollectionsPrintHtml } from '@/lib/collections-print';

describe('renderCollectionsPrintHtml', () => {
  it('renders the daily payment register with the class-list letterhead and totals', () => {
    const html = renderCollectionsPrintHtml({
      date: '2026-09-18',
      totalAmount: 2450.5,
      payments: [
        {
          receiptNumber: 'REC-2026-0001',
          studentName: 'Ama <A>',
          studentCode: 'STU-001',
          className: 'Basic 1',
          amountPaid: 2450.5,
          paymentMethod: 'CASH',
          referenceNo: 'Counter 1',
          allocationTarget: 'Termly Tuition',
          dateProcessed: '2026-09-18T10:15:00.000Z',
        },
      ],
    });

    expect(html).toContain('JOCOMFY SCHOOL');
    expect(html).toContain('PAYMENT COLLECTIONS');
    expect(html).toContain('Daily Payment Register');
    expect(html).toContain('18 September 2026');
    expect(html).toContain('₵2,450.50');
    expect(html).toContain('10:15');
    expect(html).toContain('Ama &lt;A&gt;');
    expect(html).toContain('A4 landscape');
  });

  it('renders a useful empty-state register', () => {
    const html = renderCollectionsPrintHtml({
      date: '2026-09-19',
      totalAmount: 0,
      payments: [],
    });

    expect(html).toContain('No payments were recorded on this date.');
    expect(html).toContain('Total Payments:</span><b>0');
    expect(html).toContain('₵0.00');
  });
});
