# Campaign Management Mainline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the first-phase campaign management mainline with lifecycle control, total and daily budgets, optional approval, batch actions, and a campaign list UI that makes schedule and budget state directly operable.

**Architecture:** Expand the current `campaigns` table into a richer workflow-backed model, centralize state transitions in a dedicated backend lifecycle module, expose action-oriented APIs for single and batch transitions, then rebuild the campaign frontend around smaller campaign-specific UI modules that share one ruleset for status display, action visibility, filters, and form validation.

**Tech Stack:** Express 4, Node `--experimental-sqlite`, SQLite, JWT auth middleware, React 18, Ant Design 5, Vite 5, Vitest, React Testing Library, Supertest, plain CSS

---

## File Structure

### Existing files to modify

- `backend/package.json`
  - Add backend test script and the dev dependency needed for route-level verification.

- `backend/package-lock.json`
  - Captures the dependency change introduced by backend test tooling.

- `backend/server.js`
  - Export the Express app for tests while preserving the current runtime entrypoint.

- `backend/db.js`
  - Expand campaign schema and seed data to support lifecycle, budgets, approval, and timestamps.

- `backend/routes/campaigns.js`
  - Replace generic status mutation with lifecycle-aware list/create/edit/single-action/batch-action endpoints.

- `frontend/package.json`
  - Add frontend test script and test dependencies.

- `frontend/package-lock.json`
  - Captures the dependency change introduced by frontend test tooling.

- `frontend/src/api/index.js`
  - Expand the campaign API client to expose the new action-oriented endpoints.

- `frontend/src/pages/Campaigns.jsx`
  - Convert the page from a single-file CRUD table into a composition root that wires filters, drawer, batch bar, row actions, and lifecycle-aware tables together.

- `frontend/src/index.css`
  - Add campaign-management-specific layout and responsive rules for filter rows, batch bars, drawer sections, and compact mobile row presentation.

### New backend files

- `backend/lib/campaignLifecycle.js`
  - Own all allowed status transitions, role checks, date checks, reason handling, and batch result evaluation.

- `backend/tests/campaigns.test.js`
  - End-to-end route tests for create/edit validation, approval flow, half-automatic activation, permissions, and batch actions.

### New frontend files

- `frontend/src/pages/campaigns/constants.js`
  - Canonical status labels, colors, filter options, and action names shared by the page and tests.

- `frontend/src/pages/campaigns/utils.js`
  - Pure helpers for budget metrics, date formatting, lifecycle display text, and frontend row action derivation.

- `frontend/src/pages/campaigns/CampaignStatusTag.jsx`
  - Small display component for consistent lifecycle rendering.

- `frontend/src/pages/campaigns/CampaignFilters.jsx`
  - Search and filter toolbar.

- `frontend/src/pages/campaigns/CampaignBatchBar.jsx`
  - Selection summary and batch action controls.

- `frontend/src/pages/campaigns/CampaignFormDrawer.jsx`
  - Create/edit campaign drawer with grouped sections and validation.

- `frontend/src/pages/campaigns/Campaigns.test.jsx`
  - Frontend tests for filters, status actions, and batch action visibility.

### Verification-only files

- `docs/superpowers/specs/2026-04-14-campaign-management-design.md`
  - Approved design document that this plan implements.

---

### Task 1: Build backend test foundations and schema support

**Files:**
- Modify: `backend/package.json`
- Modify: `backend/package-lock.json`
- Modify: `backend/server.js`
- Modify: `backend/db.js`
- Test: `backend/tests/campaigns.test.js`

- [ ] **Step 1: Add backend test tooling before touching lifecycle logic**

Update `backend/package.json` to include a real backend test entry and `supertest`:

```json
{
  "name": "ad-admin-backend",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": {
    "start": "PORT=${PORT:-3002} node --experimental-sqlite server.js",
    "dev": "PORT=${PORT:-3002} node --experimental-sqlite --watch server.js",
    "test": "node --test tests/*.test.js"
  },
  "dependencies": {
    "bcryptjs": "^2.4.3",
    "cors": "^2.8.5",
    "express": "^4.18.2",
    "jsonwebtoken": "^9.0.2"
  },
  "devDependencies": {
    "nodemon": "^3.0.3",
    "supertest": "^7.0.0"
  }
}
```

Run:

```bash
cd backend && npm install
```

Expected:

```text
added 1 package, and audited ...
found 0 vulnerabilities
```

- [ ] **Step 2: Make the Express app testable without changing runtime behavior**

Refactor `backend/server.js` to export `app` and only listen when executed directly:

```js
const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/auth', require('./routes/auth'));
app.use('/api/campaigns', require('./routes/campaigns'));
app.use('/api/creatives', require('./routes/creatives'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/users', require('./routes/users'));
app.use('/api/baidu', require('./routes/baidu'));
app.use('/api/kuaishou', require('./routes/kuaishou'));
app.use('/api/jliang', require('./routes/jliang'));
app.use('/api/google', require('./routes/google'));

app.get('/api/health', (_, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

if (require.main === module) {
  const PORT = Number(process.env.PORT) || 3001;
  app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));
}

module.exports = { app };
```

- [ ] **Step 3: Expand the campaign schema to support lifecycle and dual budgets**

In `backend/db.js`, add one migration helper near the top so the current SQLite file can evolve safely:

```js
function ensureColumn(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!columns.some(col => col.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}
```

Then add the new columns immediately after the `CREATE TABLE IF NOT EXISTS campaigns` block:

```js
ensureColumn('campaigns', 'total_budget', 'REAL NOT NULL DEFAULT 0');
ensureColumn('campaigns', 'daily_budget', 'REAL NOT NULL DEFAULT 0');
ensureColumn('campaigns', 'requires_review', 'INTEGER NOT NULL DEFAULT 0');
ensureColumn('campaigns', 'auto_activate', 'INTEGER NOT NULL DEFAULT 1');
ensureColumn('campaigns', 'submitted_at', 'TEXT');
ensureColumn('campaigns', 'approved_by', 'INTEGER');
ensureColumn('campaigns', 'approved_at', 'TEXT');
ensureColumn('campaigns', 'completed_at', 'TEXT');
ensureColumn('campaigns', 'terminated_at', 'TEXT');
ensureColumn('campaigns', 'status_reason', 'TEXT');
```

Normalize legacy budget data after the columns exist:

```js
db.exec(`
  UPDATE campaigns
  SET
    total_budget = CASE WHEN total_budget = 0 THEN budget ELSE total_budget END,
    daily_budget = CASE
      WHEN daily_budget = 0 AND budget > 0 THEN ROUND(budget / 30.0, 2)
      ELSE daily_budget
    END
`);
```

