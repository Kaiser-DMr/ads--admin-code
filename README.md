# Ads Admin Console

一个广告投放管理后台示例项目，包含前端管理界面和后端 API。界面基于 React 18、Vite 5、Ant Design 5，后端基于 Express 和 SQLite。

适合用来演示或继续开发以下能力：

- 登录鉴权
- 广告活动管理
- 素材管理
- 报表查看
- 用户与角色管理
- 多平台数据接入占位接口

## 项目结构

```text
ad-admin/
├── frontend/   # React + Vite + Ant Design 管理后台
├── backend/    # Express + SQLite API 服务
├── .gitignore
└── README.md
```

### 前端页面

前端路由定义见 `frontend/src/App.jsx:22`，当前主要页面包括：

- `Login` 登录页
- `Dashboard` 仪表盘
- `Campaigns` 活动管理
- `Creatives` 素材管理
- `Reports` 报表中心
- `Users` 用户管理

### 后端接口

后端服务入口见 `backend/server.js:1`，当前挂载的主要路由包括：

- `/api/auth`
- `/api/campaigns`
- `/api/creatives`
- `/api/reports`
- `/api/users`

数据库初始化与种子数据见 `backend/db.js:1`。

## 技术栈

### Frontend

- React 18
- React Router 6
- Vite 5
- Ant Design 5
- Axios
- @ant-design/charts

### Backend

- Node.js
- Express
- SQLite (`node:sqlite`)
- JWT
- bcryptjs
- CORS

## 本地开发

### 1. 安装依赖

分别安装前后端依赖：

```bash
cd frontend && npm install
cd ../backend && npm install
```

### 2. 启动后端

后端默认端口为 `3002`，脚本定义见 `backend/package.json:5`。

```bash
cd backend
npm run dev
```

### 3. 启动前端

前端开发服务默认端口为 `5173`，并通过 Vite 代理把 `/api` 转发到 `http://localhost:3002`，配置见 `frontend/vite.config.js:4`。

```bash
cd frontend
npm run dev
```

启动后访问：

- Frontend: `http://localhost:5173`
- Backend health check: `http://localhost:3002/api/health`

## 默认账号

项目会在首次启动数据库时自动写入默认账号，逻辑见 `backend/db.js:67`。

可直接使用：

- `admin / admin123`
- `operator1 / op123`
- `viewer1 / view123`

登录页也展示了其中一部分默认凭据，见 `frontend/src/pages/Login.jsx:66`。

## API 调用方式

前端统一通过 `/api` 访问后端，HTTP 客户端定义见 `frontend/src/api/http.js:1`，接口封装见 `frontend/src/api/index.js:1`。

这意味着本地开发时只需要同时启动：

- 后端 `3002`
- 前端 `5173`

## 构建

前端生产构建：

```bash
cd frontend
npm run build
```

## GitHub 仓库页面结构检查

你这个仓库现在在 GitHub 上的页面结构已经具备基本展示条件：

- 根目录清楚分成 `frontend/` 和 `backend/`
- README 现在会承担首页说明作用
- 已有可直接运行的本地开发说明
- 已说明默认账号和主要模块

目前最明显的可见问题是：

- `.gitignore` 还比较简单
- 仓库首页还没有截图
- 还没有部署说明和 License

## 下一步建议

如果你准备继续把这个仓库当作品集或正式项目展示，建议下一步优先做这些：

1. 给 README 加首页截图
2. 完善 `.gitignore`
3. 增加环境变量说明
4. 增加部署文档
5. 补充 License
