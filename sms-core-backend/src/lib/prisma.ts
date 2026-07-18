/* eslint-disable @typescript-eslint/no-explicit-any -- Prisma client singleton */
import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const prisma = globalForPrisma.prisma || new PrismaClient()

// ── SOFT-DELETE MIDDLEWARE ──
// Auto-filters queries on soft-delete models to exclude deleted records.
// Intercepted actions: findMany, findFirst, findUnique, count.
// Does NOT intercept delete/deleteMany — those remain hard deletes.
// To soft-delete, use: prisma.modelName.update({ where: { id }, data: { deletedAt: new Date() } })
const SOFT_DELETE_MODELS = [
  'Class', 'Subject', 'Term', 'Department', 'FeeTier',
  'Invoice', 'Payment', 'PaymentCollection',
  'LedgerAccount', 'FeeStructureConfiguration', 'FeeComponent',
];

prisma.$use(async (params: any, next: any) => {
  if (SOFT_DELETE_MODELS.includes(params.model || '')) {
    if (params.action === 'findMany' || params.action === 'findFirst' || params.action === 'count') {
      params.args.where = { ...params.args.where, deletedAt: null };
    }
    if (params.action === 'findUnique') {
      params.action = 'findFirst';
      params.args.where = { ...params.args.where, deletedAt: null };
    }
  }
  return next(params);
});

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma

export { prisma }
