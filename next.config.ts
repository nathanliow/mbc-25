import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Exclude encifher-swap-sdk dependencies from bundling if needed
  serverExternalPackages: [],
  // Disable Turbopack and use webpack for WASM support
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  webpack: (config: any, { isServer }: any) => {
    // Only apply WASM handling for server-side builds
    if (isServer) {
      // Handle WASM files
      config.experiments = {
        ...config.experiments,
        asyncWebAssembly: true,
      };

      // Handle .wasm files - copy them as assets
      config.module.rules.push({
        test: /\.wasm$/,
        type: "asset/resource",
      });
    }

    // Browser-specific replacements for Node.js modules
    if (!isServer) {
      // Replace crypto for Encifher Swap SDK
      config.resolve.alias = {
        ...config.resolve.alias,
        "crypto": path.resolve(__dirname, "lib/encifher-crypto-adapter.js"),
      };
    }

    // Resolve WASM files from node_modules
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      path: false,
      crypto: false,
      stream: false,
      buffer: false,
    };

    return config;
  },
  // Explicitly use webpack instead of Turbopack for WASM support
  // Set empty turbopack config to silence the warning
  turbopack: {},
};

export default nextConfig;
