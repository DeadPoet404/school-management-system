"use client"

import * as React from "react"
import { useMemo, useState, useCallback, useEffect } from "react"
import { fetchWithAuth } from "@/lib/fetch-with-auth"
import { useClasses } from "@/lib/api/reference"
import { ClassTabStrip } from "@/components/class-tab-strip"
import { 
  Banknote, 
  Plus, 
  Trash2, 
  Calendar, 
  Receipt, 
  ShieldAlert, 
  CheckSquare,
  Loader2,
  Save,
  Zap
} from "lucide-react"
import { toast } from "sonner"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import { canonicalizeFeeName } from "@/lib/fee-names"

// --- TYPES & SCHEMA CONTRACTS ---
export interface FeeComponent {
  id: string
  name: string
  amount: string
  frequency: string
  isMandatory: boolean
}

export interface InvoicingControlConfig {
  issueDate: string
  dueDate: string
  allowInstallments: boolean
  lateFeeRate: string
}

export interface SectionFeeMatrix {
  components: FeeComponent[]
  billingConfig: InvoicingControlConfig
}

const FREQUENCY_OPTIONS = [
  "Per Term / Trimester",
  "Per Academic Year",
  "One-Time Admission Fee",
  "Monthly Optional Cycle",
] as const

// The three core fee rows (Admission Fee, School Uniform, Termly Tuition)
// carry FIXED canonical names matched by meaning — their inputs are locked
// and the labels always read the canonical form, whatever row they sit in.
// Any other row is a school-defined extra expense with a free-form name —
// and it feeds the payment-allocation options on the collection receipts.
function canonicalizeMatrix(matrix: Record<string, SectionFeeMatrix>): Record<string, SectionFeeMatrix> {
  const next: Record<string, SectionFeeMatrix> = {}
  for (const [sectionId, section] of Object.entries(matrix)) {
    next[sectionId] = {
      ...section,
      components: section.components.map((item) => {
        const fixed = canonicalizeFeeName(item.name)
        return fixed ? { ...item, name: fixed } : item
      }),
    }
  }
  return next
}

const EMPTY_FEE: SectionFeeMatrix = {
  components: [],
  billingConfig: { issueDate: "", dueDate: "", allowInstallments: true, lateFeeRate: "" },
}

interface FeeStructureInvoiceConfigProps {
  /**
   * Surfaces that already render a title and subtitle (the finance action
   * sheet) pass false so the module does not repeat them.
   */
  showIntro?: boolean
  /** Module name from the Operations shell — rendered on mobile only. */
  title?: string
}

