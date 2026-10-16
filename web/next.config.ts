import type { NextConfig } from "next";

/** The NFL corner moved to its own site on 16 Oct 2026; old links follow it there. Temporary (307) until the site has its final name. */
const NFL_SITE = "https://nfl-island.vercel.app";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/nfl", destination: NFL_SITE, permanent: false },
      { source: "/nfl/:path*", destination: `${NFL_SITE}/:path*`, permanent: false },
      { source: "/ritstjorn", destination: `${NFL_SITE}/ritstjorn`, permanent: false },
      { source: "/ritstjorn/:path*", destination: `${NFL_SITE}/ritstjorn/:path*`, permanent: false },
    ];
  },
};

export default nextConfig;
