import React, { useEffect, useState } from 'react';
import {
  Table, Button, Tag, Space, Modal, Form, Input, Select,
  Typography, message, Popconfirm, Card, Badge
} from 'antd';
import { PlusOutlined, CheckOutlined, CloseOutlined, DeleteOutlined } from '@ant-design/icons';
import { creativeApi, campaignApi } from '../api';
import { useAuth } from '../utils/auth';

const statusColor = { approved: 'success', pending: 'processing', rejected: 'error' };
const statusLabel = { approved: '已通过', pending: '待审核', rejected: '已拒绝' };
const typeLabel = { image: '图片', video: '视频', text: '文字' };

export default function Creatives() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const canEdit = ['admin', 'operator'].includes(user?.role);

  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [campaigns, setCampaigns] = useState([]);
  const [params, setParams] = useState({ page: 1, pageSize: 10 });
  const [createOpen, setCreateOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [form] = Form.useForm();
  const [rejectForm] = Form.useForm();

  const fetchData = async (p = params) => {
    setLoading(true);
    try {
      const { data: res } = await creativeApi.list(p);
      setData(res.list);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    campaignApi.list({ pageSize: 100 }).then(({ data: res }) => setCampaigns(res.list));
  }, []);

  const handleCreate = async () => {
    const values = await form.validateFields();
    try {
      await creativeApi.create(values);
      message.success('创建成功');
      setCreateOpen(false);
      form.resetFields();
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.message || '操作失败');
    }
  };

  const approve = async (id) => {
    await creativeApi.review(id, { status: 'approved' });
    message.success('已通过');
    fetchData();
  };

  const openReject = (row) => { setRejectTarget(row); rejectForm.resetFields(); setRejectOpen(true); };
  const handleReject = async () => {
    const { reject_reason } = await rejectForm.validateFields();
    await creativeApi.review(rejectTarget.id, { status: 'rejected', reject_reason });
    message.success('已拒绝');
    setRejectOpen(false);
    fetchData();
  };

  const handleDelete = async (id) => {
    await creativeApi.remove(id);
    message.success('已删除');
    fetchData();
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '素材名称', dataIndex: 'name', ellipsis: true },
    { title: '类型', dataIndex: 'type', width: 80, render: t => typeLabel[t] || t },
    { title: '关联活动', dataIndex: 'campaign_name', ellipsis: true, render: v => v || '-' },
    {
      title: '状态', dataIndex: 'status', width: 100,
      render: s => <Badge status={statusColor[s]} text={statusLabel[s]} />
    },
    { title: '拒绝原因', dataIndex: 'reject_reason', ellipsis: true, render: v => v || '-' },
    { title: '创建时间', dataIndex: 'created_at', width: 160, render: v => v?.slice(0, 16) },
    {
      title: '操作', width: 160, fixed: 'right',
      render: (_, row) => (
        <Space>
          {isAdmin && row.status === 'pending' && (
            <>
              <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => approve(row.id)}>通过</Button>
              <Button size="small" danger icon={<CloseOutlined />} onClick={() => openReject(row)}>拒绝</Button>
            </>
          )}
          {canEdit && (
            <Popconfirm title="确认删除？" onConfirm={() => handleDelete(row.id)}>
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="page-shell">
      <Card
        className="page-section-card"
        extra={canEdit ? <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setCreateOpen(true); }}>上传素材</Button> : null}
      >
        <Table
          dataSource={data}
          columns={columns}
          rowKey="id"
          loading={loading}
          scroll={{ x: 900 }}
          pagination={{
            total, current: params.page, pageSize: params.pageSize,
            onChange: (page, pageSize) => { const p = { ...params, page, pageSize }; setParams(p); fetchData(p); },
          }}
        />
      </Card>

      <Modal title="上传素材" open={createOpen} onOk={handleCreate} onCancel={() => setCreateOpen(false)} destroyOnClose>
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="素材名称" rules={[{ required: true }]}>
            <Input placeholder="请输入素材名称" />
          </Form.Item>
          <Form.Item name="type" label="素材类型" initialValue="image">
            <Select options={[
              { value: 'image', label: '图片' },
              { value: 'video', label: '视频' },
              { value: 'text', label: '文字' },
            ]} />
          </Form.Item>
          <Form.Item name="campaign_id" label="关联活动">
            <Select
              allowClear
              placeholder="选择关联活动（可选）"
              options={campaigns.map(c => ({ value: c.id, label: c.name }))}
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title="拒绝原因" open={rejectOpen} onOk={handleReject} onCancel={() => setRejectOpen(false)} destroyOnClose>
        <Form form={rejectForm} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="reject_reason" label="拒绝原因" rules={[{ required: true, message: '请填写拒绝原因' }]}>
            <Input.TextArea rows={3} placeholder="请说明拒绝原因" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
