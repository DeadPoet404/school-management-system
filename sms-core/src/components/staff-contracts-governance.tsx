"use client"

import * as React from "react"
import { useState, useMemo } from "react"
import { 
  Briefcase, 
  FileText, 
  DollarSign, 
  Clock, 
  ShieldCheck, 
  FileCheck,
  AlertTriangle
} from "lucide-react"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"

// --- DATA STRUCTURE SCHEMA CONTRACTS ---
export interface ContractRecord {
  id: string
  employeeName: string
  designation: string
  tier: "Academic Faculty" | "Executive Administration" | "Operational Support"
  termType: "Full-Time Permanent" | "Fixed-Term Academic Year" | "Sessional Part-Time"
  baseRemuneration: number
  commencementDate: string
  expirationDate: string
  status: "Active" | "Probationary" | "Pending Renewal"
}

interface ContractMetrics {
  active: number
  probation: number
  renewals: number
}

const ROLE_TIERS = [
  { id: "academic", label: "Academic Faculty" },
  { id: "admin", label: "Executive Administration" },
  { id: "ops", label: "Operational Support" }
] as const

// FUTURE: Remove this mock data and replace with a fetch to GET /api/finance/contracts
const INITIAL_CONTRACTS: ContractRecord[] = [
  { id: "CNT-2026-01", employeeName: "Dr. Emmanuel Boateng", designation: "Senior Mathematics Master", tier: "Academic Faculty", termType: "Full-Time Permanent", baseRemuneration: 4500, commencementDate: "2024-09-01", expirationDate: "2028-08-31", status: "Active" },
  { id: "CNT-2026-02", employeeName: "Sarah Ali", designation: "Head of Admissions & Communications", tier: "Executive Administration", termType: "Full-Time Permanent", baseRemuneration: 3800, commencementDate: "2025-01-15", expirationDate: "2027-01-14", status: "Active" },
  { id: "CNT-2026-03", employeeName: "Kofi Mensah", designation: "Junior ICT Instructor", tier: "Academic Faculty", termType: "Fixed-Term Academic Year", baseRemuneration: 2900, commencementDate: "2025-09-01", expirationDate: "2026-08-31", status: "Pending Renewal" },
  { id: "CNT-2026-04", employeeName: "Grace Osei", designation: "Logistics Assistant Coordination", tier: "Operational Support", termType: "Sessional Part-Time", baseRemuneration: 2100, commencementDate: "2026-02-01", expirationDate: "2026-12-31", status: "Probationary" }
]

// --- UTILITY HELPERS ---
const formatDate = (dateStr: string) => {
  return new Date(dateStr).toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  })
}

