import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  webpack(config, { webpack }) {
    // Only Next.js uses this adapter; the existing Sites/Vite build is unchanged.
    config.plugins.push(new webpack.NormalModuleReplacementPlugin(
      /^cloudflare:workers$/,
      path.resolve("lib/vercel-bindings.ts"),
    ));
    config.module.rules.push({ resourceQuery: /raw/, type: "asset/source" });
    return config;
  },
};

export default nextConfig;
