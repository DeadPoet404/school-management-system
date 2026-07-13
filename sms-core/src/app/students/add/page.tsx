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

// ── TYPE DEFINITIONS ──
type FormState = "idle" | "submitting" | "success" | "error"

interface ClassOption {
  id: string
  name: string
  room?: string
}

interface FeeTierOption {
  id: string
  name: string
  amount: string
}

// ── STATIC REFERENCE DATA ──
const MOCK_CLASSES: ClassOption[] = [
  { id: "cls-1", name: "Junior High School (JHS 1)", room: "Room A" },
  { id: "cls-2", name: "Junior High School (JHS 2)", room: "Room B" },
  { id: "cls-3", name: "Senior High School (SHS 1)", room: "Science Lab Alpha" },
  { id: "cls-4", name: "Senior High School (SHS 2)", room: "Arts Block" },
]

const MOCK_FEE_TIERS: FeeTierOption[] = [
  { id: "tier-std", name: "Standard Tuition Rate", amount: "GH₵ 2,500 / Term" },
  { id: "tier-aid", name: "Financial Aid Subsidized (Tier 2)", amount: "GH₵ 1,250 / Term" },
  { id: "tier-sch", name: "Exempt / Full Academic Scholarship", amount: "GH₵ 0 / Term" },
]

