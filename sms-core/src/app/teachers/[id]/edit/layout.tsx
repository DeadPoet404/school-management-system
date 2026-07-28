import { Metadata } from "next"

export const metadata: Metadata = {
  title: "Edit Teacher | Platform Workspace",
  description: "Administrative form interface for editing existing faculty profiles in the registry.",
}

export default function EditTeacherLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="w-full max-w-4xl mx-auto flex-1 h-full flex flex-col overflow-hidden pt-6 px-6 pb-16 animate-in fade-in duration-300">
      {children}
    </div>
  )
}
