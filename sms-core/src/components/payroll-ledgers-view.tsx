"use client"

import * as React from "react"
import { useState, useMemo, useCallback, useEffect } from "react"
import { 
  Building, 
  CreditCard, 
  FileSpreadsheet, 
  Plus, 
  UserCheck, 
  ArrowUpRight, 
  ArrowDownRight, 
  Scale,
  Loader2,
  AlertCircle
} from "lucide-react"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { fetchWithAuth } from "@/lib/fetch-with-auth";

// --- DATA TYPES & STRUCTS ---
interface StaffPayrollRecord {
  id: string
  name: string
  role: string
  baseSalary: number
  allowances: number
  deductions: number
  status: "Pending" | "Disbursed"
}

interface LedgerAccountRecord {
  code: string
  accountName: string
  category: string
  debit: number
  credit: number
}

export function PayrollLedgersView() {
  const [activeTab, setActiveTab] = useState<"payroll" | "ledgers">("payroll")
  
  // Real-Time API State Engines
  const [payrollRegistry, setPayrollRegistry] = useState<StaffPayrollRecord[]>([])
  const [ledgerRegistry, setLedgerRegistry] = useState<LedgerAccountRecord[]>([])
  
  // Operational Pipeline Hydration State
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [disbursingId, setDisbursingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Dynamic Journal Node Context
  const [newJournal, setNewJournal] = useState({ 
    code: "", 
    accountName: "", 
    category: "Expense" as const, 
    amount: "", 
    type: "debit" as "debit" | "credit" 
  })

  // --- CORE DATABASE DATA RECOVERY MATRIX ---
  const fetchFinancialEcosystem = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const [payrollResponse, ledgerResponse] = await Promise.all([
        fetchWithAuth("/finance/payroll"),
        fetchWithAuth("/finance/ledgers")
      ])
      
      const payrollData = await payrollResponse.json()
      const ledgerData = await ledgerResponse.json()

      if (payrollData.success) setPayrollRegistry(payrollData.data)
      if (ledgerData.success) setLedgerRegistry(ledgerData.data)
      
      if (!payrollResponse.ok || !ledgerResponse.ok) {
        setError("Failed to fetch complete financial data.")
      }
    } catch (err) {
      console.error("[Financial Ecosystem Ingress Error]:", err)
      setError("Network error connecting to financial services.")
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Hook Core Rehydration Matrix on View Mount Execution
  useEffect(() => {
    fetchFinancialEcosystem()
  }, [fetchFinancialEcosystem])

  // --- RECALCULATION CALCULATORS ---
  const payrollTotals = useMemo(() => {
    return payrollRegistry.reduce(
      (acc, curr) => {
        const net = curr.baseSalary + curr.allowances - curr.deductions
        acc.totalNet += net
        if (curr.status === "Disbursed") acc.disbursed += net
        else acc.pending += net
        return acc
      },
      { totalNet: 0, disbursed: 0, pending: 0 }
    )
  }, [payrollRegistry])

  const ledgerTotals = useMemo(() => {
    return ledgerRegistry.reduce(
      (acc, curr) => {
        acc.totalDebit += Number(curr.debit) || 0
        acc.totalCredit += Number(curr.credit) || 0
        return acc
      },
      { totalDebit: 0, totalCredit: 0 }
    )
  }, [ledgerRegistry])

  // --- ATOMIC MUTATION INTERACTION RUNTIMES ---
  const handleDisbursePayroll = useCallback(async (id: string) => {
    setDisbursingId(id)
    try {
      const response = await fetchWithAuth("/finance/payroll", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      })

      if (response.ok) {
        // Core Dual Pipeline Atomic Re-hydration sync
        const [payrollRes, ledgerRes] = await Promise.all([
          fetchWithAuth("/finance/payroll"),
          fetchWithAuth("/finance/ledgers")
        ])
        
        const payrollData = await payrollRes.json()
        const ledgerData = await ledgerRes.json()
        
        if (payrollData.success) setPayrollRegistry(payrollData.data)
        if (ledgerData.success) setLedgerRegistry(ledgerData.data)
      }
    } catch (error) {
      console.error("[Disbursal Mutation Transmission Exception]:", error)
    } finally {
      setDisbursingId(null)
    }
  }, [])

  const handleCreateLedgerNode = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newJournal.code || !newJournal.accountName || !newJournal.amount || submitting) return

    setSubmitting(true)
    try {
      const response = await fetchWithAuth("/finance/ledgers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newJournal)
      })

      const payload = await response.json()
      
      if (payload.success) {
        // Append the newly created node directly to local state
        setLedgerRegistry(prev => [...prev, payload.data])
        // Purge Form Context fields
        setNewJournal({ code: "", accountName: "", category: "Expense", amount: "", type: "debit" })
      } else {
        alert(payload.message || "Failed to create ledger node.")
      }
    } catch (error) {
      console.error("[Ledger Write Exception]:", error)
    } finally {
      setSubmitting(false)
    }
  }, [newJournal, submitting])

  if (isLoading) {
    return (
      <div className="flex-1 h-full flex flex-col items-center justify-center bg-transparent gap-2 text-stone-400 dark:text-zinc-500">
        <Loader2 className="h-6 w-6 animate-spin stroke-[1.5]" />
        <span className="text-xs font-mono tracking-wider uppercase">Loading Balance Ledger Matrices...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex-1 h-full flex flex-col items-center justify-center bg-transparent gap-3 text-rose-500 dark:text-rose-400">
        <AlertCircle className="h-8 w-8" />
        <div className="text-center">
          <p className="text-sm font-semibold">Synchronization Error</p>
          <p className="text-xs text-stone-500 dark:text-zinc-500 mt-1">{error}</p>
          <Button variant="outline" size="sm" onClick={fetchFinancialEcosystem} className="mt-4 text-xs">
            Retry Connection
          </Button>
        </div>
      </div>
    )
  }

  return (
    <main className="flex-1 h-full flex flex-col bg-transparent px-8 py-6 overflow-hidden">
      
      {/* Dynamic Module Header Block */}
      <div className="flex flex-col gap-2 shrink-0">
        <div className="inline-flex items-center gap-1.5 text-xs tracking-wide uppercase font-bold text-stone-400 dark:text-zinc-500">
          Core Finance Operations / Disbursals & General Ledger
        </div>
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl tracking-tight font-semibold text-foreground">
              Payroll & Institutional Ledgers
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Process workforce payroll matrix systems and track organizational cash allocations against balance sheets.
            </p>
          </div>
        </div>
      </div>

      {/* CORE FRAME TAB FILTER NAVIGATION TOGGLE */}
      <div className="mt-5 shrink-0 flex items-center bg-stone-100 dark:bg-zinc-900/50 p-1.5 rounded-lg border border-stone-200/40 dark:border-zinc-800/40 max-w-sm">
        <button
          type="button"
          onClick={() => setActiveTab("payroll")}
          className={cn(
            "flex-1 text-center py-1.5 rounded text-xs font-medium transition-all tracking-tight flex items-center justify-center gap-1.5",
            activeTab === "payroll"
              ? "bg-white dark:bg-zinc-800 text-stone-900 dark:text-zinc-50 shadow-sm border border-stone-200/20 dark:border-zinc-700/30 font-semibold"
              : "text-stone-500 dark:text-zinc-400 hover:text-stone-800 dark:hover:text-zinc-200"
          )}
        >
          <UserCheck className="h-3.5 w-3.5 stroke-[2]" /> Staff Payroll
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("ledgers")}
          className={cn(
            "flex-1 text-center py-1.5 rounded text-xs font-medium transition-all tracking-tight flex items-center justify-center gap-1.5",
            activeTab === "ledgers"
              ? "bg-white dark:bg-zinc-800 text-stone-900 dark:text-zinc-50 shadow-sm border border-stone-200/20 dark:border-zinc-700/30 font-semibold"
              : "text-stone-500 dark:text-zinc-400 hover:text-stone-800 dark:hover:text-zinc-200"
          )}
        >
          <FileSpreadsheet className="h-3.5 w-3.5 stroke-[2]" /> Master Ledger Matrix
        </button>
      </div>

      <hr className="border-stone-200 dark:border-zinc-800 shrink-0 mt-5 mb-6" />

      {/* RENDER VIEW WINDOW CONTAINER */}
      <ScrollArea className="flex-1 w-full max-w-4xl rounded-none border-none shadow-none bg-transparent">
        <div className="pr-4 pb-12 space-y-6">

          {activeTab === "payroll" ? (
            /* --- SUB INTERFACE MODULE 1: STAFF PAYROLL PANEL --- */
            <div className="space-y-6">
              
              {/* Financial Metrics Cards Overview Grid */}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-stone-50 dark:bg-zinc-900/30 p-4 rounded-xl border border-stone-200/50 dark:border-zinc-800/50">
                  <span className="text-[10px] font-bold text-stone-400 dark:text-zinc-500 uppercase tracking-wider block">Total Liability Allocation</span>
                  <span className="text-xl font-semibold text-stone-900 dark:text-zinc-100 block mt-1">${payrollTotals.totalNet.toLocaleString()}.00</span>
                </div>
                <div className="bg-emerald-50/50 dark:bg-emerald-950/10 p-4 rounded-xl border border-emerald-200/30 dark:border-emerald-900/20">
                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-500 uppercase tracking-wider block">Disbursed Outflows</span>
                  <span className="text-xl font-semibold text-emerald-800 dark:text-emerald-400 block mt-1">${payrollTotals.disbursed.toLocaleString()}.00</span>
                </div>
                <div className="bg-amber-50/40 dark:bg-amber-950/10 p-4 rounded-xl border border-amber-200/20 dark:border-amber-900/20">
                  <span className="text-[10px] font-bold text-amber-600 dark:text-amber-500 uppercase tracking-wider block">Pending Liquidation</span>
                  <span className="text-xl font-semibold text-amber-800 dark:text-amber-400 block mt-1">${payrollTotals.pending.toLocaleString()}.00</span>
                </div>
              </div>

              {/* Data Table Matrix Structure */}
              <div className="border border-stone-200/60 dark:border-zinc-800/60 rounded-xl overflow-hidden bg-white dark:bg-zinc-950">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-stone-50 dark:bg-zinc-900/50 border-b border-stone-200 dark:border-zinc-800 text-[10px] font-bold text-stone-400 dark:text-zinc-500 uppercase tracking-wider">
                      <th className="py-3 px-4">Employee Details</th>
                      <th className="py-3 px-3">Base Remuneration</th>
                      <th className="py-3 px-3">Allowances</th>
                      <th className="py-3 px-3">Deductions</th>
                      <th className="py-3 px-3">Net Payable</th>
                      <th className="py-3 px-4 text-right">Liquidation Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 dark:divide-zinc-900 text-xs text-stone-700 dark:text-zinc-300">
                    {payrollRegistry.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-8 text-center text-stone-400 dark:text-zinc-500 italic">
                          No payroll configurations found. Ensure Staff/Teachers have payroll data assigned.
                        </td>
                      </tr>
                    ) : (
                      payrollRegistry.map((emp: StaffPayrollRecord) => {
                        const netPayable = emp.baseSalary + emp.allowances - emp.deductions
                        const isDisbursing = disbursingId === emp.id
                        return (
                          <tr key={emp.id} className="hover:bg-stone-50/40 dark:hover:bg-zinc-900/20 transition-colors">
                            <td className="py-3.5 px-4">
                              <div className="font-semibold text-stone-900 dark:text-zinc-100">{emp.name}</div>
                              <div className="text-[10px] text-stone-400 dark:text-zinc-500 mt-0.5">{emp.role}</div>
                            </td>
                            <td className="py-3.5 px-3 font-medium text-stone-900 dark:text-zinc-100">${emp.baseSalary.toLocaleString()}.00</td>
                            <td className="py-3.5 px-3 text-emerald-600 dark:text-emerald-500">+${emp.allowances.toLocaleString()}.00</td>
                            <td className="py-3.5 px-3 text-red-500 dark:text-red-400">-${emp.deductions.toLocaleString()}.00</td>
                            <td className="py-3.5 px-3 font-bold text-stone-900 dark:text-zinc-50">${netPayable.toLocaleString()}.00</td>
                            <td className="py-3.5 px-4 text-right">
                              {emp.status === "Disbursed" ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 rounded">
                                  Disbursed Balance
                                </span>
                              ) : (
                                <Button
                                  type="button"
                                  size="sm"
                                  disabled={isDisbursing}
                                  onClick={() => handleDisbursePayroll(emp.id)}
                                  className="h-7 text-[11px] font-medium px-2.5 bg-stone-900 text-white dark:bg-zinc-50 dark:text-zinc-950 hover:bg-stone-800 dark:hover:bg-zinc-200 disabled:opacity-50 rounded-md shadow-none inline-flex items-center gap-1"
                                >
                                  {isDisbursing ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <CreditCard className="h-3 w-3" />
                                  )}
                                  {isDisbursing ? "Processing..." : "Release Funds"}
                                </Button>
                              )}
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* --- SUB INTERFACE MODULE 2: MASTER GENERAL LEDGER MATRIX --- */
            <div className="grid grid-cols-3 gap-6 items-start">
              
              {/* Left Column Ledger List View Dashboard */}
              <div className="col-span-2 space-y-4">
                
                {/* Double Entry Balancing Indicator Panel */}
                <div className="bg-stone-50 dark:bg-zinc-900/30 p-4 border border-stone-200/60 dark:border-zinc-800/60 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 bg-stone-200 dark:bg-zinc-800 text-stone-600 dark:text-zinc-400 rounded-lg flex items-center justify-center shrink-0">
                      <Scale className="h-4 w-4" />
                    </div>
                    <div>
                      <span className="text-[10px] font-bold text-stone-400 dark:text-zinc-500 uppercase tracking-wider block">Trial Equilibrium Verification</span>
                      <span className="text-xs font-semibold text-stone-700 dark:text-zinc-300 mt-0.5 block">
                        Debits: <strong className="text-stone-950 dark:text-zinc-50 font-bold">${ledgerTotals.totalDebit.toLocaleString()}</strong> | Credits: <strong className="text-stone-950 dark:text-zinc-50 font-bold">${ledgerTotals.totalCredit.toLocaleString()}</strong>
                      </span>
                    </div>
                  </div>
                  {ledgerTotals.totalDebit === ledgerTotals.totalCredit ? (
                    <span className="text-[10px] font-bold bg-emerald-100 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded tracking-tight">
                      Balanced Zero-Sum
                    </span>
                  ) : (
                    <span className="text-[10px] font-bold bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-400 px-2 py-0.5 rounded tracking-tight">
                      Imbalance Delta
                    </span>
                  )}
                </div>

                {/* Ledger Main Table Accounts Matrix */}
                <div className="border border-stone-200/60 dark:border-zinc-800/60 rounded-xl overflow-hidden bg-white dark:bg-zinc-950">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-stone-50 dark:bg-zinc-900/50 border-b border-stone-200 dark:border-zinc-800 text-[10px] font-bold text-stone-400 dark:text-zinc-500 uppercase tracking-wider">
                        <th className="py-2.5 px-3">Account Code</th>
                        <th className="py-2.5 px-3">Account Name Label</th>
                        <th className="py-2.5 px-3">Type Classification</th>
                        <th className="py-2.5 px-3 text-right">Debit Balance</th>
                        <th className="py-2.5 px-3 text-right">Credit Balance</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 dark:divide-zinc-900 text-xs text-stone-700 dark:text-zinc-300">
                      {ledgerRegistry.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-stone-400 dark:text-zinc-500 italic">
                            No ledger accounts configured. Use the panel on the right to initialize your Chart of Accounts.
                          </td>
                        </tr>
                      ) : (
                        ledgerRegistry.map((ledger: LedgerAccountRecord) => (
                          <tr key={ledger.code} className="hover:bg-stone-50/40 dark:hover:bg-zinc-900/20 transition-colors">
                            <td className="py-3 px-3 font-mono text-stone-500 dark:text-zinc-500 font-medium">{ledger.code}</td>
                            <td className="py-3 px-3 font-semibold text-stone-900 dark:text-zinc-100">{ledger.accountName}</td>
                            <td className="py-3 px-3">
                              <span className="text-[10px] px-1.5 py-0.5 bg-stone-100 dark:bg-zinc-900 text-stone-600 dark:text-zinc-400 rounded font-medium">
                                {ledger.category}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right font-medium text-stone-900 dark:text-zinc-100">
                              {Number(ledger.debit) > 0 ? (
                                <span className="inline-flex items-center gap-0.5">
                                  <ArrowUpRight className="h-3 w-3 text-emerald-500 shrink-0" /> ${Number(ledger.debit).toLocaleString()}.00
                                </span>
                              ) : "—"}
                            </td>
                            <td className="py-3 px-3 text-right font-medium text-stone-900 dark:text-zinc-100">
                              {Number(ledger.credit) > 0 ? (
                                <span className="inline-flex items-center gap-0.5">
                                  <ArrowDownRight className="h-3 w-3 text-amber-500 shrink-0" /> ${Number(ledger.credit).toLocaleString()}.00
                                </span>
                              ) : "—"}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

              </div>

              {/* Right Column Add Account Node Entry Form */}
              <div className="bg-stone-50/60 dark:bg-zinc-900/20 p-4 rounded-xl border border-stone-200/50 dark:border-zinc-800/50 space-y-4">
                <div>
                  <h3 className="text-sm font-semibold text-stone-900 dark:text-zinc-100 tracking-tight flex items-center gap-1.5">
                    <Building className="h-4 w-4 text-stone-400 dark:text-zinc-500" /> Chart Node Creation
                  </h3>
                  <p className="text-[11px] text-stone-400 dark:text-zinc-500 mt-0.5">Initialize a fresh asset target tracking balance variable within operational accounts.</p>
                </div>

                <form onSubmit={handleCreateLedgerNode} className="space-y-3.5">
                  <div className="space-y-1">
                    <Label htmlFor="ledger-code" className="text-[11px] font-semibold text-stone-600 dark:text-zinc-400">Account Code ID</Label>
                    <Input 
                      id="ledger-code" 
                      type="text" 
                      placeholder="e.g. 1020 or 5035"
                      value={newJournal.code}
                      onChange={(e) => setNewJournal(prev => ({ ...prev, code: e.target.value }))}
                      className="h-8 text-xs bg-white dark:bg-zinc-950 border-stone-200 dark:border-zinc-800 rounded-md"
                      disabled={submitting}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="ledger-name" className="text-[11px] font-semibold text-stone-600 dark:text-zinc-400">Account Descriptive Label</Label>
                    <Input 
                      id="ledger-name" 
                      type="text" 
                      placeholder="e.g. Stationery Asset Reserve"
                      value={newJournal.accountName}
                      onChange={(e) => setNewJournal(prev => ({ ...prev, accountName: e.target.value }))}
                      className="h-8 text-xs bg-white dark:bg-zinc-950 border-stone-200 dark:border-zinc-800 rounded-md"
                      disabled={submitting}
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-semibold text-stone-600 dark:text-zinc-400">Dynamic Balancing Node Protocol</Label>
                    <div className="grid grid-cols-2 gap-2 bg-stone-200/50 dark:bg-zinc-900 p-1 rounded-lg">
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => setNewJournal(prev => ({ ...prev, type: "debit" }))}
                        className={cn(
                          "py-1 text-[11px] rounded text-center font-medium transition-colors", 
                          newJournal.type === "debit" 
                            ? "bg-white dark:bg-zinc-800 text-stone-900 dark:text-zinc-50 shadow-xs" 
                            : "text-stone-500 dark:text-zinc-400"
                        )}
                      >
                        Debit Inflow
                      </button>
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => setNewJournal(prev => ({ ...prev, type: "credit" }))}
                        className={cn(
                          "py-1 text-[11px] rounded text-center font-medium transition-colors", 
                          newJournal.type === "credit" 
                            ? "bg-white dark:bg-zinc-800 text-stone-900 dark:text-zinc-50 shadow-xs" 
                            : "text-stone-500 dark:text-zinc-400"
                        )}
                      >
                        Credit Outflow
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="ledger-amount" className="text-[11px] font-semibold text-stone-600 dark:text-zinc-400">Starting Balance Value</Label>
                    <Input 
                      id="ledger-amount" 
                      type="number" 
                      placeholder="0.00"
                      value={newJournal.amount}
                      onChange={(e) => setNewJournal(prev => ({ ...prev, amount: e.target.value }))}
                      className="h-8 text-xs bg-white dark:bg-zinc-950 border-stone-200 dark:border-zinc-800 rounded-md"
                      disabled={submitting}
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={submitting}
                    className="w-full h-8 text-[11px] bg-stone-900 text-white dark:bg-zinc-50 dark:text-zinc-950 hover:bg-stone-800 dark:hover:bg-zinc-200 font-medium rounded-lg shadow-none flex items-center justify-center gap-1"
                  >
                    {submitting ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <>
                        <Plus className="h-3 w-3" /> Append Chart Node
                      </>
                    )}
                  </Button>
                </form>
              </div>

            </div>
          )}

        </div>
      </ScrollArea>
    </main>
  )
}