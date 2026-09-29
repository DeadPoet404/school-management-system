"use client"

import * as React from "react"
import { useMemo, useState, useCallback, useEffect, useRef } from "react"
import { createPortal } from "react-dom"
import {
  User,
  CreditCard,
  FileText,
  Printer,
  Plus,
  CheckCircle,
  ArrowRight,
  History,
  Search,
  X,
  Users,
} from "lucide-react"
import { fetchWithAuth } from "@/lib/fetch-with-auth"
import { printReceiptInPage } from "@/lib/print-receipt"
import { Skeleton } from "@/components/ui/skeleton"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import { canonicalizeFeeName } from "@/lib/fee-names"

export interface ReceiptRecord {
  id: string
  receiptNumber: string
  sectionId: string
  studentName: string
  receiptName?: string | null
  amountPaid: string
  paymentMethod: string
  referenceNo: string
  allocationTarget: string
  dateProcessed: string
  studentInternalId?: string | null
  className?: string | null
  shares?: Array<{ studentName: string; className?: string | null; amount: string }>
}

interface StudentHit {
  id: string
  studentId: string
  studentName: string
  classId: string
  className: string
  currentBalance: string
  creditBalance: string
}

const ENROLLMENT_UMBRELLA = "First Term Enrollment (Admission + Uniform + Tuition)"
const SHOW_BALANCE_KEY = "jocomfy.collections.showOutstanding"
const MAX_PAYERS = 8

const ALLOCATION_FALLBACKS = [
  "Tuition Baseline Core",
  "Midday Catering & Snacks",
  "Computer Laboratory Access",
  "Science Lab Equipment Levy",
  "Stationery Kit Pack",
  "Outstanding Arrears Portfolio",
] as const

interface PaymentInflowCollectionLogProps {
  showIntro?: boolean
  title?: string
}

function money(value: string | number | null | undefined): string {
  const n = typeof value === "number" ? value : parseFloat(String(value ?? ""))
  return Number.isFinite(n) ? n.toFixed(2) : "0.00"
}

function toCents(value: string | number): number {
  const n = typeof value === "number" ? value : Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.round(n * 100)
}

function equalShares(total: number, ids: string[]): Record<string, string> {
  const cents = Math.round(total * 100)
  if (ids.length === 0 || cents <= 0) {
    return Object.fromEntries(ids.map((id) => [id, ""]))
  }
  const base = Math.floor(cents / ids.length)
  let extra = cents - base * ids.length
  const out: Record<string, string> = {}
  for (const id of ids) {
    const share = base + (extra > 0 ? 1 : 0)
    if (extra > 0) extra -= 1
    out[id] = (share / 100).toFixed(2)
  }
  return out
}

function suggestReceiptName(payers: Array<{ studentName: string }>): string {
  const lasts = payers
    .map((payer) => {
      const parts = payer.studentName.trim().split(/\s+/).filter(Boolean)
      return (parts[parts.length - 1] ?? "").toUpperCase()
    })
    .filter(Boolean)
  if (lasts.length >= 2 && lasts.every((last) => last === lasts[0])) {
    return `${lasts[0]} family`
  }
  return ""
}

