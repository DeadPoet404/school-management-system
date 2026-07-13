"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, CheckCircle2, AlertCircle, ShieldCheck, Phone } from "lucide-react"
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

type FormState = "idle" | "submitting" | "success" | "error"

interface DepartmentOption {
  id: string
  name: string
  code: string
}

interface ClearanceOption {
  id: string
  name: string
  description: string
}

const MOCK_DEPARTMENTS: DepartmentOption[] = [
  { id: "dept-fin", name: "Finance & Treasury", code: "FIN" },
  { id: "dept-reg", name: "Registry & Admissions", code: "REG" },
  { id: "dept-ops", name: "Operations & Facilities Management", code: "OPS" },
  { id: "dept-it", name: "IT Infrastructure & Automation", code: "ITS" },
  { id: "dept-sec", name: "Security & Campus Logistics", code: "SEC" },
]

const MOCK_CLEARANCE_LEVELS: ClearanceOption[] = [
  { id: "clear-std", name: "Level 1: General Staff Access", description: "Standard portal read/write for basic assignment nodes" },
  { id: "clear-fin", name: "Level 2: Financial Ledger Access", description: "Read/write access to treasury and fee tracking systems" },
  { id: "clear-adm", name: "Level 3: Full Operational Super-Admin", description: "Unrestricted infrastructure and system configuration rights" },
]

