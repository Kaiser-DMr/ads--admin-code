# Admin UI Stabilization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stabilize the admin console layout so the sidebar, header, content scroll, alignment, and collapse behavior feel consistent across all pages without changing business logic.

**Architecture:** Keep the current route and page structure, but move layout responsibility into `MainLayout.jsx` and the global rules in `frontend/src/index.css`. Then normalize page-level wrappers in each route component so all secondary pages share the same shell, toolbar, and section spacing, while preserving existing tables, charts, and modal logic.

**Tech Stack:** React 18, React Router 6, Ant Design 5, Vite 5, plain CSS in `frontend/src/index.css`

---

## File Structure

### Existing files to modify

- `frontend/src/layouts/MainLayout.jsx`
  - Owns the app shell: sidebar, global header, content container, collapse state.
  - Will be updated so the right side becomes a stable scroll container and the sidebar/header responsibilities are explicit.

- `frontend/src/index.css`
  - Owns the global console design system and layout rules.
  - Will absorb the final stable rules for sidebar sizing, scroll boundaries, shared alignment, spacing, and page shell standards.

- `frontend/src/pages/Dashboard.jsx`
  - Already has a special hero-style page.
  - Will be aligned to the shared shell without changing its data or card content.

- `frontend/src/pages/Campaigns.jsx`
  - Secondary page with toolbar + table + modal.
  - Will be normalized against the shared layout rules and checked for alignment consistency.

- `frontend/src/pages/Creatives.jsx`
  - Secondary page with toolbar + table + modals.
  - Will be normalized to the shared shell and spacing rules.

- `frontend/src/pages/Reports.jsx`
  - Secondary page with hero card, cards, tabs, tables.
  - Will be aligned to the shared shell and content spacing rules while keeping the existing reporting content.

- `frontend/src/pages/Users.jsx`
  - Secondary page with toolbar + table + modal.
  - Will be normalized to the shared shell and spacing rules.

### Existing files used for verification/context

- `frontend/src/App.jsx`
  - Confirms route structure and the current `MainLayout` ownership.

- `frontend/package.json`
  - Provides build command for verification.

No new runtime source files are required for this plan.

---

### Task 1: Lock the app shell scroll model

**Files:**
- Modify: `frontend/src/layouts/MainLayout.jsx`
- Modify: `frontend/src/index.css`
- Test: `frontend/package.json`

- [ ] **Step 1: Add a layout smoke test checklist in the plan notes**

Use this manual checklist while implementing the shell changes:

```text
Pages to verify:
- /dashboard
- /campaigns
- /creatives
- /reports
- /users

Behaviors to verify:
- sidebar remains visually fixed
- right content area scrolls independently
- header and content share the same left start line
- no extra browser-level horizontal scroll
- collapse/expand does not shift content padding unpredictably
```

- [ ] **Step 2: Update `MainLayout.jsx` so the shell explicitly separates fixed shell chrome from scrollable page content**

Replace the layout return block with this structure so the content wrapper is explicit and easier to style predictably:

