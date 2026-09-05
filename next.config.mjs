/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },   // lint runs as its own gate: `npm run lint`
  experimental: { optimizePackageImports: ['react-syntax-highlighter'] },
};
export default nextConfig;
