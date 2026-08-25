#!/usr/bin/env python3
"""Inspect .env files WITHOUT printing secrets.

Run from the repo root:  python3 env_inspect.py
Reports: which env files exist, what host/mode each DB URL targets, and the
DECODED length of each password so you can compare against your password
manager without the value ever appearing on screen.
"""
import pathlib
import re
from urllib.parse import unquote

ok = True

for name in (".env", "sms-core-backend/.env"):
    f = pathlib.Path(name)
    if not f.exists():
        print(f"{name}: MISSING")
        ok = False
        continue
    print(f"{name}: exists")
    for line in f.read_text().splitlines():
        m = re.match(r'^(DATABASE_URL|DIRECT_URL)="?postgresql://([^:/@]+):([^@]*)@([^/]+)/([^?\s]+)([^"]*)"?$', line)
        if m:
            key, user, pw, host, _db, params = m.groups()
            decoded = unquote(pw)
            if ":6543" in host:
                mode = "transaction pooler (runtime queries)"
            elif "pooler.supabase.com:5432" in host:
                mode = "session pooler (migrations/backups OK)"
            else:
                mode = "direct connection (IPv6 required)"
            warn = ""
            if key == "DIRECT_URL" and ":6543" in host:
                warn = "  <-- WRONG: transaction pooler cannot run migrations/pg_dump!"
                ok = False
            elif key == "DATABASE_URL" and ":6543" not in host:
                warn = "  <-- unexpected: runtime URL should use the 6543 pooler"
            print(f"    {key}: user={user}  host={host}  [{mode}]")
            print(f"        pw_len={len(decoded)}  urlencoded={'%' in pw}{warn}")
    secrets_seen = {}
    for line in f.read_text().splitlines():
        m = re.match(r"^(JWT_SECRET|JWT_REFRESH_SECRET|COOKIE_SECRET)=(.*)$", line)
        if m:
            secrets_seen[m.group(1)] = m.group(2)
    for k, v in secrets_seen.items():
        print(f"    {k}: len={len(v)}  placeholder={'change_me' in v.lower() or 'replace_with' in v.lower()}")
    if "JWT_SECRET" in secrets_seen and secrets_seen["JWT_SECRET"] == secrets_seen.get("JWT_REFRESH_SECRET"):
        print("    WARNING: JWT_SECRET and JWT_REFRESH_SECRET are identical — boot will refuse this.")
        ok = False

print()
print("Checks:")
print("  1. pw_len must equal the password shown in your password manager for the")
print("     Supabase dashboard (openssl rand -hex 16 produces exactly 32 chars).")
print("  2. urlencoded=True is EXPECTED and harmless when the file was generated")
print("     by supabase_env_setup.py — it %-encodes special chars (legacy issue:")
print("     the old leaked password contained a literal '@' that broke the URI).")
print("  3. DATABASE_URL should be the 6543 pooler; DIRECT_URL the 5432 session")
print("     pooler (or IPv6 direct), never the other way around.")
print()
print("RESULT:", "OK" if ok else "ISSUES FOUND — see lines marked above")
