import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  ...(process.env.NODE_ENV === 'development' && {
    allowedDevOrigins: [
      '10.1.1.16',
      '10.20.70.22',
      '172.19.160.1',
      '26.0.44.240',
      'localhost:3000',
      '0.0.0.0:3000',
    ],
  }),
} as any;

export default nextConfig;
