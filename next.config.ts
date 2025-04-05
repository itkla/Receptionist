import type { NextConfig } from "next";
import type { Configuration } from "webpack"; // Import webpack Configuration type

const nextConfig: NextConfig = {
  /* config options here */
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
