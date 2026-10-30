import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // pdf-parse ships its own workers — keep it out of the bundler so PDF text
  // extraction works in server routes
  serverExternalPackages: ["pdf-parse"],
};

export default nextConfig;
