"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useParams } from "next/navigation"
import { ArrowLeft, CheckCircle2, AlertCircle, Lock } from "lucide-react"
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
import { useDepartments, useSubjects } from "@/lib/api/reference"

type FormState = "loading" | "ready" | "submitting" | "success" | "error"

interface ClearanceOption {
  id: string
  name: string
  description: string
}

// Kept identical to teachers/add/page.tsx — there is no /api/reference
// endpoint for clearance tiers, so this mirrors the existing mocked list
// rather than inventing a different one for edit vs. add.
const MOCK_TEACHER_CLEARANCE_LEVELS: ClearanceOption[] = [
  { id: "clear-tch", name: "Level 1: Standard Faculty Access", description: "Roster management, gradebook entries, and basic student tracking portals" },
  { id: "clear-hod", name: "Level 2: Department Head / Lead Educator", description: "Curriculum configuration controls, multi-class overrides, and academic performance telemetry" },
  { id: "clear-adm", name: "Level 3: Full Academic Super-Admin", description: "Unrestricted systemic manipulation, cross-department scheduling controls, and institution-wide registry management" },
]

const StepBadge = ({ num, isLast }: { num: number; isLast?: boolean }) => (
  <div className="absolute left-0 top-0 flex flex-col items-center h-full">
    <div className="flex h-7 w-7 items-center justify-center rounded-full border border-stone-200 bg-background text-xs font-semibold text-stone-600 dark:border-stone-800 dark:text-stone-400 shadow-xs">
      {num}
    </div>
    {!isLast && <div className="w-[1px] flex-1 bg-stone-200 dark:bg-stone-800 mt-2" />}
  </div>
)

const LockedNote = ({ text }: { text: string }) => (
  <p className="flex items-center gap-1.5 text-[10px] text-stone-400 dark:text-stone-500">
    <Lock className="h-3 w-3" />
    {text}
  </p>
)

