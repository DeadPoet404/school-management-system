"use client"

import * as React from "react"
import { useMemo, useState, useCallback, useEffect } from "react"
import {
  DollarSign,
  User,
  CreditCard,
  FileText,
  Printer,
  Plus,
  CheckCircle,
  ArrowRight,
  History,
  Wallet
} from "lucide-react"
import { fetchWithAuth } from "@/lib/fetch-with-auth"
import { useClasses } from "@/lib/api/reference"
import { ClassTabStrip } from "@/components/class-tab-strip"
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

// --- TYPES & SCHEMA CONTRACTS ---
export interface ReceiptRecord {
  id: string
  receiptNumber: string
  sectionId: string
  studentName: string
  amountPaid: string
  paymentMethod: string
  referenceNo: string
  allocationTarget: string
  dateProcessed: string
  studentInternalId?: string
}

export interface IntakeFormState {
  studentName: string
  amountPaid: string
  paymentMethod: string
  referenceNo: string
  allocationTarget: string
}

interface DbStudent {
  id: string
  studentId: string
  studentName: string
  billing: {
    currentBalance: string
  }
}

const ALLOCATION_TARGETS = [
  "Tuition Baseline Core",
  "Midday Catering & Snacks",
  "Computer Laboratory Access",
  "Science Lab Equipment Levy",
  "Stationery Kit Pack",
  "Outstanding Arrears Portfolio"
] as const

const DEFAULT_FORM_STATE = (): IntakeFormState => ({
  studentName: "",
  amountPaid: "",
  paymentMethod: "CASH",
  referenceNo: "",
  allocationTarget: "Tuition Baseline Core"
})

interface PaymentInflowCollectionLogProps {
  /** See FeeStructureInvoiceConfig — the action sheet supplies its own title. */
  showIntro?: boolean
  /** Module name from the Operations shell — rendered on mobile only. */
  title?: string
}