```jsx
return (
  <Layout className="console-layout">
    <Sider
      collapsed={collapsed}
      trigger={null}
      width={268}
      collapsedWidth={104}
      className="console-sider"
    >
      <div className={`console-sider-shell ${collapsed ? 'is-collapsed' : ''}`}>
        <div className={`console-sider-top ${collapsed ? 'is-collapsed' : ''}`}>
          <Button
            type="text"
            shape="circle"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(v => !v)}
            className="console-sider-toggle"
          />
          <div className={`console-brand ${collapsed ? 'is-collapsed' : ''}`}>
            <img src={claudeIcon} alt="Claude" className="console-brand-icon" />
            {!collapsed && (
              <div className="console-brand-copy">
                <Typography.Text strong className="console-brand-title">Claude Ads</Typography.Text>
                <Typography.Text type="secondary" className="console-brand-subtitle">Tesla-inspired console</Typography.Text>
              </div>
            )}
          </div>
        </div>

        <div className="console-menu-wrap">
          <Menu
            mode="inline"
            selectedKeys={[location.pathname]}
            items={menuItems}
            onClick={({ key }) => navigate(key)}
            inlineCollapsed={collapsed}
            className="console-menu"
          />
        </div>

        <div className={`console-user-card ${collapsed ? 'is-collapsed' : ''}`}>
          <Avatar src={claudeIcon} size={collapsed ? 40 : 44} className="console-user-avatar" />
          {!collapsed && (
            <div className="console-user-copy">
              <Typography.Text strong className="console-user-name">{user?.username}</Typography.Text>
              <Tag color={roleColor[user?.role]} className="console-user-tag">{roleLabel[user?.role]}</Tag>
            </div>
          )}
        </div>
      </div>
    </Sider>

    <Layout className="console-main">
      <div className="console-main-scroll">
        <Header className="console-header">
          <div>
            <Typography.Text type="secondary" className="console-kicker">
              Claude Ads Console
            </Typography.Text>
            <Typography.Title level={2} className="console-title">
              {currentTitle}
            </Typography.Title>
            <Typography.Text type="secondary" className="console-description">
              {currentDesc}
            </Typography.Text>
          </div>
          <Dropdown menu={userMenu} placement="bottomRight">
            <div className="console-header-user">
              <Avatar src={claudeIcon} style={{ background: '#2f6bff' }} />
              <div>
                <Typography.Text strong style={{ display: 'block', lineHeight: 1.2 }}>{user?.username}</Typography.Text>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>{roleLabel[user?.role]}</Typography.Text>
              </div>
            </div>
          </Dropdown>
        </Header>

        <Content className="console-content">
          <Outlet />
        </Content>
      </div>
    </Layout>
  </Layout>
);
```

- [ ] **Step 3: Add the minimal CSS needed to make the right side the only main scroll container**

In `frontend/src/index.css`, update the shell rules to this shape:

```css
html, body, #root {
  height: 100%;
}

body {
  overflow: hidden;
  font-family: Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background:
    radial-gradient(circle at top left, rgba(47, 107, 255, 0.08), transparent 28%),
    linear-gradient(180deg, #fbfcfe 0%, #f5f7fb 100%);
  color: #111827;
}

.console-layout {
  height: 100vh;
  overflow: hidden;
  background: transparent;
}

.console-main {
  min-width: 0;
  height: 100vh;
  padding: 20px 24px 24px 0;
  background: transparent;
}

.console-main-scroll {
  height: 100%;
  overflow-y: auto;
  overflow-x: hidden;
  padding-right: 4px;
}

.console-content {
  min-height: 280px;
  padding-inline: 24px;
  padding-bottom: 8px;
}
```

- [ ] **Step 4: Make the sidebar fixed relative to the app shell instead of page scroll**

Still in `frontend/src/index.css`, replace the sidebar block with:

```css
.console-sider {
  position: relative !important;
  top: 0;
  height: 100vh;
  overflow: hidden;
  background: rgba(245, 247, 251, 0.92) !important;
  padding: 20px 0 20px 20px;
}

.console-sider-shell {
  height: calc(100vh - 40px);
  overflow: hidden;
  border-radius: 32px;
  background: rgba(255,255,255,0.8);
  border: 1px solid rgba(229,231,235,0.84);
  box-shadow: 0 20px 40px rgba(15,23,42,0.04);
  padding: 18px 16px;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: 18px;
}

.console-menu-wrap {
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
}
```

- [ ] **Step 5: Run the frontend build to verify shell changes compile**

Run:

```bash
cd "/Users/k/Claude text/ad-admin/frontend" && npm run build
```

Expected:

```text
vite build
...
✓ built in <time>
```

- [ ] **Step 6: Commit the shell scroll-model change**

```bash
git add \
  "/Users/k/Claude text/ad-admin/frontend/src/layouts/MainLayout.jsx" \
  "/Users/k/Claude text/ad-admin/frontend/src/index.css"
git commit -m "refactor: stabilize admin shell scroll behavior"
```

