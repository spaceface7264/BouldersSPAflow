# Email draft + 429 evidence for ops

> Copy everything under **Email draft** into the reply. Attach `429-events-sample.csv`.

---

## Email draft

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


---

## Appendix — full Sentry export

# HTTP 429 evidence for ops (from Sentry)

**Proxy:** Production (`join.boulders.dk`) calls ` /api-proxy?path=... ` (Cloudflare Pages Function), which forwards to `https://api-join.boulders.dk...`. Access logs should show **Cloudflare egress IPs**, not end-user IPs.

**Upstream host to search:** `api-join.boulders.dk`
**Marker in response body:** `"error":"Too many requests"`, `retryAfter: 900`, plus BRP `requestId`

## Issue summary (Sentry)

| Issue | Events (Sentry count) | First seen (UTC) | Last seen (UTC) | Title |
|---|---|---|---|---|
| JOIN-BOULDERSDK-3A | 468 | 2026-07-07T11:59:33Z | 2026-08-04T16:25:39Z | Error: HTTP error! status: 429 |
| JOIN-BOULDERSDK-3D | 170 | 2026-07-15T10:40:46Z | 2026-08-04T16:24:19Z | Error: HTTP error! status: 429 |
| JOIN-BOULDERSDK-3C | 97 | 2026-07-15T16:12:09Z | 2026-08-04T16:23:51Z | Error: HTTP error! status: 429 |
| JOIN-BOULDERSDK-3S | 4 | 2026-07-28T16:20:56Z | 2026-08-04T15:54:59Z | Error: Generate Payment Link Card failed: 429 - {"error":"Too many requests","message":"Rate limit exceeded. Please try  |
| JOIN-BOULDERSDK-1K | 177 | 2026-07-07T11:54:38Z | 2026-08-04T14:54:59Z | Error: Rate limit exceeded. Please wait 15 minutes before trying again. (429 - {"error":"Too many requests","message":"R |
| JOIN-BOULDERSDK-M | 91 | 2026-07-15T10:40:48Z | 2026-08-04T14:21:45Z | Error: Rate limit exceeded. Please wait 15 minutes before trying again. (429 - {"error":"Too many requests","message":"R |
| JOIN-BOULDERSDK-1T | 6 | 2026-07-27T15:08:46Z | 2026-08-04T13:48:31Z | Error: Generate Payment Link Card failed: 429 - {"error":"Too many requests","message":"Rate limit exceeded. Please try  |
| JOIN-BOULDERSDK-2G | 14 | 2026-07-25T11:02:56Z | 2026-08-03T10:00:50Z | Error: Rate limit exceeded. Please wait 15 minutes before trying again. (429 - {"error":"Too many requests","message":"R |

## Exact events with timestamps (newest first)

| Timestamp (UTC) | Event ID | BRP requestId | retryAfter | API path (from browser) | Issue |
|---|---|---|---|---|---|
| `2026-08-04T16:25:39Z` | `5a61433c6ed949ff9e3750f943ac8d24` | `—` | — | `/api/products/subscriptions?businessUnit=3` | JOIN-BOULDERSDK-3A |
| `2026-08-04T16:24:19Z` | `ae4dfff4891c486a9186b4bd0fb3b994` | `—` | — | `/api/products/subscriptions?businessUnit=3` | JOIN-BOULDERSDK-3D |
| `2026-08-04T16:23:51Z` | `9447dbf6b688455cb910b875a8be2df4` | `—` | — | `/api/products/valuecards?_t=1785860631024` | JOIN-BOULDERSDK-3C |
| `2026-08-04T16:23:50Z` | `83fe65dee1654b3aa51175a484e342bb` | `—` | — | `/api/products/subscriptions?businessUnit=3` | JOIN-BOULDERSDK-3D |
| `2026-08-04T15:54:59Z` | `ef8ce1fcfcc6401cbe9bd0d4b960b2aa` | `b7fd6e21-8644-4383-8948-4c1e7069cd9e` | 900 | `/api/payment/generate-link` | JOIN-BOULDERSDK-3S |
| `2026-08-04T15:22:54Z` | `634e791138b64a6a911f61856f9d54f1` | `—` | — | `/api/products/subscriptions?businessUnit=12` | JOIN-BOULDERSDK-3A |
| `2026-08-04T15:22:35Z` | `45b865ac3475486fb15e1edf7615b888` | `—` | — | `/api/products/subscriptions?businessUnit=5` | JOIN-BOULDERSDK-3D |
| `2026-08-04T15:11:07Z` | `24c990cd62de4948a3411c601ed6e797` | `—` | — | `/api/products/subscriptions?businessUnit=6` | JOIN-BOULDERSDK-3A |
| `2026-08-04T15:10:44Z` | `d63c4244418242c4a83effe2226b0787` | `—` | — | `/api/products/subscriptions?businessUnit=12` | JOIN-BOULDERSDK-3A |
| `2026-08-04T15:10:28Z` | `248b0e5774bf4a4bbd74bdf6368332f7` | `—` | — | `/api/products/valuecards?_t=1785856227945` | JOIN-BOULDERSDK-3A |
| `2026-08-04T15:10:14Z` | `8d4ef8362442465eb796d8db34c7351c` | `—` | — | `/api/products/valuecards?_t=1785856214476` | JOIN-BOULDERSDK-3A |
| `2026-08-04T15:09:12Z` | `4703f9d3600b4de99a3481c8ec692433` | `—` | — | `/api/products/valuecards?_t=1785856151927` | JOIN-BOULDERSDK-3A |
| `2026-08-04T15:08:59Z` | `e43cba2a8b21434b92cc6ec6e6a361f9` | `—` | — | `/api/products/subscriptions?businessUnit=6` | JOIN-BOULDERSDK-3D |
| `2026-08-04T15:08:39Z` | `d36a705553af4d3fa384ad9dbe5bb49f` | `—` | — | `/api/products/subscriptions?businessUnit=8` | JOIN-BOULDERSDK-3A |
| `2026-08-04T15:08:18Z` | `715d12f756e34b38be8ef0b507eb4540` | `—` | — | `/api/products/subscriptions?businessUnit=6` | JOIN-BOULDERSDK-3D |
| `2026-08-04T15:05:49Z` | `11c5d468f0bd46f19f8e072b573c32b1` | `—` | — | `/api/products/valuecards?_t=1785855949171` | JOIN-BOULDERSDK-3A |
| `2026-08-04T15:05:28Z` | `9f9fff902a964d849a6840a8670afd68` | `—` | — | `/api/products/subscriptions?businessUnit=3` | JOIN-BOULDERSDK-3D |
| `2026-08-04T15:05:21Z` | `ad4de1498ee1462eadaaad458e82de3a` | `—` | — | `/api/products/subscriptions?businessUnit=5` | JOIN-BOULDERSDK-3A |
| `2026-08-04T15:05:15Z` | `6501d24f440b4536b95b11d3f818ee7f` | `—` | — | `/api/products/subscriptions?businessUnit=11` | JOIN-BOULDERSDK-3D |
| `2026-08-04T15:04:53Z` | `69ef56b2d6ad40ffaaf1afeebc0757ef` | `—` | — | `/api/products/subscriptions?businessUnit=8` | JOIN-BOULDERSDK-3D |
| `2026-08-04T15:04:52Z` | `c00df740ba4e4453be63571fabeee917` | `—` | — | `/api/products/valuecards?_t=1785855892433` | JOIN-BOULDERSDK-3C |
| `2026-08-04T15:03:24Z` | `92fe79d4da59430fb4508e929de388c7` | `—` | — | `/api/products/subscriptions?businessUnit=3` | JOIN-BOULDERSDK-3D |
| `2026-08-04T15:03:24Z` | `c995db276ebb413383d1e3c81c7a2d78` | `—` | — | `/api/products/valuecards?_t=1785855804449` | JOIN-BOULDERSDK-3C |
| `2026-08-04T15:03:16Z` | `b4ce07bc3468407e88cc4996b54991f4` | `—` | — | `/api/products/valuecards?_t=1785855796349` | JOIN-BOULDERSDK-3A |
| `2026-08-04T15:03:08Z` | `dd0bf495175e47fcac0e7137391a8bb2` | `—` | — | `/api/products/subscriptions?businessUnit=3` | JOIN-BOULDERSDK-3A |
| `2026-08-04T15:01:33Z` | `2bac9aa3419a4d4ab46aeb82494b4b46` | `—` | — | `/api/products/subscriptions?businessUnit=13` | JOIN-BOULDERSDK-3D |
| `2026-08-04T15:00:59Z` | `7bb3684a31db455a9788f5d9b093b9d8` | `—` | — | `/api/products/subscriptions?businessUnit=9` | JOIN-BOULDERSDK-3D |
| `2026-08-04T14:56:17Z` | `b8c77c5c8009429d860962e975a409df` | `—` | — | `/api/products/subscriptions?businessUnit=8` | JOIN-BOULDERSDK-3A |
| `2026-08-04T14:55:10Z` | `f419ae970b9d412da68296b2d2e3d232` | `—` | — | `/api/products/subscriptions?businessUnit=8` | JOIN-BOULDERSDK-3A |
| `2026-08-04T14:54:59Z` | `313c90bc69474b878c4803f9478e5cf8` | `1a22e1e3-fd26-419a-a71e-98a321befefa` | 900 | `[Filtered]` | JOIN-BOULDERSDK-1K |
| `2026-08-04T14:54:20Z` | `3769eb4ef9b845ccbe70ee34a3276099` | `e0d2a6ed-3f71-495e-8c2b-92498744209d` | 900 | `[Filtered]` | JOIN-BOULDERSDK-1K |
| `2026-08-04T14:21:45Z` | `daff5d8972ff46bb9d2e5bf4f37e6c7b` | `90bc6a40-2ae7-41bc-a042-41f84a7500f4` | 900 | `[Filtered]` | JOIN-BOULDERSDK-M |
| `2026-08-04T14:21:35Z` | `cc3fb30c280b408981de828a55746191` | `f5ef26f3-5dae-476c-9257-6ab1570164e5` | 900 | `[Filtered]` | JOIN-BOULDERSDK-M |
| `2026-08-04T14:21:11Z` | `10df5c31db6d4e499b071aaa8d86234b` | `4a1c3119-7b1e-484e-a7dd-f2d2fb79728b` | 900 | `[Filtered]` | JOIN-BOULDERSDK-M |
| `2026-08-04T14:19:21Z` | `c6545ffa8b6c42dfa308b0935d751185` | `1cd103d5-db8e-4b55-ba1e-a03afa31ece7` | 900 | `[Filtered]` | JOIN-BOULDERSDK-M |

## BRP requestIds found in 429 payloads (best log search keys)

| Timestamp (UTC) | requestId | Sentry issue |
|---|---|---|
| `2026-08-04T15:54:59Z` | `b7fd6e21-8644-4383-8948-4c1e7069cd9e` | JOIN-BOULDERSDK-3S |
| `2026-08-04T14:54:59Z` | `1a22e1e3-fd26-419a-a71e-98a321befefa` | JOIN-BOULDERSDK-1K |
| `2026-08-04T14:54:20Z` | `e0d2a6ed-3f71-495e-8c2b-92498744209d` | JOIN-BOULDERSDK-1K |
| `2026-08-04T14:21:45Z` | `90bc6a40-2ae7-41bc-a042-41f84a7500f4` | JOIN-BOULDERSDK-M |
| `2026-08-04T14:21:35Z` | `f5ef26f3-5dae-476c-9257-6ab1570164e5` | JOIN-BOULDERSDK-M |
| `2026-08-04T14:21:11Z` | `4a1c3119-7b1e-484e-a7dd-f2d2fb79728b` | JOIN-BOULDERSDK-M |
| `2026-08-04T14:19:21Z` | `1cd103d5-db8e-4b55-ba1e-a03afa31ece7` | JOIN-BOULDERSDK-M |
| `2026-08-04T14:19:19Z` | `be384b75-1e1e-4188-8622-d038bb15ba2b` | JOIN-BOULDERSDK-M |
| `2026-08-04T13:50:37Z` | `c4f8354a-84e7-48bf-81b5-9378cadd0d7c` | JOIN-BOULDERSDK-1K |
| `2026-08-04T13:48:54Z` | `43145d69-0524-4961-9ad6-9e6a4589ce29` | JOIN-BOULDERSDK-1K |
| `2026-08-04T13:48:33Z` | `233e19dc-7333-48b6-a914-edab3dc2e37f` | JOIN-BOULDERSDK-1K |
| `2026-08-04T13:48:31Z` | `ee22c1d4-d48f-4c9a-8866-466c2a21cfa6` | JOIN-BOULDERSDK-1T |
| `2026-08-04T13:46:58Z` | `92194ce7-72a7-4a42-878c-0faa415e813d` | JOIN-BOULDERSDK-1K |
| `2026-08-04T13:30:56Z` | `d16a2944-fa6e-4ca4-85da-f367b0cd28d2` | JOIN-BOULDERSDK-1K |
| `2026-08-04T10:19:46Z` | `1c493caf-c4be-4c36-97b0-e1263d3820eb` | JOIN-BOULDERSDK-M |
| `2026-08-04T10:19:35Z` | `bff115c5-4b0e-4611-8b22-6f49f740382a` | JOIN-BOULDERSDK-1K |
| `2026-08-04T10:19:07Z` | `86f19641-39da-4123-a480-5670cbc4d6bc` | JOIN-BOULDERSDK-M |
| `2026-08-04T09:16:55Z` | `c2acc486-420f-4810-b855-12ccb2a74e0e` | JOIN-BOULDERSDK-M |
| `2026-08-03T11:57:46Z` | `ff765f4b-d79a-417b-b5f2-7eb82f468f9e` | JOIN-BOULDERSDK-1K |
| `2026-08-03T11:16:03Z` | `e1669e94-2681-422b-8cd4-365a568e92e2` | JOIN-BOULDERSDK-1T |
| `2026-08-03T10:00:50Z` | `d17d3930-747e-417e-a6f9-bb485559b338` | JOIN-BOULDERSDK-2G |
| `2026-08-03T10:00:44Z` | `9dadd0e4-9081-4cef-8ab2-5f22ffc58804` | JOIN-BOULDERSDK-2G |
| `2026-08-03T09:59:30Z` | `14c0e6bd-9a91-4b2a-aeaf-482c333a0d42` | JOIN-BOULDERSDK-2G |
| `2026-08-03T09:59:10Z` | `912cf7c8-d03d-465e-96bc-e332d40def6e` | JOIN-BOULDERSDK-2G |
| `2026-08-03T09:58:55Z` | `eed12be9-9122-42c5-addf-9591e3b5cfcb` | JOIN-BOULDERSDK-M |
| `2026-08-03T09:58:54Z` | `1edf0cef-fa6e-4994-afb8-d5b20e4a03e4` | JOIN-BOULDERSDK-M |
| `2026-08-03T09:58:44Z` | `4453ac7d-3278-4c03-a0c5-efb24724c784` | JOIN-BOULDERSDK-M |
| `2026-08-03T09:58:43Z` | `763243f8-5536-4f38-ad81-b9b3b71e2afa` | JOIN-BOULDERSDK-M |
| `2026-08-03T09:58:37Z` | `6a0d83b6-95e5-484e-abfb-d34e1513e123` | JOIN-BOULDERSDK-M |
| `2026-08-03T09:58:37Z` | `c011afb2-7c54-444c-8f6b-b2340c254b81` | JOIN-BOULDERSDK-M |
| `2026-08-03T09:58:36Z` | `cc7d7778-d893-4d82-87d3-d08148c22fdf` | JOIN-BOULDERSDK-M |
| `2026-08-03T09:58:35Z` | `cc514a62-31d5-45d9-8cf0-891059da0484` | JOIN-BOULDERSDK-M |
| `2026-08-03T09:58:29Z` | `a8ceb02f-3c55-4181-84c3-1fbb341aa9e6` | JOIN-BOULDERSDK-M |
| `2026-08-02T17:58:36Z` | `13f02bae-c786-4951-9f7b-73201c5f9f67` | JOIN-BOULDERSDK-M |
| `2026-08-02T16:07:53Z` | `62e4ae54-020f-441c-a027-31a04a215224` | JOIN-BOULDERSDK-1K |
| `2026-08-02T16:07:22Z` | `dc96cf25-d3ed-4bc0-8bee-3e46b202461c` | JOIN-BOULDERSDK-1K |
| `2026-08-02T16:05:18Z` | `36b35d9e-53ca-4fae-800a-47f9601d40a9` | JOIN-BOULDERSDK-1K |
| `2026-08-02T15:06:57Z` | `7a4447c3-558f-4ca0-a1dc-4c74013130e6` | JOIN-BOULDERSDK-M |
| `2026-08-02T15:06:41Z` | `fc0c683e-639d-41d3-a64d-c9a448570f8a` | JOIN-BOULDERSDK-1T |
| `2026-08-02T15:06:32Z` | `772a779e-9c60-40d3-8067-893d2d6e67b0` | JOIN-BOULDERSDK-1K |

## API paths observed near/at 429 (breadcrumb sample)

- `[Filtered]` × 205
- `/api/products/subscriptions?businessUnit=12` × 31
- `/api/products/subscriptions?businessUnit=6` × 23
- `/api/products/subscriptions?businessUnit=11` × 23
- `/api/products/subscriptions?businessUnit=13` × 20
- `/api/products/subscriptions?businessUnit=8` × 15
- `/api/products/subscriptions?businessUnit=3` × 14
- `/api/products/subscriptions?businessUnit=5` × 11
- `/api/payment/generate-link` × 10
- `/api/products/subscriptions?businessUnit=1` × 9
- `/api/products/subscriptions?businessUnit=7` × 9
- `/api/products/subscriptions?businessUnit=9` × 7
- `/api/products/subscriptions?businessUnit=4` × 5
- `/api/products/valuecards?_t=1785860631024` × 1
- `/api/products/valuecards?_t=1785856227945` × 1
- `/api/products/valuecards?_t=1785856214476` × 1
- `/api/products/valuecards?_t=1785856151927` × 1
- `/api/products/valuecards?_t=1785855949171` × 1
- `/api/products/valuecards?_t=1785855892433` × 1
- `/api/products/valuecards?_t=1785855804449` × 1

## Exported event volume by UTC day (from latest ~100 events/issue sample)

| Day (UTC) | Sampled events |
|---|---|
| 2026-08-04 | 119 |
| 2026-08-03 | 24 |
| 2026-08-02 | 167 |
| 2026-08-01 | 48 |
| 2026-07-31 | 58 |
| 2026-07-30 | 10 |
| 2026-07-29 | 10 |
| 2026-07-28 | 24 |
| 2026-07-27 | 9 |
| 2026-07-25 | 3 |
| 2026-07-23 | 2 |
| 2026-07-22 | 13 |
| 2026-07-21 | 1 |
| 2026-07-20 | 4 |
| 2026-07-19 | 8 |
| 2026-07-18 | 3 |
| 2026-07-17 | 1 |
| 2026-07-15 | 8 |

## Suggested ops search

1. Host: `api-join.boulders.dk`
2. Status: `429`
3. Time window: especially **2026-08-04 13:00–17:00 UTC** (dense cluster), also 2026-07-07 → 2026-08-04
4. Body/fields: `retryAfter=900` / `Too many requests` / any `requestId` from the table above
5. Paths: `/api/auth/login`, payment-link generation, `/api/reference/business-units` (and any other paths in breadcrumbs)
6. Client IP: Cloudflare Pages/Workers egress, not visitor IPs

