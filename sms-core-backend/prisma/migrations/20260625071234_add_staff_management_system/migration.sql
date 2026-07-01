-- CreateTable
CREATE TABLE "Staff" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "staffName" TEXT NOT NULL,
    "appointmentDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffAccount" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'STAFF',

    CONSTRAINT "StaffAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffDemographics" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,
    "gender" TEXT NOT NULL,
    "residentialAddress" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "bloodType" TEXT,
    "religion" TEXT,
    "formerSchool" TEXT,

    CONSTRAINT "StaffDemographics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffPlacement" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "jobTitle" TEXT NOT NULL,
    "employmentType" TEXT NOT NULL,
    "shiftSchedule" TEXT NOT NULL,

    CONSTRAINT "StaffPlacement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffCompliance" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "nationalId" TEXT,
    "ssnitNumber" TEXT,
    "emergencyName" TEXT,
    "emergencyPhone" TEXT,

    CONSTRAINT "StaffCompliance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffPayroll" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "clearanceTier" TEXT NOT NULL,
    "baseSalary" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bankName" TEXT,
    "bankAccount" TEXT,
    "salaryStatus" TEXT NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "StaffPayroll_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Staff_staffId_key" ON "Staff"("staffId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffAccount_staffId_key" ON "StaffAccount"("staffId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffAccount_email_key" ON "StaffAccount"("email");

-- CreateIndex
CREATE UNIQUE INDEX "StaffDemographics_staffId_key" ON "StaffDemographics"("staffId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffPlacement_staffId_key" ON "StaffPlacement"("staffId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffCompliance_staffId_key" ON "StaffCompliance"("staffId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffPayroll_staffId_key" ON "StaffPayroll"("staffId");

-- AddForeignKey
ALTER TABLE "StaffAccount" ADD CONSTRAINT "StaffAccount_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffDemographics" ADD CONSTRAINT "StaffDemographics_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffPlacement" ADD CONSTRAINT "StaffPlacement_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffCompliance" ADD CONSTRAINT "StaffCompliance_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffPayroll" ADD CONSTRAINT "StaffPayroll_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "Staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