function StudentSearch({
  placeholder,
  excludeIds,
  showBalance,
  onSelect,
}: {
  placeholder: string
  excludeIds: string[]
  showBalance: boolean
  onSelect: (student: StudentHit) => void
}) {
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const [results, setResults] = useState<StudentHit[]>([])
  const [resultQuery, setResultQuery] = useState("")
  const boxRef = useRef<HTMLDivElement>(null)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const trimmed = query.trim()
  const searching = trimmed.length >= 2 && resultQuery !== trimmed
  const matches = trimmed.length >= 2 && resultQuery === trimmed ? results : []

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) return
    let cancelled = false
    const handle = window.setTimeout(() => {
      fetchWithAuth(`/finance/students/search?q=${encodeURIComponent(q)}`)
        .then(async (res) => res.json())
        .then((payload) => {
          if (cancelled) return
          setResults(payload.success && Array.isArray(payload.data) ? payload.data : [])
          setResultQuery(q)
        })
        .catch(() => {
          if (cancelled) return
          setResults([])
          setResultQuery(q)
        })
    }, 180)
    return () => {
      cancelled = true
      window.clearTimeout(handle)
    }
  }, [query])

  useEffect(() => {
    if (!open) return
    const update = () => {
      if (boxRef.current) setRect(boxRef.current.getBoundingClientRect())
    }
    update()
    window.addEventListener("scroll", update, true)
    window.addEventListener("resize", update)
    const onDoc = (event: MouseEvent) => {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", onDoc)
    return () => {
      window.removeEventListener("scroll", update, true)
      window.removeEventListener("resize", update)
      document.removeEventListener("mousedown", onDoc)
    }
  }, [open, results.length])

  const visible = matches.filter((student) => !excludeIds.includes(student.id))
  const showMenu = open && query.trim().length >= 2 && rect

  return (
    <div ref={boxRef} className="relative">
      <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-stone-400 sm:top-2.5 sm:h-3.5 sm:w-3.5" />
      <Input
        value={query}
        onChange={(event) => {
          setQuery(event.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        className="h-11 rounded-md border-stone-200 bg-background pl-9 text-sm dark:border-zinc-800 sm:h-9 sm:text-xs"
      />
      {showMenu && createPortal(
        <div
          role="listbox"
          style={{
            position: "fixed",
            top: rect.bottom + 4,
            left: rect.left,
            width: Math.max(rect.width, 280),
            zIndex: 80,
          }}
          className="max-h-72 overflow-y-auto rounded-lg border border-stone-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-950"
        >
          {searching && visible.length === 0 ? (
            <p className="px-3 py-3 text-xs text-stone-500">Searching…</p>
          ) : null}
          {!searching && visible.length === 0 ? (
            <p className="px-3 py-3 text-xs text-stone-500">No student matches that name or ID.</p>
          ) : null}
          {visible.map((student) => (
            <button
              key={student.id}
              type="button"
              role="option"
              aria-selected={false}
              onMouseDown={(event) => {
                event.preventDefault()
                onSelect(student)
                setQuery("")
                setOpen(false)
                setResults([])
              }}
              className="flex w-full items-start justify-between gap-3 px-3 py-2.5 text-left hover:bg-stone-100 dark:hover:bg-zinc-900"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-stone-900 dark:text-zinc-100">
                  {student.studentName}
                </span>
                <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-stone-500">
                  <span className="rounded bg-stone-200 px-1.5 py-0.5 font-semibold text-stone-700 dark:bg-zinc-800 dark:text-zinc-300">
                    {student.className}
                  </span>
                  <span>{student.studentId}</span>
                </span>
              </span>
              {showBalance ? (
                <span className="shrink-0 text-right text-[11px] font-semibold text-stone-700 dark:text-zinc-300">
                  ₵{money(student.currentBalance)}
                  <span className="block font-medium text-stone-400">outstanding</span>
                </span>
              ) : null}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </div>
  )
}

export function PaymentInflowCollectionLog({
  showIntro = true,
  title: moduleTitle,
}: PaymentInflowCollectionLogProps) {
  const [payers, setPayers] = useState<StudentHit[]>([])
  const [amountPaid, setAmountPaid] = useState("")
  const [referenceNo, setReferenceNo] = useState("")
  const [allocationChoice, setAllocationChoice] = useState<string | null>(null)
  const [receiptNameDraft, setReceiptNameDraft] = useState("")
  const [receiptNameTouched, setReceiptNameTouched] = useState(false)
  const [splitMode, setSplitMode] = useState<"equal" | "custom">("equal")
  const [customShares, setCustomShares] = useState<Record<string, string>>({})
  const [showOutstanding, setShowOutstanding] = useState(() => {
    if (typeof window === "undefined") return true
    try {
      return window.localStorage.getItem(SHOW_BALANCE_KEY) !== "0"
    } catch {
      return true
    }
  })

  const [history, setHistory] = useState<ReceiptRecord[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [feeMatrix, setFeeMatrix] = useState<Record<string, { components: { name: string }[] }> | null>(null)

  const primary = payers[0] ?? null
  const isSplit = payers.length > 1

  useEffect(() => {
    try {
      window.localStorage.setItem(SHOW_BALANCE_KEY, showOutstanding ? "1" : "0")
    } catch {
      // Preference is convenience only.
    }
  }, [showOutstanding])

  useEffect(() => {
    let cancelled = false
    fetchWithAuth("/finance/fee-structures")
      .then(async (res) => res.json())
      .then((payload) => {
        if (!cancelled && payload.success && payload.data) setFeeMatrix(payload.data)
      })
      .catch(() => {
        // Fee matrix unavailable — the static fallback list stays.
      })
    return () => {
      cancelled = true
    }
  }, [])

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetchWithAuth("/finance/collections?limit=20")
      const payload = await res.json()
      if (payload.success && Array.isArray(payload.data)) setHistory(payload.data)
    } catch (err) {
      console.error("[Collections history]:", err)
    } finally {
      setHistoryLoading(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchWithAuth("/finance/collections?limit=20")
      .then(async (res) => res.json())
      .then((payload) => {
        if (!cancelled && payload.success && Array.isArray(payload.data)) setHistory(payload.data)
      })
      .catch((err) => {
        console.error("[Collections history]:", err)
      })
      .finally(() => {
        if (!cancelled) setHistoryLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const allocationOptions = useMemo(() => {
    const section = primary ? feeMatrix?.[primary.classId] : undefined
    const names = (section?.components ?? [])
      .map((component) => canonicalizeFeeName(component.name || "") ?? (component.name || "").trim())
      .filter(Boolean)
    const base = names.length > 0 ? names : [...ALLOCATION_FALLBACKS]
    const list: string[] = []
    for (const candidate of [ENROLLMENT_UMBRELLA, ...base]) {
      if (!list.includes(candidate)) list.push(candidate)
    }
    return list
  }, [feeMatrix, primary])

  const defaultAllocation = allocationOptions.includes("Termly Tuition")
    ? "Termly Tuition"
    : allocationOptions[0] ?? ""
  const allocationTarget = allocationChoice && allocationOptions.includes(allocationChoice)
    ? allocationChoice
    : defaultAllocation
  const receiptName = !isSplit
    ? ""
    : receiptNameTouched
      ? receiptNameDraft
      : suggestReceiptName(payers)
  const equalShareAmounts = useMemo(() => {
    if (!isSplit) return {}
    const total = Number(amountPaid)
    if (!(total > 0)) return {}
    return equalShares(total, payers.map((payer) => payer.id))
  }, [isSplit, amountPaid, payers])
  const shareAmounts = splitMode === "equal" ? equalShareAmounts : customShares

  const allocatedCents = payers.reduce((sum, payer) => sum + toCents(shareAmounts[payer.id] ?? "0"), 0)
  const totalCents = toCents(amountPaid)
  const splitGap = isSplit && totalCents > 0 ? totalCents - allocatedCents : 0
  const zeroShare = isSplit && totalCents > 0 && payers.some((payer) => toCents(shareAmounts[payer.id] ?? "0") <= 0)
  const receiptNameMissing = isSplit && receiptName.trim().length < 2
  const canSubmit = Boolean(
    primary
    && totalCents > 0
    && allocationTarget
    && !submitting
    && !receiptNameMissing
    && !zeroShare
    && splitGap === 0,
  )

  const addStudent = (student: StudentHit) => {
    if (payers.some((payer) => payer.id === student.id)) return
    if (payers.length >= MAX_PAYERS) {
      setError(`A receipt can cover at most ${MAX_PAYERS} students.`)
      return
    }
    setError(null)
    setPayers((current) => current.some((payer) => payer.id === student.id) ? current : [...current, student])
  }

  const removeStudent = (id: string) => {
    setPayers((current) => current.filter((payer) => payer.id !== id))
    setCustomShares((current) => {
      const next = { ...current }
      delete next[id]
      return next
    })
  }

  const clearStudents = () => {
    setPayers([])
    setCustomShares({})
    setReceiptNameDraft("")
    setReceiptNameTouched(false)
    setSplitMode("equal")
  }

  const resetForm = () => {
    clearStudents()
    setAmountPaid("")
    setReferenceNo("")
  }

  const handleProcessCollection = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!primary || !canSubmit) return

    setError(null)
    setSuccessMessage(null)
    setSubmitting(true)
    try {
      const response = await fetchWithAuth("/finance/collections", {
        method: "POST",
        body: JSON.stringify({
          sectionId: primary.classId,
          studentName: primary.studentName,
          studentInternalId: primary.id,
          amountPaid: totalCents / 100,
          paymentMethod: "CASH",
          referenceNo,
          allocationTarget,
          showOutstanding,
          ...(isSplit
            ? {
                receiptName: receiptName.trim(),
                shares: payers.map((payer) => ({
                  studentInternalId: payer.id,
                  amount: toCents(shareAmounts[payer.id] ?? "0") / 100,
                })),
              }
            : {}),
        }),
      })
      const payload = await response.json()
      if (payload.success) {
        resetForm()
        setSuccessMessage("Payment recorded. The receipt is opening.")
        void fetchHistory()
        printReceiptInPage(payload.data.id).catch((err) => {
          console.error("[Receipt Print Trigger Error]:", err)
        })
      } else {
        const detail = Array.isArray(payload.errors)
          ? payload.errors.map((item: { message?: string }) => item.message).filter(Boolean).join(" ")
          : ""
        setError(detail || payload.message || "Failed to process collection inflow.")
      }
    } catch (err) {
      console.error("[Collection Pipeline Ingress Write Error]:", err)
      setError(err instanceof Error ? err.message : "Network error while processing collection inflow.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="flex h-full min-h-0 flex-1 flex-col overflow-hidden bg-transparent px-4 py-4 sm:px-6 sm:py-6 lg:px-8">
      {moduleTitle ? (
        <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-3xl md:hidden">
          {moduleTitle}
        </h1>
      ) : null}

      {showIntro ? (
        <div className="flex shrink-0 flex-col gap-1.5 sm:gap-2">
          <div className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-stone-400 sm:text-xs">
            Finance operations
          </div>
          <p className="hidden max-w-2xl text-xs text-muted-foreground sm:block sm:text-sm">
            Search for a student, record the cash received, and print the receipt. Add other students to split one payment, and put a family name on the receipt.
          </p>
        </div>
      ) : null}

      {error ? (
        <div className="mb-4 mt-4 flex items-start justify-between gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs font-medium text-red-600 dark:border-red-800 dark:bg-red-950/30 dark:text-red-400">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="-mr-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center text-base font-bold" aria-label="Dismiss error">×</button>
        </div>
      ) : null}
      {successMessage ? (
        <div className="mb-4 mt-4 flex items-start justify-between gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs font-medium text-emerald-600 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400">
          <span>{successMessage}</span>
          <button type="button" onClick={() => setSuccessMessage(null)} className="-mr-1 -mt-1 flex h-7 w-7 shrink-0 items-center justify-center text-base font-bold" aria-label="Dismiss success message">×</button>
        </div>
      ) : null}

      <ScrollArea className="min-h-0 w-full max-w-3xl flex-1 rounded-none border-none bg-transparent shadow-none">
        <form onSubmit={handleProcessCollection} className="space-y-8 pb-28 pr-0 sm:space-y-12 sm:pb-12 sm:pr-4">
          <div className="relative pl-0 sm:pl-10">
            <div className="absolute left-0 top-0 hidden h-full flex-col items-center sm:flex">
              <div className="flex h-7 w-7 items-center justify-center rounded-full border border-stone-200 bg-background text-xs font-medium text-stone-500 dark:border-zinc-700 dark:text-zinc-400">1</div>
              <div className="mt-2 w-px flex-1 bg-stone-200 dark:bg-zinc-800" />
            </div>

            <div className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold tracking-tight text-foreground">Payment details</h3>
                  <p className="mt-0.5 text-xs text-stone-400 dark:text-zinc-500">Search by name or ID. The class is shown with each suggestion.</p>
                </div>
                <label className="flex items-center gap-2 text-xs font-semibold text-stone-600 dark:text-zinc-300">
                  <Switch
                    checked={showOutstanding}
                    onCheckedChange={setShowOutstanding}
                    aria-label="Show outstanding balance"
                  />
                  Show outstanding balance
                </label>
              </div>

              <div className="max-w-2xl space-y-4">
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1 text-xs font-semibold text-stone-700 dark:text-zinc-300">
                    <User className="h-3 w-3 text-stone-400" /> {primary ? "Add another student" : "Student"} <span className="text-red-500">*</span>
                  </Label>
                  <StudentSearch
                    placeholder={primary ? "Add another student — optional" : "Search student name or ID"}
                    excludeIds={payers.map((payer) => payer.id)}
                    showBalance={showOutstanding}
                    onSelect={addStudent}
                  />
                  {payers.length >= MAX_PAYERS ? (
                    <p className="text-[11px] text-stone-500">A receipt can cover at most {MAX_PAYERS} students.</p>
                  ) : null}
                </div>

                {payers.length > 0 ? (
                  <div className="overflow-hidden rounded-xl border border-stone-200 dark:border-zinc-800">
                    {payers.map((payer, index) => (
                      <div key={payer.id} className="flex flex-wrap items-center gap-3 border-b border-stone-100 px-3 py-2.5 last:border-0 dark:border-zinc-800">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-stone-900 dark:text-zinc-100">
                            {payer.studentName}
                            {index === 0 ? <span className="ml-2 text-[10px] font-bold uppercase tracking-wide text-stone-400">First</span> : null}
                          </p>
                          <p className="mt-0.5 text-[11px] text-stone-500">
                            <span className="font-semibold text-stone-700 dark:text-zinc-300">{payer.className}</span>
                            {" · "}{payer.studentId}
                            {showOutstanding ? ` · Outstanding ₵${money(payer.currentBalance)}` : ""}
                            {showOutstanding && parseFloat(payer.creditBalance) > 0 ? ` · Credit ₵${money(payer.creditBalance)}` : ""}
                          </p>
                        </div>
                        {isSplit ? (
                          <div className="relative w-28">
                            <span className="absolute left-2 top-2.5 text-[11px] font-bold text-stone-400">₵</span>
                            <Input
                              type="number"
                              min="0.01"
                              step="0.01"
                              inputMode="decimal"
                              aria-label={`Amount for ${payer.studentName}`}
                              value={shareAmounts[payer.id] ?? ""}
                              onChange={(event) => {
                                setSplitMode("custom")
                                setCustomShares((current) => ({
                                  ...(splitMode === "equal" ? equalShareAmounts : current),
                                  [payer.id]: event.target.value,
                                }))
                              }}
                              className="h-9 pl-6 text-right text-xs"
                            />
                          </div>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => index === 0 ? clearStudents() : removeStudent(payer.id)}
                          className="flex h-8 w-8 items-center justify-center rounded-md text-stone-400 hover:bg-stone-100 hover:text-stone-700 dark:hover:bg-zinc-900"
                          aria-label={index === 0 ? "Clear students" : `Remove ${payer.studentName}`}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}

                {isSplit ? (
                  <div className="space-y-3 rounded-xl border border-stone-200 bg-stone-50/70 p-3 dark:border-zinc-800 dark:bg-zinc-900/30">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="flex items-center gap-1.5 text-xs font-semibold text-stone-700 dark:text-zinc-300">
                        <Users className="h-3.5 w-3.5" /> Split across {payers.length} students
                      </p>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-8 px-2 text-xs"
                        onClick={() => {
                          setSplitMode("equal")
                          setCustomShares({})
                        }}
                      >
                        Split equally
                      </Button>
                    </div>
                    <p className="text-[11px] text-stone-500">
                      The cash received is split below. Each student&apos;s balance is reduced by their share only — not the full amount.
                      {splitGap === 0 && !zeroShare ? " Shares match the amount received." : ""}
                      {splitGap > 0 ? ` ₵${money(splitGap / 100)} still to assign.` : ""}
                      {splitGap < 0 ? ` ₵${money(Math.abs(splitGap) / 100)} over the amount received.` : ""}
                      {zeroShare ? " Every student needs an amount above zero." : ""}
                    </p>
                    <div className="space-y-1.5">
                      <Label htmlFor="receipt-name" className="text-xs font-semibold text-stone-700 dark:text-zinc-300">
                        Name on the receipt <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="receipt-name"
                        value={receiptName}
                        onChange={(event) => {
                          setReceiptNameTouched(true)
                          setReceiptNameDraft(event.target.value)
                        }}
                        maxLength={80}
                        placeholder="e.g. MENSAH family"
                        className="h-11 bg-background text-sm sm:h-9 sm:text-xs"
                      />
                      <p className="text-[11px] text-stone-400">This is what prints at the top, instead of one child&apos;s name.</p>
                    </div>
                  </div>
                ) : null}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="amount-paid" className="flex items-center gap-1 text-xs font-semibold text-stone-700 dark:text-zinc-300">
                      <span className="text-[11px] font-bold text-stone-400">₵</span> Amount received <span className="text-red-500">*</span>
                    </Label>
                    <div className="relative">
                      <span className="absolute left-3 top-3.5 text-[13px] font-bold leading-none text-stone-400 sm:left-2.5 sm:top-3 sm:text-[11px]">₵</span>
                      <Input
                        id="amount-paid"
                        type="number"
                        min="0.01"
                        step="0.01"
                        inputMode="decimal"
                        required
                        value={amountPaid}
                        onChange={(event) => setAmountPaid(event.target.value)}
                        placeholder="0.00"
                        className="h-11 rounded-md border-stone-200 bg-background pl-9 text-sm dark:border-zinc-800 sm:h-9 sm:pl-7 sm:text-xs"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1 text-xs font-semibold text-stone-700 dark:text-zinc-300">
                      <CreditCard className="h-3 w-3 text-stone-400" /> Payment method
                    </Label>
                    <div className="flex h-11 w-full items-center rounded-md border border-stone-200 bg-stone-100 px-3 text-sm font-semibold text-stone-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300 sm:h-9 sm:text-xs">
                      Cash (Counter Collection)
                    </div>
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="reference-no" className="flex items-center gap-1 text-xs font-semibold text-stone-700 dark:text-zinc-300">
                      <FileText className="h-3 w-3 text-stone-400" /> Reference / note
                    </Label>
                    <Input
                      id="reference-no"
                      value={referenceNo}
                      onChange={(event) => setReferenceNo(event.target.value)}
                      placeholder="Optional transaction reference"
                      className="h-11 rounded-md border-stone-200 bg-background text-sm dark:border-zinc-800 sm:h-9 sm:text-xs"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="relative pl-0 sm:pl-10">
            <div className="absolute left-0 top-0 hidden h-full flex-col items-center sm:flex">
              <div className="flex h-7 w-7 items-center justify-center rounded-full border border-stone-200 bg-background text-xs font-medium text-stone-500 dark:border-zinc-700 dark:text-zinc-400">2</div>
              <div className="mt-2 w-px flex-1 bg-stone-200 dark:bg-zinc-800" />
            </div>
            <div className="space-y-5">
              <div>
                <h3 className="text-base font-semibold tracking-tight text-foreground">What does this payment cover?</h3>
                <p className="mt-0.5 text-xs text-stone-400">Taken from {primary ? `${primary.studentName}'s class` : "the student's class"}. The same purpose is recorded for every student on this receipt.</p>
              </div>
              <div className="max-w-md space-y-2 rounded-xl border border-stone-100 bg-stone-50/50 p-3 dark:border-zinc-800/50 dark:bg-zinc-900/20 sm:p-4">
                <Label className="flex items-center gap-1 text-xs font-semibold text-stone-700 dark:text-zinc-300">
                  <ArrowRight className="h-3 w-3 text-stone-400" /> Allocation
                </Label>
                <Combobox
                  items={allocationOptions}
                  value={allocationTarget}
                  onValueChange={(value) => setAllocationChoice(value ?? defaultAllocation)}
                >
                  <ComboboxInput
                    placeholder={primary ? "What this payment covers" : "Choose a student first"}
                    disabled={!primary}
                    className="h-11 w-full rounded-md border border-stone-200 bg-background px-3 text-sm outline-none dark:border-zinc-800 sm:h-9 sm:text-xs"
                  />
                  <ComboboxContent>
                    <ComboboxEmpty>No matching fee.</ComboboxEmpty>
                    <ComboboxList>
                      {(target) => (
                        <ComboboxItem key={target} value={target} className="text-xs">
                          {target}
                        </ComboboxItem>
                      )}
                    </ComboboxList>
                  </ComboboxContent>
                </Combobox>
              </div>
            </div>
          </div>

          <div className="relative pl-0 sm:pl-10">
            <div className="absolute left-0 top-0 hidden sm:flex">
              <div className="flex h-7 w-7 items-center justify-center rounded-full border border-stone-200 bg-background text-xs font-medium text-stone-500 dark:border-zinc-700 dark:text-zinc-400">3</div>
            </div>
            <div className="space-y-5">
              <div>
                <h3 className="flex items-center gap-1.5 text-base font-semibold tracking-tight text-foreground">
                  <History className="h-4 w-4 text-stone-400" /> Recent receipts
                </h3>
                <p className="mt-0.5 text-xs text-stone-400">Latest payments recorded at the counter, across every class.</p>
              </div>
              <div className="max-w-2xl space-y-2.5">
                {historyLoading ? (
                  <div className="space-y-2.5" aria-busy="true" aria-label="Loading receipts">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="rounded-xl border border-stone-200/60 bg-stone-50 p-3.5 dark:border-zinc-800/60 dark:bg-zinc-950">
                        <Skeleton className="h-4 w-40" />
                        <Skeleton className="mt-2 h-3 w-56" />
                      </div>
                    ))}
                  </div>
                ) : history.map((receipt) => {
                  const title = receipt.receiptName?.trim() || receipt.studentName
                  const shareLabel = (receipt.shares?.length ?? 0) > 1
                    ? receipt.shares!.map((share) => share.studentName).join(", ")
                    : null
                  return (
                    <article key={receipt.id} className="rounded-xl border border-stone-200/60 bg-stone-50 p-3.5 dark:border-zinc-800/60 dark:bg-zinc-950">
                      <div className="flex min-w-0 items-start gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-stone-200/50 dark:bg-zinc-800">
                          <CheckCircle className="h-4 w-4 text-stone-600 dark:text-zinc-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-sm font-semibold text-stone-900 dark:text-zinc-100 sm:text-xs">{title}</span>
                            <span className="rounded bg-stone-200 px-1.5 py-0.5 text-[10px] font-bold text-stone-700 dark:bg-zinc-800 dark:text-zinc-300">{receipt.receiptNumber}</span>
                            {!shareLabel && receipt.className ? (
                              <span className="text-[10px] font-semibold text-stone-500">{receipt.className}</span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-xs text-stone-500 sm:text-[11px]">
                            {shareLabel ? `Split: ${shareLabel} · ` : ""}
                            {receipt.allocationTarget} · {receipt.paymentMethod}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-3 border-t border-stone-200/70 pt-3 dark:border-zinc-800/70">
                        <div>
                          <span className="block text-sm font-bold text-stone-900 dark:text-zinc-50 sm:text-xs">₵{money(receipt.amountPaid)}</span>
                          <span className="block text-[11px] text-stone-400">
                            {new Date(receipt.dateProcessed).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          className="h-9 gap-1.5 px-3 text-xs sm:h-8"
                          onClick={() => {
                            printReceiptInPage(receipt.id).catch((err) => {
                              console.error("[Receipt Print Trigger Error]:", err)
                            })
                          }}
                        >
                          <Printer className="h-3.5 w-3.5" />
                          <span>Print A5</span>
                        </Button>
                      </div>
                    </article>
                  )
                })}
                {!historyLoading && history.length === 0 ? (
                  <p className="py-3 text-xs italic text-stone-400">No receipts recorded yet.</p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="sticky bottom-0 z-10 -mx-4 flex items-center border-t border-stone-200 bg-background/95 px-4 py-3 backdrop-blur dark:border-zinc-800 dark:bg-background/95 sm:static sm:mx-0 sm:justify-end sm:bg-transparent sm:px-0 sm:pb-0 sm:pt-5 sm:backdrop-blur-none">
            <Button
              type="submit"
              disabled={!canSubmit}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-stone-900 px-4 text-sm font-medium text-white hover:bg-stone-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-950 sm:h-9 sm:w-auto sm:text-xs"
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
