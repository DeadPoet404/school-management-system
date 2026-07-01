-- CreateTable
CREATE TABLE "Student" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "enrollmentDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StudentAccount" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "portalEmail" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,

    CONSTRAINT "StudentAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Demographics" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,
    "gender" TEXT NOT NULL,
    "residentialAddress" TEXT NOT NULL,
    "medicalNotes" TEXT,

    CONSTRAINT "Demographics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Placement" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "academicTrack" TEXT NOT NULL,
    "boardingStatus" TEXT NOT NULL,

    CONSTRAINT "Placement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Guardian" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,

    CONSTRAINT "Guardian_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BillingLedger" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "feeTierId" TEXT NOT NULL,
    "initialDeposit" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "currentBalance" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "BillingLedger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Student_studentId_key" ON "Student"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentAccount_studentId_key" ON "StudentAccount"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentAccount_portalEmail_key" ON "StudentAccount"("portalEmail");

-- CreateIndex
CREATE UNIQUE INDEX "Demographics_studentId_key" ON "Demographics"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "Placement_studentId_key" ON "Placement"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "Guardian_studentId_key" ON "Guardian"("studentId");

-- CreateIndex
CREATE UNIQUE INDEX "BillingLedger_studentId_key" ON "BillingLedger"("studentId");

-- AddForeignKey
ALTER TABLE "StudentAccount" ADD CONSTRAINT "StudentAccount_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Demographics" ADD CONSTRAINT "Demographics_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Placement" ADD CONSTRAINT "Placement_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Guardian" ADD CONSTRAINT "Guardian_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BillingLedger" ADD CONSTRAINT "BillingLedger_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;
