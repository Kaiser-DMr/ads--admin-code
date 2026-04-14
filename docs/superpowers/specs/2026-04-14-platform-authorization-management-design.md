# Platform Authorization Management Design

## Background

The project already exposes platform-specific integration routes for Baidu, Kuaishou, Jliang, and Google. Today those routes still depend on credentials being edited directly in route files or passed through environment variables. The current reporting UI even instructs operators to change backend code to make real platform APIs work.

This is operationally fragile for two reasons:

- credential changes require code edits and redeploy-style behavior
- the system has no dedicated place to manage platform access as a product capability

The next step is to introduce a first-class admin workflow for platform authorization management so future platform integrations do not require editing backend route files.

## Product Goal

Create a dedicated `平台授权` management area where admins can configure credentials for supported ad platforms from the product UI, while shaping the backend data model so future authorization methods can be added without redesigning the whole module.

The first version should solve the current four platforms and current credential types, but the architecture should explicitly support future methods such as OAuth and other platform-specific authorization flows.

## Success Criteria

This phase is successful when:

- there is a dedicated top-level entry for platform authorization management
- admins can configure credentials for Baidu, Kuaishou, Jliang, and Google without editing backend files
- platform credentials are stored in application data instead of being managed only in route code
- only admins can view and edit credential details
- non-admin users do not see plaintext credential values
- supported authorization methods can be saved and used by platform routes
- unsupported future authorization methods can already be shown in the UI as unavailable options
- the data model can support additional authorization methods without replacing the module

## Scope

### In Scope

- new top-level `平台授权` page
- platform connection summary list for the four current ad platforms
- admin-only credential view and edit permissions
- one active saved configuration per platform in phase one
- backend storage for platform credentials
- dynamic form rendering by authorization type
- masking and non-echo behavior for sensitive fields
- wiring current platform routes to read saved configuration first
- fallback behavior to existing env-based or mock configuration while migration is incomplete
- status fields for configuration presence and future validation readiness
- UI presentation of unsupported authorization methods as disabled or unavailable

### Out of Scope

- encrypting credentials at rest in phase one
- multiple saved profiles per platform
- full OAuth browser callback flow
- automated credential refresh
- real credential connectivity verification against every platform API
- audit logs and approval workflow for credential changes
- tenant-level or team-level credential isolation

## User Roles

### Admin

- can access the `平台授权` module
- can view platform authorization details
- can create or update platform credentials
- can choose the authorization type for each platform
- can see whether individual sensitive fields are already configured

### Operator

- does not see plaintext credentials
- cannot access the `平台授权` module in phase one

### Viewer

- no platform authorization management access in phase one

## Information Architecture

The feature should be delivered as a new first-level navigation item named `平台授权`.

The module has two layers:

### 1. Platform Connection List

This is the landing screen. It shows one row or card per supported platform:

- Baidu
- Kuaishou
- Jliang
- Google Ads

Each item should show:

- platform name
- current authorization type
- configuration status
- last updated time
- last updated by
- primary action such as `配置` or `编辑`

The list should optimize for fast admin scanning rather than deep detail.

### 2. Platform Configuration Drawer

Selecting a platform opens a focused editing surface.

This surface should include:

- platform identity and short description
- authorization type selector
- dynamic form fields for the selected supported type
- field-level status such as `已配置` for sensitive values already stored
- save action
- `测试连接` action entry

The first version should use a drawer to stay consistent with the project’s current management patterns.

## Authorization Model

The architecture should distinguish:

- `platform`: which external ad platform is being configured
- `auth_type`: which authorization strategy is used
- `config`: the values required by that strategy

This distinction is the key to future expansion. A platform should not be hard-coded to one forever-fixed credential shape in the data model, even if only one method is truly supported today.

### Phase-One UX Rule

For each platform:

- the admin can select from multiple authorization types in the UI
- only supported types can be saved
- unsupported types are visible but marked `暂未支持`

This gives product-level visibility into future extensibility without pretending those flows already work.

## Supported Platforms And Phase-One Authorization Types

The first version supports these active methods:

### Baidu

- active `auth_type`: `account_password_token`
- fields:
  - `username`
  - `password`
  - `token`

### Kuaishou

- active `auth_type`: `app_access_token`
- fields:
  - `appId`
  - `appSecret`
  - `accessToken`

### Jliang

- active `auth_type`: `marketing_token`
- fields:
  - `appId`
  - `accessToken`
  - `advertiserId`

### Google Ads

- active `auth_type`: `ads_api`
- fields:
  - `clientId`
  - `clientSecret`
  - `developerToken`
  - `customerId`

### Future Visible But Unsupported Types

The UI should be able to show additional options such as:

- `oauth2`
- `api_key`
- `account_password`
- other platform-specific strategies

