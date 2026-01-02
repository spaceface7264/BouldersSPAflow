#!/bin/bash
# Cloudflare Pages deployment script
# Builds the project and deploys using wrangler

set -e

# Build the project
echo "Building project..."
npm run build

# Deploy using wrangler with assets flag
echo "Deploying to Cloudflare..."
npx wrangler deploy --assets=./dist

