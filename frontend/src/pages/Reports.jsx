import React, { useEffect, useState } from 'react';
import { Row, Col, Card, Table, Typography, Spin, Select, Tabs, Tag, Alert } from 'antd';
import { reportApi, baiduApi, kuaishouApi, jliangApi, googleApi } from '../api';

function BarChart({ data, xKey, aKey, bKey, aColor, bColor, aLabel, bLabel, xFmt }) {
  if (!data.length) return null;
  const maxA = Math.max(...data.map(d => d[aKey]), 1);
  const maxB = Math.max(...data.map(d => d[bKey]), 1);
  return (
    <div style={{ overflowX: 'auto' }}>
      <div style={{ minWidth: 600 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', height: 140, gap: 2, padding: '0 8px' }}>
          {data.map((d, i) => (
            <div key={i} style={{ flex: 1, display: 'flex', gap: 1, alignItems: 'flex-end', height: 130 }}>
              <div title={`${aLabel}: ${Number(d[aKey]).toLocaleString()}`} style={{ flex: 1, background: aColor, height: `${(d[aKey] / maxA) * 100}%`, minHeight: 2, borderRadius: '2px 2px 0 0', opacity: 0.75 }} />
              <div title={`${bLabel}: ${Number(d[bKey]).toLocaleString()}`} style={{ flex: 1, background: bColor, height: `${(d[bKey] / maxB) * 100}%`, minHeight: 2, borderRadius: '2px 2px 0 0', opacity: 0.85 }} />
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', padding: '4px 8px', gap: 2 }}>
          {data.map((d, i) => (
            <div key={i} style={{ flex: 1, fontSize: 10, color: '#999', textAlign: 'center', overflow: 'hidden' }}>
              {i % Math.ceil(data.length / 10) === 0 ? (xFmt ? xFmt(d[xKey]) : d[xKey]) : ''}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 16, padding: '4px 8px', fontSize: 12 }}>
          <span><span style={{ display: 'inline-block', width: 12, height: 12, background: aColor, opacity: 0.75, marginRight: 4 }} />{aLabel}</span>
          <span><span style={{ display: 'inline-block', width: 12, height: 12, background: bColor, opacity: 0.85, marginRight: 4 }} />{bLabel}</span>
        </div>
      </div>
    </div>
  );
}

const campColumns = [
  { title: '计划名称', dataIndex: 'campaignName', ellipsis: true },
  { title: '状态', dataIndex: 'pause', width: 80, render: (v, r) => {
    const paused = v === true || r.status === 'disable' || r.status === 2 || r.status === 'PAUSED';
    return <Tag color={paused ? 'orange' : 'green'}>{paused ? '暂停' : '投放中'}</Tag>;
  }},
  { title: '预算', dataIndex: 'budget', width: 90, render: v => `¥${Number(v).toLocaleString()}` },
  { title: '曝光', dataIndex: 'impression', width: 100, render: v => Number(v).toLocaleString() },
  { title: '点击', dataIndex: 'click', width: 90, render: v => Number(v).toLocaleString() },
  { title: 'CTR', dataIndex: 'ctr', width: 80, render: v => `${v}%` },
  { title: 'CPC', dataIndex: 'cpc', width: 80, render: v => `¥${v}` },
  { title: '消耗', dataIndex: 'cost', width: 100, render: v => `¥${Number(v).toLocaleString()}` },
  { title: '转化', dataIndex: 'conversion', width: 80 },
];

function PlatformTab({ api, title, aColor, bColor, mockDesc }) {
  const [daily, setDaily] = useState([]);
  const [campData, setCampData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [isMock, setIsMock] = useState(true);

  const fetchDaily = async (d) => {
    const { data } = await api.reportDaily({ days: d });
    setDaily(data.list);
    setIsMock(data.mock);
  };

  useEffect(() => {
    Promise.all([api.reportCampaign(), api.reportDaily({ days })]).then(([c, d]) => {
      setCampData(c.data.list);
      setDaily(d.data.list);
      setIsMock(d.data.mock);
    }).finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>;

  const totalCost = daily.reduce((s, d) => s + d.cost, 0);
  const totalClick = daily.reduce((s, d) => s + d.click, 0);
  const totalImp = daily.reduce((s, d) => s + d.impression, 0);

  return (
    <div>
      {isMock && (
        <Alert
          message="当前为 Mock 数据"
          description={mockDesc}
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}
      <Card
        title={`${title}趋势`}
        extra={
          <Select
            value={days}
            onChange={v => { setDays(v); fetchDaily(v); }}
            options={[{ value: 7, label: '近7天' }, { value: 14, label: '近14天' }, { value: 30, label: '近30天' }]}
            style={{ width: 100 }}
          />
        }
        style={{ marginBottom: 16 }}
      >
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col xs={24} sm={8}><Card size="small" style={{ textAlign: 'center' }}><div style={{ fontSize: 12, color: '#999' }}>总曝光</div><div style={{ fontSize: 20, fontWeight: 600 }}>{totalImp.toLocaleString()}</div></Card></Col>
          <Col xs={24} sm={8}><Card size="small" style={{ textAlign: 'center' }}><div style={{ fontSize: 12, color: '#999' }}>总点击</div><div style={{ fontSize: 20, fontWeight: 600 }}>{totalClick.toLocaleString()}</div></Card></Col>
          <Col xs={24} sm={8}><Card size="small" style={{ textAlign: 'center' }}><div style={{ fontSize: 12, color: '#999' }}>总消耗</div><div style={{ fontSize: 20, fontWeight: 600 }}>¥{totalCost.toLocaleString()}</div></Card></Col>
        </Row>
        <BarChart
          data={daily} xKey="date" aKey="impression" bKey="click"
          aColor={aColor} bColor={bColor} aLabel="曝光量" bLabel="点击量"
          xFmt={v => `${v.slice(4, 6)}/${v.slice(6, 8)}`}
        />
      </Card>
      <Card title="计划维度">
        <Table dataSource={campData} columns={campColumns} rowKey="campaignId" size="small" scroll={{ x: 800 }} pagination={false} />
      </Card>
    </div>
  );
}

export default function Reports() {
  const [trend, setTrend] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [platforms, setPlatforms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);

  const fetchTrend = async (d) => {
    const { data } = await reportApi.trend({ days: d });
    setTrend(data);
  };

  useEffect(() => {
    Promise.all([reportApi.campaigns(), reportApi.platforms(), reportApi.trend({ days })]).then(([c, p, t]) => {
      setCampaigns(c.data);
      setPlatforms(p.data);
      setTrend(t.data);
    }).finally(() => setLoading(false));
  }, []);

  const campaignColumns = [
    { title: '活动名称', dataIndex: 'name', ellipsis: true },
    { title: '平台', dataIndex: 'platform', width: 80 },
    { title: '预算', dataIndex: 'budget', width: 100, render: v => `¥${Number(v).toLocaleString()}` },
    { title: '消耗', dataIndex: 'spent', width: 100, render: v => `¥${Number(v).toLocaleString()}` },
    { title: '曝光', dataIndex: 'impressions', width: 100, render: v => Number(v).toLocaleString() },
    { title: '点击', dataIndex: 'clicks', width: 90, render: v => Number(v).toLocaleString() },
    { title: 'CTR', dataIndex: 'ctr', width: 80, render: v => `${v}%` },
    { title: 'CVR', dataIndex: 'cvr', width: 80, render: v => `${v}%` },
    { title: 'CPC', dataIndex: 'cpc', width: 80, render: v => `¥${v}` },
    { title: '转化', dataIndex: 'conversions', width: 80 },
  ];

  const platformColumns = [
    { title: '平台', dataIndex: 'platform' },
    { title: '活动数', dataIndex: 'campaign_count' },
    { title: '曝光', dataIndex: 'impressions', render: v => Number(v).toLocaleString() },
    { title: '点击', dataIndex: 'clicks', render: v => Number(v).toLocaleString() },
    { title: '消耗', dataIndex: 'spend', render: v => `¥${Number(v).toLocaleString()}` },
    { title: '转化', dataIndex: 'conversions' },
  ];

  if (loading) return <div className="page-shell"><Card className="page-section-card" bodyStyle={{ padding: 80, textAlign: 'center' }}><Spin size="large" /></Card></div>;

  const totalSpend = trend.reduce((s, d) => s + d.spend, 0);
  const totalImpressions = trend.reduce((s, d) => s + d.impressions, 0);
  const totalClicks = trend.reduce((s, d) => s + d.clicks, 0);

  return (
    <div className="page-shell">
      <Card className="page-section-card" bodyStyle={{ padding: 28, background: 'linear-gradient(135deg, #fff 0%, #f7faff 58%, #eef4ff 100%)' }}>
        <Row gutter={[24, 24]} align="middle">
          <Col xs={24} lg={14}>
            <Typography.Text style={{ color: '#2f6bff', fontSize: 12, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
              Reporting cockpit
            </Typography.Text>
            <Typography.Title style={{ margin: '14px 0 10px', fontSize: 40, lineHeight: 1.08, letterSpacing: '-0.04em', maxWidth: 620 }}>
              A clearer control panel for cross-platform ad performance.
            </Typography.Title>
            <Typography.Paragraph style={{ marginBottom: 0, color: '#6b7280', fontSize: 15, lineHeight: 1.8, maxWidth: 620 }}>
              在一个更统一的中控视图里，快速判断全平台曝光、点击、成本与平台结构变化。
            </Typography.Paragraph>
          </Col>
          <Col xs={24} lg={10}>
            <Row gutter={[12, 12]}>
              <Col xs={24} sm={8}><Card size="small" style={{ textAlign: 'center', borderRadius: 22 }}><div style={{ fontSize: 12, color: '#999' }}>总曝光</div><div style={{ fontSize: 20, fontWeight: 600 }}>{totalImpressions.toLocaleString()}</div></Card></Col>
              <Col xs={24} sm={8}><Card size="small" style={{ textAlign: 'center', borderRadius: 22 }}><div style={{ fontSize: 12, color: '#999' }}>总点击</div><div style={{ fontSize: 20, fontWeight: 600 }}>{totalClicks.toLocaleString()}</div></Card></Col>
              <Col xs={24} sm={8}><Card size="small" style={{ textAlign: 'center', borderRadius: 22 }}><div style={{ fontSize: 12, color: '#999' }}>总消耗</div><div style={{ fontSize: 20, fontWeight: 600 }}>¥{totalSpend.toLocaleString()}</div></Card></Col>
            </Row>
          </Col>
        </Row>
      </Card>

      <Card
        className="page-section-card"
        title="全平台趋势"
        extra={
          <Select
            value={days}
            onChange={v => { setDays(v); fetchTrend(v); }}
            options={[{ value: 7, label: '近7天' }, { value: 14, label: '近14天' }, { value: 30, label: '近30天' }]}
            style={{ width: 100 }}
          />
        }
      >
        <BarChart
          data={trend} xKey="date" aKey="impressions" bKey="clicks"
          aColor="#1677ff" bColor="#52c41a" aLabel="曝光量" bLabel="点击量"
          xFmt={v => v?.slice(5)}
        />
      </Card>

      <Tabs items={[
        {
          key: 'campaigns',
          label: '活动维度',
          children: (
            <Card className="page-section-card">
              <Table dataSource={campaigns} columns={campaignColumns} rowKey="id" size="small" scroll={{ x: 900 }} pagination={false} />
            </Card>
          ),
        },
        {
          key: 'platforms',
          label: '平台维度',
          children: (
            <Card className="page-section-card">
              <Table dataSource={platforms} columns={platformColumns} rowKey="platform" size="small" scroll={{ x: 640 }} pagination={false} />
            </Card>
          ),
        },
        {
          key: 'baidu',
          label: '百度营销',
          children: <PlatformTab
            api={baiduApi} title="百度营销"
            aColor="#f5222d" bColor="#fa8c16"
            mockDesc="在 backend/routes/baidu.js 填入百度推广 API 凭证并将 MOCK_MODE 改为 false。"
          />,
        },
        {
          key: 'kuaishou',
          label: '快手',
          children: <PlatformTab
            api={kuaishouApi} title="快手磁力金牛"
            aColor="#ff6b00" bColor="#ffb300"
            mockDesc="在 backend/routes/kuaishou.js 填入快手磁力金牛 API 凭证（appId / appSecret / accessToken）并将 MOCK_MODE 改为 false。"
          />,
        },
        {
          key: 'jliang',
          label: '巨量引擎',
          children: <PlatformTab
            api={jliangApi} title="巨量引擎"
            aColor="#1890ff" bColor="#722ed1"
            mockDesc="在 backend/routes/jliang.js 填入巨量引擎 Marketing API 凭证（appId / accessToken / advertiserId）并将 MOCK_MODE 改为 false。"
          />,
        },
        {
          key: 'google',
          label: 'Google Ads',
          children: <PlatformTab
            api={googleApi} title="Google Ads"
            aColor="#4285F4" bColor="#34A853"
            mockDesc="在 backend/routes/google.js 填入 Google Ads API 凭证（clientId / clientSecret / developerToken / customerId）并将 MOCK_MODE 改为 false。"
          />,
        },
      ]} />
    </div>
  );
}