// ── MAIN COMPONENT ──
function ComprehensiveEnrollmentWizard() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const fromSource = searchParams.get("from")

  const backConfig = {
    href: fromSource === "operations" ? "/operations" : "/students",
    label: fromSource === "operations" ? "Back to Operations" : "Back to Students Register",
  }

  // ── FORM LIFECYCLE STATE ──
  const [formState, setFormState] = React.useState<FormState>("idle")
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)

  // ── TOUCHED FIELD TRACKING (for Select validation UX) ──
  const [touched, setTouched] = React.useState<Set<string>>(new Set())
  const markTouched = (field: string) => {
    setTouched((prev) => new Set(prev).add(field))
  }
  const selectHasError = (field: string, value: string) => touched.has(field) && !value

  // ── STEP 1: ACCOUNT ACCESS & CORE CREDENTIALS ──
  const [fullName, setFullName] = React.useState("")
  const [email, setEmail] = React.useState("")
  const [password, setPassword] = React.useState("")
  const [enrollmentDate, setEnrollmentDate] = React.useState("")

  // ── STEP 2: PERSONAL DEMOGRAPHICS & BACKGROUND ──
  const [dateOfBirth, setDateOfBirth] = React.useState("")
  const [gender, setGender] = React.useState("")
  const [residentialAddress, setResidentialAddress] = React.useState("")
  const [medicalNotes, setMedicalNotes] = React.useState("")
  const [bloodType, setBloodType] = React.useState("")
  const [religion, setReligion] = React.useState("")
  const [formerSchool, setFormerSchool] = React.useState("")

  // ── STEP 3: ACADEMIC PLACEMENT & TRACK ROUTING ──
  const [classId, setClassId] = React.useState("")
  const [academicTrack, setAcademicTrack] = React.useState("")
  const [boardingStatus, setBoardingStatus] = React.useState("")

  // ── STEP 4: STATUTORY COMPLIANCE & NATIONAL IDENTITY ──
  const [ghanaCardNumber, setGhanaCardNumber] = React.useState("")
  const [emergencyContactName, setEmergencyContactName] = React.useState("")
  const [emergencyContactPhone, setEmergencyContactPhone] = React.useState("")
  const [emergencyContactRelation, setEmergencyContactRelation] = React.useState("")

  // ── STEP 5: PRIMARY GUARDIAN & NEXT OF KIN LINKAGE ──
  const [guardianName, setGuardianName] = React.useState("")
  const [guardianRelationship, setGuardianRelationship] = React.useState("")
  const [guardianPhone, setGuardianPhone] = React.useState("")
  const [guardianEmail, setGuardianEmail] = React.useState("")

  // ── STEP 6: TREASURY CONFIGURATION & FINANCE LEDGER TIERS ──
  const [feeTierId, setFeeTierId] = React.useState("")
  const [initialDeposit, setInitialDeposit] = React.useState("")

  // ── SERVER CONFIRMATION TELEMETRY ──
  const [createdStudentId, setCreatedStudentId] = React.useState<string | null>(null)
  const [createdStudentName, setCreatedStudentName] = React.useState<string | null>(null)

  // ── MOCK CLASS LOADING STATE ──
  const [classes, setClasses] = React.useState<ClassOption[]>([])
  const [classesLoading, setClassesLoading] = React.useState(true)

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

  // ── SIMULATE CLASS DATA FETCH ──
  React.useEffect(() => {
    const timer = setTimeout(() => {
      setClasses(MOCK_CLASSES)
      setClassesLoading(false)
    }, 300)
    return () => clearTimeout(timer)
  }, [])

  // ── SELECT TRIGGER CLASS HELPER ──
  const selectTriggerClass = (field: string, value: string) =>
    `h-9 text-xs rounded-md bg-background focus:ring-1 ${
      selectHasError(field, value)
        ? "border-red-300 dark:border-red-800"
        : "border-zinc-200 dark:border-zinc-800"
    }`

  // ── STRUCTURAL UNIFIED PAYLOAD ASSEMBLY ──
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setFormState("submitting")
    setErrorMessage(null)

    // ═══════════════════════════════════════════════════════════
    // FRONTEND VALIDATION GATE
    // shadcn Select components bypass native HTML5 required validation.
    // Empty strings are falsy in JS, causing backend rejection.
    // ═══════════════════════════════════════════════════════════
    const missingFields: string[] = []

    // Step 1
    if (!fullName.trim()) missingFields.push("Full Legal Name")
    if (!email.trim()) missingFields.push("Portal Access Address")
    if (!password.trim()) missingFields.push("Temporary Security Token")
    if (!enrollmentDate) missingFields.push("Official Enrollment Date")

    // Step 2
    if (!dateOfBirth) missingFields.push("Date of Birth")
    if (!gender) missingFields.push("Gender Identity")
    if (!residentialAddress.trim()) missingFields.push("Primary Residential Address")

    // Step 3 — All Select fields
    if (!classId) missingFields.push("Assigned Cohort Class Unit")
    if (!academicTrack) missingFields.push("Academic Specialization Track")
    if (!boardingStatus) missingFields.push("Institutional Housing Plan")

    // Step 4 — Ghana Card format check
    if (ghanaCardNumber && !isGhanaCardValid) {
      setFormState("error")
      setErrorMessage("National ID / Ghana Card format is invalid. Expected: GHA-XXXXXXXXX-X")
      return
    }

    // Step 5 — Select field
    if (!guardianName.trim()) missingFields.push("Guardian Legal Name")
    if (!guardianRelationship) missingFields.push("Guardian Relationship Matrix")
    if (!guardianPhone.trim()) missingFields.push("Guardian Primary Contact Number")

    // Step 6 — Select field
    if (!feeTierId) missingFields.push("Assigned Fee Structures Billing Tier")

    // ── FAIL FAST ON FRONTEND ──
    if (missingFields.length > 0) {
      // Mark all select fields as touched so their red borders appear
      const selectFields = ["gender", "classId", "academicTrack", "boardingStatus", "guardianRelationship", "feeTierId"]
      setTouched(new Set(selectFields))

      setFormState("error")
      setErrorMessage(`Please complete the following required fields: ${missingFields.join(", ")}`)
      return
    }

    // ═══════════════════════════════════════════════════════════
    // PAYLOAD CONSTRUCTION
    // ═══════════════════════════════════════════════════════════
    const enrollmentPayload = {
      account: {
        fullName: fullName.trim(),
        email: email.trim(),
        password,
        enrollmentDate,
      },
      demographics: {
        dateOfBirth,
        gender,
        residentialAddress: residentialAddress.trim(),
        medicalNotes: medicalNotes.trim() || null,
        bloodType: bloodType || null,
        religion: religion.trim() || null,
        formerSchool: formerSchool.trim() || null,
      },
      placement: { classId, academicTrack, boardingStatus },
      compliance: {
        nationalId: ghanaCardNumber || null,
        emergencyContact: {
          name: emergencyContactName.trim() || null,
          phone: emergencyContactPhone.trim() || null,
          relationship: emergencyContactRelation || null,
        },
      },
      guardian: {
        name: guardianName.trim(),
        relationship: guardianRelationship,
        phone: guardianPhone.trim(),
        email: guardianEmail.trim() || null,
      },
      billing: {
        feeTierId,
        initialDeposit: initialDeposit ? parseFloat(initialDeposit) : 0,
      },
    }

    // ═══════════════════════════════════════════════════════════
    // API TRANSMISSION
    // ═══════════════════════════════════════════════════════════
    try {
      const response = await fetch("http://localhost:5000/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(enrollmentPayload),
      })

      const rawText = await response.text()
      let json: any

      try {
        json = JSON.parse(rawText)
      } catch {
        throw new Error("Server returned an unstable body string instead of structured application/json data.")
      }

      if (!response.ok || !json.success) {
        throw new Error(json.message || `Ingestion error tracking status: ${response.status}`)
      }

      const savedStudent = json.data
      setCreatedStudentId(savedStudent.studentId || savedStudent.id)
      setCreatedStudentName(savedStudent.studentName)
      setFormState("success")
    } catch (err: any) {
      setFormState("error")
      setErrorMessage(err?.message || "Failed to commit atomic registration ingestion transaction pipelines.")
    }
  }

  // ── POST-SUBMIT HANDLERS ──
  const handleActivate = async () => {
    if (!createdStudentId) return
    setFormState("submitting")
    try {
      await new Promise((resolve) => setTimeout(resolve, 300))
      router.push(backConfig.href)
    } catch (err: any) {
      setErrorMessage(err?.message || "Unable to update active student identity context statuses.")
      setFormState("error")
    }
  }

  const handleSkip = () => {
    router.push(backConfig.href)
  }

  // ═══════════════════════════════════════════════════════════
  // SUCCESS CONFIRMATION RENDER
  // ═══════════════════════════════════════════════════════════
  if (formState === "success") {
    return (
      <div className="w-full max-w-3xl flex flex-col space-y-6 bg-transparent mx-auto py-6">
        <div className="flex flex-col gap-2 shrink-0">
          <Link
            href={backConfig.href}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-fit group"
          >
            <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
            {backConfig.label}
          </Link>
        </div>

        <div className="flex flex-col items-center justify-center py-16 gap-4 border border-dashed rounded-xl border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/20">
          <CheckCircle2 className="h-12 w-12 text-emerald-600 animate-in fade-in zoom-in-95 duration-300" />
          <h2 className="text-2xl font-semibold text-foreground tracking-tight">
            Student Enrolled Successfully
          </h2>
          <p className="text-sm text-muted-foreground text-center max-w-md leading-relaxed px-4">
            <span className="font-medium text-foreground">{createdStudentName}</span> has been cleanly
            indexed inside the master system ledger registers under custom record identifier:{" "}
            <span className="font-mono text-zinc-900 dark:text-zinc-100 bg-zinc-200/60 dark:bg-zinc-800/80 px-1.5 py-0.5 rounded text-xs tracking-wider">
              {createdStudentId}
            </span>
            .
          </p>
          <div className="flex items-center gap-3 mt-4">
            <Button
              variant="outline"
              className="h-9 text-xs border-zinc-200 dark:border-zinc-800"
              onClick={handleSkip}
            >
              Retain as Applicant
            </Button>
            <Button
              className="h-9 text-xs px-4 bg-zinc-900 text-zinc-50 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
              onClick={handleActivate}
            >
              Activate &amp; Provision Access
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // STEP BADGE HELPER
  // ═══════════════════════════════════════════════════════════
  const StepBadge = ({ num, isLast }: { num: number; isLast?: boolean }) => (
    <div className="absolute left-0 top-0 flex flex-col items-center h-full">
      <div className="flex h-7 w-7 items-center justify-center rounded-full border border-zinc-200 bg-zinc-50 text-xs font-semibold text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400 shadow-xs">
        {num}
      </div>
      {!isLast && <div className="w-[1px] flex-1 bg-zinc-200 dark:bg-zinc-800 mt-2" />}
    </div>
  )

  // ═══════════════════════════════════════════════════════════
  // MAIN FORM RENDER
  // ═══════════════════════════════════════════════════════════
  return (
    <div className="w-full max-w-3xl flex flex-col space-y-6 bg-transparent mx-auto py-4">
      {/* ── HEADER ── */}
      <div className="flex flex-col gap-2 shrink-0">
        <Link
          href={backConfig.href}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors w-fit group"
        >
          <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
          {backConfig.label}
        </Link>
        <div>
          <h1 className="text-3xl tracking-tight font-semibold text-foreground">Enroll New Student</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Execute a full architectural registration sequence mapped directly to nested core transactional
            tables.
          </p>
        </div>
      </div>

      <hr className="border-zinc-200 dark:border-zinc-800 shrink-0" />

      {/* ── ERROR BANNER ── */}
      {formState === "error" && errorMessage && (
        <div className="flex items-start gap-2 p-3 rounded-lg border border-red-200 bg-red-50/50 dark:border-red-950/30 dark:bg-red-950/20">
          <AlertCircle className="h-4 w-4 text-red-600 dark:text-red-400 mt-0.5 shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-300 font-medium">{errorMessage}</p>
        </div>
      )}

      {/* ── SCROLLABLE FORM CANVAS ── */}
      <ScrollArea className="h-[700px] w-full rounded-none border-none shadow-none bg-transparent">
        <form onSubmit={handleSubmit} className="space-y-12 pr-4 pb-12 bg-transparent">
          {/* ═══════════════════════════════════════════════════════
              STEP 1: ACCOUNT ACCESS & CORE CREDENTIALS
              Maps to → StudentAccount (portalEmail, passwordHash)
              ═══════════════════════════════════════════════════════ */}
          <div className="relative pl-10 group">
            <StepBadge num={1} />
            <div className="space-y-5">
              <h3 className="text-base font-semibold text-foreground tracking-tight">
                Account Access &amp; Core Credentials
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="full-name" className="text-xs font-semibold text-foreground">
                    Full Legal Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="full-name"
                    placeholder="e.g. Ama Serwaa Mensah"
                    className="h-9 text-xs rounded-md bg-background border-zinc-200 dark:border-zinc-800 focus-visible:ring-1"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="enrollment-date" className="text-xs font-semibold text-foreground">
                    Official Enrollment Date <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="enrollment-date"
                    type="date"
                    className="h-9 text-xs rounded-md bg-background border-zinc-200 dark:border-zinc-800 focus-visible:ring-1"
                    value={enrollmentDate}
                    onChange={(e) => setEnrollmentDate(e.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="student-email" className="text-xs font-semibold text-foreground">
                    Portal Access Address <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="student-email"
                    type="email"
                    placeholder="e.g. student.name@domain.edu"
                    className="h-9 text-xs rounded-md bg-background border-zinc-200 dark:border-zinc-800 focus-visible:ring-1"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="student-password" className="text-xs font-semibold text-foreground">
                    Temporary Security Token <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="student-password"
                    type="password"
                    placeholder="Minimum 6 characters"
                    className="h-9 text-xs rounded-md bg-background border-zinc-200 dark:border-zinc-800 focus-visible:ring-1"
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
              Maps to → Demographics (dateOfBirth, gender, bloodType, etc.)
              ═══════════════════════════════════════════════════════ */}
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
                    <span className="text-zinc-400 dark:text-zinc-500 text-[10px] font-normal">
                      (Optional)
                    </span>
                  </Label>
                  <Input
                    id="religion"
                    placeholder="e.g. Christian, Islamic, Traditional"
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
                    <SelectTrigger
                      id="gender"
                      className={selectTriggerClass("gender", gender)}
                    >
                      <SelectValue placeholder="Select demographic gender..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="MALE" className="text-xs">
                        Male
                      </SelectItem>
                      <SelectItem value="FEMALE" className="text-xs">
                        Female
                      </SelectItem>
                      <SelectItem value="OTHER" className="text-xs">
                        Other / Disclosed
                      </SelectItem>
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
                    <span className="text-zinc-400 dark:text-zinc-500 text-[10px] font-normal">
                      (Optional)
                    </span>
                  </Label>
                  <Select value={bloodType} onValueChange={setBloodType} disabled={isSubmitting}>
                    <SelectTrigger
                      id="blood-type"
                      className="h-9 text-xs rounded-md bg-background border-zinc-200 dark:border-zinc-800 focus:ring-1"
                    >
                      <SelectValue placeholder="Select blood group..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="A_PLUS" className="text-xs">
                        A+
                      </SelectItem>
                      <SelectItem value="A_MINUS" className="text-xs">
                        A-
                      </SelectItem>
                      <SelectItem value="B_PLUS" className="text-xs">
                        B+
                      </SelectItem>
                      <SelectItem value="B_MINUS" className="text-xs">
                        B-
                      </SelectItem>
                      <SelectItem value="AB_PLUS" className="text-xs">
                        AB+
                      </SelectItem>
                      <SelectItem value="AB_MINUS" className="text-xs">
                        AB-
                      </SelectItem>
                      <SelectItem value="O_PLUS" className="text-xs">
                        O+
                      </SelectItem>
                      <SelectItem value="O_MINUS" className="text-xs">
                        O-
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="dob" className="text-xs font-semibold text-foreground">
                    Date of Birth <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="dob"
                    type="date"
                    className="h-9 text-xs rounded-md bg-background border-zinc-200 dark:border-zinc-800 focus-visible:ring-1"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    required
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
                  placeholder="e.g. House No. 12, Anaji Residential Area, Takoradi"
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
                    <span className="text-zinc-400 dark:text-zinc-500 text-[10px] font-normal">
                      (Optional)
                    </span>
                  </Label>
                  <Input
                    id="former-school"
                    placeholder="e.g. Accra Academy, KNUST"
                    className="h-9 text-xs rounded-md bg-background border-zinc-200 dark:border-zinc-800 focus-visible:ring-1"
                    value={formerSchool}
                    onChange={(e) => setFormerSchool(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="medical" className="text-xs font-semibold text-foreground">
                    Medical Notes / Allergies{" "}
                    <span className="text-zinc-400 dark:text-zinc-500 text-[10px] font-normal">
                      (Optional)
                    </span>
                  </Label>
                  <Input
                    id="medical"
                    placeholder="e.g. Asthmatic. Leave blank if none."
                    className="h-9 text-xs rounded-md bg-background border-zinc-200 dark:border-zinc-800 focus-visible:ring-1"
                    value={medicalNotes}
                    onChange={(e) => setMedicalNotes(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════
              STEP 3: ACADEMIC PLACEMENT & TRACK ROUTING
              Maps to → Placement (classId, academicTrack, boardingStatus)
              ═══════════════════════════════════════════════════════ */}
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
                  <SelectTrigger
                    id="student-class"
                    className={selectTriggerClass("classId", classId)}
                  >
                    <SelectValue
                      placeholder={classesLoading ? "Accessing cohorts..." : "Select class matrix allocation..."}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {classes.map((cls) => (
                      <SelectItem key={cls.id} value={cls.id} className="text-xs">
                        {cls.name}
                        {cls.room ? ` — ${cls.room}` : ""}
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
                    <SelectTrigger
                      id="track"
                      className={selectTriggerClass("academicTrack", academicTrack)}
                    >
                      <SelectValue placeholder="Select specialized pillar..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="GENERAL_ARTS" className="text-xs">
                        General Arts Branch
                      </SelectItem>
                      <SelectItem value="SCIENCE" className="text-xs">
                        Pure &amp; Applied Sciences
                      </SelectItem>
                      <SelectItem value="BUSINESS" className="text-xs">
                        Business &amp; Financial Accounting
                      </SelectItem>
                      <SelectItem value="CORE_BASE" className="text-xs">
                        Standard Unified Basic Curriculum
                      </SelectItem>
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
                    <SelectTrigger
                      id="boarding"
                      className={selectTriggerClass("boardingStatus", boardingStatus)}
                    >
                      <SelectValue placeholder="Select residency..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="DAY_STUDENT" className="text-xs">
                        Day Student (Commuter)
                      </SelectItem>
                      <SelectItem value="BOARDER" className="text-xs">
                        Full In-House Boarding Resident
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {selectHasError("boardingStatus", boardingStatus) && (
                    <p className="text-[10px] text-red-500 font-medium">Housing plan selection is required</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════
              STEP 4: STATUTORY COMPLIANCE & NATIONAL IDENTITY
              Maps to → StudentCompliance (nationalId, emergencyName,
                        emergencyPhone, emergencyRelation)
              Controller flattens nested emergencyContact → DB columns
              ═══════════════════════════════════════════════════════ */}
          <div className="relative pl-10 group">
            <StepBadge num={4} />
            <div className="space-y-5">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
                <h3 className="text-base font-semibold text-foreground tracking-tight">
                  Statutory Compliance &amp; Emergency Nodes
                </h3>
              </div>

              {/* Ghana Card — full-width, prominent */}
              <div className="space-y-1.5">
                <Label htmlFor="ghana-card" className="text-xs font-semibold text-foreground">
                  National ID Token / Ghana Card <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="ghana-card"
                  placeholder="GHA-XXXXXXXXX-X"
                  maxLength={16}
                  className={`h-9 text-xs rounded-md bg-background font-mono text-[11px] tracking-wider uppercase focus-visible:ring-1 ${
                    ghanaCardNumber && !isGhanaCardValid
                      ? "border-red-300 dark:border-red-800 focus-visible:ring-red-400"
                      : "border-zinc-200 dark:border-zinc-800"
                  }`}
                  value={ghanaCardNumber}
                  onChange={(e) => handleGhanaCardChange(e.target.value)}
                  required
                  disabled={isSubmitting}
                />
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-zinc-400 dark:text-zinc-500 leading-relaxed">
                    Issued by the National Identification Authority (NIA). Format: GHA-XXXXXXXXX-X
                  </p>
                  {ghanaCardNumber && (
                    <span
                      className={`text-[10px] font-medium shrink-0 ml-2 ${
                        isGhanaCardValid
                          ? "text-emerald-600 dark:text-emerald-400"
                          : "text-red-500 dark:text-red-400"
                      }`}
                    >
                      {isGhanaCardValid ? "✓ Valid" : "✗ Invalid"}
                    </span>
                  )}
                </div>
              </div>

              {/* Emergency Contact — 3-column row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="emergency-name" className="text-xs font-semibold text-foreground">
                    Emergency Contact Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="emergency-name"
                    placeholder="e.g. Nana Akua Boateng"
                    className="h-9 text-xs rounded-md bg-background border-zinc-200 dark:border-zinc-800 focus-visible:ring-1"
                    value={emergencyContactName}
                    onChange={(e) => setEmergencyContactName(e.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <Phone className="h-3 w-3 text-zinc-400 dark:text-zinc-500" />
                    <Label htmlFor="emergency-phone" className="text-xs font-semibold text-foreground">
                      Emergency Phone <span className="text-red-500">*</span>
                    </Label>
                  </div>
                  <Input
                    id="emergency-phone"
                    placeholder="e.g. +233 20 XXX XXXX"
                    className="h-9 text-xs rounded-md bg-background border-zinc-200 dark:border-zinc-800 focus-visible:ring-1 font-mono"
                    value={emergencyContactPhone}
                    onChange={(e) => setEmergencyContactPhone(e.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="emergency-relation" className="text-xs font-semibold text-foreground">
                    Relationship <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={emergencyContactRelation}
                    onValueChange={(val) => {
                      setEmergencyContactRelation(val)
                      markTouched("emergencyContactRelation")
                    }}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger
                      id="emergency-relation"
                      className={selectTriggerClass("emergencyContactRelation", emergencyContactRelation)}
                    >
                      <SelectValue placeholder="Select..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PARENT" className="text-xs">
                        Parent
                      </SelectItem>
                      <SelectItem value="SIBLING" className="text-xs">
                        Sibling
                      </SelectItem>
                      <SelectItem value="SPOUSE" className="text-xs">
                        Spouse
                      </SelectItem>
                      <SelectItem value="OTHER" className="text-xs">
                        Other
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {selectHasError("emergencyContactRelation", emergencyContactRelation) && (
                    <p className="text-[10px] text-red-500 font-medium">Relationship selection is required</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════
              STEP 5: PRIMARY GUARDIAN & NEXT OF KIN LINKAGE
              Maps to → Guardian (name, relationship, phone, email)
              ═══════════════════════════════════════════════════════ */}
          <div className="relative pl-10 group">
            <StepBadge num={5} />
            <div className="space-y-5">
              <h3 className="text-base font-semibold text-foreground tracking-tight">
                Primary Guardian &amp; Next of Kin Linkage
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="guardian-name" className="text-xs font-semibold text-foreground">
                    Guardian Legal Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="guardian-name"
                    placeholder="e.g. Ebenezer Kofi Mensah"
                    className="h-9 text-xs rounded-md bg-background border-zinc-200 dark:border-zinc-800 focus-visible:ring-1"
                    value={guardianName}
                    onChange={(e) => setGuardianName(e.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="guardian-rel" className="text-xs font-semibold text-foreground">
                    Relationship Matrix <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={guardianRelationship}
                    onValueChange={(val) => {
                      setGuardianRelationship(val)
                      markTouched("guardianRelationship")
                    }}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger
                      id="guardian-rel"
                      className={selectTriggerClass("guardianRelationship", guardianRelationship)}
                    >
                      <SelectValue placeholder="Select kinship link..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="FATHER" className="text-xs">
                        Father
                      </SelectItem>
                      <SelectItem value="MOTHER" className="text-xs">
                        Mother
                      </SelectItem>
                      <SelectItem value="SPONSOR_LEGAL" className="text-xs">
                        Legal Guardian
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  {selectHasError("guardianRelationship", guardianRelationship) && (
                    <p className="text-[10px] text-red-500 font-medium">Guardian relationship is required</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="guardian-phone" className="text-xs font-semibold text-foreground">
                    Primary Contact Number <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="guardian-phone"
                    placeholder="e.g. +233 24 XXX XXXX"
                    className="h-9 text-xs rounded-md bg-background border-zinc-200 dark:border-zinc-800 focus-visible:ring-1 font-mono"
                    value={guardianPhone}
                    onChange={(e) => setGuardianPhone(e.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="guardian-email" className="text-xs font-semibold text-foreground">
                    Communication Email Address{" "}
                    <span className="text-zinc-400 dark:text-zinc-500 text-[10px] font-normal">
                      (Optional)
                    </span>
                  </Label>
                  <Input
                    id="guardian-email"
                    type="email"
                    placeholder="e.g. kofi.mensah@net.com"
                    className="h-9 text-xs rounded-md bg-background border-zinc-200 dark:border-zinc-800 focus-visible:ring-1"
                    value={guardianEmail}
                    onChange={(e) => setGuardianEmail(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════
              STEP 6: TREASURY CONFIGURATION & FINANCE LEDGER TIERS
              Maps to → BillingLedger (feeTierId, initialDeposit, currentBalance)
              ═══════════════════════════════════════════════════════ */}
          <div className="relative pl-10 group">
            <StepBadge num={6} isLast />
            <div className="space-y-5">
              <h3 className="text-base font-semibold text-foreground tracking-tight">
                Treasury Configuration &amp; Finance Ledger Tiers
              </h3>

              <div className="space-y-1.5">
                <Label htmlFor="fee-tier" className="text-xs font-semibold text-foreground">
                  Assigned Fee Structures Billing Tier <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={feeTierId}
                  onValueChange={(val) => {
                    setFeeTierId(val)
                    markTouched("feeTierId")
                  }}
                  disabled={isSubmitting}
                >
                  <SelectTrigger
                    id="fee-tier"
                    className={selectTriggerClass("feeTierId", feeTierId)}
                  >
                    <SelectValue placeholder="Assign treasury clearing template..." />
                  </SelectTrigger>
                  <SelectContent>
                    {MOCK_FEE_TIERS.map((tier) => (
                      <SelectItem key={tier.id} value={tier.id} className="text-xs">
                        {tier.name} —{" "}
                        <span className="text-muted-foreground font-medium">{tier.amount}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectHasError("feeTierId", feeTierId) && (
                  <p className="text-[10px] text-red-500 font-medium">Fee tier selection is required</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="deposit" className="text-xs font-semibold text-foreground">
                  Initial Clearing Commit Deposit Amount (GH₵){" "}
                  <span className="text-zinc-400 dark:text-zinc-500 text-[10px] font-normal">
                    (Optional)
                  </span>
                </Label>
                <Input
                  id="deposit"
                  type="number"
                  min="0"
                  placeholder="e.g. 500"
                  className="h-9 text-xs rounded-md bg-background border-zinc-200 dark:border-zinc-800 focus-visible:ring-1"
                  value={initialDeposit}
                  onChange={(e) => setInitialDeposit(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>

              {/* ── FORM ACTIONS ── */}
              <div className="flex items-center justify-end gap-3 pt-5 border-t border-zinc-200 dark:border-zinc-800 bg-transparent">
                <Button
                  variant="ghost"
                  type="button"
                  className="h-9 text-xs font-normal text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
                  asChild
                >
                  <Link href={backConfig.href}>Cancel</Link>
                </Button>
                <Button
                  type="submit"
                  className="h-9 text-xs font-medium px-4 bg-zinc-900 text-zinc-50 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 transition-colors"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Processing Ledger Writes..." : "Finalize Complete Ingestion Workflow"}
                </Button>
              </div>
            </div>
          </div>
        </form>
      </ScrollArea>
    </div>
  )
}

export default function StudentsAddPage() {
  return (
    <React.Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Loading student form…</div>}>
      <ComprehensiveEnrollmentWizard />
    </React.Suspense>
  )
}