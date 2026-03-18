#!/bin/bash

# InfFinanceMs - API 测试脚本
# 用于测试项目管理和报销管理相关接口

BASE_URL="http://localhost:3001/api"
TOKEN=""

echo "=========================================="
echo "  InfFinanceMs API 测试脚本"
echo "=========================================="
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 测试结果统计
PASSED=0
FAILED=0

# 打印测试结果
print_result() {
  if [ $1 -eq 0 ]; then
    echo -e "${GREEN}✓ PASS${NC}: $2"
    ((PASSED++))
  else
    echo -e "${RED}✗ FAIL${NC}: $2"
    ((FAILED++))
  fi
}

# 1. 测试登录
echo "1. 测试用户登录..."
LOGIN_RESPONSE=$(curl -s -X POST "${BASE_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@inffinancems.com", "password": "admin123"}')

# 尝试两种可能的token字段名
TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"accessToken":"[^"]*"' | cut -d'"' -f4)
if [ -z "$TOKEN" ]; then
  TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)
fi

if [ -n "$TOKEN" ]; then
  print_result 0 "用户登录成功"
  echo "   Token: ${TOKEN:0:50}..."
else
  print_result 1 "用户登录失败"
  echo "   响应: $LOGIN_RESPONSE"
  echo ""
  echo "请确保 API 服务已启动 (npm run dev --workspace=apps/api)"
  exit 1
fi
echo ""

# 2. 测试获取当前用户信息
echo "2. 测试获取当前用户信息..."
USER_RESPONSE=$(curl -s -X GET "${BASE_URL}/auth/me" \
  -H "Authorization: Bearer $TOKEN")

if echo "$USER_RESPONSE" | grep -q '"email"'; then
  print_result 0 "获取用户信息成功"
  USER_NAME=$(echo $USER_RESPONSE | grep -o '"name":"[^"]*"' | cut -d'"' -f4)
  echo "   用户: $USER_NAME"
else
  print_result 1 "获取用户信息失败"
fi
echo ""

# 3. 测试项目列表
echo "3. 测试获取项目列表..."
PROJECTS_RESPONSE=$(curl -s -X GET "${BASE_URL}/projects" \
  -H "Authorization: Bearer $TOKEN")

if echo "$PROJECTS_RESPONSE" | grep -q '"items"'; then
  print_result 0 "获取项目列表成功"
  PROJECT_COUNT=$(echo $PROJECTS_RESPONSE | grep -o '"total":[0-9]*' | cut -d':' -f2)
  echo "   项目数量: $PROJECT_COUNT"
else
  print_result 1 "获取项目列表失败"
  echo "   响应: $PROJECTS_RESPONSE"
fi
echo ""

# 4. 测试创建项目
echo "4. 测试创建项目..."
CREATE_PROJECT_RESPONSE=$(curl -s -X POST "${BASE_URL}/projects" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "测试项目-API测试",
    "description": "这是一个通过API测试脚本创建的项目",
    "status": "ACTIVE"
  }')

