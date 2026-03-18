#!/bin/bash

# InfFinanceMs - 安全配置检查脚本

echo "=========================================="
echo "🔒 InfFinanceMs - 安全配置检查"
echo "=========================================="
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查计数
TOTAL=0
PASSED=0
FAILED=0
WARNINGS=0

# 检查函数
check_pass() {
    TOTAL=$((TOTAL + 1))
    PASSED=$((PASSED + 1))
    echo -e "检查 $1... ${GREEN}✓ 通过${NC}"
}

check_fail() {
    TOTAL=$((TOTAL + 1))
    FAILED=$((FAILED + 1))
    echo -e "检查 $1... ${RED}✗ 失败${NC}"
}

check_warn() {
    TOTAL=$((TOTAL + 1))
    WARNINGS=$((WARNINGS + 1))
    echo -e "检查 $1... ${YELLOW}⚠ 警告: $2${NC}"
}

# 检查 .env 文件
echo "=========================================="
echo "📁 环境变量检查"
echo "=========================================="
echo ""

if [ -f ".env" ]; then
    source .env
    
    # 检查 JWT_SECRET
    if [ -z "$JWT_SECRET" ]; then
        check_fail "JWT_SECRET 是否设置"
    elif [[ "$JWT_SECRET" == *"change-this"* ]] || [[ "$JWT_SECRET" == *"your-super-secret"* ]]; then
        check_warn "JWT_SECRET" "使用了默认值或示例值"
    elif [ ${#JWT_SECRET} -lt 32 ]; then
        check_warn "JWT_SECRET" "密钥长度不足 32 字节（当前: ${#JWT_SECRET}）"
    else
        check_pass "JWT_SECRET"
    fi
    
    # 检查 JWT_EXPIRES_IN
    if [ -z "$JWT_EXPIRES_IN" ]; then
        check_warn "JWT_EXPIRES_IN" "未设置，将使用默认值"
    elif [[ "$JWT_EXPIRES_IN" == *"7d"* ]] || [[ "$JWT_EXPIRES_IN" == *"30d"* ]]; then
        check_warn "JWT_EXPIRES_IN" "有效期过长（建议: 2h）"
    else
        check_pass "JWT_EXPIRES_IN"
    fi
    
    # 检查 DATABASE_URL
    if [ -z "$DATABASE_URL" ]; then
        check_fail "DATABASE_URL 是否设置"
    elif [[ "$DATABASE_URL" == *":password@"* ]]; then
        check_warn "DATABASE_URL" "可能使用了默认密码"
    else
        check_pass "DATABASE_URL"
    fi
    
    # 检查 NODE_ENV
    if [ "$NODE_ENV" = "production" ]; then
        check_pass "NODE_ENV"
    else
        check_warn "NODE_ENV" "未设置为 production（当前: $NODE_ENV）"
    fi
    
else
    echo -e "${RED}✗ .env 文件不存在${NC}"
    FAILED=$((FAILED + 4))
    TOTAL=$((TOTAL + 4))
fi

echo ""

# 检查依赖项
echo "=========================================="
echo "📦 依赖项检查"
echo "=========================================="
echo ""

if [ -f "apps/api/package.json" ]; then
    # 检查 express-rate-limit
    if grep -q "express-rate-limit" apps/api/package.json; then
        check_pass "express-rate-limit 已安装"
    else
        check_fail "express-rate-limit 已安装"
    fi
    
    # 检查 helmet
    if grep -q "helmet" apps/api/package.json; then
        check_pass "helmet 已安装"
    else
        check_fail "helmet 已安装"
    fi
else
    echo -e "${YELLOW}⚠ apps/api/package.json 文件不存在${NC}"
fi

echo ""

# 检查安全配置文件
echo "=========================================="
echo "📄 安全配置文件检查"
echo "=========================================="
echo ""

if [ -f "apps/api/src/common/filters/http-exception.filter.ts" ]; then
    check_pass "全局异常过滤器"
else
    check_fail "全局异常过滤器"
fi

if [ -f "apps/api/src/modules/audit/audit.service.ts" ]; then
    check_pass "审计日志服务"
else
    check_fail "审计日志服务"
fi

if [ -f "apps/api/src/modules/audit/audit.module.ts" ]; then
    check_pass "审计日志模块"
else
    check_fail "审计日志模块"
fi

echo ""

# 检查 .gitignore
echo "=========================================="
echo "🔐 版本控制安全检查"
echo "=========================================="
echo ""

if [ -f ".gitignore" ]; then
    if grep -q "\.env" .gitignore; then
        check_pass ".env 在 .gitignore 中"
    else
        check_fail ".env 在 .gitignore 中"
    fi
    
    if grep -q "node_modules" .gitignore; then
        check_pass "node_modules 在 .gitignore 中"
    else
        check_fail "node_modules 在 .gitignore 中"
    fi
else
    check_warn ".gitignore" "文件不存在"
fi

echo ""

# 输出总结
echo "=========================================="
echo "📊 检查结果总结"
echo "=========================================="
echo ""
echo -e "总检查项: $TOTAL"
echo -e "${GREEN}通过: $PASSED${NC}"
echo -e "${YELLOW}警告: $WARNINGS${NC}"
echo -e "${RED}失败: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ] && [ $WARNINGS -eq 0 ]; then
    echo -e "${GREEN}✓ 所有安全检查通过！${NC}"
    exit 0
elif [ $FAILED -eq 0 ]; then
    echo -e "${YELLOW}⚠ 存在警告，建议修复后再部署${NC}"
    exit 0
else
    echo -e "${RED}✗ 存在安全问题，请修复后再部署${NC}"
    exit 1
fi
