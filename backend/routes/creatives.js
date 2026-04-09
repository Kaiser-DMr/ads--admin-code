const router = require('express').Router();
const db = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');

router.use(authenticate);

router.get('/', (req, res) => {
  const { campaign_id, status, type, page = 1, pageSize = 10 } = req.query;
  let where = 'WHERE 1=1';
  const params = [];
  if (campaign_id) { where += ' AND c.campaign_id = ?'; params.push(campaign_id); }
  if (status) { where += ' AND c.status = ?'; params.push(status); }
  if (type) { where += ' AND c.type = ?'; params.push(type); }

  const total = db.prepare(`SELECT COUNT(*) as cnt FROM creatives c ${where}`).get(...params).cnt;
  const offset = (parseInt(page) - 1) * parseInt(pageSize);
  const rows = db.prepare(`
    SELECT c.*, ca.name as campaign_name
    FROM creatives c
    LEFT JOIN campaigns ca ON c.campaign_id = ca.id
    ${where} ORDER BY c.created_at DESC LIMIT ? OFFSET ?
  `).all(...params, parseInt(pageSize), offset);
  res.json({ list: rows, total });
});

router.post('/', requireRole('admin', 'operator'), (req, res) => {
  const { name, campaign_id, type = 'image' } = req.body;
  if (!name) return res.status(400).json({ message: '素材名称不能为空' });
  const result = db.prepare(
    'INSERT INTO creatives (name, campaign_id, type, created_by) VALUES (?, ?, ?, ?)'
  ).run(name, campaign_id || null, type, req.user.id);
  res.status(201).json(db.prepare('SELECT * FROM creatives WHERE id = ?').get(result.lastInsertRowid));
});

// Review (approve/reject)
router.put('/:id/review', requireRole('admin'), (req, res) => {
  const { status, reject_reason } = req.body;
  if (!['approved', 'rejected'].includes(status)) return res.status(400).json({ message: '状态无效' });
  const row = db.prepare('SELECT id FROM creatives WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ message: '素材不存在' });
  db.prepare('UPDATE creatives SET status = ?, reject_reason = ? WHERE id = ?').run(status, reject_reason || null, req.params.id);
  res.json(db.prepare('SELECT * FROM creatives WHERE id = ?').get(req.params.id));
});

router.delete('/:id', requireRole('admin', 'operator'), (req, res) => {
  const row = db.prepare('SELECT id FROM creatives WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ message: '素材不存在' });
  db.prepare('DELETE FROM creatives WHERE id = ?').run(req.params.id);
  res.json({ message: '已删除' });
});

module.exports = router;
