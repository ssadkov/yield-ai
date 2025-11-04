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

The `/api/transactions` endpoint now uses **client-side fetching** to bypass Cloudflare blocking:

### Why This Works

- **On localhost**: Requests go from your IP → Aptoscan API (works fine)
- **On Vercel (server-side)**: Requests go from Vercel datacenter IPs → Aptoscan API (blocked by Cloudflare)
- **Solution**: Requests now go directly from user's browser (user's IP) → Aptoscan API (works fine!)

### How It Works

1. **Primary**: Client-side fetch from browser directly to Aptoscan API
   - Uses user's real IP address (not Vercel datacenter IP)
   - Cloudflare allows these requests
   - No proxy services needed

2. **Fallback**: If client-side fails (e.g., CORS), falls back to server-side API
   - Uses existing `/api/transactions` endpoint
   - May still be blocked by Cloudflare on Vercel, but serves as backup

### Checking Logs

In browser console, look for:
- `[Client] Fetching from Aptoscan` - Client-side fetch is being used (should work!)
- `Client-side fetch failed, falling back to server API` - Fallback to server (may be blocked)

