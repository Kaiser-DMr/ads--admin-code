const router = require('express').Router();
const db = require('../db');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);

// Overview: last N days trend
router.get('/trend', (req, res) => {
  const { days = 30, campaign_id } = req.query;
  let where = 'WHERE 1=1';
  const params = [];
  if (campaign_id) { where += ' AND campaign_id = ?'; params.push(campaign_id); }

  const rows = db.prepare(`
    SELECT date,
      SUM(impressions) as impressions,
      SUM(clicks) as clicks,
      SUM(spend) as spend,
      SUM(conversions) as conversions
    FROM daily_stats
    ${where}
    GROUP BY date
    ORDER BY date DESC
    LIMIT ?
  `).all(...params, parseInt(days));
  res.json(rows.reverse());
});

// Per-campaign performance
router.get('/campaigns', (req, res) => {
  const rows = db.prepare(`
    SELECT c.id, c.name, c.status, c.platform,
      c.budget, c.spent,
      c.impressions, c.clicks, c.conversions,
      CASE WHEN c.impressions > 0 THEN ROUND(c.clicks * 100.0 / c.impressions, 2) ELSE 0 END as ctr,
      CASE WHEN c.clicks > 0 THEN ROUND(c.conversions * 100.0 / c.clicks, 2) ELSE 0 END as cvr,
      CASE WHEN c.clicks > 0 THEN ROUND(c.spent / c.clicks, 4) ELSE 0 END as cpc
    FROM campaigns c
    ORDER BY c.spent DESC
  `).all();
  res.json(rows);
});

// Platform breakdown
router.get('/platforms', (req, res) => {
  const rows = db.prepare(`
    SELECT platform,
      COUNT(*) as campaign_count,
      SUM(impressions) as impressions,
      SUM(clicks) as clicks,
      SUM(spent) as spend,
      SUM(conversions) as conversions
    FROM campaigns
    GROUP BY platform
  `).all();
  res.json(rows);
});

module.exports = router;
