  "use client"

  import * as React from "react"
  import Link from "next/link"
  import { useRouter, useSearchParams } from "next/navigation"
  import { ArrowLeft, CheckCircle2, AlertCircle, ShieldCheck, Plus } from "lucide-react"
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
  import type { ReferenceClass } from "@/lib/api/reference"
  import { useClasses } from "@/lib/api/reference"




  // ── TYPE DEFINITIONS ──
  type FormState = "idle" | "submitting" | "success" | "error"

  // D-08: the MOCK_CLASSES / MOCK_FEE_TIERS arrays used invented IDs
  // (cls-1, tier-std) that do not exist in the database, so every
  // submission carried invalid foreign keys. Shapes now come from the
  // live /api/reference catalogue.
  type ClassOption = ReferenceClass

  // ── FEE BANDS — display mirror of NEW_ENROLLEE_FEE_BANDS (backend). ──
  // The server is the source of truth and enforces the same schedule; this
  // exists only to preview the charge while the class is being chosen.
  const ENROLLEE_FEE_BANDS = [
    { pattern: /^(creche|nursery|kg\b|kindergarten)/i, admission: 700, uniform: 700, tuition: 450, label: "Early Years (Creche – KG 2)" },
    { pattern: /^(grade|basic|primary|class\s*\d)/i, admission: 700, uniform: 700, tuition: 500, label: "Basic (Grade 1 – 6)" },
    { pattern: /^(jhs|junior)/i, admission: 700, uniform: 840, tuition: 600, label: "JHS (1 – 3)" },
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
    const [boardingStatus, setBoardingStatus] = React.useState("")

    // ── STEP 4: STATUTORY COMPLIANCE & NATIONAL IDENTITY ──
    const [ghanaCardNumber, setGhanaCardNumber] = React.useState("")

    // ── STEP 5: GUARDIANS (UP TO TWO; FIRST IS PRIMARY/DEFAULT) ──
    const [guardianName, setGuardianName] = React.useState("")
    const [guardianRelationship, setGuardianRelationship] = React.useState("")
    const [guardianPhone, setGuardianPhone] = React.useState("")
    const [guardianEmail, setGuardianEmail] = React.useState("")
    const [secondGuardianOpen, setSecondGuardianOpen] = React.useState(false)
    const [secondGuardianName, setSecondGuardianName] = React.useState("")
    const [secondGuardianRelationship, setSecondGuardianRelationship] = React.useState("")
    const [secondGuardianPhone, setSecondGuardianPhone] = React.useState("")
    const [secondGuardianEmail, setSecondGuardianEmail] = React.useState("")

    // ── STEP 6: FEES (AUTO FROM CLASS) & INITIAL DEPOSIT ──
    const [initialDeposit, setInitialDeposit] = React.useState("")

    // ── SERVER CONFIRMATION TELEMETRY ──
    const [createdStudentId, setCreatedStudentId] = React.useState<string | null>(null)
    const [createdStudentName, setCreatedStudentName] = React.useState<string | null>(null)

    // ── REFERENCE DATA (live, from /api/reference) ──
    const { data: classes = [], isLoading: classesLoading } = useClasses()

    // Fee structure is derived from the selected class (no manual picker).
    const selectedClass = classes.find((c) => c.id === classId)
    const selectedFeeBand = React.useMemo(
      () =>
        selectedClass
          ? ENROLLEE_FEE_BANDS.find((b) => b.pattern.test((selectedClass.name || "").trim())) ?? null
          : null,
      [selectedClass]
    )

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
      if (!boardingStatus) missingFields.push("Institutional Housing Plan")

      // Step 4 — Ghana Card format check
      if (ghanaCardNumber && !isGhanaCardValid) {
        setFormState("error")
        setErrorMessage("National ID / Ghana Card format is invalid. Expected: GHA-XXXXXXXXX-X")
        return
      }

      // Step 5 — Guardian + optional second guardian
      if (!guardianName.trim()) missingFields.push("Guardian Legal Name")
      if (!guardianRelationship) missingFields.push("Guardian Relationship")
      if (!guardianPhone.trim()) missingFields.push("Guardian Primary Contact Number")
      if (secondGuardianOpen) {
        if (!secondGuardianName.trim()) missingFields.push("Second Guardian Name")
        if (!secondGuardianRelationship) missingFields.push("Second Guardian Relationship")
        if (!secondGuardianPhone.trim()) missingFields.push("Second Guardian Phone")
      }

      // ── FAIL FAST ON FRONTEND ──
      if (missingFields.length > 0) {
        // Mark all select fields as touched so their red borders appear
        const selectFields = ["gender", "classId", "boardingStatus", "guardianRelationship", "secondGuardianRelationship"]
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
        // Track is not user-facing; every student sits in the standard basic
        // curriculum, so the non-null DB column always receives CORE_BASE.
        placement: { classId, academicTrack: "CORE_BASE", boardingStatus },
        compliance: {
          nationalId: ghanaCardNumber.trim() || null,
        },
        guardian: {
          name: guardianName.trim(),
          relationship: guardianRelationship,
          phone: guardianPhone.trim(),
          email: guardianEmail.trim() || null,
        },
        guardian2: secondGuardianOpen
          ? {
              name: secondGuardianName.trim(),
              relationship: secondGuardianRelationship,
              phone: secondGuardianPhone.trim(),
              email: secondGuardianEmail.trim() || null,
            }
          : undefined,
        // feeTierId intentionally omitted: the server derives the band tier
        // (admission + uniform + termly tuition) from the selected class.
        billing: {
          initialDeposit: initialDeposit ? parseFloat(initialDeposit) : 0,
        },
      }

      // ═══════════════════════════════════════════════════════════
      // API TRANSMISSION
      // ═══════════════════════════════════════════════════════════
      try {
        const response = await fetchWithAuth("/students", {
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
                className="h-11 text-sm sm:h-9 sm:text-xs border-zinc-200 dark:border-zinc-800"
                onClick={handleSkip}
              >
                Retain as Applicant
              </Button>
              <Button
                className="h-11 text-sm sm:h-9 sm:text-xs px-4 bg-zinc-900 text-zinc-50 hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
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
      <div className="absolute left-0 top-0 hidden h-full flex-col items-center sm:flex">
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
      <div className="mx-auto flex w-full max-w-3xl flex-col space-y-5 bg-transparent py-3 sm:space-y-6 sm:py-4">
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
            <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-3xl">Enroll new student</h1>
            <p className="mt-1 hidden text-xs text-muted-foreground sm:block sm:text-sm">
              Add the student&apos;s account, personal details, class, contacts and fee plan.
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
        <ScrollArea className="h-auto max-h-none w-full rounded-none border-none bg-transparent shadow-none md:h-[700px]">
          <form onSubmit={handleSubmit} className="space-y-8 pb-28 pr-0 sm:space-y-12 sm:pb-12 sm:pr-4">
            {/* ═══════════════════════════════════════════════════════
                STEP 1: ACCOUNT ACCESS & CORE CREDENTIALS
                Maps to → StudentAccount (portalEmail, passwordHash)
                ═══════════════════════════════════════════════════════ */}
            <div className="relative pl-0 group sm:pl-10">
              <StepBadge num={1} />
              <div className="space-y-5">
                <h3 className="text-base font-semibold text-foreground tracking-tight">
                  Account Access &amp; Core Credentials
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="full-name" className="text-sm font-semibold sm:text-xs text-foreground">
                      Full Legal Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="full-name"
                      placeholder="e.g. Ama Serwaa Mensah"
                      className="h-11 text-sm sm:h-9 sm:text-xs rounded-md bg-background border-zinc-200 dark:border-zinc-800 focus-visible:ring-1"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="enrollment-date" className="text-sm font-semibold sm:text-xs text-foreground">
                      Official Enrollment Date <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="enrollment-date"
                      type="date"
                      className="h-11 text-sm sm:h-9 sm:text-xs rounded-md bg-background border-zinc-200 dark:border-zinc-800 focus-visible:ring-1"
                      value={enrollmentDate}
                      onChange={(e) => setEnrollmentDate(e.target.value)}
                      required
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="student-email" className="text-sm font-semibold sm:text-xs text-foreground">
                      Portal Access Address <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="student-email"
                      type="email"
                      placeholder="e.g. student.name@domain.edu"
                      className="h-11 text-sm sm:h-9 sm:text-xs rounded-md bg-background border-zinc-200 dark:border-zinc-800 focus-visible:ring-1"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="student-password" className="text-sm font-semibold sm:text-xs text-foreground">
                      Temporary Security Token <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="student-password"
                      type="password"
                      placeholder="Minimum 6 characters"
                      className="h-11 text-sm sm:h-9 sm:text-xs rounded-md bg-background border-zinc-200 dark:border-zinc-800 focus-visible:ring-1"
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
            <div className="relative pl-0 group sm:pl-10">
              <StepBadge num={2} />
              <div className="space-y-5">
                <h3 className="text-base font-semibold text-foreground tracking-tight">
                  Personal Demographics &amp; Background
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="religion" className="text-sm font-semibold sm:text-xs text-foreground">
                      Religion Affiliation{" "}
                      <span className="text-zinc-400 dark:text-zinc-500 text-[10px] font-normal">
                        (Optional)
                      </span>
                    </Label>
                    <Input
                      id="religion"
                      placeholder="e.g. Christian, Islamic, Traditional"
                      className="h-11 text-sm sm:h-9 sm:text-xs rounded-md bg-background border-zinc-200 dark:border-zinc-800 focus-visible:ring-1"
                      value={religion}
                      onChange={(e) => setReligion(e.target.value)}
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="gender" className="text-sm font-semibold sm:text-xs text-foreground">
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
                    <Label htmlFor="blood-type" className="text-sm font-semibold sm:text-xs text-foreground">
                      Blood Group{" "}
                      <span className="text-zinc-400 dark:text-zinc-500 text-[10px] font-normal">
                        (Optional)
                      </span>
                    </Label>
                    <Select value={bloodType} onValueChange={setBloodType} disabled={isSubmitting}>
                      <SelectTrigger
                        id="blood-type"
                        className="h-11 text-sm sm:h-9 sm:text-xs rounded-md bg-background border-zinc-200 dark:border-zinc-800 focus:ring-1"
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
                    <Label htmlFor="dob" className="text-sm font-semibold sm:text-xs text-foreground">
                      Date of Birth <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="dob"
                      type="date"
                      className="h-11 text-sm sm:h-9 sm:text-xs rounded-md bg-background border-zinc-200 dark:border-zinc-800 focus-visible:ring-1"
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
                    placeholder="e.g. House No. 12, Anaji Residential Area, Takoradi"
                    className="h-11 text-sm sm:h-9 sm:text-xs rounded-md bg-background border-zinc-200 dark:border-zinc-800 focus-visible:ring-1"
                    value={residentialAddress}
                    onChange={(e) => setResidentialAddress(e.target.value)}
                    required
                    disabled={isSubmitting}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="former-school" className="text-sm font-semibold sm:text-xs text-foreground">
                      Prior Education{" "}
                      <span className="text-zinc-400 dark:text-zinc-500 text-[10px] font-normal">
                        (Optional)
                      </span>
                    </Label>
                    <Input
                      id="former-school"
                      placeholder="e.g. Accra Academy, KNUST"
                      className="h-11 text-sm sm:h-9 sm:text-xs rounded-md bg-background border-zinc-200 dark:border-zinc-800 focus-visible:ring-1"
                      value={formerSchool}
                      onChange={(e) => setFormerSchool(e.target.value)}
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="medical" className="text-sm font-semibold sm:text-xs text-foreground">
                      Medical Notes / Allergies{" "}
                      <span className="text-zinc-400 dark:text-zinc-500 text-[10px] font-normal">
                        (Optional)
                      </span>
                    </Label>
                    <Input
                      id="medical"
                      placeholder="e.g. Asthmatic. Leave blank if none."
                      className="h-11 text-sm sm:h-9 sm:text-xs rounded-md bg-background border-zinc-200 dark:border-zinc-800 focus-visible:ring-1"
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
                Maps to → Placement (classId, boardingStatus)
                ═══════════════════════════════════════════════════════ */}
            <div className="relative pl-0 group sm:pl-10">
              <StepBadge num={3} />
              <div className="space-y-5">
                <h3 className="text-base font-semibold text-foreground tracking-tight">
                  Academic Placement
                </h3>

                <div className="space-y-1.5">
                  <Label htmlFor="student-class" className="text-sm font-semibold sm:text-xs text-foreground">
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
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectHasError("classId", classId) && (
                    <p className="text-[10px] text-red-500 font-medium">Class selection is required</p>
                  )}
                </div>

                <div className="space-y-1.5">
                    <Label htmlFor="boarding" className="text-sm font-semibold sm:text-xs text-foreground">
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

            {/* ═══════════════════════════════════════════════════════
                STEP 4: STATUTORY COMPLIANCE & NATIONAL IDENTITY
                Maps to → StudentCompliance (nationalId, optional)
                ═══════════════════════════════════════════════════════ */}
            <div className="relative pl-0 group sm:pl-10">
              <StepBadge num={4} />
              <div className="space-y-5">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-zinc-500 dark:text-zinc-400" />
                  <h3 className="text-base font-semibold text-foreground tracking-tight">
                    Statutory Compliance &amp; National Identity
                  </h3>
                </div>

                {/* Ghana Card — full-width, prominent */}
                <div className="space-y-1.5">
                  <Label htmlFor="ghana-card" className="text-sm font-semibold sm:text-xs text-foreground">
                    National ID Token / Ghana Card{" "}
                    <span className="text-zinc-400 dark:text-zinc-500 text-[10px] font-normal">
                      (Optional — leave blank if none)
                    </span>
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

              </div>
            </div>

            {/* ═══════════════════════════════════════════════════════
                STEP 5: GUARDIANS (UP TO TWO; FIRST IS PRIMARY/DEFAULT)
                Maps to → Guardian[] (name, relationship, phone, email)
                ═══════════════════════════════════════════════════════ */}
            <div className="relative pl-0 group sm:pl-10">
              <StepBadge num={5} />
              <div className="space-y-5">
                <h3 className="text-base font-semibold text-foreground tracking-tight">
                  Guardians &amp; Next of Kin
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="guardian-name" className="text-sm font-semibold sm:text-xs text-foreground">
                      Guardian Legal Name <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="guardian-name"
                      placeholder="e.g. Ebenezer Kofi Mensah"
                      className="h-11 text-sm sm:h-9 sm:text-xs rounded-md bg-background border-zinc-200 dark:border-zinc-800 focus-visible:ring-1"
                      value={guardianName}
                      onChange={(e) => setGuardianName(e.target.value)}
                      required
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="guardian-rel" className="text-sm font-semibold sm:text-xs text-foreground">
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
                    <Label htmlFor="guardian-phone" className="text-sm font-semibold sm:text-xs text-foreground">
                      Primary Contact Number <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="guardian-phone"
                      placeholder="e.g. +233 24 XXX XXXX"
                      className="h-11 text-sm sm:h-9 sm:text-xs rounded-md bg-background border-zinc-200 dark:border-zinc-800 focus-visible:ring-1 font-mono"
                      value={guardianPhone}
                      onChange={(e) => setGuardianPhone(e.target.value)}
                      required
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="guardian-email" className="text-sm font-semibold sm:text-xs text-foreground">
                      Communication Email Address{" "}
                      <span className="text-zinc-400 dark:text-zinc-500 text-[10px] font-normal">
                        (Optional)
                      </span>
                    </Label>
                    <Input
                      id="guardian-email"
                      type="email"
                      placeholder="e.g. kofi.mensah@net.com"
                      className="h-11 text-sm sm:h-9 sm:text-xs rounded-md bg-background border-zinc-200 dark:border-zinc-800 focus-visible:ring-1"
                      value={guardianEmail}
                      onChange={(e) => setGuardianEmail(e.target.value)}
                      disabled={isSubmitting}
                    />
                  </div>
                </div>

                <div className="pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isSubmitting}
                    onClick={() => {
                      if (secondGuardianOpen) {
                        setSecondGuardianOpen(false)
                        setSecondGuardianName("")
                        setSecondGuardianRelationship("")
                        setSecondGuardianPhone("")
                        setSecondGuardianEmail("")
                      } else {
                        setSecondGuardianOpen(true)
                      }
                    }}
                    className="h-8 gap-1.5 border-zinc-200 text-xs font-medium tracking-wide text-zinc-700 shadow-none transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-900/60"
                  >
                    <Plus className="h-3.5 w-3.5 text-zinc-500" />
                    {secondGuardianOpen ? "Remove second guardian" : "Add second guardian"}
                  </Button>
                </div>

                {secondGuardianOpen && (
                  <div className="space-y-4 rounded-md border border-dashed border-zinc-300 p-4 dark:border-zinc-700">
                    <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                      Second guardian — additional contact. The first guardian above remains the default.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="guardian2-name" className="text-sm font-semibold sm:text-xs text-foreground">
                          Legal Name <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="guardian2-name"
                          placeholder="e.g. Comfort Mensah"
                          className="h-11 text-sm sm:h-9 sm:text-xs rounded-md bg-background border-zinc-200 dark:border-zinc-800 focus-visible:ring-1"
                          value={secondGuardianName}
                          onChange={(e) => setSecondGuardianName(e.target.value)}
                          disabled={isSubmitting}
                        />
                        {selectHasError("secondGuardianName", secondGuardianName) && (
                          <p className="text-[10px] text-red-500 font-medium">Name is required</p>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="guardian2-rel" className="text-sm font-semibold sm:text-xs text-foreground">
                          Relationship <span className="text-red-500">*</span>
                        </Label>
                        <Select
                          value={secondGuardianRelationship}
                          onValueChange={(val) => {
                            setSecondGuardianRelationship(val)
                            markTouched("secondGuardianRelationship")
                          }}
                          disabled={isSubmitting}
                        >
                          <SelectTrigger
                            id="guardian2-rel"
                            className={selectTriggerClass("secondGuardianRelationship", secondGuardianRelationship)}
                          >
                            <SelectValue placeholder="Select kinship link..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="FATHER" className="text-xs">Father</SelectItem>
                            <SelectItem value="MOTHER" className="text-xs">Mother</SelectItem>
                            <SelectItem value="SPONSOR_LEGAL" className="text-xs">Legal Guardian</SelectItem>
                          </SelectContent>
                        </Select>
                        {selectHasError("secondGuardianRelationship", secondGuardianRelationship) && (
                          <p className="text-[10px] text-red-500 font-medium">Relationship is required</p>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="guardian2-phone" className="text-sm font-semibold sm:text-xs text-foreground">
                          Contact Number <span className="text-red-500">*</span>
                        </Label>
                        <Input
                          id="guardian2-phone"
                          placeholder="e.g. +233 24 XXX XXXX"
                          className="h-11 text-sm sm:h-9 sm:text-xs rounded-md bg-background border-zinc-200 dark:border-zinc-800 focus-visible:ring-1 font-mono"
                          value={secondGuardianPhone}
                          onChange={(e) => setSecondGuardianPhone(e.target.value)}
                          disabled={isSubmitting}
                        />
                        {selectHasError("secondGuardianPhone", secondGuardianPhone) && (
                          <p className="text-[10px] text-red-500 font-medium">Phone is required</p>
                        )}
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="guardian2-email" className="text-sm font-semibold sm:text-xs text-foreground">
                          Email Address{" "}
                          <span className="text-zinc-400 dark:text-zinc-500 text-[10px] font-normal">(Optional)</span>
                        </Label>
                        <Input
                          id="guardian2-email"
                          type="email"
                          placeholder="e.g. comfort.mensah@net.com"
                          className="h-11 text-sm sm:h-9 sm:text-xs rounded-md bg-background border-zinc-200 dark:border-zinc-800 focus-visible:ring-1"
                          value={secondGuardianEmail}
                          onChange={(e) => setSecondGuardianEmail(e.target.value)}
                          disabled={isSubmitting}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ═══════════════════════════════════════════════════════
                STEP 6: FEES (AUTO FROM CLASS) & INITIAL DEPOSIT
                Maps to → BillingLedger (band tier from class, initialDeposit,
                currentBalance) + FIRST TERM 2026/27 invoice (server-side)
                ═══════════════════════════════════════════════════════ */}
            <div className="relative pl-0 group sm:pl-10">
              <StepBadge num={6} isLast />
              <div className="space-y-5">
                <h3 className="text-base font-semibold text-foreground tracking-tight">
                  Fees &amp; Initial Deposit
                </h3>

                <div className="rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/40">
                  {selectedClass ? (
                    selectedFeeBand ? (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-foreground">
                          {selectedClass.name} — {selectedFeeBand.label}
                        </p>
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div>
                            <p className="text-[10px] text-zinc-500 dark:text-zinc-400">Admission</p>
                            <p className="font-mono text-xs font-medium">GH₵ {selectedFeeBand.admission.toLocaleString("en-GH")}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-zinc-500 dark:text-zinc-400">Uniform</p>
                            <p className="font-mono text-xs font-medium">GH₵ {selectedFeeBand.uniform.toLocaleString("en-GH")}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-zinc-500 dark:text-zinc-400">Term fees</p>
                            <p className="font-mono text-xs font-medium">GH₵ {selectedFeeBand.tuition.toLocaleString("en-GH")}</p>
                          </div>
                        </div>
                        <div className="border-t border-zinc-200 pt-1.5 dark:border-zinc-800">
                          <p className="text-xs">
                            <span className="text-zinc-500 dark:text-zinc-400">Total due — FIRST TERM 2026/27: </span>
                            <span className="font-mono font-semibold text-foreground">
                              GH₵ {(selectedFeeBand.admission + selectedFeeBand.uniform + selectedFeeBand.tuition).toLocaleString("en-GH")}
                            </span>
                          </p>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                        Class “{selectedClass.name}” has no fee structure — pick a class from the academic ladder.
                      </p>
                    )
                  ) : (
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      Select a class above — the fee structure (admission + uniform + term fees) is assigned automatically.
                    </p>
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="deposit" className="text-sm font-semibold sm:text-xs text-foreground">
                    Initial Deposit (GH₵){" "}
                    <span className="text-zinc-400 dark:text-zinc-500 text-[10px] font-normal">
                      (Optional)
                    </span>
                  </Label>
                  <Input
                    id="deposit"
                    type="number"
                    min="0"
                    placeholder="e.g. 500"
                    className="h-11 text-sm sm:h-9 sm:text-xs rounded-md bg-background border-zinc-200 dark:border-zinc-800 focus-visible:ring-1"
                    value={initialDeposit}
                    onChange={(e) => setInitialDeposit(e.target.value)}
                    disabled={isSubmitting}
                  />
                </div>

                {/* ── FORM ACTIONS ── */}
                <div className="sticky bottom-0 z-10 -mx-4 flex flex-col-reverse gap-2 border-t border-zinc-200 bg-background/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:flex-row sm:items-center sm:justify-end sm:gap-3 sm:bg-transparent sm:px-0 sm:pt-5 sm:pb-0 sm:dark:bg-transparent dark:border-zinc-800">
                  <Button
                    variant="ghost"
                    type="button"
                    className="h-11 w-full text-sm font-normal text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900 sm:h-9 sm:w-auto sm:text-xs"
                    asChild
                  >
                    <Link href={backConfig.href}>Cancel</Link>
                  </Button>
                  <Button
                    type="submit"
                    className="h-11 w-full bg-zinc-900 px-4 text-sm font-medium text-zinc-50 transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200 sm:h-9 sm:w-auto sm:text-xs"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Creating student…" : "Create student"}
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