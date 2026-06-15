import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // We sit inside a parent dir that also has a lockfile; pin the trace root
  // to this project so Vercel's file tracing resolves from here.
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
