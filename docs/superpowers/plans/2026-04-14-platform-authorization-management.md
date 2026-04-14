# Platform Authorization Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an admin-only `平台授权` module that stores platform credentials in application data, lets admins manage the four current ad platforms from the UI, and makes existing platform routes read saved configuration before falling back to env or mock values.

**Architecture:** Add a new `platform_connections` table plus a small backend domain helper that centralizes supported platforms, auth types, field schemas, masking, and merge rules. Expose a dedicated `/api/platform-connections` route group for admin workflows, then add an admin-only frontend page with a list view and drawer-based editor that renders form fields from shared connection metadata. Finally, update each existing platform route to resolve runtime credentials from the new connection store first, while keeping the current env/mock fallback path intact.

**Tech Stack:** Express 4, Node `--experimental-sqlite`, SQLite, JWT auth middleware, React 18, Ant Design 5, Vite 5, Vitest, React Testing Library, Supertest, plain CSS

---

## File Structure

### Existing files to modify

- `backend/db.js`
  - Create the `platform_connections` table and seed-safe schema migration.
- `backend/server.js`
  - Register the new platform-connections route group.
- `backend/routes/baidu.js`
  - Replace hard-coded runtime config reads with a shared resolver plus env/mock fallback.
- `backend/routes/kuaishou.js`
  - Same as Baidu route, but for Kuaishou fields.
- `backend/routes/jliang.js`
  - Same as Baidu route, but for Jliang fields.
- `backend/routes/google.js`
  - Same as Baidu route, but for Google fields.
- `frontend/src/api/index.js`
  - Add platform-connections API client methods.
- `frontend/src/App.jsx`
  - Register the new page route.
- `frontend/src/layouts/MainLayout.jsx`
  - Add the new admin-only navigation item and page copy.
- `frontend/src/index.css`
  - Add layout styles for the platform authorization list and drawer.
- `frontend/src/pages/Reports.jsx`
  - Remove route-file credential instructions and point users to the new module.

### New backend files

- `backend/lib/platformConnections.js`
  - Own canonical platform metadata, supported auth types, field schemas, masking helpers, payload normalization, summary serialization, and env fallback resolution.
- `backend/routes/platformConnections.js`
  - Admin-only list/detail/save/test endpoints.
- `backend/tests/platformConnections.test.js`
  - Route-level regression coverage for permissions, masking, merge-preserve behavior, unsupported auth types, and route integration.

### New frontend files

- `frontend/src/pages/PlatformConnections.jsx`
  - Page composition root for the list and configuration drawer.
- `frontend/src/pages/platform-connections/constants.js`
  - Canonical platform labels, auth-type labels, status labels, and support metadata.
- `frontend/src/pages/platform-connections/utils.js`
  - Pure helpers for turning API metadata into table and drawer presentation.
- `frontend/src/pages/platform-connections/PlatformConnectionDrawer.jsx`
  - Drawer UI that renders auth-type-driven fields and save/test actions.
- `frontend/src/pages/platform-connections/PlatformConnections.test.jsx`
  - Focused frontend tests for admin gating, unsupported auth types, and field masking UX.

### Verification-only files

- `docs/superpowers/specs/2026-04-14-platform-authorization-management-design.md`
  - Approved design spec that this plan implements.

---

### Task 1: Build backend schema and connection metadata foundations

**Files:**
- Modify: `backend/db.js`
- Create: `backend/lib/platformConnections.js`
- Test: `backend/tests/platformConnections.test.js`

- [ ] **Step 1: Write the failing backend schema and metadata tests**

Create `backend/tests/platformConnections.test.js` with the shared test bootstrapping and the first two failing tests:

```js
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
  const columns = db.prepare('PRAGMA table_info(platform_connections)').all().map((col) => col.name);
  assert.deepEqual(
    columns,
    ['id', 'platform', 'auth_type', 'config_json', 'status', 'last_verified_at', 'last_error', 'updated_by', 'created_at', 'updated_at']
  );
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
```

- [ ] **Step 2: Run the targeted backend test to verify it fails**

Run: `cd backend && node --experimental-sqlite --test tests/platformConnections.test.js`

Expected:

```text
not ok ... platform_connections schema is available
not ok ... Cannot find module '../lib/platformConnections'
```

- [ ] **Step 3: Add the new database table to `backend/db.js`**

Append this table creation inside the main schema block in `backend/db.js`:

