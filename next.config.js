/** @type {import('next').NextConfig} */
const nextConfig = {
  // Produce a self-contained minimal build output that can run on its own
  // without copying node_modules into the final Docker image.
  output: "standalone",
  reactStrictMode: true,
  // Allow the Docker container to be served behind Cloudflare Tunnel / reverse proxy.
  poweredByHeader: false,
};

module.exports = nextConfig;
