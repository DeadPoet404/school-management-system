# Deployment Runbook

Promotion path for every change: **commit → push → CI green → staging →
staging acceptance → production**. No step is skipped, including for
changes that look trivial.

---

## 0. Prerequisites (one-time, per server)

### Git authentication

GitHub removed password authentication in 2021. `git pull` over HTTPS with
an account password always returns `HTTP 401`. Use one of:

**Fine-grained PAT (Contents: Read-only, scoped to this repository)**

```bash
git config --global credential.helper 'store --file=/root/.git-credentials-jocomfy'
git pull origin main            # username: DeadPoet404, password: the PAT
chmod 600 /root/.git-credentials-jocomfy
```

**Read-only deploy key (no expiry to track)**

```bash
ssh-keygen -t ed25519 -C "$(hostname)-deploy" -f /root/.ssh/id_ed25519 -N ""
cat /root/.ssh/id_ed25519.pub   # add under repo Settings -> Deploy keys
git remote set-url origin git@github.com:DeadPoet404/school-management-system.git
ssh -T git@github.com
```

The GitHub account is **DeadPoet404** — not `Deadpoet`.

---

## 1. Staging

`validate-env.sh` sources the env file in its **own process**. A `PASS`
does not put those values in your shell, and `docker compose` will not
find them. Every staging compose command therefore needs `--env-file`.

```bash
cd /root/school-management-system
ENVF=/etc/jocomfy-staging/staging.env
COMPOSE="docker compose --env-file $ENVF -f deploy/staging/docker-compose.yml"

git pull origin main
git log --oneline -3

bash deploy/staging/validate-env.sh        # expect: PASS

$COMPOSE config >/dev/null && echo "interpolation OK"   # catches missing vars
$COMPOSE build staging-backend
$COMPOSE up -d staging-backend
$COMPOSE ps

curl -sS http://127.0.0.1:5100/api/health
```

Omitting `--env-file` produces:

```text
error while interpolating services.staging-backend.environment.JWT_SECRET:
required variable JWT_SECRET is missing a value
```

That is a missing flag, not a missing secret.

### Staging integration policy

`validate-env.sh` **fails** if any of these are non-empty in staging:
`PAYSTACK_SECRET_KEY`, `PAYSTACK_CALLBACK_URL`, `GOOGLE_CLIENT_ID`,
`ARKESEL_*`, `META_WA_*`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`.

Consequence: **outbound email cannot be exercised on staging.** Anything
depending on SMTP degrades to its unconfigured branch by design. Verify
the fail-soft path there and the live path in production.

---

## 2. Staging acceptance

Do not promote until the change has been driven through the UI at
`https://sms-staging.jocomfy.com` and the feature-specific checks pass.

---

## 3. Production

```bash
cd /root/school-management-system
git pull origin main
git log --oneline -3

docker compose config >/dev/null && echo "interpolation OK"
docker compose build backend
docker compose up -d backend
docker compose ps

curl -sS https://sms.jocomfy.com/api/health   # success true, db connected
```

Production reads its own `.env` from the repo root, so no `--env-file`.

---

## 4. Rollback

**No migration in the release:**

```bash
cd /root/school-management-system
git log --oneline -5
git checkout <previous-sha>
docker compose up -d --build backend
curl -sS https://sms.jocomfy.com/api/health
```

**Migration included:** take a backup *before* deploying
(`scripts/backup.sh`) and confirm the migration's down path is understood.
A schema change that has already run does not revert by checking out the
previous commit.

---

## 5. Notes

- Backend stays privately bound (`127.0.0.1:5000` prod, `127.0.0.1:5100`
  staging). Never publish it on `0.0.0.0`.
- Staging sits behind Cloudflare Access. Do not remove that protection.
- Restart only the service you changed; leave the rest running.
