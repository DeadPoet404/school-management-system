"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, CheckCircle2, AlertCircle, ShieldAlert, ShieldCheck, MonitorSmartphone } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type FormState = "idle" | "submitting" | "success" | "error"

function StaffDepartureForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const fromSource = searchParams.get("from")

  const backConfig = {
    href: fromSource === "operations" ? "/operations" : "/staff",
    label: fromSource === "operations" ? "Back to Operations" : "Back to Staff Registry"
  }

  const [formState, setFormState] = React.useState<FormState>("idle")
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)

  // ── STEP 1: CORE IDENTIFIERS & TARGET ──
  const [staffId, setStaffId] = React.useState("")
  const [staffName, setStaffName] = React.useState("")
  const [departureType, setDepartureType] = React.useState("")
  const [effectiveDate, setEffectiveDate] = React.useState("")

  // ── STEP 2: CLEARANCE & DISPOSITION ──
  const [hrClearanceStatus, setHrClearanceStatus] = React.useState("")
  const [itAssetReturnStatus, setItAssetReturnStatus] = React.useState("")
  const [treasuryClearanceStatus, setTreasuryClearanceStatus] = React.useState("")
  const [departureRemarks, setDepartureRemarks] = React.useState("")

  const isSubmitting = formState === "submitting"

  // ── AUTO-POPULATE LIFECYCLE HOOK ──
  React.useEffect(() => {
    const urlId = searchParams.get("id")
    const urlName = searchParams.get("name")
    
    if (urlId) setStaffId(urlId.trim())
    if (urlName) setStaffName(urlName.trim())
  }, [searchParams])

  // ── STRUCTURAL UNIFIED PAYLOAD ASSEMBLY → REAL BACKEND ──
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setFormState("submitting")
    setErrorMessage(null)

    const sanitizedStaffId = staffId.replace(/\s+/g, "")

    const departurePayload = {
      staffId: sanitizedStaffId,
      departureType,
      effectiveDate,
      clearance: {
        hr: hrClearanceStatus,
        itAssets: itAssetReturnStatus,
        treasury: treasuryClearanceStatus,
      },
      remarks: departureRemarks.trim()
    }

    try {
      // Using relative path to utilize the Next.js proxy rewrite to port 5000
     const response = await fetch(fetchWithAuth("staff/departure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(departurePayload),
      })

      const rawText = await response.text()
      let json: any

      try {
        json = JSON.parse(rawText)
      } catch {
        throw new Error("Server returned an unstable body string instead of structured application/json data.")
      }

      if (!response.ok || !json.success) {
        throw new Error(json.message || json.error || `Excision execution failure: Status ${response.status}`)
      }

      setFormState("success")
    } catch (err: any) {
      setFormState("error")
      setErrorMessage(err?.message || "Critical failure trying to execute system access revocation routines.")
    }
  }

  // ── SUCCESS CONFIRMATION RENDER ──
  if (formState === "success") {
    return (
      <div className="w-full max-w-3xl flex flex-col overflow-hidden space-y-6 bg-transparent">
        <div className="flex flex-col gap-2 shrink-0">
          <Link
            href={backConfig.href}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-fit group"
          >
            <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
            {backConfig.label}
          </Link>
        </div>

        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <CheckCircle2 className="h-12 w-12 text-amber-600 animate-in fade-in zoom-in-95 duration-300" />
          <h2 className="text-2xl font-semibold text-foreground tracking-tight">Staff Access Revoked</h2>
          <p className="text-sm text-muted-foreground text-center max-w-md leading-relaxed">
            <span className="font-medium text-foreground">{staffName || "The staff member"}</span> has been offboarded from active operational matrices. Core payroll loops and system credentials have been archived safely under ID{" "}
            <span className="font-mono text-foreground bg-zinc-100 dark:bg-zinc-900 px-1.5 py-0.5 rounded text-xs">{staffId}</span>.
          </p>
          <div className="flex items-center gap-3 mt-4">
           <Button
  className="h-9 text-xs px-4 bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900"
  onClick={() => window.location.href = backConfig.href}
>
  Return to Staff Registry
</Button>
          </div>
        </div>
      </div>
    )
  }

  // ── STEP BADGE HELPER ──
  const StepBadge = ({ num, isLast }: { num: number; isLast?: boolean }) => (
    <div className="absolute left-0 top-0 flex flex-col items-center h-full">
      <div className="flex h-7 w-7 items-center justify-center rounded-full border border-stone-200 bg-background text-xs font-semibold text-stone-600 dark:border-stone-800 dark:text-stone-400 shadow-xs">
        {num}
      </div>
      {!isLast && <div className="w-[1px] flex-1 bg-stone-200 dark:bg-stone-800 mt-2" />}
    </div>
  )

  // ── MAIN FORM RENDER ──
  return (
    // Fixed: flex-1 min-h-0 prevents layout clipping of the bottom buttons
    <div className="w-full max-w-3xl flex flex-col flex-1 min-h-0 space-y-6 bg-transparent">
      <div className="flex flex-col gap-2 shrink-0">
        <Link 
          href={backConfig.href} 
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-fit group"
        >
          <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
          {backConfig.label}
        </Link>
        <div>
          <h1 className="text-3xl tracking-tight font-semibold text-foreground">Process Staff Departure</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Permanently decouple a staff account path from active institutional matrices, revoke system access, and archive payroll ledgers.
          </p>
        </div>
      </div>

      <hr className="border-stone-200 dark:border-stone-800 shrink-0" />

      {formState === "error" && errorMessage && (
        <div className="flex items-start gap-2 p-3 rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950 shrink-0">
          <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-300">{errorMessage}</p>
        </div>
      )}

      <div className="flex items-start gap-3 p-3 rounded-lg border border-amber-200 bg-amber-50/60 dark:border-amber-900/40 dark:bg-amber-950/20 shrink-0">
        <ShieldAlert className="h-4 w-4 text-amber-600 dark:text-amber-500 mt-0.5 shrink-0" />
        <div className="space-y-0.5">
          <h5 className="text-xs font-semibold text-amber-900 dark:text-amber-400">Irreversible Architectural System Action</h5>
          <p className="text-[11px] text-amber-800/80 dark:text-amber-500/80 leading-relaxed">
            Executing this pipeline state strips this staff instance from active payroll disbursement loops, deletes portal authentication credentials, and removes shift scheduling allocations.
          </p>
        </div>
      </div>

      {/* Fixed: flex-1 min-h-0 dynamically fills remaining space without clipping */}
      <ScrollArea className="flex-1 min-h-0 w-full rounded-none border-none shadow-none bg-transparent">
        <form onSubmit={handleSubmit} className="space-y-12 pr-4 pb-12 bg-transparent">

          {/* ═══════════════════════════════════════════════════════
              STEP 1: IDENTITY & TERMINATION TARGET
              ═══════════════════════════════════════════════════════ */}
          <div className="relative pl-10 group">
            <StepBadge num={1} />
            <div className="space-y-5">
              <h3 className="text-base font-semibold text-foreground tracking-tight">Staff Identity & Termination Target</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                <div className="space-y-1.5">
                  <Label htmlFor="staff-id" className="text-xs font-semibold text-foreground">
                    System Identifier Index ID <span className="text-red-500">*</span>
                  </Label>
                  <Input 
                    id="staff-id" 
                    placeholder="e.g. STF-FIN-123456" 
                    className="h-9 text-xs rounded-md bg-background border-stone-200 dark:border-stone-800 font-mono"
                    value={staffId}
                    onChange={(e) => setStaffId(e.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="staff-name" className="text-xs font-semibold text-foreground">
                    Confirm Staff Full Name <span className="text-red-500">*</span>
                  </Label>
                  <Input 
                    id="staff-name" 
                    placeholder="e.g. Samuel Osei Mensah" 
                    className="h-9 text-xs rounded-md bg-background border-stone-200 dark:border-stone-800"
                    value={staffName}
                    onChange={(e) => setStaffName(e.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                <div className="space-y-1.5">
                  <Label htmlFor="departure-type" className="text-xs font-semibold text-foreground">
                    Departure Structural Classification <span className="text-red-500">*</span>
                  </Label>
                  <Select value={departureType} onValueChange={setDepartureType} required disabled={isSubmitting}>
                    <SelectTrigger id="departure-type" className="h-9 text-xs rounded-md bg-background border-stone-200 dark:border-stone-800">
                      <SelectValue placeholder="Select exit category mapping..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="RESIGNATION" className="text-xs">Voluntary Resignation</SelectItem>
                      <SelectItem value="TERMINATION" className="text-xs">Administrative Termination / Dismissal</SelectItem>
                      <SelectItem value="RETIREMENT" className="text-xs">Official Statutory Retirement</SelectItem>
                      <SelectItem value="CONTRACT_END" className="text-xs">End of Contract Tenure</SelectItem>
                      <SelectItem value="OTHER" className="text-xs">Other / Custom Lifecycle Closure</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="effective-date" className="text-xs font-semibold text-foreground">
                    Official Effective Exit Date <span className="text-red-500">*</span>
                  </Label>
                  <Input 
                    id="effective-date" 
                    type="date" 
                    className="h-9 text-xs rounded-md bg-background border-stone-200 dark:border-stone-800"
                    value={effectiveDate}
                    onChange={(e) => setEffectiveDate(e.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════
              STEP 2: CLEARANCE & ASSET RECOVERY
              ═══════════════════════════════════════════════════════ */}
          <div className="relative pl-10 group">
            <StepBadge num={2} isLast />
            <div className="space-y-5">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-stone-500 dark:text-stone-400" />
                <h3 className="text-base font-semibold text-foreground tracking-tight">Institutional Clearance & Asset Recovery</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
                <div className="space-y-1.5">
                  <Label htmlFor="hr-clearance" className="text-xs font-semibold text-foreground">
                    HR & Admin Files <span className="text-red-500">*</span>
                  </Label>
                  <Select value={hrClearanceStatus} onValueChange={setHrClearanceStatus} required disabled={isSubmitting}>
                    <SelectTrigger id="hr-clearance" className="h-9 text-xs rounded-md bg-background border-stone-200 dark:border-stone-800">
                      <SelectValue placeholder="Check HR status..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="CLEARED" className="text-xs">Cleared / Files Handed Over</SelectItem>
                      <SelectItem value="PENDING" className="text-xs">Pending Exit Interview</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <MonitorSmartphone className="h-3 w-3 text-stone-400 dark:text-stone-500" />
                    <Label htmlFor="it-clearance" className="text-xs font-semibold text-foreground">
                      IT Assets <span className="text-red-500">*</span>
                    </Label>
                  </div>
                  <Select value={itAssetReturnStatus} onValueChange={setItAssetReturnStatus} required disabled={isSubmitting}>
                    <SelectTrigger id="it-clearance" className="h-9 text-xs rounded-md bg-background border-stone-200 dark:border-stone-800">
                      <SelectValue placeholder="Check asset status..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="RETURNED" className="text-xs">All Assets Returned</SelectItem>
                      <SelectItem value="LOST" className="text-xs">Lost / Damaged (Deduction Pending)</SelectItem>
                      <SelectItem value="N/A" className="text-xs">No Assets Assigned</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="treasury-clearance" className="text-xs font-semibold text-foreground">
                    Treasury & Payroll <span className="text-red-500">*</span>
                  </Label>
                  <Select value={treasuryClearanceStatus} onValueChange={setTreasuryClearanceStatus} required disabled={isSubmitting}>
                    <SelectTrigger id="treasury-clearance" className="h-9 text-xs rounded-md bg-background border-stone-200 dark:border-stone-800">
                      <SelectValue placeholder="Check ledger status..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FINAL_PAY_PROCESSED" className="text-xs">Final Salary Processed</SelectItem>
                      <SelectItem value="ADVANCE_DEDUCTED" className="text-xs">Outstanding Advances Deducted</SelectItem>
                      <SelectItem value="PENDING" className="text-xs">Payroll Hold Active</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="departure-reason" className="text-xs font-semibold text-foreground">
                  Official Exit Remarks & Regulatory Documentation Reasons <span className="text-red-500">*</span>
                </Label>
                <Textarea 
                  id="departure-reason" 
                  placeholder="State the permanent board records reasoning or formal document registry codes..." 
                  className="text-xs min-h-[100px] rounded-md bg-background border-stone-200 dark:border-stone-800 leading-relaxed"
                  value={departureRemarks}
                  onChange={(e) => setDepartureRemarks(e.target.value)}
                  required
                  disabled={isSubmitting}
                />
              </div>

              {/* FORM ACTIONS */}
              <div className="flex items-center justify-end gap-3 pt-5 border-t border-stone-200 dark:border-stone-800 bg-transparent">
                <Button variant="ghost" type="button" className="h-9 text-xs font-normal text-stone-500" asChild>
                  <Link href={backConfig.href}>Cancel Process</Link>
                </Button>
                <Button 
                  type="submit" 
                  className="h-9 text-xs font-medium px-4 bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 transition-colors"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Executing Access Revocation..." : "Commit Permanent Record Disconnection"}
                </Button>
              </div>
            </div>
          </div>

        </form>
      </ScrollArea>
    </div>
  )
}

export default function NewStaffDeparturePage() {
  return (
    <React.Suspense fallback={<div className="p-8 text-sm text-muted-foreground">Loading schema models...</div>}>
      <StaffDepartureForm />
    </React.Suspense>
  )
}