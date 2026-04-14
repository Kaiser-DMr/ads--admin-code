# Release Readiness Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve release readiness by lazy-loading major frontend routes, adding a shared route fallback, applying conservative frontend bundle splitting only if still justified after a fresh build, and upgrading repository documentation for onboarding and deployment.

**Architecture:** Keep the current auth and route structure intact, but convert major page imports in `frontend/src/App.jsx` to `React.lazy` and wrap route elements with a shared `Suspense` fallback component. Preserve behavior inside each page, then use the fresh build output to decide whether a minimal `manualChunks` split is still needed. Finish by rewriting `README.md` so the repository accurately describes the current modules, platform authorization capability, local development flow, and deployment expectations.

**Tech Stack:** React 18, React Router 6, Vite 5, Vitest, React Testing Library, Ant Design 5, plain CSS, Markdown

---

## File Structure

### Existing files to modify

- `frontend/src/App.jsx`
  - Convert protected page routes to lazy imports and wrap route elements in `Suspense`.
- `frontend/src/index.css`
  - Add the shared route-fallback presentation styles.
- `frontend/vite.config.js`
  - Add conservative `manualChunks` only if the fresh build still leaves a materially oversized vendor bundle.
- `README.md`
  - Rewrite the landing documentation to reflect the current feature surface and deployment expectations.

### New files to create

- `frontend/src/components/PageRouteFallback.jsx`
  - Shared loading fallback shown while lazy route modules are being fetched.
- `frontend/src/App.test.jsx`
  - Focused route-level tests for auth redirect, lazy route fallback visibility, and successful lazy page rendering.

### Existing files to reference during implementation

- `frontend/src/utils/auth.jsx`
  - Current auth state source used by `PrivateRoute`.
- `frontend/src/layouts/MainLayout.jsx`
  - Existing protected layout shell that should remain behaviorally unchanged.
- `docs/superpowers/specs/2026-04-14-release-readiness-optimization-design.md`
  - Approved design spec for this plan.

---

### Task 1: Add route-loading regression tests

**Files:**
- Create: `frontend/src/App.test.jsx`
- Reference: `frontend/src/App.jsx`
- Reference: `frontend/src/utils/auth.jsx`

- [ ] **Step 1: Write the failing route-loading tests**

Create `frontend/src/App.test.jsx`:

```jsx
// @vitest-environment jsdom
import React from 'react';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

function deferredModule(label) {
  let resolve;
  const promise = new Promise((nextResolve) => {
    resolve = () => nextResolve({ default: () => <div>{label}</div> });
  });
  return { promise, resolve };
}

beforeAll(() => {
  if (!window.matchMedia) {
    window.matchMedia = vi.fn().mockImplementation((query) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  }
});

beforeEach(() => {
  localStorage.clear();
  vi.resetModules();
  vi.unmock('./pages/Dashboard');
  vi.unmock('./pages/Campaigns');
  vi.unmock('./pages/Creatives');
  vi.unmock('./pages/Reports');
  vi.unmock('./pages/Users');
  vi.unmock('./pages/PlatformConnections');
});

describe('App route loading', () => {
  it('redirects guests to the login page', async () => {
    window.history.pushState({}, '', '/reports');
    const { default: App } = await import('./App');
    render(<App />);
    expect(await screen.findByText('欢迎回来')).toBeInTheDocument();
  });

  it('shows the shared fallback before a lazy route resolves', async () => {
    localStorage.setItem('token', 'test-token');
    localStorage.setItem('user', JSON.stringify({ username: 'admin', role: 'admin' }));
    window.history.pushState({}, '', '/reports');

    const reportsModule = deferredModule('reports-page-loaded');
    vi.doMock('./pages/Reports', () => reportsModule.promise);
    vi.doMock('./pages/Dashboard', () => Promise.resolve({ default: () => <div>dashboard-page</div> }));
    vi.doMock('./pages/Campaigns', () => Promise.resolve({ default: () => <div>campaigns-page</div> }));
    vi.doMock('./pages/Creatives', () => Promise.resolve({ default: () => <div>creatives-page</div> }));
    vi.doMock('./pages/Users', () => Promise.resolve({ default: () => <div>users-page</div> }));
    vi.doMock('./pages/PlatformConnections', () => Promise.resolve({ default: () => <div>platform-connections-page</div> }));

    const { default: App } = await import('./App');
    render(<App />);

    expect(screen.getByText('正在加载页面')).toBeInTheDocument();

    reportsModule.resolve();

    expect(await screen.findByText('reports-page-loaded')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run the frontend test file to verify it fails**

Run: `cd frontend && npm test -- --run src/App.test.jsx`

Expected:

```text
FAIL  src/App.test.jsx
Unable to find an element with the text: 正在加载页面
```

- [ ] **Step 3: Commit the failing test scaffold**

```bash
git add frontend/src/App.test.jsx
git commit -m "test: cover lazy route loading behavior"
```

---

### Task 2: Implement shared route fallback and lazy route loading

**Files:**
- Create: `frontend/src/components/PageRouteFallback.jsx`
- Modify: `frontend/src/App.jsx`
- Modify: `frontend/src/index.css`
- Test: `frontend/src/App.test.jsx`

- [ ] **Step 1: Create the shared route fallback component**

Create `frontend/src/components/PageRouteFallback.jsx`:

```jsx
import React from 'react';
import { Card, Spin, Typography } from 'antd';

