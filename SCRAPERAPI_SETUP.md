# ScraperAPI Setup for Cloudflare Bypass

## Problem
Aptoscan API is protected by Cloudflare, which blocks requests from Vercel serverless functions.

## Solution: ScraperAPI

ScraperAPI is a service that handles Cloudflare bypass automatically. It routes requests through residential IPs and handles all the complexity of bypassing Cloudflare protection.

## Setup Instructions

### 1. Get ScraperAPI Key

1. Go to [ScraperAPI](https://www.scraperapi.com/)
2. Sign up for a free account (1000 free requests/month)
3. Get your API key from the dashboard

### 2. Add to Vercel Environment Variables

1. Go to Vercel Dashboard → Your Project
2. Navigate to **Settings** → **Environment Variables**
3. Add new variable:
   - **Name**: `SCRAPERAPI_KEY`
   - **Value**: Your ScraperAPI API key
   - **Environment**: Production (and Preview if needed)
4. Save and redeploy

### 3. Verify Setup

After deployment, check logs to see if requests are going through ScraperAPI:
- Look for log message: `Fetching from Aptoscan (attempt 1): via ScraperAPI`
- If you see `direct` instead, the key is not set correctly

## Alternative: Other Proxy Services

If ScraperAPI doesn't work or you prefer another service, you can modify the code to use:

- **Bright Data** (formerly Luminati)
- **ProxyMesh**
- **Smartproxy**
- **Oxylabs**

Just update the `SCRAPERAPI_URL` logic in `src/app/api/transactions/route.ts` to use your preferred service's API format.

## Cost

- **ScraperAPI Free Tier**: 1000 requests/month
- **ScraperAPI Paid Plans**: Starting from $29/month for 10,000 requests

For production use, consider the paid plan if you exceed the free tier limits.

## Testing Locally

1. Add `SCRAPERAPI_KEY` to your `.env.local` file:
```env
SCRAPERAPI_KEY=your_api_key_here
```

2. Test the endpoint:
```bash
curl "http://localhost:3000/api/transactions?address=0x4ade47d86d1013af5a0e38bbbd5d745a72cf4b9fa9759f4a5f7434b15bb1fbd1"
```

## Troubleshooting

If you still get Cloudflare errors:
1. Verify your API key is correct
2. Check ScraperAPI dashboard for usage/quota
3. Verify the key is set in the correct environment (Production vs Preview)
4. Check Vercel logs for any ScraperAPI errors

