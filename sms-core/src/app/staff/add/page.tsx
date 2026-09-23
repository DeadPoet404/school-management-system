"use client"

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowLeft, CheckCircle2, AlertCircle, ShieldCheck, Phone, Pencil, Lock, ChevronDown, Bus } from "lucide-react"
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

const MOCK_CLEARANCE_LEVELS: ClearanceOption[] = [
  {
    id: "clear-std",
    name: "Level 1: General Staff Access",
    description: "Standard portal read/write",
  },
  {
    id: "clear-fin",
    name: "Level 2: Financial Ledger Access",
    description: "Treasury and fee tracking",
  },
  {
    id: "clear-adm",
    name: "Level 3: Full Super-Admin",
    description: "Unrestricted system configuration",
  },
]

function generatePortalEmail(fullName: string): string {
  const parts = fullName.trim().toLowerCase().split(/[^a-z]+/).filter((p) => p.length > 0)
  if (parts.length === 0) return ""
  const local = parts.length === 1 ? parts[0]! : `${parts[0]}.${parts[parts.length - 1]!}`
  return `${local}@jocomfy.com`
}

function generateTemporaryToken(): string {
  const alphabet = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  if (typeof crypto !== "undefined" && "getRandomValues" in crypto) {
    const bytes = crypto.getRandomValues(new Uint8Array(10))
    let secret = ""
    for (let i = 0; i < bytes.length; i += 1) secret += alphabet[bytes[i]! % alphabet.length]
    return `JCS-${secret}`
  }
  return `JCS-${Math.random().toString(36).slice(2, 12)}`
}

