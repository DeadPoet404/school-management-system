import { useQuery } from "@tanstack/react-query";
import { fetchWithAuth } from "@/lib/fetch-with-auth";

/**
 * D-08: Reference data hooks.
 *
 * The enrollment wizards previously used hardcoded MOCK_ arrays with invented
 * IDs (cls-1, tier-std, dept-mat) delivered by a fake setTimeout. Those IDs do
 * not exist in the database - real rows use UUIDs - so every submission
 * carried invalid foreign keys. These hooks read the real catalogue from
 * GET /api/reference/*.
 */

export interface ReferenceClass {
  id: string;
  name: string;
  section: string | null;
  isActive: boolean;
}

export interface ReferenceSubject {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
}

export interface ReferenceDepartment {
  id: string;
  name: string;
  code: string;
  isActive: boolean;
}

export interface ReferenceFeeTier {
  id: string;
  name: string;
  code: string;
  /** Prisma serialises Decimal as a string, e.g. "1800". */
  amount: string;
  isActive: boolean;
}

export interface ReferenceTerm {
  id: string;
  name: string;
  academicYear: string;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

async function getReference<T>(resource: string): Promise<T[]> {
  const response = await fetchWithAuth(`/reference/${resource}`);

  if (!response.ok) {
    throw new Error(
      `Failed to load reference data "${resource}" (HTTP ${response.status})`
    );
  }

  const json = (await response.json()) as { data?: T[] };
  return json?.data ?? [];
}

// Reference data changes rarely; cache it for longer than the global default.
const REFERENCE_STALE_TIME = 5 * 60 * 1000;

export function useClasses() {
  return useQuery<ReferenceClass[]>({
    queryKey: ["reference", "classes"],
    queryFn: () => getReference<ReferenceClass>("classes"),
    staleTime: REFERENCE_STALE_TIME,
  });
}

export function useSubjects() {
  return useQuery<ReferenceSubject[]>({
    queryKey: ["reference", "subjects"],
    queryFn: () => getReference<ReferenceSubject>("subjects"),
    staleTime: REFERENCE_STALE_TIME,
  });
}

export function useDepartments() {
  return useQuery<ReferenceDepartment[]>({
    queryKey: ["reference", "departments"],
    queryFn: () => getReference<ReferenceDepartment>("departments"),
    staleTime: REFERENCE_STALE_TIME,
  });
}

export function useFeeTiers() {
  return useQuery<ReferenceFeeTier[]>({
    queryKey: ["reference", "fee-tiers"],
    queryFn: () => getReference<ReferenceFeeTier>("fee-tiers"),
    staleTime: REFERENCE_STALE_TIME,
  });
}

export function useTerms() {
  return useQuery<ReferenceTerm[]>({
    queryKey: ["reference", "terms"],
    queryFn: () => getReference<ReferenceTerm>("terms"),
    staleTime: REFERENCE_STALE_TIME,
  });
}