const getExpirationStatus = (dateStr: string) => {
  const diffTime = new Date(dateStr).getTime() - new Date().getTime();
  const daysLeft = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (daysLeft < 0) return { text: `Expired ${Math.abs(daysLeft)} days ago`, color: "text-red-500 dark:text-red-400", bg: "bg-red-50 dark:bg-red-950/20" };
  if (daysLeft <= 90) return { text: `${daysLeft} days remaining`, color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-950/20" };
  return { text: `${daysLeft} days remaining`, color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/20" };
}

export function StaffContractsGovernance() {
  const [activeTier, setActiveTier] = useState<typeof ROLE_TIERS[number]["id"]>("academic")
  const [contractLedger] = useState<ContractRecord[]>(INITIAL_CONTRACTS)

  const currentTierLabel = useMemo(() => {
    return ROLE_TIERS.find((t) => t.id === activeTier)?.label || "Academic Faculty"
  }, [activeTier])

  const filteredContracts = useMemo(() => {
    return contractLedger.filter((contract: ContractRecord) => contract.tier === currentTierLabel)
  }, [contractLedger, currentTierLabel])

  const contractMetrics = useMemo<ContractMetrics>(() => {
    return contractLedger.reduce((acc: ContractMetrics, curr: ContractRecord) => {
      if (curr.status === "Active") acc.active += 1
      if (curr.status === "Probationary") acc.probation += 1
      if (curr.status === "Pending Renewal") acc.renewals += 1
      return acc
    }, { active: 0, probation: 0, renewals: 0 })
  }, [contractLedger])

  return (
    <main className="flex-1 h-full flex flex-col bg-transparent px-8 py-6 overflow-hidden">
      
      {/* Structural Sub-Header Dashboard Panel */}
      <div className="flex flex-col gap-2 shrink-0">
        <div className="inline-flex items-center gap-1.5 text-xs tracking-wide uppercase font-bold text-stone-400 dark:text-zinc-500">
          Workforce Infrastructure / Contractual Architecture
        </div>
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl tracking-tight font-semibold text-foreground">
              Staff Terms & Contractual Governance
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Analyze structural tenures, manage legal runtime execution windows, and track system remuneration baselines.
            </p>
          </div>
        </div>
      </div>

      {/* HORIZONTAL METRIC BAR HUB */}
      <div className="mt-5 grid grid-cols-3 gap-4 max-w-3xl shrink-0">
        <div className="bg-stone-50 dark:bg-zinc-900/30 p-3.5 border border-stone-200/50 dark:border-zinc-800/50 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-stone-400 dark:text-zinc-500 uppercase tracking-wider block">Fully Executed</span>
            <span className="text-lg font-semibold text-stone-900 dark:text-zinc-100 mt-0.5 block">{contractMetrics.active} Contracts</span>
          </div>
          <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-500 shrink-0" />
        </div>
        <div className="bg-stone-50 dark:bg-zinc-900/30 p-3.5 border border-stone-200/50 dark:border-zinc-800/50 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-stone-400 dark:text-zinc-500 uppercase tracking-wider block">Probation Lifecycles</span>
            <span className="text-lg font-semibold text-stone-900 dark:text-zinc-100 mt-0.5 block">{contractMetrics.probation} Active</span>
          </div>
          <Clock className="h-5 w-5 text-amber-500 dark:text-amber-400 shrink-0" />
        </div>
        <div className="bg-stone-50 dark:bg-zinc-900/30 p-3.5 border border-stone-200/50 dark:border-zinc-800/50 rounded-xl flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold text-stone-400 dark:text-zinc-500 uppercase tracking-wider block">Term Anomalies / Actions</span>
            <span className="text-lg font-semibold text-stone-900 dark:text-zinc-100 mt-0.5 block">{contractMetrics.renewals} Due Renewal</span>
          </div>
          <FileText className="h-5 w-5 text-stone-400 dark:text-zinc-500 shrink-0" />
        </div>
      </div>

      {/* COMPONENT CONTINUITY LAYER BAR NAVIGATION TOGGLE */}
      <div className="mt-6 shrink-0 flex items-center bg-stone-100 dark:bg-zinc-900/50 p-1.5 rounded-lg border border-stone-200/40 dark:border-zinc-800/40 max-w-lg">
        {ROLE_TIERS.map((tier) => (
          <button
            key={tier.id}
            type="button"
            onClick={() => setActiveTier(tier.id)}
            className={cn(
              "flex-1 text-center py-1.5 rounded text-xs font-medium transition-all tracking-tight",
              activeTier === tier.id
                ? "bg-white dark:bg-zinc-800 text-stone-900 dark:text-zinc-50 shadow-sm border border-stone-200/20 dark:border-zinc-700/30 font-semibold"
                : "text-stone-500 dark:text-zinc-400 hover:text-stone-800 dark:hover:text-zinc-200"
            )}
          >
            {tier.label}
          </button>
        ))}
      </div>

      <hr className="border-stone-200 dark:border-zinc-800 shrink-0 mt-5 mb-6" />

      {/* CORE WORKSPACE TRACK LAYOUT SECTION */}
      <ScrollArea className="flex-1 w-full max-w-3xl rounded-none border-none shadow-none bg-transparent">
        <div className="space-y-4 pr-4 pb-12">
          
          <div>
            <h3 className="text-sm font-semibold text-stone-900 dark:text-zinc-100 tracking-tight">
              Active Contract Term Ledger Matrix
            </h3>
            <p className="text-[11px] text-stone-400 dark:text-zinc-500 mt-0.5">
              Current binding institutional parameters within the <strong className="text-stone-600 dark:text-zinc-300 font-medium">{currentTierLabel}</strong> tier.
            </p>
          </div>

          <div className="space-y-3">
            {filteredContracts.map((contract: ContractRecord) => {
              const expiry = getExpirationStatus(contract.expirationDate)
              return (
                <div key={contract.id} className="p-4 bg-white dark:bg-zinc-950 border border-stone-200/70 dark:border-zinc-800/70 rounded-xl flex flex-col gap-3.5">
                  
                  {/* Top Identification Block */}
                  <div className="flex items-start justify-between min-w-0">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs font-bold text-stone-900 dark:text-zinc-100 truncate">{contract.employeeName}</h4>
                        <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 bg-stone-100 dark:bg-zinc-900 border border-stone-200/40 dark:border-zinc-800/40 rounded text-stone-500 dark:text-zinc-400">{contract.id}</span>
                      </div>
                      <p className="text-[11px] text-stone-500 dark:text-zinc-400 mt-0.5 flex items-center gap-1">
                        <Briefcase className="h-3 w-3 text-stone-400 dark:text-zinc-500" /> {contract.designation}
                      </p>
                    </div>

                    <span className={cn(
                      "text-[9px] font-bold px-2 py-0.5 rounded tracking-tight shrink-0",
                      contract.status === "Active" && "bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-400",
                      contract.status === "Probationary" && "bg-amber-100 dark:bg-amber-950/40 text-amber-800 dark:text-amber-400",
                      contract.status === "Pending Renewal" && "bg-stone-200 dark:bg-zinc-800 text-stone-700 dark:text-zinc-300"
                    )}>
                      {contract.status}
                    </span>
                  </div>

                  {/* Structural Specifics Parameters Metrics Grid */}
                  <div className="grid grid-cols-3 gap-4 border-t border-stone-100 dark:border-zinc-900 pt-3 text-[11px]">
                    <div>
                      <span className="text-[9px] text-stone-400 dark:text-zinc-500 block font-medium uppercase tracking-wider">Engagement Model</span>
                      <span className="text-stone-800 dark:text-zinc-200 font-semibold block mt-0.5 truncate">{contract.termType}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-stone-400 dark:text-zinc-500 block font-medium uppercase tracking-wider">Base Salary Level</span>
                      <span className="text-stone-900 dark:text-zinc-50 font-bold block mt-0.5 flex items-center gap-0.5">
                        <DollarSign className="h-3.5 w-3.5 text-stone-400 dark:text-zinc-500 stroke-[2.5]" />{contract.baseRemuneration.toLocaleString()}.00/mo
                      </span>
                    </div>
                    <div>
                      <span className="text-[9px] text-stone-400 dark:text-zinc-500 block font-medium uppercase tracking-wider">Tenancy Window</span>
                      <span className="text-stone-500 dark:text-zinc-400 font-medium block mt-0.5">
                        {formatDate(contract.commencementDate)} → {formatDate(contract.expirationDate)}
                      </span>
                    </div>
                  </div>

                  {/* Expiration Warning Banner */}
                  <div className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-lg text-[10px] font-medium",
                    expiry.bg,
                    expiry.color
                  )}>
                    <AlertTriangle className="h-3 w-3 shrink-0" />
                    <span>Contract {expiry.text}</span>
                  </div>

                  {/* Action Row Hooks */}
                  <div className="flex justify-end pt-0.5">
                    <Button
                      type="button"
                      variant="outline"
                      className="h-7 text-[10px] font-medium px-2.5 border-stone-200 dark:border-zinc-800 hover:bg-stone-50 dark:hover:bg-zinc-900 text-stone-600 dark:text-zinc-300 flex items-center gap-1 rounded-md transition-colors shadow-none"
                      onClick={() => alert(`Accessing legal document bundle stream token for ${contract.id}`)}
                    >
                      <FileCheck className="h-3 w-3" /> View Instrument File
                    </Button>
                  </div>

                </div>
              )
            })}

            {filteredContracts.length === 0 && (
              <div className="p-8 border border-dashed border-stone-200 dark:border-zinc-800 rounded-xl text-center">
                <p className="text-xs text-stone-400 dark:text-zinc-500 italic">No formal parameters established within this tier context container.</p>
              </div>
            )}
          </div>

        </div>
      </ScrollArea>
    </main>
  )
}