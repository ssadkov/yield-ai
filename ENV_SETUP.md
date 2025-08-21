# Environment Variables Setup

## For Local Development

Create a `.env.local` file in the root directory with the following variables:

```env
# API URLs for local development
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_EXTERNAL_API_URL=https://yield-a.vercel.app

# Aptos API Configuration
APTOS_API_KEY=your_aptos_api_key_here
```

## For Production (Vercel)

When deploying to Vercel, set these environment variables in your Vercel dashboard:

### Development Environment
```env
NEXT_PUBLIC_API_URL=http://localhost:3000
NEXT_PUBLIC_EXTERNAL_API_URL=https://yield-a.vercel.app
APTOS_API_KEY=your_aptos_api_key_here
```

### Production Environment
```env
NEXT_PUBLIC_API_URL=https://your-production-domain.vercel.app
NEXT_PUBLIC_EXTERNAL_API_URL=https://yield-a.vercel.app
APTOS_API_KEY=your_aptos_api_key_here
```

## How to Set Environment Variables in Vercel

1. Go to your Vercel dashboard
2. Select your project
3. Go to Settings → Environment Variables
4. Add each variable:
   - **Name**: `NEXT_PUBLIC_API_URL`
   - **Value**: `https://your-production-domain.vercel.app`
   - **Environment**: Production (and Preview if needed)
5. Repeat for `NEXT_PUBLIC_EXTERNAL_API_URL`
6. Add `APTOS_API_KEY` with your Aptos API key value

## How to Get Aptos API Key

1. Go to [Aptos Labs Console](https://console.aptoslabs.com/)
2. Create an account or sign in
3. Create a new project
4. Get your API key from the project dashboard
5. Add it to your environment variables

## Important Notes

- `NEXT_PUBLIC_` prefix is required for client-side access
- The portfolio API will use `NEXT_PUBLIC_API_URL` to fetch data from protocol endpoints
- External API calls (like Aries, Joule) will continue to use the hardcoded `https://yield-a.vercel.app` URL
- Make sure your production domain is correct in the `NEXT_PUBLIC_API_URL`
- `APTOS_API_KEY` is required for Auro Finance integration to work properly
- `VERCEL_URL` is automatically set by Vercel and will be used as fallback if `NEXT_PUBLIC_API_URL` is not set 