function EditTeacherForm() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const teacherId = params?.id

  const backHref = "/teachers"

  const [formState, setFormState] = React.useState<FormState>("loading")
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)

  const [teacherPublicId, setTeacherPublicId] = React.useState("")
  const [email, setEmail] = React.useState("")

  // ── EDITABLE — maps to teacherUpdateSchema ──
  const [teacherName, setTeacherName] = React.useState("")

  const [gender, setGender] = React.useState("")
  const [dateOfBirth, setDateOfBirth] = React.useState("")
  const [residentialAddress, setResidentialAddress] = React.useState("")
  const [phone, setPhone] = React.useState("")
  const [bloodType, setBloodType] = React.useState("")
  const [religion, setReligion] = React.useState("")
  const [formerSchool, setFormerSchool] = React.useState("")

  const [departmentId, setDepartmentId] = React.useState("")
  const [subjectId, setSubjectId] = React.useState("")
  const [employmentType, setEmploymentType] = React.useState("")

  const [nationalId, setNationalId] = React.useState("")
  const [ssnitNumber, setSsnitNumber] = React.useState("")
  const [emergencyName, setEmergencyName] = React.useState("")
  const [emergencyPhone, setEmergencyPhone] = React.useState("")

  const [clearanceTier, setClearanceTier] = React.useState("")
  const [baseSalary, setBaseSalary] = React.useState("")
  const [deductions, setDeductions] = React.useState("")
  const [paymentRoute, setPaymentRoute] = React.useState("")
  const [bankName, setBankName] = React.useState("")
  const [bankAccount, setBankAccount] = React.useState("")
  const [netPay, setNetPay] = React.useState("")

  const { data: departments = [], isLoading: deptsLoading } = useDepartments()
  const { data: subjects = [], isLoading: subjectsLoading } = useSubjects()

  const isSubmitting = formState === "submitting"
  const isLoading = formState === "loading"

  React.useEffect(() => {
    if (!teacherId) return
    let cancelled = false

    const loadTeacher = async () => {
      try {
        setFormState("loading")
        setErrorMessage(null)
        const response = await fetchWithAuth(`/teachers/${encodeURIComponent(teacherId)}`)
        const rawText = await response.text()
        let json: any
        try {
          json = JSON.parse(rawText)
        } catch {
          throw new Error("Server returned a malformed response instead of JSON.")
        }
        if (!response.ok || !json.success) {
          throw new Error(json.message || `Failed to load teacher (HTTP ${response.status}).`)
        }
        if (cancelled) return

        const teacher = json.data || {}
        setTeacherPublicId(teacher.teacherId || "—")
        setTeacherName(teacher.teacherName || "")
        setEmail(teacher.account?.email || teacher.email || "")

        const demographics = teacher.demographics || {}
        setGender(demographics.gender || "")
        setDateOfBirth(demographics.dateOfBirth ? String(demographics.dateOfBirth).slice(0, 10) : "")
        setResidentialAddress(demographics.residentialAddress || "")
        setPhone(demographics.phone || "")
        setBloodType(demographics.bloodType || "")
        setReligion(demographics.religion || "")
        setFormerSchool(demographics.formerSchool || "")

        const placement = teacher.placement || {}
        setDepartmentId(placement.departmentId || "")
        // NOTE: placement.jobTitle historically held free text that the
        // backend's createTeacher() never actually saved (the "subject"
        // foreign key was left null). teacher.subject / placement.jobTitle
        // now maps to the real Subject relation, shown here as a proper
        // reference Select for the first time.
        setSubjectId(teacher.subject || "")
        setEmploymentType(teacher.employmentType || placement.employmentType || "")

        const compliance = teacher.compliance || {}
        setNationalId(compliance.nationalId || "")
        setSsnitNumber(compliance.ssnitNumber || "")
        setEmergencyName(compliance.emergencyName || "")
        setEmergencyPhone(compliance.emergencyPhone || "")

        const payroll = teacher.payroll || {}
        setClearanceTier(payroll.clearanceTier || "")
        setBaseSalary(payroll.baseSalary != null ? String(payroll.baseSalary) : "")
        setDeductions(payroll.deductions != null ? String(payroll.deductions) : "")
        setPaymentRoute(payroll.paymentRoute || "")
        setBankName(payroll.bankName || "")
        setBankAccount(payroll.bankAccount || "")
        setNetPay(payroll.netPay != null ? String(payroll.netPay) : "")

        setFormState("ready")
      } catch (err: any) {
        if (cancelled) return
        setErrorMessage(err?.message || "Unable to load teacher record.")
        setFormState("error")
      }
    }

    loadTeacher()
    return () => {
      cancelled = true
    }
  }, [teacherId])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!teacherId) return

    setErrorMessage(null)

    const missingFields: string[] = []
    if (!teacherName.trim()) missingFields.push("Full Legal Name")
    if (!gender) missingFields.push("Gender Identity")
    if (!residentialAddress.trim()) missingFields.push("Primary Residential Address")
    if (!phone.trim()) missingFields.push("Mobile Phone Number")
    if (!departmentId) missingFields.push("Assigned Academic Department")
    if (!employmentType) missingFields.push("Employment Framework Classification")

    if (missingFields.length > 0) {
      setFormState("error")
      setErrorMessage(`Please complete the following required fields: ${missingFields.join(", ")}`)
      return
    }

    setFormState("submitting")

    const updatePayload = {
      teacherName: teacherName.trim(),
      department: departmentId,
      subject: subjectId || undefined,
      employmentType,
      demographics: {
        dateOfBirth: dateOfBirth || undefined,
        gender,
        residentialAddress: residentialAddress.trim(),
        phone: phone.trim(),
        bloodType: bloodType || null,
        religion: religion.trim() || null,
        formerSchool: formerSchool.trim() || null,
      },
      compliance: {
        nationalId: nationalId.trim() || null,
        ssnitNumber: ssnitNumber.trim() || null,
        emergencyName: emergencyName.trim() || null,
        emergencyPhone: emergencyPhone.trim() || null,
      },
      payroll: {
        clearanceTier: clearanceTier || undefined,
        baseSalary: baseSalary !== "" ? parseFloat(baseSalary) : undefined,
        deductions: deductions !== "" ? parseFloat(deductions) : undefined,
        paymentRoute: paymentRoute || undefined,
        bankName: bankName.trim() || null,
        bankAccount: bankAccount.trim() || null,
      },
    }

    try {
      const response = await fetchWithAuth(`/teachers/${encodeURIComponent(teacherId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updatePayload),
      })
      const rawText = await response.text()
      let json: any
      try {
        json = JSON.parse(rawText)
      } catch {
        throw new Error("Server returned a malformed response instead of JSON.")
      }
      if (!response.ok || !json.success) {
        throw new Error(json.message || `Update failed (HTTP ${response.status}).`)
      }
      setFormState("success")
    } catch (err: any) {
      setFormState("error")
      setErrorMessage(err?.message || "Failed to save teacher changes.")
    }
  }

  if (isLoading) {
    return (
      <div className="w-full max-w-3xl flex flex-col overflow-hidden space-y-6 bg-transparent">
        <div className="flex flex-col gap-2 shrink-0">
          <Link href={backHref} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-fit group">
            <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
            Back to Teacher Registry
          </Link>
        </div>
        <div className="flex h-48 items-center justify-center text-xs font-mono tracking-tight text-stone-400 animate-pulse dark:text-stone-500">
          Loading faculty record...
        </div>
      </div>
    )
  }

  if (formState === "success") {
    return (
      <div className="w-full max-w-3xl flex flex-col overflow-hidden space-y-6 bg-transparent">
        <div className="flex flex-col gap-2 shrink-0">
          <Link href={backHref} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-fit group">
            <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
            Back to Teacher Registry
          </Link>
        </div>
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <CheckCircle2 className="h-12 w-12 text-emerald-600 animate-in fade-in zoom-in-95 duration-300" />
          <h2 className="text-2xl font-semibold text-foreground tracking-tight">Faculty Record Updated</h2>
          <p className="text-sm text-muted-foreground text-center max-w-md leading-relaxed">
            <span className="font-medium text-foreground">{teacherName}</span> ({teacherPublicId}) has been updated successfully.
          </p>
          <div className="flex items-center gap-3 mt-4">
            <Button
              className="h-9 text-xs px-4 bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900"
              onClick={() => router.push(backHref)}
            >
              Return to Teacher Registry
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (formState === "error" && !teacherPublicId) {
    return (
      <div className="w-full max-w-3xl flex flex-col overflow-hidden space-y-6 bg-transparent">
        <div className="flex flex-col gap-2 shrink-0">
          <Link href={backHref} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-fit group">
            <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
            Back to Teacher Registry
          </Link>
        </div>
        <div className="flex items-start gap-2 p-3 rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950">
          <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-300">{errorMessage}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-3xl flex flex-col overflow-hidden space-y-6 bg-transparent">
      <div className="flex flex-col gap-2 shrink-0">
        <Link href={backHref} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-fit group">
          <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
          Back to Teacher Registry
        </Link>
        <div>
          <h1 className="text-3xl tracking-tight font-semibold text-foreground">Edit Faculty Member</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Editing record for <span className="font-mono text-xs">{teacherPublicId}</span>. Portal email and account credentials are not editable here.
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
        <form onSubmit={handleSubmit} className="space-y-12 pr-4 pb-24 bg-transparent">

          {/* STEP 1: IDENTITY */}
          <div className="relative pl-10 group">
            <StepBadge num={1} />
            <div className="space-y-5">
              <h3 className="text-base font-semibold text-foreground tracking-tight">Identity &amp; Account Access</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="full-name" className="text-xs font-semibold text-foreground">
                    Full Legal Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="full-name"
                    className="h-9 text-xs rounded-md bg-background border-stone-200 dark:border-stone-800"
                    value={teacherName}
                    onChange={(e) => setTeacherName(e.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="teacher-email" className="text-xs font-semibold text-foreground">
                    Institutional Faculty Email
                  </Label>
                  <Input
                    id="teacher-email"
                    type="email"
                    className="h-9 text-xs rounded-md bg-stone-100 dark:bg-stone-900 border-stone-200 dark:border-stone-800 text-stone-500"
                    value={email}
                    disabled
                  />
                  <LockedNote text="Account email changes are not supported on this screen." />
                </div>
              </div>
            </div>
          </div>

          {/* STEP 2: PERSONAL DEMOGRAPHICS */}
          <div className="relative pl-10 group">
            <StepBadge num={2} />
            <div className="space-y-5">
              <h3 className="text-base font-semibold text-foreground tracking-tight">Personal Demographics &amp; Background Matrix</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="religion" className="text-xs font-semibold text-foreground">
                    Religion Affiliation <span className="text-stone-400 text-[10px]">(Optional)</span>
                  </Label>
                  <Input
                    id="religion"
                    className="h-9 text-xs rounded-md bg-background border-stone-200 dark:border-stone-800"
                    value={religion}
                    onChange={(e) => setReligion(e.target.value)}
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
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="phone" className="text-xs font-semibold text-foreground">
                    Mobile Phone Number <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="phone"
                    className="h-9 text-xs rounded-md bg-background border-stone-200 dark:border-stone-800"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                </div>
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
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="dob" className="text-xs font-semibold text-foreground">Date of Birth</Label>
                  <Input
                    id="dob"
                    type="date"
                    className="h-9 text-xs rounded-md bg-background border-stone-200 dark:border-stone-800"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
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
                  className="h-9 text-xs rounded-md bg-background border-stone-200 dark:border-stone-800"
                  value={residentialAddress}
                  onChange={(e) => setResidentialAddress(e.target.value)}
                  required
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="former-school" className="text-xs font-semibold text-foreground">
                  Alumni / Prior Educational Institution <span className="text-stone-400 text-[10px]">(Optional)</span>
                </Label>
                <Input
                  id="former-school"
                  className="h-9 text-xs rounded-md bg-background border-stone-200 dark:border-stone-800"
                  value={formerSchool}
                  onChange={(e) => setFormerSchool(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
            </div>
          </div>

          {/* STEP 3: ACADEMIC PLACEMENT */}
          <div className="relative pl-10 group">
            <StepBadge num={3} />
            <div className="space-y-5">
              <h3 className="text-base font-semibold text-foreground tracking-tight">Academic Placement &amp; Faculty Assignment</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="department" className="text-xs font-semibold text-foreground">
                    Assigned Academic Department <span className="text-red-500">*</span>
                  </Label>
                  <Select value={departmentId} onValueChange={setDepartmentId} disabled={isSubmitting || deptsLoading}>
                    <SelectTrigger id="department" className="h-9 text-xs rounded-md bg-background border-stone-200 dark:border-stone-800">
                      <SelectValue placeholder={deptsLoading ? "Loading..." : "Select department..."} />
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
                  <Label htmlFor="subject" className="text-xs font-semibold text-foreground">
                    Assigned Subject <span className="text-stone-400 text-[10px]">(Optional)</span>
                  </Label>
                  <Select value={subjectId} onValueChange={setSubjectId} disabled={isSubmitting || subjectsLoading}>
                    <SelectTrigger id="subject" className="h-9 text-xs rounded-md bg-background border-stone-200 dark:border-stone-800">
                      <SelectValue placeholder={subjectsLoading ? "Loading..." : "Select subject..."} />
                    </SelectTrigger>
                    <SelectContent>
                      {subjects.map((subj) => (
                        <SelectItem key={subj.id} value={subj.id} className="text-xs">
                          {subj.name} ({subj.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="employment-type" className="text-xs font-semibold text-foreground">
                  Employment Framework Classification <span className="text-red-500">*</span>
                </Label>
                <Select value={employmentType} onValueChange={setEmploymentType} disabled={isSubmitting}>
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
            </div>
          </div>

          {/* STEP 4: STATUTORY COMPLIANCE */}
          <div className="relative pl-10 group">
            <StepBadge num={4} />
            <div className="space-y-5">
              <h3 className="text-base font-semibold text-foreground tracking-tight">Statutory Compliance &amp; Emergency Nodes</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="national-id" className="text-xs font-semibold text-foreground">
                    National ID Token / Ghana Card ID <span className="text-stone-400 text-[10px]">(Optional)</span>
                  </Label>
                  <Input
                    id="national-id"
                    className="h-9 text-xs rounded-md bg-background border-stone-200 dark:border-stone-800 font-mono text-[11px]"
                    value={nationalId}
                    onChange={(e) => setNationalId(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ssnit" className="text-xs font-semibold text-foreground">
                    SSNIT Social Security Registry ID <span className="text-stone-400 text-[10px]">(Optional)</span>
                  </Label>
                  <Input
                    id="ssnit"
                    className="h-9 text-xs rounded-md bg-background border-stone-200 dark:border-stone-800 font-mono text-[11px]"
                    value={ssnitNumber}
                    onChange={(e) => setSsnitNumber(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="emergency-name" className="text-xs font-semibold text-foreground">
                    Emergency Contact Full Name <span className="text-stone-400 text-[10px]">(Optional)</span>
                  </Label>
                  <Input
                    id="emergency-name"
                    className="h-9 text-xs rounded-md bg-background border-stone-200 dark:border-stone-800"
                    value={emergencyName}
                    onChange={(e) => setEmergencyName(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="emergency-phone" className="text-xs font-semibold text-foreground">
                    Emergency Contact Phone Number <span className="text-stone-400 text-[10px]">(Optional)</span>
                  </Label>
                  <Input
                    id="emergency-phone"
                    className="h-9 text-xs rounded-md bg-background border-stone-200 dark:border-stone-800"
                    value={emergencyPhone}
                    onChange={(e) => setEmergencyPhone(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* STEP 5: COMPENSATION */}
          <div className="relative pl-10 group">
            <StepBadge num={5} isLast />
            <div className="space-y-5">
              <h3 className="text-base font-semibold text-foreground tracking-tight">Compensation Ledger &amp; Portal Permissions</h3>
              <div className="space-y-1.5">
                <Label htmlFor="clearance-tier" className="text-xs font-semibold text-foreground">
                  System Authorization &amp; Clearance Matrix <span className="text-stone-400 text-[10px]">(Optional)</span>
                </Label>
                <Select value={clearanceTier} onValueChange={setClearanceTier} disabled={isSubmitting}>
                  <SelectTrigger id="clearance-tier" className="h-9 text-xs rounded-md bg-background border-stone-200 dark:border-stone-800">
                    <SelectValue placeholder="Assign faculty platform mapping..." />
                  </SelectTrigger>
                  <SelectContent>
                    {MOCK_TEACHER_CLEARANCE_LEVELS.map((tier) => (
                      <SelectItem key={tier.id} value={tier.name} className="text-xs">
                        <span className="font-medium">{tier.name}</span> — <span className="text-muted-foreground text-[11px]">{tier.description}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="salary" className="text-xs font-semibold text-foreground">Base Salary (GH₵)</Label>
                  <Input
                    id="salary"
                    type="number"
                    min="0"
                    className="h-9 text-xs rounded-md bg-background border-stone-200 dark:border-stone-800"
                    value={baseSalary}
                    onChange={(e) => setBaseSalary(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="deductions" className="text-xs font-semibold text-foreground">Deductions (GH₵)</Label>
                  <Input
                    id="deductions"
                    type="number"
                    min="0"
                    className="h-9 text-xs rounded-md bg-background border-stone-200 dark:border-stone-800"
                    value={deductions}
                    onChange={(e) => setDeductions(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="net-pay" className="text-xs font-semibold text-foreground">Net Pay (GH₵)</Label>
                  <Input
                    id="net-pay"
                    className="h-9 text-xs rounded-md bg-stone-100 dark:bg-stone-900 border-stone-200 dark:border-stone-800 text-stone-500"
                    value={netPay}
                    disabled
                  />
                </div>
              </div>
              <LockedNote text="Net pay is recalculated automatically by the server from base salary minus deductions." />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="payment-route" className="text-xs font-semibold text-foreground">
                    Payment Route <span className="text-stone-400 text-[10px]">(Optional)</span>
                  </Label>
                  <Select value={paymentRoute} onValueChange={setPaymentRoute} disabled={isSubmitting}>
                    <SelectTrigger id="payment-route" className="h-9 text-xs rounded-md bg-background border-stone-200 dark:border-stone-800">
                      <SelectValue placeholder="Select route..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BANK_TRANSFER" className="text-xs">Bank Transfer</SelectItem>
                      <SelectItem value="MOBILE_MONEY" className="text-xs">Mobile Money</SelectItem>
                      <SelectItem value="CASH" className="text-xs">Cash</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bank-name" className="text-xs font-semibold text-foreground">
                    Disbursement Bank <span className="text-stone-400 text-[10px]">(Optional)</span>
                  </Label>
                  <Input
                    id="bank-name"
                    className="h-9 text-xs rounded-md bg-background border-stone-200 dark:border-stone-800"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bank-account" className="text-xs font-semibold text-foreground">
                    Account Number <span className="text-stone-400 text-[10px]">(Optional)</span>
                  </Label>
                  <Input
                    id="bank-account"
                    className="h-9 text-xs rounded-md bg-background border-stone-200 dark:border-stone-800 font-mono"
                    value={bankAccount}
                    onChange={(e) => setBankAccount(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-5 border-t border-stone-200 dark:border-stone-800 bg-transparent">
                <Button
                  variant="ghost"
                  type="button"
                  className="h-9 text-xs"
                  asChild
                >
                  <Link href={backHref}>Cancel</Link>
                </Button>
                <Button
                  type="submit"
                  className="h-9 text-xs px-5 bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Saving Changes..." : "Save Changes"}
                </Button>
              </div>
            </div>
          </div>
        </form>
      </ScrollArea>
    </div>
  )
}

export default function TeacherEditPage() {
  return (
    <React.Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading teacher form…</div>}>
      <EditTeacherForm />
    </React.Suspense>
  )
}
