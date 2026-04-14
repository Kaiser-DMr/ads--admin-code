import React from 'react';
import { Button, Space, Typography } from 'antd';

export default function CampaignBatchBar({
  count,
  loading,
  onSubmitReview,
  onActivate,
  onPause,
  onTerminate
}) {
  if (!count) return null;

  return (
    <div className="campaign-batch-bar">
      <Typography.Text className="campaign-batch-count">
        已选择 {count} 个活动
      </Typography.Text>
      <Space size={12} wrap className="campaign-batch-actions">
        <Button onClick={onSubmitReview} loading={loading}>
          批量提交审核
        </Button>
        <Button onClick={onActivate} loading={loading}>
          批量启动
        </Button>
        <Button onClick={onPause} loading={loading}>
          批量暂停
        </Button>
        <Button danger onClick={onTerminate} loading={loading}>
          批量终止
        </Button>
      </Space>
    </div>
  );
}
