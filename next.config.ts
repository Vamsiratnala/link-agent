import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["nodemailer"],
  experimental: {
    // Resume uploads go through server actions.
    serverActions: { bodySizeLimit: "10mb" },
  },
};

export default nextConfig;
