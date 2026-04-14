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
const {
  PLATFORM_CONNECTION_DEFINITIONS,
  serializeConnectionDetail,
  resolveRuntimeConnection
} = require('../lib/platformConnections');

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

test('platform_connections schema is available', () => {
  const columns = db
    .prepare('PRAGMA table_info(platform_connections)')
    .all()
    .map((col) => col.name);
  assert.deepEqual(columns, [
    'id',
    'platform',
    'auth_type',
    'config_json',
    'status',
    'last_verified_at',
    'last_error',
    'updated_by',
    'created_at',
    'updated_at'
  ]);
});

test('connection detail serializer masks sensitive values', () => {
  const detail = serializeConnectionDetail({
    platform: 'google',
    auth_type: 'ads_api',
    config_json: JSON.stringify({
      clientId: 'visible-client',
      clientSecret: 'super-secret',
      developerToken: 'dev-token',
      customerId: '123-456-7890'
    }),
    status: 'configured',
    updated_at: '2026-04-14 10:00:00',
    updated_by: 1
  });

  assert.equal(detail.platform, 'google');
  assert.equal(detail.fields.clientId.value, 'visible-client');
  assert.equal(detail.fields.clientSecret.configured, true);
  assert.equal(detail.fields.clientSecret.value, undefined);
  assert.equal(detail.fields.developerToken.configured, true);
});

test('operator cannot update platform connections', async () => {
  const res = await request(app)
    .put('/api/platform-connections/google')
    .set('Authorization', `Bearer ${auth('operator', 2)}`)
    .send({
      auth_type: 'ads_api',
      config: {
        clientId: 'client-id',
        clientSecret: 'client-secret',
        developerToken: 'developer-token',
        customerId: 'customer-id'
      }
    });

  assert.equal(res.status, 403);
});

test('admin can save a connection and detail does not expose secret values', async () => {
  const saveRes = await request(app)
    .put('/api/platform-connections/google')
    .set('Authorization', `Bearer ${auth('admin', 1)}`)
    .send({
      auth_type: 'ads_api',
      config: {
        clientId: 'client-id',
        clientSecret: 'client-secret',
        developerToken: 'developer-token',
        customerId: 'customer-id'
      }
    });

  assert.equal(saveRes.status, 200);

  const detailRes = await request(app)
    .get('/api/platform-connections/google')
    .set('Authorization', `Bearer ${auth('admin', 1)}`);

  assert.equal(detailRes.status, 200);
  assert.equal(detailRes.body.auth_type, 'ads_api');
  assert.equal(detailRes.body.fields.clientId.value, 'client-id');
  assert.equal(detailRes.body.fields.clientSecret.value, undefined);
  assert.equal(detailRes.body.fields.clientSecret.configured, true);
});

test('blank secret fields preserve the existing stored values', async () => {
  await request(app)
    .put('/api/platform-connections/kuaishou')
    .set('Authorization', `Bearer ${auth('admin', 1)}`)
    .send({
      auth_type: 'app_access_token',
      config: {
        appId: 'original-app',
        appSecret: 'original-secret',
        accessToken: 'original-token'
      }
    });

  const updateRes = await request(app)
    .put('/api/platform-connections/kuaishou')
    .set('Authorization', `Bearer ${auth('admin', 1)}`)
    .send({
      auth_type: 'app_access_token',
      config: {
        appId: 'updated-app',
        appSecret: '',
        accessToken: ''
      }
    });

  assert.equal(updateRes.status, 200);

  const row = db
    .prepare('SELECT config_json FROM platform_connections WHERE platform = ?')
    .get('kuaishou');
  const config = JSON.parse(row.config_json);
  assert.equal(config.appId, 'updated-app');
  assert.equal(config.appSecret, 'original-secret');
  assert.equal(config.accessToken, 'original-token');
});

test('unsupported auth types are rejected', async () => {
  const res = await request(app)
    .put('/api/platform-connections/baidu')
    .set('Authorization', `Bearer ${auth('admin', 1)}`)
    .send({
      auth_type: 'oauth2',
      config: {}
    });

  assert.equal(res.status, 400);
  assert.equal(res.body.message, '当前授权方式暂未支持');
});

test('connection list returns unconfigured defaults for untouched platforms', async () => {
  const res = await request(app)
    .get('/api/platform-connections')
    .set('Authorization', `Bearer ${auth('admin', 1)}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.length, 4);
  assert.equal(res.body.find((item) => item.platform === 'baidu').status, 'unconfigured');
});

test('google route prefers saved connection over env fallback', async () => {
  db.prepare('DELETE FROM platform_connections WHERE platform = ?').run('google');
  db.prepare(`
    INSERT INTO platform_connections (platform, auth_type, config_json, status, updated_by)
    VALUES (?, ?, ?, 'configured', 1)
  `).run('google', 'ads_api', JSON.stringify({
    clientId: 'saved-client',
    clientSecret: 'saved-secret',
    developerToken: 'saved-dev',
    customerId: 'saved-customer'
  }));

  const res = await request(app)
    .get('/api/platform-connections/google')
    .set('Authorization', `Bearer ${auth('admin', 1)}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.fields.clientId.value, 'saved-client');
});

test('local connection test reports missing fields for incomplete saved rows', async () => {
  db.prepare(`
    INSERT INTO platform_connections (platform, auth_type, config_json, status, updated_by)
    VALUES (?, ?, ?, 'configured', 1)
  `).run('baidu', 'account_password_token', JSON.stringify({
    username: 'only-username'
  }));

  const res = await request(app)
    .post('/api/platform-connections/baidu/test')
    .set('Authorization', `Bearer ${auth('admin', 1)}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.ok, false);
  assert.deepEqual(res.body.missing_fields, ['password', 'token']);
});

test('runtime resolver prefers saved config over env fallback', () => {
  process.env.GOOGLE_ADS_CLIENT_ID = 'env-client';
  process.env.GOOGLE_ADS_CLIENT_SECRET = 'env-secret';

  db.prepare('DELETE FROM platform_connections WHERE platform = ?').run('google');
  db.prepare(`
    INSERT INTO platform_connections (platform, auth_type, config_json, status, updated_by)
    VALUES (?, ?, ?, 'configured', 1)
  `).run('google', 'ads_api', JSON.stringify({
    clientId: 'saved-client',
    clientSecret: 'saved-secret'
  }));

  const resolved = resolveRuntimeConnection('google');
  assert.equal(resolved.source, 'saved');
  assert.equal(resolved.config.clientId, 'saved-client');
  assert.equal(resolved.config.clientSecret, 'saved-secret');
});

test('runtime resolver falls back to env when no saved connection', () => {
  process.env.BAIDU_USERNAME = 'env-user';
  process.env.BAIDU_PASSWORD = 'env-pass';
  process.env.BAIDU_DEV_TOKEN = 'env-token';

  db.prepare('DELETE FROM platform_connections WHERE platform = ?').run('baidu');

  const resolved = resolveRuntimeConnection('baidu');
  assert.equal(resolved.source, 'env');
  assert.equal(resolved.config.username, 'env-user');
  assert.equal(resolved.config.password, 'env-pass');
  assert.equal(resolved.config.token, 'env-token');
});