- [ ] **Step 4: Update the campaign seed data so development data exercises the new workflow**

Replace the current `seedCampaign` statement in `backend/db.js` with this version:

```js
const seedCampaign = db.prepare(`
  INSERT INTO campaigns (
    name, status, budget, total_budget, daily_budget, spent,
    start_date, end_date, platform, requires_review, auto_activate,
    impressions, clicks, conversions, created_by, submitted_at,
    approved_by, approved_at, status_reason
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)
`);
```

And update the seed loop to insert realistic values:

```js
const statuses = ['active', 'pending_start', 'pending_review', 'paused', 'completed', 'draft'];

names.forEach((name, i) => {
  const totalBudget = Math.round((Math.random() * 50000 + 5000) * 100) / 100;
  const dailyBudget = Math.round(Math.max(totalBudget / 30, 200) * 100) / 100;
  const spent = ['draft', 'pending_review'].includes(statuses[i])
    ? 0
    : Math.round(totalBudget * (Math.random() * 0.7 + 0.1) * 100) / 100;
  const impressions = Math.floor(spent * (Math.random() * 200 + 100));
  const clicks = Math.floor(impressions * (Math.random() * 0.05 + 0.01));
  const conversions = Math.floor(clicks * (Math.random() * 0.1 + 0.02));
  const requiresReview = statuses[i] === 'pending_review' ? 1 : 0;
  const submittedAt = statuses[i] === 'pending_review' ? '2026-04-01T09:00:00.000Z' : null;
  const approvedBy = statuses[i] === 'pending_start' ? 1 : null;
  const approvedAt = statuses[i] === 'pending_start' ? '2026-04-02T09:00:00.000Z' : null;

  const result = seedCampaign.run(
    name,
    statuses[i],
    totalBudget,
    totalBudget,
    dailyBudget,
    spent,
    '2026-04-01',
    '2026-12-31',
    platforms[i % 4],
    requiresReview,
    1,
    impressions,
    clicks,
    conversions,
    submittedAt,
    approvedBy,
    approvedAt,
    statuses[i] === 'paused' ? '运营手动暂停' : null
  );

  campaignIds.push(result.lastInsertRowid);
});
```

- [ ] **Step 5: Write the first failing backend lifecycle smoke test**

Create `backend/tests/campaigns.test.js` with this initial harness:

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');

const { app } = require('../server');
const { JWT_SECRET } = require('../middleware/auth');

function auth(role = 'admin', id = 1) {
  return jwt.sign({ id, username: `${role}-user`, role }, JWT_SECRET);
}

test('health check works', async () => {
  const res = await request(app).get('/api/health');
  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'ok');
});

test('campaign list still requires authentication', async () => {
  const res = await request(app).get('/api/campaigns');
  assert.equal(res.status, 401);
});
```

- [ ] **Step 6: Run the new backend tests and make sure the foundation passes**

Run:

```bash
cd backend && npm test
```

Expected:

```text
ok 1 - health check works
ok 2 - campaign list still requires authentication
```

- [ ] **Step 7: Commit the backend foundation**

Run:

```bash
git add backend/package.json backend/package-lock.json backend/server.js backend/db.js backend/tests/campaigns.test.js
git commit -m "test: add campaign backend foundations"
```

---

### Task 2: Centralize lifecycle rules and expose campaign action APIs

**Files:**
- Create: `backend/lib/campaignLifecycle.js`
- Modify: `backend/routes/campaigns.js`
- Modify: `backend/tests/campaigns.test.js`
- Test: `backend/package.json`

- [ ] **Step 1: Write a failing test for the approval path before implementing it**

Append this test to `backend/tests/campaigns.test.js`:

```js
test('admin can approve a pending review campaign into pending_start', async () => {
  const createRes = await request(app)
    .post('/api/campaigns')
    .set('Authorization', `Bearer ${auth('operator', 2)}`)
    .send({
      name: '审批测试活动',
      total_budget: 10000,
      daily_budget: 500,
      platform: 'all',
      start_date: '2026-04-20',
      end_date: '2026-04-30',
      requires_review: true
    });

  assert.equal(createRes.status, 201);
  assert.equal(createRes.body.status, 'draft');

  const submitRes = await request(app)
    .post(`/api/campaigns/${createRes.body.id}/submit-review`)
    .set('Authorization', `Bearer ${auth('operator', 2)}`);

  assert.equal(submitRes.status, 200);
  assert.equal(submitRes.body.status, 'pending_review');

  const approveRes = await request(app)
    .post(`/api/campaigns/${createRes.body.id}/approve`)
    .set('Authorization', `Bearer ${auth('admin', 1)}`);

  assert.equal(approveRes.status, 200);
  assert.equal(approveRes.body.status, 'pending_start');
  assert.equal(approveRes.body.approved_by, 1);
});
```

- [ ] **Step 2: Create one lifecycle module that owns status rules**

Create `backend/lib/campaignLifecycle.js` with these exported helpers:

```js
const ACTIVE_STATUSES = new Set(['active', 'paused', 'pending_start']);
const CLOSED_STATUSES = new Set(['completed', 'terminated']);

function nowIso() {
  return new Date().toISOString();
}

function dateReached(dateText) {
  if (!dateText) return false;
  const today = new Date().toISOString().slice(0, 10);
  return dateText <= today;
}

function validateBudget({ total_budget, daily_budget }) {
  if (!(Number(total_budget) > 0)) return '总预算必须大于 0';
  if (!(Number(daily_budget) > 0)) return '日预算必须大于 0';
  if (Number(daily_budget) > Number(total_budget)) return '日预算不能超过总预算';
  return null;
}

function validateDates({ start_date, end_date }) {
  if (start_date && end_date && end_date < start_date) {
    return '结束日期不能早于开始日期';
  }
  return null;
}

function deriveCreateStatus(payload) {
  return 'draft';
}

function deriveResumeStatus(campaign) {
  return dateReached(campaign.start_date) ? 'active' : 'pending_start';
}

function allowedRowActions(campaign, role) {
  const status = campaign.status;
  if (role === 'viewer') return [];
  if (status === 'draft') return campaign.requires_review ? ['edit', 'submit_review', 'delete'] : ['edit', 'activate', 'delete'];
  if (status === 'pending_review') return role === 'admin' ? ['approve', 'reject', 'withdraw_review'] : ['withdraw_review'];
  if (status === 'pending_start') return ['pause', 'terminate'];
  if (status === 'active') return ['pause', 'complete', 'terminate'];
  if (status === 'paused') return ['resume', 'terminate'];
  if (status === 'completed' || status === 'terminated') return ['duplicate'];
  return [];
}

