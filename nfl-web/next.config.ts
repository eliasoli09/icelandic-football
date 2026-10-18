import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // the site moved to its own name: the old Vercel address sends everyone, and every path, to it
  async redirects() {
    return [{ source: '/:path*', has: [{ type: 'host', value: 'nfl-island.vercel.app' }], destination: 'https://www.snertimark.net/:path*', permanent: true }]
  },
}

export default nextConfig
