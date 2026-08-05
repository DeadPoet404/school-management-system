import type { ComponentType } from "react"
import { isOperationAllowedForRole } from "@/lib/role-access"
import type { LucideIcon } from "lucide-react"
import { School, GraduationCap, FileSpreadsheet, Wallet } from "lucide-react"
import { TimetableStructureSetup } from "@/components/timetable-structure-setup"
import { FeeStructureInvoiceConfig } from "@/components/fee-structure-invoice-config"
import { PaymentInflowCollectionLog } from "@/components/payment-inflow-collection-log"
import { PayrollLedgersView } from "@/components/payroll-ledgers-view"

// SMS-003: single source of truth for the Operations workspace.
// The sidebar renders exactly these modules and the page resolves exactly
// these workspaces. Only shipped V1 flows may appear here — unimplemented
// modules must not be advertised, and no placeholder dead ends are allowed.

export type OperationsModuleAction =
  | { type: "view"; component: ComponentType }
  | { type: "route"; path: string }

export interface OperationsModule {
  id: string
  title: string
  action: OperationsModuleAction
}

export interface OperationsSection {
  title: string
  icon: LucideIcon
  group: string
  modules: OperationsModule[]
}

export const OPERATIONS_SECTIONS: OperationsSection[] = [
  {
    title: "Academic Operations",
    icon: School,
    group: "Infrastructure",
    modules: [
      {
        id: "class-gen",
        title: "Timetable & Scheduling",
        action: { type: "view", component: TimetableStructureSetup },
      },
      {
        id: "attendance-registry",
        title: "Attendance Registry",
        action: { type: "route", path: "/operations/attendance" },
      },
    ],
  },
  {
    title: "Finance & Accounts",
    icon: Wallet,
    group: "Bursar Control",
    modules: [
      {
        id: "fee-structure",
        title: "Fee Structures & Invoicing",
        action: { type: "view", component: FeeStructureInvoiceConfig },
      },
      {
        id: "payment-collection",
        title: "Collections & Receipts",
        action: { type: "view", component: PaymentInflowCollectionLog },
      },
      {
        id: "payroll-ledgers",
        title: "Payroll & Ledgers",
        action: { type: "view", component: PayrollLedgersView },
      },
    ],
  },
  {
    title: "Student Lifecycle Hub",
    icon: GraduationCap,
    group: "Student Management",
    modules: [
      {
        id: "enrollment-workflow",
        title: "Enrollment workflow",
        action: { type: "route", path: "/students/add?from=operations" },
      },
    ],
  },
  {
    title: "Assessments & Exams",
    icon: FileSpreadsheet,
    group: "Academic Testing",
    modules: [
      {
        id: "ca-gradebook",
        title: "Continuous Assessment Sheet",
        action: { type: "route", path: "/students/gradebook" },
      },
    ],
  },
]

export const OPERATIONS_MODULES: OperationsModule[] = OPERATIONS_SECTIONS.flatMap(
  (section) => section.modules
)

export function findOperationsModule(id: string): OperationsModule | undefined {
  return OPERATIONS_MODULES.find((module) => module.id === id)
}

export const DEFAULT_OPERATIONS_MODULE_ID: string =
  OPERATIONS_MODULES.find((module) => module.action.type === "view")?.id ?? "class-gen"

// SMS-005: role-scoped accessors so the Operations sidebar and page never
// expose a module the backend would reject with 403 for the current role.

export function operationsSectionsForRole(role: string | null | undefined): OperationsSection[] {
  return OPERATIONS_SECTIONS
    .map((section) => ({
      ...section,
      modules: section.modules.filter((module) => isOperationAllowedForRole(role, module.id)),
    }))
    .filter((section) => section.modules.length > 0)
}

export function findOperationsModuleForRole(
  role: string | null | undefined,
  id: string
): OperationsModule | undefined {
  const found = OPERATIONS_MODULES.find((m) => m.id === id)
  if (!found) return undefined
  return isOperationAllowedForRole(role, id) ? found : undefined
}

export function defaultOperationsModuleIdForRole(role: string | null | undefined): string | null {
  const first = OPERATIONS_MODULES.find(
    (module) => module.action.type === "view" && isOperationAllowedForRole(role, module.id)
  )
  return first ? first.id : null
}

