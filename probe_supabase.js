// probe_supabase.js — test Supabase DB URLs with the project's own Prisma client.
// Run FROM sms-core-backend/ so it finds @prisma/client in ./node_modules:
//   cd ~/sms-monorepo/sms-core-backend
//   node /path/to/probe_supabase.js "postgresql://...6543..." "postgresql://...5432..."
// Prints OK (user/db/pg version) or FAIL (first error line) per URL.
// Times out after 25s per URL.

const { createRequire } = require("module");
const requireFromCwd = createRequire(process.cwd() + "/__probe__.js");
let PrismaClient;
try {
  ({ PrismaClient } = requireFromCwd("@prisma/client"));
} catch (e) {
  console.error("✗ @prisma/client not found — run this from sms-core-backend/ (where node_modules lives).");
  console.error("  Error: " + (e.message || e).split("\n")[0]);
  process.exit(1);
}

const urls = process.argv.slice(2);
if (!urls.length) {
  console.error("usage: node probe_supabase.js <url> [<url2> ...]");
  process.exit(1);
}

const timeout = (ms) => new Promise((_, rej) => setTimeout(() => rej(new Error("TIMEOUT")), ms));

(async () => {
  for (const url of urls) {
    const label = url.includes(":6543") ? "POOLER-6543 " : url.includes(":5432") ? "SESSION-5432" : "URL        ";
    const p = new PrismaClient({ datasources: { db: { url } } });
    try {
      const rows = await Promise.race([
        p.$queryRaw`select current_user as u, current_database() as d, split_part(version(), ' ', 2) as pg`,
        timeout(25000),
      ]);
      const r = rows[0];
      console.log(`${label} OK    user=${r.u} db=${r.d} pg=${r.pg}`);
    } catch (e) {
      const msg = (e.message || String(e)).split("\n")[0].slice(0, 130);
      console.log(`${label} FAIL  ${msg}`);
    } finally {
      await p.$disconnect();
    }
  }
})();
