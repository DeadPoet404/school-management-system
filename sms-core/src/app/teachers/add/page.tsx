"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, CheckCircle2, AlertCircle, Pencil, Lock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { fetchWithAuth } from "@/lib/fetch-with-auth"
import type { ReferenceDepartment } from "@/lib/api/reference"
import { useDepartments } from "@/lib/api/reference"

type FormState = "idle" | "submitting" | "success" | "error"

type DepartmentOption = ReferenceDepartment

interface ClearanceOption {
  id: string
  name: string
  description: string
}

const MOCK_TEACHER_CLEARANCE_LEVELS: ClearanceOption[] = [
  { id: "clear-tch", name: "Level 1: Standard Faculty Access", description: "Roster management, gradebook entries, and basic student tracking portals" },
  { id: "clear-hod", name: "Level 2: Department Head / Lead Educator", description: "Curriculum configuration controls, multi-class overrides, and academic performance telemetry" },
  { id: "clear-adm", name: "Level 3: Full Academic Super-Admin", description: "Unrestricted systemic manipulation, cross-department scheduling controls, and institution-wide registry management" },
]

/**
 * Same auto-generation as students/add and staff/add:
 * "Prof. Emmanuel Kwame" -> emmanuel.kwame@jocomfy.com
 */
function generatePortalEmail(fullName: string): string {
  const parts = fullName
    .trim()
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter((p) => p.length > 0)
  if (parts.length === 0) return ""
  const local = parts.length === 1 ? parts[0]! : `${parts[0]}.${parts[parts.length - 1]!}`
  return `${local}@jocomfy.com`
}

function generateTemporaryToken(): string {
  const alphabet = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    const bytes = crypto.getRandomValues(new Uint8Array(10))
    let secret = ""
    for (let i = 0; i < bytes.length; i += 1) {
      secret += alphabet[bytes[i]! % alphabet.length]
    }
    return `JCS-${secret}`
  }
  return `JCS-${Math.random().toString(36).slice(2, 12)}`
}

