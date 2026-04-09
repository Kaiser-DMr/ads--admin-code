import React, { useEffect, useState } from 'react';
import {
  Table, Button, Tag, Space, Modal, Form, Input, Select,
  Typography, message, Popconfirm, Card
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { userApi } from '../api';
import { useAuth } from '../utils/auth';

const roleColor = { admin: 'red', operator: 'blue', viewer: 'green' };
const roleLabel = { admin: '管理员', operator: '运营', viewer: '查看者' };

export default function Users() {
  const { user: currentUser } = useAuth();
  if (currentUser?.role !== 'admin') {
    return <div style={{ padding: 40, textAlign: 'center' }}><Typography.Text type="secondary">无权限访问此页面</Typography.Text></div>;
  }

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: res } = await userApi.list();
      setData(res);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const openCreate = () => { setEditing(null); form.resetFields(); setModalOpen(true); };
  const openEdit = (row) => {
    setEditing(row);
    form.setFieldsValue({ username: row.username, role: row.role, email: row.email, status: row.status });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    const values = await form.validateFields();
    try {
      if (editing) {
        await userApi.update(editing.id, values);
        message.success('更新成功');
      } else {
        await userApi.create(values);
        message.success('创建成功');
      }
      setModalOpen(false);
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.message || '操作失败');
    }
  };

  const handleDelete = async (id) => {
    try {
      await userApi.remove(id);
      message.success('已删除');
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.message || '删除失败');
    }
  };

  const columns = [
    { title: 'ID', dataIndex: 'id', width: 60 },
    { title: '用户名', dataIndex: 'username' },
    { title: '邮箱', dataIndex: 'email', render: v => v || '-' },
    { title: '角色', dataIndex: 'role', render: r => <Tag color={roleColor[r]}>{roleLabel[r]}</Tag> },
    { title: '状态', dataIndex: 'status', render: s => <Tag color={s === 'active' ? 'green' : 'red'}>{s === 'active' ? '正常' : '禁用'}</Tag> },
    { title: '创建时间', dataIndex: 'created_at', render: v => v?.slice(0, 16) },
    {
      title: '操作', width: 120,
      render: (_, row) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => openEdit(row)} />
          {row.id !== currentUser.id && (
            <Popconfirm title="确认删除该用户？" onConfirm={() => handleDelete(row.id)}>
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="page-shell">
      <div className="page-toolbar">
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新建用户</Button>
      </div>
      <Card className="page-section-card">
        <Table dataSource={data} columns={columns} rowKey="id" loading={loading} pagination={false} />
      </Card>

      <Modal
        title={editing ? '编辑用户' : '新建用户'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        destroyOnClose
      >
        <Form form={form} layout="vertical" style={{ marginTop: 16 }}>
          <Form.Item name="username" label="用户名" rules={[{ required: true }]}>
            <Input disabled={!!editing} placeholder="请输入用户名" />
          </Form.Item>
          {!editing && (
            <Form.Item name="password" label="密码" rules={[{ required: true, min: 6, message: '密码至少6位' }]}>
              <Input.Password placeholder="请输入密码" />
            </Form.Item>
          )}
          {editing && (
            <Form.Item name="password" label="新密码（留空不修改）">
              <Input.Password placeholder="留空则不修改密码" />
            </Form.Item>
          )}
          <Form.Item name="email" label="邮箱">
            <Input placeholder="请输入邮箱（可选）" />
          </Form.Item>
          <Form.Item name="role" label="角色" initialValue="operator">
            <Select options={[
              { value: 'admin', label: '管理员' },
              { value: 'operator', label: '运营' },
              { value: 'viewer', label: '查看者' },
            ]} />
          </Form.Item>
          {editing && (
            <Form.Item name="status" label="状态">
              <Select options={[
                { value: 'active', label: '正常' },
                { value: 'disabled', label: '禁用' },
              ]} />
            </Form.Item>
          )}
        </Form>
      </Modal>
    </div>
  );
}
