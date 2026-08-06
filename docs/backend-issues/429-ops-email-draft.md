Subject: Re: HTTP 429s on join.boulders.dk — proxy details + exact timestamps / requestIds

Hi,

Thanks for checking. A few important details that likely explain why you are not seeing HTTP 429 in the last 30 days when searching “normal” access logs:

## 1) Yes — there is a proxy in front of your APIs

Production traffic from `https://join.boulders.dk` does **not** call your APIs directly from the browser.

Flow:

```
Browser (join.boulders.dk)
  → Cloudflare Pages Function: /api-proxy?path=/api/...
    → https://api-join.boulders.dk/api/...
```

So in your access logs:

- Source IP = **Cloudflare egress** (shared), not the end-user IP
- Host/path to search = **`api-join.boulders.dk`**
- Status code is proxied through (if upstream returns 429, the client/Sentry also see 429)

(There is a separate path for BRP API3/ver3 via `boulders.brpsystems.com/apiserver`, but the 429s below are on `api-join.boulders.dk`.)

## 2) Exact 429s with timestamps + your requestIds

We pulled these from our Sentry project (`join-bouldersdk`). The response body includes your own `requestId` and `retryAfter: 900` — those should be the easiest log keys.

### Best keys (search these requestIds)

| Timestamp (UTC) | requestId | Endpoint (client-observed) |
|---|---|---|
| 2026-08-04T15:54:59Z | `b7fd6e21-8644-4383-8948-4c1e7069cd9e` | `/api/payment/generate-link` |
| 2026-08-04T14:54:59Z | `1a22e1e3-fd26-419a-a71e-98a321befefa` | `/api/auth/login` (URL scrubbed in Sentry; message is login rate-limit) |
| 2026-08-04T14:54:20Z | `e0d2a6ed-3f71-495e-8c2b-92498744209d` | `/api/auth/login` |
| 2026-08-04T14:21:45Z | `90bc6a40-2ae7-41bc-a042-41f84a7500f4` | `/api/auth/login` |
| 2026-08-04T14:21:35Z | `f5ef26f3-5dae-476c-9257-6ab1570164e5` | `/api/auth/login` |
| 2026-08-04T14:21:11Z | `4a1c3119-7b1e-484e-a7dd-f2d2fb79728b` | `/api/auth/login` |
| 2026-08-04T14:19:21Z | `1cd103d5-db8e-4b55-ba1e-a03afa31ece7` | `/api/auth/login` |
| 2026-08-04T13:48:31Z | `ee22c1d4-d48f-4c9a-8866-466c2a21cfa6` | `/api/payment/generate-link` |
| 2026-08-03T10:00:50Z | `d17d3930-747e-417e-a6f9-bb485559b338` | `/api/auth/login` |
| 2026-08-02T16:07:53Z | `62e4ae54-020f-441c-a027-31a04a215224` | `/api/auth/login` |

Response body marker we see:

```json
{
  "error": "Too many requests",
  "message": "Rate limit exceeded. Please try again later.",
  "retryAfter": 900,
  "requestId": "<uuid>"
}
```

### Dense cluster on 2026-08-04 (product endpoints)

These are client-side Sentry events at the same second the browser got HTTP 429 while loading product lists:

| Timestamp (UTC) | Sentry event ID | Path |
|---|---|---|
| 2026-08-04T16:25:39Z | `5a61433c6ed949ff9e3750f943ac8d24` | `/api/products/subscriptions?businessUnit=3` |
| 2026-08-04T16:24:19Z | `ae4dfff4891c486a9186b4bd0fb3b994` | `/api/products/subscriptions?businessUnit=3` |
| 2026-08-04T16:23:51Z | `9447dbf6b688455cb910b875a8be2df4` | `/api/products/valuecards` |
| 2026-08-04T15:22:54Z | `634e791138b64a6a911f61856f9d54f1` | `/api/products/subscriptions?businessUnit=12` |
| 2026-08-04T15:10:28Z | `248b0e5774bf4a4bbd74bdf6368332f7` | `/api/products/valuecards` |
| 2026-08-04T15:03:08Z | `dd0bf495175e47fcac0e7137391a8bb2` | `/api/products/subscriptions?businessUnit=3` |

Suggested time window for a first pass: **2026-08-04 13:00–17:00 UTC**.

## 3) How to search (recommended)

1. Host: `api-join.boulders.dk`
2. Status: `429` **or** body contains `Too many requests` / `retryAfter` / any `requestId` above
3. Paths:
   - `/api/auth/login`
   - `/api/payment/generate-link`
   - `/api/products/subscriptions`
   - `/api/products/valuecards`
4. Filter by Cloudflare / our proxy egress IPs (not end-user IPs)

If status `429` still does not appear, please also check whether rate-limit responses are logged under a different status/layer (WAF/gateway) while still returning that JSON body to us — because Sentry clearly received those payloads with your `requestId`s.

Happy to jump on a call or send more event IDs if useful.

Best regards,
Rami
