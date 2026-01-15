## Own CDN (Cloudflare) Checklist

Use this once DNS for `boulders.dk` is moved to Cloudflare.

### 1) Stape: Add custom domain (Own CDN)
- Go to Stape → container → Domains → Add custom domain
- Domain name: `gtm.join.boulders.dk`
- Enable **Add CDN** → select **Own CDN**
- Connection: **Manual**
- Copy the DNS records Stape provides (CNAME or A records)

### 2) Cloudflare: DNS records
- Add the records exactly as Stape shows
- Proxy status: **Proxied (orange cloud ON)** for Own CDN

### 3) Cloudflare: Configuration rule (SSL)
- Rules → Configuration rules → Create
- Filter: hostname contains `gtm.join.boulders.dk`
- Set **SSL** to **Full**

### 4) Cloudflare: Request header transform rule
- Rules → Transform rules → Request header → Create
- Filter: hostname contains `gtm.join.boulders.dk`
- Set static header:
  - **Header name:** `X-From-Cdn`
  - **Value:** `cf-stape`

### 5) Cloudflare: Cache rule
- Rules → Cache rules → Create
- Filter: hostname contains `gtm.join.boulders.dk`
- Cache eligibility: **Bypass cache**

### 6) Stape: Verify
- Return to Stape Domains
- Click **Verify** and wait for status **Ready**

### 7) GTM: Confirm URLs
- Server container Tagging Server URL remains `https://gtm.join.boulders.dk`
- Web container GA4 configs should already use `server_container_url = https://gtm.join.boulders.dk`

### 8) Test
- Open `https://gtm.join.boulders.dk/healthy` → should return **OK**
- Run a test purchase
- Verify in GTM Server Preview and GA4 DebugView
