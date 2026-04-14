import React from 'react';
import { Card, Spin, Typography } from 'antd';

export default function PageRouteFallback() {
  return (
    <div className="page-shell page-route-fallback-shell">
      <Card
        className="page-section-card page-route-fallback-card"
        bodyStyle={{ padding: 40, textAlign: 'center' }}
      >
        <Spin size="large" />
        <Typography.Title level={4} className="page-route-fallback-title">
          正在加载页面
        </Typography.Title>
        <Typography.Text type="secondary">
          正在准备当前模块，请稍候。
        </Typography.Text>
      </Card>
    </div>
  );
}
