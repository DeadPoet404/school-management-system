// probe_supabase.js — test Supabase DB URLs with the project's own Prisma client.
// Run FROM sms-core-backend/ so it finds @prisma/client in ./node_modules:
//   cd ~/sms-monorepo/sms-core-backend
//   set -a && . ./.env && set +a
//   node ../probe_supabase.js "$DATABASE_URL" "$DIRECT_URL"
// Prints OK (user/db/pg version) or FAIL with the REAL Prisma error line,
// the P-code, and a targeted fix hint. Times out after 25s per URL.

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

const raw = process.argv.slice(2);
if (!raw.length) {
  console.error("usage: node probe_supabase.js <url> [<url2> ...]");
  console.error("hint:  set -a && . ./.env && set +a && node ../probe_supabase.js \"$DATABASE_URL\" \"$DIRECT_URL\"");
  process.exit(1);
}

// Guard against the classic failure: sourcing failed and we got stale/empty
// shell variables (empty args would otherwise look like connection errors).
for (const u of raw) {
  if (!u || !/^postgres(ql)?:\/\//.test(u)) {
    console.error(`✗ argument is empty or not a postgres URL: ${JSON.stringify(u)}`);
    console.error("  The sourcing step must have failed in THIS shell. Fix it first:");
    console.error("    unset DATABASE_URL DIRECT_URL   # drop stale exports from earlier sessions");
    console.error("    cd ~/sms-monorepo/sms-core-backend && set -a && . ./.env && set +a");
    process.exit(1);
  }
}

const timeout = (ms) => new Promise((_, rej) => setTimeout(() => rej(new Error("probe TIMEOUT")), ms));

function explain(e) {
  const msg = String(e.message || e);
  // Prisma messages start with a BLANK line (old script printed nothing but
  // FAIL), and the first real line is a generic wrapper — skip "Invalid `..."
  // lines to reach the informative one.
  const lines = msg.split("\n").map((s) => s.trim()).filter(Boolean);
  const first = lines.find((l) => !/^Invalid `/.test(l)) || lines[0] || "(empty error)";
  let code = e.errorCode || e.code || (msg.match(/P\d{4}/) || [])[0] || "";
  const hints = {
    P1000: "auth failed — the password in .env does NOT match the CURRENT Supabase DB password. If you rotated it in the dashboard, re-run supabase_env_setup.py and re-source .env.",
    P1001: "server unreachable — most likely: (a) Supabase project PAUSED (free tier pauses after ~7 days idle: Dashboard → Restore), (b) host/port typo, (c) a firewall/ISP blocking 6543/5432.",
    P1002: "connection timed out — check the project ref/region in the URL and your outbound connectivity.",
    P1003: "database does not exist — the path segment after the host should usually be /postgres.",
    P1017: "server closed the connection — pooler pgbouncer-mode mismatch (need ?pgbouncer=true) or TLS issue; prefer the session pooler URL for migrations.",
  };
  if (!code) {
    if (/password authentication failed/i.test(msg)) code = "P1000";
    else if (/Can't reach database server/i.test(msg)) code = "P1001";
    else if (/Connection terminated|server closed the connection/i.test(msg)) code = "P1017";
  }
  return { first, code, hint: hints[code] };
}

(async () => {
  let failed = 0;
  for (const url of raw) {
    const label = url.includes(":6543") ? "POOLER-6543   " : url.includes("pooler.supabase.com:5432") ? "SESSION-5432   " : url.includes(":5432") ? "DIRECT-5432    " : "URL            ";
    const p = new PrismaClient({ datasources: { db: { url } } });
    try {
      const rows = await Promise.race([
        p.$queryRaw`select current_user as u, current_database() as d, split_part(version(), ' ', 2) as pg`,
        timeout(25000),
      ]);
      const r = rows[0];
      console.log(`${label} OK    user=${r.u} db=${r.d} pg=${r.pg}`);
    } catch (e) {
      failed = 1;
      const { first, code, hint } = explain(e);
      console.log(`${label} FAIL  ${first.slice(0, 140)}${code ? `  [${code}]` : ""}`);
      if (hint) console.log(`${" ".repeat(14)}hint: ${hint}`);
    } finally {
      await p.$disconnect();
    }
  }
  process.exit(failed);
})();
