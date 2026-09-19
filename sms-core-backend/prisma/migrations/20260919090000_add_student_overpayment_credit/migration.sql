-- Support overpayment credits carried forward to future invoices.
ALTER TABLE "BillingLedger"
ADD COLUMN "creditBalance" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- Migrate legacy overpayments into the new credit balance. This handles both
-- forms produced by older code: an invoice paid above its amount and/or a
-- negative BillingLedger balance. Use the greater value so one overpayment is
-- not counted twice when both representations describe the same money.
WITH invoice_overpayments AS (
  SELECT
    i."studentId",
    COALESCE(SUM(GREATEST(i."paidAmount" - i.amount, 0)), 0) AS invoice_credit
  FROM "Invoice" i
  WHERE i."deletedAt" IS NULL
  GROUP BY i."studentId"
), legacy_balances AS (
  SELECT
    b."studentId",
    b."currentBalance",
    GREATEST(
      COALESCE(io.invoice_credit, 0),
      GREATEST(-b."currentBalance", 0)
    ) AS migrated_credit
  FROM "BillingLedger" b
  LEFT JOIN invoice_overpayments io ON io."studentId" = b."studentId"
)
UPDATE "BillingLedger" b
SET
  "creditBalance" = lb.migrated_credit,
  "currentBalance" = GREATEST(b."currentBalance", 0)
FROM legacy_balances lb
WHERE b."studentId" = lb."studentId"
  AND lb.migrated_credit > 0;

-- Keep invoice paid amounts bounded by their invoice amount. The excess is
-- represented once in BillingLedger.creditBalance above.
UPDATE "Invoice"
SET
  "paidAmount" = LEAST("paidAmount", amount),
  status = CASE
    WHEN LEAST("paidAmount", amount) >= amount THEN 'PAID'::"InvoiceStatus"
    WHEN LEAST("paidAmount", amount) > 0 THEN 'PARTIAL'::"InvoiceStatus"
    ELSE 'UNPAID'::"InvoiceStatus"
  END,
  "updatedAt" = now()
WHERE "deletedAt" IS NULL
  AND "paidAmount" > amount;
