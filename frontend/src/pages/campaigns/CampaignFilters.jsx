import React, { useMemo } from 'react';
import { Button, DatePicker, Form, Input, Select, Space } from 'antd';
import { PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { BUDGET_HEALTH_OPTIONS, CAMPAIGN_STATUS_LABEL, PLATFORM_OPTIONS } from './constants';

const { RangePicker } = DatePicker;

const statusOptions = [
  { value: '', label: '全部状态' },
  ...Object.entries(CAMPAIGN_STATUS_LABEL).map(([value, label]) => ({ value, label }))
];

const reviewOptions = [
  { value: '', label: '全部审核' },
  { value: '1', label: '需要审核' },
  { value: '0', label: '无需审核' }
];

const platformOptions = [
  { value: '', label: '全部平台' },
  ...PLATFORM_OPTIONS
];

export default function CampaignFilters({
  value,
  onChange,
  onSearch,
  onReset,
  onCreate,
  canEdit
}) {
  const rangeValue = useMemo(() => {
    if (value?.date_from && value?.date_to) {
      return [dayjs(value.date_from), dayjs(value.date_to)];
    }
    return null;
  }, [value?.date_from, value?.date_to]);

  const patchValue = (patch) => {
    onChange?.(patch);
  };

  return (
    <div className="campaign-filters">
      <Form
        layout="vertical"
        onFinish={() => onSearch?.()}
        className="campaign-filters-form"
      >
        <div className="campaign-filters-grid">
          <Form.Item label="搜索活动">
            <Input
              className="campaign-filter-search"
              placeholder="输入活动名称关键词"
              allowClear
              value={value?.search || ''}
              onChange={(event) => patchValue({ search: event.target.value })}
            />
          </Form.Item>
          <Form.Item label="状态筛选">
            <Select
              options={statusOptions}
              value={value?.status ?? ''}
              onChange={(nextValue) => patchValue({ status: nextValue })}
            />
          </Form.Item>
          <Form.Item label="投放平台">
            <Select
              options={platformOptions}
              value={value?.platform ?? ''}
              onChange={(nextValue) => patchValue({ platform: nextValue })}
            />
          </Form.Item>
          <Form.Item label="审核流程">
            <Select
              options={reviewOptions}
              value={value?.requires_review ?? ''}
              onChange={(nextValue) => patchValue({ requires_review: nextValue })}
            />
          </Form.Item>
          <Form.Item label="预算状态">
            <Select
              options={BUDGET_HEALTH_OPTIONS}
              value={value?.budget_health ?? ''}
              onChange={(nextValue) => patchValue({ budget_health: nextValue })}
            />
          </Form.Item>
          <Form.Item label="投放日期">
            <RangePicker
              style={{ width: '100%' }}
              value={rangeValue}
              onChange={(_, dateStrings) =>
                patchValue({
                  date_from: dateStrings?.[0] || '',
                  date_to: dateStrings?.[1] || ''
                })
              }
            />
          </Form.Item>
        </div>
        <div className="campaign-filters-actions">
          <Space size={12} wrap>
            <Button icon={<ReloadOutlined />} onClick={onReset}>
              重置
            </Button>
            <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>
              查询
            </Button>
          </Space>
          {canEdit ? (
            <Button type="primary" icon={<PlusOutlined />} onClick={onCreate}>
              新建活动
            </Button>
          ) : null}
        </div>
      </Form>
    </div>
  );
}