export default function PageRouteFallback() {
  return (
    <div className="page-shell page-route-fallback-shell">
      <Card className="page-section-card page-route-fallback-card" bodyStyle={{ padding: 40, textAlign: 'center' }}>
        <Spin size="large" />
        <Typography.Title level={4} className="page-route-fallback-title">
          正在加载页面
        </Typography.Title>
        <Typography.Text type="secondary">
          正在准备当前模块，请稍候。
        </Typography.Text>
      </Card>
    </div>
  );
}
```

- [ ] **Step 2: Convert major protected routes to lazy imports**

Update `frontend/src/App.jsx`:

```jsx
import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './utils/auth';
import MainLayout from './layouts/MainLayout';
import Login from './pages/Login';
import PageRouteFallback from './components/PageRouteFallback';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const Campaigns = lazy(() => import('./pages/Campaigns'));
const Creatives = lazy(() => import('./pages/Creatives'));
const Reports = lazy(() => import('./pages/Reports'));
const Users = lazy(() => import('./pages/Users'));
const PlatformConnections = lazy(() => import('./pages/PlatformConnections'));

function PrivateRoute({ children }) {
  const { user } = useAuth();
  return user ? children : <Navigate to="/login" replace />;
}

function withRouteFallback(element) {
  return <Suspense fallback={<PageRouteFallback />}>{element}</Suspense>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<PrivateRoute><MainLayout /></PrivateRoute>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={withRouteFallback(<Dashboard />)} />
            <Route path="campaigns" element={withRouteFallback(<Campaigns />)} />
            <Route path="creatives" element={withRouteFallback(<Creatives />)} />
            <Route path="reports" element={withRouteFallback(<Reports />)} />
            <Route path="platform-connections" element={withRouteFallback(<PlatformConnections />)} />
            <Route path="users" element={withRouteFallback(<Users />)} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
```

- [ ] **Step 3: Add route-fallback styles**

Append these styles to `frontend/src/index.css` near the shared page-shell/card rules:

```css
.page-route-fallback-shell {
  min-height: 240px;
}

.page-route-fallback-card {
  max-width: 520px;
  margin: 0 auto;
}

.page-route-fallback-title {
  margin: 18px 0 8px !important;
}
```

- [ ] **Step 4: Run the route-loading test to verify it passes**

Run: `cd frontend && npm test -- --run src/App.test.jsx`

Expected:

```text
PASS  src/App.test.jsx
2 passed
```

- [ ] **Step 5: Commit the lazy-route implementation**

```bash
git add frontend/src/App.jsx frontend/src/components/PageRouteFallback.jsx frontend/src/index.css frontend/src/App.test.jsx
git commit -m "feat: lazy load major frontend routes"
```

---

### Task 3: Apply conservative bundler splitting only if the fresh build still needs it

**Files:**
- Modify: `frontend/vite.config.js`
- Verification: `frontend` production build output

- [ ] **Step 1: Run a fresh production build after the lazy-route change**

Run: `cd frontend && npm run build`

Expected baseline:

```text
vite build
...built in ...
```

If there is no chunk-size warning after the lazy route split, skip to Step 4 and keep the config unchanged.

- [ ] **Step 2: If the build still warns on a large vendor chunk, add a conservative manual split**

Update `frontend/vite.config.js` to:

```js
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:3002',
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          'antd-vendor': ['antd', '@ant-design/icons'],
        },
      },
    },
  },
});
```

- [ ] **Step 3: Re-run the build to verify the split behaves correctly**

Run: `cd frontend && npm run build`

Expected:

```text
dist/assets/react-vendor-*.js
dist/assets/antd-vendor-*.js
✓ built in ...
```

- [ ] **Step 4: Commit the bundler adjustment if and only if Step 2 changed the config**

```bash
git add frontend/vite.config.js
git commit -m "build: split frontend vendor bundles"
```

If Step 2 was skipped, do not create this commit.

---

### Task 4: Rewrite README and run final frontend verification

**Files:**
- Modify: `README.md`
- Verification: `frontend/src/App.test.jsx`, existing frontend test files, `frontend` production build

- [ ] **Step 1: Replace the README with release-ready project documentation**

Rewrite `README.md` to include this content:

```md
# Ads Admin Console

