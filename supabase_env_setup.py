#!/usr/bin/env python3
"""Create .env wired to Supabase for the SMS monorepo.

Run from the repo root:  python3 supabase_env_setup.py

- Prompts for the Supabase DB password (input is hidden).
- Auto-detects whether your network can reach Supabase's IPv6-only direct
  connection; if not, routes migrations/backups through the session pooler
  (IPv4, port 5432), which the transaction pooler cannot replace for DDL.
- Generates brand-new JWT/cookie secrets (this also rotates the secrets
  that leaked via the committed .env.bak files).
- Refuses to overwrite an existing .env without an explicit YES.
"""
import getpass
import pathlib
import re
import secrets
import socket
import sys
from urllib.parse import quote

ROOT = pathlib.Path(__file__).resolve().parent
EXAMPLE = ROOT / ".env.example"
ENV = ROOT / ".env"

if not EXAMPLE.exists():
    sys.exit("✗ .env.example not found — run this from the repo root")

if ENV.exists():
    if input(".env already exists. Overwrite? (type YES): ").strip() != "YES":
        sys.exit("aborted — .env left untouched")

REF = input("Supabase project ref [qdzvgyhkajegixagahry]: ").strip() or "qdzvgyhkajegixagahry"
REGION = input("Pooler region prefix [aws-0-eu-west-2]: ").strip() or "aws-0-eu-west-2"
PW = getpass.getpass("Supabase DB password (the NEW one, after rotation — input hidden): ")
if not PW:
    sys.exit("✗ no password given")
PWQ = quote(PW, safe="")  # URL-encode so special characters can't break the URI

# Runtime queries -> transaction pooler (IPv4, verified pattern).
POOLED = (
    f"postgresql://postgres.{REF}:{PWQ}@"
    f"{REGION}.pooler.supabase.com:6543/postgres"
    "?pgbouncer=true&connection_limit=1"
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

t = EXAMPLE.read_text()
t = re.sub(r"^DATABASE_URL=.*$", "DATABASE_URL=" + POOLED, t, flags=re.M)
t = re.sub(r"^DIRECT_URL=.*$", "DIRECT_URL=" + DIRECT, t, flags=re.M)
t = re.sub(r"^JWT_SECRET=.*$", "JWT_SECRET=" + secrets.token_hex(32), t, flags=re.M)
t = re.sub(r"^JWT_REFRESH_SECRET=.*$", "JWT_REFRESH_SECRET=" + secrets.token_hex(32), t, flags=re.M)
t = re.sub(r"^COOKIE_SECRET=.*$", "COOKIE_SECRET=" + secrets.token_hex(32), t, flags=re.M)
ENV.write_text(t)

print()
print("✓ .env written from .env.example")
print(f"  DATABASE_URL  -> transaction pooler, project {REF} (port 6543)")
print(f"  DIRECT_URL    -> {DIRECT_MODE}")
print("  JWT_SECRET / JWT_REFRESH_SECRET / COOKIE_SECRET -> freshly generated")
print()
print("Next:  npx prisma migrate deploy   (proves the direct/session link works)")
