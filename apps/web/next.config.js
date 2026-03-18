/** @type {import('next').NextConfig} */
const nextConfig = {
  // 转译 workspace 包
  transpilePackages: ['@inffinancems/shared'],
  
  // 实验性功能
  experimental: {
    // 启用服务端操作
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },

  // 重定向配置
  async redirects() {
    return [
      {
        source: '/',
        destination: '/dashboard',
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;
