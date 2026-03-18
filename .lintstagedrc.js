// InfFinanceMs - Lint Staged 配置

module.exports = {
  // TypeScript 文件
  '**/*.ts': ['eslint --fix', 'prettier --write'],
  // JavaScript 文件
  '**/*.js': ['eslint --fix', 'prettier --write'],
  // React 文件
  '**/*.tsx': ['eslint --fix', 'prettier --write'],
  // 样式文件
  '**/*.{css,scss,less}': ['prettier --write'],
  // JSON 文件
  '**/*.json': ['prettier --write'],
  // Markdown 文件
  '**/*.md': ['prettier --write'],
};
