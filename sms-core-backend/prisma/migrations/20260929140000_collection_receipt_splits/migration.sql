-- Counter collections can cover more than one student on a single receipt.
-- The receipt itself stays one PaymentCollection row. Each share is the
-- amount actually applied to that student's balance, and the printed name
-- can be a family name rather than one child.

ALTER TABLE "PaymentCollection" ADD COLUMN "receiptName" TEXT;
ALTER TABLE "PaymentCollection" ADD COLUMN "showOutstanding" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "PaymentCollectionShare" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "className" TEXT,
    "amount" DECIMAL(10,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "PaymentCollectionShare_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "PaymentCollectionShare_collectionId_idx" ON "PaymentCollectionShare"("collectionId");
CREATE INDEX "PaymentCollectionShare_studentId_idx" ON "PaymentCollectionShare"("studentId");

ALTER TABLE "PaymentCollectionShare"
  ADD CONSTRAINT "PaymentCollectionShare_collectionId_fkey"
  FOREIGN KEY ("collectionId") REFERENCES "PaymentCollection"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PaymentCollectionShare"
  ADD CONSTRAINT "PaymentCollectionShare_studentId_fkey"
  FOREIGN KEY ("studentId") REFERENCES "Student"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
