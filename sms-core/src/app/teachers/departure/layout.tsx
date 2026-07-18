import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Teacher Departure | Platform Workspace",
  description: "Administrative form interface for onboarding new student profiles into the registry.",
}

export default function AddStudentLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    /* No more hardcoded h-[calc(100vh-4rem)] hacks needed */
    /* pb-16 forces a permanent, elegant dead-zone gap at the bottom of the monitor */
    <div className="w-full max-w-4xl mx-auto flex-1 h-full flex flex-col overflow-hidden pt-6 px-6 pb-16 animate-in fade-in duration-300">
      {children}
    </div>
  )
}