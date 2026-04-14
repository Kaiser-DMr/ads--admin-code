# Campaign Management Design

## Background

The project is an ad operations admin console built with an Express + SQLite backend and a React + Ant Design frontend. The current campaign module supports only basic CRUD with a simple status field, a single budget field, and limited list interactions.

The product direction is to improve the project in three phases:

1. Backend experience and usability improvements
2. Business capability improvements
3. System capability improvements

Within the near-term business work, the first priority is not broad platform coverage. The first delivery focus is the campaign management mainline. The goal is to make the campaign page operationally complete enough for real day-to-day campaign control before expanding deeper into reporting or system governance.

## Product Goal

Turn the campaign page into a practical delivery management console that supports:

- structured campaign lifecycle management
- budget control with both total and daily limits
- optional approval flow
- single-item and batch actions
- clearer list-level visibility into schedule and budget health

The first phase should make campaign operations feel substantially more complete without trying to solve every workflow in the platform.

## Success Criteria

This phase is successful when:

- operators can create and edit campaigns with total budget, daily budget, schedule, platform, and review requirement settings
- campaign lifecycle follows an explicit workflow instead of free-form status mutation
- admins can review campaigns that require approval
- campaigns approved before their start date can automatically move into active delivery when the start date arrives
- operators can manage campaigns efficiently from the list page through search, filters, and batch actions
- list rows make schedule state and budget state visible without requiring drill-in
- mobile and desktop users can both complete the primary campaign management workflow

## Scope

### In Scope

- campaign state model redesign
- campaign data model expansion
- campaign list filtering and search
- campaign creation and editing improvements
- optional approval flow
- admin-only approve and reject actions
- single-item actions and batch actions
- half-automatic activation on campaign start date
- role-based action visibility
- backend and frontend validation for budget and scheduling inputs
- baseline mobile usability for the campaign management page

### Out of Scope

- multi-stage approval chains
- stage-based or channel-based budget allocation
- real scheduler or job orchestration infrastructure
- platform API-driven campaign sync
- advanced campaign detail workspace with multiple tabs
- report model unification across campaigns and reporting
- operation logs, notifications, or configuration center

## User Roles

### Admin

- can create, edit, submit, activate, pause, complete, terminate, and batch-manage campaigns
- can approve or reject campaigns that require review
- can delete campaigns only while they are still in `draft`

### Operator

- can create and edit campaigns
- can choose whether a campaign should require review
- can submit campaigns for review
- can activate, pause, complete, terminate, and batch-manage campaigns where allowed
- cannot approve or reject campaigns

### Viewer

- read-only access to campaign information
- cannot mutate campaign state

## Campaign Lifecycle

### Canonical Statuses

The campaign lifecycle should use these statuses:

- `draft`
- `pending_review`
- `pending_start`
- `active`
- `paused`
- `completed`
- `terminated`

### Status Semantics

- `draft`: campaign is being prepared and is not yet eligible to deliver
- `pending_review`: campaign has been submitted for approval and is waiting for admin action
- `pending_start`: campaign has passed the readiness gate and is waiting for the start date to begin delivery
- `active`: campaign is currently delivering
- `paused`: campaign delivery has been manually paused
- `completed`: campaign delivery has been manually marked complete after the campaign has run
- `terminated`: campaign has been manually ended early and should not resume

### Lifecycle Rules

- New campaigns are created in `draft`
- A draft campaign can either remain in draft or be submitted for review when `requires_review = true`
- A draft campaign that does not require review can move directly to `pending_start`
- A campaign in `pending_review` can be approved or rejected only by an admin
- Approval moves the campaign to `pending_start`
- Rejection returns the campaign to `draft` and records a rejection reason in `status_reason`
- A campaign in `pending_start` should automatically move to `active` once the current date reaches the configured `start_date`
- A campaign in `active` can be paused, completed, or terminated
- A campaign in `paused` can be resumed back to `active` if the campaign has already reached its start date, or back to `pending_start` if the campaign start date is still in the future
- A campaign in `completed` or `terminated` is considered closed for the first phase and cannot be reactivated

### Automation Rule

The first phase uses a lightweight half-automatic model:

- campaign start is automatic
- campaign end is manual

Specifically:

- if a campaign is in `pending_start` and its `start_date` is today or earlier, it should be transitioned to `active`
- this transition should be triggered opportunistically by backend read/write flows instead of a dedicated scheduler in phase one
- reaching `end_date` does not automatically mark the campaign `completed`
- completion remains a human action so operators keep control over the final close-out

