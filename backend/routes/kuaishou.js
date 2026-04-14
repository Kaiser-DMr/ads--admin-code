const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { resolveRuntimeConnection } = require('../lib/platformConnections');

// ─── 配置区 ──────────────────────────────────────────────
const MOCK_MODE = true;

function getKuaishouConfig() {
  return resolveRuntimeConnection('kuaishou').config;
}
// ─────────────────────────────────────────────────────────

router.use(authenticate);

const mockCampaigns = [
  { campaignId: 2001, campaignName: '快手信息流-品牌', budget: 6000, status: 1, pause: false },
  { campaignId: 2002, campaignName: '快手搜索-竞品词', budget: 4000, status: 1, pause: false },
  { campaignId: 2003, campaignName: '快手直播间引流', budget: 8000, status: 2, pause: true },
  { campaignId: 2004, campaignName: '快手短视频推广', budget: 3000, status: 1, pause: false },
];

function genDailyMock(days = 30) {
  const rows = [];
  const today = new Date('2026-04-06');
  for (let d = days - 1; d >= 0; d--) {
    const date = new Date(today);
    date.setDate(date.getDate() - d);
    const dateStr = date.toISOString().split('T')[0].replace(/-/g, '');
    const impression = Math.floor(Math.random() * 30000 + 8000);
    const click = Math.floor(impression * (Math.random() * 0.05 + 0.01));
    const cost = Math.round(click * (Math.random() * 2.5 + 0.8) * 100) / 100;
    const conversion = Math.floor(click * (Math.random() * 0.08 + 0.01));
    rows.push({ date: dateStr, impression, click, cost, conversion, ctr: (click / impression * 100).toFixed(2), cpc: (cost / click).toFixed(2) });
  }
  return rows;
}

router.get('/campaigns', async (req, res) => {
  const kuaishouConfig = getKuaishouConfig();
  if (MOCK_MODE) return res.json({ mock: true, list: mockCampaigns });
  // 真实调用示例（快手磁力金牛 API）
  // const axios = require('axios');
  // const resp = await axios.get(`${KUAISHOU_CONFIG.apiBase}/campaign/list`, {
  //   headers: { 'Access-Token': KUAISHOU_CONFIG.accessToken },
  //   params: { advertiser_id: '...', page_size: 100 }
  // });
  // return res.json({ mock: false, list: resp.data.data.list });
});

router.get('/report/daily', async (req, res) => {
  const days = parseInt(req.query.days) || 30;
  const kuaishouConfig = getKuaishouConfig();
  if (MOCK_MODE) return res.json({ mock: true, list: genDailyMock(days) });
  // 真实调用：快手 /report/account/query，time_granularity: DAILY
});

router.get('/report/campaign', async (req, res) => {
  const kuaishouConfig = getKuaishouConfig();
  if (MOCK_MODE) {
    const list = mockCampaigns.map(c => ({
      ...c,
      impression: Math.floor(Math.random() * 150000 + 20000),
      click: Math.floor(Math.random() * 6000 + 800),
      cost: Math.round((Math.random() * 10000 + 1000) * 100) / 100,
      conversion: Math.floor(Math.random() * 300 + 20),
    })).map(c => ({ ...c, ctr: (c.click / c.impression * 100).toFixed(2), cpc: (c.cost / c.click).toFixed(2) }));
    return res.json({ mock: true, list });
  }
});

module.exports = router;
