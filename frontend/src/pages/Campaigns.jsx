import React, { useEffect, useState } from 'react';
import {
  Table, Button, Tag, Space, Modal, Form, Input, InputNumber,
  Select, DatePicker, Typography, message, Popconfirm, Card
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, PauseOutlined, PlayCircleOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { campaignApi } from '../api';
import { useAuth } from '../utils/auth';

const { RangePicker } = DatePicker;

const statusColor = { active: 'green', paused: 'orange', draft: 'default', completed: 'blue' };
const statusLabel = { active: '投放中', paused: '已暂停', draft: '草稿', completed: '已完成' };
const platformLabel = { iOS: 'iOS', Android: 'Android', Web: 'Web', all: '全平台' };

export default function Campaigns() {
  const { user } = useAuth();
  const canEdit = ['admin', 'operator'].includes(user?.role);
  const canDelete = user?.role === 'admin';

  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [params, setParams] = useState({ page: 1, pageSize: 10 });
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  const fetchData = async (p = params) => {
    setLoading(true);
    try {
      const { data: res } = await campaignApi.list(p);
      setData(res.list);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => { setEditing(null); form.resetFields(); setModalOpen(true); };
  const openEdit = (row) => {
    setEditing(row);
    form.setFieldsValue({
      ...row,
      dateRange: row.start_date && row.end_date ? [dayjs(row.start_date), dayjs(row.end_date)] : null,
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    const { dateRange, ...rest } = values;
    const payload = {
      ...rest,
      start_date: dateRange?.[0]?.format('YYYY-MM-DD'),
      end_date: dateRange?.[1]?.format('YYYY-MM-DD'),
    };
    try {
      if (editing) {
        await campaignApi.update(editing.id, payload);
        message.success('更新成功');
      } else {
        await campaignApi.create(payload);
        message.success('创建成功');
      }
      setModalOpen(false);
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.message || '操作失败');
    }
  };

  const toggleStatus = async (row) => {
    const newStatus = row.status === 'active' ? 'paused' : 'active';
    await campaignApi.update(row.id, { status: newStatus });
    message.success(newStatus === 'active' ? '已启动' : '已暂停');
    fetchData();
  };

  const handleDelete = async (id) => {
    await campaignApi.remove(id);
    message.success('已删除');
    fetchData();
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '活动名称', dataIndex: 'name', ellipsis: true },
    { title: '状态', dataIndex: 'status', width: 90, render: s => <Tag color={statusColor[s]}>{statusLabel[s]}</Tag> },
    { title: '平台', dataIndex: 'platform', width: 90, render: p => platformLabel[p] || p },
    { title: '预算', dataIndex: 'budget', width: 110, render: v => `¥${Number(v).toLocaleString()}` },
    { title: '消耗', dataIndex: 'spent', width: 110, render: v => `¥${Number(v).toLocaleString()}` },
    { title: '曝光', dataIndex: 'impressions', width: 100, render: v => Number(v).toLocaleString() },
    { title: '点击', dataIndex: 'clicks', width: 90, render: v => Number(v).toLocaleString() },
    {
      title: 'CTR', width: 80,
      render: (_, r) => r.impressions > 0 ? `${(r.clicks / r.impressions * 100).toFixed(2)}%` : '-'
    },
    {
      title: '操作', width: 160, fixed: 'right',
      render: (_, row) => (
        <Space>
          {canEdit && (
            <>
              <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(row)} />
              {['active', 'paused'].includes(row.status) && (
                <Button
                  size="small"
                  icon={row.status === 'active' ? <PauseOutlined /> : <PlayCircleOutlined />}
                  onClick={() => toggleStatus(row)}
                />
              )}
            </>
          )}
          {canDelete && (
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
        extra={canEdit ? <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新建活动</Button> : null}
      >
        <Table
          dataSource={data}
          columns={columns}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1100 }}
          pagination={{
            total, current: params.page, pageSize: params.pageSize,
            onChange: (page, pageSize) => { const p = { ...params, page, pageSize }; setParams(p); fetchData(p); },
          }}
        />
      </Card>

      <Modal
        title={editing ? '编辑广告活动' : '新建广告活动'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        width={560}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="name" label="活动名称" rules={[{ required: true }]}>
            <Input placeholder="请输入活动名称" />
          </Form.Item>
          <Form.Item name="budget" label="预算 (¥)" rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} placeholder="请输入预算金额" />
          </Form.Item>
          <Form.Item name="platform" label="投放平台" initialValue="all">
            <Select options={[
              { value: 'all', label: '全平台' },
              { value: 'iOS', label: 'iOS' },
              { value: 'Android', label: 'Android' },
              { value: 'Web', label: 'Web' },
            ]} />
          </Form.Item>
          <Form.Item name="dateRange" label="投放时间">
            <RangePicker style={{ width: '100%' }} />
          </Form.Item>
          {editing && (
            <Form.Item name="status" label="状态">
              <Select options={[
                { value: 'draft', label: '草稿' },
                { value: 'active', label: '投放中' },
                { value: 'paused', label: '已暂停' },
                { value: 'completed', label: '已完成' },
              ]} />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  );
}
