const router = require('express').Router();
const db = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const {
  nowIso,
  isDateBefore,
  validateBudget,
  validateDates,
  deriveCreateStatus,
  deriveResumeStatus,
  deriveRowActions
} = require('../lib/campaignLifecycle');

router.use(authenticate);

function parseBoolean(value) {
  if (value === undefined || value === null || value === '') return null;
  if (value === true || value === 'true' || value === '1' || value === 1) return 1;
  if (value === false || value === 'false' || value === '0' || value === 0) return 0;
  return null;
}

function parseTargeting(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function serializeCampaign(row, role) {
  if (!row) return row;
  return {
    ...row,
    targeting: parseTargeting(row.targeting),
    requires_review: Boolean(row.requires_review),
    auto_activate: Boolean(row.auto_activate),
    actions: deriveRowActions(row, role)
  };
}

function syncAutoActivation() {
  db.prepare(`
    UPDATE campaigns
    SET status = 'active', updated_at = CURRENT_TIMESTAMP
    WHERE status = 'pending_start'
      AND auto_activate = 1
      AND start_date IS NOT NULL
      AND start_date <= date('now')
      AND (end_date IS NULL OR end_date >= date('now'))
  `).run();
}

function updateCampaign(id, updates) {
  const fields = Object.keys(updates);
  const placeholders = fields.map((field) => `${field} = ?`).join(', ');
  const values = fields.map((field) => updates[field]);
  db.prepare(`
    UPDATE campaigns
    SET ${placeholders}, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(...values, id);
}

// List
router.get('/', (req, res) => {
  syncAutoActivation();
  const {
    status,
    platform,
    search,
    requires_review,
    budget_health,
    date_from,
    date_to,
    page = 1,
    pageSize = 10
  } = req.query;
  let where = 'WHERE 1=1';
  const params = [];
  if (status) { where += ' AND status = ?'; params.push(status); }
  if (platform) { where += ' AND platform = ?'; params.push(platform); }
  if (search) { where += ' AND name LIKE ?'; params.push(`%${search}%`); }
  const reviewFlag = parseBoolean(requires_review);
  if (reviewFlag !== null) { where += ' AND requires_review = ?'; params.push(reviewFlag); }
  if (budget_health === 'healthy') {
    where += ' AND spent < COALESCE(total_budget, budget)';
  } else if (budget_health === 'exhausted') {
    where += ' AND spent >= COALESCE(total_budget, budget)';
  }
  if (date_from) { where += ' AND start_date >= ?'; params.push(date_from); }
  if (date_to) { where += ' AND end_date <= ?'; params.push(date_to); }

  const total = db.prepare(`SELECT COUNT(*) as cnt FROM campaigns ${where}`).get(...params).cnt;
  const offset = (parseInt(page) - 1) * parseInt(pageSize);
  const rows = db.prepare(
    `SELECT * FROM campaigns ${where} ORDER BY updated_at DESC, created_at DESC LIMIT ? OFFSET ?`
  ).all(...params, parseInt(pageSize), offset);
  res.json({
    list: rows.map((row) => serializeCampaign(row, req.user.role)),
    total,
    page: parseInt(page),
    pageSize: parseInt(pageSize)
  });
});

// Get one
router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ message: '广告活动不存在' });
  res.json(serializeCampaign(row, req.user.role));
});

// Create
router.post('/', requireRole('admin', 'operator'), (req, res) => {
  const payload = {
    name: req.body.name?.trim(),
    total_budget: Number(req.body.total_budget),
    daily_budget: Number(req.body.daily_budget),
    start_date: req.body.start_date || null,
    end_date: req.body.end_date || null,
    platform: req.body.platform || 'all',
    targeting: req.body.targeting || {},
    requires_review: req.body.requires_review ? 1 : 0,
    auto_activate: req.body.auto_activate === false ? 0 : 1
  };
  if (!payload.name) return res.status(400).json({ message: '活动名称为必填项' });
  const budgetError = validateBudget(payload);
  if (budgetError) return res.status(400).json({ message: budgetError });
  const dateError = validateDates(payload);
  if (dateError) return res.status(400).json({ message: dateError });
  const result = db.prepare(
    `INSERT INTO campaigns (
      name, status, budget, total_budget, daily_budget, spent,
      start_date, end_date, platform, targeting, requires_review,
      auto_activate, created_by
    ) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    payload.name,
    deriveCreateStatus(payload),
    payload.total_budget,
    payload.total_budget,
    payload.daily_budget,
    payload.start_date,
    payload.end_date,
    payload.platform,
    JSON.stringify(payload.targeting),
    payload.requires_review,
    payload.auto_activate,
    req.user.id
  );
  const row = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(serializeCampaign(row, req.user.role));
});

