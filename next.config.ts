import type { NextConfig } from "next";
import type { Configuration } from "webpack"; // Import webpack Configuration type

const nextConfig: NextConfig = {
  // Add CORS headers configuration
  async headers() {
    return [
      {
        // Apply these headers to all API routes
        source: "/api/:path*",
        headers: [
          // Allow requests from Concierge's origin
          { key: "Access-Control-Allow-Origin", value: "http://localhost:1137" }, 
          // Allow common methods
          { key: "Access-Control-Allow-Methods", value: "GET, POST, PUT, DELETE, PATCH, OPTIONS" }, 
          // Allow necessary headers, including Authorization for API keys
          { key: "Access-Control-Allow-Headers", value: "Content-Type, Authorization, x-receptionist-api" },
          // Allow credentials (cookies, authorization headers)
          { key: "Access-Control-Allow-Credentials", value: "true" }, 
        ],
      },
    ];
  },
  webpack: (
    config: Configuration,
    { isServer }: { isServer: boolean }
  ) => {
    // Exclude problematic dependencies from being bundled
    config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : []),
        '@mapbox/node-pre-gyp', // Prevent bundling of this package and its problematic requires
        'nock', // Prevent bundling nock and its internal requires like @mswjs
        'fs' // Prevent bundling fs/realpath issues
    ];

    // Important: return the modified config
    return config;
  },
};

export default nextConfig;
