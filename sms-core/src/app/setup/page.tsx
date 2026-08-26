"use client"

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { ApiClientError } from "@/lib/fetch-with-auth"
import {
  bootstrapSetup,
  completeSetup,
  getSetupStatus,
  saveSetupAcademic,
  saveSetupClasses,
  saveSetupCurriculum,
  saveSetupLedger,
  type SetupStatus,
} from "@/lib/api/setup"

type WizardStepId =
  | "welcome"
  | "bootstrap"
  | "signIn"
  | "academic"
  | "classes"
  | "curriculum"
  | "ledger"
  | "finish"

const STEP_META: { id: WizardStepId; label: string }[] = [
  { id: "welcome", label: "Welcome" },
  { id: "bootstrap", label: "School & admin" },
  { id: "signIn", label: "Sign in" },
  { id: "academic", label: "Terms" },
  { id: "classes", label: "Classes" },
  { id: "curriculum", label: "Curriculum" },
  { id: "ledger", label: "Ledger" },
  { id: "finish", label: "Finish" },
]

const DEFAULT_CLASSES = [
  "JHS 1 A",
  "JHS 2 A",
  "JHS 3 A",
  "SHS 1 General Arts",
  "SHS 2 General Arts",
  "SHS 3 General Arts",
  "SHS 1 Science",
  "SHS 2 Science",
  "SHS 3 Science",
].join("\n")

const DEFAULT_DEPARTMENTS = [
  "Mathematics Department,MATH",
  "Science Department,SCI",
  "Languages Department,LANG",
  "Humanities Department,HUM",
  "Business Department,BUS",
].join("\n")

const DEFAULT_SUBJECTS = [
  "Core Mathematics,MATH-CORE",
  "English Language,ENG-CORE",
  "Integrated Science,SCI-INT",
  "Social Studies,SOC-ST",
  "ICT,ICT-101",
  "Physics,PHY-201",
  "Chemistry,CHE-201",
  "Biology,BIO-201",
  "Economics,ECO-201",
  "Financial Accounting,ACC-201",
].join("\n")

function fieldClassName() {
  return "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
}

function textareaClassName() {
  return "flex min-h-[140px] w-full rounded-md border border-input bg-background px-3 py-2 font-mono text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
}

function parseNameCodeLines(raw: string): Array<{ name: string; code: string }> {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [name, code] = line.split(",").map((part) => part.trim())
      if (!name || !code) {
        throw new Error(`Each line must be "Name,CODE". Invalid: ${line}`)
      }
      return { name, code }
    })
}

function initialStepFromStatus(status: SetupStatus, isAuthenticated: boolean): WizardStepId {
  if (status.setupCompleted) return "finish"

  // No admin yet → cold first-start welcome / bootstrap
  if (!status.hasAdmin) return "welcome"

  // Admin exists but user not signed in
  if (!isAuthenticated) return "signIn"

  // Signed-in admin but no SystemConfig (typical demo DB).
  // Do NOT bounce back to welcome — that looks like sign-in is broken.
  if (!status.initialized) return "finish"

  if (!status.steps.academicTerms) return "academic"
  if (!status.steps.classes) return "classes"
  if (!status.steps.curriculum) return "curriculum"
  if (!status.steps.ledger) return "ledger"
  return "finish"
}

