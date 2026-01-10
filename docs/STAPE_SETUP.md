# Stape Setup Instructions

## Container Configuration for Stape

**Container ID:** `GTM-P8DL49HC` (Server container)

### Steps to Complete Stape Setup:

1. **In Stape form, fill in:**
   - **Container name:** `join.boulders.dk`
   - **Container configuration:** `GTM-P8DL49HC` (or the Container Configuration string if GTM provided a longer one)
   - **Servers location:** `EU Center (France)`
   - Click "Create Container"

2. **After Stape container is created:**
   - Stape will provide you with a custom domain (e.g., `gtm.join.boulders.dk` or similar)
   - You'll need to configure DNS records to point this domain to Stape's servers
   - This custom domain becomes your Tagging Server URL

3. **Back in GTM Server Container:**
   - Go to Admin → Container Settings → Tagging Server
   - Enter the Stape-provided Tagging Server URL
   - Save the configuration

## Important Notes

- **GTM-P8DL49HC** is your **Server container** (for Stape)
- You still need a separate **Web container** for client-side GTM on your website
- The Web container will send events to the Server container (via Stape)

## Next Steps After Stape Setup

1. Configure server-side tags in GTM Server container:
   - GA4 server-side tag
   - Google Ads Enhanced Conversions
   - Meta Conversions API
   - TikTok Events API

2. Set up deduplication using Event IDs

3. Configure custom domain DNS records
