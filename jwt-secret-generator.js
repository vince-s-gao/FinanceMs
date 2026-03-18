#!/usr/bin/env node

/**
 * JWT 密钥生成器
 * 用于生成强随机 JWT 密钥
 */

const crypto = require('crypto');

// 生成 32 字节的随机密钥（Base64 编码）
const secret = crypto.randomBytes(32).toString('base64');

console.log('='.repeat(60));
console.log('🔐 JWT 密钥生成器');
console.log('='.repeat(60));
console.log('');
console.log('生成的强密钥（Base64 编码）:');
console.log('');
console.log(secret);
console.log('');
console.log('='.repeat(60));
console.log('使用说明:');
console.log('='.repeat(60));
console.log('');
console.log('1. 复制上面的密钥');
console.log('2. 粘贴到 .env 文件的 JWT_SECRET 变量中');
console.log('3. 确保 .env 文件不被提交到版本控制系统');
console.log('');
console.log('示例:');
console.log('JWT_SECRET="' + secret + '"');
console.log('');
console.log('='.repeat(60));
