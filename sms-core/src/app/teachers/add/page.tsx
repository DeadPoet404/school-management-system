"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, CheckCircle2, AlertCircle } from "lucide-react"
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

// --- INSTANCE CONFIGURATION METRICS (ACADEMIC FACULTY) ---
const MOCK_ACADEMIC_DEPARTMENTS: DepartmentOption[] = [
  { id: "dept-mat", name: "Mathematics & Data Science", code: "MAT" },
  { id: "dept-sci", name: "Natural & Physical Sciences", code: "SCI" },
  { id: "dept-hum", name: "Humanities & Social Studies", code: "HUM" },
  { id: "dept-lng", name: "Languages & Literature", code: "LNG" },
  { id: "dept-art", name: "Creative & Performing Arts", code: "ART" },
]

const MOCK_TEACHER_CLEARANCE_LEVELS: ClearanceOption[] = [
  { id: "clear-tch", name: "Level 1: Standard Faculty Access", description: "Roster management, gradebook entries, and basic student tracking portals" },
  { id: "clear-hod", name: "Level 2: Department Head / Lead Educator", description: "Curriculum configuration controls, multi-class overrides, and academic performance telemetry" },
  { id: "clear-adm", name: "Level 3: Full Academic Super-Admin", description: "Unrestricted systemic manipulation, cross-department scheduling controls, and institution-wide registry management" },
]