function ComprehensiveTeacherEnrollmentWizard() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const fromSource = searchParams.get("from")

  const backConfig = {
    href: fromSource === "academic" ? "/academic" : "/teachers",
    label: fromSource === "academic" ? "Back to Academic Management" : "Back to Teacher Registry"
  }

  const [formState, setFormState] = React.useState<FormState>("idle")
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)

  // ── STEP 1: AUTHENTICATION & CORE IDENTITY MATRIX (AUTO-GENERATED) ──
  // Auto-generated like student enrollment — read-only div with pencil/lock.
  const [fullName, setFullName] = React.useState("")
  const [portalOverride, setPortalOverride] = React.useState("")
  const [portalEditing, setPortalEditing] = React.useState(false)
  const [securityToken, setSecurityToken] = React.useState(generateTemporaryToken)
  const [tokenEditing, setTokenEditing] = React.useState(false)
  const [employmentDate, setEmploymentDate] = React.useState("")

  const portalEmail = portalOverride.trim() || generatePortalEmail(fullName)

  // ── STEP 2: PERSONAL DEMOGRAPHICS & BACKGROUND ──
  const [dateOfBirth, setDateOfBirth] = React.useState("")
  const [gender, setGender] = React.useState("")
  const [residentialAddress, setResidentialAddress] = React.useState("")
  const [phone, setPhone] = React.useState("")
  const [bloodType, setBloodType] = React.useState("")
  const [religion, setReligion] = React.useState("")
  const [formerSchool, setFormerSchool] = React.useState("")

  // ── STEP 3: ACADEMIC PLACEMENT & ASSIGNMENT ──
  const [departmentId, setDepartmentId] = React.useState<string>("")
  const [jobTitle, setJobTitle] = React.useState("")
  const [employmentType, setEmploymentType] = React.useState("")
  const [teachingSchedule, setTeachingSchedule] = React.useState("")

  // ── STEP 4: STATUTORY & COMPLIANCE VERIFICATION ──
  const [nationalId, setNationalId] = React.useState("")
  const [ssnitNumber, setSsnitNumber] = React.useState("")
  const [emergencyContactName, setEmergencyContactName] = React.useState("")
  const [emergencyContactPhone, setEmergencyContactPhone] = React.useState("")

  // ── STEP 5: COMPENSATION & TREASURY DISBURSEMENT ──
  const [clearanceTier, setClearanceTier] = React.useState("")
  const [baseSalary, setBaseSalary] = React.useState("")
  const [bankName, setBankName] = React.useState("")
  const [bankAccount, setBankAccount] = React.useState("")

  // Cache response telemetry references locally for display confirmation
  const [createdTeacherId, setCreatedTeacherId] = React.useState<string | null>(null)
  const [createdTeacherName, setCreatedTeacherName] = React.useState<string | null>(null)

  // ── REFERENCE DATA (live, from /api/reference) ──
  const { data: departments = [], isLoading: deptsLoading } = useDepartments()

  const isSubmitting = formState === "submitting"

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setFormState("submitting")
    setErrorMessage(null)

    if (!fullName.trim()) {
      setFormState("error")
      setErrorMessage("Full legal name is required to generate the portal email.")
      return
    }
    if (!portalEmail) {
      setFormState("error")
      setErrorMessage("Portal email could not be generated from the name. Tap the pencil to type one.")
      return
    }
    if (!securityToken.trim() || securityToken.trim().length < 6) {
      setFormState("error")
      setErrorMessage("Temporary security token is required (auto-generated).")
      return
    }

    const optimizedTeacherPayload = {
      account: { fullName, email: portalEmail, password: securityToken.trim(), employmentDate, role: "TEACHER" },
      demographics: {
        dateOfBirth,
        gender,
        residentialAddress,
        phone,
        bloodType,
        religion,
        formerSchool
      },
      placement: { departmentId, jobTitle, employmentType, teachingSchedule },
      compliance: { nationalId, ssnitNumber, emergencyContact: { name: emergencyContactName, phone: emergencyContactPhone } },
      payroll: { clearanceTier, baseSalary: baseSalary ? parseFloat(baseSalary) : 0, bankName, bankAccount }
    }

    try {
      const response = await fetchWithAuth("/teachers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(optimizedTeacherPayload),
      })

      const rawText = await response.text()
      let json: unknown

      try {
        json = JSON.parse(rawText)
      } catch {
        throw new Error("Server returned an unstable body string instead of structured application/json data.")
      }

      if (!response.ok) {
        const errorData = json as Record<string, unknown>
        throw new Error(
          (errorData.error as string) ||
          (errorData.message as string) ||
          "Failed to commit system infrastructure transaction logs."
        )
      }

      const savedTeacher = (json as Record<string, unknown>).data as Record<string, unknown>
      setCreatedTeacherId(
        (savedTeacher.teacherId as string) || (savedTeacher.id as string) || null
      )
      setCreatedTeacherName(
        (savedTeacher.name as string) || (savedTeacher.teacherName as string) || null
      )
      setFormState("success")
      setPortalOverride("")
      setPortalEditing(false)
      setTokenEditing(false)
      setSecurityToken(generateTemporaryToken())
    } catch (err: unknown) {
      setFormState("error")
      setErrorMessage(
        (err as Error)?.message || "Failed to resolve pipeline data connection to Express server engine."
      )
    }
  }

  const handleActivate = async () => {
    if (!createdTeacherId) return
    setFormState("submitting")
    try {
      await new Promise((resolve) => setTimeout(resolve, 500))
      router.push(backConfig.href)
    } catch (err: unknown) {
      setErrorMessage((err as Error)?.message || "Unable to promote teacher record state.")
      setFormState("error")
    }
  }

  const handleSkip = () => {
    router.push(backConfig.href)
  }

  if (formState === "success") {
    return (
      <div className="flex w-full max-w-3xl flex-col space-y-5 overflow-visible bg-transparent sm:space-y-6 md:overflow-hidden">
        <div className="flex flex-col gap-2 shrink-0">
          <Link
            href={backConfig.href}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-fit group"
          >
            <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
            {backConfig.label}
          </Link>
        </div>

        <div className="flex flex-col items-center justify-center py-16 gap-4 motion-stagger">
          <CheckCircle2 className="h-12 w-12 text-emerald-600" />
          <h2 className="text-2xl font-semibold text-foreground tracking-tight">Faculty Member Enrolled</h2>
          <p className="text-sm text-muted-foreground text-center max-w-md leading-relaxed">
            <span className="font-medium text-foreground">{createdTeacherName}</span> has been saved inside database
            ledgers with academic parameters assigned to Teacher ID <span className="font-mono text-foreground bg-zinc-100 dark:bg-zinc-900 px-1.5 py-0.5 rounded text-xs">{createdTeacherId}</span>.
          </p>
          <div className="mt-4 flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-3">
            <Button variant="ghost" className="h-11 w-full text-sm sm:h-9 sm:w-auto sm:text-xs" onClick={handleSkip}>
              Retain as Pending
            </Button>
            <Button
              className="h-11 text-sm sm:h-9 sm:text-xs px-4 bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900"
              onClick={handleActivate}
            >
              Activate & Provision Access
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex w-full max-w-3xl flex-col space-y-5 overflow-visible bg-transparent sm:space-y-6 md:overflow-hidden">
      <div className="flex flex-col gap-2 shrink-0">
        <Link
          href={backConfig.href}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-fit group"
        >
          <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
          {backConfig.label}
        </Link>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-3xl">Add teacher</h1>
          <p className="mt-1 hidden text-xs text-muted-foreground sm:block sm:text-sm">
            Add the teaching account, personal details, department and payment details. Email and token are auto-generated from the name like student enrollment.
          </p>
        </div>
      </div>

      <hr className="border-stone-200 dark:border-stone-800 shrink-0" />

      {formState === "error" && errorMessage && (
        <div className="flex items-start gap-2 p-3 rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950">
          <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-300">{errorMessage}</p>
        </div>
      )}

      <ScrollArea className="h-auto max-h-none w-full rounded-none border-none bg-transparent shadow-none md:h-[680px]">
        <form onSubmit={handleSubmit} className="space-y-8 pb-28 pr-0 sm:space-y-12 sm:pb-24 sm:pr-4">

          {/* STEP 1: ACCOUNT ACCESS & SYSTEM CREDENTIALS (AUTO) */}
          <div className="relative pl-0 group sm:pl-10">
            <div className="absolute left-0 top-0 hidden h-full flex-col items-center sm:flex">
              <div className="flex h-7 w-7 items-center justify-center rounded-full border border-stone-200 bg-background text-xs font-semibold text-stone-600 dark:border-stone-800 dark:text-stone-400 shadow-xs">
                1
              </div>
              <div className="w-[1px] flex-1 bg-stone-200 dark:bg-stone-800 mt-2" />
            </div>

            <div className="space-y-5">
              <h3 className="text-base font-semibold text-foreground tracking-tight">Account Access & Core Credentials</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="full-name" className="text-sm font-semibold sm:text-xs text-foreground">
                    Full Legal Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="full-name"
                    placeholder="e.g. Prof. Emmanuel Kwame"
                    className="h-11 text-sm sm:h-9 sm:text-xs rounded-md bg-background border-stone-200 dark:border-stone-800"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="employment-date" className="text-sm font-semibold sm:text-xs text-foreground">
                    Official Appointment Date <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="employment-date"
                    type="date"
                    className="h-11 text-sm sm:h-9 sm:text-xs rounded-md bg-background border-stone-200 dark:border-stone-800"
                    value={employmentDate}
                    onChange={(e) => setEmploymentDate(e.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold sm:text-xs text-foreground">
                    Portal Access Address <span className="text-red-500">*</span>
                  </Label>
                  {portalEditing ? (
                    <div className="flex items-center gap-1.5">
                      <Input
                        value={portalOverride}
                        onChange={(e) => setPortalOverride(e.target.value)}
                        onFocus={(e) => e.currentTarget.select()}
                        autoFocus
                        autoComplete="off"
                        className="h-11 sm:h-9 flex-1 text-sm sm:text-xs rounded-md bg-background border-stone-200 dark:border-stone-800"
                        disabled={isSubmitting}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setPortalEditing(false)}
                        title="Lock the computed address"
                        className="h-11 sm:h-9 w-11 sm:w-9 p-0 shrink-0 border-stone-200 dark:border-stone-800 text-stone-500"
                        disabled={isSubmitting}
                      >
                        <Lock className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <div className="h-11 sm:h-9 flex items-center justify-between gap-2 rounded-md bg-stone-50 dark:bg-zinc-900/40 border border-stone-200 dark:border-stone-800 px-3">
                      <span aria-live="polite" className="truncate text-sm sm:text-xs font-medium text-stone-700 dark:text-zinc-300">
                        {portalEmail || "…"}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          setPortalOverride(portalEmail)
                          setPortalEditing(true)
                        }}
                        title="Edit portal address (normally computed from the name)"
                        className="h-7 w-7 p-0 shrink-0 text-stone-400 hover:text-stone-700"
                        disabled={isSubmitting}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                  <p className="text-[11px] leading-snug text-stone-500">
                    {portalEditing ? "Type the address, then lock it." : "Computed from full name — tap pencil to change."}
                  </p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold sm:text-xs text-foreground">
                    Temporary Security Token <span className="text-red-500">*</span>
                  </Label>
                  {tokenEditing ? (
                    <div className="flex items-center gap-1.5">
                      <Input
                        value={securityToken}
                        onChange={(e) => setSecurityToken(e.target.value)}
                        onFocus={(e) => e.currentTarget.select()}
                        autoFocus
                        autoComplete="new-password"
                        className="h-11 sm:h-9 flex-1 font-mono text-sm sm:text-xs rounded-md bg-background border-stone-200 dark:border-stone-800"
                        disabled={isSubmitting}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setTokenEditing(false)}
                        title="Lock the token"
                        className="h-11 sm:h-9 w-11 sm:w-9 p-0 shrink-0 border-stone-200 dark:border-stone-800 text-stone-500"
                        disabled={isSubmitting}
                      >
                        <Lock className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <div className="h-11 sm:h-9 flex items-center justify-between gap-2 rounded-md bg-stone-50 dark:bg-zinc-900/40 border border-stone-200 dark:border-stone-800 px-3">
                      <span className="truncate font-mono text-sm sm:text-xs font-semibold tracking-wide text-stone-700">
                        {securityToken}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setTokenEditing(true)}
                        title="Set a custom token"
                        className="h-7 w-7 p-0 shrink-0 text-stone-400 hover:text-stone-700"
                        disabled={isSubmitting}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                  <p className="text-[11px] leading-snug text-stone-500">
                    {tokenEditing ? "Type the token, then lock it." : "Auto-generated — share with teacher, or tap pencil to set your own."}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* STEP 2: PERSONAL DEMOGRAPHICS & BACKGROUND */}
          <div className="relative pl-0 group sm:pl-10">
            <div className="absolute left-0 top-0 hidden h-full flex-col items-center sm:flex">
              <div className="flex h-7 w-7 items-center justify-center rounded-full border border-stone-200 bg-background text-xs font-semibold text-stone-600 dark:border-stone-800 dark:text-stone-400 shadow-xs">
                2
              </div>
              <div className="w-[1px] flex-1 bg-stone-200 dark:bg-stone-800 mt-2" />
            </div>

            <div className="space-y-5">
              <h3 className="text-base font-semibold text-foreground tracking-tight">Personal Demographics & Background Matrix</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="religion" className="text-sm font-semibold sm:text-xs text-foreground">
                    Religion Affiliation <span className="text-stone-400 text-[10px]">(Optional)</span>
                  </Label>
                  <Input
                    id="religion"
                    placeholder="e.g. Christian, Islamic, Traditional"
                    className="h-11 text-sm sm:h-9 sm:text-xs rounded-md bg-background border-stone-200 dark:border-stone-800"
                    value={religion}
                    onChange={(e) => setReligion(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="gender" className="text-sm font-semibold sm:text-xs text-foreground">
                    Gender Identity <span className="text-red-500">*</span>
                  </Label>
                  <Select value={gender} onValueChange={setGender} disabled={isSubmitting}>
                    <SelectTrigger id="gender" className="h-11 text-sm sm:h-9 sm:text-xs rounded-md bg-background border-stone-200 dark:border-stone-800">
                      <SelectValue placeholder="Select gender..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MALE" className="text-xs">Male</SelectItem>
                      <SelectItem value="FEMALE" className="text-xs">Female</SelectItem>
                      <SelectItem value="OTHER" className="text-xs">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="phone" className="text-sm font-semibold sm:text-xs text-foreground">
                    Mobile Phone Number <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="phone"
                    placeholder="e.g. +233 50 XXX XXXX"
                    className="h-11 text-sm sm:h-9 sm:text-xs rounded-md bg-background border-stone-200 dark:border-stone-800"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="blood-type" className="text-sm font-semibold sm:text-xs text-foreground">
                    Blood Group <span className="text-stone-400 text-[10px]">(Optional)</span>
                  </Label>
                  <Select value={bloodType} onValueChange={setBloodType} disabled={isSubmitting}>
                    <SelectTrigger id="blood-type" className="h-11 text-sm sm:h-9 sm:text-xs rounded-md bg-background border-stone-200 dark:border-stone-800">
                      <SelectValue placeholder="Select blood group..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A_PLUS" className="text-xs">A+</SelectItem>
                      <SelectItem value="A_MINUS" className="text-xs">A-</SelectItem>
                      <SelectItem value="B_PLUS" className="text-xs">B+</SelectItem>
                      <SelectItem value="B_MINUS" className="text-xs">B-</SelectItem>
                      <SelectItem value="AB_PLUS" className="text-xs">AB+</SelectItem>
                      <SelectItem value="AB_MINUS" className="text-xs">AB-</SelectItem>
                      <SelectItem value="O_PLUS" className="text-xs">O+</SelectItem>
                      <SelectItem value="O_MINUS" className="text-xs">O-</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="dob" className="text-sm font-semibold sm:text-xs text-foreground">
                    Date of Birth <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="dob"
                    type="date"
                    className="h-11 text-sm sm:h-9 sm:text-xs rounded-md bg-background border-stone-200 dark:border-stone-800"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="address" className="text-sm font-semibold sm:text-xs text-foreground">
                  Primary Residential Address <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="address"
                  placeholder="e.g. Plot 42, Airport Ridge, Sekondi-Takoradi"
                  className="h-11 text-sm sm:h-9 sm:text-xs rounded-md bg-background border-stone-200 dark:border-stone-800"
                  value={residentialAddress}
                  onChange={(e) => setResidentialAddress(e.target.value)}
                  required
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="former-school" className="text-sm font-semibold sm:text-xs text-foreground">
                  Alumni / Prior Educational Institution <span className="text-stone-400 text-[10px]">(Optional)</span>
                </Label>
                <Input
                  id="former-school"
                  placeholder="e.g. University of Cape Coast, KNUST"
                  className="h-11 text-sm sm:h-9 sm:text-xs rounded-md bg-background border-stone-200 dark:border-stone-800"
                  value={formerSchool}
                  onChange={(e) => setFormerSchool(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
            </div>
          </div>

          {/* STEP 3: ACADEMIC PLACEMENT & ASSIGNMENT */}
          <div className="relative pl-0 group sm:pl-10">
            <div className="absolute left-0 top-0 hidden h-full flex-col items-center sm:flex">
              <div className="flex h-7 w-7 items-center justify-center rounded-full border border-stone-200 bg-background text-xs font-semibold text-stone-600 dark:border-stone-800 dark:text-stone-400 shadow-xs">
                3
              </div>
              <div className="w-[1px] flex-1 bg-stone-200 dark:bg-stone-800 mt-2" />
            </div>

            <div className="space-y-5">
              <h3 className="text-base font-semibold text-foreground tracking-tight">Academic Placement & Faculty Assignment</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="department" className="text-sm font-semibold sm:text-xs text-foreground">
                    Assigned Academic Department <span className="text-red-500">*</span>
                  </Label>
                  <Select value={departmentId} onValueChange={setDepartmentId} required disabled={isSubmitting || deptsLoading}>
                    <SelectTrigger id="department" className="h-11 text-sm sm:h-9 sm:text-xs rounded-md bg-background border-stone-200 dark:border-stone-800">
                      <SelectValue placeholder={deptsLoading ? "Loading faculty trackers..." : "Select department..."} />
                    </SelectTrigger>
                    <SelectContent>
                      {departments.map((dept) => (
                        <SelectItem key={dept.id} value={dept.id} className="text-xs">
                          {dept.name} ({dept.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="job-title" className="text-sm font-semibold sm:text-xs text-foreground">
                    Official Teaching Designation / Role <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="job-title"
                    placeholder="e.g. Lead Mathematics Teacher, Form Tutor"
                    className="h-11 text-sm sm:h-9 sm:text-xs rounded-md bg-background border-stone-200 dark:border-stone-800"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="employment-type" className="text-sm font-semibold sm:text-xs text-foreground">
                    Employment Framework Classification <span className="text-red-500">*</span>
                  </Label>
                  <Select value={employmentType} onValueChange={setEmploymentType} required disabled={isSubmitting}>
                    <SelectTrigger id="employment-type" className="h-11 text-sm sm:h-9 sm:text-xs rounded-md bg-background border-stone-200 dark:border-stone-800">
                      <SelectValue placeholder="Select framework configuration..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FULL_TIME" className="text-xs">Permanent Full-Time</SelectItem>
                      <SelectItem value="PART_TIME" className="text-xs">Part-Time Associate</SelectItem>
                      <SelectItem value="CONTRACT" className="text-xs">Visiting / Contract Educator</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="teaching-schedule" className="text-sm font-semibold sm:text-xs text-foreground">
                    Academic Session Allocation <span className="text-red-500">*</span>
                  </Label>
                  <Select value={teachingSchedule} onValueChange={setTeachingSchedule} required disabled={isSubmitting}>
                    <SelectTrigger id="teaching-schedule" className="h-11 text-sm sm:h-9 sm:text-xs rounded-md bg-background border-stone-200 dark:border-stone-800">
                      <SelectValue placeholder="Select tracking blocks..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MORNING" className="text-xs">Morning Session Focus (07:30 - 14:00)</SelectItem>
                      <SelectItem value="AFTERNOON" className="text-xs">Afternoon / Remedial Block (13:00 - 18:30)</SelectItem>
                      <SelectItem value="FULL_DAY" className="text-xs">Full Standard Academic Day Rotation</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          {/* STEP 4: STATUTORY & COMPLIANCE VERIFICATION */}
          <div className="relative pl-0 group sm:pl-10">
            <div className="absolute left-0 top-0 hidden h-full flex-col items-center sm:flex">
              <div className="flex h-7 w-7 items-center justify-center rounded-full border border-stone-200 bg-background text-xs font-semibold text-stone-600 dark:border-stone-800 dark:text-stone-400 shadow-xs">
                4
              </div>
              <div className="w-[1px] flex-1 bg-stone-200 dark:bg-stone-800 mt-2" />
            </div>

            <div className="space-y-5">
              <h3 className="text-base font-semibold text-foreground tracking-tight">Statutory Compliance & Emergency Nodes</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="national-id" className="text-sm font-semibold sm:text-xs text-foreground">
                    National ID Token / Ghana Card ID <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="national-id"
                    placeholder="e.g. GHA-712345678-9"
                    className="h-11 text-sm sm:h-9 sm:text-xs rounded-md bg-background border-stone-200 dark:border-stone-800 font-mono text-[11px]"
                    value={nationalId}
                    onChange={(e) => setNationalId(e.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="ssnit" className="text-sm font-semibold sm:text-xs text-foreground">
                    SSNIT Social Security Registry ID <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="ssnit"
                    placeholder="e.g. N123456789012"
                    className="h-11 text-sm sm:h-9 sm:text-xs rounded-md bg-background border-stone-200 dark:border-stone-800 font-mono text-[11px]"
                    value={ssnitNumber}
                    onChange={(e) => setSsnitNumber(e.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="emergency-name" className="text-sm font-semibold sm:text-xs text-foreground">
                    Emergency Contact Full Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="emergency-name"
                    placeholder="e.g. Rebecca Kwame"
                    className="h-11 text-sm sm:h-9 sm:text-xs rounded-md bg-background border-stone-200 dark:border-stone-800"
                    value={emergencyContactName}
                    onChange={(e) => setEmergencyContactName(e.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="emergency-phone" className="text-sm font-semibold sm:text-xs text-foreground">
                    Emergency Contact Phone Number <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="emergency-phone"
                    placeholder="e.g. +233 20 XXX XXXX"
                    className="h-11 text-sm sm:h-9 sm:text-xs rounded-md bg-background border-stone-200 dark:border-stone-800"
                    value={emergencyContactPhone}
                    onChange={(e) => setEmergencyContactPhone(e.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* STEP 5: COMPENSATION & TREASURY DISBURSEMENT */}
          <div className="relative pl-0 group sm:pl-10">
            <div className="absolute left-0 top-0 hidden h-full flex-col items-center sm:flex">
              <div className="flex h-7 w-7 items-center justify-center rounded-full border border-stone-200 bg-background text-xs font-semibold text-stone-600 dark:border-stone-800 dark:text-stone-400 shadow-xs">
                5
              </div>
            </div>

            <div className="space-y-5">
              <h3 className="text-base font-semibold text-foreground tracking-tight">Compensation Ledger & Portal Permissions</h3>

              <div className="space-y-1.5">
                <Label htmlFor="clearance-tier" className="text-sm font-semibold sm:text-xs text-foreground">
                  System Authorization & Clearance Matrix <span className="text-red-500">*</span>
                </Label>
                <Select value={clearanceTier} onValueChange={setClearanceTier} required disabled={isSubmitting}>
                  <SelectTrigger id="clearance-tier" className="h-11 text-sm sm:h-9 sm:text-xs rounded-md bg-background border-stone-200 dark:border-stone-800">
                    <SelectValue placeholder="Assign faculty platform mapping..." />
                  </SelectTrigger>
                  <SelectContent>
                    {MOCK_TEACHER_CLEARANCE_LEVELS.map((tier) => (
                      <SelectItem key={tier.id} value={tier.id} className="text-xs">
                        <span className="font-medium">{tier.name}</span> — <span className="text-muted-foreground text-[11px]">{tier.description}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5 md:col-span-1">
                  <Label htmlFor="salary" className="text-sm font-semibold sm:text-xs text-foreground">
                    Base Salary (₵) <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="salary"
                    type="number"
                    min="0"
                    placeholder="e.g. 5200"
                    className="h-11 text-sm sm:h-9 sm:text-xs rounded-md bg-background border-stone-200 dark:border-stone-800"
                    value={baseSalary}
                    onChange={(e) => setBaseSalary(e.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                </div>

                <div className="space-y-1.5 md:col-span-1">
                  <Label htmlFor="bank-name" className="text-sm font-semibold sm:text-xs text-foreground">
                    Disbursement Bank <span className="text-stone-400 text-[10px]">(Optional)</span>
                  </Label>
                  <Input
                    id="bank-name"
                    placeholder="e.g. GCB, Ecobank"
                    className="h-11 text-sm sm:h-9 sm:text-xs rounded-md bg-background border-stone-200 dark:border-stone-800"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>

                <div className="space-y-1.5 md:col-span-1">
                  <Label htmlFor="bank-account" className="text-sm font-semibold sm:text-xs text-foreground">
                    Account Number <span className="text-stone-400 text-[10px]">(Optional)</span>
                  </Label>
                  <Input
                    id="bank-account"
                    placeholder="e.g. 1011130004122"
                    className="h-11 text-sm sm:h-9 sm:text-xs rounded-md bg-background border-stone-200 dark:border-stone-800 font-mono"
                    value={bankAccount}
                    onChange={(e) => setBankAccount(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              {/* Action Operations */}
              <div className="sticky bottom-0 z-10 -mx-4 flex flex-col-reverse gap-2 border-t border-stone-200 bg-background/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:flex-row sm:items-center sm:justify-end sm:gap-3 sm:bg-transparent sm:px-0 sm:pt-5 sm:pb-0 sm:dark:bg-transparent dark:border-stone-800">
                <Button
                  type="button"
                  variant="ghost"
                  className="h-11 w-full text-sm sm:h-9 sm:w-auto sm:text-xs"
                  onClick={handleSkip}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="h-11 w-full bg-stone-900 px-5 text-sm text-white dark:bg-stone-100 dark:text-stone-900 sm:h-9 sm:w-auto sm:text-xs"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Creating teacher…" : "Create teacher"}
                </Button>
              </div>
            </div>
          </div>

        </form>
      </ScrollArea>
    </div>
  )
}

export default function TeachersAddPage() {
  return (
    <React.Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading teacher form…</div>}>
      <ComprehensiveTeacherEnrollmentWizard />
    </React.Suspense>
  )
}
