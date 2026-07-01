-- CreateTable
CREATE TABLE "PaymentCollection" (
    "id" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "amountPaid" DECIMAL(10,2) NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "referenceNo" TEXT NOT NULL DEFAULT 'N/A (Direct)',
    "allocationTarget" TEXT NOT NULL,
    "dateProcessed" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentCollection_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PaymentCollection_receiptNumber_key" ON "PaymentCollection"("receiptNumber");

-- CreateIndex
CREATE INDEX "PaymentCollection_sectionId_idx" ON "PaymentCollection"("sectionId");
