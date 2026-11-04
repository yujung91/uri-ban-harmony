import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  async rewrites() {
    if (process.env.HARMONY_NEXT_RUNTIME !== '1') return [];
    return [
      { source: '/signin-with-chatgpt', destination: '/api/auth/login' },
      { source: '/signout-with-chatgpt', destination: '/api/auth/logout' },
    ];
  },
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
