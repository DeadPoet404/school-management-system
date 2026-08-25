#!/usr/bin/env python3
"""Inspect .env files WITHOUT printing secrets.

Run from the repo root:  python3 env_inspect.py
Reports: which env files exist, what host each DB URL targets, and the
length/encoding of each password so you can compare against your password
manager without the value ever appearing on screen.
"""
import pathlib
import re

for name in (".env", "sms-core-backend/.env"):
    f = pathlib.Path(name)
    if not f.exists():
        print(f"{name}: MISSING")
        continue
    print(f"{name}: exists")
    for line in f.read_text().splitlines():
        m = re.match(r"^(DATABASE_URL|DIRECT_URL)=postgresql://([^:/@]+):([^@]*)@([^/]+)/", line)
        if m:
            key, user, pw, host = m.groups()
            print(f"    {key}: user={user}  host={host}  pw_len={len(pw)}  urlencoded={'%' in pw}")
    secrets = {}
    for line in f.read_text().splitlines():
        m = re.match(r"^(JWT_SECRET|JWT_REFRESH_SECRET|COOKIE_SECRET)=(.*)$", line)
        if m:
            secrets[m.group(1)] = m.group(2)
    for k, v in secrets.items():
        print(f"    {k}: len={len(v)}  placeholder={'change_me' in v.lower()}")

print()
print("Check: does pw_len match the password you actually set in the Supabase")
print("dashboard?  openssl rand -hex 16 produces exactly 32 characters.")
print("If urlencoded=True, the .env holds the OLD password (it contains '@').")