if echo "$CREATE_PROJECT_RESPONSE" | grep -q '"id"'; then
  print_result 0 "创建项目成功"
  PROJECT_ID=$(echo $CREATE_PROJECT_RESPONSE | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
  PROJECT_CODE=$(echo $CREATE_PROJECT_RESPONSE | grep -o '"code":"[^"]*"' | cut -d'"' -f4)
  echo "   项目ID: $PROJECT_ID"
  echo "   项目编号: $PROJECT_CODE"
else
  print_result 1 "创建项目失败"
  echo "   响应: $CREATE_PROJECT_RESPONSE"
  PROJECT_ID=""
fi
echo ""

# 5. 测试获取项目详情
if [ -n "$PROJECT_ID" ]; then
  echo "5. 测试获取项目详情..."
  PROJECT_DETAIL=$(curl -s -X GET "${BASE_URL}/projects/${PROJECT_ID}" \
    -H "Authorization: Bearer $TOKEN")

  if echo "$PROJECT_DETAIL" | grep -q '"name"'; then
    print_result 0 "获取项目详情成功"
  else
    print_result 1 "获取项目详情失败"
  fi
  echo ""
fi

# 6. 测试更新项目
if [ -n "$PROJECT_ID" ]; then
  echo "6. 测试更新项目..."
  UPDATE_PROJECT_RESPONSE=$(curl -s -X PUT "${BASE_URL}/projects/${PROJECT_ID}" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d '{
      "name": "测试项目-已更新",
      "description": "项目描述已更新"
    }')

  if echo "$UPDATE_PROJECT_RESPONSE" | grep -q '"测试项目-已更新"'; then
    print_result 0 "更新项目成功"
  else
    print_result 1 "更新项目失败"
  fi
  echo ""
fi

# 7. 测试报销类型字典
echo "7. 测试获取报销类型字典..."
EXPENSE_TYPES=$(curl -s -X GET "${BASE_URL}/dictionaries/by-type/EXPENSE_TYPE" \
  -H "Authorization: Bearer $TOKEN")

if echo "$EXPENSE_TYPES" | grep -q '"差旅费"'; then
  print_result 0 "获取报销类型字典成功"
  echo "   包含: 差旅费、住宿费、交通费等"
else
  print_result 1 "获取报销类型字典失败"
  echo "   响应: $EXPENSE_TYPES"
fi
echo ""

# 8. 测试报销列表
echo "8. 测试获取报销列表..."
EXPENSES_RESPONSE=$(curl -s -X GET "${BASE_URL}/expenses" \
  -H "Authorization: Bearer $TOKEN")

if echo "$EXPENSES_RESPONSE" | grep -q '"items"'; then
  print_result 0 "获取报销列表成功"
  EXPENSE_COUNT=$(echo $EXPENSES_RESPONSE | grep -o '"total":[0-9]*' | cut -d':' -f2)
  echo "   报销单数量: $EXPENSE_COUNT"
else
  print_result 1 "获取报销列表失败"
fi
echo ""

# 9. 测试删除项目（清理测试数据）
if [ -n "$PROJECT_ID" ]; then
  echo "9. 测试删除项目（清理测试数据）..."
  DELETE_RESPONSE=$(curl -s -X DELETE "${BASE_URL}/projects/${PROJECT_ID}" \
    -H "Authorization: Bearer $TOKEN")

  if echo "$DELETE_RESPONSE" | grep -q '"isDeleted":true'; then
    print_result 0 "删除项目成功"
  else
    print_result 1 "删除项目失败"
  fi
  echo ""
fi

# 10. 测试客户列表
echo "10. 测试获取客户列表..."
CUSTOMERS_RESPONSE=$(curl -s -X GET "${BASE_URL}/customers" \
  -H "Authorization: Bearer $TOKEN")

if echo "$CUSTOMERS_RESPONSE" | grep -q '"items"'; then
  print_result 0 "获取客户列表成功"
else
  print_result 1 "获取客户列表失败"
fi
echo ""

# 11. 测试合同列表
echo "11. 测试获取合同列表..."
CONTRACTS_RESPONSE=$(curl -s -X GET "${BASE_URL}/contracts" \
  -H "Authorization: Bearer $TOKEN")

if echo "$CONTRACTS_RESPONSE" | grep -q '"items"'; then
  print_result 0 "获取合同列表成功"
else
  print_result 1 "获取合同列表失败"
fi
echo ""

# 打印测试总结
echo "=========================================="
echo "  测试总结"
echo "=========================================="
echo -e "  ${GREEN}通过${NC}: $PASSED"
echo -e "  ${RED}失败${NC}: $FAILED"
echo "  总计: $((PASSED + FAILED))"
echo ""

if [ $FAILED -eq 0 ]; then
  echo -e "${GREEN}所有测试通过！${NC}"
  exit 0
else
  echo -e "${YELLOW}部分测试失败，请检查上述错误信息${NC}"
  exit 1
fi
