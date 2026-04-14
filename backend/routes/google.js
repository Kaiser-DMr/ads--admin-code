const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { resolveRuntimeConnection } = require('../lib/platformConnections');

const MOCK_MODE = true;

function getGoogleConfig() {
  return resolveRuntimeConnection('google').config;
}

router.use(authenticate);

const mockCampaigns = [
  { campaignId: 4001, campaignName: 'Google Search Brand', budget: 12000, status: 'ENABLED', pause: false },
  { campaignId: 4002, campaignName: 'Google PMax 电商转化', budget: 18000, status: 'ENABLED', pause: false },
  { campaignId: 4003, campaignName: 'Google Display 再营销', budget: 6000, status: 'PAUSED', pause: true },
  { campaignId: 4004, campaignName: 'Google YouTube 视频', budget: 9000, status: 'ENABLED', pause: false },
];

function genDailyMock(days = 30) {
  const rows = [];
  const today = new Date('2026-04-06');
  for (let d = days - 1; d >= 0; d--) {
    const date = new Date(today);
    date.setDate(date.getDate() - d);
    const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
    const impression = Math.floor(Math.random() * 45000 + 12000);
    const click = Math.floor(impression * (Math.random() * 0.07 + 0.015));
    const cost = Math.round(click * (Math.random() * 4 + 1.2) * 100) / 100;
    const conversion = Math.floor(click * (Math.random() * 0.15 + 0.03));
    rows.push({ date: dateStr, impression, click, cost, conversion, ctr: (click / impression * 100).toFixed(2), cpc: (cost / click).toFixed(2) });
  }
  return rows;
}

router.get('/campaigns', async (req, res) => {
  const googleConfig = getGoogleConfig();
  if (MOCK_MODE) return res.json({ mock: true, list: mockCampaigns });
  // 真实调用示例（Google Ads API）
  // 可基于 customerId + GAQL 查询 campaign 资源。
});

router.get('/report/daily', async (req, res) => {
  const days = parseInt(req.query.days) || 30;
  const googleConfig = getGoogleConfig();
  if (MOCK_MODE) return res.json({ mock: true, list: genDailyMock(days) });
  // 真实调用示例：按 segments.date 聚合 impressions / clicks / cost_micros / conversions。
});

router.get('/report/campaign', async (req, res) => {
  const googleConfig = getGoogleConfig();
  if (MOCK_MODE) {
    const list = mockCampaigns.map(c => ({
      ...c,
      impression: Math.floor(Math.random() * 220000 + 40000),
      click: Math.floor(Math.random() * 12000 + 1800),
      cost: Math.round((Math.random() * 26000 + 2500) * 100) / 100,
      conversion: Math.floor(Math.random() * 900 + 80),
    })).map(c => ({ ...c, ctr: (c.click / c.impression * 100).toFixed(2), cpc: (c.cost / c.click).toFixed(2) }));
    return res.json({ mock: true, list });
  }
  // 真实调用示例：按 campaign 维度聚合报表。
});

module.exports = router;