function ComprehensiveStaffEnrollmentWizard() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const fromSource = searchParams.get("from")

  const backConfig = {
    href: fromSource === "operations" ? "/operations" : "/staff",
    label: fromSource === "operations" ? "Back to Operations" : "Back to Staff Registry",
  }

  const [formState, setFormState] = React.useState<FormState>("idle")
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)

  // ── CORE (always required) ──
  const [fullName, setFullName] = React.useState("")
  const [portalOverride, setPortalOverride] = React.useState("")
  const [portalEditing, setPortalEditing] = React.useState(false)
  const [securityToken, setSecurityToken] = React.useState(generateTemporaryToken)
  const [tokenEditing, setTokenEditing] = React.useState(false)
  const [employmentDate, setEmploymentDate] = React.useState("")
  const [staffRole, setStaffRole] = React.useState("STAFF")

  const portalEmail = portalOverride.trim() || generatePortalEmail(fullName)
  const isDriver = staffRole === "DRIVER"

  // ── MINIMAL DRIVER FIELDS ──
  const [phone, setPhone] = React.useState("")
  const [ghanaCardNumber, setGhanaCardNumber] = React.useState("")
  const [emergencyContactName, setEmergencyContactName] = React.useState("")
  const [emergencyContactPhone, setEmergencyContactPhone] = React.useState("")

  // ── ADVANCED OPTIONAL (for non-driver or expanded driver) ──
  const [showAdvanced, setShowAdvanced] = React.useState(false)
  const [dateOfBirth, setDateOfBirth] = React.useState("")
  const [gender, setGender] = React.useState("")
  const [residentialAddress, setResidentialAddress] = React.useState("")
  const [bloodType, setBloodType] = React.useState("")
  const [religion, setReligion] = React.useState("")
  const [formerSchool, setFormerSchool] = React.useState("")
  const [departmentId, setDepartmentId] = React.useState<string>("")
  const [jobTitle, setJobTitle] = React.useState("")
  const [employmentType, setEmploymentType] = React.useState("")
  const [shiftSchedule, setShiftSchedule] = React.useState("")
  const [ssnitNumber, setSsnitNumber] = React.useState("")
  const [clearanceTier, setClearanceTier] = React.useState("")
  const [baseSalary, setBaseSalary] = React.useState("")
  const [bankName, setBankName] = React.useState("")
  const [bankAccount, setBankAccount] = React.useState("")

  const [createdStaffId, setCreatedStaffId] = React.useState<string | null>(null)
  const [createdStaffName, setCreatedStaffName] = React.useState<string | null>(null)

  const { data: departments = [], isLoading: deptsLoading } = useDepartments()
  const isSubmitting = formState === "submitting"

  const handleGhanaCardChange = (value: string) => {
    const stripped = value.replace(/[^A-Za-z0-9]/g, "").toUpperCase()
    let formatted = ""
    if (stripped.length <= 3) formatted = stripped
    else if (stripped.length <= 12) formatted = stripped.slice(0, 3) + "-" + stripped.slice(3)
    else formatted = stripped.slice(0, 3) + "-" + stripped.slice(3, 12) + "-" + stripped.slice(12, 13)
    setGhanaCardNumber(formatted)
  }

  const isGhanaCardValid = React.useMemo(() => {
    if (!ghanaCardNumber) return true
    return /^GHA-\d{9}-\d$/.test(ghanaCardNumber)
  }, [ghanaCardNumber])

  // Auto-expand advanced when non-driver selected
  React.useEffect(() => {
    if (!isDriver) setShowAdvanced(false) // keep collapsed by default but allow toggle
  }, [isDriver])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setFormState("submitting")
    setErrorMessage(null)

    if (!fullName.trim()) {
      setFormState("error")
      setErrorMessage("Full legal name is required.")
      return
    }
    if (!portalEmail) {
      setFormState("error")
      setErrorMessage("Portal email could not be generated. Tap pencil to type one.")
      return
    }
    if (!securityToken.trim() || securityToken.trim().length < 6) {
      setFormState("error")
      setErrorMessage("Security token is required.")
      return
    }
    if (ghanaCardNumber && !isGhanaCardValid) {
      setFormState("error")
      setErrorMessage("Ghana Card format invalid. Expected GHA-XXXXXXXXX-X or leave empty.")
      return
    }

    // Build minimal payload — backend now fills defaults for anything missing
    const staffPayload = {
      account: {
        fullName,
        email: portalEmail,
        password: securityToken.trim(),
        employmentDate: employmentDate || new Date().toISOString().slice(0, 10),
        role: staffRole,
      },
      demographics: {
        dateOfBirth: dateOfBirth || undefined,
        gender: gender || undefined,
        residentialAddress: residentialAddress || undefined,
        phone: phone || undefined,
        bloodType: bloodType || null,
        religion: religion || null,
        formerSchool: formerSchool || null,
      },
      placement: {
        departmentId: departmentId || undefined,
        jobTitle: jobTitle || (isDriver ? "Bus Driver" : undefined),
        employmentType: employmentType || undefined,
        shiftSchedule: shiftSchedule || undefined,
      },
      compliance: {
        nationalId: ghanaCardNumber || null,
        ssnitNumber: ssnitNumber || null,
        emergencyContact: {
          name: emergencyContactName || null,
          phone: emergencyContactPhone || null,
        },
      },
      payroll: {
        clearanceTier: clearanceTier || undefined,
        baseSalary: baseSalary ? parseFloat(baseSalary) : 0,
        bankName: bankName || null,
        bankAccount: bankAccount || null,
      },
    }

    try {
      const response = await fetchWithAuth("/staff", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(staffPayload),
      })
      const rawText = await response.text()
      let json: unknown
      try {
        json = JSON.parse(rawText)
      } catch {
        throw new Error("Server returned non-JSON.")
      }
      if (!response.ok) {
        const err = json as Record<string, unknown>
        throw new Error((err.message as string) || (err.error as string) || `Error ${response.status}`)
      }
      const saved = (json as Record<string, unknown>).data as Record<string, unknown>
      setCreatedStaffId((saved.staffId as string) || (saved.id as string) || null)
      setCreatedStaffName((saved.staffName as string) || (saved.name as string) || null)
      setFormState("success")
      setPortalOverride("")
      setPortalEditing(false)
      setTokenEditing(false)
      setSecurityToken(generateTemporaryToken())
    } catch (err: unknown) {
      setFormState("error")
      setErrorMessage((err as Error)?.message || "Failed to create staff.")
    }
  }

  const handleActivate = async () => {
    if (!createdStaffId) return
    setFormState("submitting")
    try {
      await new Promise((r) => setTimeout(r, 300))
      router.push(backConfig.href)
    } catch (err: unknown) {
      setErrorMessage((err as Error)?.message || "Unable to promote staff.")
      setFormState("error")
    }
  }

  const handleSkip = () => router.push(backConfig.href)

  if (formState === "success") {
    return (
      <div className="flex w-full max-w-3xl flex-col space-y-5">
        <Link href={backConfig.href} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground w-fit group">
          <ArrowLeft className="h-3.5 w-3.5 group-hover:-translate-x-0.5 transition-transform" />
          {backConfig.label}
        </Link>
        <div className="flex flex-col items-center justify-center py-16 gap-4">
          <CheckCircle2 className="h-12 w-12 text-emerald-600" />
          <h2 className="text-2xl font-semibold tracking-tight">Staff Member Enrolled</h2>
          <p className="text-sm text-muted-foreground text-center max-w-md leading-relaxed">
            <span className="font-medium text-foreground">{createdStaffName}</span> saved as{" "}
            <span className="font-mono bg-zinc-100 dark:bg-zinc-900 px-1.5 py-0.5 rounded text-xs">{createdStaffId}</span>
            {isDriver && " — assign a bus in Transport → Drivers."}
          </p>
          <div className="flex items-center gap-3 mt-4">
            <Button variant="ghost" className="h-9 text-xs" onClick={handleSkip}>Back to list</Button>
            <Button className="h-9 text-xs px-4 bg-stone-900 text-white dark:bg-stone-100 dark:text-stone-900" onClick={handleActivate}>Done</Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex w-full max-w-3xl flex-col space-y-5">
      <div className="flex flex-col gap-2">
        <Link href={backConfig.href} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground w-fit group">
          <ArrowLeft className="h-3.5 w-3.5 group-hover:-translate-x-0.5 transition-transform" />
          {backConfig.label}
        </Link>
        <div>
          <h1 className="text-xl font-semibold tracking-tight sm:text-3xl">Add staff member</h1>
          <p className="mt-1 text-xs text-muted-foreground sm:text-sm">
            {isDriver ? "Driver needs only name — everything else is optional. Assign bus after." : "Only name and role are required. Everything else is optional."}
          </p>
        </div>
      </div>

      <hr className="border-stone-200 dark:border-stone-800" />

      {formState === "error" && errorMessage && (
        <div className="flex items-start gap-2 p-3 rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950">
          <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-300">{errorMessage}</p>
        </div>
      )}

      <ScrollArea className="h-auto max-h-none w-full md:h-[680px]">
        <form onSubmit={handleSubmit} className="space-y-8 pb-28 pr-0 sm:pr-4">

          {/* CORE */}
          <div className="space-y-5">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-full border bg-background flex items-center justify-center text-xs font-semibold">1</div>
              <h3 className="text-base font-semibold tracking-tight">Account & Role</h3>
              {isDriver && <span className="ml-2 inline-flex items-center gap-1 text-[11px] bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 px-2 py-0.5 rounded-full"><Bus className="h-3 w-3" />Driver fast-track</span>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Full Legal Name <span className="text-red-500">*</span></Label>
                <Input placeholder="e.g. Samuel Osei Mensah" className="h-9 text-xs rounded-md" value={fullName} onChange={(e) => setFullName(e.target.value)} required disabled={isSubmitting} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">System Role <span className="text-red-500">*</span></Label>
                <Select value={staffRole} onValueChange={setStaffRole} disabled={isSubmitting}>
                  <SelectTrigger className="h-9 text-xs rounded-md"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="STAFF" className="text-xs">STAFF — general ops</SelectItem>
                    <SelectItem value="DRIVER" className="text-xs">DRIVER — bus driver only (minimal form)</SelectItem>
                    <SelectItem value="ADMIN" className="text-xs">ADMIN — full system</SelectItem>
                    <SelectItem value="ACCOUNTANT" className="text-xs">ACCOUNTANT — finance</SelectItem>
                    <SelectItem value="FACULTY" className="text-xs">FACULTY — teaching</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Portal Email <span className="text-red-500">*</span></Label>
                {portalEditing ? (
                  <div className="flex items-center gap-1.5">
                    <Input value={portalOverride} onChange={(e) => setPortalOverride(e.target.value)} autoFocus autoComplete="off" className="h-9 flex-1 text-xs" disabled={isSubmitting} />
                    <Button type="button" variant="outline" onClick={() => setPortalEditing(false)} className="h-9 w-9 p-0"><Lock className="h-3.5 w-3.5" /></Button>
                  </div>
                ) : (
                  <div className="h-9 flex items-center justify-between gap-2 rounded-md bg-stone-50 dark:bg-zinc-900/40 border px-3">
                    <span className="truncate text-xs font-medium">{portalEmail || "…"}</span>
                    <Button type="button" variant="ghost" onClick={() => { setPortalOverride(portalEmail); setPortalEditing(true) }} className="h-7 w-7 p-0 text-stone-400"><Pencil className="h-3.5 w-3.5" /></Button>
                  </div>
                )}
                <p className="text-[11px] text-stone-500">Auto from name — pencil to override.</p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Security Token <span className="text-red-500">*</span></Label>
                {tokenEditing ? (
                  <div className="flex items-center gap-1.5">
                    <Input value={securityToken} onChange={(e) => setSecurityToken(e.target.value)} autoFocus autoComplete="new-password" className="h-9 flex-1 font-mono text-xs" disabled={isSubmitting} />
                    <Button type="button" variant="outline" onClick={() => setTokenEditing(false)} className="h-9 w-9 p-0"><Lock className="h-3.5 w-3.5" /></Button>
                  </div>
                ) : (
                  <div className="h-9 flex items-center justify-between gap-2 rounded-md bg-stone-50 dark:bg-zinc-900/40 border px-3">
                    <span className="truncate font-mono text-xs font-semibold">{securityToken}</span>
                    <Button type="button" variant="ghost" onClick={() => setTokenEditing(true)} className="h-7 w-7 p-0 text-stone-400"><Pencil className="h-3.5 w-3.5" /></Button>
                  </div>
                )}
                <p className="text-[11px] text-stone-500">Auto-generated, share with staff.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Phone <span className="text-stone-400 text-[10px]">(Optional)</span></Label>
                <Input placeholder="+233..." className="h-9 text-xs rounded-md font-mono" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={isSubmitting} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Appointment Date <span className="text-stone-400 text-[10px]">(Optional, defaults today)</span></Label>
                <Input type="date" className="h-9 text-xs rounded-md" value={employmentDate} onChange={(e) => setEmploymentDate(e.target.value)} disabled={isSubmitting} />
              </div>
            </div>
          </div>

          {/* DRIVER MINIMAL */}
          {isDriver ? (
            <div className="space-y-5 rounded-lg border border-amber-200 bg-amber-50/50 dark:border-amber-900/40 dark:bg-amber-950/20 p-4">
              <div className="flex items-center gap-2">
                <Bus className="h-4 w-4 text-amber-700" />
                <h3 className="text-sm font-semibold">Driver details (all optional)</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Ghana Card / License No <span className="text-stone-400 text-[10px]">(Optional)</span></Label>
                  <Input placeholder="GHA-XXXXXXXXX-X" maxLength={16} className={`h-9 text-xs font-mono uppercase ${ghanaCardNumber && !isGhanaCardValid ? "border-red-300" : ""}`} value={ghanaCardNumber} onChange={(e) => handleGhanaCardChange(e.target.value)} disabled={isSubmitting} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Emergency Contact <span className="text-stone-400 text-[10px]">(Optional)</span></Label>
                  <Input placeholder="Name" className="h-9 text-xs" value={emergencyContactName} onChange={(e) => setEmergencyContactName(e.target.value)} disabled={isSubmitting} />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold flex items-center gap-1"><Phone className="h-3 w-3" />Emergency Phone <span className="text-stone-400 text-[10px]">(Optional)</span></Label>
                  <Input placeholder="+233..." className="h-9 text-xs font-mono" value={emergencyContactPhone} onChange={(e) => setEmergencyContactPhone(e.target.value)} disabled={isSubmitting} />
                </div>
              </div>
              <p className="text-[11px] text-amber-800 dark:text-amber-300">That's it. Create driver, then go to Transport → Drivers to assign a bus. Bus assignment is separate.</p>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-stone-500" />
                <h3 className="text-sm font-semibold">Contact (optional)</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Ghana Card <span className="text-stone-400 text-[10px]">(Optional)</span></Label>
                  <Input placeholder="GHA-XXXXXXXXX-X" maxLength={16} className={`h-9 text-xs font-mono uppercase ${ghanaCardNumber && !isGhanaCardValid ? "border-red-300" : ""}`} value={ghanaCardNumber} onChange={(e) => handleGhanaCardChange(e.target.value)} disabled={isSubmitting} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Emergency Contact Name <span className="text-stone-400 text-[10px]">(Optional)</span></Label>
                  <Input placeholder="e.g. Rebecca Mensah" className="h-9 text-xs" value={emergencyContactName} onChange={(e) => setEmergencyContactName(e.target.value)} disabled={isSubmitting} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Emergency Phone <span className="text-stone-400 text-[10px]">(Optional)</span></Label>
                <Input placeholder="+233..." className="h-9 text-xs font-mono" value={emergencyContactPhone} onChange={(e) => setEmergencyContactPhone(e.target.value)} disabled={isSubmitting} />
              </div>
            </div>
          )}

          {/* ADVANCED TOGGLE */}
          <div className="space-y-4">
            <Button type="button" variant="outline" onClick={() => setShowAdvanced(!showAdvanced)} className="h-9 text-xs w-full justify-between">
              <span>{showAdvanced ? "Hide additional details" : isDriver ? "Add more details (optional)" : "Additional details (all optional)"}</span>
              <ChevronDown className={`h-4 w-4 transition-transform ${showAdvanced ? "rotate-180" : ""}`} />
            </Button>

            {showAdvanced && (
              <div className="space-y-8 pt-2">
                {/* Demographics */}
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold flex items-center gap-2"><span className="h-5 w-5 rounded-full border flex items-center justify-center text-[10px]">2</span> Personal (optional)</h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Date of Birth <span className="text-stone-400 text-[10px]">(Optional)</span></Label>
                      <Input type="date" className="h-9 text-xs" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} disabled={isSubmitting} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Gender <span className="text-stone-400 text-[10px]">(Optional)</span></Label>
                      <Select value={gender} onValueChange={setGender} disabled={isSubmitting}>
                        <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="MALE" className="text-xs">Male</SelectItem>
                          <SelectItem value="FEMALE" className="text-xs">Female</SelectItem>
                          <SelectItem value="OTHER" className="text-xs">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Blood Group <span className="text-stone-400 text-[10px]">(Optional)</span></Label>
                      <Select value={bloodType} onValueChange={setBloodType} disabled={isSubmitting}>
                        <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
                        <SelectContent>
                          {["A_PLUS","A_MINUS","B_PLUS","B_MINUS","AB_PLUS","AB_MINUS","O_PLUS","O_MINUS"].map(v=> <SelectItem key={v} value={v} className="text-xs">{v.replace("_","")}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Residential Address <span className="text-stone-400 text-[10px]">(Optional)</span></Label>
                      <Input placeholder="e.g. Plot 42, Airport Ridge" className="h-9 text-xs" value={residentialAddress} onChange={(e) => setResidentialAddress(e.target.value)} disabled={isSubmitting} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Religion <span className="text-stone-400 text-[10px]">(Optional)</span></Label>
                      <Input placeholder="Christian, Islamic..." className="h-9 text-xs" value={religion} onChange={(e) => setReligion(e.target.value)} disabled={isSubmitting} />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Former School <span className="text-stone-400 text-[10px]">(Optional)</span></Label>
                    <Input placeholder="University..." className="h-9 text-xs" value={formerSchool} onChange={(e) => setFormerSchool(e.target.value)} disabled={isSubmitting} />
                  </div>
                </div>

                {/* Placement */}
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold flex items-center gap-2"><span className="h-5 w-5 rounded-full border flex items-center justify-center text-[10px]">3</span> Placement (optional)</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Department <span className="text-stone-400 text-[10px]">(Optional)</span></Label>
                      <Select value={departmentId} onValueChange={setDepartmentId} disabled={isSubmitting || deptsLoading}>
                        <SelectTrigger className="h-9 text-xs"><SelectValue placeholder={deptsLoading ? "Loading..." : "Select department..."} /></SelectTrigger>
                        <SelectContent>
                          {departments.map((dept) => <SelectItem key={dept.id} value={dept.id} className="text-xs">{dept.name} ({dept.code})</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Job Title <span className="text-stone-400 text-[10px]">(Optional)</span></Label>
                      <Input placeholder={isDriver ? "Bus Driver" : "e.g. Senior Accountant"} className="h-9 text-xs" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} disabled={isSubmitting} />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Employment Type <span className="text-stone-400 text-[10px]">(Optional)</span></Label>
                      <Select value={employmentType} onValueChange={setEmploymentType} disabled={isSubmitting}>
                        <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="FULL_TIME" className="text-xs">Full-Time</SelectItem>
                          <SelectItem value="PART_TIME" className="text-xs">Part-Time</SelectItem>
                          <SelectItem value="CONTRACT" className="text-xs">Contract</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Shift <span className="text-stone-400 text-[10px]">(Optional)</span></Label>
                      <Select value={shiftSchedule} onValueChange={setShiftSchedule} disabled={isSubmitting}>
                        <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="MORNING" className="text-xs">Morning (08:00-16:30)</SelectItem>
                          <SelectItem value="EVENING" className="text-xs">Evening (14:00-22:00)</SelectItem>
                          <SelectItem value="NIGHT" className="text-xs">Night (22:00-06:00)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Compliance & Payroll */}
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-stone-500" /> Compliance & Payroll (optional)</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs">SSNIT <span className="text-stone-400 text-[10px]">(Optional)</span></Label>
                      <Input placeholder="N123..." className="h-9 text-xs font-mono text-[11px]" value={ssnitNumber} onChange={(e) => setSsnitNumber(e.target.value)} disabled={isSubmitting} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Clearance Tier <span className="text-stone-400 text-[10px]">(Optional)</span></Label>
                      <Select value={clearanceTier} onValueChange={setClearanceTier} disabled={isSubmitting}>
                        <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Select..." /></SelectTrigger>
                        <SelectContent>
                          {MOCK_CLEARANCE_LEVELS.map(t=> <SelectItem key={t.id} value={t.id} className="text-xs">{t.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Base Salary ₵ <span className="text-stone-400 text-[10px]">(Optional)</span></Label>
                      <Input type="number" min="0" placeholder="e.g. 4500" className="h-9 text-xs" value={baseSalary} onChange={(e) => setBaseSalary(e.target.value)} disabled={isSubmitting} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Bank <span className="text-stone-400 text-[10px]">(Optional)</span></Label>
                      <Input placeholder="GCB, Ecobank..." className="h-9 text-xs" value={bankName} onChange={(e) => setBankName(e.target.value)} disabled={isSubmitting} />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Account No <span className="text-stone-400 text-[10px]">(Optional)</span></Label>
                      <Input placeholder="1011..." className="h-9 text-xs font-mono text-[11px]" value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} disabled={isSubmitting} />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="sticky bottom-0 z-10 -mx-4 flex flex-col-reverse gap-2 border-t bg-background/95 px-4 py-3 backdrop-blur sm:static sm:mx-0 sm:flex-row sm:justify-end sm:gap-3 sm:bg-transparent sm:px-0 sm:pt-5">
            <Button variant="ghost" type="button" className="h-11 w-full text-sm sm:h-9 sm:w-auto sm:text-xs" asChild><Link href={backConfig.href}>Cancel</Link></Button>
            <Button type="submit" className="h-11 w-full bg-stone-900 px-4 text-sm text-white dark:bg-stone-100 dark:text-stone-900 sm:h-9 sm:w-auto sm:text-xs" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : isDriver ? "Create driver" : "Create staff member"}
            </Button>
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
