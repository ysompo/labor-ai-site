import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: '/tools/journal-club/:path*',
          destination: 'https://journal-club-23wf.onrender.com/:path*',
        }
      ]
    }
  }
};

export default nextConfig;