## Budget Model

Each campaign should support:

- `total_budget`
- `daily_budget`

### Budget Behavior

- `total_budget` is the full campaign cap
- `daily_budget` is the daily spend control value shown and validated in the campaign workflow
- `spent` remains the accumulated spend field
- remaining budget is derived as `max(total_budget - spent, 0)`
- budget usage rate is derived as `spent / total_budget`

### First-Phase Budget Boundaries

The first phase does not include a real budget enforcement engine. It should:

- store both budget values
- validate them on create and edit
- display them clearly in the list and detail surfaces
- support future reporting and alerting work

Minimum validation rules:

- `total_budget` must be greater than 0
- `daily_budget` must be greater than 0
- `daily_budget` must not exceed `total_budget`
- `end_date` must not be earlier than `start_date`

## Data Model Design

The existing `campaigns` table should be expanded rather than replaced.

### Existing Fields Kept

- `id`
- `name`
- `status`
- `spent`
- `start_date`
- `end_date`
- `platform`
- `targeting`
- `impressions`
- `clicks`
- `conversions`
- `created_by`
- `created_at`
- `updated_at`

### Fields To Rename Or Reinterpret

- the current `budget` field should be migrated or normalized into `total_budget`

### New Fields

- `total_budget`
- `daily_budget`
- `requires_review`
- `auto_activate`
- `submitted_at`
- `approved_by`
- `approved_at`
- `completed_at`
- `terminated_at`
- `status_reason`

### Field Semantics

- `requires_review`: boolean flag set during authoring
- `auto_activate`: boolean flag defaulting to enabled in phase one
- `submitted_at`: timestamp for review submission
- `approved_by`: admin user id of approver
- `approved_at`: timestamp of approval
- `completed_at`: timestamp of manual completion
- `terminated_at`: timestamp of manual termination
- `status_reason`: free-text reason for rejection, pause rationale, or termination rationale depending on action context

## Frontend Experience

The campaign page should become an operational management screen with four layers.

### 1. Top Management Bar

This area should include:

- keyword search
- status filter
- platform filter
- schedule/date filter
- create campaign action

This layer is responsible for helping users quickly find campaigns.

### 2. Batch Action Bar

This area appears when one or more campaigns are selected.

Batch actions in phase one:

- submit for review
- activate
- pause
- terminate

Batch actions should validate eligibility and show partial-result feedback when some selected rows cannot perform the requested action.

### 3. List Main View

Each row should prioritize two information groups.

#### Schedule and Lifecycle

- current status
- start date
- end date
- pending-start visibility
- auto-activate visibility if needed

#### Budget Control

- total budget
- daily budget
- spent amount
- remaining budget
- budget usage rate

Secondary metrics such as platform, impressions, clicks, and CTR can remain visible but should not crowd out lifecycle and budget information.

### 4. Row-Level Actions

The list should not display every possible button at once. It should show actions based on status and role.

Recommended action patterns:

- `draft`: edit, submit for review, activate if no review required, delete
- `pending_review`: view, withdraw, admin approve, admin reject
- `pending_start`: view, pause, terminate
- `active`: view, pause, complete, terminate
- `paused`: view, resume, terminate
- `completed`: view, duplicate
- `terminated`: view, duplicate

### Create/Edit Form

The create/edit experience should be upgraded from the current small modal form into a more structured modal or drawer grouped by intent.

Form sections:

1. Basic information
   - campaign name
   - platform
2. Delivery schedule
   - start date
   - end date
   - requires review
3. Budget control
   - total budget
   - daily budget

The first phase does not need advanced audience configuration redesign unless it is required to preserve existing functionality.

## Backend API Design

The current generic update endpoint is not enough to safely handle lifecycle rules. The backend should introduce action-oriented endpoints so that status transitions are validated centrally.

### Query API

`GET /campaigns`

Should support:

- keyword search
- status filter
- platform filter
- requires-review filter
- schedule range filter
- budget-health filter with explicit options: all, healthy, exhausted
- pagination

### CRUD API

- `POST /campaigns`
- `PUT /campaigns/:id`
- `GET /campaigns/:id`

These should manage campaign authoring data, not unrestricted lifecycle mutation.

### Lifecycle Action APIs

- `POST /campaigns/:id/submit-review`
- `POST /campaigns/:id/withdraw-review`
- `POST /campaigns/:id/approve`
- `POST /campaigns/:id/reject`
- `POST /campaigns/:id/activate`
- `POST /campaigns/:id/pause`
- `POST /campaigns/:id/complete`
- `POST /campaigns/:id/terminate`

