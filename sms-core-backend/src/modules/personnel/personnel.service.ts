    import { prisma } from "@/lib/prisma";
import { PersonnelDepartureType } from "@prisma/client";

export class PersonnelService {
  /**
   * Processes the atomic offboarding of a Teacher faculty member.
   */
  async processTeacherDeparture(payload: {
    teacherId: string;
    departureType: string;
    effectiveDate: string;
    clearance: { academic: string; treasury: string };
    remarks: string;
  }) {
    const { teacherId, departureType, effectiveDate, clearance, remarks } = payload;

    // 1. Locate internal reference via unique teacher public business ID
    const teacherRecord = await prisma.teacher.findUnique({
      where: { teacherId },
    });

    if (!teacherRecord) {
      throw new Error(`Faculty registry lookup failed. No active record found for ID: ${teacherId}`);
    }

    if (teacherRecord.status === "DEPARTED") {
      throw new Error(`System conflict: Faculty member ${teacherId} is already offboarded.`);
    }

    // 2. Execute isolated transaction block
    return await prisma.$transaction(async (tx) => {
      // Create explicit historical offboarding log entry
      const departureLog = await tx.teacherDeparture.create({
        data: {
          teacherInternalId: teacherRecord.id,
          departureType: departureType as PersonnelDepartureType,
          effectiveDate: new Date(effectiveDate),
          academicClearanceStatus: clearance.academic,
          treasuryClearanceStatus: clearance.treasury,
          remarks: remarks || "No additional remarks.",
        },
      });

      // Revoke active entity status
      await tx.teacher.update({
        where: { id: teacherRecord.id },
        data: { status: "DEPARTED" },
      });

      return departureLog;
    });
  }

  /**
   * Processes the atomic offboarding of an operational Staff member.
   */
  async processStaffDeparture(payload: {
    staffId: string;
    departureType: string;
    effectiveDate: string;
    clearance: { hr: string; itAssets: string; treasury: string };
    remarks: string;
  }) {
    const { staffId, departureType, effectiveDate, clearance, remarks } = payload;

    // 1. Locate internal reference via unique staff public business ID
    const staffRecord = await prisma.staff.findUnique({
      where: { staffId },
    });

    if (!staffRecord) {
      throw new Error(`Staff registry lookup failed. No active record found for ID: ${staffId}`);
    }

    if (staffRecord.status === "DEPARTED") {
      throw new Error(`System conflict: Staff member ${staffId} is already offboarded.`);
    }

    // 2. Execute isolated transaction block
    return await prisma.$transaction(async (tx) => {
      const departureLog = await tx.staffDeparture.create({
        data: {
          staffInternalId: staffRecord.id,
          departureType: departureType as PersonnelDepartureType,
          effectiveDate: new Date(effectiveDate),
          hrClearanceStatus: clearance.hr,
          itAssetReturnStatus: clearance.itAssets,
          treasuryClearanceStatus: clearance.treasury,
          remarks: remarks || "No additional remarks.",
        },
      });

      // Revoke active entity status
      await tx.staff.update({
        where: { id: staffRecord.id },
        data: { status: "DEPARTED" },
      });

      return departureLog;
    });
  }
}