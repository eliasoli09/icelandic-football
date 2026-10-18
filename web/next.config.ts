import type { NextConfig } from "next";

/** The NFL corner moved to its own site on 16 Oct 2026 and took its name, Snertimark.net, on 18 Oct; old links follow it there for good. */
const NFL_SITE = "https://www.snertimark.net";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/nfl", destination: NFL_SITE, permanent: true },
      { source: "/nfl/:path*", destination: `${NFL_SITE}/:path*`, permanent: true },
      { source: "/ritstjorn", destination: `${NFL_SITE}/ritstjorn`, permanent: true },
      { source: "/ritstjorn/:path*", destination: `${NFL_SITE}/ritstjorn/:path*`, permanent: true },
    ];
  },
};

export default nextConfig;