---

### Task 2: Stabilize sidebar collapse alignment

**Files:**
- Modify: `frontend/src/index.css`
- Modify: `frontend/src/layouts/MainLayout.jsx`
- Test: `frontend/package.json`

- [ ] **Step 1: Add a collapse-state verification checklist**

```text
Verify in both expanded and collapsed modes:
- toggle button stays centered/aligned in collapsed mode
- brand icon does not overlap the toggle
- first menu item does not jump upward
- bottom user avatar stays centered
- content width changes smoothly without changing content left padding
```

- [ ] **Step 2: Normalize collapsed-state alignment CSS**

Update the relevant collapsed-state rules in `frontend/src/index.css` to:

```css
.console-sider-shell.is-collapsed {
  padding-inline: 12px;
}

.console-sider-top {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 12px;
}

.console-sider-top.is-collapsed {
  align-items: center;
}

.console-sider-toggle {
  align-self: flex-end;
  width: 40px;
  height: 40px;
}

.console-sider-top.is-collapsed .console-sider-toggle {
  align-self: center;
}

.console-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  min-width: 0;
  overflow: hidden;
}

.console-brand.is-collapsed {
  justify-content: center;
}

.console-user-card.is-collapsed {
  justify-content: center;
  padding: 12px 8px;
}
```

- [ ] **Step 3: Ensure the collapsed Sider widths remain owned by Ant + CSS only**

Keep the existing `Sider` configuration in `MainLayout.jsx` exactly as:

```jsx
<Sider
  collapsed={collapsed}
  trigger={null}
  width={268}
  collapsedWidth={104}
  className="console-sider"
>
```

Do not add any route-specific width logic or JS-based offset adjustments.

- [ ] **Step 4: Build the frontend after the collapse-state CSS cleanup**

Run:

```bash
cd "/Users/k/Claude text/ad-admin/frontend" && npm run build
```

Expected:

```text
vite build
...
✓ built in <time>
```

- [ ] **Step 5: Commit the collapse-state stabilization**

```bash
git add \
  "/Users/k/Claude text/ad-admin/frontend/src/index.css" \
  "/Users/k/Claude text/ad-admin/frontend/src/layouts/MainLayout.jsx"
git commit -m "fix: stabilize collapsed sidebar alignment"
```

---

### Task 3: Establish one global alignment baseline

**Files:**
- Modify: `frontend/src/index.css`
- Modify: `frontend/src/layouts/MainLayout.jsx`
- Modify: `frontend/src/pages/Campaigns.jsx`
- Modify: `frontend/src/pages/Creatives.jsx`
- Modify: `frontend/src/pages/Users.jsx`
- Test: `frontend/package.json`

- [ ] **Step 1: Define the shared page shell spacing rules in global CSS**

In `frontend/src/index.css`, make the page wrapper rules read:

```css
.console-header {
  margin-bottom: 20px;
  padding: 18px 24px;
  border-radius: 28px;
  border: 1px solid rgba(229,231,235,0.8);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 20px;
  background: rgba(255,255,255,0.72);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}

.page-shell {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.page-toolbar {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 16px;
  flex-wrap: wrap;
}

.page-section-card {
  border-radius: 28px;
}
```

- [ ] **Step 2: Keep `Campaigns.jsx` as the reference secondary-page structure**

Ensure the top of the page body remains:

```jsx
return (
  <div className="page-shell">
    {canEdit && (
      <div className="page-toolbar">
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新建活动</Button>
      </div>
    )}
    <Card className="page-section-card">
```

This file becomes the baseline pattern for a secondary page with actions.

- [ ] **Step 3: Normalize `Creatives.jsx` to the same toolbar-first pattern**

Ensure the page body starts with:

```jsx
return (
  <div className="page-shell">
    {canEdit && (
      <div className="page-toolbar">
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setCreateOpen(true); }}>
          上传素材
        </Button>
      </div>
    )}
    <Card className="page-section-card">
```

- [ ] **Step 4: Normalize `Users.jsx` to the same toolbar-first pattern**

