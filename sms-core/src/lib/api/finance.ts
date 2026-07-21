import { useQuery } from "@tanstack/react-query";
import { fetchWithAuth } from "@/lib/fetch-with-auth";

interface PayrollApiResponse {
  data: Array<{
    id: string;
    name: string;
    role: string;
    baseSalary: number;
    allowances: number;
    deductions: number;
    status: "Disbursed" | "Pending";
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface PayrollRecord {
  id: string;
  staffName: string;
  baseSalary: number;
  allowances: number;
  deductions: number;
  payPeriod: string;
  status: "Paid" | "Processing" | "On_Hold";
}

export function usePayroll(page: number = 1, limit: number = 20) {
  return useQuery({
    queryKey: ["finance", "payroll", page, limit],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      const res = await fetchWithAuth("/api/finance/payroll?" + params);
      if (!res.ok) throw new Error("Failed to fetch payroll");
      const json = await res.json();

      const records = json.data.map((row: { id: string; name: string; baseSalary: number; allowances: number; deductions: number; status: string }) => ({
        id: row.id,
        staffName: row.name,
        baseSalary: row.baseSalary,
        allowances: row.allowances,
        deductions: row.deductions,
        payPeriod: "Current Period",
        status: row.status === "Disbursed" ? "Paid" : "Processing",
      }));

      return { data: records, pagination: json.pagination };
    },
    placeholderData: (prev) => prev,
  });
}

export function useCollections(page: number = 1, limit: number = 20) {
  return useQuery({
    queryKey: ["finance", "collections", page, limit],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      const res = await fetchWithAuth("/api/finance/collections?" + params);
      if (!res.ok) throw new Error("Failed to fetch collections");
      const json = await res.json();

      const records = json.data.map((row: { receiptNumber: string; studentName: string; amountPaid: string; paymentMethod: string; referenceNo: string; dateProcessed: string; sectionId: string }) => ({
        id: row.receiptNumber,
        invoiceId: "N/A",
        studentId: row.sectionId,
        amountPaid: parseFloat(row.amountPaid),
        paymentMethod: row.paymentMethod,
        referenceNo: row.referenceNo,
        dateProcessed: row.dateProcessed,
        status: "Cleared" as const,
      }));

      return { data: records, pagination: json.pagination };
    },
    placeholderData: (prev) => prev,
  });
}
export function useInvoices(page: number = 1, limit: number = 20) {
  return useQuery({
    queryKey: ["finance", "invoices", page, limit],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
      });
      const res = await fetchWithAuth("/api/finance/invoices?" + params);
      if (!res.ok) throw new Error("Failed to fetch invoices");
      const json = await res.json();
      return { data: json.data, pagination: json.pagination };
    },
    placeholderData: (prev) => prev,
  });
}

export function useExpenses(page: number = 1, limit: number = 20) {
  return useQuery({
    queryKey: ["finance", "expenses", page, limit],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      const res = await fetchWithAuth("/api/finance/expenses?" + params);
      if (!res.ok) throw new Error("Failed to fetch expenses");
      const json = await res.json();
      return { data: json.data, pagination: json.pagination };
    },
    placeholderData: (prev) => prev,
  });
}
