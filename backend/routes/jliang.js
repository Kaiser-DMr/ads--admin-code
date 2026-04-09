const router = require('express').Router();
const { authenticate } = require('../middleware/auth');

// ─── 配置区 ──────────────────────────────────────────────
const MOCK_MODE = true;
const JLIANG_CONFIG = {
  appId: process.env.JLIANG_APP_ID || '',
  appSecret: process.env.JLIANG_APP_SECRET || '',
  accessToken: process.env.JLIANG_ACCESS_TOKEN || '',
  advertiserId: process.env.JLIANG_ADVERTISER_ID || '',
  apiBase: 'https://ad.oceanengine.com/open_api/2',
};
// ─────────────────────────────────────────────────────────

router.use(authenticate);

const mockCampaigns = [
  { campaignId: 3001, campaignName: '巨量-抖音信息流', budget: 10000, status: 'enable', budgetMode: 'BUDGET_MODE_DAY' },
  { campaignId: 3002, campaignName: '巨量-穿山甲联盟', budget: 5000, status: 'enable', budgetMode: 'BUDGET_MODE_DAY' },
  { campaignId: 3003, campaignName: '巨量-搜索广告', budget: 7000, status: 'disable', budgetMode: 'BUDGET_MODE_DAY' },
  { campaignId: 3004, campaignName: '巨量-TopView开屏', budget: 20000, status: 'enable', budgetMode: 'BUDGET_MODE_TOTAL' },
  { campaignId: 3005, campaignName: '巨量-直播带货', budget: 15000, status: 'enable', budgetMode: 'BUDGET_MODE_DAY' },
];

function genDailyMock(days = 30) {
  const rows = [];
  const today = new Date('2026-04-06');
  for (let d = days - 1; d >= 0; d--) {
    const date = new Date(today);
    date.setDate(date.getDate() - d);
    const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
    const impression = Math.floor(Math.random() * 50000 + 15000);
    const click = Math.floor(impression * (Math.random() * 0.06 + 0.015));
    const cost = Math.round(click * (Math.random() * 3 + 1) * 100) / 100;
    const conversion = Math.floor(click * (Math.random() * 0.12 + 0.02));
    rows.push({ date: dateStr, impression, click, cost, conversion, ctr: (click / impression * 100).toFixed(2), cpc: (cost / click).toFixed(2) });
  }
  return rows;
}

router.get('/campaigns', async (req, res) => {
  if (MOCK_MODE) return res.json({ mock: true, list: mockCampaigns });
  // 真实调用示例（巨量引擎 Marketing API）
  // const axios = require('axios');
  // const resp = await axios.get(`${JLIANG_CONFIG.apiBase}/campaign/get/`, {
  //   headers: { 'Access-Token': JLIANG_CONFIG.accessToken },
  //   params: { advertiser_id: JLIANG_CONFIG.advertiserId, page_size: 100 }
  // });
  // return res.json({ mock: false, list: resp.data.data.list });
});

router.get('/report/daily', async (req, res) => {
  const days = parseInt(req.query.days) || 30;
  if (MOCK_MODE) return res.json({ mock: true, list: genDailyMock(days) });
  // 真实调用：巨量 /report/advertiser/get/，time_granularity: STAT_TIME_GRANULARITY_DAILY
});

router.get('/report/campaign', async (req, res) => {
  if (MOCK_MODE) {
    const list = mockCampaigns.map(c => ({
      ...c,
      impression: Math.floor(Math.random() * 300000 + 50000),
      click: Math.floor(Math.random() * 15000 + 2000),
      cost: Math.round((Math.random() * 30000 + 3000) * 100) / 100,
      conversion: Math.floor(Math.random() * 800 + 50),
    })).map(c => ({ ...c, ctr: (c.click / c.impression * 100).toFixed(2), cpc: (c.cost / c.click).toFixed(2) }));
    return res.json({ mock: true, list });
  }
});

module.exports = router;
