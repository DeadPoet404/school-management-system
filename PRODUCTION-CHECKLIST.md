# SMS Production Go-Live Checklist

Work top-to-bottom. Every step has a verification line — do not skip them.
Everything assumes the repo root (~/sms-monorepo) on the production host.

---

## 1 · Host prerequisites

- [ ] Linux host, at least 2 GB RAM, 20 GB disk (limits: pg 1g · backend 1g · frontend 512m)
- [ ] Docker Engine + Docker Compose v2 (docker compose version shows v2.x)
- [ ] DNS A record pointing your domain (e.g. sms.school.edu.gh) at the host

## 2 · Rotate ALL secrets (never reuse dev values)

    cp .env .env.dev-backup          # safety net
    sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$(openssl rand -hex 32)|" .env
    sed -i "s|^JWT_SECRET=.*|JWT_SECRET=$(openssl rand -hex 32)|"              .env
    sed -i "s|^JWT_REFRESH_SECRET=.*|JWT_REFRESH_SECRET=$(openssl rand -hex 32)|" .env
    sed -i "s|^COOKIE_SECRET=.*|COOKIE_SECRET=$(openssl rand -hex 32)|"        .env
    grep -cE '^(POSTGRES_PASSWORD|JWT_SECRET|JWT_REFRESH_SECRET|COOKIE_SECRET)=.' .env   # expect 4

WARNING: Rotating POSTGRES_PASSWORD on an EXISTING database volume does not
change the password Postgres actually has. For a fresh deployment this is
fine (the volume initializes with the new value). For an existing volume run:

    docker compose exec postgres psql -U sms_user -d sms_db \
      -c "ALTER USER sms_user PASSWORD '<new-password-here>';"

using the same new value — or wipe the volume deliberately
(docker compose down -v — DESTROYS ALL DATA).

- [ ] 4 unique secrets in .env, none starting with "change_me"

## 3 · HTTPS via reverse proxy (Caddy — automatic Let's Encrypt)

    # /etc/caddy/Caddyfile
    sms.school.edu.gh {
        reverse_proxy 127.0.0.1:3000
    }

    sudo systemctl reload caddy

- [ ] https://sms.school.edu.gh serves the login page (valid padlock)

## 4 · Flip cookie/CORS to production values

    sed -i 's|^COOKIE_SECURE=.*|COOKIE_SECURE=true|'                    .env
    sed -i 's|^COOKIE_DOMAIN=.*|COOKIE_DOMAIN=sms.school.edu.gh|'       .env
    sed -i 's|^CORS_ORIGINS=.*|CORS_ORIGINS=https://sms.school.edu.gh|' .env
    grep -E '^(COOKIE_SECURE|COOKIE_DOMAIN|CORS_ORIGINS)=' .env

- [ ] COOKIE_SECURE=true, real domain in COOKIE_DOMAIN and CORS_ORIGINS
- [ ] Optional hardening: in docker-compose.yml bind the frontend to
      loopback too ("127.0.0.1:3000:3000") so only Caddy can reach it,
      then firewall: sudo ufw allow 80,443/tcp && sudo ufw enable

## 5 · First boot and smoke tests

    docker compose up -d --build
    docker compose ps                          # all three: running (healthy)
    curl -s http://127.0.0.1:5000/api/health   # status healthy, db connected
    docker compose logs backend 2>&1 | grep -c 'COOKIE_SECURE=false'   # expect 0

- [ ] Health endpoint reports healthy + db connected
- [ ] Backend logs contain NO cookie-security warning
- [ ] Login works through https (cookies only over HTTPS now)

## 6 · Self-test the boot guards (prove the hardening fires)

    cp .env .env.guard-test
    sed -i "s|^JWT_REFRESH_SECRET=.*|JWT_REFRESH_SECRET=$(grep '^JWT_SECRET=' .env | cut -d= -f2)|" .env
    docker compose up backend; echo "exit=$?"   # expect: ENVIRONMENT VALIDATION FAILED
    mv .env.guard-test .env                     # restore
    docker compose up -d backend                # boots again

- [ ] Equal-secrets boot was REFUSED with the validation banner

## 7 · Backups

    ./scripts/backup.sh                        # writes backups/sms_db_<timestamp>.sql.gz
    gunzip -c backups/$(ls -t backups/ | head -1) | docker compose exec -T postgres psql -U sms_user -d sms_db -c '\l'
    crontab -e   # add:  0 2 * * *  /home/<you>/sms-monorepo/scripts/backup.sh >> /var/log/sms-backup.log 2>&1

- [ ] Manual backup + restore-path test pass, nightly cron installed

## 8 · Seed safety

- [ ] grep '^RUN_SEED=' .env reports false (seed is destructive on a fresh DB)

## 9 · Updates (routine)

    git pull && docker compose up -d --build   # migrations run automatically on boot

---

Sign-off: all boxes ticked — the stack is production-ready.
Guards now enforced at boot: distinct JWT secrets, no placeholder secrets,
32-char minimum JWT secrets in production, capped logs (10m x 3), memory/CPU
limits per service, Postgres unreachable from outside the Docker network.
