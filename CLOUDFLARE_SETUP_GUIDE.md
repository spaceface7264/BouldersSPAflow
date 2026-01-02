# Cloudflare Pages Setup Guide

## Step-by-Step Setup Instructions

### Step 1: Access Cloudflare Dashboard
1. Go to https://dash.cloudflare.com
2. Log in to your Cloudflare account
3. Select your account/organization

### Step 2: Create a New Pages Project
1. In the left sidebar, click **"Pages"**
2. Click **"Create a project"** button
3. Choose **"Connect to Git"** (if you see this option)
4. Select your Git provider (GitHub/GitLab/Bitbucket)
5. Authorize Cloudflare to access your repositories
6. Select repository: **`spaceface7264/BouldersSPAflow`**
7. Click **"Begin setup"**

### Step 3: Configure Project Settings

#### Basic Settings:
- **Project name:** `boulders-membership-flow` (or your preferred name)
- **Production branch:** `main`
- **Root directory:** `/` (leave as default - root of repo)

#### Build Settings:
- **Framework preset:** None (or "Vite" if available)
- **Build command:** `npm run build`
- **Build output directory:** `dist`
- **Node.js version:** 18 or higher (if available)

### Step 4: Environment Variables (Optional)
If you need any environment variables:
1. Expand **"Environment variables"** section
2. Add variables like:
   - `VITE_BASE_PATH` = `/` (if needed)
   - Any other variables your app requires
3. For now, you can skip this section

### Step 5: Advanced Settings (If Available)
Some Cloudflare Pages setups have advanced settings:
- **Deploy command:** Leave empty (Cloudflare auto-deploys build output)
- OR if you see a "Deploy command" field, you can use: `npx wrangler pages deploy ./dist`
- But typically, Cloudflare Pages automatically deploys the `dist` folder after build

### Step 6: Save and Deploy
1. Review all settings
2. Click **"Save and Deploy"**
3. Cloudflare will:
   - Clone your repository
   - Install dependencies (`npm install`)
   - Run build command (`npm run build`)
   - Deploy the `dist` folder automatically
   - Deploy Functions from `functions/` directory automatically

### Step 7: Monitor Deployment
1. Watch the build logs in real-time
2. Check for any errors
3. Wait for deployment to complete (usually 2-5 minutes)

### Step 8: Verify Deployment
Once deployment completes:
1. You'll get a URL like: `https://boulders-membership-flow.pages.dev`
2. Click the URL to visit your site
3. Open browser DevTools (F12) → Console tab
4. Check for CORS errors (should be resolved)
5. Test API calls - they should go through `/api-proxy`

## Important Notes

### Automatic Function Deployment
- Cloudflare Pages automatically detects and deploys functions from the `functions/` directory
- Your `functions/api-proxy.ts` will be available at `/api-proxy`
- No additional configuration needed!

### If You See Build Errors
1. Check Node.js version is 18+
2. Verify `npm run build` works locally
3. Check build logs for specific errors
4. Ensure all dependencies are in `package.json`

### Custom Domain (Optional)
After deployment:
1. Go to your Pages project settings
2. Click **"Custom domains"**
3. Add your custom domain (e.g., `join.boulders.dk`)
4. Follow DNS setup instructions

## Troubleshooting

### Issue: "Missing entry-point" error
**Solution:** Make sure you're using Cloudflare Pages (not Workers), and the build output directory is set to `dist`

### Issue: CORS errors still appearing
**Solution:** 
1. Verify `functions/api-proxy.ts` exists
2. Check that API calls use `/api-proxy?path=...` format
3. Verify the function deployed successfully (check Functions tab in Pages dashboard)

### Issue: Build fails
**Solution:**
1. Check Node.js version (should be 18+)
2. Verify all dependencies are in `package.json`
3. Try building locally: `npm run build`
4. Check build logs for specific error messages

## Quick Reference

### Build Settings Summary:
```
Project name: boulders-membership-flow
Production branch: main
Build command: npm run build
Build output directory: dist
Root directory: /
```

### What Gets Deployed:
- ✅ Static files from `dist/` directory
- ✅ Functions from `functions/` directory (automatically)
- ✅ All assets (CSS, JS, images)

### Your API Proxy:
- **Endpoint:** `/api-proxy`
- **Usage:** `/api-proxy?path=/api/reference/business-units`
- **Location:** `functions/api-proxy.ts`
- **Purpose:** Handles CORS for API requests

## Next Steps After Deployment

1. ✅ Test the site at the provided Pages URL
2. ✅ Verify API calls work (check Network tab)
3. ✅ Test the signup flow end-to-end
4. ✅ Set up custom domain (if needed)
5. ✅ Configure environment variables (if needed)

## Support

If you encounter issues:
1. Check Cloudflare Pages documentation: https://developers.cloudflare.com/pages/
2. Review build logs in Cloudflare dashboard
3. Test locally first: `npm run build && npm run preview`

