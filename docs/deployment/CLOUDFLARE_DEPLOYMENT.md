# Cloudflare Pages Deployment Configuration

## Required Cloudflare Pages Settings

To deploy this project to Cloudflare Pages, configure the following in your Cloudflare Pages dashboard:

### Build Settings

1. **Build command:** `npm run build`
2. **Build output directory:** `dist`  
3. **Root directory:** `/` (root of repository)
4. **Node.js version:** 18 or higher

### Deploy Settings

**IMPORTANT:** You must use `wrangler pages deploy` (NOT `wrangler deploy`)

**Deploy command:** `npx wrangler pages deploy ./dist`

OR use the npm script:

**Deploy command:** `npm run deploy`

## Current Issue

If your Cloudflare Pages is currently configured to run `npx wrangler deploy`, you need to change it to `npx wrangler pages deploy ./dist`.

The difference:
- `wrangler deploy` - for Cloudflare Workers (needs a Worker script)
- `wrangler pages deploy` - for Cloudflare Pages (deploys static assets + functions)

## Important Notes

- The `functions` directory contains Cloudflare Pages Functions for API proxying (CORS handling)
- The `dist` directory contains the built static assets (created by `npm run build`)
- The API proxy function at `/api-proxy` will automatically handle CORS issues
- Make sure the build command runs BEFORE the deploy command

## Troubleshooting

If you see "Missing entry-point" errors:
- ✅ Change deploy command from `npx wrangler deploy` to `npx wrangler pages deploy ./dist`
- ✅ Ensure build command is set to `npm run build`
- ✅ Verify the `dist` directory exists after build completes
- ✅ Check that Node.js version is 18+ in Cloudflare Pages settings

