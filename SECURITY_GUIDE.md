# InfFinanceMs - 安全配置指南

## 目录
1. [环境变量配置](#)
2. [JWT 密钥生成](#)
3. [数据库安全](#)
4. [HTTPS 配置](#)
5. [防火墙配置](#)
6. [监控和日志](#)
7. [备份策略](#)

---

## 环境变量配置

### 必需配置

```bash
# 数据库配置
DATABASE_URL="postgresql://用户名:强密码@主机:端口/数据库名?schema=public"

# JWT 配置（必须使用强密钥）
JWT_SECRET="使用 jwt-secret-generator.js 生成的密钥"
JWT_EXPIRES_IN="2h"
JWT_REFRESH_TOKEN_EXPIRES_IN="7d"

# 应用配置
NODE_ENV="production"
API_PORT=3001
WEB_PORT=3000

# CORS 配置（仅允许前端域名）
CORS_ORIGIN="https://your-frontend-domain.com"

# 前端URL
FRONTEND_URL="https://your-frontend-domain.com"

# Next.js 公共变量
NEXT_PUBLIC_API_URL="https://your-api-domain.com/api"
NEXT_PUBLIC_APP_NAME="InfFinanceMs"
NEXT_PUBLIC_FEISHU_ENABLED="true"
```

### 可选配置

```bash
# Redis 配置（用于会话管理和缓存）
REDIS_URL="redis://用户名:密码@主机:端口"

# 飞书应用配置
FEISHU_APP_ID="your-feishu-app-id"
FEISHU_APP_SECRET="your-feishu-app-secret"
FEISHU_REDIRECT_URI="https://your-api-domain.com/api/auth/feishu/callback"

# 上传目录配置
UPLOAD_DIR="/var/uploads/inffinancems"
```

---

## JWT 密钥生成

### 生成强密钥

```bash
# 运行密钥生成器
node jwt-secret-generator.js
```

### 手动生成（Node.js）

```javascript
const crypto = require('crypto');
const secret = crypto.randomBytes(32).toString('base64');
console.log(secret);
```

### 手动生成（命令行）

```bash
# Linux/Mac
openssl rand -base64 32

# Windows PowerShell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Minimum 0 -Maximum 256 }))
```

### 密钥要求

- 长度：至少 32 字节（Base64 编码后约 44 字符）
- 格式：Base64 编码的随机字节
- 安全性：使用加密安全的随机数生成器
- 存储：保存在 `.env` 文件中，不要提交到版本控制

---

## 数据库安全

### 连接字符串安全

```bash
# ✅ 正确：使用强密码
DATABASE_URL="postgresql://inffinancems:Str0ngP@ssw0rd!@localhost:5432/inffinancems?schema=public"

# ❌ 错误：使用弱密码
DATABASE_URL="postgresql://inffinancems:password@localhost:5432/inffinancems?schema=public"
```

### 数据库用户权限

```sql
-- 创建专用数据库用户
CREATE USER inffinancems_app WITH PASSWORD 'Str0ngP@ssw0rd!';

-- 授予必要权限
GRANT CONNECT ON DATABASE inffinancems TO inffinancems_app;
GRANT USAGE ON SCHEMA public TO inffinancems_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO inffinancems_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO inffinancems_app;

-- 设置默认权限
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO inffinancems_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO inffinancems_app;
```

### 数据库加密

- 启用 SSL 连接
- 使用透明数据加密（TDE）
- 对敏感字段进行应用层加密

---

## HTTPS 配置

### 使用 Nginx 反向代理

```nginx
server {
    listen 80;
    server_name your-api-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-api-domain.com;

    ssl_certificate /path/to/certificate.crt;
    ssl_certificate_key /path/to/private.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # 安全头
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    location / {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 使用 Let's Encrypt 免费证书

```bash
# 安装 Certbot
sudo apt-get install certbot python3-certbot-nginx

# 获取证书
sudo certbot --nginx -d your-api-domain.com

# 自动续期
sudo certbot renew --dry-run
```

---

## 防火墙配置

### 使用 UFW（Ubuntu）

```bash
# 启用防火墙
sudo ufw enable

# 允许 SSH
sudo ufw allow 22/tcp

# 允许 HTTP 和 HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# 仅允许本地访问数据库
sudo ufw allow from 127.0.0.1 to any port 5432

# 查看状态
sudo ufw status
```

### 使用 iptables

```bash
# 清除现有规则
sudo iptables -F
sudo iptables -X

# 允许已建立的连接
sudo iptables -A INPUT -m state --state ESTABLISHED,RELATED -j ACCEPT

# 允许 SSH
sudo iptables -A INPUT -p tcp --dport 22 -j ACCEPT

# 允许 HTTP 和 HTTPS
sudo iptables -A INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -A INPUT -p tcp --dport 443 -j ACCEPT

# 拒绝其他连接
sudo iptables -A INPUT -j DROP

# 保存规则
sudo iptables-save > /etc/iptables/rules.v4
```

---

## 监控和日志

### 应用日志

```bash
# 日志目录
/var/log/inffinancems/

# 日志文件
/var/log/inffinancems/app.log
/var/log/inffinancems/error.log
/var/log/inffinancems/access.log
/var/log/inffinancems/audit.log
```

### 日志轮转配置

```bash
# /etc/logrotate.d/inffinancems
/var/log/inffinancems/*.log {
    daily
    rotate 30
    compress
    delaycompress
    missingok
    notifempty
    create 0640 www-data www-data
    sharedscripts
    postrotate
        systemctl reload inffinancems
    endscript
}
```

### 监控指标

- CPU 使用率
- 内存使用率
- 磁盘使用率
- 请求响应时间
- 错误率
- 登录失败次数
- 速率限制触发次数

### 告警配置

建议设置以下告警：
- 登录失败次数超过阈值
- API 错误率超过 5%
- 服务器响应时间超过 3 秒
- 磁盘使用率超过 80%
- 数据库连接失败

---

## 备份策略

### 数据库备份

```bash
# 每日备份脚本
#!/bin/bash
BACKUP_DIR="/var/backups/inffinancems"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/inffinancems_$DATE.sql"

# 创建备份
pg_dump -U inffinancems_app inffinancems > $BACKUP_FILE

# 压缩备份
gzip $BACKUP_FILE

# 删除 30 天前的备份
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete
```

### 文件备份

```bash
# 备份上传的文件
rsync -avz /var/uploads/inffinancems/ /var/backups/uploads/
```

### 备份加密

```bash
# 加密备份
gpg --symmetric --cipher-algo AES256 backup.sql.gz

# 解密备份
gpg --decrypt backup.sql.gz.gpg > backup.sql.gz
```

### 备份验证

定期测试备份恢复：
```bash
# 恢复测试
gunzip backup.sql.gz
psql -U inffinancems_app inffinancems_test < backup.sql
```

---

## 安全检查清单

部署前请确认：

### 环境配置
- [ ] JWT_SECRET 已设置为强随机密钥
- [ ] DATABASE_URL 使用强密码
- [ ] NODE_ENV 设置为 production
- [ ] CORS_ORIGIN 设置为正确的前端域名
- [ ] .env 文件不在版本控制中

### 网络安全
- [ ] HTTPS 已启用
- [ ] SSL 证书有效
- [ ] 防火墙已配置
- [ ] 仅开放必要端口
- [ ] 数据库仅允许本地访问

### 应用安全
- [ ] 速率限制已启用
- [ ] 安全头已配置
- [ ] 审计日志已启用
- [ ] 错误处理已配置
- [ ] 文件上传验证已启用

### 数据安全
- [ ] 数据库用户权限已限制
- [ ] 敏感数据已加密
- [ ] 备份策略已实施
- [ ] 备份已加密
- [ ] 备份恢复已测试

### 监控和日志
- [ ] 日志轮转已配置
- [ ] 监控已设置
- [ ] 告警已配置
- [ ] 日志已定期审查

### 测试
- [ ] 安全扫描已完成
- [ ] 渗透测试已完成
- [ ] 依赖项漏洞已修复
- [ ] 代码审查已完成

---

## 常见安全问题

### Q1: 如何检查 JWT 密钥是否安全？

```bash
# 检查密钥长度
node -e "const secret = process.env.JWT_SECRET; console.log('密钥长度:', secret?.length);"

# 检查是否使用默认值
if [[ "$JWT_SECRET" == *"change-this"* ]]; then
  echo "警告：JWT_SECRET 使用了默认值！"
fi
```

### Q2: 如何查看安全日志？

```bash
# 查看应用日志
tail -f /var/log/inffinancems/app.log

# 查看错误日志
tail -f /var/log/inffinancems/error.log

# 查看审计日志
tail -f /var/log/inffinancems/audit.log
```

### Q3: 如何处理安全事件？

1. 立即隔离受影响的系统
2. 收集日志和证据
3. 评估影响范围
4. 修复漏洞
5. 恢复系统
6. 通知相关人员
7. 记录事件和响应

---

## 联系方式

如有安全问题，请联系：
- 安全团队邮箱：security@inffinancems.com
- 紧急联系电话：+86-xxx-xxxx-xxxx

---

**文档版本**: 1.0
**最后更新**: 2026-01-28