These options should not be savable until backend support exists.

## Data Model Design

Introduce a new table named `platform_connections`.

Each row represents the currently active saved connection configuration for one platform.

### Fields

- `id`
- `platform`
- `auth_type`
- `config_json`
- `status`
- `last_verified_at`
- `last_error`
- `updated_by`
- `created_at`
- `updated_at`

### Field Semantics

- `platform`: canonical platform key such as `baidu`, `kuaishou`, `jliang`, `google`
- `auth_type`: authorization strategy key
- `config_json`: JSON object containing the fields for the selected authorization type
- `status`: connection state summary, with initial values such as `unconfigured`, `configured`, `invalid`
- `last_verified_at`: reserved for future connection tests
- `last_error`: reserved for future validation feedback
- `updated_by`: admin user id of last editor

### Phase-One Constraints

- one row per platform
- one active authorization type per platform
- `config_json` stores sensitive values in plain application storage in phase one
- plaintext values are never returned to the frontend after save

## Sensitive Data Rules

The user chose a lightweight storage model for phase one.

Therefore:

- credentials may be stored directly in the database without application-layer encryption
- the frontend must never re-render full stored secrets after save
- detail APIs return only field presence state, such as `configured: true`
- saving a blank sensitive field during edit means `keep existing value`
- saving a new non-blank value means `replace existing value`

Example:

- a saved `clientSecret` should later display as `已设置`
- the admin must enter a new value to replace it
- no role should receive the old value over the API

## Backend API Design

Add a dedicated route group:

- `GET /api/platform-connections`
- `GET /api/platform-connections/:platform`
- `PUT /api/platform-connections/:platform`
- `POST /api/platform-connections/:platform/test`

### `GET /api/platform-connections`

Returns connection summary data for the list page:

- platform
- available authorization types
- current authorization type
- status
- updated_at
- updated_by display info if available

### `GET /api/platform-connections/:platform`

Returns:

- platform metadata
- selected authorization type
- available authorization types with support flags
- non-sensitive detail fields
- sensitive field presence state

### `PUT /api/platform-connections/:platform`

Admin-only.

Validates:

- platform is supported
- auth type is recognized
- auth type is currently supported for save
- required fields for that auth type are present

Persists:

- selected `auth_type`
- merged `config_json`
- `status = configured`
- `updated_by`

### `POST /api/platform-connections/:platform/test`

Admin-only.

Phase one should implement this as a local validation endpoint that:

- validates required fields exist
- returns a structured result such as `ok`, `missing_fields`, and a short status message
- does not call real third-party APIs yet

## Route Integration Strategy

Existing platform route files should not continue to be the primary configuration source.

Instead, each platform route should:

1. try to load the saved connection from `platform_connections`
2. if present and valid for the required auth type, use it
3. otherwise fall back to current environment-variable or mock configuration

This migration strategy keeps the current product usable while moving configuration ownership into the application.

It also allows the reporting UI to stop instructing users to modify backend files.

## Frontend Experience

### List Page

The list page should prioritize operational clarity.

Suggested columns or card fields:

- platform name
- authorization type
- connection status
- last updated time
- updated by
- action

Status values in phase one:

- `未配置`
- `已配置`
- `配置异常`

### Configuration Drawer

The drawer should render forms from a platform + auth-type schema rather than hard-coded one-off layouts for each route file.

Common behaviors:

- auth type selector at the top
- disabled future auth-type options with a `暂未支持` label
- field help text where platform terminology is not obvious
- sensitive inputs shown empty when already configured
- nearby hint such as `留空则保留原值`

### Permissions In UI

- only `admin` should see the module in navigation
- only `admin` can open the page, view details, and save changes
- non-admin users have no module entry and no detail view in phase one

## Validation Rules

Phase one validation should include:

- supported platform check
- supported auth type check
- required fields per auth type
- merge-preserve behavior for existing secrets when edit payload leaves a sensitive field blank
- rejection of unsupported future auth types

The validation contract should live in one backend definition layer so frontend and backend behavior stay aligned.

## Testing Strategy

Minimum verification should cover:

- admin can list connections
- non-admin cannot update connections
- unsupported auth types are rejected
- sensitive values are not returned by detail API
- blank edit payload preserves existing secrets
- saved configuration is used by platform route loaders before env fallback
- UI shows supported and unsupported auth types correctly
- UI updates platform status after save

## Rollout Notes

The first delivery should be framed as a management foundation, not full cross-platform authorization infrastructure.

The value of this phase is:

- no more manual route-file credential editing for supported platforms
- a dedicated product surface for integration setup
- a stable data model for future authorization methods

Later phases can add:

- at-rest encryption
- real credential validation
- OAuth callback flows
- multiple connection profiles
- audit trails
