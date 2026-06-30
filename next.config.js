/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Exclude Supabase Edge Functions from Vercel build
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
      };
    }
    return config;
  },
  // Important: Tell Vercel to ignore the supabase/functions folder
  transpilePackages: ['@supabase/supabase-js'],
};

module.exports = nextConfig;