export function PaymentInflowCollectionLog({
  showIntro = true,
  title: moduleTitle,
}: PaymentInflowCollectionLogProps) {
  const { data: classes = [], isLoading: classesLoading } = useClasses()
  const academicSections = useMemo(
    () => classes.filter((c) => c.isActive !== false).map((c) => ({ id: c.id, label: c.name })),
    [classes],
  )
  const [activeSection, setActiveSection] = useState<string>("")
  const [history, setHistory] = useState<ReceiptRecord[]>([])
  const [dbStudents, setDbStudents] = useState<DbStudent[]>([])
  const [loading, setLoading] = useState<boolean>(false)
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const [formState, setFormState] = useState<IntakeFormState>(DEFAULT_FORM_STATE())

  useEffect(() => {
    if (academicSections.length === 0) return
    setActiveSection((current) => {
      if (current && academicSections.some((s) => s.id === current)) return current
      return academicSections[0]!.id
    })
  }, [academicSections])


  // Memoized System Partitions
  const targetSectionStudents = useMemo(() => {
    return dbStudents.map(s => s.studentName)
  }, [dbStudents])

  const selectedStudentData = useMemo(() => {
    return dbStudents.find(s => s.studentName === formState.studentName)
  }, [dbStudents, formState.studentName])

  const activeSectionLabel = useMemo(
    () => academicSections.find(s => s.id === activeSection)?.label || "",
    [activeSection, academicSections],
  )


  // --- UNIFIED DATA RECOVERY MATRIX ---
  const fetchSectionData = useCallback(async (sectionId: string) => {
    if (!sectionId) return
    setLoading(true)
    try {
      const [studentRes, ledgerRes] = await Promise.all([
        fetchWithAuth(`/finance/students-by-section/${sectionId}`),
        fetchWithAuth(`/finance/collections/${sectionId}`)
      ])

      const studentPayload = await studentRes.json()
      const ledgerPayload = await ledgerRes.json()

      if (studentPayload.success) setDbStudents(studentPayload.data)
      if (ledgerPayload.success) setHistory(ledgerPayload.data)
    } catch (error) {
      console.error("[Data Sync Failure]:", error)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchSectionData(activeSection)
    setFormState(DEFAULT_FORM_STATE())
  }, [activeSection, fetchSectionData])

  const updateFormField = useCallback((field: keyof IntakeFormState, value: string) => {
    setFormState(prev => ({
      ...prev,
      [field]: value
    }))
  }, [])

  const handleOpenReceiptPdf = useCallback(async (paymentId: string) => {
    setError(null)

    // Open synchronously so mobile browsers do not block the receipt tab after the request resolves.
    const receiptWindow = window.open("", "_blank")
    if (!receiptWindow) {
      setError("Your browser blocked the PDF receipt window. Please allow pop-ups and try again.")
      return
    }
    receiptWindow.opener = null

    try {
      const response = await fetchWithAuth(`/finance/payments/${paymentId}/receipt.pdf`)
      if (!response.ok) throw new Error("Receipt PDF request failed")

      const pdfUrl = URL.createObjectURL(await response.blob())
      receiptWindow.location.href = pdfUrl
      window.setTimeout(() => URL.revokeObjectURL(pdfUrl), 60_000)
    } catch {
      receiptWindow.close()
      setError("Unable to open the PDF receipt. Please try again.")
    }
  }, [])

  const handleProcessCollection = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formState.studentName || !formState.amountPaid || submitting) return

    const selectedStudent = dbStudents.find(s => s.studentName === formState.studentName)

    setError(null)
    setSuccessMessage(null)
    setSubmitting(true)

    // SMS-007: pre-open the receipt tab synchronously — popup blockers deny window.open after an await.
    // Declared OUTSIDE try so the catch block can close the tab on network errors.
    const receiptWindow = window.open("", "_blank")

    try {
      // ✅ FIXED: removed the outer fetch() wrapper — fetchWithAuth IS the fetch
      const response = await fetchWithAuth("/finance/collections", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sectionId: activeSection,
          ...formState,
          paymentMethod: "CASH",
          studentInternalId: selectedStudent?.id || undefined
        })
      })

      const payload = await response.json()
      if (payload.success) {
        setHistory(prev => [payload.data, ...prev])
        setFormState(DEFAULT_FORM_STATE())
        fetchSectionData(activeSection)
        setSuccessMessage(payload.message || "Payment collection recorded successfully.")
        if (receiptWindow) {
          // SMS-007: pop the print-ready PDF (browser print-or-cancel flow)
          receiptWindow.location.href = `/api/finance/payments/${payload.data.id}/receipt.print`
        }
      } else {
        receiptWindow?.close()
        setError(payload.message || "Failed to process collection inflow.")
      }
    } catch (error) {
      receiptWindow?.close()
      console.error("[Collection Pipeline Ingress Write Error]:", error)
      setError(error instanceof Error ? error.message : "Network error while processing collection inflow.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="flex-1 h-full min-h-0 flex flex-col overflow-hidden bg-transparent px-4 py-4 sm:px-6 sm:py-6 lg:px-8">

      {moduleTitle ? (
        <h1 className="text-xl tracking-tight font-semibold text-foreground sm:text-3xl md:hidden">
          {moduleTitle}
        </h1>
      ) : null}

      {showIntro ? (
        <div className="flex flex-col gap-1.5 shrink-0 sm:gap-2">
          <div className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground tracking-wide uppercase font-bold text-stone-400 sm:text-xs">
            Finance operations
          </div>

          <p className="hidden max-w-2xl text-xs text-muted-foreground sm:block sm:text-sm">
            Record a verified cash payment, then open the official A5 receipt.
          </p>
        </div>
      ) : null}

      {/* DUAL LAYER COHORT TRACK HUD FRAME */}
      <ClassTabStrip
        sections={academicSections}
        activeSection={activeSection}
        onSelect={setActiveSection}
        label="Choose class"
        className="max-w-5xl"
      />

      <hr className="border-stone-200 dark:border-zinc-800 shrink-0 mt-4 mb-5 sm:mt-5 sm:mb-6" />
      {error && (
        <div className="mb-4 flex items-start justify-between gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-600 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="-mr-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center text-base font-bold text-red-500 hover:text-red-700" aria-label="Dismiss error">×</button>
        </div>
      )}
      {successMessage && (
        <div className="mb-4 flex items-start justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-emerald-600 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400">
          <span>{successMessage}</span>
          <button type="button" onClick={() => setSuccessMessage(null)} className="-mr-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center text-base font-bold text-emerald-500 hover:text-emerald-700" aria-label="Dismiss success message">×</button>
        </div>
      )}

      {/* Core Ledger Processing Workspace */}
      <ScrollArea className="flex-1 min-h-0 w-full max-w-3xl rounded-none border-none bg-transparent shadow-none">
        <form onSubmit={handleProcessCollection} className="space-y-8 pb-28 pr-0 sm:space-y-12 sm:pb-12 sm:pr-4">

          {/* TRACK STEP 1: TRANSACTION INTAKE METRICS NODE */}
          <div className="relative pl-0 sm:pl-10 group">
            <div className="absolute left-0 top-0 hidden h-full flex-col items-center sm:flex">
              <div className="flex h-7 w-7 items-center justify-center rounded-full border border-stone-200 dark:border-zinc-700 bg-background text-xs font-medium text-stone-500 dark:text-zinc-400">
                1
              </div>
              <div className="w-[1px] flex-1 bg-stone-200 dark:bg-zinc-800 mt-2" />
            </div>

            <div className="space-y-5">
              <div>
                <h3 className="text-base font-semibold text-foreground tracking-tight">
                  Payment details <span className="text-stone-400 font-normal text-xs">({activeSectionLabel})</span>
                </h3>
                <p className="mt-0.5 text-xs text-stone-400 dark:text-zinc-500">Choose the student and the verified cash amount received.</p>
              </div>

              <div className="grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-2">
                {/* Combobox Student Roster Target */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-stone-700 dark:text-zinc-300 flex items-center gap-1">
                    <User className="h-3 w-3 text-stone-400 dark:text-zinc-500" /> Student <span className="text-red-500">*</span>
                  </Label>
                  <Combobox
                    items={targetSectionStudents}
                    value={formState.studentName}
                    onValueChange={(val) => updateFormField("studentName", val ?? "")}
                  >
                    <ComboboxInput
                      placeholder={loading ? "Loading students..." : "Select a student"}
                      className="h-11 w-full rounded-md border border-stone-200 bg-background px-3 text-sm outline-none dark:border-zinc-800 sm:h-9 sm:text-xs"
                    />
                    <ComboboxContent>
                      <ComboboxEmpty>No student profiles found in this tier.</ComboboxEmpty>
                      <ComboboxList>
                        {(student) => (
                          <ComboboxItem key={student} value={student} className="text-xs">
                            {student}
                          </ComboboxItem>
                        )}
                      </ComboboxList>
                    </ComboboxContent>
                  </Combobox>
                  {/* LIVE BALANCE INDICATOR */}
                  {selectedStudentData && (
                    <div className="flex w-full items-center gap-1.5 rounded-md bg-stone-100 px-2 py-1.5 text-xs font-medium text-stone-600 dark:bg-zinc-900 dark:text-zinc-400 sm:w-fit sm:text-[10px] sm:py-1">
                      <Wallet className="h-3 w-3" />
                      Outstanding Balance: <span className="font-bold text-stone-900 dark:text-zinc-100">${parseFloat(selectedStudentData.billing.currentBalance).toFixed(2)}</span>
                    </div>
                  )}
                </div>

                {/* Amount Paid Field */}
                <div className="space-y-1.5">
                  <Label htmlFor="amount-paid" className="text-xs font-semibold text-stone-700 dark:text-zinc-300 flex items-center gap-1">
                    <DollarSign className="h-3 w-3 text-stone-400 dark:text-zinc-500" /> Amount paid <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative w-full">
                    <DollarSign className="absolute left-3 top-3.5 h-4 w-4 text-stone-400 dark:text-zinc-500 sm:left-2.5 sm:top-3 sm:h-3 sm:w-3" />
                    <Input
                      id="amount-paid"
                      type="number"
                      min="1"
                      required
                      value={formState.amountPaid}
                      onChange={(e) => updateFormField("amountPaid", e.target.value)}
                      placeholder="0.00"
                      className="h-11 rounded-md border-stone-200 bg-background pl-9 text-sm dark:border-zinc-800 sm:h-9 sm:pl-7 sm:text-xs"
                    />
                  </div>
                </div>

                {/* SMS-002: manual counter collections are cash-only. Digital channels
                    (MoMo / card / bank transfer) enter via Paystack reconciliation only. */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-stone-700 dark:text-zinc-300 flex items-center gap-1">
                    <CreditCard className="h-3 w-3 text-stone-400 dark:text-zinc-500" /> Payment method
                  </Label>
                  <div className="flex h-11 w-full items-center rounded-md border border-stone-200 bg-stone-100 px-3 text-sm font-semibold text-stone-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 sm:h-9 sm:text-xs">
                    Cash (Counter Collection)
                  </div>
                </div>

                {/* Reference ID Field */}
                <div className="space-y-1.5">
                  <Label htmlFor="reference-no" className="text-xs font-semibold text-stone-700 dark:text-zinc-300 flex items-center gap-1">
                    <FileText className="h-3 w-3 text-stone-400 dark:text-zinc-500" /> Reference / note
                  </Label>
                  <Input
                    id="reference-no"
                    type="text"
                    value={formState.referenceNo}
                    onChange={(e) => updateFormField("referenceNo", e.target.value)}
                    placeholder="Optional transaction reference"
                    className="h-11 rounded-md border-stone-200 bg-background text-sm dark:border-zinc-800 sm:h-9 sm:text-xs"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* TRACK STEP 2: REVENUE TARGET BALANCE ALLOCATION MATRIX */}
          <div className="relative pl-0 sm:pl-10 group">
            <div className="absolute left-0 top-0 hidden h-full flex-col items-center sm:flex">
              <div className="flex h-7 w-7 items-center justify-center rounded-full border border-stone-200 dark:border-zinc-700 bg-background text-xs font-medium text-stone-500 dark:text-zinc-400">
                2
              </div>
              <div className="w-[1px] flex-1 bg-stone-200 dark:bg-zinc-800 mt-2" />
            </div>

            <div className="space-y-5">
              <div>
                <h3 className="text-base font-semibold text-foreground tracking-tight">
                  What does this payment cover?
                </h3>
                <p className="mt-0.5 text-xs text-stone-400 dark:text-zinc-500">Choose the ledger category before recording the payment.</p>
              </div>

              <div className="max-w-md space-y-2 rounded-xl border border-stone-100 bg-stone-50/50 p-3 dark:border-zinc-800/50 dark:bg-zinc-900/20 sm:p-4">
                <Label className="text-xs font-semibold text-stone-700 dark:text-zinc-300 flex items-center gap-1">
                  <ArrowRight className="h-3 w-3 text-stone-400 dark:text-zinc-500" /> Allocation
                </Label>
                <Combobox
                  items={ALLOCATION_TARGETS}
                  value={formState.allocationTarget}
                  onValueChange={(val) => updateFormField("allocationTarget", val ?? "Tuition Baseline Core")}
                >
                  <ComboboxInput
                    placeholder="Route Allocation Target"
                    className="h-11 w-full rounded-md border border-stone-200 bg-background px-3 text-sm outline-none dark:border-zinc-800 sm:h-9 sm:text-xs"
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
                  Recording this payment updates the student&apos;s balance immediately.
                </p>
              </div>
            </div>
          </div>

          {/* TRACK STEP 3: TRANSACTION ARCHIVE MATRIX */}
          <div className="relative pl-0 sm:pl-10 group">
            <div className="absolute left-0 top-0 hidden h-full flex-col items-center sm:flex">
              <div className="flex h-7 w-7 items-center justify-center rounded-full border border-stone-200 dark:border-zinc-700 bg-background text-xs font-medium text-stone-500 dark:text-zinc-400">
                3
              </div>
            </div>

            <div className="space-y-5">
              <div>
                <h3 className="text-base font-semibold text-foreground tracking-tight flex items-center gap-1.5">
                  <History className="h-4 w-4 text-stone-400 dark:text-zinc-500" /> Recent receipts
                </h3>
                <p className="mt-0.5 text-xs text-stone-400 dark:text-zinc-500">Review payments already recorded for this class.</p>
              </div>

              <div className="space-y-2.5 max-w-2xl">
                {loading ? (
                  <div className="text-xs text-stone-400 dark:text-zinc-500 italic py-4 animate-pulse flex items-center gap-2">
                    <span className="h-2 w-2 bg-stone-400 dark:bg-zinc-500 rounded-full animate-ping" />
                    Loading receipts...
                  </div>
                ) : history.map((rcpt) => (
                  <article
                    key={rcpt.id}
                    className="animate-fade-in rounded-xl border border-stone-200/60 bg-stone-50 p-3.5 dark:border-zinc-800/60 dark:bg-zinc-950"
                  >
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-stone-200/50 dark:bg-zinc-800">
                        <CheckCircle className="h-4 w-4 text-stone-600 dark:text-zinc-400" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                          <span className="text-sm font-semibold text-stone-900 dark:text-zinc-100 sm:text-xs">
                            {rcpt.studentName}
                          </span>
                          <span className="shrink-0 rounded bg-stone-200 px-1.5 py-0.5 text-[10px] font-bold tracking-tight text-stone-700 dark:bg-zinc-800 dark:text-zinc-300">
                            {rcpt.receiptNumber}
                          </span>
                        </div>

                        <p className="mt-1 text-xs leading-5 text-stone-500 dark:text-zinc-400 sm:truncate sm:text-[11px]">
                          {rcpt.allocationTarget} · {rcpt.paymentMethod}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 flex items-center justify-between gap-3 border-t border-stone-200/70 pt-3 dark:border-zinc-800/70 sm:mt-2 sm:gap-4 sm:border-0 sm:pt-0">
                      <div>
                        <span className="block text-sm font-bold text-stone-900 dark:text-zinc-50 sm:text-xs">
                          ${parseFloat(rcpt.amountPaid).toFixed(2)}
                        </span>
                        <span className="block text-[11px] font-medium tracking-tight text-stone-400 dark:text-zinc-500 sm:text-[10px]">
                          {new Date(rcpt.dateProcessed).toISOString().split('T')[0]}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          className="h-9 gap-1.5 border-stone-200 px-3 text-xs text-stone-600 hover:bg-stone-100 hover:text-stone-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-50 sm:h-8 sm:px-2"
                          title="View PDF receipt"
                          onClick={() => handleOpenReceiptPdf(rcpt.id)}
                        >
                          <FileText className="h-3.5 w-3.5" />
                          <span>PDF</span>
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-9 gap-1.5 border-stone-200 px-3 text-xs text-stone-600 hover:bg-stone-100 hover:text-stone-900 dark:border-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-50 sm:h-8 sm:px-2"
                          title="Open A5 print receipt"
                          onClick={() => window.open(`/api/finance/payments/${rcpt.id}/receipt.print`, "_blank", "noopener,noreferrer")}
                        >
                          <Printer className="h-3.5 w-3.5" />
                          <span>Print A5</span>
                        </Button>
                      </div>
                    </div>
                  </article>
                ))}

                {!loading && history.length === 0 && (
                  <p className="py-3 text-xs italic text-stone-400 dark:text-zinc-500">No receipts recorded for this class yet.</p>
                )}
              </div>
            </div>
          </div>

          {/* Processing and Dispatch Action Controls */}
          <div className="sticky bottom-0 z-10 -mx-4 flex items-center border-t border-stone-200 bg-background/95 px-4 py-3 backdrop-blur dark:border-zinc-800 dark:bg-background/95 sm:static sm:mx-0 sm:justify-end sm:bg-transparent sm:px-0 sm:pt-5 sm:pb-0 sm:backdrop-blur-none">
            <Button
              type="submit"
              disabled={!formState.studentName || !formState.amountPaid || submitting}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-stone-900 px-4 text-sm font-medium text-white shadow-none hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200 sm:h-9 sm:w-auto sm:text-xs"
            >
              <Plus className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
              {submitting ? "Recording payment..." : "Record payment & print A5 receipt"}
            </Button>
          </div>

        </form>
      </ScrollArea>
    </main>
  )
}