```js
  CREATE TABLE IF NOT EXISTS platform_connections (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    platform TEXT NOT NULL UNIQUE,
    auth_type TEXT NOT NULL,
    config_json TEXT NOT NULL DEFAULT '{}',
    status TEXT NOT NULL DEFAULT 'unconfigured',
    last_verified_at DATETIME,
    last_error TEXT,
    updated_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (updated_by) REFERENCES users(id)
  );
```

No additional seed data is required in phase one.

- [ ] **Step 4: Create the platform-connection domain helper**

Create `backend/lib/platformConnections.js`:

```js
const PLATFORM_CONNECTION_DEFINITIONS = {
  baidu: {
    label: '百度营销',
    supportedAuthTypes: ['account_password_token'],
    authTypes: {
      account_password_token: {
        label: '账号 + 密码 + Token',
        fields: [
          { key: 'username', label: '用户名', secret: false, required: true },
          { key: 'password', label: '密码', secret: true, required: true },
          { key: 'token', label: '开发者 Token', secret: true, required: true }
        ]
      },
      oauth2: { label: 'OAuth 2.0', fields: [], supported: false }
    }
  },
  kuaishou: {
    label: '快手磁力金牛',
    supportedAuthTypes: ['app_access_token'],
    authTypes: {
      app_access_token: {
        label: 'App 凭证 + Access Token',
        fields: [
          { key: 'appId', label: 'App ID', secret: false, required: true },
          { key: 'appSecret', label: 'App Secret', secret: true, required: true },
          { key: 'accessToken', label: 'Access Token', secret: true, required: true }
        ]
      },
      oauth2: { label: 'OAuth 2.0', fields: [], supported: false }
    }
  },
  jliang: {
    label: '巨量引擎',
    supportedAuthTypes: ['marketing_token'],
    authTypes: {
      marketing_token: {
        label: 'Marketing API Token',
        fields: [
          { key: 'appId', label: 'App ID', secret: false, required: true },
          { key: 'accessToken', label: 'Access Token', secret: true, required: true },
          { key: 'advertiserId', label: '广告主 ID', secret: false, required: true }
        ]
      },
      oauth2: { label: 'OAuth 2.0', fields: [], supported: false }
    }
  },
  google: {
    label: 'Google Ads',
    supportedAuthTypes: ['ads_api'],
    authTypes: {
      ads_api: {
        label: 'Ads API 凭证',
        fields: [
          { key: 'clientId', label: 'Client ID', secret: false, required: true },
          { key: 'clientSecret', label: 'Client Secret', secret: true, required: true },
          { key: 'developerToken', label: 'Developer Token', secret: true, required: true },
          { key: 'customerId', label: 'Customer ID', secret: false, required: true }
        ]
      },
      oauth2: { label: 'OAuth 2.0', fields: [], supported: false }
    }
  }
};

function parseConfig(configJson) {
  if (!configJson) return {};
  try {
    return JSON.parse(configJson);
  } catch {
    return {};
  }
}

function serializeConnectionDetail(row) {
  const definition = PLATFORM_CONNECTION_DEFINITIONS[row.platform];
  const config = parseConfig(row.config_json);
  const authDefinition = definition.authTypes[row.auth_type];
  const fields = Object.fromEntries(
    authDefinition.fields.map((field) => [
      field.key,
      field.secret
        ? { configured: Boolean(config[field.key]) }
        : { configured: Boolean(config[field.key]), value: config[field.key] ?? '' }
    ])
  );

  return {
    platform: row.platform,
    platformLabel: definition.label,
    auth_type: row.auth_type,
    status: row.status,
    updated_at: row.updated_at,
    updated_by: row.updated_by,
    fields
  };
}

module.exports = {
  PLATFORM_CONNECTION_DEFINITIONS,
  parseConfig,
  serializeConnectionDetail,
};
```

- [ ] **Step 5: Run the targeted backend test to verify it passes**

Run: `cd backend && node --experimental-sqlite --test tests/platformConnections.test.js`

Expected:

```text
ok ... platform_connections schema is available
ok ... connection detail serializer masks sensitive values
```

- [ ] **Step 6: Commit the backend foundations**

```bash
git add backend/db.js backend/lib/platformConnections.js backend/tests/platformConnections.test.js
git commit -m "feat: add platform connection foundations"
```

---

### Task 2: Add admin-only platform connection APIs with merge-safe secret handling

