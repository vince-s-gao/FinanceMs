'use client';

// InfFinanceMs - 主布局组件（简化版）

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Layout, Menu, Avatar, Dropdown, Space, Typography, Spin, Badge } from 'antd';
import {
  DashboardOutlined,
  TeamOutlined,
  FileTextOutlined,
  DollarOutlined,
  FileProtectOutlined,
  AccountBookOutlined,
  WalletOutlined,
  BarChartOutlined,
  SettingOutlined,
  LogoutOutlined,
  UserOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  ProjectOutlined,
  MoneyCollectOutlined,
  ApartmentOutlined,
  SafetyOutlined,
  DatabaseOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '@/stores/auth';
import { ROLE_LABELS } from '@/lib/constants';

const { Header, Sider, Content } = Layout;
const { Text } = Typography;

// 菜单配置 - 按业务模块分组
const ALL_MENU_ITEMS = [
  // 核心业务
  {
    key: 'core-business',
    label: '核心业务',
    type: 'group' as const,
    children: [
      { key: '/dashboard', icon: <DashboardOutlined />, label: '工作台' },
      { key: '/customers', icon: <TeamOutlined />, label: '客户管理' },
      { key: '/contracts', icon: <FileTextOutlined />, label: '合同管理' },
      { key: '/payments', icon: <DollarOutlined />, label: '回款管理' },
      { key: '/projects', icon: <ProjectOutlined />, label: '项目管理' },
    ],
  },
  // 财务管理
  {
    key: 'finance-management',
    label: '财务管理',
    type: 'group' as const,
    children: [
      { key: '/payment-requests', icon: <MoneyCollectOutlined />, label: '付款申请' },
      { key: '/invoices', icon: <FileProtectOutlined />, label: '发票管理' },
      { key: '/expenses', icon: <AccountBookOutlined />, label: '报销管理' },
      { key: '/costs', icon: <WalletOutlined />, label: '费用管理' },
      { key: '/budgets', icon: <WalletOutlined />, label: '预算管理' },
      { key: '/reports', icon: <BarChartOutlined />, label: '报表看板' },
    ],
  },
  // 系统管理
  {
    key: 'system-management',
    label: '系统管理',
    type: 'group' as const,
    children: [
      { key: '/departments', icon: <ApartmentOutlined />, label: '部门管理' },
      { key: '/permissions', icon: <SafetyOutlined />, label: '权限管理' },
      { key: '/settings', icon: <SettingOutlined />, label: '系统设置' },
      { key: '/settings/dictionaries', icon: <DatabaseOutlined />, label: '数据字典' },
    ],
  },
];

// 角色权限配置
const ROLE_MENU_CONFIG: Record<string, string[]> = {
  EMPLOYEE: ['/dashboard', '/expenses'],
  SALES: ['/dashboard', '/customers', '/contracts', '/payments', '/expenses', '/projects'],
  FINANCE: ['/dashboard', '/customers', '/contracts', '/payments', '/payment-requests', '/invoices', '/expenses', '/costs', '/budgets', '/reports', '/projects'],
  MANAGER: ['/dashboard', '/customers', '/contracts', '/payments', '/payment-requests', '/invoices', '/expenses', '/costs', '/budgets', '/reports', '/projects'],
  ADMIN: ['/dashboard', '/customers', '/contracts', '/payments', '/payment-requests', '/invoices', '/expenses', '/costs', '/budgets', '/reports', '/projects', '/departments', '/permissions', '/settings', '/settings/dictionaries'],
};

interface MainLayoutProps {
  children: React.ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, logout, hydrate, isHydrated } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);

  // 初始化时从服务端 Cookie 恢复认证状态
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  // 检查登录状态 - 只在 hydrate 完成后检查
  useEffect(() => {
    if (!isHydrated) return;

    if (!isAuthenticated) {
      router.replace('/login');
    }
  }, [isHydrated, isAuthenticated, router]);

  // 处理菜单点击
  const handleMenuClick = ({ key }: { key: string }) => {
    router.push(key);
  };

  // 处理登出
  const handleLogout = async () => {
    await logout();
    router.replace('/login');
  };

  // 用户下拉菜单
  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人信息',
    },
    {
      type: 'divider' as const,
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout,
    },
  ];

  // 加载中显示 - 只在未完成 hydrate 时显示
  if (!isHydrated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Spin size="large" />
      </div>
    );
  }

  // 未登录不渲染（会被重定向）
  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Spin size="large" />
      </div>
    );
  }

  // 根据角色过滤菜单
  const allowedPaths = ROLE_MENU_CONFIG[user.role] || ROLE_MENU_CONFIG.EMPLOYEE;
  
  // 过滤分组菜单，只保留用户有权限访问的菜单项
  const menuItems = ALL_MENU_ITEMS.map(group => {
    if (group.type === 'group' && group.children) {
      // 过滤该分组下的子菜单
      const filteredChildren = group.children.filter(item => allowedPaths.includes(item.key));
      // 如果分组下没有可访问的菜单，则不显示该分组
      if (filteredChildren.length === 0) {
        return null;
      }
      return {
        ...group,
        children: filteredChildren,
      };
    }
    return group;
  }).filter(Boolean) as typeof ALL_MENU_ITEMS;

  return (
    <Layout className="min-h-screen">
      {/* 侧边栏 */}
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        theme="light"
        className="shadow-md border-r border-gray-200"
        width={220}
        style={{ overflow: 'auto', height: '100vh', position: 'fixed', left: 0, top: 0 }}
      >
        {/* Logo */}
        <div className="h-16 flex items-center justify-center border-b border-gray-200">
          <span className="text-xl font-bold text-blue-600">
            {collapsed ? '🏦' : '🏦 InfFinanceMs'}
          </span>
        </div>

        {/* 菜单 */}
        <Menu
          mode="inline"
          selectedKeys={[pathname]}
          items={menuItems}
          onClick={handleMenuClick}
          className="border-none"
        />
      </Sider>

      <Layout style={{ marginLeft: collapsed ? 80 : 220 }}>
        {/* 顶部导航 */}
        <Header className="bg-white px-4 flex items-center justify-between shadow-sm sticky top-0 z-10">
          {/* 折叠按钮 */}
          <div
            className="cursor-pointer text-lg hover:text-blue-600 transition-colors"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          </div>

          {/* 用户信息 */}
          <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
            <Space className="cursor-pointer hover:bg-gray-50 px-3 py-1 rounded-lg transition-colors">
              <Avatar
                size="small"
                icon={<UserOutlined />}
                src={user.avatar}
                className="bg-blue-600"
              />
              <div className="hidden sm:block">
                <Text strong className="text-gray-800">{user.name}</Text>
                <Badge 
                  count={ROLE_LABELS[user.role] || user.role} 
                  className="ml-2"
                  style={{ backgroundColor: '#1890ff' }}
                />
              </div>
            </Space>
          </Dropdown>
        </Header>

        {/* 内容区域 */}
        <Content className="m-4 p-6 bg-white rounded-lg shadow-sm min-h-[calc(100vh-112px)]">
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}