module.exports = {
  ACTIVE_STATUSES,
  CLOSED_STATUSES,
  nowIso,
  dateReached,
  validateBudget,
  validateDates,
  deriveCreateStatus,
  deriveResumeStatus,
  allowedRowActions
};
```

- [ ] **Step 3: Replace the current campaign route with action-oriented handlers**

In `backend/routes/campaigns.js`, import the lifecycle helpers:

```js
const {
  nowIso,
  dateReached,
  validateBudget,
  validateDates,
  deriveCreateStatus,
  deriveResumeStatus
} = require('../lib/campaignLifecycle');
```

Then replace the create and update payload handling with this shape:

```js
function serializeCampaign(row) {
  return {
    ...row,
    requires_review: Boolean(row.requires_review),
    auto_activate: Boolean(row.auto_activate)
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
  `).run();
}
```

Create should validate and insert all first-phase fields:

```js
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

  const result = db.prepare(`
    INSERT INTO campaigns (
      name, status, budget, total_budget, daily_budget, spent,
      start_date, end_date, platform, targeting, requires_review,
      auto_activate, created_by
    ) VALUES (?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?)
  `).run(
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
  res.status(201).json(serializeCampaign(row));
});
```

- [ ] **Step 4: Add lifecycle endpoints for submit, withdraw, approve, reject, activate, pause, complete, terminate**

Add these handlers below the CRUD routes in `backend/routes/campaigns.js`:

```js
router.post('/:id/submit-review', requireRole('admin', 'operator'), (req, res) => {
  const row = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ message: '广告活动不存在' });
  if (row.status !== 'draft') return res.status(409).json({ message: '当前状态不能提交审核' });
  if (!row.requires_review) return res.status(409).json({ message: '该活动未开启审核流程' });

  db.prepare(`
    UPDATE campaigns
    SET status = 'pending_review', submitted_at = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(nowIso(), req.params.id);

  res.json(serializeCampaign(db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id)));
});

router.post('/:id/withdraw-review', requireRole('admin', 'operator'), (req, res) => {
  const row = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ message: '广告活动不存在' });
  if (row.status !== 'pending_review') return res.status(409).json({ message: '当前状态不能撤回审核' });

  db.prepare(`
    UPDATE campaigns
    SET status = 'draft', submitted_at = NULL, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(req.params.id);

  res.json(serializeCampaign(db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id)));
});

router.post('/:id/approve', requireRole('admin'), (req, res) => {
  const row = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ message: '广告活动不存在' });
  if (row.status !== 'pending_review') return res.status(409).json({ message: '当前状态不能审核通过' });

  db.prepare(`
    UPDATE campaigns
    SET status = 'pending_start', approved_by = ?, approved_at = ?, status_reason = NULL, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(req.user.id, nowIso(), req.params.id);

  res.json(serializeCampaign(db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id)));
});
```

Add the remaining actions with the same style:

```js
router.post('/:id/reject', requireRole('admin'), (req, res) => {
  const row = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id);
  const reason = req.body.reason?.trim();
  if (!row) return res.status(404).json({ message: '广告活动不存在' });
  if (row.status !== 'pending_review') return res.status(409).json({ message: '当前状态不能驳回' });
  if (!reason) return res.status(400).json({ message: '请填写驳回原因' });

  db.prepare(`
    UPDATE campaigns
    SET status = 'draft', status_reason = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(reason, req.params.id);

  res.json(serializeCampaign(db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id)));
});

router.post('/:id/activate', requireRole('admin', 'operator'), (req, res) => {
  const row = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ message: '广告活动不存在' });

  const nextStatus = dateReached(row.start_date) ? 'active' : 'pending_start';
  const allowed = row.status === 'draft' || row.status === 'paused' || row.status === 'pending_start';
  if (!allowed) return res.status(409).json({ message: '当前状态不能启动' });
  if (row.status === 'draft' && row.requires_review) return res.status(409).json({ message: '请先完成审核' });

  db.prepare(`
    UPDATE campaigns
    SET status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(row.status === 'paused' ? deriveResumeStatus(row) : nextStatus, req.params.id);

  res.json(serializeCampaign(db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id)));
});
```

```js
router.post('/:id/pause', requireRole('admin', 'operator'), (req, res) => {
  const row = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ message: '广告活动不存在' });
  if (!['active', 'pending_start'].includes(row.status)) return res.status(409).json({ message: '当前状态不能暂停' });

  db.prepare(`
    UPDATE campaigns
    SET status = 'paused', status_reason = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(req.body.reason?.trim() || '手动暂停', req.params.id);

  res.json(serializeCampaign(db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id)));
});

router.post('/:id/complete', requireRole('admin', 'operator'), (req, res) => {
  const row = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ message: '广告活动不存在' });
  if (!['active', 'paused'].includes(row.status)) return res.status(409).json({ message: '当前状态不能完成' });

  db.prepare(`
    UPDATE campaigns
    SET status = 'completed', completed_at = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(nowIso(), req.params.id);

  res.json(serializeCampaign(db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id)));
});

router.post('/:id/terminate', requireRole('admin', 'operator'), (req, res) => {
  const row = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ message: '广告活动不存在' });
  if (['completed', 'terminated'].includes(row.status)) return res.status(409).json({ message: '当前状态不能终止' });

  db.prepare(`
    UPDATE campaigns
    SET status = 'terminated', terminated_at = ?, status_reason = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(nowIso(), req.body.reason?.trim() || '手动终止', req.params.id);

  res.json(serializeCampaign(db.prepare('SELECT * FROM campaigns WHERE id = ?').get(req.params.id)));
});
```

- [ ] **Step 5: Add list filters and batch endpoints to the route**

Update the list handler in `backend/routes/campaigns.js` so it calls `syncAutoActivation()` first and supports new filters:

```js
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
  if (requires_review !== undefined && requires_review !== '') {
    where += ' AND requires_review = ?';
    params.push(requires_review === 'true' ? 1 : 0);
  }
  if (date_from) { where += ' AND start_date >= ?'; params.push(date_from); }
  if (date_to) { where += ' AND end_date <= ?'; params.push(date_to); }
  if (budget_health === 'exhausted') where += ' AND spent >= total_budget';
  if (budget_health === 'healthy') where += ' AND spent < total_budget';

  const total = db.prepare(`SELECT COUNT(*) as cnt FROM campaigns ${where}`).get(...params).cnt;
  const offset = (parseInt(page, 10) - 1) * parseInt(pageSize, 10);
  const rows = db.prepare(`
    SELECT * FROM campaigns
    ${where}
    ORDER BY updated_at DESC, created_at DESC
    LIMIT ? OFFSET ?
  `).all(...params, parseInt(pageSize, 10), offset);

  res.json({ list: rows.map(serializeCampaign), total, page: Number(page), pageSize: Number(pageSize) });
});
```

Then add a shared batch helper:

```js
function runBatch(ids, handler) {
  return ids.map(id => {
    try {
      return { id, ok: true, campaign: handler(id) };
    } catch (error) {
      return { id, ok: false, message: error.message };
    }
  });
}
```

And add one batch route pattern:

```js
router.post('/batch/pause', requireRole('admin', 'operator'), (req, res) => {
  const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
  const results = runBatch(ids, (id) => {
    const row = db.prepare('SELECT * FROM campaigns WHERE id = ?').get(id);
    if (!row) throw new Error('广告活动不存在');
    if (!['active', 'pending_start'].includes(row.status)) throw new Error('当前状态不能暂停');

    db.prepare(`
      UPDATE campaigns
      SET status = 'paused', status_reason = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(req.body.reason?.trim() || '批量暂停', id);

    return serializeCampaign(db.prepare('SELECT * FROM campaigns WHERE id = ?').get(id));
  });

  res.json({ results });
});
```

Mirror that pattern for `submit-review`, `activate`, and `terminate`.

- [ ] **Step 6: Extend the backend tests until all key lifecycle rules are covered**

Expand `backend/tests/campaigns.test.js` with these additional cases:

```js
test('operator cannot approve a campaign', async () => {
  const res = await request(app)
    .post('/api/campaigns/1/approve')
    .set('Authorization', `Bearer ${auth('operator', 2)}`);

  assert.equal(res.status, 403);
});

