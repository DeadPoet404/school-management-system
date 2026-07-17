"use client"

import * as React from "react"
import { useMemo, useState, useCallback, useEffect } from "react"
import { fetchWithAuth } from "@/lib/fetch-with-auth"
import { 
  DollarSign, 
  Plus, 
  Trash2, 
  Layers, 
  Calendar, 
  Receipt, 
  ShieldAlert, 
  CheckSquare,
  Loader2,
  Save,
  Zap
} from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
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

const FREQUENCY_OPTIONS = [
  "Per Term / Trimester",
  "Per Academic Year",
  "One-Time Admission Fee",
  "Monthly Optional Cycle"
] as const

const INITIAL_FEE_MATRIX: Record<string, SectionFeeMatrix> = {
  "pre-school": {
    components: [
      { id: "ps-f1", name: "Tuition Baseline", amount: "1200", frequency: "Per Term / Trimester", isMandatory: true },
      { id: "ps-f2", name: "Midday Catering & Snacks", amount: "450", frequency: "Per Term / Trimester", isMandatory: true }
    ],
    billingConfig: { issueDate: "2026-09-01", dueDate: "2026-09-30", allowInstallments: true, lateFeeRate: "5" }
  },
  "nursery-1": { components: [{ id: "n1-f1", name: "Tuition Baseline", amount: "1200", frequency: "Per Term / Trimester", isMandatory: true }], billingConfig: { issueDate: "2026-09-01", dueDate: "2026-09-30", allowInstallments: true, lateFeeRate: "5" } },
  "nursery-2": { components: [{ id: "n2-f1", name: "Tuition Baseline", amount: "1200", frequency: "Per Term / Trimester", isMandatory: true }], billingConfig: { issueDate: "2026-09-01", dueDate: "2026-09-30", allowInstallments: true, lateFeeRate: "5" } },
  "kindergarten-1": { components: [{ id: "kg1-f1", name: "Tuition Baseline", amount: "1400", frequency: "Per Term / Trimester", isMandatory: true }, { id: "kg1-f2", name: "Stationery Kit Pack", amount: "150", frequency: "Per Academic Year", isMandatory: true }], billingConfig: { issueDate: "2026-09-01", dueDate: "2026-09-30", allowInstallments: true, lateFeeRate: "5" } },
  "kindergarten-2": { components: [{ id: "kg2-f1", name: "Tuition Baseline", amount: "1400", frequency: "Per Term / Trimester", isMandatory: true }], billingConfig: { issueDate: "2026-09-01", dueDate: "2026-09-30", allowInstallments: true, lateFeeRate: "5" } },
  "grade-1": { components: [{ id: "g1-f1", name: "Primary Tuition Base", amount: "1800", frequency: "Per Term / Trimester", isMandatory: true }, { id: "g1-f2", name: "Computer Laboratory Access", amount: "200", frequency: "Per Academic Year", isMandatory: true }], billingConfig: { issueDate: "2026-09-01", dueDate: "2026-09-30", allowInstallments: true, lateFeeRate: "10" } },
  "grade-2": { components: [{ id: "g2-f1", name: "Primary Tuition Base", amount: "1800", frequency: "Per Term / Trimester", isMandatory: true }], billingConfig: { issueDate: "2026-09-01", dueDate: "2026-09-30", allowInstallments: true, lateFeeRate: "10" } },
  "grade-3": { components: [{ id: "g3-f1", name: "Primary Tuition Base", amount: "1800", frequency: "Per Term / Trimester", isMandatory: true }], billingConfig: { issueDate: "2026-09-01", dueDate: "2026-09-30", allowInstallments: true, lateFeeRate: "10" } },
  "grade-4": { components: [{ id: "g4-f1", name: "Primary Tuition Base", amount: "1950", frequency: "Per Term / Trimester", isMandatory: true }], billingConfig: { issueDate: "2026-09-01", dueDate: "2026-09-30", allowInstallments: true, lateFeeRate: "10" } },
  "grade-5": { components: [{ id: "g5-f1", name: "Primary Tuition Base", amount: "1950", frequency: "Per Term / Trimester", isMandatory: true }], billingConfig: { issueDate: "2026-09-01", dueDate: "2026-09-30", allowInstallments: true, lateFeeRate: "10" } },
  "grade-6": { components: [{ id: "g6-f1", name: "Primary Tuition Base", amount: "1950", frequency: "Per Term / Trimester", isMandatory: true }], billingConfig: { issueDate: "2026-09-01", dueDate: "2026-09-30", allowInstallments: true, lateFeeRate: "10" } },
  "jhs-1": { components: [{ id: "j1-f1", name: "JHS Tuition Core", amount: "2400", frequency: "Per Term / Trimester", isMandatory: true }, { id: "j1-f2", name: "Science Lab Equipment Levy", amount: "350", frequency: "Per Academic Year", isMandatory: true }], billingConfig: { issueDate: "2026-09-01", dueDate: "2026-09-30", allowInstallments: false, lateFeeRate: "15" } },
  "jhs-2": { components: [{ id: "j2-f1", name: "JHS Tuition Core", amount: "2400", frequency: "Per Term / Trimester", isMandatory: true }], billingConfig: { issueDate: "2026-09-01", dueDate: "2026-09-30", allowInstallments: false, lateFeeRate: "15" } },
  "jhs-3": { components: [{ id: "j3-f1", name: "JHS Tuition Core", amount: "2600", frequency: "Per Term / Trimester", isMandatory: true }], billingConfig: { issueDate: "2026-09-01", dueDate: "2026-09-30", allowInstallments: false, lateFeeRate: "15" } },
}

