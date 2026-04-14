import React from 'react';
import { Tag } from 'antd';
import { CAMPAIGN_STATUS_COLOR, CAMPAIGN_STATUS_LABEL } from './constants';

export default function CampaignStatusTag({ status }) {
  const label = CAMPAIGN_STATUS_LABEL[status] || status;
  const color = CAMPAIGN_STATUS_COLOR[status] || 'default';
  return (
    <Tag color={color} style={{ borderRadius: 999 }}>
      {label}
    </Tag>
  );
}