Ensure the page body starts with:

```jsx
return (
  <div className="page-shell">
    <div className="page-toolbar">
      <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>新建用户</Button>
    </div>
    <Card className="page-section-card">
```

- [ ] **Step 5: Build the frontend and visually compare left-edge alignment across secondary pages**

Run:

```bash
cd "/Users/k/Claude text/ad-admin/frontend" && npm run build
```

Manual compare after refreshing the app:

```text
Check that these line up on the same left edge:
- global header title block
- Campaigns toolbar button
- Creatives toolbar button
- Users toolbar button
- first card/table edge on each page
```

Expected build output:

```text
vite build
...
✓ built in <time>
```

- [ ] **Step 6: Commit the shared alignment baseline**

```bash
git add \
  "/Users/k/Claude text/ad-admin/frontend/src/index.css" \
  "/Users/k/Claude text/ad-admin/frontend/src/pages/Campaigns.jsx" \
  "/Users/k/Claude text/ad-admin/frontend/src/pages/Creatives.jsx" \
  "/Users/k/Claude text/ad-admin/frontend/src/pages/Users.jsx"
git commit -m "style: unify admin page alignment baseline"
```

---

### Task 4: Normalize Dashboard and Reports within the shared shell

**Files:**
- Modify: `frontend/src/pages/Dashboard.jsx`
- Modify: `frontend/src/pages/Reports.jsx`
- Modify: `frontend/src/index.css`
- Test: `frontend/package.json`

- [ ] **Step 1: Define the shared spacing expectation for special pages**

Use this rule while editing:

```text
Dashboard and Reports may keep hero cards,
but they must still:
- start inside .page-shell
- respect the same left edge as other pages
- use the same vertical gap rhythm as secondary pages
```

- [ ] **Step 2: Keep `Dashboard.jsx` inside the shared shell rhythm**

Ensure the root wrapper remains a simple vertical shell:

```jsx
return (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
```

Then replace that wrapper with:

```jsx
return (
  <div className="page-shell dashboard-shell">
```

This keeps Dashboard special while still opting into the shared shell system.

- [ ] **Step 3: Add a dashboard-specific CSS hook instead of inline shell spacing**

In `frontend/src/index.css`, add:

```css
.dashboard-shell {
  gap: 20px;
}
```

- [ ] **Step 4: Keep `Reports.jsx` on the shared shell while preserving its hero card**

Ensure the root wrapper remains:

```jsx
return (
  <div className="page-shell">
```

No page-title block should be reintroduced. The first `Card` stays the hero/reporting overview card, followed by the trend card and tabs.

- [ ] **Step 5: Build the frontend and verify special pages still align with the shell**

Run:

```bash
cd "/Users/k/Claude text/ad-admin/frontend" && npm run build
```

Manual verify:

```text
- Dashboard hero card aligns with the global content start line
- Reports hero card aligns with the same start line
- vertical rhythm between cards matches the rest of the app
```

Expected:

```text
vite build
...
✓ built in <time>
```

- [ ] **Step 6: Commit the special-page normalization**

```bash
git add \
  "/Users/k/Claude text/ad-admin/frontend/src/pages/Dashboard.jsx" \
  "/Users/k/Claude text/ad-admin/frontend/src/pages/Reports.jsx" \
  "/Users/k/Claude text/ad-admin/frontend/src/index.css"
git commit -m "style: align dashboard and reports with shell layout"
```

---

### Task 5: Remove leftover per-page layout patches and finish responsive cleanup

**Files:**
- Modify: `frontend/src/index.css`
- Modify: `frontend/src/pages/Reports.jsx`
- Modify: `frontend/src/pages/Dashboard.jsx`
- Modify: `frontend/src/pages/Campaigns.jsx`
- Modify: `frontend/src/pages/Creatives.jsx`
- Modify: `frontend/src/pages/Users.jsx`
- Test: `frontend/package.json`

- [ ] **Step 1: Search for remaining layout patch signals before editing**

