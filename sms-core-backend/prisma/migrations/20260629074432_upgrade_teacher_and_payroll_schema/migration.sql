-- AlterTable
ALTER TABLE "StaffPayroll" ADD COLUMN     "deductions" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "netPay" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "paymentRoute" TEXT NOT NULL DEFAULT 'BANK_TRANSFER';

-- CreateTable
CREATE TABLE "TeacherDemographics" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,
    "gender" TEXT NOT NULL,
    "residentialAddress" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "bloodType" TEXT,
    "religion" TEXT,
    "formerSchool" TEXT,

    CONSTRAINT "TeacherDemographics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherCompliance" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "nationalId" TEXT,
    "ssnitNumber" TEXT,
    "emergencyName" TEXT,
    "emergencyPhone" TEXT,

    CONSTRAINT "TeacherCompliance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherPayroll" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "clearanceTier" TEXT NOT NULL,
    "baseSalary" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "deductions" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "netPay" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "paymentRoute" TEXT NOT NULL DEFAULT 'BANK_TRANSFER',
    "bankName" TEXT,
    "bankAccount" TEXT,
    "salaryStatus" "PayrollStatus" NOT NULL DEFAULT 'PENDING',

    CONSTRAINT "TeacherPayroll_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TeacherDemographics_teacherId_key" ON "TeacherDemographics"("teacherId");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherCompliance_teacherId_key" ON "TeacherCompliance"("teacherId");

-- CreateIndex
CREATE UNIQUE INDEX "TeacherPayroll_teacherId_key" ON "TeacherPayroll"("teacherId");

-- AddForeignKey
ALTER TABLE "TeacherDemographics" ADD CONSTRAINT "TeacherDemographics_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherCompliance" ADD CONSTRAINT "TeacherCompliance_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeacherPayroll" ADD CONSTRAINT "TeacherPayroll_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE CASCADE ON UPDATE CASCADE;