export function FeeStructureInvoiceConfig({
  showIntro = true,
  title: moduleTitle,
}: FeeStructureInvoiceConfigProps) {
  const { data: classes = [], isLoading: classesLoading } = useClasses()
  const academicSections = useMemo(
    () => classes.filter((c) => c.isActive !== false).map((c) => ({ id: c.id, label: c.name })),
    [classes],
  )
  const [activeSection, setActiveSection] = useState<string>("")
  const [feeMatrixState, setFeeMatrixState] = useState<Record<string, SectionFeeMatrix>>({})
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isSaving, setIsSaving] = useState<boolean>(false)
  const [isGenerating, setIsGenerating] = useState<boolean>(false)

  useEffect(() => {
    if (academicSections.length === 0) return
    setActiveSection((current) => {
      if (current && academicSections.some((s) => s.id === current)) return current
      return academicSections[0]!.id
    })
    setFeeMatrixState((prev) => {
      const next = { ...prev }
      for (const s of academicSections) {
        if (!next[s.id]) {
          next[s.id] = {
            components: [],
            billingConfig: { issueDate: "", dueDate: "", allowInstallments: true, lateFeeRate: "" },
          }
        }
      }
      return next
    })
  }, [academicSections])

  useEffect(() => {
    const fetchFeeMatrixRegistry = async () => {
      try {
        setIsLoading(true)
        const response = await fetchWithAuth("/finance/fee-structures")
        const payload = await response.json()
        
        if (payload.success && payload.data && Object.keys(payload.data).length > 0) {
          setFeeMatrixState((prev) => ({ ...prev, ...canonicalizeMatrix(payload.data) }))
        }
      } catch (error) {
        console.error("[Fee Matrix Sync Error]:", error)
        toast.error("Network Error", { 
          description: "Could not sync data from database service. Using local fallback layers." 
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchFeeMatrixRegistry()
  }, [])

  const currentMatrix = useMemo(() => {
    return feeMatrixState[activeSection] || { components: [], billingConfig: { issueDate: "", dueDate: "", allowInstallments: true, lateFeeRate: "" } }
  }, [feeMatrixState, activeSection])

  const activeSectionLabel = useMemo(
    () => academicSections.find(s => s.id === activeSection)?.label || "",
    [activeSection, academicSections],
  )

  // --- ATOMIC MUTATION OPERATORS ---
  const addFeeComponent = useCallback(() => {
    const newId = `tmp_${Math.random().toString(36).substring(2, 9)}`
    setFeeMatrixState(prev => {
      const current = prev[activeSection] || { components: [], billingConfig: { issueDate: "", dueDate: "", allowInstallments: true, lateFeeRate: "" } }
      return {
        ...prev,
        [activeSection]: {
          ...current,
          components: [...current.components, { id: newId, name: "", amount: "", frequency: "Per Term / Trimester", isMandatory: true }]
        }
      }
    })
  }, [activeSection])

  const removeFeeComponent = useCallback((id: string) => {
    setFeeMatrixState(prev => {
      const current = prev[activeSection]
      if (!current) return prev
      return {
        ...prev,
        [activeSection]: {
          ...current,
          components: current.components.filter(item => item.id !== id)
        }
      }
    })
  }, [activeSection])

  const updateFeeComponent = useCallback((id: string, field: keyof FeeComponent, value: string | boolean) => {
    setFeeMatrixState(prev => {
      const current = prev[activeSection]
      if (!current) return prev
      return {
        ...prev,
        [activeSection]: {
          ...current,
          components: current.components.map(item => item.id === id ? { ...item, [field]: value } : item)
        }
      }
    })
  }, [activeSection])

  const updateBillingConfig = useCallback((field: keyof InvoicingControlConfig, value: string | boolean) => {
    setFeeMatrixState(prev => {
      const current = prev[activeSection]
      if (!current) return prev
      return {
        ...prev,
        [activeSection]: {
          ...current,
          billingConfig: { ...current.billingConfig, [field]: value }
        }
      }
    })
  }, [activeSection])

  const totalAccumulatedInvoiceAmount = useMemo(() => {
    return currentMatrix.components.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0)
  }, [currentMatrix])

  // --- SEPARATED ACTION HANDLERS ---
  const handleSaveMatrix = async () => {
    try {
      setIsSaving(true)
      const response = await fetchWithAuth("/finance/fee-structures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Rows 1-3 always save under their fixed canonical names.
        body: JSON.stringify({ data: canonicalizeMatrix(feeMatrixState) }),
      })
      
      const payload = await response.json()
      if (payload.success) {
        toast.success("Fee Architecture Saved", {
          description: "Billing rules successfully updated in the database.",
        })
      } else {
        toast.error("Save Interrupted", { description: payload.message })
      }
    } catch (error) {
      console.error("[Matrix Save Error]:", error)
      toast.error("Transmission Failure", { description: "Could not reach back-end service layers." })
    } finally {
      setIsSaving(false)
    }
  }

  const handleGenerateInvoices = async () => {
    try {
      setIsGenerating(true)
      const response = await fetchWithAuth("/finance/generate-invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sectionId: activeSection }),
      })
      
      const payload = await response.json()
      if (payload.success) {
        toast.success("Invoices Generated Successfully", {
          description: payload.message,
        })
      } else {
        toast.error("Generation Failed", { description: payload.message })
      }
    } catch (error) {
      console.error("[Invoice Gen Error]:", error)
      toast.error("Transmission Failure", { description: "Could not reach back-end service layers." })
    } finally {
      setIsGenerating(false)
    }
  }

  if (isLoading || classesLoading) {
    return (
      <div className="flex-1 h-full flex flex-col items-center justify-center bg-transparent gap-3 text-stone-500 dark:text-zinc-500">
        <Loader2 className="h-6 w-6 animate-spin text-stone-700 dark:text-zinc-400" />
        <span className="text-xs font-medium tracking-wide uppercase text-stone-400 dark:text-zinc-500">Syncing Financial Ledger Configurations...</span>
      </div>
    )
  }

  return (
  <main className="flex-1 h-full min-h-0 flex flex-col overflow-hidden bg-transparent px-8 py-6">
      
      {moduleTitle ? (
        <h1 className="text-xl tracking-tight font-semibold text-foreground capitalize sm:text-3xl md:hidden">
          {moduleTitle}
        </h1>
      ) : null}

      {showIntro ? (
        <div className="flex flex-col gap-2 shrink-0">
          <div className="hidden items-center gap-1.5 text-xs text-muted-foreground tracking-wide uppercase font-bold text-stone-400 sm:inline-flex dark:text-zinc-500">
            Core Finance Operations / Dynamic Revenue Generation Architect
          </div>

          <p className="hidden text-sm text-muted-foreground sm:mt-1 sm:block">
            Establish core billing structures, collection frequency matrices, and invoice issuance protocols grouped by grade block parameters.
          </p>
        </div>
      ) : null}

      {/* GRADED SECTION HUD MATRIX SELECTOR LINE */}
      <ClassTabStrip
        sections={academicSections}
        activeSection={activeSection}
        onSelect={setActiveSection}
        label="Select Institutional Grade Tier"
        className="max-w-5xl"
      />

      <hr className="border-stone-200 dark:border-zinc-800 shrink-0 mt-5 mb-6" />

      {/* Main Structural Layout Form Node Scroll Area */}
      <ScrollArea className="flex-1 min-h-0 w-full max-w-3xl rounded-none border-none shadow-none bg-transparent">
        <div className="space-y-12 pr-4 pb-12 bg-transparent">
          
          {/* STEP 1: FEE LINE ITEMS DESIGN SYSTEM GRID */}
          <div className="relative pl-10 group">
            <div className="absolute left-0 top-0 flex flex-col items-center h-full">
              <div className="flex h-7 w-7 items-center justify-center rounded-full border border-stone-200 dark:border-zinc-700 bg-background text-xs font-medium text-stone-500 dark:text-zinc-400">
                1
              </div>
              <div className="w-[1px] flex-1 bg-stone-200 dark:bg-zinc-800 mt-2" />
            </div>

            <div className="space-y-5">
              <div className="flex items-center justify-between max-w-2xl">
                <div>
                  <h3 className="text-base font-semibold text-foreground tracking-tight">
                    Fee Structure Cost Breakdown <span className="text-stone-400 font-normal text-xs">({activeSectionLabel})</span>
                  </h3>
                  <p className="text-xs text-stone-400 dark:text-zinc-500 mt-0.5">Map individual baseline accounting categories, line item targets, and collection cycles.</p>
                </div>
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={addFeeComponent}
                  className="h-8 text-[11px] font-medium border-stone-200 dark:border-zinc-800 gap-1 px-2.5"
                >
                  <Plus className="h-3 w-3" /> Add Fee Ledger Item
                </Button>
              </div>

              <div className="space-y-3 max-w-2xl">
                {currentMatrix.components.map((item) => {
                  const fixedName = canonicalizeFeeName(item.name)
                  return (
                  <div key={item.id} className="flex items-center gap-4 bg-stone-50/50 dark:bg-zinc-900/20 p-3 rounded-lg border border-stone-100/80 dark:border-zinc-800/50 group/fee">
                    
                    <div className="flex-[2] flex items-center gap-2">
                      <Receipt className="h-3.5 w-3.5 text-stone-400 dark:text-zinc-500 shrink-0" />
                      {fixedName ? (
                        // Core rows: fixed, non-editable names (matched by
                        // meaning, so row position never matters).
                        <div
                          className="h-8 flex-1 flex items-center rounded border border-stone-200 dark:border-zinc-800 bg-stone-100/70 dark:bg-zinc-800/60 px-2 text-xs font-semibold text-stone-600 dark:text-zinc-300 select-none"
                          title="Fixed fee name — Admission Fee, School Uniform and Termly Tuition are locked."
                        >
                          {fixedName}
                        </div>
                      ) : (
                        <Input
                          type="text"
                          value={item.name}
                          onChange={(e) => updateFeeComponent(item.id, "name", e.target.value)}
                          className="h-8 text-xs rounded border-stone-200 dark:border-zinc-800 font-medium bg-background px-2"
                          placeholder="e.g. Technology & Lab Fee"
                        />
                      )}
                    </div>
                    
                    <div className="flex-1 flex items-center gap-1.5">
                      <div className="relative w-full">
                        <span className="absolute left-2 top-2.5 text-[11px] font-bold leading-none text-stone-400 dark:text-zinc-500">GH₵</span>
                        <Input
                          type="number"
                          min="0"
                          value={item.amount}
                          onChange={(e) => updateFeeComponent(item.id, "amount", e.target.value)}
                          className="h-8 text-xs pl-6 rounded border-stone-200 dark:border-zinc-800 font-medium bg-background"
                          placeholder="0.00"
                        />
                      </div>
                    </div>

                    <div className="flex-[1.5] min-w-0">
                      <Combobox 
                        value={item.frequency}
                        onValueChange={(val) => updateFeeComponent(item.id, "frequency", val ?? "")}
                      >
                        <ComboboxInput 
                          placeholder="Select Frequency" 
                          className="h-8 text-xs w-full rounded border border-stone-200 dark:border-zinc-800 bg-background px-2 outline-none" 
                        />
                        <ComboboxContent>
                          <ComboboxEmpty>No tracking matches.</ComboboxEmpty>
                          <ComboboxList>
                            {FREQUENCY_OPTIONS.map((frequency) => (
                              <ComboboxItem key={frequency} value={frequency} className="text-xs">
                                {frequency}
                              </ComboboxItem>
                            ))}
                          </ComboboxList>
                        </ComboboxContent>
                      </Combobox>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 select-none">
                      <Checkbox 
                        id={`mandatory-${item.id}`}
                        checked={item.isMandatory}
                        onCheckedChange={(checked) => updateFeeComponent(item.id, "isMandatory", !!checked)}
                      />
                      <label htmlFor={`mandatory-${item.id}`} className="text-[10px] font-semibold text-stone-500 dark:text-zinc-400 cursor-pointer uppercase tracking-wider">
                        Required
                      </label>
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => removeFeeComponent(item.id)}
                      className="h-8 w-8 p-0 text-stone-400 dark:text-zinc-500 hover:text-red-600 dark:hover:text-red-400 rounded opacity-100 md:opacity-0 group-hover/fee:opacity-100 transition-opacity"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  )
                })}
                
                {currentMatrix.components.length === 0 && (
                  <p className="text-xs text-stone-400 dark:text-zinc-500 italic">No structured fee items mapped to this grade block. Click Add Entry above.</p>
                )}
              </div>
            </div>
          </div>

          {/* STEP 2: INVOICING PARAMETRIC AUTOMATIONS & CONTROLS */}
          <div className="relative pl-10 group">
            <div className="absolute left-0 top-0 flex flex-col items-center h-full">
              <div className="flex h-7 w-7 items-center justify-center rounded-full border border-stone-200 dark:border-zinc-700 bg-background text-xs font-medium text-stone-500 dark:text-zinc-400">
                2
              </div>
              <div className="w-[1px] flex-1 bg-stone-200 dark:bg-zinc-800 mt-2" />
            </div>

            <div className="space-y-5">
              <div>
                <h3 className="text-base font-semibold text-foreground tracking-tight">
                  Invoicing Schedule & Control Variables
                </h3>
                <p className="text-xs text-stone-400 dark:text-zinc-500 mt-0.5">Define timeline dispatch limits, late penalties, and split payment authorization parameters.</p>
              </div>

              <div className="grid grid-cols-2 gap-4 max-w-2xl bg-stone-50/30 dark:bg-zinc-900/20 p-4 rounded-xl border border-stone-100 dark:border-zinc-800/50">
                <div className="space-y-1.5">
                  <Label htmlFor="issue-date" className="text-xs font-semibold text-stone-700 dark:text-zinc-300 flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-stone-400 dark:text-zinc-500" /> Invoice Issuance Date
                  </Label>
                  <Input 
                    id="issue-date"
                    type="date"
                    value={currentMatrix.billingConfig.issueDate}
                    onChange={(e) => updateBillingConfig("issueDate", e.target.value)}
                    className="h-9 text-xs rounded-md border-stone-200 dark:border-zinc-800"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="due-date" className="text-xs font-semibold text-stone-700 dark:text-zinc-300 flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-stone-400 dark:text-zinc-500" /> Maturity Settlement Deadline
                  </Label>
                  <Input 
                    id="due-date"
                    type="date"
                    value={currentMatrix.billingConfig.dueDate}
                    onChange={(e) => updateBillingConfig("dueDate", e.target.value)}
                    className="h-9 text-xs rounded-md border-stone-200 dark:border-zinc-800"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="late-fee" className="text-xs font-semibold text-stone-700 dark:text-zinc-300 flex items-center gap-1">
                    <ShieldAlert className="h-3 w-3 text-stone-400 dark:text-zinc-500" /> Late Penalty Action Rate (%)
                  </Label>
                  <Input 
                    id="late-fee"
                    type="number"
                    min="0"
                    value={currentMatrix.billingConfig.lateFeeRate}
                    onChange={(e) => updateBillingConfig("lateFeeRate", e.target.value)}
                    placeholder="e.g. 5"
                    className="h-9 text-xs rounded-md border-stone-200 dark:border-zinc-800"
                  />
                </div>

                <div className="flex items-center gap-2 pt-6 pl-1 select-none">
                  <Checkbox 
                    id="allow-installments" 
                    checked={currentMatrix.billingConfig.allowInstallments}
                    onCheckedChange={(checked) => updateBillingConfig("allowInstallments", !!checked)}
                  />
                  <div className="grid gap-0.5 leading-none">
                    <Label htmlFor="allow-installments" className="text-xs font-semibold text-stone-700 dark:text-zinc-300 cursor-pointer">
                      Authorize Installment Tranches
                    </Label>
                    <p className="text-[10px] text-stone-400 dark:text-zinc-500">Allows parents to settle balances incrementally across the cycle timeline.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* STEP 3: CONSOLIDATED VALUATION RUNTIME TELEMETRY & ACTIONS */}
          <div className="relative pl-10 group">
            <div className="absolute left-0 top-0 flex flex-col items-center h-full">
              <div className="flex h-7 w-7 items-center justify-center rounded-full border border-stone-200 dark:border-zinc-700 bg-background text-xs font-medium text-stone-500 dark:text-zinc-400">
                3
              </div>
            </div>

            <div className="space-y-6 max-w-2xl">
              <div className="bg-stone-900 dark:bg-zinc-900 text-stone-100 p-4 rounded-xl shadow-none">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-widest text-stone-400 flex items-center gap-1.5">
                      <CheckSquare className="h-3 w-3" /> Runtime Viewport Summary
                    </h4>
                    <p className="text-[11px] text-stone-400 mt-0.5">
                      Target Profile: {activeSectionLabel} Cohort Distribution Ledger.
                    </p>
                  </div>
                  
                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-stone-400 tracking-wider block">Aggregate Bill Amount</span>
                    <span className="text-2xl tracking-tight font-semibold text-white">GH₵{totalAccumulatedInvoiceAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                  </div>
                </div>

                <div className="border-t border-stone-800 pt-3 flex items-center justify-between text-[11px] text-stone-400">
                  <span>Active Components: <strong className="text-stone-200">{currentMatrix.components.length} items</strong></span>
                  <span>Late Terms: <strong className="text-stone-200">{currentMatrix.billingConfig.lateFeeRate || "0"}% flat overhead</strong></span>
                  <span>Installments: <strong className="text-stone-200">{currentMatrix.billingConfig.allowInstallments ? "Permitted" : "Restricted"}</strong></span>
                </div>
              </div>

              {/* Split Action Buttons */}
              <div className="flex items-center justify-end gap-3 pt-1">
                <Button 
                  type="button" 
                  disabled={isSaving}
                  onClick={handleSaveMatrix}
                  className="h-9 text-xs font-medium px-4 border border-stone-600 dark:border-zinc-600 text-stone-200 dark:text-zinc-300 hover:bg-stone-800 dark:hover:bg-zinc-700 rounded-lg flex items-center gap-2 justify-center"
                >
                  {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Save Fee Structure
                </Button>
                
                <Button 
                  type="button" 
                  disabled={isGenerating}
                  onClick={handleGenerateInvoices}
                  className="h-9 text-xs font-medium px-4 bg-white text-stone-900 hover:bg-stone-100 rounded-lg flex items-center gap-2 min-w-[260px] justify-center shadow-sm border border-stone-200 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200 dark:border-zinc-700"
                >
                  {isGenerating ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Generating Invoices...
                    </>
                  ) : (
                    <>
                      <Zap className="h-3.5 w-3.5" />
                      Generate Invoices for {activeSectionLabel}
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>

        </div>
      </ScrollArea>
    </main>
  )
}