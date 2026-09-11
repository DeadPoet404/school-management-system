import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Add New Student | Platform Workspace",
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
    <div className="mx-auto flex h-auto w-full max-w-4xl flex-none flex-col overflow-visible px-4 pb-8 pt-4 animate-in fade-in duration-300 sm:px-6 sm:pt-6 md:h-full md:flex-1 md:overflow-hidden md:pb-16">
      {children}
    </div>
  )
}