function ComprehensiveStaffEnrollmentWizard() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const fromSource = searchParams.get("from")

  const backConfig = {
    href: fromSource === "operations" ? "/operations" : "/staff",
    label: fromSource === "operations" ? "Back to Operations" : "Back to Staff Registry"
  }

  const [formState, setFormState] = React.useState<FormState>("idle")
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)

  // ── STEP 1: ACCOUNT ACCESS & CORE CREDENTIALS ──
  const [fullName, setFullName] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [employmentDate, setEmploymentDate] = React.useState("")

  // ── STEP 2: PERSONAL DEMOGRAPHICS & BACKGROUND ──
  const [dateOfBirth, setDateOfBirth] = React.useState("")
  const [gender, setGender] = React.useState("")
  const [residentialAddress, setResidentialAddress] = React.useState("")
  const [phone, setPhone] = React.useState("")
  const [bloodType, setBloodType] = React.useState("")
  const [religion, setReligion] = React.useState("")
  const [formerSchool, setFormerSchool] = React.useState("")

  // ── STEP 3: ROLE PLACEMENT & ASSIGNMENT ──
  const [departmentId, setDepartmentId] = React.useState<string>("")
  const [jobTitle, setJobTitle] = React.useState("")
  const [employmentType, setEmploymentType] = React.useState("")
  const [shiftSchedule, setShiftSchedule] = React.useState("")

  // ── STEP 4: STATUTORY COMPLIANCE & NATIONAL IDENTITY ──
  const [ghanaCardNumber, setGhanaCardNumber] = React.useState("")
  const [ssnitNumber, setSsnitNumber] = React.useState("")
  const [emergencyContactName, setEmergencyContactName] = React.useState("")
  const [emergencyContactPhone, setEmergencyContactPhone] = React.useState("")

  // ── STEP 5: COMPENSATION & TREASURY DISBURSEMENT ──
  const [clearanceTier, setClearanceTier] = React.useState("")
  const [baseSalary, setBaseSalary] = React.useState("")
  const [bankName, setBankName] = React.useState("")
  const [bankAccount, setBankAccount] = React.useState("")

  // ── SERVER CONFIRMATION TELEMETRY ──
  const [createdStaffId, setCreatedStaffId] = React.useState<string | null>(null)
  const [createdStaffName, setCreatedStaffName] = React.useState<string | null>(null)

  const [departments, setDepartments] = React.useState<DepartmentOption[]>([])
  const [deptsLoading, setDeptsLoading] = React.useState(true)

  const isSubmitting = formState === "submitting"

  // ── GHANA CARD AUTO-FORMATTER: GHA-XXXXXXXXX-X ──
  const handleGhanaCardChange = (value: string) => {
    const stripped = value.replace(/[^A-Za-z0-9]/g, "").toUpperCase()
    let formatted = ""
    if (stripped.length <= 3) {
      formatted = stripped
    } else if (stripped.length <= 12) {
      formatted = stripped.slice(0, 3) + "-" + stripped.slice(3)
    } else {
      formatted = stripped.slice(0, 3) + "-" + stripped.slice(3, 12) + "-" + stripped.slice(12, 13)
    }
    setGhanaCardNumber(formatted)
  }

  const isGhanaCardValid = React.useMemo(() => {
    return /^GHA-\d{9}-\d$/.test(ghanaCardNumber)
  }, [ghanaCardNumber])

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDepartments(MOCK_DEPARTMENTS)
      setDeptsLoading(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [])

  // ── STRUCTURAL UNIFIED PAYLOAD ASSEMBLY → REAL BACKEND ──
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setFormState("submitting")
    setErrorMessage(null)

    if (ghanaCardNumber && !isGhanaCardValid) {
      setFormState("error")
      setErrorMessage("National ID / Ghana Card format is invalid. Expected: GHA-XXXXXXXXX-X")
      return
    }

    const staffPayload = {
      // Maps to account creation
      account: { fullName, email, password, employmentDate, role: "STAFF" },
      // Maps to demographics table
      demographics: {
        dateOfBirth,
        gender,
        residentialAddress,
        phone,
        bloodType,
        religion,
        formerSchool,
      },
      // Maps to placement/assignment table
      placement: { departmentId, jobTitle, employmentType, shiftSchedule },
      // Maps to compliance table (nationalId, ssnitNumber, emergency columns)
      compliance: {
        nationalId: ghanaCardNumber || null,
        ssnitNumber: ssnitNumber || null,
        emergencyContact: {
          name: emergencyContactName || null,
          phone: emergencyContactPhone || null,
        },
      },
      // Maps to payroll table
      payroll: {
        clearanceTier,
        baseSalary: baseSalary ? parseFloat(baseSalary) : 0,
        bankName,
        bankAccount,
      },
    }

    try {
      const response = await fetch("http://localhost:5000/api/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(staffPayload),
      })

      const rawText = await response.text()
      let json: any

      try {
        json = JSON.parse(rawText)
      } catch {
        throw new Error("Server returned an unstable body string instead of structured application/json data.")
      }

      if (!response.ok) {
        throw new Error(json.message || json.error || `Ingestion error tracking status: ${response.status}`)
      }

      // Read back real confirmed properties from backend
      const savedStaff = json.data
      setCreatedStaffId(savedStaff.staffId || savedStaff.id)
      setCreatedStaffName(savedStaff.staffName || savedStaff.name)
      setFormState("success")
    } catch (err: any) {
      setFormState("error")
      setErrorMessage(err?.message || "Failed to commit staff registration transaction pipelines.")
    }
  }

  const handleActivate = async () => {
    if (!createdStaffId) return
    setFormState("submitting")
    try {
      await new Promise((resolve) => setTimeout(resolve, 300))
      router.push(backConfig.href)
    } catch (err: any) {
      setErrorMessage(err?.message || "Unable to promote staff record state.")
      setFormState("error")
    }
  }

  const handleSkip = () => {
    router.push(backConfig.href)
  }

  // ── SUCCESS CONFIRMATION RENDER ──
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
          <CheckCircle2 className="h-12 w-12 text-emerald-600 animate-in fade-in zoom-in-95 duration-300" />
          <h2 className="text-2xl font-semibold text-foreground tracking-tight">Staff Member Enrolled</h2>
          <p className="text-sm text-muted-foreground text-center max-w-md leading-relaxed">
            <span className="font-medium text-foreground">{createdStaffName}</span> has been saved inside database
            ledgers with system parameters assigned to Staff ID{" "}
            <span className="font-mono text-foreground bg-zinc-100 dark:bg-zinc-900 px-1.5 py-0.5 rounded text-xs">{createdStaffId}</span>.
          </p>
          <div className="flex items-center gap-3 mt-4">
            <Button variant="ghost" className="h-9 text-xs" onClick={handleSkip}>
              Retain as Pending
            </Button>
            <Button
              className="h-9 text-xs px-4 bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900"
              onClick={handleActivate}
            >
              Activate & Provision Access
            </Button>
          </div>
        </div>
      </div>
    )
  }

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
    <div className="w-full max-w-3xl flex flex-col overflow-hidden space-y-6 bg-transparent">
      <div className="flex flex-col gap-2 shrink-0">
        <Link href={backConfig.href} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-fit group">
          <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
          {backConfig.label}
        </Link>
        <div>
          <h1 className="text-3xl tracking-tight font-semibold text-foreground">Onboard Staff Member</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Execute an administrative registration sequence for non-teaching personnel. Connects directly to payroll and system access matrices.
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

      <ScrollArea className="h-[680px] w-full rounded-none border-none shadow-none bg-transparent">
        <form onSubmit={handleSubmit} className="space-y-12 pr-4 pb-12 bg-transparent">

          {/* ═══════════════════════════════════════════════════════
              STEP 1: ACCOUNT ACCESS & CORE CREDENTIALS
              Maps to → account (fullName, email, passwordHash, role)
              ═══════════════════════════════════════════════════════ */}
          <div className="relative pl-10 group">
            <StepBadge num={1} />
            <div className="space-y-5">
              <h3 className="text-base font-semibold text-foreground tracking-tight">Account Access & Core Credentials</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="full-name" className="text-xs font-semibold text-foreground">
                    Full Legal Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="full-name"
                    placeholder="e.g. Samuel Osei Mensah"
                    className="h-9 text-xs rounded-md bg-background border-stone-200 dark:border-stone-800"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="employment-date" className="text-xs font-semibold text-foreground">
                    Official Appointment Date <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="employment-date"
                    type="date"
                    className="h-9 text-xs rounded-md bg-background border-stone-200 dark:border-stone-800"
                    value={employmentDate}
                    onChange={(e) => setEmploymentDate(e.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="staff-email" className="text-xs font-semibold text-foreground">
                    Institutional Email Address <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="staff-email"
                    type="email"
                    placeholder="e.g. s.mensah@institution.edu"
                    className="h-9 text-xs rounded-md bg-background border-stone-200 dark:border-stone-800"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="staff-password" className="text-xs font-semibold text-foreground">
                    Temporary Credentials Token <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="staff-password"
                    type="password"
                    placeholder="Minimum 6 characters"
                    className="h-9 text-xs rounded-md bg-background border-stone-200 dark:border-stone-800"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    disabled={isSubmitting}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════
              STEP 2: PERSONAL DEMOGRAPHICS & BACKGROUND
              Maps to → demographics (dateOfBirth, gender, phone, bloodType, etc.)
              ═══════════════════════════════════════════════════════ */}
          <div className="relative pl-10 group">
            <StepBadge num={2} />
            <div className="space-y-5">
              <h3 className="text-base font-semibold text-foreground tracking-tight">Personal Demographics & Background Matrix</h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="dob" className="text-xs font-semibold text-foreground">
                    Date of Birth <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="dob"
                    type="date"
                    className="h-9 text-xs rounded-md bg-background border-stone-200 dark:border-stone-800"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="gender" className="text-xs font-semibold text-foreground">
                    Gender Identity <span className="text-red-500">*</span>
                  </Label>
                  <Select value={gender} onValueChange={setGender} disabled={isSubmitting}>
                    <SelectTrigger id="gender" className="h-9 text-xs rounded-md bg-background border-stone-200 dark:border-stone-800">
                      <SelectValue placeholder="Select gender..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MALE" className="text-xs">Male</SelectItem>
                      <SelectItem value="FEMALE" className="text-xs">Female</SelectItem>
                      <SelectItem value="OTHER" className="text-xs">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone" className="text-xs font-semibold text-foreground">
                    Mobile Phone Number <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="phone"
                    placeholder="e.g. +233 50 XXX XXXX"
                    className="h-9 text-xs rounded-md bg-background border-stone-200 dark:border-stone-800 font-mono"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="blood-type" className="text-xs font-semibold text-foreground">
                    Blood Group <span className="text-stone-400 text-[10px]">(Optional)</span>
                  </Label>
                  <Select value={bloodType} onValueChange={setBloodType} disabled={isSubmitting}>
                    <SelectTrigger id="blood-type" className="h-9 text-xs rounded-md bg-background border-stone-200 dark:border-stone-800">
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
                <div className="space-y-1.5">
                  <Label htmlFor="religion" className="text-xs font-semibold text-foreground">
                    Religion Affiliation <span className="text-stone-400 text-[10px]">(Optional)</span>
                  </Label>
                  <Input
                    id="religion"
                    placeholder="e.g. Christian, Islamic, Traditional"
                    className="h-9 text-xs rounded-md bg-background border-stone-200 dark:border-stone-800"
                    value={religion}
                    onChange={(e) => setReligion(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="address" className="text-xs font-semibold text-foreground">
                  Primary Residential Address <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="address"
                  placeholder="e.g. Plot 42, Airport Ridge, Sekondi-Takoradi"
                  className="h-9 text-xs rounded-md bg-background border-stone-200 dark:border-stone-800"
                  value={residentialAddress}
                  onChange={(e) => setResidentialAddress(e.target.value)}
                  required
                  disabled={isSubmitting}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="former-school" className="text-xs font-semibold text-foreground">
                  Prior Educational Institution <span className="text-stone-400 text-[10px]">(Optional)</span>
                </Label>
                <Input
                  id="former-school"
                  placeholder="e.g. University of Cape Coast, KNUST"
                  className="h-9 text-xs rounded-md bg-background border-stone-200 dark:border-stone-800"
                  value={formerSchool}
                  onChange={(e) => setFormerSchool(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════
              STEP 3: ROLE PLACEMENT & ASSIGNMENT
              Maps to → placement (departmentId, jobTitle, employmentType, shiftSchedule)
              ═══════════════════════════════════════════════════════ */}
          <div className="relative pl-10 group">
            <StepBadge num={3} />
            <div className="space-y-5">
              <h3 className="text-base font-semibold text-foreground tracking-tight">Institutional Placement & Role Assignment</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="department" className="text-xs font-semibold text-foreground">
                    Assigned Functional Department <span className="text-red-500">*</span>
                  </Label>
                  <Select value={departmentId} onValueChange={setDepartmentId} required disabled={isSubmitting || deptsLoading}>
                    <SelectTrigger id="department" className="h-9 text-xs rounded-md bg-background border-stone-200 dark:border-stone-800">
                      <SelectValue placeholder={deptsLoading ? "Loading operational grids..." : "Select department..."} />
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
                  <Label htmlFor="job-title" className="text-xs font-semibold text-foreground">
                    Official Job Title / Designation <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="job-title"
                    placeholder="e.g. Senior Treasury Accountant"
                    className="h-9 text-xs rounded-md bg-background border-stone-200 dark:border-stone-800"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="employment-type" className="text-xs font-semibold text-foreground">
                    Employment Framework Classification <span className="text-red-500">*</span>
                  </Label>
                  <Select value={employmentType} onValueChange={setEmploymentType} required disabled={isSubmitting}>
                    <SelectTrigger id="employment-type" className="h-9 text-xs rounded-md bg-background border-stone-200 dark:border-stone-800">
                      <SelectValue placeholder="Select framework configuration..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FULL_TIME" className="text-xs">Permanent Full-Time</SelectItem>
                      <SelectItem value="PART_TIME" className="text-xs">Part-Time Associate</SelectItem>
                      <SelectItem value="CONTRACT" className="text-xs">Temporary Contract Node</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="shift-schedule" className="text-xs font-semibold text-foreground">
                    Operational Shift Allocation <span className="text-red-500">*</span>
                  </Label>
                  <Select value={shiftSchedule} onValueChange={setShiftSchedule} required disabled={isSubmitting}>
                    <SelectTrigger id="shift-schedule" className="h-9 text-xs rounded-md bg-background border-stone-200 dark:border-stone-800">
                      <SelectValue placeholder="Select shift rotation schedule..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MORNING" className="text-xs">Standard Morning Shift (08:00 - 16:30)</SelectItem>
                      <SelectItem value="EVENING" className="text-xs">Mid/Evening Cover Rotation (14:00 - 22:00)</SelectItem>
                      <SelectItem value="NIGHT" className="text-xs">Overnight Security/Ops Window (22:00 - 06:00)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════
              STEP 4: STATUTORY COMPLIANCE & NATIONAL IDENTITY
              Maps to → compliance (nationalId, ssnitNumber, emergencyName, emergencyPhone)
              ═══════════════════════════════════════════════════════ */}
          <div className="relative pl-10 group">
            <StepBadge num={4} />
            <div className="space-y-5">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-stone-500 dark:text-stone-400" />
                <h3 className="text-base font-semibold text-foreground tracking-tight">Statutory Compliance & Emergency Nodes</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="ghana-card" className="text-xs font-semibold text-foreground">
                    National ID Token / Ghana Card <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="ghana-card"
                    placeholder="GHA-XXXXXXXXX-X"
                    maxLength={16}
                    className={`h-9 text-xs rounded-md bg-background font-mono text-[11px] tracking-wider uppercase ${
                      ghanaCardNumber && !isGhanaCardValid
                        ? "border-red-300 dark:border-red-800"
                        : "border-stone-200 dark:border-stone-800"
                    }`}
                    value={ghanaCardNumber}
                    onChange={(e) => handleGhanaCardChange(e.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                  {ghanaCardNumber && (
                    <p className={`text-[10px] font-medium ${isGhanaCardValid ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
                      {isGhanaCardValid ? "✓ Valid format" : "✗ Invalid format — expected GHA-XXXXXXXXX-X"}
                    </p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ssnit" className="text-xs font-semibold text-foreground">
                    SSNIT Social Security Registry ID <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="ssnit"
                    placeholder="e.g. N123456789012"
                    className="h-9 text-xs rounded-md bg-background border-stone-200 dark:border-stone-800 font-mono text-[11px]"
                    value={ssnitNumber}
                    onChange={(e) => setSsnitNumber(e.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="emergency-name" className="text-xs font-semibold text-foreground">
                    Emergency Contact Full Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="emergency-name"
                    placeholder="e.g. Rebecca Mensah"
                    className="h-9 text-xs rounded-md bg-background border-stone-200 dark:border-stone-800"
                    value={emergencyContactName}
                    onChange={(e) => setEmergencyContactName(e.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <Phone className="h-3 w-3 text-stone-400 dark:text-stone-500" />
                    <Label htmlFor="emergency-phone" className="text-xs font-semibold text-foreground">
                      Emergency Contact Phone <span className="text-red-500">*</span>
                    </Label>
                  </div>
                  <Input
                    id="emergency-phone"
                    placeholder="e.g. +233 20 XXX XXXX"
                    className="h-9 text-xs rounded-md bg-background border-stone-200 dark:border-stone-800 font-mono"
                    value={emergencyContactPhone}
                    onChange={(e) => setEmergencyContactPhone(e.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════
              STEP 5: COMPENSATION & TREASURY DISBURSEMENT
              Maps to → payroll (clearanceTier, baseSalary, bankName, bankAccount)
              ═══════════════════════════════════════════════════════ */}
          <div className="relative pl-10 group">
            <StepBadge num={5} isLast />
            <div className="space-y-5">
              <h3 className="text-base font-semibold text-foreground tracking-tight">Compensation Ledger & Security Clearance</h3>

              <div className="space-y-1.5">
                <Label htmlFor="clearance-tier" className="text-xs font-semibold text-foreground">
                  System Authorization & Clearance Matrix <span className="text-red-500">*</span>
                </Label>
                <Select value={clearanceTier} onValueChange={setClearanceTier} required disabled={isSubmitting}>
                  <SelectTrigger id="clearance-tier" className="h-9 text-xs rounded-md bg-background border-stone-200 dark:border-stone-800">
                    <SelectValue placeholder="Assign platform permissions mapping..." />
                  </SelectTrigger>
                  <SelectContent>
                    {MOCK_CLEARANCE_LEVELS.map((tier) => (
                      <SelectItem key={tier.id} value={tier.id} className="text-xs">
                        <span className="font-medium">{tier.name}</span> — <span className="text-muted-foreground text-[11px]">{tier.description}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="salary" className="text-xs font-semibold text-foreground">
                  Base Salary Compensation Package (GH₵ / Month) <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="salary"
                  type="number"
                  min="0"
                  placeholder="e.g. 4500"
                  className="h-9 text-xs rounded-md bg-background border-stone-200 dark:border-stone-800"
                  value={baseSalary}
                  onChange={(e) => setBaseSalary(e.target.value)}
                  required
                  disabled={isSubmitting}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="bank-name" className="text-xs font-semibold text-foreground">
                    Disbursement Banking Institution <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="bank-name"
                    placeholder="e.g. GCB Bank, Ecobank, Standard Chartered"
                    className="h-9 text-xs rounded-md bg-background border-stone-200 dark:border-stone-800"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bank-account" className="text-xs font-semibold text-foreground">
                    Settlement Clearing Account Number <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="bank-account"
                    placeholder="e.g. 1011130004521"
                    className="h-9 text-xs rounded-md bg-background border-stone-200 dark:border-stone-800 font-mono text-[11px]"
                    value={bankAccount}
                    onChange={(e) => setBankAccount(e.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              {/* FORM ACTIONS */}
              <div className="flex items-center justify-end gap-3 pt-5 border-t border-stone-200 dark:border-stone-800 bg-transparent">
                <Button variant="ghost" type="button" className="h-9 text-xs font-normal text-stone-500" asChild>
                  <Link href={backConfig.href}>Cancel</Link>
                </Button>
                <Button
                  type="submit"
                  className="h-9 text-xs font-medium px-4 bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900 transition-colors"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Processing Personnel Records..." : "Finalize Staff Ledger Ingestion"}
                </Button>
              </div>
            </div>
          </div>

        </form>
      </ScrollArea>
    </div>
  )
}

export default function StaffAddPage() {
  return (
    <React.Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading staff form…</div>}>
      <ComprehensiveStaffEnrollmentWizard />
    </React.Suspense>
  )
}