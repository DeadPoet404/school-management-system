import { NextRequest, NextResponse } from "next/server"
import { StudentDepartureService } from "@/services/studentDepartureService"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    
    const { 
      studentId, 
      departureType, 
      effectiveDate, 
      disposition, 
      remarks 
    } = body

    // 1. Enforce rigorous HTTP parameter schema validations
    if (!studentId || !departureType || !effectiveDate || !disposition || !remarks) {
      return NextResponse.json(
        { success: false, message: "Structural processing failure: Missing payload parameter variables." },
        { status: 400 }
      )
    }

    // 2. Delegate data modification downstream directly into structural execution layers
    const processingResult = await StudentDepartureService.processStudentDeparture({
      studentId,
      departureType,
      effectiveDate,
      destinationInstitution: disposition.destinationInstitution,
      treasuryClearanceStatus: disposition.treasuryClearanceStatus,
      academicRecordsArchived: !!disposition.academicRecordsArchived,
      remarks
    })

    return NextResponse.json({
      success: true,
      message: "Student record decoupled and successfully written to archival log pools.",
      data: processingResult
    }, { status: 200 })

  } catch (error: any) {
    console.error("EXCISION_PIPELINE_ROUTE_ERROR:", error)
    return NextResponse.json(
      { 
        success: false, 
        message: error.message || "Internal network framework operational anomaly discovered." 
      },
      { status: 500 }
    )
  }
}
