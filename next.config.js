/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
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