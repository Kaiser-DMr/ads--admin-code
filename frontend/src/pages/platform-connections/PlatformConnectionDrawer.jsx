import React from 'react';
import { Alert, Button, Drawer, Form, Input, Select, Space, Tag, Typography } from 'antd';
import { getAuthFieldDefinitions } from './constants';
import { getAuthTypeOptions, getFieldDisplayLabel, getStatusColor, getStatusLabel } from './utils';

export default function PlatformConnectionDrawer({
  open,
  saving,
  testing,
  form,
  detail,
  onClose,
  onSave,
  onTest,
}) {
  const selectedAuthType = Form.useWatch('auth_type', form) || detail?.auth_type;
  const fieldDefinitions = getAuthFieldDefinitions(detail?.platform, selectedAuthType);

  return (
    <Drawer
      title={detail ? `${detail.platformLabel} 授权配置` : '平台授权配置'}
      open={open}
      width={560}
      onClose={onClose}
      destroyOnClose
      footer={
        <Space style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button onClick={onClose}>取消</Button>
          <Button onClick={onTest} loading={testing} disabled={!detail}>
            测试连接
          </Button>
          <Button type="primary" onClick={onSave} loading={saving} disabled={!detail}>
            保存配置
          </Button>
        </Space>
      }
    >
      {!detail ? null : (
        <Form form={form} layout="vertical" className="platform-connection-form">
          <div className="platform-connection-drawer-head">
            <Typography.Text type="secondary">{detail.platformLabel}</Typography.Text>
            <Tag color={getStatusColor(detail.status)}>{getStatusLabel(detail.status)}</Tag>
          </div>

          <Form.Item
            name="auth_type"
            label="授权方式"
            rules={[{ required: true, message: '请选择授权方式' }]}
          >
            <Select options={getAuthTypeOptions(detail.availableAuthTypes || [])} />
          </Form.Item>

          <Alert
            type="info"
            showIcon
            message="敏感字段不会回显，留空则保留原值"
            style={{ marginBottom: 16 }}
          />

          {fieldDefinitions.map((field) => {
            const currentField = detail.fields?.[field.key] || field;
            const placeholder = field.secret
              ? `${getFieldDisplayLabel(currentField)}，如需更换请重新填写`
              : `请输入${field.label}`;

            return (
              <Form.Item key={field.key} name={field.key} label={field.label}>
                {field.secret ? (
                  <Input.Password placeholder={placeholder} />
                ) : (
                  <Input placeholder={placeholder} />
                )}
              </Form.Item>
            );
          })}
        </Form>
      )}
    </Drawer>
  );
}
