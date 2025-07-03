# Environment Variables Setup

## For Local Development

Create a `.env.local` file in the root directory with the following variables:

```env
# API URLs for local development
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
NEXT_PUBLIC_EXTERNAL_API_URL=https://yield-a.vercel.app
```

## For Production (Vercel)

When deploying to Vercel, set these environment variables in your Vercel dashboard:

### Development Environment
```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
NEXT_PUBLIC_EXTERNAL_API_URL=https://yield-a.vercel.app
```

### Production Environment
```env
NEXT_PUBLIC_API_BASE_URL=https://your-production-domain.vercel.app
NEXT_PUBLIC_EXTERNAL_API_URL=https://yield-a.vercel.app
```

## How to Set Environment Variables in Vercel

1. Go to your Vercel dashboard
2. Select your project
3. Go to Settings → Environment Variables
4. Add each variable:
   - **Name**: `NEXT_PUBLIC_API_BASE_URL`
   - **Value**: `https://your-production-domain.vercel.app`
   - **Environment**: Production (and Preview if needed)
5. Repeat for `NEXT_PUBLIC_EXTERNAL_API_URL`

## Important Notes

- `NEXT_PUBLIC_` prefix is required for client-side access
- The portfolio API will use `NEXT_PUBLIC_API_BASE_URL` to fetch data from protocol endpoints
- External API calls (like Aries, Joule) will continue to use the hardcoded `https://yield-a.vercel.app` URL
- Make sure your production domain is correct in the `NEXT_PUBLIC_API_BASE_URL` 