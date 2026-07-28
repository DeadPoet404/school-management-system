"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useParams } from "next/navigation"
import { ArrowLeft, CheckCircle2, AlertCircle, ShieldCheck, Phone, Lock } from "lucide-react"
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
import { useClasses } from "@/lib/api/reference"

type FormState = "loading" | "ready" | "submitting" | "success" | "error"

const StepBadge = ({ num, isLast }: { num: number; isLast?: boolean }) => (
  <div className="absolute left-0 top-0 flex flex-col items-center h-full">
    <div className="flex h-7 w-7 items-center justify-center rounded-full border border-zinc-200 bg-zinc-50 text-xs font-semibold text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 shadow-xs">
      {num}
    </div>
    {!isLast && <div className="w-[1px] flex-1 bg-zinc-200 dark:bg-zinc-800 mt-2" />}
  </div>
)

const LockedNote = ({ text }: { text: string }) => (
  <p className="flex items-center gap-1.5 text-[10px] text-zinc-400 dark:text-zinc-500">
    <Lock className="h-3 w-3" />
    {text}
  </p>
)

function EditStudentForm() {
  const router = useRouter()
  const params = useParams<{ id: string }>()
  const studentId = params?.id

  const backHref = "/students"

  const [formState, setFormState] = React.useState<FormState>("loading")
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const [touched, setTouched] = React.useState<Set<string>>(new Set())

  const markTouched = (field: string) => {
    setTouched((prev) => new Set(prev).add(field))
  }
  const selectHasError = (field: string, value: string) => touched.has(field) && !value

  // Read-only identity display
  const [studentPublicId, setStudentPublicId] = React.useState("")
  const [portalEmail, setPortalEmail] = React.useState("")

  // ── EDITABLE fields — these map to the fields the backend's
  // studentUpdateSchema actually accepts (studentName, demographics,
  // placement, compliance). ──
  const [studentName, setStudentName] = React.useState("")
  const [enrollmentDate, setEnrollmentDate] = React.useState("")

  const [dateOfBirth, setDateOfBirth] = React.useState("")
  const [gender, setGender] = React.useState("")
  const [residentialAddress, setResidentialAddress] = React.useState("")
  const [medicalNotes, setMedicalNotes] = React.useState("")
  const [bloodType, setBloodType] = React.useState("")
  const [religion, setReligion] = React.useState("")
  const [formerSchool, setFormerSchool] = React.useState("")

  const [classId, setClassId] = React.useState("")
  const [academicTrack, setAcademicTrack] = React.useState("")
  const [boardingStatus, setBoardingStatus] = React.useState("")

  const [nationalId, setNationalId] = React.useState("")
  const [emergencyContactName, setEmergencyContactName] = React.useState("")
  const [emergencyContactPhone, setEmergencyContactPhone] = React.useState("")
  const [emergencyContactRelation, setEmergencyContactRelation] = React.useState("")

  // ── READ-ONLY fields — displayed for context/parity with the Add
  // Student wizard, but NOT sent on submit. The backend's PATCH
  // /students/:id endpoint has no support for editing guardian or
  // billing records; sending them would be silently dropped by the
  // API's validation layer, so the UI is explicit about this instead
  // of pretending the edit would be saved. ──
  const [guardianName, setGuardianName] = React.useState("")
  const [guardianRelationship, setGuardianRelationship] = React.useState("")
  const [guardianPhone, setGuardianPhone] = React.useState("")
  const [guardianEmail, setGuardianEmail] = React.useState("")

  const [feeTierLabel, setFeeTierLabel] = React.useState("")
  const [billingBalance, setBillingBalance] = React.useState("")

  const { data: classes = [], isLoading: classesLoading } = useClasses()

  const isSubmitting = formState === "submitting"
  const isLoading = formState === "loading"

  const isGhanaCardValid = React.useMemo(() => {
    return nationalId === "" || /^GHA-\d{9}-\d$/.test(nationalId)
  }, [nationalId])

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
    setNationalId(formatted)
  }

  const selectTriggerClass = (field: string, value: string) =>
    `h-9 text-xs rounded-md bg-background focus:ring-1 ${
      selectHasError(field, value)
        ? "border-red-300 dark:border-red-800"
        : "border-zinc-200 dark:border-zinc-800"
    }`

  React.useEffect(() => {
    if (!studentId) return
    let cancelled = false

    const loadStudent = async () => {
      try {
        setFormState("loading")
        setErrorMessage(null)
        const response = await fetchWithAuth(`/students/${encodeURIComponent(studentId)}`)
        const rawText = await response.text()
        let json: any
        try {
          json = JSON.parse(rawText)
        } catch {
          throw new Error("Server returned a malformed response instead of JSON.")
        }
        if (!response.ok || !json.success) {
          throw new Error(json.message || `Failed to load student (HTTP ${response.status}).`)
        }
        if (cancelled) return

        const student = json.data || {}
        setStudentPublicId(student.studentId || "—")
        setStudentName(student.studentName || "")
        setPortalEmail(student.account?.portalEmail || "")
        setEnrollmentDate(student.enrollmentDate ? String(student.enrollmentDate).slice(0, 10) : "")

        const demographics = student.demographics || {}
        setDateOfBirth(demographics.dateOfBirth ? String(demographics.dateOfBirth).slice(0, 10) : "")
        setGender(demographics.gender || "")
        setResidentialAddress(demographics.residentialAddress || "")
        setMedicalNotes(demographics.medicalNotes || "")
        setBloodType(demographics.bloodType || "")
        setReligion(demographics.religion || "")
        setFormerSchool(demographics.formerSchool || "")

        const placement = student.placement || {}
        setClassId(placement.classId || "")
        setAcademicTrack(placement.academicTrack || "")
        setBoardingStatus(placement.boardingStatus || "")

        const compliance = student.compliance || {}
        setNationalId(compliance.nationalId || "")
        setEmergencyContactName(compliance.emergencyName || "")
        setEmergencyContactPhone(compliance.emergencyPhone || "")
        setEmergencyContactRelation(compliance.emergencyRelation || "")

        const guardian = Array.isArray(student.guardians) ? student.guardians[0] : student.guardian
        setGuardianName(guardian?.name || "")
        setGuardianRelationship(guardian?.relationship || "")
        setGuardianPhone(guardian?.phone || "")
        setGuardianEmail(guardian?.email || "")

        const billing = student.billing || {}
        setFeeTierLabel(billing.feeTierId || billing.feeTier?.name || "")
        setBillingBalance(
          billing.currentBalance != null
            ? String(billing.currentBalance)
            : billing.balance != null
            ? String(billing.balance)
            : ""
        )

        setFormState("ready")
      } catch (err: any) {
        if (cancelled) return
        setErrorMessage(err?.message || "Unable to load student record.")
        setFormState("error")
      }
    }

    loadStudent()
    return () => {
      cancelled = true
    }
  }, [studentId])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!studentId) return

    setErrorMessage(null)

    const missingFields: string[] = []
    if (!studentName.trim()) missingFields.push("Full Legal Name")
    if (!gender) missingFields.push("Gender Identity")
    if (!residentialAddress.trim()) missingFields.push("Primary Residential Address")
    if (!classId) missingFields.push("Assigned Cohort Class Unit")
    if (!academicTrack) missingFields.push("Academic Specialization Track")
    if (!boardingStatus) missingFields.push("Institutional Housing Plan")

    if (nationalId && !isGhanaCardValid) {
      setFormState("error")
      setErrorMessage("National ID / Ghana Card format is invalid. Expected: GHA-XXXXXXXXX-X")
      return
    }

    if (missingFields.length > 0) {
      setTouched(new Set(["gender", "classId", "academicTrack", "boardingStatus"]))
      setFormState("error")
      setErrorMessage(`Please complete the following required fields: ${missingFields.join(", ")}`)
      return
    }

    setFormState("submitting")

    // Only fields accepted by studentUpdateSchema are sent. Guardian and
    // billing data are intentionally excluded — see the note above.
    const updatePayload = {
      studentName: studentName.trim(),
      demographics: {
        dateOfBirth: dateOfBirth || undefined,
        gender,
        residentialAddress: residentialAddress.trim(),
        medicalNotes: medicalNotes.trim() || null,
        bloodType: bloodType || null,
        religion: religion.trim() || null,
        formerSchool: formerSchool.trim() || null,
      },
      placement: {
        classId,
        academicTrack,
        boardingStatus,
      },
      compliance: {
        nationalId: nationalId.trim() || null,
        emergencyName: emergencyContactName.trim() || null,
        emergencyPhone: emergencyContactPhone.trim() || null,
        emergencyRelation: emergencyContactRelation || null,
      },
    }

    try {
      const response = await fetchWithAuth(`/students/${encodeURIComponent(studentId)}`, {
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
      setErrorMessage(err?.message || "Failed to save student changes.")
    }
  }

  if (isLoading) {
    return (
      <div className="w-full max-w-3xl flex flex-col space-y-6 bg-transparent mx-auto py-6">
        <div className="flex flex-col gap-2 shrink-0">
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-fit group"
          >
            <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
            Back to Students Register
          </Link>
        </div>
        <div className="flex h-48 items-center justify-center text-xs font-mono tracking-tight text-zinc-400 animate-pulse dark:text-zinc-500">
          Loading student record...
        </div>
      </div>
    )
  }

  if (formState === "success") {
    return (
      <div className="w-full max-w-3xl flex flex-col space-y-6 bg-transparent mx-auto py-6">
        <div className="flex flex-col gap-2 shrink-0">
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-fit group"
          >
            <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
            Back to Students Register
          </Link>
        </div>
        <div className="flex flex-col items-center justify-center py-16 gap-4 border border-dashed rounded-xl border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/20">
          <CheckCircle2 className="h-12 w-12 text-emerald-600 animate-in fade-in zoom-in-95 duration-300" />
          <h2 className="text-2xl font-semibold text-foreground tracking-tight">
            Student Record Updated
          </h2>
          <p className="text-sm text-muted-foreground text-center max-w-md leading-relaxed px-4">
            <span className="font-medium text-foreground">{studentName}</span>{" "}
            (<span className="font-mono text-xs">{studentPublicId}</span>) has been updated successfully.
          </p>
          <div className="flex items-center gap-3 mt-4">
            <Button
              className="h-9 text-xs px-4 bg-zinc-900 text-zinc-50 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              onClick={() => router.push(backHref)}
            >
              Return to Students Register
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (formState === "error" && !studentPublicId) {
    return (
      <div className="w-full max-w-3xl flex flex-col space-y-6 bg-transparent mx-auto py-6">
        <div className="flex flex-col gap-2 shrink-0">
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-fit group"
          >
            <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
            Back to Students Register
          </Link>
        </div>
        <div className="flex items-start gap-2 p-3 rounded-lg border border-red-200 bg-red-50/50 dark:border-red-950/30 dark:bg-red-950/20">
          <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-300 font-medium">{errorMessage}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-3xl flex flex-col space-y-6 bg-transparent mx-auto py-4">
      <div className="flex flex-col gap-2 shrink-0">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-fit group"
        >
          <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
          Back to Students Register
        </Link>
        <div>
          <h1 className="text-3xl tracking-tight font-semibold text-foreground">Edit Student</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Editing record for <span className="font-mono text-xs">{studentPublicId}</span>. Update
            demographic, academic, and compliance details below.
          </p>
        </div>
      </div>

      <hr className="border-zinc-200 dark:border-zinc-800 shrink-0" />

      {formState === "error" && errorMessage && (
        <div className="flex items-start gap-2 p-3 rounded-lg border border-red-200 bg-red-50/50 dark:border-red-950/30 dark:bg-red-950/20">
          <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-300 font-medium">{errorMessage}</p>
        </div>
      )}

      <ScrollArea className="h-[700px] w-full rounded-none border-none shadow-none bg-transparent">
        <form onSubmit={handleSubmit} className="space-y-12 pr-4 pb-12 bg-transparent">

          {/* STEP 1: IDENTITY & ACCOUNT ACCESS */}
          <div className="relative pl-10 group">
            <StepBadge num={1} />
            <div className="space-y-5">
              <h3 className="text-base font-semibold text-foreground tracking-tight">
                Identity &amp; Account Access
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="full-name" className="text-xs font-semibold text-foreground">
                    Full Legal Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="full-name"
                    className="h-9 text-xs rounded-md bg-background border-zinc-200 dark:border-zinc-800 focus-visible:ring-1"
                    value={studentName}
                    onChange={(e) => setStudentName(e.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="enrollment-date" className="text-xs font-semibold text-foreground">
                    Official Enrollment Date
                  </Label>
                  <Input
                    id="enrollment-date"
                    type="date"
                    className="h-9 text-xs rounded-md bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500"
                    value={enrollmentDate}
                    disabled
                  />
                  <LockedNote text="Set at enrollment; not editable here." />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="student-email" className="text-xs font-semibold text-foreground">
                  Portal Access Address
                </Label>
                <Input
                  id="student-email"
                  type="email"
                  className="h-9 text-xs rounded-md bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500"
                  value={portalEmail}
                  disabled
                />
                <LockedNote text="Account email/password changes are not supported on this screen." />
              </div>
            </div>
          </div>

          {/* STEP 2: PERSONAL DEMOGRAPHICS & BACKGROUND */}
          <div className="relative pl-10 group">
            <StepBadge num={2} />
            <div className="space-y-5">
              <h3 className="text-base font-semibold text-foreground tracking-tight">
                Personal Demographics &amp; Background
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="religion" className="text-xs font-semibold text-foreground">
                    Religion Affiliation{" "}
                    <span className="text-zinc-400 dark:text-zinc-500 text-[10px] font-normal">(Optional)</span>
                  </Label>
                  <Input
                    id="religion"
                    className="h-9 text-xs rounded-md bg-background border-zinc-200 dark:border-zinc-800 focus-visible:ring-1"
                    value={religion}
                    onChange={(e) => setReligion(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="gender" className="text-xs font-semibold text-foreground">
                    Gender Identity <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={gender}
                    onValueChange={(val) => {
                      setGender(val)
                      markTouched("gender")
                    }}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger id="gender" className={selectTriggerClass("gender", gender)}>
                      <SelectValue placeholder="Select demographic gender..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MALE" className="text-xs">Male</SelectItem>
                      <SelectItem value="FEMALE" className="text-xs">Female</SelectItem>
                      <SelectItem value="OTHER" className="text-xs">Other / Disclosed</SelectItem>
                    </SelectContent>
                  </Select>
                  {selectHasError("gender", gender) && (
                    <p className="text-[10px] text-red-500 font-medium">Gender selection is required</p>
                  )}
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="blood-type" className="text-xs font-semibold text-foreground">
                    Blood Group{" "}
                    <span className="text-zinc-400 dark:text-zinc-500 text-[10px] font-normal">(Optional)</span>
                  </Label>
                  <Select value={bloodType} onValueChange={setBloodType} disabled={isSubmitting}>
                    <SelectTrigger id="blood-type" className="h-9 text-xs rounded-md bg-background border-zinc-200 dark:border-zinc-800 focus:ring-1">
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
                  <Label htmlFor="dob" className="text-xs font-semibold text-foreground">Date of Birth</Label>
                  <Input
                    id="dob"
                    type="date"
                    className="h-9 text-xs rounded-md bg-background border-zinc-200 dark:border-zinc-800 focus-visible:ring-1"
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
                  className="h-9 text-xs rounded-md bg-background border-zinc-200 dark:border-zinc-800 focus-visible:ring-1"
                  value={residentialAddress}
                  onChange={(e) => setResidentialAddress(e.target.value)}
                  required
                  disabled={isSubmitting}
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="former-school" className="text-xs font-semibold text-foreground">
                    Prior Education{" "}
                    <span className="text-zinc-400 dark:text-zinc-500 text-[10px] font-normal">(Optional)</span>
                  </Label>
                  <Input
                    id="former-school"
                    className="h-9 text-xs rounded-md bg-background border-zinc-200 dark:border-zinc-800 focus-visible:ring-1"
                    value={formerSchool}
                    onChange={(e) => setFormerSchool(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="medical" className="text-xs font-semibold text-foreground">
                    Medical Notes / Allergies{" "}
                    <span className="text-zinc-400 dark:text-zinc-500 text-[10px] font-normal">(Optional)</span>
                  </Label>
                  <Input
                    id="medical"
                    className="h-9 text-xs rounded-md bg-background border-zinc-200 dark:border-zinc-800 focus-visible:ring-1"
                    value={medicalNotes}
                    onChange={(e) => setMedicalNotes(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* STEP 3: ACADEMIC PLACEMENT & TRACK ROUTING */}
          <div className="relative pl-10 group">
            <StepBadge num={3} />
            <div className="space-y-5">
              <h3 className="text-base font-semibold text-foreground tracking-tight">
                Academic Placement &amp; Track Routing
              </h3>
              <div className="space-y-1.5">
                <Label htmlFor="student-class" className="text-xs font-semibold text-foreground">
                  Assigned Cohort Class Unit <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={classId}
                  onValueChange={(val) => {
                    setClassId(val)
                    markTouched("classId")
                  }}
                  disabled={isSubmitting || classesLoading}
                >
                  <SelectTrigger id="student-class" className={selectTriggerClass("classId", classId)}>
                    <SelectValue placeholder={classesLoading ? "Accessing cohorts..." : "Select class matrix allocation..."} />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((cls) => (
                      <SelectItem key={cls.id} value={cls.id} className="text-xs">
                        {cls.name}
                        {cls.section ? ` — Section ${cls.section}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectHasError("classId", classId) && (
                  <p className="text-[10px] text-red-500 font-medium">Class selection is required</p>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="track" className="text-xs font-semibold text-foreground">
                    Academic Specialization Track <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={academicTrack}
                    onValueChange={(val) => {
                      setAcademicTrack(val)
                      markTouched("academicTrack")
                    }}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger id="track" className={selectTriggerClass("academicTrack", academicTrack)}>
                      <SelectValue placeholder="Select specialized pillar..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GENERAL_ARTS" className="text-xs">General Arts Branch</SelectItem>
                      <SelectItem value="SCIENCE" className="text-xs">Pure &amp; Applied Sciences</SelectItem>
                      <SelectItem value="BUSINESS" className="text-xs">Business &amp; Financial Accounting</SelectItem>
                      <SelectItem value="CORE_BASE" className="text-xs">Standard Unified Basic Curriculum</SelectItem>
                    </SelectContent>
                  </Select>
                  {selectHasError("academicTrack", academicTrack) && (
                    <p className="text-[10px] text-red-500 font-medium">Track selection is required</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="boarding" className="text-xs font-semibold text-foreground">
                    Institutional Housing Plan <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={boardingStatus}
                    onValueChange={(val) => {
                      setBoardingStatus(val)
                      markTouched("boardingStatus")
                    }}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger id="boarding" className={selectTriggerClass("boardingStatus", boardingStatus)}>
                      <SelectValue placeholder="Select residency..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DAY_STUDENT" className="text-xs">Day Student (Commuter)</SelectItem>
                      <SelectItem value="BOARDER" className="text-xs">Full In-House Boarding Resident</SelectItem>
                    </SelectContent>
                  </Select>
                  {selectHasError("boardingStatus", boardingStatus) && (
                    <p className="text-[10px] text-red-500 font-medium">Housing plan selection is required</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* STEP 4: STATUTORY COMPLIANCE & EMERGENCY NODES */}
          <div className="relative pl-10 group">
            <StepBadge num={4} />
            <div className="space-y-5">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
                <h3 className="text-base font-semibold text-foreground tracking-tight">
                  Statutory Compliance &amp; Emergency Nodes
                </h3>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ghana-card" className="text-xs font-semibold text-foreground">
                  National ID Token / Ghana Card{" "}
                  <span className="text-zinc-400 dark:text-zinc-500 text-[10px] font-normal">(Optional)</span>
                </Label>
                <Input
                  id="ghana-card"
                  placeholder="GHA-XXXXXXXXX-X"
                  maxLength={16}
                  className={`h-9 text-xs rounded-md bg-background font-mono text-[11px] tracking-wider uppercase focus-visible:ring-1 ${
                    nationalId && !isGhanaCardValid
                      ? "border-red-300 dark:border-red-800 focus-visible:ring-red-400"
                      : "border-zinc-200 dark:border-zinc-800"
                  }`}
                  value={nationalId}
                  onChange={(e) => handleGhanaCardChange(e.target.value)}
                  disabled={isSubmitting}
                />
                {nationalId && (
                  <span className={`text-[10px] font-medium ${isGhanaCardValid ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400"}`}>
                    {isGhanaCardValid ? "✓ Valid" : "✗ Invalid — expected GHA-XXXXXXXXX-X"}
                  </span>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="emergency-name" className="text-xs font-semibold text-foreground">
                    Emergency Contact Name{" "}
                    <span className="text-zinc-400 dark:text-zinc-500 text-[10px] font-normal">(Optional)</span>
                  </Label>
                  <Input
                    id="emergency-name"
                    className="h-9 text-xs rounded-md bg-background border-zinc-200 dark:border-zinc-800 focus-visible:ring-1"
                    value={emergencyContactName}
                    onChange={(e) => setEmergencyContactName(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <Phone className="h-3 w-3 text-zinc-400 dark:text-zinc-500" />
                    <Label htmlFor="emergency-phone" className="text-xs font-semibold text-foreground">
                      Emergency Phone{" "}
                      <span className="text-zinc-400 dark:text-zinc-500 text-[10px] font-normal">(Optional)</span>
                    </Label>
                  </div>
                  <Input
                    id="emergency-phone"
                    className="h-9 text-xs rounded-md bg-background border-zinc-200 dark:border-zinc-800 focus-visible:ring-1 font-mono"
                    value={emergencyContactPhone}
                    onChange={(e) => setEmergencyContactPhone(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="emergency-relation" className="text-xs font-semibold text-foreground">
                    Relationship{" "}
                    <span className="text-zinc-400 dark:text-zinc-500 text-[10px] font-normal">(Optional)</span>
                  </Label>
                  <Select
                    value={emergencyContactRelation}
                    onValueChange={(val) => {
                      setEmergencyContactRelation(val)
                      markTouched("emergencyContactRelation")
                    }}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger id="emergency-relation" className={selectTriggerClass("emergencyContactRelation", emergencyContactRelation)}>
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PARENT" className="text-xs">Parent</SelectItem>
                      <SelectItem value="SIBLING" className="text-xs">Sibling</SelectItem>
                      <SelectItem value="SPOUSE" className="text-xs">Spouse</SelectItem>
                      <SelectItem value="OTHER" className="text-xs">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </div>

          {/* STEP 5: PRIMARY GUARDIAN (READ-ONLY) */}
          <div className="relative pl-10 group">
            <StepBadge num={5} />
            <div className="space-y-5">
              <h3 className="text-base font-semibold text-foreground tracking-tight">
                Primary Guardian &amp; Next of Kin Linkage
              </h3>
              <LockedNote text="Guardian details cannot be edited from this screen yet." />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">Guardian Legal Name</Label>
                  <Input className="h-9 text-xs rounded-md bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500" value={guardianName} disabled />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">Relationship</Label>
                  <Input className="h-9 text-xs rounded-md bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500" value={guardianRelationship} disabled />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">Primary Contact Number</Label>
                  <Input className="h-9 text-xs rounded-md bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500 font-mono" value={guardianPhone} disabled />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">Communication Email Address</Label>
                  <Input className="h-9 text-xs rounded-md bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500" value={guardianEmail} disabled />
                </div>
              </div>
            </div>
          </div>

          {/* STEP 6: TREASURY CONFIGURATION (READ-ONLY) */}
          <div className="relative pl-10 group">
            <StepBadge num={6} isLast />
            <div className="space-y-5">
              <h3 className="text-base font-semibold text-foreground tracking-tight">
                Treasury Configuration &amp; Finance Ledger Tiers
              </h3>
              <LockedNote text="Billing details cannot be edited from this screen yet. Use the Finance module." />
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">Assigned Fee Tier</Label>
                  <Input className="h-9 text-xs rounded-md bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500" value={feeTierLabel || "—"} disabled />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-foreground">Current Balance</Label>
                  <Input className="h-9 text-xs rounded-md bg-zinc-100 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-500" value={billingBalance || "—"} disabled />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-5 border-t border-zinc-200 dark:border-zinc-800 bg-transparent">
                <Button
                  variant="ghost"
                  type="button"
                  className="h-9 text-xs font-normal text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
                  asChild
                >
                  <Link href={backHref}>Cancel</Link>
                </Button>
                <Button
                  type="submit"
                  className="h-9 text-xs font-medium px-4 bg-zinc-900 text-zinc-50 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors"
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

export default function StudentEditPage() {
  return (
    <React.Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading student form…</div>}>
      <EditStudentForm />
    </React.Suspense>
  )
}