**Files:**
- Modify: `backend/server.js`
- Create: `backend/routes/platformConnections.js`
- Modify: `backend/lib/platformConnections.js`
- Modify: `backend/tests/platformConnections.test.js`

- [ ] **Step 1: Extend the backend tests with route-level failures first**

Append these failing tests to `backend/tests/platformConnections.test.js`:

```js
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

  const row = db.prepare('SELECT config_json FROM platform_connections WHERE platform = ?').get('kuaishou');
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
```

- [ ] **Step 2: Run the targeted backend test to verify the new API tests fail**

Run: `cd backend && node --experimental-sqlite --test tests/platformConnections.test.js`

Expected:

```text
not ok ... operator cannot update platform connections
not ok ... admin can save a connection and detail does not expose secret values
not ok ... blank secret fields preserve the existing stored values
not ok ... unsupported auth types are rejected
```

- [ ] **Step 3: Expand `backend/lib/platformConnections.js` with merge and validation helpers**

Add these helpers beneath the definitions:

```js
function listAvailableAuthTypes(platform) {
  const definition = PLATFORM_CONNECTION_DEFINITIONS[platform];
  return Object.entries(definition.authTypes).map(([key, value]) => ({
    key,
    label: value.label,
    supported: definition.supportedAuthTypes.includes(key)
  }));
}

function validateConnectionPayload(platform, authType, config, previousConfig = {}) {
  const definition = PLATFORM_CONNECTION_DEFINITIONS[platform];
  if (!definition) throw new Error('不支持的平台');
  if (!definition.authTypes[authType]) throw new Error('无效的授权方式');
  if (!definition.supportedAuthTypes.includes(authType)) throw new Error('当前授权方式暂未支持');

  const merged = { ...previousConfig };
  const missing = [];

  for (const field of definition.authTypes[authType].fields) {
    const nextValue = config[field.key];
    if (field.secret) {
      if (typeof nextValue === 'string' && nextValue.trim()) merged[field.key] = nextValue.trim();
    } else if (typeof nextValue === 'string') {
      merged[field.key] = nextValue.trim();
    } else if (nextValue !== undefined && nextValue !== null) {
      merged[field.key] = nextValue;
    }

    if (field.required && !merged[field.key]) missing.push(field.key);
  }

  return { merged, missing };
}

function serializeConnectionSummary(row) {
  const definition = PLATFORM_CONNECTION_DEFINITIONS[row.platform];
  return {
    platform: row.platform,
    platformLabel: definition.label,
    auth_type: row.auth_type,
    authTypeLabel: definition.authTypes[row.auth_type]?.label || row.auth_type,
    status: row.status,
    updated_at: row.updated_at,
    updated_by: row.updated_by,
    availableAuthTypes: listAvailableAuthTypes(row.platform)
  };
}
```

Export `listAvailableAuthTypes`, `validateConnectionPayload`, and `serializeConnectionSummary`.

- [ ] **Step 4: Add the admin-only route group and register it**

Create `backend/routes/platformConnections.js`:

```js
const router = require('express').Router();
const db = require('../db');
const { authenticate, requireRole } = require('../middleware/auth');
const {
  PLATFORM_CONNECTION_DEFINITIONS,
  parseConfig,
  listAvailableAuthTypes,
  validateConnectionPayload,
  serializeConnectionDetail,
  serializeConnectionSummary,
} = require('../lib/platformConnections');

router.use(authenticate);
router.use(requireRole('admin'));

function getConnection(platform) {
  return db.prepare('SELECT * FROM platform_connections WHERE platform = ?').get(platform);
}

router.get('/', (_req, res) => {
  const rows = Object.keys(PLATFORM_CONNECTION_DEFINITIONS).map((platform) => {
    const row = getConnection(platform);
    return row || {
      platform,
      auth_type: PLATFORM_CONNECTION_DEFINITIONS[platform].supportedAuthTypes[0],
      status: 'unconfigured',
      updated_at: null,
      updated_by: null
    };
  });

  res.json(rows.map(serializeConnectionSummary));
});

router.get('/:platform', (req, res) => {
  const { platform } = req.params;
  const definition = PLATFORM_CONNECTION_DEFINITIONS[platform];
  if (!definition) return res.status(404).json({ message: '平台不存在' });

  const row = getConnection(platform) || {
    platform,
    auth_type: definition.supportedAuthTypes[0],
    config_json: '{}',
    status: 'unconfigured',
    updated_at: null,
    updated_by: null
  };

  res.json({
    ...serializeConnectionDetail(row),
    availableAuthTypes: listAvailableAuthTypes(platform)
  });
});

router.put('/:platform', (req, res) => {
  const { platform } = req.params;
  const existing = getConnection(platform);
  const previousConfig = existing ? parseConfig(existing.config_json) : {};

  try {
    const { merged, missing } = validateConnectionPayload(platform, req.body.auth_type, req.body.config || {}, previousConfig);
    if (missing.length) return res.status(400).json({ message: '缺少必填字段', missing_fields: missing });

    if (existing) {
      db.prepare(`
        UPDATE platform_connections
        SET auth_type = ?, config_json = ?, status = 'configured', last_error = NULL, updated_by = ?, updated_at = CURRENT_TIMESTAMP
        WHERE platform = ?
      `).run(req.body.auth_type, JSON.stringify(merged), req.user.id, platform);
    } else {
      db.prepare(`
        INSERT INTO platform_connections (platform, auth_type, config_json, status, updated_by)
        VALUES (?, ?, ?, 'configured', ?)
      `).run(platform, req.body.auth_type, JSON.stringify(merged), req.user.id);
    }

    res.json(serializeConnectionSummary(getConnection(platform)));
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

router.post('/:platform/test', (req, res) => {
  const { platform } = req.params;
  const row = getConnection(platform);
  if (!row) return res.status(404).json({ message: '平台尚未配置' });

  const { missing } = validateConnectionPayload(platform, row.auth_type, {}, parseConfig(row.config_json));
  res.json({
    ok: missing.length === 0,
    missing_fields: missing,
    message: missing.length ? '仍有必填字段缺失' : '本地校验通过'
  });
});

module.exports = router;
```

Register it in `backend/server.js`:

```js
app.use('/api/platform-connections', require('./routes/platformConnections'));
```

- [ ] **Step 5: Run the targeted backend test to verify it passes**

Run: `cd backend && node --experimental-sqlite --test tests/platformConnections.test.js`

Expected:

```text
ok ... operator cannot update platform connections
ok ... admin can save a connection and detail does not expose secret values
ok ... blank secret fields preserve the existing stored values
ok ... unsupported auth types are rejected
```

- [ ] **Step 6: Commit the API layer**

```bash
git add backend/server.js backend/routes/platformConnections.js backend/lib/platformConnections.js backend/tests/platformConnections.test.js
git commit -m "feat: add platform connection management api"
```

---

### Task 3: Make the existing platform routes load saved connections before env fallback

**Files:**
- Modify: `backend/lib/platformConnections.js`
- Modify: `backend/routes/baidu.js`
- Modify: `backend/routes/kuaishou.js`
- Modify: `backend/routes/jliang.js`
- Modify: `backend/routes/google.js`
- Modify: `backend/tests/platformConnections.test.js`

- [ ] **Step 1: Write the failing route-integration regression tests**

Append these tests to `backend/tests/platformConnections.test.js`:

```js
test('google route prefers saved connection over env fallback', async () => {
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
```

- [ ] **Step 2: Run the backend connection test file to verify it fails for route integration**

Run: `cd backend && node --experimental-sqlite --test tests/platformConnections.test.js`

Expected:

```text
not ok ... google route prefers saved connection over env fallback
not ok ... local connection test reports missing fields for incomplete saved rows
```

- [ ] **Step 3: Add shared runtime-resolution helpers**

Expand `backend/lib/platformConnections.js` with runtime helpers:

```js
const db = require('../db');

function getSavedConnection(platform) {
  return db.prepare('SELECT * FROM platform_connections WHERE platform = ?').get(platform);
}

function buildEnvFallback(platform) {
  if (platform === 'baidu') {
    return {
      username: process.env.BAIDU_USERNAME || '',
      password: process.env.BAIDU_PASSWORD || '',
      token: process.env.BAIDU_DEV_TOKEN || '',
      apiBase: 'https://api.baidu.com/json/sms/service'
    };
  }
  if (platform === 'kuaishou') {
    return {
      appId: process.env.KUAISHOU_APP_ID || '',
      appSecret: process.env.KUAISHOU_APP_SECRET || '',
      accessToken: process.env.KUAISHOU_ACCESS_TOKEN || '',
      apiBase: 'https://ad.e.kuaishou.com/rest/openapi/v1'
    };
  }
  if (platform === 'jliang') {
    return {
      appId: process.env.JLIANG_APP_ID || '',
      appSecret: process.env.JLIANG_APP_SECRET || '',
      accessToken: process.env.JLIANG_ACCESS_TOKEN || '',
      advertiserId: process.env.JLIANG_ADVERTISER_ID || '',
      apiBase: 'https://ad.oceanengine.com/open_api/2'
    };
  }
  return {
    clientId: process.env.GOOGLE_ADS_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_ADS_CLIENT_SECRET || '',
    developerToken: process.env.GOOGLE_ADS_DEVELOPER_TOKEN || '',
    customerId: process.env.GOOGLE_ADS_CUSTOMER_ID || '',
    apiBase: 'https://googleads.googleapis.com/v18'
  };
}

function resolveRuntimeConnection(platform) {
  const saved = getSavedConnection(platform);
  if (!saved) return { source: 'env', config: buildEnvFallback(platform) };
  return { source: 'saved', config: { ...buildEnvFallback(platform), ...parseConfig(saved.config_json) } };
}
```

Export `resolveRuntimeConnection`.

- [ ] **Step 4: Update each platform route to use the shared resolver**

Make the same shape of change in all four platform route files. Example for `backend/routes/google.js`:

```js
const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { resolveRuntimeConnection } = require('../lib/platformConnections');

const MOCK_MODE = true;

function getGoogleConfig() {
  return resolveRuntimeConnection('google').config;
}

router.use(authenticate);

router.get('/campaigns', async (req, res) => {
  const GOOGLE_CONFIG = getGoogleConfig();
  if (MOCK_MODE) return res.json({ mock: true, list: mockCampaigns, connectionSource: 'saved' });
  // real API call uses GOOGLE_CONFIG
});
```

Apply the same pattern to:

- `backend/routes/baidu.js`
- `backend/routes/kuaishou.js`
- `backend/routes/jliang.js`

Keep the current mock responses intact; only replace the source of runtime config.

- [ ] **Step 5: Run the full backend suite to verify integration stability**

Run: `cd backend && npm test`

Expected:

```text
tests ... pass
platform connection tests ... pass
campaign lifecycle tests ... pass
```

- [ ] **Step 6: Commit the route integration work**

```bash
git add backend/lib/platformConnections.js backend/routes/baidu.js backend/routes/kuaishou.js backend/routes/jliang.js backend/routes/google.js backend/tests/platformConnections.test.js
git commit -m "feat: load platform credentials from admin settings"
```

---

### Task 4: Build the admin-only frontend platform authorization module

**Files:**
- Modify: `frontend/src/api/index.js`
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/layouts/MainLayout.jsx`
- Modify: `frontend/src/index.css`
- Modify: `frontend/src/pages/Reports.jsx`
- Create: `frontend/src/pages/PlatformConnections.jsx`
- Create: `frontend/src/pages/platform-connections/constants.js`
- Create: `frontend/src/pages/platform-connections/utils.js`
- Create: `frontend/src/pages/platform-connections/PlatformConnectionDrawer.jsx`
- Test: `frontend/src/pages/platform-connections/PlatformConnections.test.jsx`

- [ ] **Step 1: Write the failing frontend tests first**

Create `frontend/src/pages/platform-connections/PlatformConnections.test.jsx`:

```jsx
// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { getAuthTypeOptions, getFieldDisplayLabel } from './utils';

describe('platform connection helpers', () => {
  it('marks unsupported auth types as disabled', () => {
    const options = getAuthTypeOptions([
      { key: 'ads_api', label: 'Ads API 凭证', supported: true },
      { key: 'oauth2', label: 'OAuth 2.0', supported: false }
    ]);

    expect(options).toEqual([
      { value: 'ads_api', label: 'Ads API 凭证', disabled: false },
      { value: 'oauth2', label: 'OAuth 2.0（暂未支持）', disabled: true }
    ]);
  });

  it('shows configured label for masked secret fields', () => {
    expect(getFieldDisplayLabel({ configured: true })).toBe('已设置');
    expect(getFieldDisplayLabel({ configured: false })).toBe('未设置');
  });
});