export function FeeStructureInvoiceConfig() {
  const [activeSection, setActiveSection] = useState<string>("jhs-1")
  const [feeMatrixState, setFeeMatrixState] = useState<Record<string, SectionFeeMatrix>>(INITIAL_FEE_MATRIX)
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [isSaving, setIsSaving] = useState<boolean>(false)
  const [isGenerating, setIsGenerating] = useState<boolean>(false)

  useEffect(() => {
    const fetchFeeMatrixRegistry = async () => {
      try {
        setIsLoading(true)
        const response = await fetchWithAuth("/finance/fee-structures")
        const payload = await response.json()
        
        if (payload.success && payload.data && Object.keys(payload.data).length > 0) {
          setFeeMatrixState(payload.data)
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

  const lowerAcademicTier = useMemo(() => ACADEMIC_SECTIONS.slice(0, 7), [])
  const upperAcademicTier = useMemo(() => ACADEMIC_SECTIONS.slice(7), [])
  const activeSectionLabel = useMemo(() => ACADEMIC_SECTIONS.find(s => s.id === activeSection)?.label || "", [activeSection])

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
        body: JSON.stringify({ data: feeMatrixState }),
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

  if (isLoading) {
    return (
      <div className="flex-1 h-full flex flex-col items-center justify-center bg-transparent gap-3 text-stone-500 dark:text-zinc-500">
        <Loader2 className="h-6 w-6 animate-spin text-stone-700 dark:text-zinc-400" />
        <span className="text-xs font-medium tracking-wide uppercase text-stone-400 dark:text-zinc-500">Syncing Financial Ledger Configurations...</span>
      </div>
    )
  }

  return (
    <main className="flex-1 h-full flex flex-col bg-transparent px-8 py-6 overflow-hidden">
      
      {/* Structural Header Block */}
      <div className="flex flex-col gap-2 shrink-0">
        <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground tracking-wide uppercase font-bold text-stone-400 dark:text-zinc-500">
          Core Finance Operations / Dynamic Revenue Generation Architect
        </div>
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl tracking-tight font-semibold text-foreground capitalize">
              Fee Structures & Invoicing Setup
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Establish core billing structures, collection frequency matrices, and invoice issuance protocols grouped by grade block parameters.
            </p>
          </div>
        </div>
      </div>

      {/* GRADED SECTION HUD MATRIX SELECTOR LINE */}
      <div className="mt-5 shrink-0 flex flex-col gap-1.5 max-w-3xl">
        <Label className="text-[11px] font-bold text-stone-400 dark:text-zinc-500 uppercase tracking-wider flex items-center gap-1">
          <Layers className="h-3 w-3" /> Select Institutional Grade Tier
        </Label>
        
        <div className="w-full flex flex-col gap-2.5">
          {/* Lower Tier Group */}
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
                      : "text-stone-500 dark:text-zinc-400 hover:text-stone-800 dark:hover:text-zinc-200 hover:bg-stone-50/60 dark:hover:bg-zinc-900/20"
                  )}
                >
                  {section.label}
                </button>
                {idx < lowerAcademicTier.length - 1 && (
                  <div className="h-3 w-[1px] bg-stone-300 dark:bg-zinc-700 shrink-0 mx-0.5" />
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Upper Tier Group */}
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
                      : "text-stone-500 dark:text-zinc-400 hover:text-stone-800 dark:hover:text-zinc-200 hover:bg-stone-50/60 dark:hover:bg-zinc-900/20"
                  )}
                >
                  {section.label}
                </button>
                {idx < upperAcademicTier.length - 1 && (
                  <div className="h-3 w-[1px] bg-stone-300 dark:bg-zinc-700 shrink-0 mx-0.5" />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>

      <hr className="border-stone-200 dark:border-zinc-800 shrink-0 mt-5 mb-6" />

      {/* Main Structural Layout Form Node Scroll Area */}
      <ScrollArea className="flex-1 w-full max-w-3xl rounded-none border-none shadow-none bg-transparent">
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
                {currentMatrix.components.map((item) => (
                  <div key={item.id} className="flex items-center gap-4 bg-stone-50/50 dark:bg-zinc-900/20 p-3 rounded-lg border border-stone-100/80 dark:border-zinc-800/50 group/fee">
                    
                    <div className="flex-[2] flex items-center gap-2">
                      <Receipt className="h-3.5 w-3.5 text-stone-400 dark:text-zinc-500 shrink-0" />
                      <Input
                        type="text"
                        value={item.name}
                        onChange={(e) => updateFeeComponent(item.id, "name", e.target.value)}
                        className="h-8 text-xs rounded border-stone-200 dark:border-zinc-800 font-medium bg-background px-2"
                        placeholder="e.g. Technology & Lab Fee"
                      />
                    </div>
                    
                    <div className="flex-1 flex items-center gap-1.5">
                      <div className="relative w-full">
                        <DollarSign className="absolute left-2 top-2.5 h-3 w-3 text-stone-400 dark:text-zinc-500" />
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
                ))}
                
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
                    <span className="text-2xl tracking-tight font-semibold text-white">${totalAccumulatedInvoiceAmount.toFixed(2)}</span>
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