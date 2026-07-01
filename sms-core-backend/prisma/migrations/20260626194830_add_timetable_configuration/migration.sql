-- CreateTable
CREATE TABLE "TimetableConfiguration" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "periodsCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimetableConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimetablePeriod" (
    "id" TEXT NOT NULL,
    "configurationId" TEXT NOT NULL,
    "periodNumber" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,

    CONSTRAINT "TimetablePeriod_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimetableBreak" (
    "id" TEXT NOT NULL,
    "configurationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,

    CONSTRAINT "TimetableBreak_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubjectAllocation" (
    "id" TEXT NOT NULL,
    "configurationId" TEXT NOT NULL,
    "subjectName" TEXT NOT NULL,
    "teacherName" TEXT NOT NULL,

    CONSTRAINT "SubjectAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TimetableConfiguration_sectionId_key" ON "TimetableConfiguration"("sectionId");

-- CreateIndex
CREATE UNIQUE INDEX "TimetablePeriod_configurationId_periodNumber_key" ON "TimetablePeriod"("configurationId", "periodNumber");

-- AddForeignKey
ALTER TABLE "TimetablePeriod" ADD CONSTRAINT "TimetablePeriod_configurationId_fkey" FOREIGN KEY ("configurationId") REFERENCES "TimetableConfiguration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimetableBreak" ADD CONSTRAINT "TimetableBreak_configurationId_fkey" FOREIGN KEY ("configurationId") REFERENCES "TimetableConfiguration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubjectAllocation" ADD CONSTRAINT "SubjectAllocation_configurationId_fkey" FOREIGN KEY ("configurationId") REFERENCES "TimetableConfiguration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
