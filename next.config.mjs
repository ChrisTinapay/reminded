/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '4.5mb',
    },
  },
  serverActions: {
    bodySizeLimit: '4.5mb',
  },
  reactCompiler: true,
};

export default nextConfig;
