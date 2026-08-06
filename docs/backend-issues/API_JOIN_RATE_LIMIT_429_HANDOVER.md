# api-join HTTP 429 rate-limit — handover

**Date:** 2026-08-06  
**Status:** Hotfix live on Hetzner. Waiting on Makeable to merge code patch into `makeabledk/boulders-express`.  
**Owner (Boulders):** Rami  
**API repo (Makeable):** `makeabledk/boulders-express` (no GitHub access for Rami — 404)

---

## Root cause (confirmed)

Production flow:

```
Browser (join.boulders.dk)
  → Cloudflare Pages Function `/api-proxy`
    → https://api-join.boulders.dk  (Hetzner `boulders-api`, 5.75.250.130)
      → BRP upstream
```

`api-join` rate-limits with `express-rate-limit`, keyed by `req.user?.id || req.ip`.

Unauthenticated join traffic has no user id → **keyed by IP**.  
Cloudflare Pages proxy means **many visitors share a few egress IPs** → buckets burn fast → HTTP 429 with:

```json
{
  "error": "Too many requests",
  "message": "Rate limit exceeded. Please try again later.",
  "retryAfter": 900,
  "requestId": "<uuid>"
}
```

BRP Systems does **not** host `api-join.boulders.dk` (they confirmed — it’s on Hetzner). The 429s were from **our** middleware, not BRP.

This is **not** only “BRP being slow” — it’s **traffic × shared proxy IP × tight limits**.

---

## Server details

| Item | Value |
|---|---|
| Hetzner server | `boulders-api` (CX22, Falkenstein) |
| IP | `5.75.250.130` |
| Hostname | `boulders-api` |
| Label | `ManagedBy: Forge` (Laravel Forge — Rami has no Forge login) |
| App path | `/home/forge/api-join.boulders.dk` |
| Process manager | PM2 as user `forge` (`boulders-proxy-server`, cluster ×2) |
| Rate limit code | `src/middleware/rateLimit.js` |
| Config | `src/config/index.js` + `.env` |
| Trust proxy | `app.set('trust proxy', 1)` in `app.js` |

---

## Hotfix applied (2026-08-06) — LIVE

| Setting | Before | After | Where |
|---|---|---|---|
| General `/api` | 100 / 15 min | **5000 / 15 min** | `.env` → `RATE_LIMIT_MAX_REQUESTS=5000` |
| Auth `/api/auth` | 10 / 15 min | **100 / 15 min** | `src/middleware/rateLimit.js` |
| Payment `/api/payment` | 5 / min | **60 / min** | `src/middleware/rateLimit.js` |

Verified live:

```bash
curl -sSI "https://api-join.boulders.dk/api/reference/business-units" -H 'Accept-Language: da-DK' | grep -i ratelimit
# expect: ratelimit-limit: 5000
```

PM2 restart used:

```bash
sudo -u forge pm2 restart all --update-env
```

(Without `--update-env`, `.env` changes are ignored.)

---

## Git / Makeable status

- Commit on server only: `a133d9f` — *Raise auth and payment rate limits for shared proxy traffic*
- Push from server **failed**: Forge deploy key is **read-only**
- Patch saved on Rami’s Mac Desktop:  
  `~/Desktop/0001-Raise-auth-and-payment-rate-limits-for-shared-proxy-.patch`
- Email sent to **Peter Rytter** (cc charlotte.tran@makeable.dk) asking to merge into `main`
- **Until Makeable merges:** a Forge deploy of `boulders-express` can overwrite auth/payment code limits. The `.env` `5000` general limit should survive.

---

## SSH access (set up 2026-08-06)

Previously: no SSH keys on Rami’s Mac → `Permission denied (publickey)`.

Now:

1. Mac key: `~/.ssh/id_ed25519` (`rami@boulders.dk`)
2. Public key added to `/root/.ssh/authorized_keys` on the server (via Hetzner Rescue)
3. Also added in Hetzner Console → Security → SSH Keys as `rami-macbook`
4. Forge’s `worker@forge.laravel.com` key left intact in `authorized_keys`

Connect:

```bash
ssh root@5.75.250.130
```

If host key warning after Rescue/reboot:

```bash
ssh-keygen -R 5.75.250.130
ssh root@5.75.250.130
```

Hetzner Console (correct URL): https://console.hetzner.com  
(Old `console.cloud.hetzner.com` is outdated.)

Browser VNC console has broken keyboard / no paste — prefer SSH.

---

## Re-apply hotfix if a deploy overwrites code

```bash
ssh root@5.75.250.130

# Check current limits in code
grep -n 'max:' /home/forge/api-join.boulders.dk/src/middleware/rateLimit.js
grep RATE_LIMIT /home/forge/api-join.boulders.dk/.env

# Re-apply code bumps if reverted
sed -i 's/max: 10, \/\/ 10 requests per window/max: 100, \/\/ 100 requests per window/' \
  /home/forge/api-join.boulders.dk/src/middleware/rateLimit.js
sed -i 's/max: 5, \/\/ 5 requests per minute/max: 60, \/\/ 60 requests per minute/' \
  /home/forge/api-join.boulders.dk/src/middleware/rateLimit.js

# Ensure .env general limit
grep -q '^RATE_LIMIT_MAX_REQUESTS=5000$' /home/forge/api-join.boulders.dk/.env \
  || sed -i 's/^RATE_LIMIT_MAX_REQUESTS=.*/RATE_LIMIT_MAX_REQUESTS=5000/' \
       /home/forge/api-join.boulders.dk/.env

sudo -u forge pm2 restart all --update-env

curl -sSI "https://api-join.boulders.dk/api/reference/business-units" -H 'Accept-Language: da-DK' | grep -i ratelimit
```

---

## Optional better long-term fix (not done yet)

1. **Cloudflare Pages `/api-proxy`** (`BouldersSPAflow` → `functions/api-proxy/index.ts`): forward real visitor IP, e.g. `CF-Connecting-IP` / `X-Join-Client-IP`.
2. **`api-join` `keyGenerator`**: use that header when request comes from trusted proxy; don’t bucket all users on shared egress IP.
3. Keep raised limits as safety margin.

SPA-side caching/cooldowns in `BouldersSPAflow` already help reduce call volume — keep them.

---

## Sentry evidence (for context)

Project: `boulders` / `join-bouldersdk` (EU `de.sentry.io`)

Issues included: `JOIN-BOULDERSDK-3A/3D/3C` (HTTP 429), `1K/M/2G` (login rate limit), `3S/1T` (payment generate-link 429).

Dense cluster: **2026-08-04 ~13:00–17:00 UTC**.  
Body always had `retryAfter: 900` + `requestId` matching `x-request-id`.

---

## Resume checklist

- [ ] Makeable merged patch into `makeabledk/boulders-express` `main`
- [ ] Confirm after their deploy: auth still `max: 100`, payment `max: 60`, `.env` still `5000`
- [ ] Optional: implement real client-IP forwarding (SPA proxy + api-join)
- [ ] Optional: get Forge / GitHub access to `boulders-express` so Boulders can ship API fixes without waiting

---

## Related files in this SPA repo

- `functions/api-proxy/index.ts` — Cloudflare Pages proxy to api-join / BRP
- `docs/backend-issues/HTTP_429_OPS_EVIDENCE.md` — earlier ops/Sentry packet
- `docs/backend-issues/429-ops-email-draft.md` — email draft to BRP (superseded: BRP doesn’t own api-join)