Each endpoint should:

- validate current status
- validate acting user role
- update lifecycle timestamps and reason fields as needed
- return the updated campaign record

### Batch Action APIs

- `POST /campaigns/batch/submit-review`
- `POST /campaigns/batch/activate`
- `POST /campaigns/batch/pause`
- `POST /campaigns/batch/terminate`

Each batch endpoint should:

- accept a list of campaign ids
- evaluate each campaign independently
- apply allowed transitions only
- return per-id success/failure results so the UI can explain mixed outcomes

## Approval Flow

Approval is optional at the campaign level.

### Authoring Behavior

- the user selects whether the campaign requires approval
- if approval is required, the primary progression path is `draft -> pending_review -> pending_start`
- if approval is not required, the primary progression path is `draft -> pending_start`
- a campaign in `pending_review` can be withdrawn back to `draft` by an operator or admin before review is completed

### Approval Permissions

- only admins can approve or reject
- operators can submit for review but cannot make the review decision

### Approved-But-Not-Started State

After approval, the campaign should move to `pending_start` rather than an intermediate approved state. This keeps the lifecycle easier to understand and matches the half-automatic activation rule.

## Action Visibility Rules

The frontend should derive button visibility from a consistent ruleset instead of ad hoc JSX conditions spread across the page.

The preferred design is a small status-action mapping layer that takes:

- current status
- current role
- review requirement flag
- current date vs start date

and returns:

- allowed row actions
- allowed batch actions
- labels and confirmation requirements

This keeps the UI maintainable as the campaign workflow grows.

## Mobile Experience Requirements

Campaign management is a business priority and must remain operable on mobile.

Phase-one mobile requirements:

- filters must wrap or collapse safely on small screens
- key row information must remain readable without horizontal chaos
- batch actions must be usable with touch targets
- create/edit flow must remain usable on mobile modal/drawer layouts

Mobile optimization in this phase should support the campaign workflow, not aim for a full mobile-first redesign of the entire product.

## Error Handling

The system should prefer explicit business errors over silent failures.

Examples:

- attempting to approve a campaign that is not in `pending_review` should return a lifecycle validation error
- attempting to submit a campaign with invalid dates or invalid budget values should return field-specific validation errors
- attempting a batch action on mixed statuses should return partial results instead of failing the entire operation without detail

Frontend messaging should distinguish:

- validation issues the user can fix immediately
- permission issues
- lifecycle conflicts caused by current state

## Reporting Compatibility

Reporting is not being redesigned in this phase, but this campaign work must not block future reporting improvements.

To preserve compatibility:

- spend, impression, click, and conversion fields remain intact
- campaign lifecycle data should become richer, not less queryable
- total and daily budget values should be available for future report filters and budget diagnostics

## Testing Strategy

### Backend

- lifecycle transition tests
- permission tests
- batch action tests
- create/edit validation tests
- half-automatic activation tests

### Frontend

- campaign form validation tests
- filter and search interaction tests
- row action visibility tests by role and status
- batch action availability and result handling tests

### Verification Flow

Manual verification for the primary business path:

1. create campaign in `draft`
2. set total budget, daily budget, schedule, and optional review flag
3. submit for review when review is required
4. approve as admin
5. confirm campaign moves to `pending_start`
6. confirm campaign becomes `active` when start date is reached
7. pause, resume, complete, and terminate with valid state restrictions
8. execute the same patterns through batch actions where applicable

## Implementation Boundaries For The First Plan

The implementation plan created from this spec should stay focused on the campaign mainline only.

It may include:

- database migration or schema evolution
- backend route refactor for campaign lifecycle actions
- frontend campaign page refactor
- action visibility mapping
- tests required to prove lifecycle correctness

It should not include:

- report page redesign
- creative workflow redesign
- notification center
- audit log system
- platform integration work

## Recommended Delivery Order

1. evolve data model and preserve backward compatibility
2. centralize lifecycle transition logic in backend
3. expand frontend API layer
4. redesign campaign list and forms around schedule + budget management
5. add batch actions
6. add lifecycle and validation tests
7. verify desktop and mobile campaign operations end-to-end

## Summary

The first business-focused upgrade to this project should center on campaign delivery management. The system should move away from a simple CRUD list and toward a structured operations console with explicit lifecycle control, budget clarity, optional approval, and efficient list-based actions. This keeps the first phase ambitious enough to matter while still narrow enough to implement cleanly.
