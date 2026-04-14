import React from 'react';
import { Button, DatePicker, Drawer, Form, Input, InputNumber, Select, Space, Switch, Typography } from 'antd';
import { PLATFORM_OPTIONS } from './constants';

const { RangePicker } = DatePicker;

export default function CampaignFormDrawer({
  open,
  onClose,
  onSubmit,
  loading,
  form,
  editing
}) {
  const handleFinish = async () => {
    try {
      const values = await form.validateFields();
      onSubmit?.(values);
    } catch (err) {
      // Ignore validation errors to avoid unhandled promise rejection.
    }
  };

  return (
    <Drawer
      title={editing ? '编辑广告活动' : '新建广告活动'}
      open={open}
      width={560}
      onClose={onClose}
      destroyOnClose
      footer={
        <Space style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button onClick={onClose}>取消</Button>
          <Button type="primary" onClick={handleFinish} loading={loading}>
            {editing ? '保存修改' : '创建活动'}
          </Button>
        </Space>
      }
    >
      <Form form={form} layout="vertical" className="campaign-form">
        <div className="campaign-form-section">
          <Typography.Text className="campaign-form-section-title">基本信息</Typography.Text>
          <Form.Item name="name" label="活动名称" rules={[{ required: true, message: '请填写活动名称' }]}>
            <Input placeholder="例如：新品推广计划" />
          </Form.Item>
          <Form.Item name="platform" label="投放平台" rules={[{ required: true, message: '请选择平台' }]}>
            <Select options={PLATFORM_OPTIONS} />
          </Form.Item>
        </div>

        <div className="campaign-form-section">
          <Typography.Text className="campaign-form-section-title">投放计划</Typography.Text>
          <Form.Item
            name="dateRange"
            label="投放周期"
            rules={[{ required: true, message: '请选择投放周期' }]}
          >
            <RangePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="requires_review" label="审核流程" valuePropName="checked">
            <Switch checkedChildren="需要审核" unCheckedChildren="无需审核" />
          </Form.Item>
          <Form.Item name="auto_activate" label="自动启动" valuePropName="checked">
            <Switch checkedChildren="自动" unCheckedChildren="手动" />
          </Form.Item>
        </div>

        <div className="campaign-form-section">
          <Typography.Text className="campaign-form-section-title">预算控制</Typography.Text>
          <Form.Item
            name="total_budget"
            label="总预算 (¥)"
            rules={[
              { required: true, message: '请输入总预算' },
              {
                validator: (_, value) => (value > 0 ? Promise.resolve() : Promise.reject(new Error('总预算必须大于 0')))
              }
            ]}
          >
            <InputNumber min={0} style={{ width: '100%' }} placeholder="请输入总预算" />
          </Form.Item>
          <Form.Item
            name="daily_budget"
            label="日预算 (¥)"
            dependencies={['total_budget']}
            rules={[
              { required: true, message: '请输入日预算' },
              ({ getFieldValue }) => ({
                validator: (_, value) => {
                  if (!(value > 0)) return Promise.reject(new Error('日预算必须大于 0'));
                  const total = getFieldValue('total_budget');
                  if (total && value > total) {
                    return Promise.reject(new Error('日预算不能超过总预算'));
                  }
                  return Promise.resolve();
                }
              })
            ]}
          >
            <InputNumber min={0} style={{ width: '100%' }} placeholder="请输入日预算" />
          </Form.Item>
        </div>
      </Form>
    </Drawer>
  );
}
