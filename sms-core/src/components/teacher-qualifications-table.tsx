"use client"

import * as React from "react"
import { UniversalDataTable, type DataTableColumn } from "@/components/universal-data-table"

export type TeacherQualificationRow = {
  id: string
  facultyMeta: React.ReactNode
  highestDegree: string
  fieldOfStudy: string
  institution: string
  graduationYear: number
  licenseNumber: string
  verificationStatus: React.ReactNode
}

interface TeacherQualificationsTableProps {
  data?: any[]
}

const defaultQualifications = [
  { id: "QLF-901", teacherId: "TCH-101", teacherName: "Dr. Emmanuel Asante", highestDegree: "Ph.D.", institution: "University of Cape Coast (UCC)", fieldOfStudy: "Mathematics Education", graduationYear: 2016, licenseNumber: "NTC-MAT-7761", verificationStatus: "Verified" },
  { id: "QLF-902", teacherId: "TCH-102", teacherName: "Prof. Abena Mansa", highestDegree: "M.Phil.", institution: "KNUST", fieldOfStudy: "Applied Biochemistry", graduationYear: 2014, licenseNumber: "NTC-SCI-3392", verificationStatus: "Verified" },
  { id: "QLF-903", teacherId: "TCH-103", teacherName: "Marcus Vance", highestDegree: "MBA", institution: "University of Ghana (Legon)", fieldOfStudy: "Accounting & Finance", graduationYear: 2021, licenseNumber: "NTC-BUS-8821", verificationStatus: "Verified" },
  { id: "QLF-904", teacherId: "TCH-104", teacherName: "Elena Rostova", highestDegree: "M.A.", institution: "State Linguistics University", fieldOfStudy: "Foreign Language Pedagogy", graduationYear: 2019, licenseNumber: "NTC-LNG-0112", verificationStatus: "Pending Audit" },
  { id: "QLF-905", teacherId: "TCH-105", teacherName: "Kwame Opoku", highestDegree: "B.Ed.", institution: "University of Education, Winneba", fieldOfStudy: "Technical & Vocational Skills", graduationYear: 2012, licenseNumber: "NTC-VOC-4451", verificationStatus: "Verified" },
  { id: "QLF-906", teacherId: "TCH-106", teacherName: "Sarah Jenkins", highestDegree: "B.A. (Hons)", institution: "University of Cape Coast (UCC)", fieldOfStudy: "English Literature", graduationYear: 2024, licenseNumber: "NTC-ENG-9018", verificationStatus: "Pending Audit" },
  { id: "QLF-907", teacherId: "TCH-107", teacherName: "Dr. Osei Nyame", highestDegree: "Ph.D.", institution: "KNUST", fieldOfStudy: "Theoretical Physics", graduationYear: 2011, licenseNumber: "NTC-PHY-1102", verificationStatus: "Verified" },
  { id: "QLF-908", teacherId: "TCH-108", teacherName: "Chloe Zhang", highestDegree: "M.Sc.", institution: "Tsinghua University", fieldOfStudy: "Analytical Chemistry", graduationYear: 2022, licenseNumber: "NTC-CHM-5561", verificationStatus: "Action Required" },
]

export function TeacherQualificationsTable({ data }: TeacherQualificationsTableProps) {
  const sourceArray = data || defaultQualifications

  const transformedData: TeacherQualificationRow[] = sourceArray.map((item) => {
    const auditStatus = item.verificationStatus || "Pending Audit"
    const colorMap: Record<string, string> = {
      Verified: "text-emerald-600 dark:text-emerald-400 bg-emerald-50/50 dark:bg-emerald-950/20 px-2 py-0.5 rounded w-fit",
      "Pending Audit": "text-amber-600 dark:text-amber-400 bg-amber-50/50 dark:bg-amber-950/20 px-2 py-0.5 rounded w-fit",
      "Action Required": "text-red-600 dark:text-red-400 bg-red-50/50 dark:bg-red-950/20 px-2 py-0.5 rounded w-fit",
    }

    return {
      id: item.id,
      facultyMeta: (
        <div className="flex flex-col">
          <span className="text-zinc-900 dark:text-zinc-100 font-medium">{item.teacherName}</span>
          <span className="text-[11px] font-mono text-muted-foreground">{item.teacherId}</span>
        </div>
      ),
      highestDegree: item.highestDegree,
      fieldOfStudy: item.fieldOfStudy,
      institution: item.institution,
      graduationYear: item.graduationYear,
      licenseNumber: item.licenseNumber,
      verificationStatus: <div className={colorMap[auditStatus] || "text-zinc-500"}>{auditStatus}</div>,
    }
  })

  const columns: DataTableColumn<TeacherQualificationRow>[] = [
    { key: "id", header: "Credential ID", className: "w-[130px]", cellClassName: "font-mono text-xs text-muted-foreground" },
    { key: "facultyMeta", header: "Faculty Member", className: "min-w-[180px]" },
    { key: "highestDegree", header: "Attained Degree", className: "w-[120px]", cellClassName: "font-semibold text-zinc-700 dark:text-zinc-300" },
    { key: "fieldOfStudy", header: "Specialization / Field", className: "min-w-[180px]", cellClassName: "text-zinc-600 dark:text-zinc-400" },
    { key: "institution", header: "Awarding Institution", className: "min-w-[200px]", cellClassName: "text-zinc-600 dark:text-zinc-400 text-xs" },
    { key: "graduationYear", header: "Year", className: "w-[90px]", cellClassName: "font-mono text-zinc-600 dark:text-zinc-400 text-center" },
    { key: "licenseNumber", header: "NTC License Registry", className: "min-w-[140px]", cellClassName: "font-mono text-xs text-zinc-600 dark:text-zinc-400" },
    { key: "verificationStatus", header: "Compliance Audit", className: "w-[140px]" },
  ]

  return (
    <UniversalDataTable
      data={transformedData}
      columns={columns}
      rowId={(record) => record.id}
      emptyMessage="No faculty qualification or license registry metrics discovered."
    />
  )
}