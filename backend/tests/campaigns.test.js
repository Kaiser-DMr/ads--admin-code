process.env.AD_ADMIN_DB_PATH = ':memory:';
process.env.AD_ADMIN_SEED = 'false';
process.env.NODE_ENV = 'test';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const jwt = require('jsonwebtoken');

const { app } = require('../server');
const db = require('../db');
const { JWT_SECRET } = require('../middleware/auth');

function ensureUser(id, role) {
  db.prepare(
    'INSERT OR IGNORE INTO users (id, username, password, role, status) VALUES (?, ?, ?, ?, ?)'
  ).run(id, `${role}-${id}`, 'test-password', role, 'active');
}

ensureUser(1, 'admin');
ensureUser(2, 'operator');

function auth(role = 'admin', id = 1) {
  return jwt.sign({ id, username: `${role}-${id}`, role }, JWT_SECRET);
}

test('health check works', async () => {
  const res = await request(app).get('/api/health');

  assert.equal(res.status, 200);
  assert.equal(res.body.status, 'ok');
  assert.ok(res.body.time);
});

test('campaign list requires authentication', async () => {
  const res = await request(app).get('/api/campaigns');

  assert.equal(res.status, 401);
});

test('campaign schema includes new columns', () => {
  const columns = db.prepare('PRAGMA table_info(campaigns)').all().map((col) => col.name);
  const expected = [
    'total_budget',
    'daily_budget',
    'requires_review',
    'auto_activate',
    'submitted_at',
    'approved_by',
    'approved_at',
    'completed_at',
    'terminated_at',
    'status_reason'
  ];

  expected.forEach((name) => {
    assert.ok(columns.includes(name), `missing column: ${name}`);
  });
});

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

test('approve with past start date returns active', async () => {
  const createRes = await request(app)
    .post('/api/campaigns')
    .set('Authorization', `Bearer ${auth('operator', 2)}`)
    .send({
      name: '审核立即启动',
      total_budget: 9000,
      daily_budget: 450,
      platform: 'all',
      start_date: '2020-01-01',
      end_date: '2030-01-31',
      requires_review: true
    });

  const submitRes = await request(app)
    .post(`/api/campaigns/${createRes.body.id}/submit-review`)
    .set('Authorization', `Bearer ${auth('operator', 2)}`);

  assert.equal(submitRes.status, 200);

  const approveRes = await request(app)
    .post(`/api/campaigns/${createRes.body.id}/approve`)
    .set('Authorization', `Bearer ${auth('admin', 1)}`);

  assert.equal(approveRes.status, 200);
  assert.equal(approveRes.body.status, 'active');
});

test('operator cannot approve campaigns', async () => {
  const createRes = await request(app)
    .post('/api/campaigns')
    .set('Authorization', `Bearer ${auth('operator', 2)}`)
    .send({
      name: '权限测试活动',
      total_budget: 8000,
      daily_budget: 400,
      platform: 'all',
      start_date: '2026-04-22',
      end_date: '2026-05-01',
      requires_review: true
    });

  const submitRes = await request(app)
    .post(`/api/campaigns/${createRes.body.id}/submit-review`)
    .set('Authorization', `Bearer ${auth('operator', 2)}`);

  assert.equal(submitRes.status, 200);

  const approveRes = await request(app)
    .post(`/api/campaigns/${createRes.body.id}/approve`)
    .set('Authorization', `Bearer ${auth('operator', 2)}`);

  assert.equal(approveRes.status, 403);
});

test('activate without review moves draft to pending_start when start date is in the future', async () => {
  const createRes = await request(app)
    .post('/api/campaigns')
    .set('Authorization', `Bearer ${auth('operator', 2)}`)
    .send({
      name: '未来启动活动',
      total_budget: 6000,
      daily_budget: 300,
      platform: 'all',
      start_date: '2099-01-01',
      end_date: '2099-02-01',
      requires_review: false
    });

  assert.equal(createRes.status, 201);
  assert.equal(createRes.body.status, 'draft');

  const activateRes = await request(app)
    .post(`/api/campaigns/${createRes.body.id}/activate`)
    .set('Authorization', `Bearer ${auth('operator', 2)}`);

  assert.equal(activateRes.status, 200);
  assert.equal(activateRes.body.status, 'pending_start');
});

test('activate with no start_date returns active', async () => {
  const createRes = await request(app)
    .post('/api/campaigns')
    .set('Authorization', `Bearer ${auth('operator', 2)}`)
    .send({
      name: '无开始日期启动',
      total_budget: 4000,
      daily_budget: 200,
      platform: 'all',
      requires_review: false
    });

  assert.equal(createRes.status, 201);

  const activateRes = await request(app)
    .post(`/api/campaigns/${createRes.body.id}/activate`)
    .set('Authorization', `Bearer ${auth('operator', 2)}`);

  assert.equal(activateRes.status, 200);
  assert.equal(activateRes.body.status, 'active');
});

test('expired campaign cannot be activated', async () => {
  const createRes = await request(app)
    .post('/api/campaigns')
    .set('Authorization', `Bearer ${auth('operator', 2)}`)
    .send({
      name: '过期活动不可启动',
      total_budget: 3000,
      daily_budget: 150,
      platform: 'all',
      start_date: '2020-01-01',
      end_date: '2020-01-02',
      requires_review: false
    });

  assert.equal(createRes.status, 201);

  const activateRes = await request(app)
    .post(`/api/campaigns/${createRes.body.id}/activate`)
    .set('Authorization', `Bearer ${auth('operator', 2)}`);

  assert.equal(activateRes.status, 409);
  assert.equal(activateRes.body.message, '活动已过结束日期，不能启动');
});

test('batch pause returns per-row results', async () => {
  const createRes = await request(app)
    .post('/api/campaigns')
    .set('Authorization', `Bearer ${auth('operator', 2)}`)
    .send({
      name: '批量暂停活动',
      total_budget: 7000,
      daily_budget: 350,
      platform: 'all',
      start_date: '2020-01-01',
      end_date: '2030-01-31',
      requires_review: false
    });

  const activateRes = await request(app)
    .post(`/api/campaigns/${createRes.body.id}/activate`)
    .set('Authorization', `Bearer ${auth('operator', 2)}`);

  assert.equal(activateRes.status, 200);

  const batchRes = await request(app)
    .post('/api/campaigns/batch/pause')
    .set('Authorization', `Bearer ${auth('operator', 2)}`)
    .send({ ids: [createRes.body.id, 99999], reason: '批量暂停' });

  assert.equal(batchRes.status, 200);
  assert.equal(batchRes.body.results.length, 2);
  const success = batchRes.body.results.find((item) => item.id === createRes.body.id);
  const failure = batchRes.body.results.find((item) => item.id === 99999);
  assert.equal(success.ok, true);
  assert.equal(failure.ok, false);
});

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
      requires_review: true
    });

  const submitRes = await request(app)
    .post(`/api/campaigns/${createRes.body.id}/submit-review`)
    .set('Authorization', `Bearer ${auth('operator', 2)}`);
  assert.equal(submitRes.status, 200);

  const approveRes = await request(app)
    .post(`/api/campaigns/${createRes.body.id}/approve`)
    .set('Authorization', `Bearer ${auth('admin', 1)}`);
  assert.equal(approveRes.status, 200);
  assert.equal(approveRes.body.status, 'active');

  const listRes = await request(app)
    .get('/api/campaigns')
    .set('Authorization', `Bearer ${auth('admin', 1)}`);

  const row = listRes.body.list.find((item) => item.id === createRes.body.id);
  assert.equal(row.status, 'active');
});