export default function ComprehensiveTeacherEnrollmentWizard() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const fromSource = searchParams.get("from")

  const backConfig = {
    href: fromSource === "academic" ? "/academic" : "/teachers",
    label: fromSource === "academic" ? "Back to Academic Management" : "Back to Teacher Registry"
  }

  const [formState, setFormState] = React.useState<FormState>("idle")
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)

  // ── STEP 1: AUTHENTICATION & CORE IDENTITY MATRIX ──
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

  const [departments, setDepartments] = React.useState<DepartmentOption[]>([])
  const [deptsLoading, setDeptsLoading] = React.useState(true)

  React.useEffect(() => {
    const timer = setTimeout(() => {
      setDepartments(MOCK_ACADEMIC_DEPARTMENTS)
      setDeptsLoading(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setFormState("submitting")
    setErrorMessage(null)

    // Structural Unified Payload Assembly
    const optimizedTeacherPayload = {
      account: { fullName, email, password, employmentDate, role: "TEACHER" },
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
      console.log("Dispatching Data Payload to Express Server Ledger:", optimizedTeacherPayload)
      
      // FIX: Fire actual network socket execution down to your Express backend
      const response = await fetch("http://localhost:5000/api/teachers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(optimizedTeacherPayload),
      })

      const data = await response.json()

      // Handle server-side validations / custom rejections
      if (!response.ok) {
        throw new Error(data.error || "Failed to commit system infrastructure transaction logs.")
      }

      // Read back real live properties confirmed by your backend database pipeline
      setCreatedTeacherId(data.teacherId)
      setCreatedTeacherName(data.name)
      setFormState("success")
    } catch (err: any) {
      console.error("Frontend HTTP connection fault:", err)
      setFormState("error")
      setErrorMessage(err?.message || "Failed to resolve pipeline data connection to Express server engine.")
    }
  }

  const handleActivate = async () => {
    if (!createdTeacherId) return
    setFormState("submitting")
    try {
      await new Promise((resolve) => setTimeout(resolve, 500))
      router.push(backConfig.href)
    } catch (err: any) {
      setErrorMessage(err?.message || "Unable to promote teacher record state.")
      setFormState("error")
    }
  }

  const handleSkip = () => {
    router.push(backConfig.href)
  }

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
          <CheckCircle2 className="h-12 w-12 text-emerald-600 animate-in fade-in zoom-in-95 duration-300" />
          <h2 className="text-2xl font-semibold text-foreground tracking-tight">Faculty Member Enrolled</h2>
          <p className="text-sm text-muted-foreground text-center max-w-md leading-relaxed">
            <span className="font-medium text-foreground">{createdTeacherName}</span> has been saved inside database 
            ledgers with academic parameters assigned to Teacher ID <span className="font-mono text-foreground bg-zinc-100 dark:bg-zinc-900 px-1.5 py-0.5 rounded text-xs">{createdTeacherId}</span>.
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
        <div>
          <h1 className="text-3xl tracking-tight font-semibold text-foreground">Onboard Faculty Member</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Execute an administrative registration sequence for teaching and academic personnel. Connects directly to curriculum maps, payroll, and core portal matrices.
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

          {/* STEP 1: ACCOUNT ACCESS & SYSTEM CREDENTIALS */}
          <div className="relative pl-10 group">
            <div className="absolute left-0 top-0 flex flex-col items-center h-full">
              <div className="flex h-7 w-7 items-center justify-center rounded-full border border-stone-200 bg-background text-xs font-semibold text-stone-600 dark:border-stone-800 dark:text-stone-400 shadow-xs">
                1
              </div>
              <div className="w-[1px] flex-1 bg-stone-200 dark:bg-stone-800 mt-2" />
            </div>

            <div className="space-y-5">
              <h3 className="text-base font-semibold text-foreground tracking-tight">Account Access & Core Credentials</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="full-name" className="text-xs font-semibold text-foreground">
                    Full Legal Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="full-name"
                    placeholder="e.g. Prof. Emmanuel Kwame"
                    className="h-9 text-xs rounded-md bg-background border-stone-200 dark:border-stone-800"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    disabled={formState === "submitting"}
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
                    disabled={formState === "submitting"}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="teacher-email" className="text-xs font-semibold text-foreground">
                    Institutional Faculty Email <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="teacher-email"
                    type="email"
                    placeholder="e.g. e.kwame@institution.edu"
                    className="h-9 text-xs rounded-md bg-background border-stone-200 dark:border-stone-800"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={formState === "submitting"}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="teacher-password" className="text-xs font-semibold text-foreground">
                    Temporary Credentials Token <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="teacher-password"
                    type="password"
                    placeholder="Minimum 6 characters"
                    className="h-9 text-xs rounded-md bg-background border-stone-200 dark:border-stone-800"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    disabled={formState === "submitting"}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* STEP 2: PERSONAL DEMOGRAPHICS & BACKGROUND */}
          <div className="relative pl-10 group">
            <div className="absolute left-0 top-0 flex flex-col items-center h-full">
              <div className="flex h-7 w-7 items-center justify-center rounded-full border border-stone-200 bg-background text-xs font-semibold text-stone-600 dark:border-stone-800 dark:text-stone-400 shadow-xs">
                2
              </div>
              <div className="w-[1px] flex-1 bg-stone-200 dark:bg-stone-800 mt-2" />
            </div>

            <div className="space-y-5">
              <h3 className="text-base font-semibold text-foreground tracking-tight">Personal Demographics & Background Matrix</h3>

              {/* ROW 1: Religion Affiliation & Gender Identity */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    disabled={formState === "submitting"}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="gender" className="text-xs font-semibold text-foreground">
                    Gender Identity <span className="text-red-500">*</span>
                  </Label>
                  <Select value={gender} onValueChange={setGender} disabled={formState === "submitting"}>
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
              </div>

              {/* ROW 2: Mobile Number & Blood Group */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="phone" className="text-xs font-semibold text-foreground">
                    Mobile Phone Number <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="phone"
                    placeholder="e.g. +233 50 XXX XXXX"
                    className="h-9 text-xs rounded-md bg-background border-stone-200 dark:border-stone-800"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    disabled={formState === "submitting"}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="blood-type" className="text-xs font-semibold text-foreground">
                    Blood Group <span className="text-stone-400 text-[10px]">(Optional)</span>
                  </Label>
                  <Select value={bloodType} onValueChange={setBloodType} disabled={formState === "submitting"}>
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
              </div>

              {/* ROW 3: Date of Birth underneath */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                    disabled={formState === "submitting"}
                  />
                </div>
              </div>

              {/* Primary Address */}
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
                  disabled={formState === "submitting"}
                />
              </div>

              {/* Former School */}
              <div className="space-y-1.5">
                <Label htmlFor="former-school" className="text-xs font-semibold text-foreground">
                  Alumni / Prior Educational Institution <span className="text-stone-400 text-[10px]">(Optional)</span>
                </Label>
                <Input
                  id="former-school"
                  placeholder="e.g. University of Cape Coast, KNUST"
                  className="h-9 text-xs rounded-md bg-background border-stone-200 dark:border-stone-800"
                  value={formerSchool}
                  onChange={(e) => setFormerSchool(e.target.value)}
                  disabled={formState === "submitting"}
                />
              </div>
            </div>
          </div>

          {/* STEP 3: ACADEMIC PLACEMENT & ASSIGNMENT */}
          <div className="relative pl-10 group">
            <div className="absolute left-0 top-0 flex flex-col items-center h-full">
              <div className="flex h-7 w-7 items-center justify-center rounded-full border border-stone-200 bg-background text-xs font-semibold text-stone-600 dark:border-stone-800 dark:text-stone-400 shadow-xs">
                3
              </div>
              <div className="w-[1px] flex-1 bg-stone-200 dark:bg-stone-800 mt-2" />
            </div>

            <div className="space-y-5">
              <h3 className="text-base font-semibold text-foreground tracking-tight">Academic Placement & Faculty Assignment</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="department" className="text-xs font-semibold text-foreground">
                    Assigned Academic Department <span className="text-red-500">*</span>
                  </Label>
                  <Select value={departmentId} onValueChange={setDepartmentId} required disabled={formState === "submitting" || deptsLoading}>
                    <SelectTrigger id="department" className="h-9 text-xs rounded-md bg-background border-stone-200 dark:border-stone-800">
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
                  <Label htmlFor="job-title" className="text-xs font-semibold text-foreground">
                    Official Teaching Designation / Role <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="job-title"
                    placeholder="e.g. Lead Mathematics Teacher, Form Tutor"
                    className="h-9 text-xs rounded-md bg-background border-stone-200 dark:border-stone-800"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    required
                    disabled={formState === "submitting"}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="employment-type" className="text-xs font-semibold text-foreground">
                    Employment Framework Classification <span className="text-red-500">*</span>
                  </Label>
                  <Select value={employmentType} onValueChange={setEmploymentType} required disabled={formState === "submitting"}>
                    <SelectTrigger id="employment-type" className="h-9 text-xs rounded-md bg-background border-stone-200 dark:border-stone-800">
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
                  <Label htmlFor="teaching-schedule" className="text-xs font-semibold text-foreground">
                    Academic Session Allocation <span className="text-red-500">*</span>
                  </Label>
                  <Select value={teachingSchedule} onValueChange={setTeachingSchedule} required disabled={formState === "submitting"}>
                    <SelectTrigger id="teaching-schedule" className="h-9 text-xs rounded-md bg-background border-stone-200 dark:border-stone-800">
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
          <div className="relative pl-10 group">
            <div className="absolute left-0 top-0 flex flex-col items-center h-full">
              <div className="flex h-7 w-7 items-center justify-center rounded-full border border-stone-200 bg-background text-xs font-semibold text-stone-600 dark:border-stone-800 dark:text-stone-400 shadow-xs">
                4
              </div>
              <div className="w-[1px] flex-1 bg-stone-200 dark:bg-stone-800 mt-2" />
            </div>

            <div className="space-y-5">
              <h3 className="text-base font-semibold text-foreground tracking-tight">Statutory Compliance & Emergency Nodes</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="national-id" className="text-xs font-semibold text-foreground">
                    National ID Token / Ghana Card ID <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="national-id"
                    placeholder="e.g. GHA-712345678-9"
                    className="h-9 text-xs rounded-md bg-background border-stone-200 dark:border-stone-800 font-mono text-[11px]"
                    value={nationalId}
                    onChange={(e) => setNationalId(e.target.value)}
                    required
                    disabled={formState === "submitting"}
                  />
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
                    disabled={formState === "submitting"}
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
                    placeholder="e.g. Rebecca Kwame"
                    className="h-9 text-xs rounded-md bg-background border-stone-200 dark:border-stone-800"
                    value={emergencyContactName}
                    onChange={(e) => setEmergencyContactName(e.target.value)}
                    required
                    disabled={formState === "submitting"}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="emergency-phone" className="text-xs font-semibold text-foreground">
                    Emergency Contact Phone Number <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="emergency-phone"
                    placeholder="e.g. +233 20 XXX XXXX"
                    className="h-9 text-xs rounded-md bg-background border-stone-200 dark:border-stone-800"
                    value={emergencyContactPhone}
                    onChange={(e) => setEmergencyContactPhone(e.target.value)}
                    required
                    disabled={formState === "submitting"}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* STEP 5: COMPENSATION & TREASURY DISBURSEMENT */}
          <div className="relative pl-10 group">
            <div className="absolute left-0 top-0 flex flex-col items-center h-full">
              <div className="flex h-7 w-7 items-center justify-center rounded-full border border-stone-200 bg-background text-xs font-semibold text-stone-600 dark:border-stone-800 dark:text-stone-400 shadow-xs">
                5
              </div>
            </div>

            <div className="space-y-5">
              <h3 className="text-base font-semibold text-foreground tracking-tight">Compensation Ledger & Portal Permissions</h3>

              <div className="space-y-1.5">
                <Label htmlFor="clearance-tier" className="text-xs font-semibold text-foreground">
                  System Authorization & Clearance Matrix <span className="text-red-500">*</span>
                </Label>
                <Select value={clearanceTier} onValueChange={setClearanceTier} required disabled={formState === "submitting"}>
                  <SelectTrigger id="clearance-tier" className="h-9 text-xs rounded-md bg-background border-stone-200 dark:border-stone-800">
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
                  <Label htmlFor="salary" className="text-xs font-semibold text-foreground">
                    Base Salary (GH₵) <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="salary"
                    type="number"
                    min="0"
                    placeholder="e.g. 5200"
                    className="h-9 text-xs rounded-md bg-background border-stone-200 dark:border-stone-800"
                    value={baseSalary}
                    onChange={(e) => setBaseSalary(e.target.value)}
                    required
                    disabled={formState === "submitting"}
                  />
                </div>

                <div className="space-y-1.5 md:col-span-1">
                  <Label htmlFor="bank-name" className="text-xs font-semibold text-foreground">
                    Disbursement Bank <span className="text-stone-400 text-[10px]">(Optional)</span>
                  </Label>
                  <Input
                    id="bank-name"
                    placeholder="e.g. GCB, Ecobank"
                    className="h-9 text-xs rounded-md bg-background border-stone-200 dark:border-stone-800"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    disabled={formState === "submitting"}
                  />
                </div>

                <div className="space-y-1.5 md:col-span-1">
                  <Label htmlFor="bank-account" className="text-xs font-semibold text-foreground">
                    Account Number <span className="text-stone-400 text-[10px]">(Optional)</span>
                  </Label>
                  <Input
                    id="bank-account"
                    placeholder="e.g. 1011130004122"
                    className="h-9 text-xs rounded-md bg-background border-stone-200 dark:border-stone-800 font-mono"
                    value={bankAccount}
                    onChange={(e) => setBankAccount(e.target.value)}
                    disabled={formState === "submitting"}
                  />
                </div>
              </div>

              {/* Action Operations */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-stone-100 dark:border-stone-900">
                <Button
                  type="button"
                  variant="ghost"
                  className="h-9 text-xs"
                  onClick={handleSkip}
                  disabled={formState === "submitting"}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="h-9 text-xs px-5 bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900"
                  disabled={formState === "submitting"}
                >
                  {formState === "submitting" ? "Processing Records..." : "Commit Faculty Registration"}
                </Button>
              </div>

            </div>
          </div>

        </form>
      </ScrollArea>
    </div>
  )
}