describe('page access messaging', () => {
  it('shows no-access text for non-admin roles', async () => {
    const PlatformConnections = (await import('../PlatformConnections')).default;
    const authModule = await import('../../utils/auth');
    authModule.useAuth = () => ({ user: { role: 'operator' } });

    render(<PlatformConnections />);
    expect(screen.getByText('无权限访问此页面')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the frontend test file to verify it fails**

Run: `cd frontend && npm test -- src/pages/platform-connections/PlatformConnections.test.jsx`

Expected:

```text
FAIL ... Cannot find module './utils'
FAIL ... Cannot find module '../PlatformConnections'
```

- [ ] **Step 3: Add the frontend API client and route/menu wiring**

Update `frontend/src/api/index.js`:

```js
export const platformConnectionApi = {
  list: () => http.get('/platform-connections'),
  get: (platform) => http.get(`/platform-connections/${platform}`),
  update: (platform, data) => http.put(`/platform-connections/${platform}`, data),
  test: (platform) => http.post(`/platform-connections/${platform}/test`),
};
```

Update `frontend/src/App.jsx`:

```jsx
import PlatformConnections from './pages/PlatformConnections';

// inside protected routes
<Route path="platform-connections" element={<PlatformConnections />} />
```

Update `frontend/src/layouts/MainLayout.jsx`:

```jsx
import { ApiOutlined } from '@ant-design/icons';

const pageTitle = {
  // ...
  '/platform-connections': '平台授权',
};

const pageDesc = {
  // ...
  '/platform-connections': '集中维护广告平台授权方式与密钥配置。',
};

const menuItems = [
  { key: '/dashboard', icon: <DashboardOutlined />, label: '数据概览' },
  { key: '/campaigns', icon: <FundOutlined />, label: '广告活动' },
  { key: '/creatives', icon: <PictureOutlined />, label: '素材管理' },
  { key: '/reports', icon: <BarChartOutlined />, label: '数据报表' },
  { key: '/platform-connections', icon: <ApiOutlined />, label: '平台授权' },
  { key: '/users', icon: <TeamOutlined />, label: '用户管理' },
].filter((item) => (item.key === '/platform-connections' || item.key === '/users' ? user?.role === 'admin' : true));
```

- [ ] **Step 4: Create the page helpers and drawer component**

Create `frontend/src/pages/platform-connections/utils.js`:

```js
export function getAuthTypeOptions(authTypes) {
  return authTypes.map((item) => ({
    value: item.key,
    label: item.supported ? item.label : `${item.label}（暂未支持）`,
    disabled: !item.supported
  }));
}

export function getFieldDisplayLabel(field) {
  return field?.configured ? '已设置' : '未设置';
}

export function toFormInitialValues(detail) {
  const values = { auth_type: detail.auth_type };
  Object.entries(detail.fields || {}).forEach(([key, field]) => {
    values[key] = field.value ?? '';
  });
  return values;
}
```

Create `frontend/src/pages/platform-connections/PlatformConnectionDrawer.jsx`:

```jsx
import React from 'react';
import { Alert, Button, Drawer, Form, Input, Select, Space, Typography } from 'antd';
import { getAuthTypeOptions, getFieldDisplayLabel } from './utils';

export default function PlatformConnectionDrawer({
  open,
  loading,
  saving,
  testing,
  detail,
  form,
  onClose,
  onSave,
  onTest,
}) {
  if (!detail) return null;

  return (
    <Drawer
      title={`${detail.platformLabel} 授权配置`}
      open={open}
      width={560}
      onClose={onClose}
      destroyOnClose
      footer={
        <Space style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button onClick={onClose}>取消</Button>
          <Button onClick={onTest} loading={testing}>测试连接</Button>
          <Button type="primary" onClick={onSave} loading={saving}>保存配置</Button>
        </Space>
      }
    >
      <Form form={form} layout="vertical">
        <Form.Item name="auth_type" label="授权方式" rules={[{ required: true, message: '请选择授权方式' }]}>
          <Select options={getAuthTypeOptions(detail.availableAuthTypes)} />
        </Form.Item>

        <Alert type="info" showIcon message="敏感字段不会回显，留空则保留原值" style={{ marginBottom: 16 }} />

        {Object.entries(detail.fields).map(([key, field]) => (
          <Form.Item key={key} name={key} label={field.label || key}>
            <Input
              type={field.secret ? 'password' : 'text'}
              placeholder={field.secret ? `${getFieldDisplayLabel(field)}，如需更换请重新填写` : '请输入'}
            />
          </Form.Item>
        ))}

        <Typography.Text type="secondary">当前状态：{detail.status}</Typography.Text>
      </Form>
    </Drawer>
  );
}
```

- [ ] **Step 5: Create the page composition root and CSS**

Create `frontend/src/pages/PlatformConnections.jsx`:

```jsx
import React, { useEffect, useState } from 'react';
import { Button, Card, Form, Space, Table, Tag, Typography, message } from 'antd';
import { platformConnectionApi } from '../api';
import { useAuth } from '../utils/auth';
import PlatformConnectionDrawer from './platform-connections/PlatformConnectionDrawer';
import { toFormInitialValues } from './platform-connections/utils';

export default function PlatformConnections() {
  const { user } = useAuth();
  if (user?.role !== 'admin') {
    return (
      <div className="page-shell">
        <Card className="page-section-card" bodyStyle={{ padding: 40, textAlign: 'center' }}>
          <Typography.Text type="secondary">无权限访问此页面</Typography.Text>
        </Card>
      </div>
    );
  }

  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detail, setDetail] = useState(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [form] = Form.useForm();

  async function fetchList() {
    setLoading(true);
    try {
      const { data } = await platformConnectionApi.list();
      setData(data);
    } finally {
      setLoading(false);
    }
  }

  async function openDrawer(platform) {
    const { data } = await platformConnectionApi.get(platform);
    setDetail(data);
    form.setFieldsValue(toFormInitialValues(data));
    setDrawerOpen(true);
  }

  async function handleSave() {
    const values = await form.validateFields();
    const { auth_type, ...config } = values;
    setSaving(true);
    try {
      await platformConnectionApi.update(detail.platform, { auth_type, config });
      message.success('配置已保存');
      setDrawerOpen(false);
      fetchList();
    } catch (err) {
      message.error(err.response?.data?.message || '保存失败');
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    try {
      const { data } = await platformConnectionApi.test(detail.platform);
      message[data.ok ? 'success' : 'warning'](data.message);
    } finally {
      setTesting(false);
    }
  }

  useEffect(() => { fetchList(); }, []);

  return (
    <div className="page-shell platform-connections-shell">
      <Card className="page-section-card platform-connections-card">
        <Table
          rowKey="platform"
          dataSource={data}
          loading={loading}
          pagination={false}
          columns={[
            { title: '平台', dataIndex: 'platformLabel' },
            { title: '授权方式', dataIndex: 'authTypeLabel' },
            { title: '状态', dataIndex: 'status', render: (value) => <Tag>{value}</Tag> },
            { title: '更新时间', dataIndex: 'updated_at', render: (value) => value?.slice(0, 16) || '-' },
            {
              title: '操作',
              render: (_, row) => <Button onClick={() => openDrawer(row.platform)}>{row.status === 'unconfigured' ? '配置' : '编辑'}</Button>
            }
          ]}
        />
      </Card>

      <PlatformConnectionDrawer
        open={drawerOpen}
        loading={loading}
        saving={saving}
        testing={testing}
        detail={detail}
        form={form}
        onClose={() => setDrawerOpen(false)}
        onSave={handleSave}
        onTest={handleTest}
      />
    </div>
  );
}
```

Append basic styles to `frontend/src/index.css`:

```css
.platform-connections-shell {
  gap: 20px;
}

.platform-connections-card .ant-card-body {
  padding: 20px;
}

@media (max-width: 768px) {
  .platform-connections-card .ant-card-body {
    padding: 16px;
  }
}
```

Update `frontend/src/pages/Reports.jsx` by replacing the existing route-file setup copy with a single pointer:

```jsx
mockDesc="请前往“平台授权”页面配置该平台凭证；配置完成后这里会自动读取后台已保存的授权信息。"
```

- [ ] **Step 6: Run the targeted frontend test to verify it passes**

Run: `cd frontend && npm test -- src/pages/platform-connections/PlatformConnections.test.jsx`

Expected:

```text
✓ marks unsupported auth types as disabled
✓ shows configured label for masked secret fields
✓ shows no-access text for non-admin roles
```

- [ ] **Step 7: Run the frontend build**

Run: `cd frontend && npm run build`

Expected:

```text
vite build completed successfully
```

- [ ] **Step 8: Commit the frontend module**

```bash
git add frontend/src/api/index.js frontend/src/App.jsx frontend/src/layouts/MainLayout.jsx frontend/src/index.css frontend/src/pages/Reports.jsx frontend/src/pages/PlatformConnections.jsx frontend/src/pages/platform-connections/constants.js frontend/src/pages/platform-connections/utils.js frontend/src/pages/platform-connections/PlatformConnectionDrawer.jsx frontend/src/pages/platform-connections/PlatformConnections.test.jsx
git commit -m "feat: add platform authorization admin page"
```

---

### Task 5: Verify the full platform authorization mainline end-to-end

**Files:**
- Modify: `backend/tests/platformConnections.test.js`
- Modify: `frontend/src/pages/platform-connections/PlatformConnections.test.jsx`
- Test: `backend/package.json`
- Test: `frontend/package.json`
- Test: `docs/superpowers/specs/2026-04-14-platform-authorization-management-design.md`

- [ ] **Step 1: Add one backend regression for the admin list defaults**

Append this test to `backend/tests/platformConnections.test.js`:

```js
test('connection list returns unconfigured defaults for untouched platforms', async () => {
  const res = await request(app)
    .get('/api/platform-connections')
    .set('Authorization', `Bearer ${auth('admin', 1)}`);

  assert.equal(res.status, 200);
  assert.equal(res.body.length, 4);
  assert.equal(res.body.find((item) => item.platform === 'baidu').status, 'unconfigured');
});
```

- [ ] **Step 2: Add one frontend regression for unsupported auth-type labels**

Append this test to `frontend/src/pages/platform-connections/PlatformConnections.test.jsx`:

```jsx
it('appends unavailable copy to unsupported auth types', () => {
  const options = getAuthTypeOptions([{ key: 'oauth2', label: 'OAuth 2.0', supported: false }]);
  expect(options[0].label).toBe('OAuth 2.0（暂未支持）');
  expect(options[0].disabled).toBe(true);
});
```

- [ ] **Step 3: Run the full automated verification**

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

Use this checklist against `docs/superpowers/specs/2026-04-14-platform-authorization-management-design.md`:

```text
[ ] top-level 平台授权 entry exists
[ ] only admin can access and edit
[ ] four current ad platforms are listed
[ ] per-platform auth type is stored in platform_connections
[ ] secrets are not returned to the frontend
[ ] unsupported auth types are visible but unavailable
[ ] current platform routes read saved connections first
[ ] reports page no longer tells users to edit backend route files
[ ] local test endpoint returns structured validation feedback
```

- [ ] **Step 5: Execute manual verification on the running product**

Run the backend and frontend in separate terminals:

```bash
cd backend && npm run dev
cd frontend && npm run dev
```

Then manually verify:

```text
1. Log in as admin and confirm the 平台授权 menu is visible
2. Open Google Ads and save a valid-looking ads_api credential set
3. Re-open the drawer and confirm secrets show as 已设置 instead of plaintext
4. Switch to an unsupported auth type and confirm it cannot be selected for save
5. Click 测试连接 and confirm the local validation result is shown
6. Log in as operator and confirm 平台授权 is absent
7. Visit 报表 and confirm the copy points to 平台授权 instead of route-file edits
```

- [ ] **Step 6: Commit the verification pass**

```bash
git add backend/tests/platformConnections.test.js frontend/src/pages/platform-connections/PlatformConnections.test.jsx
git commit -m "test: verify platform authorization management"
```

---

## Self-Review

### Spec coverage

- admin-only access, dedicated top-level entry, and four-platform list are covered in Task 4 and verified in Task 5
- one-row-per-platform storage, auth type selection, and mask/no-echo secret handling are covered in Tasks 1 and 2
- saved connection precedence over env fallback is covered in Task 3
- unsupported auth types shown but unavailable are covered in Task 4 and verified in Task 5
- local validation-based test endpoint is covered in Task 2 and verified in Task 5
- reports-page copy removal of route-file editing instructions is covered in Task 4 and verified in Task 5

No approved spec requirement is intentionally left without a task.

### Placeholder scan

- No `TODO`, `TBD`, or “similar to above” placeholders remain.
- Every code-changing step includes concrete file paths, code snippets, commands, and expected outcomes.

### Type consistency

- Backend canonical identifiers stay consistent as `platform`, `auth_type`, `config_json`, `status`, and `updated_by`.
- Frontend uses the same route path `/platform-connections` and the same payload shape `{ auth_type, config }`.
- The route-integration helper uses the same platform keys as the admin APIs and frontend page.
