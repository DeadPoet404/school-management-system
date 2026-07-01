-- CreateTable
CREATE TABLE "FeeStructureConfiguration" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "issueDate" TEXT NOT NULL,
    "dueDate" TEXT NOT NULL,
    "allowInstallments" BOOLEAN NOT NULL DEFAULT true,
    "lateFeeRate" TEXT NOT NULL DEFAULT '0',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeeStructureConfiguration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeeComponent" (
    "id" TEXT NOT NULL,
    "configId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" TEXT NOT NULL,
    "frequency" TEXT NOT NULL,
    "isMandatory" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "FeeComponent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FeeStructureConfiguration_sectionId_key" ON "FeeStructureConfiguration"("sectionId");

-- AddForeignKey
ALTER TABLE "FeeComponent" ADD CONSTRAINT "FeeComponent_configId_fkey" FOREIGN KEY ("configId") REFERENCES "FeeStructureConfiguration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
