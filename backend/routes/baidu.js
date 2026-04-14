const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { resolveRuntimeConnection } = require('../lib/platformConnections');

// ─── 配置区 ──────────────────────────────────────────────
// 当你拿到百度营销 API 凭证后，填入下方并将 MOCK_MODE 改为 false
const MOCK_MODE = true;

function getBaiduConfig() {
  return resolveRuntimeConnection('baidu').config;
}
// ─────────────────────────────────────────────────────────

router.use(authenticate);

// Mock 数据
const mockCampaigns = [
  { campaignId: 1001, campaignName: '品牌词推广', budget: 5000, budgetType: 1, status: 'active', pause: false },
  { campaignId: 1002, campaignName: '竞品词抢量', budget: 8000, budgetType: 1, status: 'active', pause: false },
  { campaignId: 1003, campaignName: '行业词覆盖', budget: 3000, budgetType: 1, status: 'paused', pause: true },
  { campaignId: 1004, campaignName: '再营销人群', budget: 2000, budgetType: 1, status: 'active', pause: false },
];

function genDailyMock(days = 30) {
  const rows = [];
  const today = new Date('2026-04-06');
  for (let d = days - 1; d >= 0; d--) {
    const date = new Date(today);
    date.setDate(date.getDate() - d);
    const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
    const impression = Math.floor(Math.random() * 20000 + 5000);
    const click = Math.floor(impression * (Math.random() * 0.06 + 0.01));
    const cost = Math.round(click * (Math.random() * 3 + 1) * 100) / 100;
    const conversion = Math.floor(click * (Math.random() * 0.1 + 0.02));
    rows.push({ date: dateStr, impression, click, cost, conversion, ctr: (click / impression * 100).toFixed(2), cpc: (cost / click).toFixed(2) });
  }
  return rows;
}

// GET /api/baidu/campaigns — 计划列表
router.get('/campaigns', async (req, res) => {
  const baiduConfig = getBaiduConfig();
  if (MOCK_MODE) return res.json({ mock: true, list: mockCampaigns });

  // 真实调用示例（百度推广 API v3）
  // const axios = require('axios');
  // const resp = await axios.post(`${BAIDU_CONFIG.apiBase}/CampaignService/getCampaign`, {
  //   header: { username: BAIDU_CONFIG.username, password: BAIDU_CONFIG.password, token: BAIDU_CONFIG.token },
  //   body: { campaignFields: ['campaignId','campaignName','budget','status','pause'] }
  // });
  // return res.json({ mock: false, list: resp.data.body.campaignTypes });
});

// GET /api/baidu/report/daily?days=30 — 账户级日报
router.get('/report/daily', async (req, res) => {
  const days = parseInt(req.query.days) || 30;
  const baiduConfig = getBaiduConfig();
  if (MOCK_MODE) return res.json({ mock: true, list: genDailyMock(days) });

  // 真实调用示例（百度推广报告 API）
  // const today = new Date(); const start = new Date(); start.setDate(today.getDate() - days);
  // const axios = require('axios');
  // const resp = await axios.post(`${BAIDU_CONFIG.apiBase}/ReportService/getReportData`, {
  //   header: { username: BAIDU_CONFIG.username, password: BAIDU_CONFIG.password, token: BAIDU_CONFIG.token },
  //   body: { reportType: 'ACCOUNT_REPORT', unitOfTime: 'DAY', startDate: fmt(start), endDate: fmt(today),
  //           performanceData: ['impression','click','cost','conversion'] }
  // });
  // return res.json({ mock: false, list: resp.data.body.data });
});

// GET /api/baidu/report/campaign — 计划维度汇总
router.get('/report/campaign', async (req, res) => {
  const baiduConfig = getBaiduConfig();
  if (MOCK_MODE) {
    const list = mockCampaigns.map(c => ({
      ...c,
      impression: Math.floor(Math.random() * 100000 + 10000),
      click: Math.floor(Math.random() * 5000 + 500),
      cost: Math.round((Math.random() * 8000 + 500) * 100) / 100,
      conversion: Math.floor(Math.random() * 200 + 10),
    })).map(c => ({ ...c, ctr: (c.click / c.impression * 100).toFixed(2), cpc: (c.cost / c.click).toFixed(2) }));
    return res.json({ mock: true, list });
  }
  // 真实调用：reportType: 'CAMPAIGN_REPORT'，同上
});

module.exports = router;