test('activate without review moves draft to pending_start when start date is in the future', async () => {
  const createRes = await request(app)
    .post('/api/campaigns')
    .set('Authorization', `Bearer ${auth('operator', 2)}`)
    .send({
      name: '未来启动活动',
      total_budget: 3000,
      daily_budget: 300,
      platform: 'Web',
      start_date: '2099-01-01',
      end_date: '2099-01-31',
      requires_review: false
    });

  const activateRes = await request(app)
    .post(`/api/campaigns/${createRes.body.id}/activate`)
    .set('Authorization', `Bearer ${auth('operator', 2)}`);

  assert.equal(activateRes.status, 200);
  assert.equal(activateRes.body.status, 'pending_start');
});

test('batch pause returns per-row results', async () => {
  const res = await request(app)
    .post('/api/campaigns/batch/pause')
    .set('Authorization', `Bearer ${auth('admin', 1)}`)
    .send({ ids: [1, 999999], reason: '批量暂停测试' });

  assert.equal(res.status, 200);
  assert.equal(Array.isArray(res.body.results), true);
  assert.equal(res.body.results.length, 2);
});
```

- [ ] **Step 7: Run backend tests and confirm the lifecycle API is green**

Run:

```bash
cd backend && npm test
```

Expected:

```text
ok ... admin can approve a pending review campaign into pending_start
ok ... operator cannot approve a campaign
ok ... activate without review moves draft to pending_start when start date is in the future
ok ... batch pause returns per-row results
```

- [ ] **Step 8: Commit the lifecycle backend**

Run:

```bash
git add backend/lib/campaignLifecycle.js backend/routes/campaigns.js backend/tests/campaigns.test.js
git commit -m "feat: add campaign lifecycle backend"
```

---

### Task 3: Add frontend test tooling, campaign helpers, and API clients

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/package-lock.json`
- Modify: `frontend/src/api/index.js`
- Create: `frontend/src/pages/campaigns/constants.js`
- Create: `frontend/src/pages/campaigns/utils.js`
- Create: `frontend/src/pages/campaigns/CampaignStatusTag.jsx`
- Create: `frontend/src/pages/campaigns/Campaigns.test.jsx`
- Test: `frontend/package.json`

- [ ] **Step 1: Add frontend test dependencies before the page refactor**

Update `frontend/package.json`:

```json
{
  "name": "ad-admin-frontend",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "@ant-design/charts": "^2.1.3",
    "@ant-design/icons": "^5.3.7",
    "antd": "^5.16.4",
    "axios": "^1.7.2",
    "dayjs": "^1.11.11",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.23.1"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.0.1",
    "@testing-library/user-event": "^14.5.2",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "jsdom": "^25.0.1",
    "vite": "^5.2.13",
    "vitest": "^2.1.2"
  }
}
```

Run:

```bash
cd frontend && npm install
```

Expected:

```text
added ... packages, and audited ...
found 0 vulnerabilities
```

- [ ] **Step 2: Expand the frontend campaign API around action endpoints**

Replace the current `campaignApi` block in `frontend/src/api/index.js` with:

```js
export const campaignApi = {
  list: (params) => http.get('/campaigns', { params }),
  get: (id) => http.get(`/campaigns/${id}`),
  create: (data) => http.post('/campaigns', data),
  update: (id, data) => http.put(`/campaigns/${id}`, data),
  remove: (id) => http.delete(`/campaigns/${id}`),
  summary: () => http.get('/campaigns/meta/summary'),
  submitReview: (id) => http.post(`/campaigns/${id}/submit-review`),
  withdrawReview: (id) => http.post(`/campaigns/${id}/withdraw-review`),
  approve: (id) => http.post(`/campaigns/${id}/approve`),
  reject: (id, data) => http.post(`/campaigns/${id}/reject`, data),
  activate: (id) => http.post(`/campaigns/${id}/activate`),
  pause: (id, data) => http.post(`/campaigns/${id}/pause`, data),
  complete: (id) => http.post(`/campaigns/${id}/complete`),
  terminate: (id, data) => http.post(`/campaigns/${id}/terminate`, data),
  batchSubmitReview: (ids) => http.post('/campaigns/batch/submit-review', { ids }),
  batchActivate: (ids) => http.post('/campaigns/batch/activate', { ids }),
  batchPause: (ids, reason) => http.post('/campaigns/batch/pause', { ids, reason }),
  batchTerminate: (ids, reason) => http.post('/campaigns/batch/terminate', { ids, reason }),
};
```

- [ ] **Step 3: Create one shared status/constants module for the campaign UI**

Create `frontend/src/pages/campaigns/constants.js`:

```js
export const CAMPAIGN_STATUS_LABEL = {
  draft: '草稿',
  pending_review: '待审核',
  pending_start: '待开始',
  active: '投放中',
  paused: '已暂停',
  completed: '已完成',
  terminated: '已终止',
};

export const CAMPAIGN_STATUS_COLOR = {
  draft: 'default',
  pending_review: 'processing',
  pending_start: 'cyan',
  active: 'green',
  paused: 'orange',
  completed: 'blue',
  terminated: 'red',
};

export const CAMPAIGN_ACTION_LABEL = {
  edit: '编辑',
  delete: '删除',
  submit_review: '提交审核',
  withdraw_review: '撤回审核',
  approve: '审核通过',
  reject: '审核驳回',
  activate: '启动活动',
  pause: '暂停活动',
  complete: '完成活动',
  terminate: '终止活动',
  duplicate: '复制活动',
};

export const PLATFORM_OPTIONS = [
  { value: 'all', label: '全平台' },
  { value: 'iOS', label: 'iOS' },
  { value: 'Android', label: 'Android' },
  { value: 'Web', label: 'Web' },
];

export const BUDGET_HEALTH_OPTIONS = [
  { value: '', label: '全部预算状态' },
  { value: 'healthy', label: '预算健康' },
  { value: 'exhausted', label: '预算耗尽' },
];
```

- [ ] **Step 4: Create pure campaign UI helpers before writing the page**

Create `frontend/src/pages/campaigns/utils.js`:

```js
import dayjs from 'dayjs';

export function formatCurrency(value) {
  return `¥${Number(value || 0).toLocaleString()}`;
}

export function getRemainingBudget(row) {
  return Math.max(Number(row.total_budget || 0) - Number(row.spent || 0), 0);
}

export function getBudgetUsageRate(row) {
  const total = Number(row.total_budget || 0);
  if (!total) return 0;
  return Number((((Number(row.spent || 0) / total) * 100).toFixed(1)));
}

export function formatDateRange(row) {
  if (!row.start_date && !row.end_date) return '-';
  return `${row.start_date || '未设置'} ~ ${row.end_date || '未设置'}`;
}

export function isPendingStart(row) {
  return row.status === 'pending_start';
}

export function mapCampaignFormValues(row) {
  return {
    ...row,
    requires_review: Boolean(row?.requires_review),
    auto_activate: row?.auto_activate !== false,
    dateRange: row?.start_date && row?.end_date ? [dayjs(row.start_date), dayjs(row.end_date)] : null,
  };
}

export function getRowActions(row, role) {
  if (role === 'viewer') return [];
  if (row.status === 'draft') return row.requires_review ? ['edit', 'submit_review', 'delete'] : ['edit', 'activate', 'delete'];
  if (row.status === 'pending_review') return role === 'admin' ? ['approve', 'reject', 'withdraw_review'] : ['withdraw_review'];
  if (row.status === 'pending_start') return ['pause', 'terminate'];
  if (row.status === 'active') return ['pause', 'complete', 'terminate'];
  if (row.status === 'paused') return ['activate', 'terminate'];
  if (row.status === 'completed' || row.status === 'terminated') return ['duplicate'];
  return [];
}
```

- [ ] **Step 5: Add a small reusable lifecycle tag component and a failing UI test**

Create `frontend/src/pages/campaigns/CampaignStatusTag.jsx`:

```jsx
import React from 'react';
import { Tag } from 'antd';
import { CAMPAIGN_STATUS_COLOR, CAMPAIGN_STATUS_LABEL } from './constants';

export default function CampaignStatusTag({ status }) {
  return (
    <Tag color={CAMPAIGN_STATUS_COLOR[status] || 'default'} style={{ borderRadius: 999 }}>
      {CAMPAIGN_STATUS_LABEL[status] || status}
    </Tag>
  );
}
```

Create `frontend/src/pages/campaigns/Campaigns.test.jsx` with a pure-helper-first test:

```jsx
import { describe, expect, it } from 'vitest';
import { getBudgetUsageRate, getRemainingBudget, getRowActions } from './utils';

describe('campaign utils', () => {
  it('calculates budget summary values', () => {
    const row = { total_budget: 1000, spent: 300, status: 'active' };
    expect(getRemainingBudget(row)).toBe(700);
    expect(getBudgetUsageRate(row)).toBe(30);
  });

  it('returns admin review actions for pending review campaigns', () => {
    expect(getRowActions({ status: 'pending_review' }, 'admin')).toEqual(['approve', 'reject', 'withdraw_review']);
  });
});
```

- [ ] **Step 6: Run the frontend tests to make sure the helper layer is green**

Run:

```bash
cd frontend && npm test -- src/pages/campaigns/Campaigns.test.jsx
```

Expected:

```text
✓ campaign utils > calculates budget summary values
✓ campaign utils > returns admin review actions for pending review campaigns
```

- [ ] **Step 7: Commit the frontend foundations**

Run:

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/api/index.js frontend/src/pages/campaigns/constants.js frontend/src/pages/campaigns/utils.js frontend/src/pages/campaigns/CampaignStatusTag.jsx frontend/src/pages/campaigns/Campaigns.test.jsx
git commit -m "feat: add campaign frontend foundations"
```

---

### Task 4: Rebuild the campaign page around filters, drawer sections, and batch actions

**Files:**
- Create: `frontend/src/pages/campaigns/CampaignFilters.jsx`
- Create: `frontend/src/pages/campaigns/CampaignBatchBar.jsx`
- Create: `frontend/src/pages/campaigns/CampaignFormDrawer.jsx`
- Modify: `frontend/src/pages/Campaigns.jsx`
- Modify: `frontend/src/index.css`
- Modify: `frontend/src/pages/campaigns/Campaigns.test.jsx`
- Test: `frontend/package.json`

- [ ] **Step 1: Build the campaign filter bar as a dedicated component**

Create `frontend/src/pages/campaigns/CampaignFilters.jsx`:

```jsx
import React from 'react';
import { Button, DatePicker, Input, Select, Space } from 'antd';
import { SearchOutlined, ReloadOutlined } from '@ant-design/icons';
import { BUDGET_HEALTH_OPTIONS, PLATFORM_OPTIONS, CAMPAIGN_STATUS_LABEL } from './constants';

const statusOptions = [{ value: '', label: '全部状态' }].concat(
  Object.entries(CAMPAIGN_STATUS_LABEL).map(([value, label]) => ({ value, label }))
);

