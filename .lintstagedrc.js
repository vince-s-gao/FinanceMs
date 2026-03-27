// InfFinanceMs - Lint Staged 配置

const quoteFiles = (files) => files.map((file) => JSON.stringify(file)).join(" ");

module.exports = {
  // API 代码：走 Nest ESLint 配置
  'apps/api/src/**/*.ts': (files) => [
    'npm run lint --workspace=@inffinancems/api',
    `prettier --write ${quoteFiles(files)}`,
  ],
  // Web 代码：走 Next ESLint 配置
  'apps/web/**/*.{ts,tsx,js,jsx}': (files) => [
    'npm run lint --workspace=@inffinancems/web',
    `prettier --write ${quoteFiles(files)}`,
  ],
  // 共享包：目前只做格式化（未配置统一 ESLint）
  'packages/**/*.{ts,tsx,js,jsx}': ['prettier --write'],
  // 样式文件
  '**/*.{css,scss,less}': ['prettier --write'],
  // JSON 文件
  '**/*.json': ['prettier --write'],
  // Markdown 文件
  '**/*.md': ['prettier --write'],
};
