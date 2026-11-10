import type { NextConfig } from "next";
import path from "node:path";

const root = path.resolve(__dirname, "../..");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  outputFileTracingRoot: root,
  transpilePackages: [
    "@motionforge/ai-engine",
    "@motionforge/asset-manager",
    "@motionforge/database",
    "@motionforge/shared",
    "@motionforge/video-components",
    "@motionforge/video-schema",
    "remotion",
    "@remotion/player",
  ],
  serverExternalPackages: [
    "@remotion/bundler",
    "@remotion/renderer",
    "@remotion/compositor-linux-x64-gnu",
    "@remotion/compositor-linux-x64-musl",
    "@prisma/client",
    "prisma",
    "esbuild",
  ],
  webpack: (config) => {
    config.resolve = config.resolve ?? {};
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      remotion: path.join(root, "node_modules/remotion"),
    };
    return config;
  },
};

export default nextConfig;