一个面向广告投放运营场景的管理后台示例项目，包含 React + Vite 前端控制台和 Express + SQLite 后端 API。当前版本已经覆盖登录鉴权、广告活动管理、素材管理、数据报表、用户权限管理，以及平台授权配置。

## 当前能力

- 登录鉴权与角色区分
- 广告活动管理与审批主线
- 素材管理
- 数据报表与多平台占位数据接入
- 用户与角色管理
- 平台授权配置（管理员）

## 项目结构

```text
ad-admin/
├── frontend/   # React 18 + Vite 5 + Ant Design 5
├── backend/    # Express + SQLite API
├── docs/       # Specs / plans
├── README.md
└── .gitignore
```

## 技术栈

### Frontend

- React 18
- React Router 6
- Vite 5
- Ant Design 5
- Axios
- Vitest + Testing Library

### Backend

- Node.js
- Express
- SQLite (`node:sqlite`)
- JWT
- bcryptjs

## 主要模块

### 1. 投放管理

- 活动创建、编辑、筛选、批量操作
- 审批与状态流转主线
- 预算与投放状态展示

### 2. 数据报表

- 全平台趋势
- 活动维度与平台维度分析
- 百度、快手、巨量、Google Ads 的占位报表接口

### 3. 平台授权

- 新增管理员可见的 `平台授权` 页面
- 支持为百度、快手、巨量、Google Ads 维护授权参数
- 后端平台路由优先读取已保存配置，再回退到环境变量
- 敏感字段保存后不再明文回显

## 本地开发

### 安装依赖

```bash
cd frontend && npm install
cd ../backend && npm install
```

### 启动后端

```bash
cd backend
npm run dev
```

默认端口：`3002`

### 启动前端

```bash
cd frontend
npm run dev
```

默认端口：`5173`

前端通过 Vite 代理把 `/api` 转发到 `http://localhost:3002`。

## 默认账号

- `admin / admin123`
- `operator1 / op123`
- `viewer1 / view123`

## 构建与验证

### 前端测试

```bash
cd frontend
npm test
```

### 前端构建

```bash
cd frontend
npm run build
```

### 后端测试

```bash
cd backend
npm test
```

## 部署说明

### 前端

- 通过 `cd frontend && npm run build` 生成静态资源
- 将 `frontend/dist/` 部署到任意静态文件托管环境

### 后端

- 以 Node 服务方式运行 `backend/server.js`
- 默认监听端口为 `3002`
- 生产环境建议通过反向代理统一转发 `/api`

### 数据与配置

- 默认数据库文件位于 `backend/ad_admin.db`
- 也可通过 `AD_ADMIN_DB_PATH` 指定数据库位置
- 平台授权配置保存在数据库的 `platform_connections` 表中

## 仓库说明

- `docs/superpowers/specs/` 保存设计文档
- `docs/superpowers/plans/` 保存实现计划
- 构建产物与本地数据库文件默认不纳入版本控制
```

- [ ] **Step 2: Run the full frontend verification suite**

Run: `cd frontend && npm test`

Expected:

```text
Test Files  ... passed
Tests  ... passed
```

- [ ] **Step 3: Run the production build one more time**

Run: `cd frontend && npm run build`

Expected:

```text
✓ built in ...
```

- [ ] **Step 4: Commit the documentation and final verification pass**

If `frontend/vite.config.js` was changed in Task 3, include it in this final commit only if it has not already been committed in Task 3.

```bash
git add README.md frontend/src/App.jsx frontend/src/components/PageRouteFallback.jsx frontend/src/index.css frontend/src/App.test.jsx frontend/vite.config.js
git commit -m "docs: improve release readiness guidance"
```

If Task 3 already produced a separate build-config commit, omit `frontend/vite.config.js` from this final commit.

---

## Self-Review

### Spec coverage

- Route-level lazy loading is covered in Task 2.
- Shared loading fallback is covered in Task 2.
- Conditional conservative bundler splitting is covered in Task 3.
- README upgrade is covered in Task 4.
- Fresh frontend verification is covered in Tasks 2, 3, and 4.

### Placeholder scan

- No `TODO`, `TBD`, or “implement later” markers remain.
- All code-changing steps include concrete snippets.
- All verification steps include explicit commands and expected outcomes.

### Type consistency

- `PageRouteFallback` is named consistently across the test, route tree, and component file.
- Route paths match the current app structure.
- The build config change is isolated to `frontend/vite.config.js`.