// Update
router.put('/:id', requireRole('admin', 'operator'), (req, res) => {
  const row = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ message: '广告活动不存在' });
  const name = req.body.name?.trim();
  const startDate = req.body.start_date ?? row.start_date;
  const endDate = req.body.end_date ?? row.end_date;
  const totalBudget = req.body.total_budget !== undefined ? Number(req.body.total_budget) : (row.total_budget ?? row.budget);
  const dailyBudget = req.body.daily_budget !== undefined ? Number(req.body.daily_budget) : row.daily_budget;
  const payload = {
    total_budget: totalBudget,
    daily_budget: dailyBudget,
    start_date: startDate,
    end_date: endDate
  };
  if (name !== undefined && !name) return res.status(400).json({ message: '活动名称为必填项' });
  const budgetError = validateBudget(payload);
  if (budgetError) return res.status(400).json({ message: budgetError });
  const dateError = validateDates(payload);
  if (dateError) return res.status(400).json({ message: dateError });

  updateCampaign(req.params.id, {
    name: name ?? row.name,
    budget: totalBudget,
    total_budget: totalBudget,
    daily_budget: dailyBudget,
    start_date: startDate,
    end_date: endDate,
    platform: req.body.platform ?? row.platform,
    targeting: req.body.targeting ? JSON.stringify(req.body.targeting) : row.targeting,
    requires_review: req.body.requires_review !== undefined ? (req.body.requires_review ? 1 : 0) : row.requires_review,
    auto_activate: req.body.auto_activate !== undefined ? (req.body.auto_activate ? 1 : 0) : row.auto_activate
  });
  res.json(serializeCampaign(db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id), req.user.role));
});

// Delete
router.delete('/:id', requireRole('admin'), (req, res) => {
  const row = db.prepare('SELECT id FROM campaigns WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ message: '广告活动不存在' });
  db.prepare('DELETE FROM campaigns WHERE id = ?').run(req.params.id);
  res.json({ message: '已删除' });
});

function transitionError(message, status = 409) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function transitionSubmitReview(row) {
  if (row.status !== 'draft') throw transitionError('当前状态不能提交审核');
  if (!row.requires_review) throw transitionError('该活动未开启审核流程');
  return { status: 'pending_review', submitted_at: nowIso(), status_reason: null };
}

function transitionWithdrawReview(row) {
  if (row.status !== 'pending_review') throw transitionError('当前状态不能撤回审核');
  return { status: 'draft', submitted_at: null, status_reason: null };
}

function transitionApprove(row, userId) {
  if (row.status !== 'pending_review') throw transitionError('当前状态不能审核通过');
  if (row.end_date && isDateBefore(row.end_date)) {
    throw transitionError('活动已过结束日期，不能启动');
  }
  const nextStatus = deriveResumeStatus(row);
  return { status: nextStatus, approved_by: userId, approved_at: nowIso(), status_reason: null };
}

function transitionReject(row, reason) {
  if (row.status !== 'pending_review') throw transitionError('当前状态不能驳回');
  if (!reason) throw transitionError('请填写驳回原因', 400);
  return {
    status: 'draft',
    status_reason: reason,
    approved_by: null,
    approved_at: null,
    submitted_at: null
  };
}

function transitionActivate(row) {
  if (row.end_date && isDateBefore(row.end_date)) {
    throw transitionError('活动已过结束日期，不能启动');
  }
  if (row.status === 'draft' && row.requires_review) {
    throw transitionError('该活动需要审核后才能启动');
  }
  if (row.status === 'pending_review') throw transitionError('当前状态不能启动');
  if (row.status === 'active') throw transitionError('活动已在运行中');
  if (row.status === 'completed' || row.status === 'terminated') throw transitionError('当前状态不能启动');
  if (!['draft', 'paused', 'pending_start'].includes(row.status)) {
    throw transitionError('当前状态不能启动');
  }
  const nextStatus = deriveResumeStatus(row);
  if (row.status === 'pending_start' && nextStatus === 'pending_start') {
    return { status: 'pending_start' };
  }
  return { status: nextStatus, status_reason: null };
}

function transitionPause(row, reason) {
  if (!['active', 'pending_start'].includes(row.status)) throw transitionError('当前状态不能暂停');
  return { status: 'paused', status_reason: reason || null };
}

function transitionComplete(row) {
  if (!['active', 'paused'].includes(row.status)) throw transitionError('当前状态不能完成');
  return { status: 'completed', completed_at: nowIso(), status_reason: null };
}

function transitionTerminate(row, reason) {
  if (['completed', 'terminated'].includes(row.status)) throw transitionError('当前状态不能终止');
  return { status: 'terminated', terminated_at: nowIso(), status_reason: reason || null };
}

function handleTransition(req, res, transitionFn, options = {}) {
  const row = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ message: '广告活动不存在' });
  try {
    const updates = transitionFn(row);
    updateCampaign(req.params.id, updates);
    const updated = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id);
    res.json(serializeCampaign(updated, req.user.role));
  } catch (error) {
    res.status(error.status || options.status || 409).json({ message: error.message });
  }
}

