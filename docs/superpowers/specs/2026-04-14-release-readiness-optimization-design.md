# Release Readiness Optimization Design

## Background

The project has recently added campaign management and platform authorization management, and the product surface is now broad enough that release quality matters more than adding another feature immediately.

Two signals show the current gap:

- the frontend still loads route pages synchronously, which pushes more code into the initial bundle than necessary
- repository-level onboarding and deployment documentation have not kept pace with the product surface

The user explicitly chose an `上线质量优先` direction for this iteration. That means the goal is to improve delivery readiness, not expand backend business behavior.

## Product Goal

Improve release readiness in two visible ways:

- reduce frontend loading cost and improve route transition behavior through route-level lazy loading
- make the repository easier to run, evaluate, and deploy through more complete project documentation

This iteration should make the project feel more production-ready without changing business rules or redesigning product workflows.

## Success Criteria

This phase is successful when:

- main page routes are lazy-loaded instead of being bundled into the initial route tree synchronously
- route loading has a clear, reusable fallback state instead of blank or abrupt transitions
- the frontend build remains successful after the routing changes
- the code structure for routing stays simple and understandable
- `README.md` clearly documents the current modules, platform authorization capability, local development flow, default accounts, build flow, and basic deployment expectations
- the optimization work does not change backend API semantics or create new business capabilities

## Scope

### In Scope

- route-level lazy loading for major frontend pages
- a shared page-level loading fallback for lazy-loaded routes
- light-touch build optimization only if needed after fresh verification
- `README.md` improvements for onboarding and deployment readiness
- fresh frontend verification through tests and production build

### Out of Scope

- new backend endpoints or data model changes
- visual redesign of Dashboard or Login
- large-scale chunking strategy work across all dependencies
- SSR, pre-rendering, CDN strategy, or infrastructure automation
- deployment scripts for specific cloud vendors
- new product modules or workflow changes

## Chosen Approach

The user selected an `上线质量优先` path. Among the explored options, the recommended approach is:

1. implement route-level lazy loading first
2. add a minimal and consistent loading fallback
3. re-run the frontend build
4. only introduce extra bundler chunking rules if the build result shows that a small config change is still justified
5. update documentation to reflect the current product surface and deployment expectations

This approach is preferred because it improves the real user-facing loading path while keeping the implementation small and easy to verify.

## Frontend Architecture Design

### Route Loading Strategy

The application should keep the existing route structure, auth model, and page boundaries. The optimization is focused on how page modules are loaded.

The route tree should move from eager static imports to `React.lazy` for major page modules such as:

- `Dashboard`
- `Campaigns`
- `Creatives`
- `Reports`
- `Users`
- `PlatformConnections`
- optionally `Login` if it fits cleanly with the auth boundary

`MainLayout` and auth wrappers should remain easy to reason about. The optimization should not create a deeply nested routing abstraction or a configuration-heavy route registry.

### Loading Fallback

Lazy-loaded routes should render through a shared fallback component rather than ad hoc spinners spread across multiple files.

The fallback should:

- match the admin console tone
- render safely inside the existing layout
- be reusable by all lazy-loaded pages
- avoid visual jumpiness during route transitions

The fallback can remain intentionally simple, such as a centered card or section-level loading state consistent with current Ant Design usage.

### Build Optimization Guardrail

This phase should not begin by adding manual chunking rules.

Instead:

- first implement route-level lazy loading
- then run a fresh production build
- inspect whether the remaining chunk warning is still materially problematic

If a chunking rule is still warranted, it should be conservative and easy to explain, such as separating a heavy charting or vendor group. If the build is acceptable after lazy loading alone, no additional bundler complexity should be introduced.

## Documentation Design

`README.md` should be upgraded from a basic project note into a release-readiness landing page for developers and reviewers.

It should cover:

- project overview and core modules
- frontend and backend architecture summary
- current feature surface including platform authorization
- local development steps
- default accounts
- environment and runtime assumptions
- production build steps
- a basic deployment section describing frontend static hosting and backend Node service expectations

The documentation should reflect the current repository truth rather than aspirational architecture.

## Component And File Boundaries

The implementation should preserve small, clear boundaries:

- routing changes live near `frontend/src/App.jsx`
- the shared lazy-loading fallback lives in a small reusable component
- bundler config changes, if any, stay local to `frontend/vite.config.js`
- repository onboarding and deployment guidance remain in `README.md`

This keeps performance work understandable and avoids coupling product behavior changes with infrastructure-facing changes.

## Data Flow And Behavior

The optimization should not alter application data flow.

After the change:

- auth still gates entry into protected routes
- navigating to a route triggers loading of that page module on demand
- while the module is loading, the shared fallback is displayed
- once loaded, the existing page component runs with its current API calls and internal loading behavior unchanged

This distinction matters: route loading optimization should not be conflated with page data-fetching redesign.

## Error Handling

This phase should keep error handling pragmatic.

- existing page-level API error handling remains unchanged
- route-level lazy loading should always have a safe fallback UI
- if a lazy import fails at runtime, the current app will still rely on the surrounding React error behavior unless the existing app already has a route-level error boundary

This spec does not require adding a new global error boundary unless implementation reveals a clear need.

## Testing And Verification

Verification should follow the project’s existing evidence-first rule.

Minimum required verification:

- `cd frontend && npm test`
- `cd frontend && npm run build`

Review expectations after implementation:

- route definitions still navigate correctly
- protected routes still respect auth state
- lazy-loaded pages render through the shared fallback without blank screens
- `README.md` matches the actual current project structure and commands

## Risks And Mitigations

### Risk: Added routing complexity outweighs the gain

Mitigation:

- keep lazy loading local to route declarations
- avoid building an abstract route registry just for this optimization

### Risk: Build warning remains after lazy loading

Mitigation:

- inspect the fresh build output first
- add a small `manualChunks` rule only if needed

### Risk: Documentation drifts from the codebase

Mitigation:

- describe only current capabilities
- avoid documenting non-existent deployment automation or unsupported environment requirements

## Implementation Notes

The most likely touched files are:

- `frontend/src/App.jsx`
- a new shared loading component in the frontend source tree
- `frontend/vite.config.js`
- `README.md`

If implementation reveals an obviously missing supporting style or tiny utility, that should remain secondary to the main optimization goal.

## Non-Goals For This Iteration

To keep the work focused, this iteration should not absorb:

- Dashboard visual polish
- Login page polish
- backend deployment scripts
- environment variable refactors across backend and frontend
- broader frontend state management or data-fetching refactors

## Summary

This design intentionally favors targeted release-quality improvements over broader feature work. The deliverable is a cleaner loading path for the frontend and clearer repository documentation, with minimal architectural disruption and straightforward verification.