export default function CampaignFilters({ value, onChange, onSearch, onReset, onCreate, canEdit }) {
  return (
    <div className="campaign-filters">
      <Input
        allowClear
        placeholder="搜索活动名称"
        prefix={<SearchOutlined />}
        value={value.search}
        onChange={(e) => onChange({ search: e.target.value })}
        className="campaign-filter-search"
      />
      <Select value={value.status} options={statusOptions} onChange={(status) => onChange({ status })} />
      <Select value={value.platform} options={[{ value: '', label: '全部平台' }, ...PLATFORM_OPTIONS]} onChange={(platform) => onChange({ platform })} />
      <Select
        value={String(value.requires_review)}
        options={[
          { value: '', label: '全部审核方式' },
          { value: 'true', label: '需要审核' },
          { value: 'false', label: '无需审核' },
        ]}
        onChange={(requires_review) => onChange({ requires_review })}
      />
      <Select value={value.budget_health} options={BUDGET_HEALTH_OPTIONS} onChange={(budget_health) => onChange({ budget_health })} />
      <DatePicker.RangePicker onChange={(dates) => onChange({
        date_from: dates?.[0]?.format('YYYY-MM-DD') || '',
        date_to: dates?.[1]?.format('YYYY-MM-DD') || '',
      })} />
      <Space>
        <Button type="default" icon={<ReloadOutlined />} onClick={onReset}>重置</Button>
        <Button type="primary" onClick={onSearch}>查询</Button>
        {canEdit ? <Button onClick={onCreate}>新建活动</Button> : null}
      </Space>
    </div>
  );
}
```

- [ ] **Step 2: Build the batch action bar before wiring table selection**

Create `frontend/src/pages/campaigns/CampaignBatchBar.jsx`:

```jsx
import React from 'react';
import { Button, Space, Typography } from 'antd';

export default function CampaignBatchBar({ count, loading, onSubmitReview, onActivate, onPause, onTerminate }) {
  if (!count) return null;

  return (
    <div className="campaign-batch-bar">
      <Typography.Text strong>已选择 {count} 个活动</Typography.Text>
      <Space wrap>
        <Button loading={loading} onClick={onSubmitReview}>批量提审</Button>
        <Button loading={loading} onClick={onActivate}>批量启动</Button>
        <Button loading={loading} onClick={onPause}>批量暂停</Button>
        <Button danger loading={loading} onClick={onTerminate}>批量终止</Button>
      </Space>
    </div>
  );
}
```

- [ ] **Step 3: Build the grouped create/edit drawer**

Create `frontend/src/pages/campaigns/CampaignFormDrawer.jsx`:

```jsx
import React from 'react';
import { Button, DatePicker, Drawer, Form, Input, InputNumber, Select, Switch } from 'antd';
import { PLATFORM_OPTIONS } from './constants';

const { RangePicker } = DatePicker;

export default function CampaignFormDrawer({ open, editing, form, onClose, onSubmit }) {
  return (
    <Drawer
      title={editing ? '编辑广告活动' : '新建广告活动'}
      open={open}
      onClose={onClose}
      width={560}
      destroyOnClose
      extra={<Button type="primary" onClick={onSubmit}>{editing ? '保存更新' : '创建活动'}</Button>}
    >
      <Form form={form} layout="vertical" className="campaign-form">
        <div className="campaign-form-section">
          <div className="campaign-form-section-title">基本信息</div>
          <Form.Item name="name" label="活动名称" rules={[{ required: true, message: '请输入活动名称' }]}>
            <Input placeholder="请输入活动名称" />
          </Form.Item>
          <Form.Item name="platform" label="投放平台" initialValue="all">
            <Select options={PLATFORM_OPTIONS} />
          </Form.Item>
        </div>

        <div className="campaign-form-section">
          <div className="campaign-form-section-title">投放计划</div>
          <Form.Item name="dateRange" label="投放时间" rules={[{ required: true, message: '请选择投放时间' }]}>
            <RangePicker style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="requires_review" label="需要审核" valuePropName="checked" initialValue={false}>
            <Switch checkedChildren="需要" unCheckedChildren="无需" />
          </Form.Item>
          <Form.Item name="auto_activate" label="到开始日期自动启动" valuePropName="checked" initialValue>
            <Switch checkedChildren="自动" unCheckedChildren="手动" />
          </Form.Item>
        </div>

        <div className="campaign-form-section">
          <div className="campaign-form-section-title">预算控制</div>
          <Form.Item name="total_budget" label="总预算 (¥)" rules={[{ required: true, message: '请输入总预算' }]}>
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item
            name="daily_budget"
            label="日预算 (¥)"
            dependencies={['total_budget']}
            rules={[
              { required: true, message: '请输入日预算' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  const totalBudget = Number(getFieldValue('total_budget') || 0);
                  if (!value || Number(value) <= totalBudget) return Promise.resolve();
                  return Promise.reject(new Error('日预算不能超过总预算'));
                }
              })
            ]}
          >
            <InputNumber min={1} style={{ width: '100%' }} />
          </Form.Item>
        </div>
      </Form>
    </Drawer>
  );
}
```

- [ ] **Step 4: Replace `frontend/src/pages/Campaigns.jsx` with a composition-based lifecycle page**

Replace the current page component with this structure:

```jsx
import React, { useEffect, useMemo, useState } from 'react';
import { Button, Card, Dropdown, Form, message, Progress, Table, Typography } from 'antd';
import { MoreOutlined } from '@ant-design/icons';
import { campaignApi } from '../api';
import { useAuth } from '../utils/auth';
import CampaignFilters from './campaigns/CampaignFilters';
import CampaignBatchBar from './campaigns/CampaignBatchBar';
import CampaignFormDrawer from './campaigns/CampaignFormDrawer';
import CampaignStatusTag from './campaigns/CampaignStatusTag';
import { CAMPAIGN_ACTION_LABEL } from './campaigns/constants';
import { formatCurrency, formatDateRange, getBudgetUsageRate, getRemainingBudget, getRowActions, mapCampaignFormValues } from './campaigns/utils';

const DEFAULT_PARAMS = {
  page: 1,
  pageSize: 10,
  search: '',
  status: '',
  platform: '',
  requires_review: '',
  budget_health: '',
  date_from: '',
  date_to: '',
};

export default function Campaigns() {
  const { user } = useAuth();
  const canEdit = ['admin', 'operator'].includes(user?.role);
  const isAdmin = user?.role === 'admin';

  const [data, setData] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [batchLoading, setBatchLoading] = useState(false);
  const [params, setParams] = useState(DEFAULT_PARAMS);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form] = Form.useForm();

  const fetchData = async (next = params) => {
    setLoading(true);
    try {
      const { data: res } = await campaignApi.list(next);
      setData(res.list);
      setTotal(res.total);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const selectedRows = useMemo(
    () => data.filter(item => selectedRowKeys.includes(item.id)),
    [data, selectedRowKeys]
  );

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ requires_review: false, auto_activate: true, platform: 'all' });
    setDrawerOpen(true);
  };

  const openEdit = (row) => {
    setEditing(row);
    form.setFieldsValue(mapCampaignFormValues(row));
    setDrawerOpen(true);
  };
