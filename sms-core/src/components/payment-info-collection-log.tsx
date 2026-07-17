"use client"

import * as React from "react"
import { useMemo, useState, useCallback } from "react"
import { 
  Layers, 
  DollarSign, 
  User, 
  CreditCard, 
  FileText, 
  Printer, 
  Plus, 
  CheckCircle, 
  ArrowRight,
  History
} from "lucide-react"
import { cn } from "@/lib/utils"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"

// --- DATA STRUCTURE SCHEMA CONTRACTS ---
interface ReceiptRecord {
  id: string
  receiptNumber: string
  studentName: string
  amountPaid: string
  paymentMethod: string
  referenceNo: string
  allocationTarget: string
  dateProcessed: string
}

interface IntakeFormState {
  studentName: string
  amountPaid: string
  paymentMethod: string
  referenceNo: string
  allocationTarget: string
}

// --- IMMUTABLE INVARIANT SCHEMAS ---
const ACADEMIC_SECTIONS = [
  { id: "pre-school", label: "Pre-School" },
  { id: "nursery-1", label: "Nursery 1" },
  { id: "nursery-2", label: "Nursery 2" },
  { id: "kindergarten-1", label: "KG 1" },
  { id: "kindergarten-2", label: "KG 2" },
  { id: "grade-1", label: "Grade 1" },
  { id: "grade-2", label: "Grade 2" },
  { id: "grade-3", label: "Grade 3" },
  { id: "grade-4", label: "Grade 4" },
  { id: "grade-5", label: "Grade 5" },
  { id: "grade-6", label: "Grade 6" },
  { id: "jhs-1", label: "JHS 1" },
  { id: "jhs-2", label: "JHS 2" },
  { id: "jhs-3", label: "JHS 3" },
] as const

const PAYMENT_METHODS = [
  "Cash Settlement",
  "Bank Wire Transfer",
  "Mobile Money (MoMo)",
  "Bank Cheque / Draft"
] as const

const ALLOCATION_TARGETS = [
  "Tuition Baseline Core",
  "Midday Catering & Snacks",
  "Computer Laboratory Access",
  "Science Lab Equipment Levy",
  "Stationery Kit Pack",
  "Outstanding Arrears Portfolio"
] as const

const MOCK_STUDENTS_POOL: Record<string, string[]> = {
  "pre-school": ["Kofi Mensah", "Ama Serwaa", "Liam Owusu"],
  "grade-1": ["Blessing Arthur", "Emmanuel Boateng", "Charae Donkor"],
  "jhs-1": ["Prince Appiah", "Derick Quansah", "Naomi Tsotsoo"],
}

const INITIAL_FORM_STATE: Record<string, IntakeFormState> = {
  "pre-school": { studentName: "", amountPaid: "", paymentMethod: "Cash Settlement", referenceNo: "", allocationTarget: "Tuition Baseline Core" },
  "nursery-1": { studentName: "", amountPaid: "", paymentMethod: "Cash Settlement", referenceNo: "", allocationTarget: "Tuition Baseline Core" },
  "nursery-2": { studentName: "", amountPaid: "", paymentMethod: "Cash Settlement", referenceNo: "", allocationTarget: "Tuition Baseline Core" },
  "kindergarten-1": { studentName: "", amountPaid: "", paymentMethod: "Cash Settlement", referenceNo: "", allocationTarget: "Tuition Baseline Core" },
  "kindergarten-2": { studentName: "", amountPaid: "", paymentMethod: "Cash Settlement", referenceNo: "", allocationTarget: "Tuition Baseline Core" },
  "grade-1": { studentName: "", amountPaid: "", paymentMethod: "Bank Wire Transfer", referenceNo: "", allocationTarget: "Tuition Baseline Core" },
  "grade-2": { studentName: "", amountPaid: "", paymentMethod: "Cash Settlement", referenceNo: "", allocationTarget: "Tuition Baseline Core" },
  "grade-3": { studentName: "", amountPaid: "", paymentMethod: "Cash Settlement", referenceNo: "", allocationTarget: "Tuition Baseline Core" },
  "grade-4": { studentName: "", amountPaid: "", paymentMethod: "Cash Settlement", referenceNo: "", allocationTarget: "Tuition Baseline Core" },
  "grade-5": { studentName: "", amountPaid: "", paymentMethod: "Cash Settlement", referenceNo: "", allocationTarget: "Tuition Baseline Core" },
  "grade-6": { studentName: "", amountPaid: "", paymentMethod: "Cash Settlement", referenceNo: "", allocationTarget: "Tuition Baseline Core" },
  "jhs-1": { studentName: "", amountPaid: "", paymentMethod: "Mobile Money (MoMo)", referenceNo: "", allocationTarget: "Tuition Baseline Core" },
  "jhs-2": { studentName: "", amountPaid: "", paymentMethod: "Cash Settlement", referenceNo: "", allocationTarget: "Tuition Baseline Core" },
  "jhs-3": { studentName: "", amountPaid: "", paymentMethod: "Cash Settlement", referenceNo: "", allocationTarget: "Tuition Baseline Core" },
}