function parseBatchIds(req, res) {
  const ids = req.body.ids;
  if (!Array.isArray(ids) || ids.length === 0) {
    res.status(400).json({ message: '请提供要操作的活动 ID 列表' });
    return null;
  }
  return ids;
}

function runBatchTransition(ids, transitionFn) {
  return ids.map((id) => {
    const row = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(id);
    if (!row) return { id, ok: false, message: '广告活动不存在' };
    try {
      const updates = transitionFn(row);
      updateCampaign(id, updates);
      return { id, ok: true };
    } catch (error) {
      return { id, ok: false, message: error.message };
    }
  });
}

// Batch actions
router.post('/batch/submit-review', requireRole('admin', 'operator'), (req, res) => {
  const ids = parseBatchIds(req, res);
  if (!ids) return;
  const results = runBatchTransition(ids, transitionSubmitReview);
  res.json({ results });
});

router.post('/batch/activate', requireRole('admin', 'operator'), (req, res) => {
  const ids = parseBatchIds(req, res);
  if (!ids) return;
  const results = runBatchTransition(ids, transitionActivate);
  res.json({ results });
});

router.post('/batch/pause', requireRole('admin', 'operator'), (req, res) => {
  const ids = parseBatchIds(req, res);
  if (!ids) return;
  const reason = req.body.reason?.trim();
  const results = runBatchTransition(ids, (row) => transitionPause(row, reason));
  res.json({ results });
});

router.post('/batch/terminate', requireRole('admin', 'operator'), (req, res) => {
  const ids = parseBatchIds(req, res);
  if (!ids) return;
  const reason = req.body.reason?.trim();
  const results = runBatchTransition(ids, (row) => transitionTerminate(row, reason));
  res.json({ results });
});

// Actions
router.post('/:id/submit-review', requireRole('admin', 'operator'), (req, res) => {
  handleTransition(req, res, transitionSubmitReview);
});

router.post('/:id/withdraw-review', requireRole('admin', 'operator'), (req, res) => {
  handleTransition(req, res, transitionWithdrawReview);
});

router.post('/:id/approve', requireRole('admin'), (req, res) => {
  handleTransition(req, res, (row) => transitionApprove(row, req.user.id));
});

router.post('/:id/reject', requireRole('admin'), (req, res) => {
  const reason = req.body.reason?.trim();
  handleTransition(req, res, (row) => transitionReject(row, reason));
});

router.post('/:id/activate', requireRole('admin', 'operator'), (req, res) => {
  handleTransition(req, res, transitionActivate);
});

router.post('/:id/pause', requireRole('admin', 'operator'), (req, res) => {
  const reason = req.body.reason?.trim();
  handleTransition(req, res, (row) => transitionPause(row, reason));
});

router.post('/:id/complete', requireRole('admin', 'operator'), (req, res) => {
  handleTransition(req, res, transitionComplete);
});

router.post('/:id/terminate', requireRole('admin', 'operator'), (req, res) => {
  const reason = req.body.reason?.trim();
  handleTransition(req, res, (row) => transitionTerminate(row, reason));
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
