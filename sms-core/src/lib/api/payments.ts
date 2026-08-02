import { useQuery, useMutation } from "@tanstack/react-query";
import { fetchWithAuth } from "@/lib/fetch-with-auth";

const PAYMENTS_BASE = "/payments";

export interface FeeInvoice {
  id: string;
  invoiceNo: string;
  description: string;
  amount: number;
  dueDate: string;
  paidAmount: number;
  status: "UNPAID" | "PARTIAL" | "PAID";
  createdAt: string;
}

export interface FeePayment {
  id: string;
  receiptNumber: string;
  amountPaid: number;
  paymentMethod: string;
  referenceNo: string;
  allocationTarget: string;
  dateProcessed: string;
}

export interface PendingIntent {
  id: string;
  reference: string;
  status: string;
  amount: number;
  createdAt: string;
  authorizationUrl: string | null;
}

export interface SelfFeesSummary {
  student: { id: string; studentId: string; studentName: string };
  balance: number;
  invoices: FeeInvoice[];
  payments: FeePayment[];
  pendingIntent: PendingIntent | null;
}

export interface CreatedCheckout {
  id: string;
  reference: string;
  status: string;
  amount: number;
  currency: string;
  authorizationUrl: string;
  accessCode?: string;
  resumed?: boolean;
}

export interface IntentStatus {
  id: string;
  reference: string;
  status: string;
  amount: number;
  currency: string;
  channel?: string | null;
  paidAt?: string | null;
  createdAt: string;
  verificationTriggered?: boolean;
}

async function readJson<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let msg = "Request failed.";
    try {
      const j = await res.json();
      if (j?.message) msg = j.message;
      else if (j?.errors?.length) msg = j.errors[0]?.message || msg;
    } catch {
      /* ignore */
    }
    throw new Error(msg);
  }
  const json = await res.json();
  return json.data as T;
}

export function useMyFees() {
  return useQuery<SelfFeesSummary>({
    queryKey: ["my-fees"],
    queryFn: async () => readJson<SelfFeesSummary>(await fetchWithAuth(`${PAYMENTS_BASE}/fees/me`)),
  });
}

export function useCreateCheckout() {
  return useMutation<CreatedCheckout, Error, { payerEmail: string; amount: number }>({
    mutationFn: async (input) =>
      readJson<CreatedCheckout>(
        await fetchWithAuth(`${PAYMENTS_BASE}/intents/me`, {
          method: "POST",
          body: JSON.stringify(input),
        }),
      ),
  });
}

export async function fetchIntentStatus(
  reference: string,
  verify = true,
): Promise<IntentStatus> {
  return readJson<IntentStatus>(
    await fetchWithAuth(`${PAYMENTS_BASE}/intents/${reference}/status?verify=${verify}`),
  );
}