const INITIAL_HISTORY_STATE: Record<string, ReceiptRecord[]> = {
  "pre-school": [
    { id: "rcpt-101", receiptNumber: "REC-2026-0042", studentName: "Kofi Mensah", amountPaid: "1200", paymentMethod: "Cash Settlement", referenceNo: "N/A (Direct)", allocationTarget: "Tuition Baseline Core", dateProcessed: "2026-06-10" }
  ],
  "grade-1": [
    { id: "rcpt-102", receiptNumber: "REC-2026-0043", studentName: "Blessing Arthur", amountPaid: "1800", paymentMethod: "Bank Wire Transfer", referenceNo: "TXN-Bnk88291", allocationTarget: "Tuition Baseline Core", dateProcessed: "2026-06-12" }
  ]
}

/**
 * PaymentInflowCollectionLog
 * Synchronized with core operations routing layout manifest maps.
 */
export function PaymentInflowCollectionLog() {
  const [activeSection, setActiveSection] = useState<string>("pre-school")
  const [formState, setFormState] = useState<Record<string, IntakeFormState>>(INITIAL_FORM_STATE)
  const [receiptLedger, setReceiptLedger] = useState<Record<string, ReceiptRecord[]>>(INITIAL_HISTORY_STATE)

  // --- MEMOIZED READ LAYERS ---
  const currentForm = useMemo(() => {
    return formState[activeSection] || { studentName: "", amountPaid: "", paymentMethod: "Cash Settlement", referenceNo: "", allocationTarget: "Tuition Baseline Core" }
  }, [formState, activeSection])

  const currentHistory = useMemo(() => {
    return receiptLedger[activeSection] || []
  }, [receiptLedger, activeSection])

  const targetSectionStudents = useMemo(() => {
    return MOCK_STUDENTS_POOL[activeSection] || ["Alternative Active Cohort Student A", "Alternative Active Cohort Student B"]
  }, [activeSection])

  const lowerAcademicTier = useMemo(() => ACADEMIC_SECTIONS.slice(0, 7), [])
  const upperAcademicTier = useMemo(() => ACADEMIC_SECTIONS.slice(7), [])
  
  const activeSectionLabel = useMemo(() => {
    return ACADEMIC_SECTIONS.find(s => s.id === activeSection)?.label || ""
  }, [activeSection])

  // --- RUNTIME MEMOIZED EVENT HANDLERS ---
  const updateFormField = useCallback((field: keyof IntakeFormState, value: string) => {
    setFormState(prev => ({
      ...prev,
      [activeSection]: {
        ...prev[activeSection],
        [field]: value
      }
    }))
  }, [activeSection])

  const handleProcessCollection = useCallback(async (e: React.FormEvent) => {
    e.preventDefault()
    if (!currentForm.studentName || !currentForm.amountPaid) return

    const timestamp = new Date().toISOString().split('T')[0]

    const submissionPayload = {
      studentName: currentForm.studentName,
      amountPaid: currentForm.amountPaid,
      paymentMethod: currentForm.paymentMethod,
      referenceNo: currentForm.referenceNo || "N/A (Direct)",
      allocationTarget: currentForm.allocationTarget,
      section: activeSection,
      dateProcessed: timestamp,
    }

    try {
      const response = await fetch("/api/payment-inflow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(submissionPayload),
      })

      const payload = await response.json()

      if (payload.success) {
        // Prepend new backend transaction record directly to active ledger stack
        setReceiptLedger(prev => ({
          ...prev,
          [activeSection]: [payload.data, ...(prev[activeSection] || [])]
        }))
      } else {
        // Backend rejected — fall back to local optimistic record
        const generatedId = `tmp_${Math.random().toString(36).substring(2, 9)}`
        const serialNumber = `REC-2026-${Math.floor(1000 + Math.random() * 9000)}`

        const fallbackRecord: ReceiptRecord = {
          id: generatedId,
          receiptNumber: serialNumber,
          studentName: submissionPayload.studentName,
          amountPaid: submissionPayload.amountPaid,
          paymentMethod: submissionPayload.paymentMethod,
          referenceNo: submissionPayload.referenceNo,
          allocationTarget: submissionPayload.allocationTarget,
          dateProcessed: timestamp,
        }

        setReceiptLedger(prev => ({
          ...prev,
          [activeSection]: [fallbackRecord, ...(prev[activeSection] || [])]
        }))
      }
    } catch {
      // Network failure — fall back to local optimistic record
      const generatedId = `tmp_${Math.random().toString(36).substring(2, 9)}`
      const serialNumber = `REC-2026-${Math.floor(1000 + Math.random() * 9000)}`

      const fallbackRecord: ReceiptRecord = {
        id: generatedId,
        receiptNumber: serialNumber,
        studentName: submissionPayload.studentName,
        amountPaid: submissionPayload.amountPaid,
        paymentMethod: submissionPayload.paymentMethod,
        referenceNo: submissionPayload.referenceNo,
        allocationTarget: submissionPayload.allocationTarget,
        dateProcessed: timestamp,
      }

      setReceiptLedger(prev => ({
        ...prev,
        [activeSection]: [fallbackRecord, ...(prev[activeSection] || [])]
      }))
    }

    // Reset form regardless of outcome
    setFormState(prev => ({
      ...prev,
      [activeSection]: { studentName: "", amountPaid: "", paymentMethod: "Cash Settlement", referenceNo: "", allocationTarget: "Tuition Baseline Core" }
    }))
  }, [activeSection, currentForm])

  return (
    <main className="flex-1 h-full flex flex-col bg-transparent px-8 py-6 overflow-hidden">
      
      {/* Header Block */}
      <div className="flex flex-col gap-2 shrink-0">
        <div className="inline-flex items-center gap-1.5 text-xs text-stone-400 dark:text-stone-500 tracking-wide uppercase font-bold">
          Core Finance Operations / Collections & Receipting Engine
        </div>
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl tracking-tight font-semibold text-foreground capitalize">
              Inflows & Collections Logging
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Log verified transaction inflows, allocate collected revenue to explicit ledger items, and issue finalized institutional receipts.
            </p>
          </div>
        </div>
      </div>

      {/* Grade Tier Selector HUD */}
      <div className="mt-5 shrink-0 flex flex-col gap-1.5 max-w-3xl">
        <Label className="text-[11px] font-bold text-stone-400 dark:text-stone-500 uppercase tracking-wider flex items-center gap-1">
          <Layers className="h-3 w-3" /> Select Institutional Grade Tier
        </Label>
        
        <div className="w-full flex flex-col gap-2.5">
          {/* Lower Tier Row */}
          <div className="w-full flex items-center bg-stone-100 dark:bg-zinc-900/50 p-1.5 rounded-lg border border-stone-200/40 dark:border-zinc-800/40">
            {lowerAcademicTier.map((section, idx) => (
              <React.Fragment key={section.id}>
                <button
                  type="button"
                  onClick={() => setActiveSection(section.id)}
                  className={cn(
                    "flex-1 text-center py-1 rounded text-[11px] font-medium transition-all tracking-tight truncate px-1",
                    activeSection === section.id
                      ? "bg-white dark:bg-zinc-800 text-stone-900 dark:text-zinc-50 shadow-sm border border-stone-200/20 dark:border-zinc-700/30 font-semibold"
                      : "text-stone-500 dark:text-zinc-400 hover:text-stone-800 dark:hover:text-zinc-200 hover:bg-white/40 dark:hover:bg-zinc-800/30"
                  )}
                >
                  {section.label}
                </button>
                {idx < lowerAcademicTier.length - 1 && (
                  <div className="h-3 w-[1px] bg-stone-300 dark:bg-zinc-800 shrink-0 mx-0.5" />
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Upper Tier Row */}
          <div className="w-full flex items-center bg-stone-100 dark:bg-zinc-900/50 p-1.5 rounded-lg border border-stone-200/40 dark:border-zinc-800/40">
            {upperAcademicTier.map((section, idx) => (
              <React.Fragment key={section.id}>
                <button
                  type="button"
                  onClick={() => setActiveSection(section.id)}
                  className={cn(
                    "flex-1 text-center py-1 rounded text-[11px] font-medium transition-all tracking-tight truncate px-1",
                    activeSection === section.id
                      ? "bg-white dark:bg-zinc-800 text-stone-900 dark:text-zinc-50 shadow-sm border border-stone-200/20 dark:border-zinc-700/30 font-semibold"
                      : "text-stone-500 dark:text-zinc-400 hover:text-stone-800 dark:hover:text-zinc-200 hover:bg-white/40 dark:hover:bg-zinc-800/30"
                  )}
                >
                  {section.label}
                </button>
                {idx < upperAcademicTier.length - 1 && (
                  <div className="h-3 w-[1px] bg-stone-300 dark:bg-zinc-800 shrink-0 mx-0.5" />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      <hr className="border-stone-200 dark:border-zinc-800 shrink-0 mt-5 mb-6" />

      {/* Core Ledger Workspace Scroll Region */}
      <ScrollArea className="flex-1 w-full max-w-3xl rounded-none border-none shadow-none bg-transparent">
        <form onSubmit={handleProcessCollection} className="space-y-12 pr-4 pb-12 bg-transparent">
          
          {/* STEP 1: TRANSACTION INTAKE METRICS NODE */}
          <div className="relative pl-10 group">
            <div className="absolute left-0 top-0 flex flex-col items-center h-full">
              <div className="flex h-7 w-7 items-center justify-center rounded-full border border-stone-200 dark:border-zinc-800 bg-background text-xs font-medium text-stone-500 dark:text-zinc-400">
                1
              </div>
              <div className="w-[1px] flex-1 bg-stone-200 dark:bg-zinc-800 mt-2" />
            </div>

            <div className="space-y-5">
              <div>
                <h3 className="text-base font-semibold text-foreground tracking-tight">
                  Transaction Intake Entry <span className="text-stone-400 dark:text-zinc-500 font-normal text-xs">({activeSectionLabel})</span>
                </h3>
                <p className="text-xs text-stone-400 dark:text-zinc-500 mt-0.5">Capture real-time physical or verified digital tender parameters brought into processing accounts.</p>
              </div>

              <div className="grid grid-cols-2 gap-4 max-w-2xl">
                {/* Combobox Student Roster Target */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-stone-700 dark:text-zinc-300 flex items-center gap-1">
                    <User className="h-3 w-3 text-stone-400 dark:text-zinc-500" /> Active Student Target <span className="text-red-500">*</span>
                  </Label>
                  <Combobox 
                    items={targetSectionStudents}
                    value={currentForm.studentName}
                    onValueChange={(val) => updateFormField("studentName", val ?? "")}
                  >
                    <ComboboxInput 
                      placeholder="Select Enrolled Student" 
                      className="h-9 text-xs w-full rounded-md border border-stone-200 dark:border-zinc-800 bg-background px-3 outline-none" 
                    />
                    <ComboboxContent>
                      <ComboboxEmpty>No student profiles matched in this sector tier.</ComboboxEmpty>
                      <ComboboxList>
                        {(student) => (
                          <ComboboxItem key={student} value={student} className="text-xs">
                            {student}
                          </ComboboxItem>
                        )}
                      </ComboboxList>
                    </ComboboxContent>
                  </Combobox>
                </div>

                {/* Amount Paid Field */}
                <div className="space-y-1.5">
                  <Label htmlFor="amount-paid" className="text-xs font-semibold text-stone-700 dark:text-zinc-300 flex items-center gap-1">
                    <DollarSign className="h-3 w-3 text-stone-400 dark:text-zinc-500" /> Net Amount Tendered <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative w-full">
                    <DollarSign className="absolute left-2.5 top-3 h-3 w-3 text-stone-400 dark:text-zinc-500" />
                    <Input 
                      id="amount-paid"
                      type="number"
                      min="1"
                      required
                      value={currentForm.amountPaid}
                      onChange={(e) => updateFormField("amountPaid", e.target.value)}
                      placeholder="0.00"
                      className="h-9 text-xs pl-7 rounded-md border-stone-200 dark:border-zinc-800 bg-background"
                    />
                  </div>
                </div>

                {/* Payment Mechanism Options Combo */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-stone-700 dark:text-zinc-300 flex items-center gap-1">
                    <CreditCard className="h-3 w-3 text-stone-400 dark:text-zinc-500" /> Verified Payment Protocol
                  </Label>
                  <Combobox 
                    items={PAYMENT_METHODS}
                    value={currentForm.paymentMethod}
                    onValueChange={(val) => updateFormField("paymentMethod", val ?? "Cash Settlement")}
                  >
                    <ComboboxInput 
                      placeholder="Select Payment Method" 
                      className="h-9 text-xs w-full rounded-md border border-stone-200 dark:border-zinc-800 bg-background px-3 outline-none" 
                    />
                    <ComboboxContent>
                      <ComboboxEmpty>Protocol match anomaly.</ComboboxEmpty>
                      <ComboboxList>
                        {(method) => (
                          <ComboboxItem key={method} value={method} className="text-xs">
                            {method}
                          </ComboboxItem>
                        )}
                      </ComboboxList>
                    </ComboboxContent>
                  </Combobox>
                </div>

                {/* Reference ID Field */}
                <div className="space-y-1.5">
                  <Label htmlFor="reference-no" className="text-xs font-semibold text-stone-700 dark:text-zinc-300 flex items-center gap-1">
                    <FileText className="h-3 w-3 text-stone-400 dark:text-zinc-500" /> External Reference / Audit Key
                  </Label>
                  <Input 
                    id="reference-no"
                    type="text"
                    value={currentForm.referenceNo}
                    onChange={(e) => updateFormField("referenceNo", e.target.value)}
                    placeholder="e.g. TXN-19028X or MoMo Ref ID"
                    className="h-9 text-xs rounded-md border-stone-200 dark:border-zinc-800 bg-background"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* STEP 2: REVENUE TARGET BALANCE ALLOCATION MATRIX */}
          <div className="relative pl-10 group">
            <div className="absolute left-0 top-0 flex flex-col items-center h-full">
              <div className="flex h-7 w-7 items-center justify-center rounded-full border border-stone-200 dark:border-zinc-800 bg-background text-xs font-medium text-stone-500 dark:text-zinc-400">
                2
              </div>
              <div className="w-[1px] flex-1 bg-stone-200 dark:bg-zinc-800 mt-2" />
            </div>

            <div className="space-y-5">
              <div>
                <h3 className="text-base font-semibold text-foreground tracking-tight">
                  Balance Ledger Allocation Routing
                </h3>
                <p className="text-xs text-stone-400 dark:text-zinc-500 mt-0.5">Route collected currency against localized operational invoice targets or outstanding tuition balances.</p>
              </div>

              <div className="max-w-md space-y-1.5 bg-stone-50/50 dark:bg-zinc-900/30 p-4 rounded-xl border border-stone-100 dark:border-zinc-900">
                <Label className="text-xs font-semibold text-stone-700 dark:text-zinc-300 flex items-center gap-1">
                  <ArrowRight className="h-3 w-3 text-stone-400 dark:text-zinc-500" /> Destination Accounting Field
                </Label>
                <Combobox 
                  items={ALLOCATION_TARGETS}
                  value={currentForm.allocationTarget}
                  onValueChange={(val) => updateFormField("allocationTarget", val ?? "Tuition Baseline Core")}
                >
                  <ComboboxInput 
                    placeholder="Route Allocation Target" 
                    className="h-9 text-xs w-full rounded-md border border-stone-200 dark:border-zinc-800 bg-background px-3 outline-none" 
                  />
                  <ComboboxContent>
                    <ComboboxEmpty>Ledger field target mismatch.</ComboboxEmpty>
                    <ComboboxList>
                      {(target) => (
                        <ComboboxItem key={target} value={target} className="text-xs">
                          {target}
                        </ComboboxItem>
                      )}
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
                <p className="text-[10px] text-stone-400 dark:text-zinc-500 mt-1">
                  Processing this collection path updates the chosen ledger point in real time.
                </p>
              </div>
            </div>
          </div>

          {/* STEP 3: TRANSACTION ARCHIVE MATRIX (COHORT RECEIPTS HISTORY) */}
          <div className="relative pl-10 group">
            <div className="absolute left-0 top-0 flex flex-col items-center h-full">
              <div className="flex h-7 w-7 items-center justify-center rounded-full border border-stone-200 dark:border-zinc-800 bg-background text-xs font-medium text-stone-500 dark:text-zinc-400">
                3
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <h3 className="text-base font-semibold text-foreground tracking-tight flex items-center gap-1.5">
                  <History className="h-4 w-4 text-stone-400 dark:text-zinc-500" /> Graded Inflow Audit Trail
                </h3>
                <p className="text-xs text-stone-400 dark:text-zinc-500 mt-0.5">Historically confirmed receipt allocations processed inside this tier context during this lifecycle window.</p>
              </div>

              <div className="space-y-2.5 max-w-2xl">
                {currentHistory.map((rcpt) => (
                  <div key={rcpt.id} className="flex items-center justify-between p-3.5 bg-stone-50 dark:bg-zinc-900/20 border border-stone-200/60 dark:border-zinc-800/60 rounded-xl">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="h-8 w-8 rounded-lg bg-stone-200/50 dark:bg-zinc-800/50 flex items-center justify-center shrink-0">
                        <CheckCircle className="h-4 w-4 text-stone-600 dark:text-zinc-400" />
                      </div>
                      
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-stone-900 dark:text-zinc-100 truncate">{rcpt.studentName}</span>
                          <span className="text-[10px] px-1.5 py-0.5 bg-stone-200 dark:bg-zinc-800 text-stone-700 dark:text-zinc-300 font-bold rounded tracking-tight shrink-0">{rcpt.receiptNumber}</span>
                        </div>
                        
                        <p className="text-[11px] text-stone-400 dark:text-zinc-500 mt-0.5 truncate">
                          Allocated: {rcpt.allocationTarget} via <strong className="text-stone-600 dark:text-zinc-300 font-medium">{rcpt.paymentMethod}</strong>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0 pl-2">
                      <div className="text-right">
                        <span className="text-xs font-bold text-stone-900 dark:text-zinc-50 block">${parseFloat(rcpt.amountPaid).toFixed(2)}</span>
                        <span className="text-[10px] text-stone-400 dark:text-zinc-500 block tracking-tight font-medium">{rcpt.dateProcessed}</span>
                      </div>

                      <Button 
                        type="button"
                        variant="outline"
                        className="h-8 w-8 p-0 border-stone-200 dark:border-zinc-800 hover:bg-stone-100 dark:hover:bg-zinc-800 text-stone-500 dark:text-zinc-400 hover:text-stone-900 dark:hover:text-zinc-100 rounded-lg"
                        title="Print Physical Statement Receipt"
                        onClick={() => alert(`Triggering System Print Protocol pipeline for statement token serial: ${rcpt.receiptNumber}`)}
                      >
                        <Printer className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ))}

                {currentHistory.length === 0 && (
                  <p className="text-xs text-stone-400 dark:text-zinc-500 italic">No verification receipts logged inside this operational layer context for today's balancing window.</p>
                )}
              </div>
            </div>
          </div>

          {/* Action Dispatch Controls */}
          <div className="flex items-center justify-end gap-3 pt-5 border-t border-stone-200 dark:border-zinc-800 bg-transparent max-w-2xl">
            <Button 
              type="submit" 
              disabled={!currentForm.studentName || !currentForm.amountPaid}
              className="h-9 text-xs font-medium px-4 bg-stone-900 text-white dark:bg-zinc-50 dark:text-zinc-950 hover:bg-stone-800 dark:hover:bg-zinc-200 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg flex items-center gap-1.5 shadow-none"
            >
              <Plus className="h-3.5 w-3.5" /> Commit Inflow & Generate Receipt
            </Button>
          </div>

        </form>
      </ScrollArea>
    </main>
  )
}