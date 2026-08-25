#!/usr/bin/env python3
"""Create the Supabase-wired .env files for the SMS monorepo.

Run from the repo root:  python3 supabase_env_setup.py

Writes TWO files from their .env.example templates:
  • .env                  -> docker compose (runtime + migrate-on-boot)
  • sms-core-backend/.env -> bare-metal dev (npm run dev) + prisma CLI

- Prompts for the Supabase DB password (input is hidden) and URL-encodes it,
  so special characters (the old leaked one contained '@') cannot break the
  connection URI.
- Auto-detects whether your network can reach Supabase's IPv6-only direct
  connection; if not, routes migrations/backups through the session pooler
  (IPv4, port 5432). The TRANSACTION pooler (6543) cannot serve DDL or pg_dump.
- Generates brand-new JWT/cookie secrets (this also rotates the secrets that
  leaked via the committed .env.bak files). BOTH files receive the SAME values
  so compose and bare-metal dev behave identically.
- Refuses to overwrite existing files without an explicit YES.
"""
import getpass
import pathlib
import re
import secrets
import socket
import sys
from urllib.parse import quote

ROOT = pathlib.Path(__file__).resolve().parent
TARGETS = [
    (ROOT / ".env.example", ROOT / ".env", "docker compose"),
    (
        ROOT / "sms-core-backend" / ".env.example",
        ROOT / "sms-core-backend" / ".env",
        "bare-metal dev + prisma CLI",
    ),
]

for example, _, _ in TARGETS:
    if not example.exists():
        sys.exit(f"✗ {example.relative_to(ROOT)} not found — run this from the repo root")

existing = [env for _, env, _ in TARGETS if env.exists()]
if existing:
    names = ", ".join(str(e.relative_to(ROOT)) for e in existing)
    if input(f"{names} already exist. Overwrite both? (type YES): ").strip() != "YES":
        sys.exit("aborted — existing .env files left untouched")

REF = input("Supabase project ref [qdzvgyhkajegixagahry]: ").strip() or "qdzvgyhkajegixagahry"
REGION = input("Pooler region prefix [aws-0-eu-west-2]: ").strip() or "aws-0-eu-west-2"
PW = getpass.getpass("Supabase DB password (the NEW one, after rotation — input hidden): ")
if not PW:
    sys.exit("✗ no password given")
PWQ = quote(PW, safe="")  # URL-encode so special characters can't break the URI

# Runtime queries -> transaction pooler. connection_limit=8 (not the
# serverless =1): this is a persistent Express server; pages fan out parallel
# queries and a pool of 1 starves to P2024 500s under any concurrency.
POOLED = (
    f"postgresql://postgres.{REF}:{PWQ}@"
    f"{REGION}.pooler.supabase.com:6543/postgres"
    "?pgbouncer=true&connection_limit=8"
)


def ipv6_reachable(host, port=5432, timeout=4.0):
    """True if a TCP connection to host:port succeeds over IPv6."""
    try:
        infos = socket.getaddrinfo(host, port, socket.AF_INET6, socket.SOCK_STREAM)
    except socket.gaierror:
        return False
    for fam, typ, proto, _, sockaddr in infos:
        s = socket.socket(fam, typ, proto)
        s.settimeout(timeout)
        try:
            s.connect(sockaddr)
            s.close()
            return True
        except OSError:
            s.close()
            continue
    return False


DIRECT_HOST = f"db.{REF}.supabase.co"
if ipv6_reachable(DIRECT_HOST):
    DIRECT = f"postgresql://postgres.{REF}:{PWQ}@{DIRECT_HOST}:5432/postgres"
    DIRECT_MODE = f"true direct connection (IPv6 OK): {DIRECT_HOST}:5432"
else:
    DIRECT = (
        f"postgresql://postgres.{REF}:{PWQ}@"
        f"{REGION}.pooler.supabase.com:5432/postgres"
        "?pgbouncer=true"
    )
    DIRECT_MODE = (
        f"session pooler (no IPv6 route to the direct connection): "
        f"{REGION}.pooler.supabase.com:5432"
    )

# One set of fresh secrets shared by BOTH files — compose and bare-metal dev
# must validate the same tokens or logins break when switching flows.
FRESH = {
    "JWT_SECRET": secrets.token_hex(32),
    "JWT_REFRESH_SECRET": secrets.token_hex(32),
    "COOKIE_SECRET": secrets.token_hex(32),
}


def patch(template):
    t = template.read_text()
    # Double-quote the URLs: they contain '&' — unquoted, sourcing the file
    # (set -a; . ./.env, as backup.sh does) backgrounds the assignment in a
    # subshell and the variable silently vanishes. dotenv/prisma/compose strip
    # the quotes when reading the file.
    t = re.sub(r"^DATABASE_URL=.*$", 'DATABASE_URL="' + POOLED + '"', t, flags=re.M)
    t = re.sub(r"^DIRECT_URL=.*$", 'DIRECT_URL="' + DIRECT + '"', t, flags=re.M)
    for key, val in FRESH.items():
        t = re.sub(rf"^{key}=.*$", f"{key}={val}", t, flags=re.M)
    return t


for example, env, purpose in TARGETS:
    env.write_text(patch(example))
    print(f"✓ wrote {env.relative_to(ROOT)}  ({purpose})")

print()
print(f"  DATABASE_URL  -> transaction pooler, project {REF} (port 6543)")
print(f"  DIRECT_URL    -> {DIRECT_MODE}")
print("  JWT_SECRET / JWT_REFRESH_SECRET / COOKIE_SECRET -> freshly generated (same in both files)")
print()
print("Verify, in order:")
print("  1) python3 env_inspect.py                      # pw_len matches the dashboard password")
print("  2) cd sms-core-backend && set -a && . ./.env && set +a && \\")
print('     node ../probe_supabase.js "$DATABASE_URL" "$DIRECT_URL"   # expect: OK  OK')
print("  3) npx prisma migrate deploy                   # applies the schema to Supabase")
