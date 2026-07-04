import { prisma } from "@/lib/prisma";
import { AttendanceRepository } from "./attendance.repository";
import { StudentRepository } from "../students/student.repository";

export class AttendanceService {
  private repo = new AttendanceRepository();
  private studentRepo = new StudentRepository();

  /**
   * Commits the attendance sheet grid and dynamically updates rolling profile averages.
   */
  async processSectionAttendance(payload: {
    date: string;
    classId: string;
    records: { studentId: string; status: "PRESENT" | "ABSENT" | "LATE" | "EXCUSED"; remarks?: string }[];
  }) {
    const { date, records } = payload;
    const parsingDate = new Date(date);

    return await prisma.$transaction(async (tx) => {
      // 1. Prepare formatting payload to database specs
      const databaseRecords = records.map((rec) => ({
        studentId: rec.studentId, // Expects student framework internal database ID
        date: parsingDate,
        status: rec.status,
        remarks: rec.remarks || undefined,
      }));

      // 2. Commit bulk parameters matrix sheet
      await this.repo.recordBulkAttendance(databaseRecords, tx);

      // 3. Recalculate and update the running averages for affected student records
      for (const rec of records) {
        const counts = await this.repo.getStudentAttendanceCounts(rec.studentId, tx);

        if (counts.totalCount > 0) {
          // Weight configuration: Present = 1.0, Late counts as partial presence (e.g., 0.5)
          const adjustedPresence = counts.presentCount + (counts.lateCount * 0.5);
          const rawPercentage = (adjustedPresence / counts.totalCount) * 100;
          
          // Format into a clean, presentation-ready float configuration block
          const finalPercentage = Math.min(100, Math.max(0, parseFloat(rawPercentage.toFixed(2))));

          // Persist the computed rate cleanly on the parent record structure
          await this.repo.updateStudentAttendanceRate(rec.studentId, finalPercentage, tx);
        }
      }

      return { processedCount: records.length };
    });
  }
}