# Holistic Review Recommendations

Date: 2026-05-19

Scope: Dynomite as a macOS Electron DynamoDB explorer for AWS SSO profiles, including current product surface, architecture, developer experience, and roadmap direction.

## Executive Summary

Dynomite is already useful as a focused DynamoDB desktop client: it handles AWS SSO profile discovery, table browsing, visual queries, scans, inline edits, bulk transforms, imports, exports, bookmarks, and a capable virtualized result grid. The strongest next improvements are not more basic CRUD features. They are workflow, safety, observability, and shareability features that make the app reliable during real support, migration, and incident work.

The highest-leverage direction is to turn Dynomite from "a table browser with editing" into "a repeatable DynamoDB operations workspace." That means saved query collections, environment-aware replay, request logs, safer write previews, and cross-environment comparison.

## What To Preserve

- Keep the app local-first and AWS-profile-native. Credentials staying in the Electron main process is the right security boundary.
- Keep the visual query builder as the default path. It makes common DynamoDB access patterns fast without asking users to remember expression syntax.
- Keep staged write review. This is an important safety affordance and should become more capable rather than being bypassed by quicker edit paths.
- Keep cross-environment table matching as a product theme. It is one of Dynomite's clearest opportunities to be better than generic database browsers.

## P0 Recommendations

### 1. Add a Raw Request Inspector and Execution Log

Add a docked or tab-level log of every query, scan, write, import, export, and auth-sensitive operation.

Capture:

- timestamp
- profile, account ID, and region
- table and index
- operation type
- key/filter/projection/update expressions
- request duration
- returned item count and scanned count
- consumed capacity when requested
- retry count and final error

Why: users need to trust what the app did, replay operations, diagnose slow scans, and explain production changes after the fact.

### 2. Strengthen Write Safety

Improve the existing staged change flow before adding broader write features.

Recommended additions:

- field-by-field diff previews for JSON edits, bulk edits, scripts, imports, and deletes
- conditional write support for optimistic guards
- clearer partial-success reporting with succeeded, failed, skipped, and retried counts
- local write audit history with before/after snapshots where feasible
- rollback hint generation for simple updates and deletes

Why: Dynomite already supports powerful data modification. The risk now is not missing write capability; it is users lacking enough context before and after writes.

### 3. Make Saved Queries Shareable

Move beyond local bookmarks by supporting file-backed query collections.

Recommended format:

- JSON or YAML files stored in a project directory
- named queries with variables
- optional profile/environment targets
- optional notes/runbook text
- exportable/importable collections

Why: support teams and engineers need reusable workflows that can be reviewed, versioned, and shared. Local-only bookmarks do not scale beyond one machine.

### 4. Add Environment-Aware Replay

Promote "open this table/query in another profile" to a first-class workflow.

Recommended behavior:

- find sibling tables by stable CloudFormation prefix
- preserve query inputs and column layout
- warn when index/key schema differs
- allow side-by-side result comparison
- support DEV/TEST/PROD profile groups

Why: debugging DynamoDB systems often means comparing the same item or access pattern across environments.

## P1 Recommendations

### 5. Add Query History and Replay

Keep a searchable local history of executed reads and writes.

Useful filters:

- profile
- table
- operation type
- status
- date range
- bookmark/collection origin

History should support replay, duplicate-as-bookmark, and export-to-code.

### 6. Add Projection and Capacity Awareness

Expose projection-expression building and consumed-capacity reporting in the query builder.

Recommended UI:

- field picker for projected attributes
- "return consumed capacity" toggle
- warnings for high scanned-to-returned ratios
- hints when a filter is post-read expensive

Why: this teaches better DynamoDB usage while reducing production risk and cost.

### 7. Support LocalStack and DynamoDB Local

Add custom endpoint support per profile or workspace.

Minimum viable scope:

- endpoint URL
- region
- credentials mode
- clear visual indicator that the tab is local/custom endpoint-backed

Why: this makes Dynomite more useful during development and testing, and aligns it with competing DynamoDB clients.

### 8. Improve Import Workflows

Upgrade JSON bulk import into a fuller import wizard.

Recommended additions:

- CSV import
- schema/type preview
- PK/SK conflict detection
- skip, replace, merge, and fail policies
- dry-run validation
- import summary with rejected rows

Why: imports are inherently risky because a small mapping mistake can affect many rows.

## P2 Recommendations

### 9. Add Workflow Chaining

Let users build small multi-step workflows such as:

1. Query user by email.
2. Use `userId` from the result to query related tables.
3. Compare related records.
4. Stage a targeted update.

This should build on saved query collections and variables rather than becoming a separate automation system.

### 10. Add Snapshot and Diff Tools

Support saving result snapshots and comparing them across time or environments.

Use cases:

- verify migrations
- compare production and staging records
- audit rollout changes
- inspect drift after support actions

### 11. Add Schema and Data Profiling

From a query or sample scan, infer:

- field presence rate
- observed types
- null/empty rates
- top values
- nested object shapes
- timestamp and ID-like fields

This would make Dynomite more useful when exploring unfamiliar tables.

## Engineering Recommendations

### Test the Risky Boundaries First

Prioritize automated tests around:

- IPC validation and error handling
- query expression construction
- table name matching
- batch write retry behavior
- import parsing and conflict handling
- staged change application

These areas have higher blast radius than pure UI rendering.

### Split Large UI Surfaces Gradually

`TabContent` appears to own many workflows. Avoid a sweeping rewrite, but extract future work into focused units:

- query execution state
- staged write review
- import/export flows
- request history/log panel
- environment replay controls

Use extraction only when touching the feature area for real product work.

### Keep Electron Security Boundaries Explicit

Continue keeping AWS clients and filesystem writes in the main process. As new features are added, document each new IPC method with:

- caller intent
- validated input shape
- allowed side effects
- returned error model

This will matter more as imports, custom endpoints, write audits, and workflow files grow.

## Documentation Recommendations

Keep these documents current:

- `README.md`: current capability overview and top-level roadmap links.
- `ROADMAP.md`: implementation-oriented feature planning.
- `docs/2026-03-18-competitive-feature-gap-analysis.md`: external parity and differentiation backlog.
- This document: holistic product and engineering priorities.

When features move from planned to shipped, update both `README.md` and the relevant roadmap/review document in the same pull request.

## Suggested Next Sequence

1. Implement request inspector and execution history storage.
2. Add write diff preview and partial-success summaries.
3. Introduce file-backed saved query collections with variables.
4. Build environment-aware replay and result diff on top of saved query definitions.
5. Add projection/capacity visibility to reduce expensive reads.
