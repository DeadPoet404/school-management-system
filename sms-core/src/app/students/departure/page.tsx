"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, CheckCircle2, AlertCircle, ShieldAlert } from "lucide-react"
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
import { fetchWithAuth } from "@/lib/fetch-with-auth"

type FormState = "idle" | "submitting" | "success" | "error"

function StudentDepartureForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const fromSource = searchParams.get("from")

  const backConfig = {
    href: fromSource === "dashboard" ? "/dashboard" : "/students",
    label: fromSource === "dashboard" ? "Back to Dashboard" : "Back to Student Register"
  }

  const [formState, setFormState] = React.useState<FormState>("idle")
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)

  const [studentId, setStudentId] = React.useState("")
  const [studentName, setStudentName] = React.useState("")
  const [departureType, setDepartureType] = React.useState("")
  const [effectiveDate, setEffectiveDate] = React.useState("")

  const [destinationInstitution, setDestinationInstitution] = React.useState("")
  const [treasuryClearanceStatus, setTreasuryClearanceStatus] = React.useState("")
  const [academicRecordsArchived, setAcademicRecordsArchived] = React.useState("")
  const [departureRemarks, setDepartureRemarks] = React.useState("")

  const isSubmitting = formState === "submitting"

  React.useEffect(() => {
    const urlId = searchParams.get("id")
    const urlName = searchParams.get("name")

    if (urlId) setStudentId(urlId.trim())
    if (urlName) setStudentName(urlName.trim())
  }, [searchParams])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setFormState("submitting")
    setErrorMessage(null)

    const sanitizedStudentId = studentId.replace(/\s+/g, "")

    const departurePayload = {
      studentId: sanitizedStudentId,
      studentName: studentName.trim(),
      departureType,
      effectiveDate,
      disposition: {
        destinationInstitution: destinationInstitution.trim() || "N/A",
        treasuryClearanceStatus,
        academicRecordsArchived: academicRecordsArchived === "YES",
      },
      remarks: departureRemarks.trim()
    }

    try {
      const response = await fetchWithAuth("students/departure", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(departurePayload),
      })

      const rawText = await response.text()
      let json: unknown

      try {
        json = JSON.parse(rawText)
      } catch {
        throw new Error("Server returned an unparsable non-JSON structural payload error.")
      }

      if (!response.ok || !(json as Record<string, unknown>).success) {
        const errorData = json as Record<string, unknown>
        throw new Error(
          (errorData.message as string) ||
          `Excision execution processing failure: Status ${response.status}`
        )
      }

      setFormState("success")
    } catch (err: unknown) {
      setFormState("error")
      setErrorMessage(
        (err as Error)?.message || "Critical failure trying to execute system ledger erasure routines."
      )
    }
  }

  if (formState === "success") {
    return (
      <div className="w-full max-w-3xl flex flex-col overflow-hidden space-y-6 bg-transparent">
        <div className="flex flex-col gap-2 shrink-0">
          <Link href={backConfig.href} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-fit group">
            <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
            {backConfig.label}
          </Link>
        </div>

        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <CheckCircle2 className="h-12 w-12 text-amber-600 animate-in fade-in zoom-in-95 duration-300" />
          <h2 className="text-2xl font-semibold text-foreground tracking-tight">Student Record Deactivated</h2>
          <p className="text-sm text-muted-foreground text-center max-w-md leading-relaxed">
            <span className="font-medium text-foreground">{studentName || "The student"}</span> has been offboarded from active cohorts.
          </p>
          <div className="flex items-center gap-3 mt-4">
            <Button
              className="h-9 text-xs px-4 bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900"
              onClick={() => window.location.href = backConfig.href}
            >
              Return to Register
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-3xl flex flex-col flex-1 min-h-0 space-y-6 bg-transparent">

      <div className="flex flex-col gap-2 shrink-0">
        <Link href={backConfig.href} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-fit group">
          <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
          {backConfig.label}
        </Link>

        <div>
          <h1 className="text-3xl tracking-tight font-semibold text-foreground">Process Student Departure</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Permanently decouple a student account path from active institutional matrices and archive historical records.
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
            Executing this pipeline state strips this student instance from current attendance modules, active course rosters, and current billing loops.
          </p>
        </div>
      </div>

      <ScrollArea className="flex-1 min-h-0 w-full rounded-none border-none shadow-none bg-transparent">
        <form onSubmit={handleSubmit} className="space-y-12 pr-4 pb-24 bg-transparent">

          {/* STEP 1: CORE RECORD DESTRUCTION PARAMETERS */}
          <div className="relative pl-10 group">
            <div className="absolute left-0 top-0 flex flex-col items-center h-full">
              <div className="flex h-7 w-7 items-center justify-center rounded-full border border-stone-200 bg-background text-xs font-semibold text-stone-600 dark:border-stone-800 dark:text-stone-400 shadow-xs">1</div>
              <div className="w-[1px] flex-1 bg-stone-200 dark:bg-stone-800 mt-2" />
            </div>

            <div className="space-y-5">
              <h3 className="text-base font-semibold text-foreground tracking-tight">Student Identity & Departure Target</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                <div className="space-y-1.5">
                  <Label htmlFor="student-id" className="text-xs font-semibold text-foreground">System Identifier Index ID <span className="text-red-500">*</span></Label>
                  <Input id="student-id" placeholder="e.g. STU-10294" className="h-9 text-xs rounded-md bg-background border-stone-200 dark:border-stone-800 font-mono" value={studentId} onChange={(e) => setStudentId(e.target.value)} required disabled={isSubmitting} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="student-name" className="text-xs font-semibold text-foreground">Confirm Student Full Name <span className="text-red-500">*</span></Label>
                  <Input id="student-name" placeholder="e.g. Kwame Mensah Bonsu" className="h-9 text-xs rounded-md bg-background border-stone-200 dark:border-stone-800" value={studentName} onChange={(e) => setStudentName(e.target.value)} required disabled={isSubmitting} />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                <div className="space-y-1.5">
                  <Label htmlFor="departure-type" className="text-xs font-semibold text-foreground">Departure Structural Classification <span className="text-red-500">*</span></Label>
                  <Select value={departureType} onValueChange={setDepartureType} required disabled={isSubmitting}>
                    <SelectTrigger id="departure-type" className="h-9 text-xs rounded-md bg-background border-stone-200 dark:border-stone-800"><SelectValue placeholder="Select exit category mapping..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GRADUATION" className="text-xs">Official Alumnus Graduation</SelectItem>
                      <SelectItem value="TRANSFER" className="text-xs">Institutional Transfer Outward</SelectItem>
                      <SelectItem value="VOLUNTARY_WITHDRAWAL" className="text-xs">Voluntary Complete Withdrawal</SelectItem>
                      <SelectItem value="EXPULSION" className="text-xs">Administrative Expulsion / De-registration</SelectItem>
                      <SelectItem value="OTHER" className="text-xs">Other / Custom Lifecycle Closure</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="effective-date" className="text-xs font-semibold text-foreground">Official Effective Exit Date <span className="text-red-500">*</span></Label>
                  <Input id="effective-date" type="date" className="h-9 text-xs rounded-md bg-background border-stone-200 dark:border-stone-800" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} required disabled={isSubmitting} />
                </div>
              </div>
            </div>
          </div>

          {/* STEP 2: CLEARANCE & ARCHIVAL DESTINATION */}
          <div className="relative pl-10 group">
            <div className="absolute left-0 top-0 flex flex-col items-center h-full">
              <div className="flex h-7 w-7 items-center justify-center rounded-full border border-stone-200 bg-background text-xs font-semibold text-stone-600 dark:border-stone-800 dark:text-stone-400 shadow-xs">2</div>
            </div>

            <div className="space-y-5">
              <h3 className="text-base font-semibold text-foreground tracking-tight">Administrative Clearance Statuses & Archives</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
                <div className="space-y-1.5">
                  <Label htmlFor="treasury-status" className="text-xs font-semibold text-foreground">Treasury & Fees Clearing Status <span className="text-red-500">*</span></Label>
                  <Select value={treasuryClearanceStatus} onValueChange={setTreasuryClearanceStatus} required disabled={isSubmitting}>
                    <SelectTrigger id="treasury-status" className="h-9 text-xs rounded-md bg-background border-stone-200 dark:border-stone-800"><SelectValue placeholder="Check ledger balances status..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FULLY_SETTLED" className="text-xs">Cleared / Arrears Zeroed Out</SelectItem>
                      <SelectItem value="OUTSTANDING_DEBT" className="text-xs">Arrears Pending (Retain Collections Tracking)</SelectItem>
                      <SelectItem value="WRITTEN_OFF" className="text-xs">Bad Debt Written Off by Board</SelectItem>
                      <SelectItem value="EXEMPT" className="text-xs">Fully Exempt Allocation</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="archive-status" className="text-xs font-semibold text-foreground">Academic Records Archival Commit <span className="text-red-500">*</span></Label>
                  <Select value={academicRecordsArchived} onValueChange={setAcademicRecordsArchived} required disabled={isSubmitting}>
                    <SelectTrigger id="archive-status" className="h-9 text-xs rounded-md bg-background border-stone-200 dark:border-stone-800"><SelectValue placeholder="Commit permanent dossier index?" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="YES" className="text-xs">Yes — Safe Archive Final Transcripts</SelectItem>
                      <SelectItem value="NO" className="text-xs">No — Retain Pending Grading Audits</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="destination" className="text-xs font-semibold text-foreground">Destination Institution / Future Placement <span className="text-stone-400 text-[10px]">(Optional)</span></Label>
                <Input id="destination" placeholder="e.g. Transferring to secondary institution or workforce pipeline..." className="h-9 text-xs rounded-md bg-background border-stone-200 dark:border-stone-800" value={destinationInstitution} onChange={(e) => setDestinationInstitution(e.target.value)} disabled={isSubmitting} />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="departure-reason" className="text-xs font-semibold text-foreground">Official Exit Remarks & Regulatory Documentation Reasons <span className="text-red-500">*</span></Label>
                <Textarea id="departure-reason" placeholder="State the permanent board records reasoning or formal document registry codes..." className="text-xs min-h-[100px] rounded-md bg-background border-stone-200 dark:border-stone-800 leading-relaxed" value={departureRemarks} onChange={(e) => setDepartureRemarks(e.target.value)} required disabled={isSubmitting} />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-5 border-t border-stone-200 dark:border-stone-800 bg-transparent">
            <Button variant="ghost" type="button" className="h-9 text-xs font-normal text-stone-500" asChild>
              <Link href={backConfig.href}>Cancel Process</Link>
            </Button>
            <Button
              type="submit"
              className="h-9 text-xs font-medium px-4 bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 transition-colors"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Executing Excision Invalidation..." : "Commit Permanent Record Disconnection"}
            </Button>
          </div>

        </form>
      </ScrollArea>
    </div>
  )
}

export default function NewStudentDeparturePage() {
  return (
    <React.Suspense fallback={<div className="p-8 text-sm text-muted-foreground">Loading schema models...</div>}>
      <StudentDepartureForm />
    </React.Suspense>
  )
}