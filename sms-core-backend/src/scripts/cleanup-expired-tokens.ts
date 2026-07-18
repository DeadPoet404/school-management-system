import { prisma } from "@/lib/prisma";

// P3-20: Cleanup job for expired and revoked RefreshTokens.
// Without this, tokens accumulate forever in the database.
//
// Run: node -r tsconfig-paths/register dist/scripts/cleanup-expired-tokens.js
// Cron (every 6 hours): 0 *&#47;6 * * * cd /app && node dist/scripts/cleanup-expired-tokens.js

async function cleanupExpiredTokens() {
  const now = new Date();

  const result = await prisma.refreshToken.deleteMany({
    where: {
      OR: [
        { expiresAt: { lt: now } },
        { revokedAt: { not: null } },
      ],
    },
  });

  console.log(`[${new Date().toISOString()}] Cleaned up ${result.count} expired/revoked refresh tokens`);
}

cleanupExpiredTokens()
  .catch((error) => {
    console.error(`[${new Date().toISOString()}] Token cleanup failed:`, error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
