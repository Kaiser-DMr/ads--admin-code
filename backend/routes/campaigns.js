const router = require('express').Router();
const db = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

router.use(authenticate);

// List
router.get('/', (req, res) => {
  const { status, platform, search, page = 1, pageSize = 10 } = req.query;
  let where = 'WHERE 1=1';
  const params = [];
  if (status) { where += ' AND status = ?'; params.push(status); }
  if (platform) { where += ' AND platform = ?'; params.push(platform); }
  if (search) { where += ' AND name LIKE ?'; params.push(`%${search}%`); }

  const total = db.prepare(`SELECT COUNT(*) as cnt FROM campaigns ${where}`).get(...params).cnt;
  const offset = (parseInt(page) - 1) * parseInt(pageSize);
  const rows = db.prepare(`SELECT * FROM campaigns ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`).all(...params, parseInt(pageSize), offset);
  res.json({ list: rows, total, page: parseInt(page), pageSize: parseInt(pageSize) });
});

// Get one
router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ message: '广告活动不存在' });
  res.json(row);
});

// Create
router.post('/', requireRole('admin', 'operator'), (req, res) => {
  const { name, budget, start_date, end_date, platform = 'all', targeting = {} } = req.body;
  if (!name || !budget) return res.status(400).json({ message: '名称和预算为必填项' });
  const result = db.prepare(
    'INSERT INTO campaigns (name, budget, start_date, end_date, platform, targeting, created_by) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(name, budget, start_date, end_date, platform, JSON.stringify(targeting), req.user.id);
  const row = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(row);
});

// Update
router.put('/:id', requireRole('admin', 'operator'), (req, res) => {
  const { name, budget, start_date, end_date, platform, targeting, status } = req.body;
  const row = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ message: '广告活动不存在' });

  db.prepare(`
    UPDATE campaigns SET
      name = ?, budget = ?, start_date = ?, end_date = ?,
      platform = ?, targeting = ?, status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    name ?? row.name, budget ?? row.budget, start_date ?? row.start_date, end_date ?? row.end_date,
    platform ?? row.platform, targeting ? JSON.stringify(targeting) : row.targeting, status ?? row.status,
    req.params.id
  );
  res.json(db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id));
});

// Delete
router.delete('/:id', requireRole('admin'), (req, res) => {
  const row = db.prepare('SELECT id FROM campaigns WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ message: '广告活动不存在' });
  db.prepare('DELETE FROM campaigns WHERE id = ?').run(req.params.id);
  res.json({ message: '已删除' });
});

// Summary stats
router.get('/meta/summary', (req, res) => {
  const total = db.prepare('SELECT COUNT(*) as cnt FROM campaigns').get().cnt;
  const active = db.prepare("SELECT COUNT(*) as cnt FROM campaigns WHERE status = 'active'").get().cnt;
  const totalBudget = db.prepare("SELECT COALESCE(SUM(budget),0) as s FROM campaigns").get().s;
  const totalSpent = db.prepare("SELECT COALESCE(SUM(spent),0) as s FROM campaigns").get().s;
  const totalImpressions = db.prepare("SELECT COALESCE(SUM(impressions),0) as s FROM campaigns").get().s;
  const totalClicks = db.prepare("SELECT COALESCE(SUM(clicks),0) as s FROM campaigns").get().s;
  res.json({ total, active, totalBudget, totalSpent, totalImpressions, totalClicks });
});

module.exports = router;
