/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  // Optimize chunk loading for Vercel deployment
  webpack: (config, { isServer }) => {
    if (!isServer) {
      // Optimize chunk splitting for better loading
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          default: {
            minChunks: 2,
            priority: -20,
            reuseExistingChunk: true,
          },
          vendor: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendors',
            priority: -10,
            chunks: 'all',
          },
          // Group protocol-related modules together
          protocols: {
            test: /[\\/]lib[\\/]protocols[\\/]/,
            name: 'protocols',
            priority: 10,
            chunks: 'all',
          },
          // Group services together
          services: {
            test: /[\\/]lib[\\/]services[\\/]/,
            name: 'services',
            priority: 5,
            chunks: 'all',
          },
        },
      };
    }
    return config;
  },
  // Add experimental features for better chunk handling
  experimental: {
    optimizePackageImports: ['@radix-ui/react-icons', 'lucide-react'],
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'assets.panora.exchange',
        port: '',
        pathname: '/tokens/**',
      },
      {
        protocol: 'https',
        hostname: 'ariesmarkets.xyz',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'app.earnium.io',
        port: '',
        pathname: '/**',
      },
    ],
    domains: [
      'hyperion.xyz',
      'ariesmarkets.xyz',
      'app.joule.finance',
      'app.echelon.market',
      'tapp.exchange',
      'app.meso.finance',
      'app.auro.finance',
      'app.kofi.finance',
      'app.earnium.io'
    ],
  },
}

module.exports = nextConfig 