-- CreateTable
CREATE TABLE "StudentCompliance" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "nationalId" TEXT,
    "emergencyName" TEXT,
    "emergencyPhone" TEXT,
    "emergencyRelation" TEXT,

    CONSTRAINT "StudentCompliance_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StudentCompliance_studentId_key" ON "StudentCompliance"("studentId");

-- AddForeignKey
ALTER TABLE "StudentCompliance" ADD CONSTRAINT "StudentCompliance_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
