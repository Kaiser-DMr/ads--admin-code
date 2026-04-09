import React, { useState } from 'react';
import { Form, Input, Button, Card, Typography, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api';
import { useAuth } from '../utils/auth';
import claudeIcon from '../assets/claude.svg';

export default function Login() {
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const onFinish = async (values) => {
    setLoading(true);
    try {
      const { data } = await authApi.login(values);
      login(data.token, data.user);
      message.success('登录成功');
      navigate('/dashboard');
    } catch (err) {
      message.error(err.response?.data?.message || '登录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', padding: 24, background: 'radial-gradient(circle at top left, rgba(47,107,255,0.08), transparent 30%), linear-gradient(180deg, #fbfcfe 0%, #f4f7fb 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 1120, display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 24, alignItems: 'stretch' }}>
        <div style={{ padding: '48px 28px 48px 12px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <Typography.Text style={{ color: '#2f6bff', fontSize: 12, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 18 }}>
            Claude Ads Console
          </Typography.Text>
          <Typography.Title style={{ margin: 0, fontSize: 56, lineHeight: 1.02, letterSpacing: '-0.05em', maxWidth: 620 }}>
            A cleaner control room for modern ad operations.
          </Typography.Title>
          <Typography.Paragraph style={{ marginTop: 22, marginBottom: 0, fontSize: 16, color: '#6b7280', maxWidth: 560, lineHeight: 1.8 }}>
            用更克制的界面管理活动、素材、报表与账号权限。保留后台效率，去掉传统管理系统的视觉噪音。
          </Typography.Paragraph>
        </div>

        <Card style={{ borderRadius: 32, padding: 10, boxShadow: '0 24px 48px rgba(15,23,42,0.08)', border: '1px solid rgba(229,231,235,0.9)' }} bodyStyle={{ padding: 32 }}>
          <div style={{ marginBottom: 28 }}>
            <img src={claudeIcon} alt="Claude" style={{ width: 72, height: 72, borderRadius: 20, marginBottom: 18 }} />
            <Typography.Title level={2} style={{ margin: 0, fontSize: 30, letterSpacing: '-0.03em' }}>欢迎回来</Typography.Title>
            <Typography.Text type="secondary" style={{ fontSize: 14 }}>
              登录 Claude 投放管理后台
            </Typography.Text>
          </div>

          <Form onFinish={onFinish} size="large" autoComplete="off" layout="vertical">
            <Form.Item name="username" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
              <Input prefix={<UserOutlined />} placeholder="请输入用户名" />
            </Form.Item>
            <Form.Item name="password" label="密码" rules={[{ required: true, message: '请输入密码' }]}>
              <Input.Password prefix={<LockOutlined />} placeholder="请输入密码" />
            </Form.Item>
            <Form.Item style={{ marginTop: 28, marginBottom: 16 }}>
              <Button type="primary" htmlType="submit" block loading={loading} style={{ height: 48 }}>
                登录系统
              </Button>
            </Form.Item>
          </Form>

          <div style={{ paddingTop: 16, borderTop: '1px solid #eef2f7' }}>
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              默认账号: admin / admin123 &nbsp;|&nbsp; operator1 / op123
            </Typography.Text>
          </div>
        </Card>
      </div>
    </div>
  );
}
