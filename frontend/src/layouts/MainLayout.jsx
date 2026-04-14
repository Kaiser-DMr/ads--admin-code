import React, { useMemo, useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Avatar, Dropdown, Typography, Tag, Button, Drawer, Grid } from 'antd';
import {
  DashboardOutlined, FundOutlined, PictureOutlined,
  BarChartOutlined, TeamOutlined, LogoutOutlined, MenuFoldOutlined, MenuUnfoldOutlined, ApiOutlined,
} from '@ant-design/icons';
import { useAuth } from '../utils/auth';
import claudeIcon from '../assets/claude.svg';

const { Sider, Header, Content } = Layout;

const roleColor = { admin: 'red', operator: 'blue', viewer: 'green' };
const roleLabel = { admin: '管理员', operator: '运营', viewer: '查看者' };
const pageTitle = {
  '/dashboard': '数据概览',
  '/campaigns': '广告活动',
  '/creatives': '素材管理',
  '/reports': '数据报表',
  '/platform-connections': '平台授权',
  '/users': '用户管理',
};
const pageDesc = {
  '/dashboard': '查看整体投放表现与关键经营指标。',
  '/campaigns': '统一管理广告活动、预算与投放状态。',
  '/creatives': '审核与管理素材资产，保持内容质量。',
  '/reports': '按平台、活动与趋势维度分析投放结果。',
  '/platform-connections': '集中维护广告平台授权方式与密钥配置。',
  '/users': '管理后台成员权限与账号状态。',
};

const menuItemDefs = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: '数据概览' },
  { key: '/campaigns', icon: <FundOutlined />, label: '广告活动' },
  { key: '/creatives', icon: <PictureOutlined />, label: '素材管理' },
  { key: '/reports', icon: <BarChartOutlined />, label: '数据报表' },
  { key: '/platform-connections', icon: <ApiOutlined />, label: '平台授权', adminOnly: true },
  { key: '/users', icon: <TeamOutlined />, label: '用户管理', adminOnly: true },
];

export default function MainLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;
  const [collapsed, setCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const userMenu = {
    items: [{ key: 'logout', icon: <LogoutOutlined />, label: '退出登录', danger: true }],
    onClick: ({ key }) => {
      if (key === 'logout') {
        setMobileMenuOpen(false);
        logout();
        navigate('/login');
      }
    },
  };

  const currentTitle = useMemo(() => pageTitle[location.pathname] || 'Claude 投放后台', [location.pathname]);
  const currentDesc = useMemo(() => pageDesc[location.pathname] || '保持清晰、克制的投放运营体验。', [location.pathname]);
  const menuItems = useMemo(
    () => menuItemDefs.filter((item) => !item.adminOnly || user?.role === 'admin'),
    [user?.role]
  );

  const handleNavigate = (key) => {
    navigate(key);
    setMobileMenuOpen(false);
  };

  const navContent = (
    <div className={`console-sider-shell ${collapsed && !isMobile ? 'is-collapsed' : ''} ${isMobile ? 'is-mobile-drawer' : ''}`}>
      <div className={`console-sider-top ${collapsed && !isMobile ? 'is-collapsed' : ''}`}>
        {!isMobile && (
          <Button
            type="text"
            shape="circle"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(v => !v)}
            className="console-sider-toggle"
          />
        )}
        <div className={`console-brand ${collapsed && !isMobile ? 'is-collapsed' : ''}`}>
          <img src={claudeIcon} alt="Claude" className="console-brand-icon" />
          {(!collapsed || isMobile) && (
            <div className="console-brand-copy">
              <Typography.Text strong className="console-brand-title">Claude Ads</Typography.Text>
              <Typography.Text type="secondary" className="console-brand-subtitle">Tesla-inspired console</Typography.Text>
            </div>
          )}
        </div>
      </div>

      <div className="console-menu-wrap">
        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={({ key }) => handleNavigate(key)}
          inlineCollapsed={!isMobile && collapsed}
          className="console-menu"
        />
      </div>

      <div className={`console-user-card ${collapsed && !isMobile ? 'is-collapsed' : ''}`}>
        <Avatar src={claudeIcon} size={collapsed && !isMobile ? 40 : 44} className="console-user-avatar" />
        {(!collapsed || isMobile) && (
          <div className="console-user-copy">
            <Typography.Text strong className="console-user-name">{user?.username}</Typography.Text>
            <Tag color={roleColor[user?.role]} className="console-user-tag">{roleLabel[user?.role]}</Tag>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <Layout className={`console-layout ${isMobile ? 'is-mobile' : ''}`}>
      {!isMobile && (
        <Sider
          collapsed={collapsed}
          trigger={null}
          width={268}
          collapsedWidth={104}
          className="console-sider"
        >
          {navContent}
        </Sider>
      )}

      {isMobile && (
        <Drawer
          placement="left"
          open={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
          width={304}
          className="console-mobile-drawer"
          bodyStyle={{ padding: 16 }}
        >
          {navContent}
        </Drawer>
      )}

      <Layout className="console-main">
        <div className="console-main-scroll">
          <Header className="console-header">
            <div className="console-header-main">
              {isMobile && (
                <Button
                  type="default"
                  shape="circle"
                  icon={<MenuUnfoldOutlined />}
                  onClick={() => setMobileMenuOpen(true)}
                  className="console-mobile-nav-trigger"
                  aria-label="打开导航菜单"
                />
              )}
              <div className="console-header-copy">
                <Typography.Text type="secondary" className="console-kicker">
                  Claude Ads Console
                </Typography.Text>
                <Typography.Title level={2} className="console-title">
                  {currentTitle}
                </Typography.Title>
                <Typography.Text type="secondary" className="console-description">
                  {currentDesc}
                </Typography.Text>
              </div>
            </div>
            <Dropdown menu={userMenu} placement="bottomRight">
              <div className="console-header-user">
                <Avatar src={claudeIcon} style={{ background: '#2f6bff' }} />
                <div className="console-header-user-copy">
                  <Typography.Text strong style={{ display: 'block', lineHeight: 1.2 }}>{user?.username}</Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>{roleLabel[user?.role]}</Typography.Text>
                </div>
              </div>
            </Dropdown>
          </Header>

          <Content className="console-content">
            <Outlet />
          </Content>
        </div>
      </Layout>
    </Layout>
  );
}