Run this search and review the matches:

```bash
cd "/Users/k/Claude text/ad-admin/frontend" && grep -R "paddingTop\|marginBottom\|padding: 40\|textAlign: 'center'\|display: 'flex', flexDirection: 'column', gap" src/pages src/layouts src/index.css
```

Expected:

```text
A short list of inline layout declarations that may still be needed or should be moved to shared CSS.
```

- [ ] **Step 2: Keep only intentional inline layout styles in special content blocks**

When cleaning page files, preserve inline styles that are part of the card/chart design, such as:

```jsx
<Card bodyStyle={{ padding: 32 }} style={{ borderRadius: 32, overflow: 'hidden', background: 'linear-gradient(135deg, #fff 0%, #f7faff 52%, #eef4ff 100%)' }}>
```

But avoid inline styles whose only job is shell spacing if a global class can own them.

- [ ] **Step 3: Tighten responsive shell rules in `index.css`**

Replace the responsive shell block with:

```css
@media (max-width: 1100px) {
  .console-main {
    padding-right: 16px;
  }

  .console-content {
    padding-inline: 20px;
  }

  .console-header {
    padding: 18px 20px;
  }
}

@media (max-width: 768px) {
  .console-main {
    padding: 16px 16px 20px 0;
  }

  .console-content {
    padding-inline: 16px;
  }

  .console-header {
    padding: 16px;
    border-radius: 24px;
  }

  .page-toolbar {
    justify-content: stretch;
  }

  .page-toolbar > * {
    width: 100%;
  }
}
```

- [ ] **Step 4: Run the final build verification for the UI stabilization pass**

Run:

```bash
cd "/Users/k/Claude text/ad-admin/frontend" && npm run build
```

Expected:

```text
vite build
...
✓ built in <time>
```

- [ ] **Step 5: Perform the final manual QA pass**

Use this checklist in the browser:

```text
Expanded sidebar:
- sidebar does not move while content scrolls
- header, toolbar, and cards align

Collapsed sidebar:
- toggle/brand/menu/user avatar stay centered
- no overlap in the top stack

Secondary pages:
- campaigns, creatives, users all share the same toolbar/card rhythm

Special pages:
- dashboard and reports still feel premium but obey the same grid

Responsive:
- medium/narrow widths do not create broken padding or clipped content
```

- [ ] **Step 6: Commit the responsive cleanup and final polish**

```bash
git add \
  "/Users/k/Claude text/ad-admin/frontend/src/index.css" \
  "/Users/k/Claude text/ad-admin/frontend/src/pages/Dashboard.jsx" \
  "/Users/k/Claude text/ad-admin/frontend/src/pages/Campaigns.jsx" \
  "/Users/k/Claude text/ad-admin/frontend/src/pages/Creatives.jsx" \
  "/Users/k/Claude text/ad-admin/frontend/src/pages/Reports.jsx" \
  "/Users/k/Claude text/ad-admin/frontend/src/pages/Users.jsx"
git commit -m "style: finish admin ui stabilization pass"
```

---

## Self-Review

### Spec coverage

- Unified layout rules: covered in Tasks 1, 3, 4, 5
- Fixed sidebar behavior: covered in Tasks 1 and 2
- Content scroll boundaries: covered in Task 1
- Alignment consistency: covered in Tasks 3 and 4
- Collapse-state stability: covered in Task 2
- Global CSS cleanup: covered in Tasks 3 and 5
- No business logic changes: preserved throughout tasks; page logic is not rewritten

### Placeholder scan

- No `TODO`, `TBD`, or deferred implementation placeholders remain
- Every code-changing step includes exact code or exact target structure
- Every verification step includes an exact command and expected result

### Type consistency

- Shared class names are consistent across tasks: `console-main-scroll`, `page-shell`, `page-toolbar`, `page-section-card`, `dashboard-shell`
- The React shell still relies on the existing `collapsed` state, `menuItems`, `currentTitle`, and `currentDesc`
- No new runtime APIs or renamed props are introduced
