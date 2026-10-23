/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "http",
        hostname: "localhost",
        port: "8000",
        pathname: "/static/**",
      },
      {
        protocol: "http",
        hostname: "backend",
        port: "8000",
        pathname: "/static/**",
      },
    ],
  },
  output: "standalone",
};

module.exports = nextConfig;