```

Continue the page with submit and row actions:

```jsx
  const handleSubmit = async () => {
    const values = await form.validateFields();
    const payload = {
      ...values,
      start_date: values.dateRange?.[0]?.format('YYYY-MM-DD'),
      end_date: values.dateRange?.[1]?.format('YYYY-MM-DD'),
    };
    delete payload.dateRange;

    try {
      if (editing) {
        await campaignApi.update(editing.id, payload);
        message.success('活动更新成功');
      } else {
        await campaignApi.create(payload);
        message.success('活动创建成功');
      }
      setDrawerOpen(false);
      fetchData();
    } catch (err) {
      message.error(err.response?.data?.message || '操作失败');
    }
  };

  const runRowAction = async (action, row) => {
    try {
      if (action === 'edit') return openEdit(row);
      if (action === 'delete') await campaignApi.remove(row.id);
      if (action === 'submit_review') await campaignApi.submitReview(row.id);
      if (action === 'withdraw_review') await campaignApi.withdrawReview(row.id);
      if (action === 'approve') await campaignApi.approve(row.id);
      if (action === 'reject') await campaignApi.reject(row.id, { reason: '管理员审核驳回' });
      if (action === 'activate') await campaignApi.activate(row.id);
      if (action === 'pause') await campaignApi.pause(row.id, { reason: '页面手动暂停' });
      if (action === 'complete') await campaignApi.complete(row.id);
      if (action === 'terminate') await campaignApi.terminate(row.id, { reason: '页面手动终止' });
      if (action === 'duplicate') {
        await campaignApi.create({
          ...row,
          name: `${row.name}-复制`,
          total_budget: row.total_budget,
          daily_budget: row.daily_budget,
        });
      }
      if (action !== 'edit') {
        message.success('操作成功');
        fetchData();
      }
    } catch (err) {
      message.error(err.response?.data?.message || '操作失败');
    }
  };
```

Finish with batch actions and columns:

```jsx
  const runBatch = async (method) => {
    if (!selectedRowKeys.length) return;
    setBatchLoading(true);
    try {
      const { data: res } = await method(selectedRowKeys);
      const failCount = res.results.filter(item => !item.ok).length;
      message.success(failCount ? `批量处理完成，失败 ${failCount} 项` : '批量处理成功');
      setSelectedRowKeys([]);
      fetchData();
    } finally {
      setBatchLoading(false);
    }
  };

  const columns = [
    { title: '活动名称', dataIndex: 'name', width: 220, render: (value, row) => (
      <div className="campaign-name-cell">
        <Typography.Text strong>{value}</Typography.Text>
        <Typography.Text type="secondary">{row.platform}</Typography.Text>
      </div>
    )},
    { title: '状态', dataIndex: 'status', width: 120, render: (status) => <CampaignStatusTag status={status} /> },
    { title: '投放计划', width: 220, render: (_, row) => (
      <div className="campaign-plan-cell">
        <Typography.Text>{formatDateRange(row)}</Typography.Text>
        <Typography.Text type="secondary">{row.auto_activate ? '到期自动启动' : '手动启动'}</Typography.Text>
      </div>
    )},
    { title: '预算控制', width: 260, render: (_, row) => (
      <div className="campaign-budget-cell">
        <Typography.Text>总预算 {formatCurrency(row.total_budget)}</Typography.Text>
        <Typography.Text type="secondary">日预算 {formatCurrency(row.daily_budget)}</Typography.Text>
        <Typography.Text type="secondary">剩余 {formatCurrency(getRemainingBudget(row))}</Typography.Text>
        <Progress percent={getBudgetUsageRate(row)} size="small" showInfo={false} />
      </div>
    )},
    { title: '消耗', dataIndex: 'spent', width: 120, render: (value) => formatCurrency(value) },
    { title: '曝光', dataIndex: 'impressions', width: 100, render: (value) => Number(value || 0).toLocaleString() },
    { title: '点击', dataIndex: 'clicks', width: 100, render: (value) => Number(value || 0).toLocaleString() },
    {
      title: '操作',
      width: 120,
      fixed: 'right',
      render: (_, row) => {
        const actions = getRowActions(row, user?.role);
        const items = actions.map(action => ({ key: action, label: CAMPAIGN_ACTION_LABEL[action] || action }));
        return items.length ? (
          <Dropdown menu={{ items, onClick: ({ key }) => runRowAction(key, row) }} trigger={['click']}>
            <Button icon={<MoreOutlined />} />
          </Dropdown>
        ) : null;
      }
    }
  ];

  return (
    <div className="page-shell">
      <CampaignFilters
        value={params}
        onChange={(patch) => setParams(current => ({ ...current, ...patch }))}
        onSearch={() => fetchData(params)}
        onReset={() => { setParams(DEFAULT_PARAMS); fetchData(DEFAULT_PARAMS); }}
        onCreate={openCreate}
        canEdit={canEdit}
      />

      <CampaignBatchBar
        count={selectedRowKeys.length}
        loading={batchLoading}
        onSubmitReview={() => runBatch(campaignApi.batchSubmitReview)}
        onActivate={() => runBatch(campaignApi.batchActivate)}
        onPause={() => runBatch((ids) => campaignApi.batchPause(ids, '批量暂停'))}
        onTerminate={() => runBatch((ids) => campaignApi.batchTerminate(ids, '批量终止'))}
      />

      <Card className="page-section-card">
        <Table
          rowKey="id"
          dataSource={data}
          columns={columns}
          loading={loading}
          rowSelection={canEdit ? { selectedRowKeys, onChange: setSelectedRowKeys } : undefined}
          scroll={{ x: 1320 }}
          pagination={{
            total,
            current: params.page,
            pageSize: params.pageSize,
            onChange: (page, pageSize) => {
              const next = { ...params, page, pageSize };
              setParams(next);
              fetchData(next);
            }
          }}
        />
      </Card>

      <CampaignFormDrawer
        open={drawerOpen}
        editing={editing}
        form={form}
        onClose={() => setDrawerOpen(false)}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
```

- [ ] **Step 5: Add the campaign-specific CSS needed for desktop and mobile usability**

Append this block to `frontend/src/index.css`:

```css
.campaign-filters {
  display: grid;
  grid-template-columns: minmax(220px, 1.2fr) repeat(4, minmax(140px, 1fr)) auto auto;
  gap: 12px;
  align-items: center;
}

.campaign-filter-search {
  min-width: 0;
}

.campaign-batch-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 18px;
  border: 1px solid rgba(229, 231, 235, 0.7);
  border-radius: 22px;
  background: rgba(255, 255, 255, 0.82);
}

