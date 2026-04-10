import React, { useEffect, useMemo, useState } from 'react';
import { Row, Col, Card, Typography, Table, Tag, Spin, Progress } from 'antd';
import { ArrowUpOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { campaignApi } from '../api';

const statusColor = { active: 'green', paused: 'orange', draft: 'default', completed: 'blue' };
const statusLabel = { active: '投放中', paused: '已暂停', draft: '草稿', completed: '已完成' };

function MetricCard({ eyebrow, value, suffix, hint, accent, progress }) {
  return (
    <Card bodyStyle={{ padding: 24 }} style={{ height: '100%', borderRadius: 28 }}>
      <Typography.Text style={{ color: '#6b7280', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {eyebrow}
      </Typography.Text>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginTop: 12 }}>
        <Typography.Title level={2} style={{ margin: 0, fontSize: 34, lineHeight: 1, letterSpacing: '-0.04em' }}>
          {value}
        </Typography.Title>
        {suffix ? <Typography.Text type="secondary" style={{ marginBottom: 6 }}>{suffix}</Typography.Text> : null}
      </div>
      <Typography.Text style={{ display: 'block', color: accent || '#2f6bff', marginTop: 14, fontWeight: 500 }}>
        {hint}
      </Typography.Text>
      {typeof progress === 'number' && (
        <Progress
          percent={Math.max(0, Math.min(100, Number(progress.toFixed(1))))}
          showInfo={false}
          strokeColor="#2f6bff"
          trailColor="#e5e7eb"
          style={{ marginTop: 18 }}
        />
      )}
    </Card>
  );
}

export default function Dashboard() {
  const [summary, setSummary] = useState(null);
  const [topCampaigns, setTopCampaigns] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([campaignApi.summary(), campaignApi.list({ pageSize: 5 })]).then(([s, c]) => {
      setSummary(s.data);
      setTopCampaigns(c.data.list);
    }).finally(() => setLoading(false));
  }, []);

  const metrics = useMemo(() => {
    const totalBudget = Number(summary?.totalBudget || 0);
    const totalSpent = Number(summary?.totalSpent || 0);
    const totalImpressions = Number(summary?.totalImpressions || 0);
    const totalClicks = Number(summary?.totalClicks || 0);
    const active = Number(summary?.active || 0);
    const total = Number(summary?.total || 0);
    const usage = totalBudget > 0 ? totalSpent / totalBudget * 100 : 0;
    const ctr = totalImpressions > 0 ? totalClicks / totalImpressions * 100 : 0;
    const cpc = totalClicks > 0 ? totalSpent / totalClicks : 0;

    return { totalBudget, totalSpent, totalImpressions, totalClicks, active, total, usage, ctr, cpc };
  }, [summary]);

  const columns = [
    { title: '活动名称', dataIndex: 'name', key: 'name', ellipsis: true },
    { title: '状态', dataIndex: 'status', key: 'status', width: 100, render: s => <Tag color={statusColor[s]} style={{ borderRadius: 999 }}>{statusLabel[s]}</Tag> },
    { title: '预算', dataIndex: 'budget', key: 'budget', width: 120, render: v => `¥${Number(v).toLocaleString()}` },
    { title: '消耗', dataIndex: 'spent', key: 'spent', width: 120, render: v => `¥${Number(v).toLocaleString()}` },
    { title: '曝光量', dataIndex: 'impressions', key: 'impressions', width: 120, render: v => Number(v).toLocaleString() },
    { title: '点击量', dataIndex: 'clicks', key: 'clicks', width: 110, render: v => Number(v).toLocaleString() },
    {
      title: 'CTR', key: 'ctr', width: 90,
      render: (_, r) => r.impressions > 0 ? `${(r.clicks / r.impressions * 100).toFixed(2)}%` : '-'
    },
  ];

  if (loading) return <div className="page-shell"><Card className="page-section-card" bodyStyle={{ padding: 80, textAlign: 'center' }}><Spin size="large" /></Card></div>;

  return (
    <div className="page-shell dashboard-shell">
      <Card bodyStyle={{ padding: 32 }} style={{ borderRadius: 32, overflow: 'hidden', background: 'linear-gradient(135deg, #fff 0%, #f7faff 52%, #eef4ff 100%)' }}>
        <Row gutter={[24, 24]} align="middle">
          <Col xs={24} lg={14}>
            <Typography.Text style={{ color: '#2f6bff', fontSize: 12, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
              Today at a glance
            </Typography.Text>
            <Typography.Title style={{ margin: '14px 0 10px', fontSize: 48, lineHeight: 1.04, letterSpacing: '-0.05em', maxWidth: 640 }}>
              Keep every campaign moving with a quieter, sharper cockpit.
            </Typography.Title>
            <Typography.Paragraph style={{ marginBottom: 0, color: '#6b7280', fontSize: 16, lineHeight: 1.8, maxWidth: 620 }}>
              聚合预算、点击、曝光与在投活动，让运营团队在一个更简洁的首页里快速判断整体投放健康度。
            </Typography.Paragraph>
          </Col>
          <Col xs={24} lg={10}>
            <div style={{ borderRadius: 28, padding: 24, background: 'rgba(255,255,255,0.75)', border: '1px solid rgba(229,231,235,0.9)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
                <div style={{ width: 42, height: 42, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'rgba(47,107,255,0.1)', color: '#2f6bff' }}>
                  <ThunderboltOutlined />
                </div>
                <div>
                  <Typography.Text strong style={{ display: 'block' }}>投放引擎状态</Typography.Text>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>系统正在稳定处理核心投放数据</Typography.Text>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 16 }}>
                <div>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>投放中活动</Typography.Text>
                  <Typography.Title level={3} style={{ margin: '8px 0 0', fontSize: 28 }}>{metrics.active}</Typography.Title>
                </div>
                <div>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>综合 CTR</Typography.Text>
                  <Typography.Title level={3} style={{ margin: '8px 0 0', fontSize: 28 }}>{metrics.ctr.toFixed(2)}%</Typography.Title>
                </div>
                <div>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>总点击量</Typography.Text>
                  <Typography.Title level={3} style={{ margin: '8px 0 0', fontSize: 28 }}>{metrics.totalClicks.toLocaleString()}</Typography.Title>
                </div>
                <div>
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>平均 CPC</Typography.Text>
                  <Typography.Title level={3} style={{ margin: '8px 0 0', fontSize: 28 }}>¥{metrics.cpc.toFixed(2)}</Typography.Title>
                </div>
              </div>
            </div>
          </Col>
        </Row>
      </Card>

      <Row gutter={[20, 20]}>
        <Col xs={24} lg={12}>
          <MetricCard
            eyebrow="预算使用率"
            value={metrics.usage.toFixed(1)}
            suffix="%"
            hint={`总预算 ¥${metrics.totalBudget.toLocaleString()} / 已消耗 ¥${metrics.totalSpent.toLocaleString()}`}
            progress={metrics.usage}
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <MetricCard
            eyebrow="总曝光量"
            value={metrics.totalImpressions.toLocaleString()}
            hint="覆盖规模保持稳定增长"
            accent="#0f9d58"
          />
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <MetricCard
            eyebrow="活动总数"
            value={metrics.total}
            hint={`${metrics.active} 个活动保持投放中`}
            accent="#f59e0b"
          />
        </Col>
      </Row>

      <Row gutter={[20, 20]}>
        <Col xs={24} lg={8}>
          <MetricCard
            eyebrow="总预算"
            value={metrics.totalBudget.toLocaleString()}
            suffix="¥"
            hint="为近期活动提供资金上限"
          />
        </Col>
        <Col xs={24} lg={8}>
          <MetricCard
            eyebrow="总消耗"
            value={metrics.totalSpent.toLocaleString()}
            suffix="¥"
            hint="当前已经产生的实际投放成本"
            accent="#dc2626"
          />
        </Col>
        <Col xs={24} lg={8}>
          <MetricCard
            eyebrow="点击效率"
            value={metrics.totalClicks.toLocaleString()}
            hint={`点击率 ${metrics.ctr.toFixed(2)}%`}
            accent="#2f6bff"
          />
        </Col>
      </Row>

      <Card
        title="近期广告活动"
        extra={<Typography.Text type="secondary"><ArrowUpOutlined /> 最近 5 个活动</Typography.Text>}
        bodyStyle={{ paddingTop: 8 }}
      >
        <Table
          dataSource={topCampaigns}
          columns={columns}
          rowKey="id"
          pagination={false}
          scroll={{ x: 860 }}
        />
      </Card>
    </div>
  );
}
