import { describe, expect, it, vi } from 'vitest';
import type { IFinanceRepository } from '@/types/repositories';
import {
  StudentPhotoStorageConfigurationError,
  type SupabaseStudentPhotoStorage,
} from '@/lib/student-photo-storage';
import { FinanceService } from '@/modules/finance/finance.service';

type ReceiptPhotoStorage = Pick<
  SupabaseStudentPhotoStorage,
  'createSignedUrl'
>;

function createReceiptRecord(photoKey: string | null) {
  return {
    id: 'collection-1',
    deletedAt: null,
    receiptNumber: 'REC-2026-0010',
    dateProcessed: new Date('2026-09-11T00:00:00.000Z'),
    studentName: 'Ama Yaw Osei',
    amountPaid: '250.00',
    paymentMethod: 'CASH',
    referenceNo: 'N/A (Direct)',
    allocationTarget: 'Tuition',
    class: { name: 'JHS 1', section: 'A' },
    student: {
      studentId: 'JCS-26-001',
      photoKey,
      billing: { currentBalance: '450.00' },
    },
  };
}

function createInstitution() {
  return {
    schoolName: 'Jocomfy School',
    schoolCode: 'JCS',
    motto: 'Learning with purpose',
    address: 'Accra, Ghana',
    phone: '+233 55 818 6259 · +233 24 263 8801',
    email: 'jocomfyschool@gmail.com',
    logoUrl: '/branding/jocomfy-school-logo.png',
    currency: 'GHS',
  };
}

function createService(
  photoKey: string | null,
  storageFactory: () => ReceiptPhotoStorage,
) {
  const repo = {
    findReceiptCollectionById: vi.fn().mockResolvedValue(
      createReceiptRecord(photoKey),
    ),
    findReceiptInstitution: vi.fn().mockResolvedValue(
      createInstitution(),
    ),
  } as unknown as IFinanceRepository;

  return {
    service: new FinanceService(repo, storageFactory),
    repo,
  };
}

describe('FinanceService A5 receipt student-photo flow', () => {
  it('does not create a Storage client for PDF/email receipt data', async () => {
    const storageFactory = vi.fn();
    const { service } = createService(
      'student-1/photo-existing.png',
      storageFactory,
    );

    const data = await service.getReceiptForPdf('collection-1');

    expect(data.receiptNumber).toBe('REC-2026-0010');
    expect(storageFactory).not.toHaveBeenCalled();
  });

  it('creates a short-lived student photo URL for the A5 print receipt only', async () => {
    const createSignedUrl = vi.fn().mockResolvedValue(
      'https://storage.example.test/signed/student-photo.png',
    );
    const storageFactory = vi.fn(() => ({ createSignedUrl }));
    const { service } = createService(
      'student-1/photo-existing.png',
      storageFactory,
    );

    const data = await service.getReceiptForPrint('collection-1');

    expect(storageFactory).toHaveBeenCalledTimes(1);
    expect(createSignedUrl).toHaveBeenCalledWith(
      'student-1/photo-existing.png',
    );
    expect(data.studentPhotoUrl).toBe(
      'https://storage.example.test/signed/student-photo.png',
    );
  });

  it('keeps the fallback avatar when no student photo exists', async () => {
    const storageFactory = vi.fn();
    const { service } = createService(null, storageFactory);

    const data = await service.getReceiptForPrint('collection-1');

    expect(data.studentPhotoUrl).toBeNull();
    expect(storageFactory).not.toHaveBeenCalled();
  });

  it('keeps the fallback avatar when private Storage is not configured', async () => {
    const storageFactory = vi.fn(() => {
      throw new StudentPhotoStorageConfigurationError(
        'Student photo storage is not configured.',
      );
    });
    const { service } = createService(
      'student-1/photo-existing.png',
      storageFactory,
    );

    const data = await service.getReceiptForPrint('collection-1');

    expect(data.studentPhotoUrl).toBeNull();
    expect(storageFactory).toHaveBeenCalledTimes(1);
  });
});
