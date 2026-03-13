import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  serverExternalPackages: ["bcryptjs", "jose", "mysql2"],
  reactStrictMode: true,
  // Kurangi ukuran bundle dengan tree-shake icon & UI
  experimental: {
    optimizePackageImports: ["@remixicon/react"],
  },
  redirects: async () => {
    return [
      {
        source: "/",
        destination: "/dashboard",
        permanent: true,
      },
    ]
  },
}

export default nextConfig
