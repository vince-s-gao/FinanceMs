/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV !== 'production';

const nextConfig = {
  // 隔离开发与生产构建目录，避免并行执行 dev/build 时 chunk 互相覆盖导致模块丢失
  distDir: isDev ? '.next-dev' : '.next',

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