.campaign-name-cell,
.campaign-plan-cell,
.campaign-budget-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.campaign-form {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.campaign-form-section {
  padding: 18px;
  border: 1px solid #eef2f7;
  border-radius: 20px;
  background: #fafcff;
}

.campaign-form-section-title {
  margin-bottom: 14px;
  font-size: 14px;
  font-weight: 600;
}

@media (max-width: 768px) {
  .campaign-filters {
    grid-template-columns: 1fr;
  }

  .campaign-batch-bar {
    flex-direction: column;
    align-items: stretch;
  }

  .campaign-batch-bar .ant-space {
    width: 100%;
  }

  .campaign-batch-bar .ant-space-item,
  .campaign-batch-bar .ant-btn {
    width: 100%;
  }
}
```

- [ ] **Step 6: Upgrade the frontend tests from pure helpers to page behavior**

Replace `frontend/src/pages/campaigns/Campaigns.test.jsx` with:

```jsx
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import CampaignBatchBar from './CampaignBatchBar';
import CampaignFilters from './CampaignFilters';

describe('campaign ui primitives', () => {
  it('shows selected count in batch bar', () => {
    render(
      <CampaignBatchBar
        count={3}
        loading={false}
        onSubmitReview={() => {}}
        onActivate={() => {}}
        onPause={() => {}}
        onTerminate={() => {}}
      />
    );

    expect(screen.getByText('已选择 3 个活动')).toBeInTheDocument();
  });

  it('renders create action when the user can edit', () => {
    render(
      <CampaignFilters
        value={{ search: '', status: '', platform: '', requires_review: '', budget_health: '', date_from: '', date_to: '' }}
        onChange={vi.fn()}
        onSearch={vi.fn()}
        onReset={vi.fn()}
        onCreate={vi.fn()}
        canEdit
      />
    );

    expect(screen.getByRole('button', { name: '新建活动' })).toBeInTheDocument();
  });
});
```

- [ ] **Step 7: Run frontend tests and build verification**

Run:

```bash
cd frontend && npm test -- src/pages/campaigns/Campaigns.test.jsx
cd frontend && npm run build
```

Expected:

```text
✓ campaign ui primitives > shows selected count in batch bar
✓ campaign ui primitives > renders create action when the user can edit
vite v... building for production...
✓ built in ...
```

- [ ] **Step 8: Commit the campaign page rebuild**

Run:

```bash
git add frontend/src/pages/campaigns/CampaignFilters.jsx frontend/src/pages/campaigns/CampaignBatchBar.jsx frontend/src/pages/campaigns/CampaignFormDrawer.jsx frontend/src/pages/Campaigns.jsx frontend/src/index.css frontend/src/pages/campaigns/Campaigns.test.jsx
git commit -m "feat: rebuild campaign management page"
```

---

### Task 5: Verify the campaign mainline end-to-end

**Files:**
- Modify: `backend/tests/campaigns.test.js`
- Modify: `frontend/src/pages/campaigns/Campaigns.test.jsx`
- Test: `backend/package.json`
- Test: `frontend/package.json`
- Test: `docs/superpowers/specs/2026-04-14-campaign-management-design.md`

- [ ] **Step 1: Add a regression test for the half-automatic activation rule**

Append this backend test:

```js
test('campaign list auto-activates pending_start campaigns whose start date has arrived', async () => {
  const createRes = await request(app)
    .post('/api/campaigns')
    .set('Authorization', `Bearer ${auth('operator', 2)}`)
    .send({
      name: '自动启动回归测试',
      total_budget: 5000,
      daily_budget: 500,
      platform: 'all',
      start_date: '2020-01-01',
      end_date: '2030-01-31',
      requires_review: false
    });

  await request(app)
    .post(`/api/campaigns/${createRes.body.id}/activate`)
    .set('Authorization', `Bearer ${auth('operator', 2)}`);

  const listRes = await request(app)
    .get('/api/campaigns')
    .set('Authorization', `Bearer ${auth('admin', 1)}`);

  const row = listRes.body.list.find(item => item.id === createRes.body.id);
  assert.equal(row.status, 'active');
});
```

- [ ] **Step 2: Add a frontend regression test for admin-only review controls**

Append this test to `frontend/src/pages/campaigns/Campaigns.test.jsx`:

```jsx
import { getRowActions } from './utils';

it('does not expose approval to operator users', () => {
  expect(getRowActions({ status: 'pending_review' }, 'operator')).toEqual(['withdraw_review']);
});
```

- [ ] **Step 3: Run the full automated verification before claiming completion**

Run:

```bash
cd backend && npm test
cd frontend && npm test
cd frontend && npm run build
```

Expected:

```text
backend test suite: all tests passed
frontend test suite: all tests passed
vite build: exit code 0
```

- [ ] **Step 4: Re-read the approved spec and verify coverage line by line**

Use this checklist against `docs/superpowers/specs/2026-04-14-campaign-management-design.md`:

```text
[ ] statuses implemented: draft / pending_review / pending_start / active / paused / completed / terminated
[ ] create/edit supports total budget + daily budget
[ ] requires_review is optional per campaign
[ ] admin-only approve / reject
[ ] pending_start auto-activates once start_date is reached
[ ] list supports search and filters
[ ] batch actions exist for submit / activate / pause / terminate
[ ] row actions are role-aware
[ ] mobile layout remains usable
```

- [ ] **Step 5: Execute manual verification on the running product**

Run the backend and frontend in separate terminals:

```bash
cd backend && npm run dev
cd frontend && npm run dev
```

Then manually verify:

```text
1. Create a campaign in draft with total budget and daily budget
2. Submit it for review when requires_review is enabled
3. Log in as admin and approve it
4. Confirm the row shows pending_start
5. Set a start date that has arrived and refresh the list
6. Confirm the row becomes active
7. Pause it, resume it, complete it, and terminate another campaign
8. Select multiple rows and run batch pause or batch terminate
9. Repeat the key steps on a narrow mobile viewport
```

- [ ] **Step 6: Commit the verification pass**

Run:

```bash
git add backend/tests/campaigns.test.js frontend/src/pages/campaigns/Campaigns.test.jsx
git commit -m "test: verify campaign management mainline"
```

---

## Self-Review

### Spec coverage

- lifecycle statuses are covered in Task 2 and verified in Task 5
- budget fields, validation, and display are covered in Tasks 1, 2, 3, and 4
- optional approval and admin-only review are covered in Tasks 2 and 5
- single-item and batch operations are covered in Tasks 2 and 4
- campaign list visibility and mobile usability are covered in Task 4

No approved spec requirement is intentionally left without a task.

### Placeholder scan

- No `TODO`, `TBD`, or “same as above” placeholders remain.
- Every code-changing step includes an explicit snippet or concrete command.

### Type consistency

- Backend canonical fields use `total_budget`, `daily_budget`, `requires_review`, `auto_activate`, and lifecycle status strings throughout.
- Frontend helpers, APIs, and tests use the same field names and statuses.
