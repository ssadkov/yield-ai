# How to View Logs on Vercel

## Method 1: Vercel Dashboard (Recommended)

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your project (`yield-ai`)
3. Click on the **"Deployments"** tab
4. Click on the latest deployment
5. Click on **"Functions"** tab
6. Find `/api/transactions` function
7. Click on it to see real-time logs

## Method 2: Vercel CLI

```bash
# Install Vercel CLI if not installed
npm i -g vercel

# Login to Vercel
vercel login

# Link your project (if not already linked)
vercel link

# View logs in real-time
vercel logs --follow

# View logs for specific function
vercel logs --follow /api/transactions

# View logs for last deployment
vercel logs --follow --since=1h
```

## Method 3: Check Function Logs in Dashboard

1. Go to Vercel Dashboard → Your Project
2. Click **"Functions"** in the sidebar
3. Find `api/transactions` 
4. Click to see logs, metrics, and errors

## What to Look For

- Error messages mentioning "Cloudflare"
- Status codes: 403, 429, 503
- Response times
- Retry attempts
- User-Agent being sent
- Any timeout errors
- Edge Runtime errors (if using Edge)

## Recent Changes

The `/api/transactions` route now uses **Edge Runtime** instead of Node.js runtime. This should help bypass Cloudflare because:
- Edge Functions run on Vercel's Edge Network
- They use different IP ranges that are less likely to be flagged
- Better performance and lower latency

If Edge Runtime doesn't work, you can also set up a proxy service via environment variable `APTOSCAN_PROXY_URL`.

