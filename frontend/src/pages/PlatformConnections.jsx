import React, { useEffect, useState } from 'react';
import { Button, Card, Form, Table, Tag, Typography, message } from 'antd';
import { platformConnectionApi } from '../api';
import { useAuth } from '../utils/auth';
import PlatformConnectionDrawer from './platform-connections/PlatformConnectionDrawer';
import {
  buildConnectionPayload,
  enrichConnectionDetail,
  getStatusColor,
  getStatusLabel,
  toFormInitialValues,
} from './platform-connections/utils';

export default function PlatformConnections() {
  const { user } = useAuth();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [form] = Form.useForm();

  const isAdmin = user?.role === 'admin';

  async function fetchList() {
    setLoading(true);
    try {
      const { data: response } = await platformConnectionApi.list();
      setData(response);
    } catch (err) {
      message.error(err.response?.data?.message || '获取平台授权列表失败');
    } finally {
      setLoading(false);
    }
  }

  async function openDrawer(platform) {
    try {
      const { data: response } = await platformConnectionApi.get(platform);
      const nextDetail = enrichConnectionDetail(response);
      setDetail(nextDetail);
      form.setFieldsValue(toFormInitialValues(nextDetail));
      setDrawerOpen(true);
    } catch (err) {
      message.error(err.response?.data?.message || '获取平台授权详情失败');
    }
  }

  async function handleSave() {
    try {
      const values = await form.validateFields();
      const payload = buildConnectionPayload(detail.platform, values.auth_type, values);
      setSaving(true);
      await platformConnectionApi.update(detail.platform, payload);
      message.success('平台授权已保存');
      setDrawerOpen(false);
      await fetchList();
    } catch (err) {
      if (err?.errorFields) return;
      message.error(err.response?.data?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    if (!detail) return;
    setTesting(true);
    try {
      const { data: response } = await platformConnectionApi.test(detail.platform);
      message[response.ok ? 'success' : 'warning'](response.message);
    } catch (err) {
      message.error(err.response?.data?.message || '测试连接失败');
    } finally {
      setTesting(false);
    }
  }

  useEffect(() => {
    if (!isAdmin) return;
    fetchList();
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="page-shell">
        <Card className="page-section-card" styles={{ body: { padding: 40, textAlign: 'center' } }}>
          <Typography.Text type="secondary">无权限访问此页面</Typography.Text>
        </Card>
      </div>
    );
  }

  return (
    <div className="page-shell platform-connections-shell">
      <Card className="page-section-card platform-connections-card">
        <div className="platform-connections-summary">
          <Typography.Text type="secondary">
            集中管理各平台授权凭证
          </Typography.Text>
        </div>
        <Table
          rowKey="platform"
          dataSource={data}
          loading={loading}
          pagination={false}
          scroll={{ x: 760 }}
          columns={[
            {
              title: '平台',
              dataIndex: 'platformLabel',
              render: (value) => <span className="platform-connection-name">{value}</span>,
            },
            { title: '授权方式', dataIndex: 'authTypeLabel' },
            {
              title: '状态',
              dataIndex: 'status',
              render: (value) => <Tag color={getStatusColor(value)}>{getStatusLabel(value)}</Tag>,
            },
            {
              title: '更新时间',
              dataIndex: 'updated_at',
              render: (value) => (value ? String(value).slice(0, 16) : '-'),
            },
            {
              title: '操作',
              width: 120,
              render: (_, row) => (
                <Button size="small" onClick={() => openDrawer(row.platform)}>
                  {row.status === 'unconfigured' ? '配置' : '编辑'}
                </Button>
              ),
            },
          ]}
        />
      </Card>

      <PlatformConnectionDrawer
        open={drawerOpen}
        saving={saving}
        testing={testing}
        form={form}
        detail={detail}
        onClose={() => setDrawerOpen(false)}
        onSave={handleSave}
        onTest={handleTest}
      />
    </div>
  );
}
