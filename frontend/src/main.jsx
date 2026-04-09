import React from 'react';
import ReactDOM from 'react-dom/client';
import { ConfigProvider } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import App from './App';
import 'antd/dist/reset.css';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <ConfigProvider
    locale={zhCN}
    theme={{
      token: {
        colorPrimary: '#2f6bff',
        colorSuccess: '#0f9d58',
        colorWarning: '#f59e0b',
        colorError: '#dc2626',
        colorText: '#111827',
        colorTextSecondary: '#6b7280',
        colorBorder: '#e5e7eb',
        colorBgBase: '#f5f7fb',
        colorBgContainer: '#ffffff',
        borderRadius: 18,
        wireframe: false,
        boxShadow: '0 10px 30px rgba(15, 23, 42, 0.06)',
        boxShadowSecondary: '0 6px 20px rgba(15, 23, 42, 0.04)',
        controlHeight: 42,
        fontSize: 14,
      },
      components: {
        Layout: {
          bodyBg: '#f5f7fb',
          siderBg: '#f5f7fb',
          headerBg: 'rgba(255,255,255,0.72)',
          triggerBg: '#f5f7fb',
        },
        Menu: {
          itemBg: 'transparent',
          itemColor: '#4b5563',
          itemSelectedBg: '#ffffff',
          itemSelectedColor: '#111827',
          itemHoverColor: '#111827',
          itemHoverBg: '#eef3ff',
          iconSize: 16,
          itemBorderRadius: 14,
        },
        Card: {
          borderRadiusLG: 24,
        },
        Button: {
          borderRadius: 999,
          controlHeight: 42,
          paddingInline: 18,
        },
        Input: {
          borderRadius: 14,
        },
        Select: {
          borderRadius: 14,
        },
        Table: {
          headerBg: '#f8fafc',
          headerColor: '#6b7280',
          borderColor: '#eef2f7',
          rowHoverBg: '#f8fbff',
          cellPaddingBlock: 16,
        },
        Modal: {
          borderRadiusLG: 24,
          contentBg: '#ffffff',
        },
        Tabs: {
          itemColor: '#6b7280',
          itemSelectedColor: '#111827',
          itemHoverColor: '#111827',
          inkBarColor: '#2f6bff',
        },
        Pagination: {
          itemActiveBg: '#ffffff',
          colorPrimary: '#2f6bff',
        },
      },
    }}
  >
    <App />
  </ConfigProvider>
);
