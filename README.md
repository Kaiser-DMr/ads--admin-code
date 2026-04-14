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