export default function SetupPage() {
  const router = useRouter()
  const { user, isAuthenticated, isLoading: authLoading, login } = useAuth()

  const [status, setStatus] = useState<SetupStatus | null>(null)
  const [step, setStep] = useState<WizardStepId>("welcome")
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [info, setInfo] = useState("")

  const [schoolName, setSchoolName] = useState("")
  const [schoolCode, setSchoolCode] = useState("")
  const [motto, setMotto] = useState("")
  const [address, setAddress] = useState("")
  const [phone, setPhone] = useState("")
  const [schoolEmail, setSchoolEmail] = useState("")
  const [adminName, setAdminName] = useState("")
  const [adminEmail, setAdminEmail] = useState("")
  const [adminPassword, setAdminPassword] = useState("")
  const [adminPasswordConfirm, setAdminPasswordConfirm] = useState("")

  const [loginEmail, setLoginEmail] = useState("")
  const [loginPassword, setLoginPassword] = useState("")

  const year = String(new Date().getFullYear())
  const [academicYear, setAcademicYear] = useState(year)
  const [term1Name, setTerm1Name] = useState(`${year} Term 1`)
  const [term1Start, setTerm1Start] = useState(`${year}-01-15`)
  const [term1End, setTerm1End] = useState(`${year}-04-15`)
  const [term2Name, setTerm2Name] = useState(`${year} Term 2`)
  const [term2Start, setTerm2Start] = useState(`${year}-05-01`)
  const [term2End, setTerm2End] = useState(`${year}-08-01`)
  const [term3Name, setTerm3Name] = useState(`${year} Term 3`)
  const [term3Start, setTerm3Start] = useState(`${year}-09-01`)
  const [term3End, setTerm3End] = useState(`${year}-12-15`)

  const [classesText, setClassesText] = useState(DEFAULT_CLASSES)
  const [departmentsText, setDepartmentsText] = useState(DEFAULT_DEPARTMENTS)
  const [subjectsText, setSubjectsText] = useState(DEFAULT_SUBJECTS)

  const refreshStatus = useCallback(async () => {
    const next = await getSetupStatus()
    setStatus(next)
    return next
  }, [])

  useEffect(() => {
    let cancelled = false
    async function boot() {
      setLoading(true)
      setError("")
      try {
        const next = await getSetupStatus()
        if (cancelled) return
        setStatus(next)
        if (next.setupCompleted) {
          router.replace("/login")
          return
        }
        setStep(initialStepFromStatus(next, Boolean(user)))
        if (next.schoolName) setSchoolName(next.schoolName)
        if (next.schoolCode) setSchoolCode(next.schoolCode)
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unable to load setup status.")
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    if (!authLoading) void boot()
    return () => {
      cancelled = true
    }
  }, [authLoading, router, user])

  useEffect(() => {
    if (!status || authLoading) return
    if (status.hasAdmin && isAuthenticated && step === "signIn") {
      setStep(initialStepFromStatus(status, true))
    }
  }, [status, isAuthenticated, authLoading, step])

  const stepIndex = useMemo(() => STEP_META.findIndex((s) => s.id === step), [step])

  async function withBusy(action: () => Promise<void>) {
    setBusy(true)
    setError("")
    setInfo("")
    try {
      await action()
    } catch (err) {
      setError(
        err instanceof ApiClientError || err instanceof Error
          ? err.message
          : "Something went wrong.",
      )
    } finally {
      setBusy(false)
    }
  }

  async function handleBootstrap(e: FormEvent) {
    e.preventDefault()
    await withBusy(async () => {
      if (adminPassword !== adminPasswordConfirm) {
        throw new Error("Password confirmation does not match.")
      }
      const result = await bootstrapSetup({
        school: {
          schoolName,
          schoolCode,
          motto: motto || null,
          address: address || null,
          phone: phone || null,
          email: schoolEmail || null,
          country: "GH",
          timezone: "Africa/Accra",
          currency: "GHS",
        },
        admin: { fullName: adminName, email: adminEmail, password: adminPassword },
      })
      setStatus(result.status)
      setLoginEmail(result.admin.email)
      setInfo("Founding administrator created. Sign in to continue configuration.")
      setStep("signIn")
    })
  }

  async function handleSignIn(e: FormEvent) {
    e.preventDefault()
    await withBusy(async () => {
      await login(loginEmail, loginPassword)
      const next = await refreshStatus()
      setStep(initialStepFromStatus(next, true))
      setInfo("Signed in. Continue configuring the school.")
    })
  }

  async function handleAcademic(e: FormEvent) {
    e.preventDefault()
    await withBusy(async () => {
      const next = await saveSetupAcademic({
        terms: [
          {
            name: term1Name,
            academicYear,
            startDate: term1Start,
            endDate: term1End,
            isActive: true,
          },
          {
            name: term2Name,
            academicYear,
            startDate: term2Start,
            endDate: term2End,
            isActive: true,
          },
          {
            name: term3Name,
            academicYear,
            startDate: term3Start,
            endDate: term3End,
            isActive: true,
          },
        ],
      })
      setStatus(next)
      setStep("classes")
    })
  }

  async function handleClasses(e: FormEvent) {
    e.preventDefault()
    await withBusy(async () => {
      const classes = classesText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .map((name) => {
          const sectionMatch = name.match(/\s([A-Z0-9]{1,4})$/i)
          return { name, section: sectionMatch?.[1] ?? null, isActive: true }
        })
      if (classes.length === 0) throw new Error("Add at least one class.")
      const next = await saveSetupClasses({ classes })
      setStatus(next)
      setStep("curriculum")
    })
  }

  async function handleCurriculum(e: FormEvent) {
    e.preventDefault()
    await withBusy(async () => {
      const next = await saveSetupCurriculum({
        departments: parseNameCodeLines(departmentsText),
        subjects: parseNameCodeLines(subjectsText),
      })
      setStatus(next)
      setStep("ledger")
    })
  }

  async function handleLedger(e: FormEvent) {
    e.preventDefault()
    await withBusy(async () => {
      const next = await saveSetupLedger({ useDefaults: true })
      setStatus(next)
      setStep("finish")
    })
  }

  async function handleComplete() {
    await withBusy(async () => {
      const next = await completeSetup()
      setStatus(next)
      setInfo("Setup complete. Redirecting…")
      router.replace("/dashboard")
    })
  }

  if (loading || authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4 text-sm text-muted-foreground">
        Loading first-start wizard…
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto w-full max-w-3xl space-y-8">
        <header className="space-y-3 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-xl font-bold text-primary-foreground">
            Ω
          </div>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">First-start setup</h1>
            <p className="text-sm text-muted-foreground">
              Configure your school once. No demo students or fake finances are loaded here.
            </p>
          </div>
        </header>

        <ol className="flex flex-wrap items-center justify-center gap-2">
          {STEP_META.map((item, index) => {
            const active = item.id === step
            const done = index < stepIndex
            return (
              <li
                key={item.id}
                className={`rounded-full px-3 py-1 text-xs font-medium ${
                  active
                    ? "bg-primary text-primary-foreground"
                    : done
                      ? "bg-primary/15 text-primary"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {index + 1}. {item.label}
              </li>
            )
          })}
        </ol>

        {(error || info) && (
          <div
            className={`rounded-md border p-3 text-sm ${
              error
                ? "border-destructive/50 bg-destructive/10 text-destructive"
                : "border-primary/30 bg-primary/5 text-foreground"
            }`}
          >
            {error || info}
          </div>
        )}

        {status && (
          <div className="rounded-lg border bg-card p-4 text-xs text-muted-foreground">
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              <span>School: {status.schoolName || "—"}</span>
              <span>Code: {status.schoolCode || "—"}</span>
              <span>Admin exists: {status.hasAdmin ? "yes" : "no"}</span>
              <span>Session: {isAuthenticated ? user?.email || "signed in" : "none"}</span>
            </div>
          </div>
        )}

        <section className="rounded-xl border bg-card p-6 shadow-sm">
          {step === "welcome" && (
            <div className="space-y-5">
              <h2 className="text-lg font-semibold">Welcome</h2>
              {status?.hasAdmin && !status.initialized && (
                <p className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                  This database still has an administrator (likely demo data). Bootstrap cannot run
                  until demo data is wiped. You can sign in with the existing admin and continue
                  configuration, or wipe first for a true empty first-start.
                </p>
              )}
              <p className="text-sm text-muted-foreground">
                This wizard creates your school profile, founding admin, academic structure, and a
                zero-balance chart of accounts.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busy || Boolean(status?.hasAdmin && !status.initialized)}
                  onClick={() => setStep("bootstrap")}
                  className="flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                >
                  Begin setup
                </button>
                {status?.hasAdmin && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setStep("signIn")}
                    className="flex h-10 items-center justify-center rounded-md border px-4 text-sm font-medium hover:bg-muted"
                  >
                    Sign in to continue
                  </button>
                )}
              </div>
            </div>
          )}

          {step === "bootstrap" && (
            <form onSubmit={handleBootstrap} className="space-y-5">
              <h2 className="text-lg font-semibold">School profile & founding admin</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2 sm:col-span-2">
                  <label className="text-sm font-medium" htmlFor="schoolName">
                    School name
                  </label>
                  <input
                    id="schoolName"
                    className={fieldClassName()}
                    value={schoolName}
                    onChange={(e) => setSchoolName(e.target.value)}
                    required
                    placeholder="e.g. Achimota School"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="schoolCode">
                    School code
                  </label>
                  <input
                    id="schoolCode"
                    className={fieldClassName()}
                    value={schoolCode}
                    onChange={(e) => setSchoolCode(e.target.value.toUpperCase())}
                    required
                    placeholder="ACH"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium" htmlFor="phone">
                    Phone
                  </label>
                  <input
                    id="phone"
                    className={fieldClassName()}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+233…"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <label className="text-sm font-medium" htmlFor="motto">
                    Motto (optional)
                  </label>
                  <input
                    id="motto"
                    className={fieldClassName()}
                    value={motto}
                    onChange={(e) => setMotto(e.target.value)}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <label className="text-sm font-medium" htmlFor="address">
                    Address (optional)
                  </label>
                  <input
                    id="address"
                    className={fieldClassName()}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <label className="text-sm font-medium" htmlFor="schoolEmail">
                    School email (optional)
                  </label>
                  <input
                    id="schoolEmail"
                    type="email"
                    className={fieldClassName()}
                    value={schoolEmail}
                    onChange={(e) => setSchoolEmail(e.target.value)}
                  />
                </div>
              </div>
              <div className="border-t pt-4">
                <h3 className="mb-3 text-sm font-semibold">Founding administrator</h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <label className="text-sm font-medium" htmlFor="adminName">
                      Full name
                    </label>
                    <input
                      id="adminName"
                      className={fieldClassName()}
                      value={adminName}
                      onChange={(e) => setAdminName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2 sm:col-span-2">
                    <label className="text-sm font-medium" htmlFor="adminEmail">
                      Email (login)
                    </label>
                    <input
                      id="adminEmail"
                      type="email"
                      className={fieldClassName()}
                      value={adminEmail}
                      onChange={(e) => setAdminEmail(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="adminPassword">
                      Password
                    </label>
                    <input
                      id="adminPassword"
                      type="password"
                      className={fieldClassName()}
                      value={adminPassword}
                      onChange={(e) => setAdminPassword(e.target.value)}
                      required
                      minLength={10}
                      placeholder="Min 10 chars, letter + number"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium" htmlFor="adminPasswordConfirm">
                      Confirm password
                    </label>
                    <input
                      id="adminPasswordConfirm"
                      type="password"
                      className={fieldClassName()}
                      value={adminPasswordConfirm}
                      onChange={(e) => setAdminPasswordConfirm(e.target.value)}
                      required
                      minLength={10}
                    />
                  </div>
                </div>
              </div>
              <button
                type="submit"
                disabled={busy}
                className="flex h-10 w-full items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {busy ? "Creating…" : "Create school & admin"}
              </button>
            </form>
          )}

          {step === "signIn" && (
            <form onSubmit={handleSignIn} className="space-y-4">
              <h2 className="text-lg font-semibold">Sign in as administrator</h2>
              <p className="text-sm text-muted-foreground">
                Remaining steps require an ADMIN session.
              </p>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="loginEmail">
                  Email
                </label>
                <input
                  id="loginEmail"
                  type="email"
                  className={fieldClassName()}
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="loginPassword">
                  Password
                </label>
                <input
                  id="loginPassword"
                  type="password"
                  className={fieldClassName()}
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  required
                />
              </div>
              <button
                type="submit"
                disabled={busy}
                className="flex h-10 w-full items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {busy ? "Signing in…" : "Sign in & continue"}
              </button>
            </form>
          )}

          {step === "academic" && (
            <form onSubmit={handleAcademic} className="space-y-4">
              <h2 className="text-lg font-semibold">Academic year & terms</h2>
              <div className="space-y-2">
                <label className="text-sm font-medium" htmlFor="academicYear">
                  Academic year label
                </label>
                <input
                  id="academicYear"
                  className={fieldClassName()}
                  value={academicYear}
                  onChange={(e) => setAcademicYear(e.target.value)}
                  required
                />
              </div>
              {(
                [
                  {
                    label: "Term 1",
                    name: term1Name,
                    setName: setTerm1Name,
                    start: term1Start,
                    setStart: setTerm1Start,
                    end: term1End,
                    setEnd: setTerm1End,
                  },
                  {
                    label: "Term 2",
                    name: term2Name,
                    setName: setTerm2Name,
                    start: term2Start,
                    setStart: setTerm2Start,
                    end: term2End,
                    setEnd: setTerm2End,
                  },
                  {
                    label: "Term 3",
                    name: term3Name,
                    setName: setTerm3Name,
                    start: term3Start,
                    setStart: setTerm3Start,
                    end: term3End,
                    setEnd: setTerm3End,
                  },
                ] as const
              ).map((term) => (
                <div key={term.label} className="grid gap-3 rounded-md border p-3 sm:grid-cols-3">
                  <div className="space-y-1 sm:col-span-3">
                    <label className="text-xs font-medium text-muted-foreground">
                      {term.label} name
                    </label>
                    <input
                      className={fieldClassName()}
                      value={term.name}
                      onChange={(e) => term.setName(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">Start</label>
                    <input
                      type="date"
                      className={fieldClassName()}
                      value={term.start}
                      onChange={(e) => term.setStart(e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-muted-foreground">End</label>
                    <input
                      type="date"
                      className={fieldClassName()}
                      value={term.end}
                      onChange={(e) => term.setEnd(e.target.value)}
                      required
                    />
                  </div>
                </div>
              ))}
              <button
                type="submit"
                disabled={busy}
                className="flex h-10 w-full items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {busy ? "Saving…" : "Save terms"}
              </button>
            </form>
          )}

          {step === "classes" && (
            <form onSubmit={handleClasses} className="space-y-4">
              <h2 className="text-lg font-semibold">Classes / sections</h2>
              <p className="text-sm text-muted-foreground">One class name per line.</p>
              <textarea
                className={textareaClassName()}
                value={classesText}
                onChange={(e) => setClassesText(e.target.value)}
                required
              />
              <button
                type="submit"
                disabled={busy}
                className="flex h-10 w-full items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {busy ? "Saving…" : "Save classes"}
              </button>
            </form>
          )}

          {step === "curriculum" && (
            <form onSubmit={handleCurriculum} className="space-y-4">
              <h2 className="text-lg font-semibold">Departments & subjects</h2>
              <p className="text-sm text-muted-foreground">
                Format: <code className="rounded bg-muted px-1">Name,CODE</code> — one per line.
              </p>
              <div className="space-y-2">
                <label className="text-sm font-medium">Departments</label>
                <textarea
                  className={textareaClassName()}
                  value={departmentsText}
                  onChange={(e) => setDepartmentsText(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Subjects</label>
                <textarea
                  className={textareaClassName()}
                  value={subjectsText}
                  onChange={(e) => setSubjectsText(e.target.value)}
                  required
                />
              </div>
              <button
                type="submit"
                disabled={busy}
                className="flex h-10 w-full items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {busy ? "Saving…" : "Save curriculum"}
              </button>
            </form>
          )}

          {step === "ledger" && (
            <form onSubmit={handleLedger} className="space-y-4">
              <h2 className="text-lg font-semibold">Chart of accounts</h2>
              <p className="text-sm text-muted-foreground">
                Seed a standard Ghana-friendly chart of accounts with{" "}
                <strong>zero balances</strong>.
              </p>
              <button
                type="submit"
                disabled={busy}
                className="flex h-10 w-full items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {busy ? "Seeding…" : "Seed default ledger"}
              </button>
            </form>
          )}

          {step === "finish" && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Finish first-start</h2>
              <ul className="space-y-2 text-sm">
                {status &&
                  (
                    [
                      ["School profile", status.steps.schoolProfile],
                      ["Administrator", status.steps.adminAccount],
                      ["Academic terms", status.steps.academicTerms],
                      ["Classes", status.steps.classes],
                      ["Curriculum", status.steps.curriculum],
                      ["Ledger", status.steps.ledger],
                    ] as const
                  ).map(([label, doneFlag]) => (
                    <li key={label} className="flex items-center gap-2">
                      <span
                        className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold ${
                          doneFlag
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {doneFlag ? "✓" : "·"}
                      </span>
                      {label}
                    </li>
                  ))}
              </ul>
              {!status?.steps.schoolProfile && (
                <div className="space-y-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
                  <p className="font-medium text-amber-900 dark:text-amber-200">
                    Signed in, but this database still has demo data without a first-start school profile.
                  </p>
                  <p className="text-muted-foreground">
                    Bootstrap cannot create a second admin, and setup steps need an empty DB (or a
                    wiped DB). Complete is disabled until you wipe demo data and run Begin setup.
                  </p>
                  <ol className="list-decimal space-y-1 pl-5 text-muted-foreground">
                    <li>Stop and wipe the database (backup first).</li>
                    <li>Restart Docker without RUN_SEED.</li>
                    <li>Open /setup → Begin setup with your real school + admin.</li>
                  </ol>
                </div>
              )}
              <button
                type="button"
                disabled={busy || !isAuthenticated || !status?.initialized}
                onClick={() => void handleComplete()}
                className="flex h-10 w-full items-center justify-center rounded-md bg-primary text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
              >
                {busy ? "Completing…" : "Complete setup & open dashboard"}
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
